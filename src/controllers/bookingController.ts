import mongoose from 'mongoose';
import moment from "moment-timezone";
import cron from "node-cron";
import { validationResult } from 'express-validator';
import { Request, Response } from 'express';
import Service from '../models/Service.js';
import Booking from '../models/Booking.js';
import Razorpay from 'razorpay';
import User from '../models/User.js';
import { io } from '../server.js';
import Maid from '../models/Maid.js';
import { sendNotification, sendNotificationBookingToAdmin, sendNotificationToAdmins, sendNotificationToMaid, sendNotificationToUser } from '../utils/firebase.js';
import Payment from '../models/Payment.js';
import TimeSlot from "../models/TimeSlot.js";
import Building from "../models/Building.js";
import Setting from "../models/Setting.js";
import { exit } from 'node:process';
import appVersion from '../models/appVersion.js';

function getNextBookingReference(lastRef?: string): string {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const year = now.getFullYear().toString();
  const prefix = `ME${day}${month}${year}`;
  let seq = 1;
  if (lastRef && lastRef.startsWith(prefix)) {
    const lastNumberStr = lastRef.replace(prefix, "");
    const lastNumber = parseInt(lastNumberStr, 10);
    if (!isNaN(lastNumber)) {
      seq = lastNumber + 1;
    }
  }
  const numberPart = seq.toString().padStart(4, "0");
  return `${prefix}${numberPart}`;
}


export const createMultipleBooking = async (req: Request, res: Response): Promise<any> => {
  try {
    const bookingsPayload = req.body;
    const userId = (req as any).user._id;

    if (!Array.isArray(bookingsPayload) || bookingsPayload.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid booking payload" });
    }

    // Fetch user
    const user = await User.findById(userId).select("wallet_balance addresses bookingCount isBlock isActive");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.isBlock) {
      return res.status(400).json({ success: false, message: "Your account is blocked. Please contact support.", });
    }
    if (!user.isActive) {
      return res.status(400).json({ success: false, message: "Your account is deactive or deleted.", });
    }
    // Fetch last booking reference
    const lastBooking = await Booking.findOne().sort({ createdAt: -1 });
    let lastRef = lastBooking?.booking_reference || undefined;

    const createdBookings: any[] = [];

    // PROCESS EACH BOOKING
    for (const item of bookingsPayload) {
      console.log('multi')
      // console.log(item)
      const { serviceId, addressId, bookingDate, type, startTime, endTime, payment_details } = item;

      payment_details.service_charge = (Number(payment_details.service_charge / bookingsPayload.length).toFixed(2))
      payment_details.taxes = (Number(payment_details.taxes / bookingsPayload.length).toFixed(2))
      payment_details.total_amount = (Number(payment_details.total_amount / bookingsPayload.length).toFixed(2))
      payment_details.wallet_amount = (Number(payment_details.wallet_amount / bookingsPayload.length).toFixed(2))

      const service = await Service.findById(serviceId).select("duration");
      if (!service) {
        return res.status(400).json({
          success: false,
          message: `Invalid service for booking date ${bookingDate}`,
        });
      }

      const selectedAddress = user.addresses.find((addr: any) => addr._id.toString() === addressId);
      if (!selectedAddress) {
        return res.status(400).json({ success: false, message: `Address not found for booking date ${bookingDate}`, });
      }
      if (selectedAddress.serviceAvailable === false) {
        return res.status(400).json({ success: false, message: `Service is not available at the selected address`, });
      }

      const address = {
        type: selectedAddress.type,
        house: selectedAddress.house,
        street: selectedAddress.street,
        wing_plot: selectedAddress.wing_plot,
        city: selectedAddress.city,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        flat: selectedAddress.flat,
        building: selectedAddress.building,
        latitude: selectedAddress.latitude,
        longitude: selectedAddress.longitude,
      };

      const newRef = getNextBookingReference(lastRef);
      lastRef = newRef;
      // const pin = Math.floor(1000 + Math.random() * 9000).toString();

      const sec = Number(service.duration ?? 0) * 3600;
      const newBooking = await Booking.create({
        user_id: userId,
        service_id: serviceId,
        address_id: address,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        type: type || 'multiple',
        duration_hours: sec,
        payment_details: payment_details,
        total_amount: Number(payment_details.total_amount) + Number(payment_details.wallet_amount),
        status: "failed",
        // pin: pin,
        booking_reference: newRef,
      });

      createdBookings.push(newBooking);
    }
    // console.log(bookingsPayload[0].isWallet)
    // console.log(bookingsPayload[0].payment_details.total_amount == 0)
    if (bookingsPayload[0].isWallet && bookingsPayload[0].payment_details.total_amount == 0) {
      console.log("coming in wallet")
      // console.log("coming in wallet");

      const walletAmount = Number(bookingsPayload[0].payment_details.wallet_amount || 0);
      const totalAmount = Number(bookingsPayload[0].payment_details.total_amount || 0);

      user.wallet_balance = (user.wallet_balance ?? 0) - walletAmount;
      if (!userId) throw new Error("userId is undefined");
      const paymentData = {
        payment_method: 'wallet',
        amount: totalAmount + walletAmount,
        booking_ids: createdBookings.map(b => b._id),
        payment_status: "success",
        payment_gateway: 'wallet',
        transaction_id: 'pay_' + new Date().getTime(),
        user_id: userId
      };

      await Payment.create(paymentData);

      for (let item of createdBookings) {
        const latest = await Booking.findById(item._id);
        if (!latest) continue;
        latest.payment_status = "success";
        latest.status = 'pending';
        await latest.save();
      }

      await sendNotificationToAdmins(
        'Multiple Bookings Created',
        `${createdBookings.length} new bookings created successfully with bookingIds: ${createdBookings.map(b => b.booking_reference).join(',')}`,
        {
          type: "new_booking",
          bookingIds: createdBookings.map(b => b._id.toString()).join(','),
          userId: userId.toString()
        }
      );
      await sendNotificationToUser(
        userId.toString(),
        'New Booking Created',
        `A new bookings has been created with BookingIds ${createdBookings.map(b => b.booking_reference).join(',')}`,
        {
          type: "new_booking",
          bookingIds: createdBookings.map(b => b._id.toString()).join(','),
          userId: userId.toString()
        });
    }
    // save user once
    user.bookingCount = (user.bookingCount ?? 0) + createdBookings.length;
    await user.save();
    console.log("last stage")
    return res.status(201).json({ success: true, message: "Multiple bookings created successfully", bookings: createdBookings, });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error creating bookings" });
  }
};

export const getUserBookings = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user._id;

    const bookings = await Booking.find({ user_id: userId })
      .populate("maid_id")
      .populate("service_id")
      .sort({ booking_date: -1 });

    const now = moment().tz("Asia/Kolkata");

    const updatedBookings = bookings.map((booking: any) => {
      let isEditable = true;

      if (booking.start_time && booking.booking_date) {
        const bookingMoment = moment(booking.booking_date).tz("Asia/Kolkata");

        const time = booking.start_time.trim().toUpperCase();
        const [timePart, meridian] = [time.slice(0, -2), time.slice(-2)];
        let [hours, minutes] = timePart.split(":").map(Number);

        if (meridian === "PM" && hours !== 12) hours += 12;
        if (meridian === "AM" && hours === 12) hours = 0;

        bookingMoment.set({
          hour: hours,
          minute: minutes,
          second: 0,
          millisecond: 0,
        });
        const diffInMinutes = bookingMoment.diff(now, "minutes");
        if (diffInMinutes <= 30 || booking.status === 'ongoing' || booking.status === 'completed' || booking.status === 'cancelled' || booking.status === 'failed') {
          isEditable = false;
        }
      }

      return { ...booking.toObject(), isEditable, };
    });

    return res.status(200).json({ success: true, data: updatedBookings, });

  } catch (error) {
    console.error("Error fetching user bookings:", error);
    return res.status(500).json({ success: false, message: "Server error fetching bookings", });
  }
};

export const closeBooking = async (req: Request, res: Response): Promise<any> => {
  try {
    const { bookingId } = req.params;
    const userId = (req as any).user._id;
    const status = "completed";
    const booking = await Booking.findOne({ _id: bookingId, user_id: userId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    const maid = await Maid.findById(booking.maid_id);
    if (!maid) return res.status(404).json({ success: false, message: "Maid Not Found" })
    maid.is_booked = false
    await maid.save()
    const booking_complete_date = new Date()
    if (status === "completed") {
      booking.pin = "";
      await booking.save();
    }
    await Booking.findByIdAndUpdate(bookingId, { booking_complete_date, status });
    io.to(`booking:${booking._id}`).emit('booking:stop', {
      bookingId: booking._id,
    });
    return res.status(200).json({ success: true, message: 'Booking status updated' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error updating status' });
  }
};
export const updateBookingStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;
    const maidId = (req as any).user.maidId;

    const validStatuses = ['pending', 'confirmed', 'ongoing', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const booking = await Booking.findOne({ _id: bookingId, maid_id: maidId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    const maid = await Maid.findById(maidId)
    if (!maid) return res.status(404).json({ success: false, message: "Maid Not Found" })
    maid.is_booked = false
    await maid.save()
    const booking_complete_date = new Date()
    if (status === "completed") {
      // delete the pin after completion
      booking.pin = "";
      await booking.save();
    }
    await Booking.findByIdAndUpdate(bookingId, { booking_complete_date, status });
    return res.status(200).json({ success: true, message: 'Booking status updated', data: { payment_status: booking.payment_status, qr: "https://res.cloudinary.com/dr5cz2rqx/image/upload/v1773806864/ssh/qr_codes/dtd5d_1773806862980.png", totalAmount: booking.total_amount } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error updating status' });
  }
};
export const updateBookingPaymentStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const { bookingId } = req.params;
    const { paymentType } = req.body;
    const maidId = (req as any).user.maidId;

    const booking = await Booking.findOne({ _id: bookingId, maid_id: maidId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    booking.paymentType = paymentType;
    booking.payment_status = "success";
    await booking.save();
    return res.status(200).json({ success: true, message: 'Booking payment type updated' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error updating status' });
  }
};
export const cancleBookingByUser1 = async (req: Request, res: Response): Promise<any> => {
  try {
    const { bookingId } = req.params;
    const status = "cancelled"
    const userId = (req as any).user._id;
    const booking = await Booking.findOne({ _id: bookingId, user_id: userId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ success: false, message: "User Not Found" })
    user.wallet_balance = (user.wallet_balance || 0) + booking.total_amount;
    if (booking.isFreeBooking) {
      user.freeOffer.freeBookings = (user.freeOffer.freeBookings ?? 0) + 1;
    }
    await user.save()
    await Booking.findByIdAndUpdate(bookingId, { status });
    return res.status(200).json({ success: true, message: 'Booking Cancel Successful' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error updating status' });
  }
};
export const cancleBookingByUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const { bookingId } = req.params;
    const status = "cancelled";
    const userId = (req as any).user._id;

    const booking: any = await Booking.findOne({ _id: bookingId, user_id: userId });
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    const now = moment().tz("Asia/Kolkata");
    const bookingMoment = moment(booking.booking_date).tz("Asia/Kolkata");

    const time = booking.start_time.trim().toUpperCase();
    const [timePart, meridian] = [time.slice(0, -2), time.slice(-2)];
    let [hours, minutes] = timePart.split(":").map(Number);

    if (meridian === "PM" && hours !== 12) hours += 12;
    if (meridian === "AM" && hours === 12) hours = 0;

    bookingMoment.set({
      hour: hours,
      minute: minutes,
      second: 0,
      millisecond: 0,
    });

    if (bookingMoment.isBefore(now)) {
      return res.status(400).json({ success: false, message: "You cannot cancel a past booking", });
    }
    if (booking.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Booking is already cancelled", });
    }

    const user: any = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User Not Found" });
    }
    if (booking.payment_status === 'success') {
      user.wallet_balance = (user.wallet_balance || 0) + booking.total_amount;
    }
    if (booking.isFreeBooking) {
      user.freeOffer.freeBookings = (user.freeOffer.freeBookings ?? 0) - 1;
    }

    await user.save();
    await Booking.findByIdAndUpdate(bookingId, { status });
    // ADMIN NOTIFICATION
    await sendNotificationToAdmins(
      "Booking Cancelled by User",
      `Booking ${booking.booking_reference} was cancelled by the user.`,
      {
        type: "booking_user_cancelled",
        bookingId: booking._id.toString(),
        userId: booking.user_id.toString(),
      }
    );

    // USER NOTIFICATION
    await sendNotificationToUser(
      booking.user_id.toString(),
      "Booking Cancelled",
      `You have successfully cancelled your booking ${booking.booking_reference}. Any applicable refund has been credited to your wallet.`,
      {
        type: "booking_user_cancelled",
        bookingId: booking._id.toString(),
      }
    );

    return res.status(200).json({ success: true, message: "Booking Cancel Successful", });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error updating status",
    });
  }
};

export const submitPinAndStartTimer = async (req: Request, res: Response): Promise<any> => {
  try {
    const { bookingId } = req.params;
    const { pin } = req.body;
    const userId = (req as any).user.maidId;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }
    const booking = await Booking.findOne({ _id: bookingId, maid_id: userId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found or not assigned to this maid' });
    }
    if (booking.pin !== String(pin)) {
      return res.status(400).json({ success: false, message: 'Invalid PIN' });
    }
    const maid = await Maid.findById(userId)
    if (!maid) return res.status(404).json({ success: false, message: "Maid Not Found" })
    maid.is_booked = true
    await maid.save()
    const actualStartTime = new Date();
    const timerEndTime = new Date(actualStartTime.getTime() + (booking.duration_hours + booking.extend_time) * 60 * 60 * 1000);

    const bookings = await Booking.findByIdAndUpdate(bookingId, {
      actual_start_time: actualStartTime,
      timer_end_time: timerEndTime,
      status: 'ongoing',
      pinVerify: "Verified",
      // booking_complete_date: new Date()
    }, { new: true });
    if (!bookings) {
      return res.status(404).json({ message: "Booking not found" });
    }
    await bookings?.populate('user_id', 'fullName profile_image')
    await bookings?.populate('maid_id', 'name profile_image')
    // Start the real-time timer  starttime durationHours extend
    io.to(`booking:${booking._id}`).emit('booking:start', {
      bookingId: booking._id,
      booking: bookings
    });

    return res.json({ success: true, message: 'Timer started successfully', duration_hours: booking.duration_hours, timerEndTime });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error starting timer' });
  }
};
export const extendBookingTime1 = async (req: Request, res: Response): Promise<any> => {
  try {
    const { bookingId } = req.params;
    const { extendHours } = req.body;
    const userId = (req as any).user._id;

    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }
    const booking = await Booking.findOne({ _id: bookingId, user_id: userId, status: 'ongoing' });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found or not ongoing' });
    }

    if (!booking.timer_end_time) {
      return res.status(400).json({ success: false, message: 'Timer not started yet' });
    }

    const newExtendTime = booking.extend_time + extendHours;
    const newTimerEndTime = new Date(booking.timer_end_time.getTime() + extendHours * 60 * 60 * 1000);

    const bookings = await Booking.findByIdAndUpdate(bookingId, {
      extend_time: newExtendTime,
      timer_end_time: newTimerEndTime
    });
    if (!bookings) {
      return res.status(404).json({ message: "Booking not found" });
    }
    await bookings?.populate('user_id', 'fullName profile_image')
    await bookings?.populate('maid_id', 'name profile_image')
    // Extend the real-time timer
    io.to(`booking:${booking._id}`).emit('booking:extend', {
      bookingId: booking._id,
      booking: bookings
    });

    return res.json({ success: true, message: 'Time extended successfully', newTimerEndTime });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error extending time' });
  }
};
export const extendBookingTime = async (req: Request, res: Response): Promise<any> => {
  try {
    // const { bookingId } = req.params;
    // console.log(req.body)
    const { extendMinutes, amount, bookingId } = req.body; // now minutes
    const userId = (req as any).user._id;

    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required', });
    }

    if (!extendMinutes || extendMinutes <= 0) {
      return res.status(400).json({ success: false, message: 'extendMinutes must be greater than 0', });
    }

    const booking = await Booking.findOne({ _id: bookingId, user_id: userId, status: 'ongoing', });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found or not ongoing', });
    }
    if (!booking.timer_end_time) {
      return res.status(400).json({ success: false, message: 'Timer not started yet', });
    }
    // Convert minutes → ms
    const extendMs = extendMinutes * 60 * 1000;
    const newExtendTime = (booking.total_extend_time ?? 0) + extendMinutes;
    const newTimerEndTime = new Date(booking.timer_end_time.getTime() + extendMs);

    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId, {
      total_extend_time: newExtendTime,
      extend_time: extendMinutes,
      isMaidRing: true,
      timer_end_time: newTimerEndTime,
      duration_hours: ((booking.duration_hours || 0) + (extendMinutes * 60))
    }, { new: true })
      .populate('user_id', 'fullName profile_image')
      .populate('maid_id', 'name profile_image');
    if (!updatedBooking) {
      return res.status(404).json({ success: false, message: 'Booking not found', });
    }
    console.log("extend amount" + amount)
    updatedBooking.total_amount = updatedBooking.total_amount + Number(amount || 0)
    console.log("amount" + updatedBooking.total_amount)
    await updatedBooking.save();
    const now = new Date();
    const diffMs: number = now.getTime() - updatedBooking.actual_start_time!.getTime();
    const secondsDiff = Math.floor(diffMs / 1000);
    const newSecond = updatedBooking.duration_hours - secondsDiff;
    updatedBooking.duration_hours = newSecond > 0 ? newSecond : 0;
    // console.log("third", updatedBooking)
    // Real-time update
    io.to(`booking:${updatedBooking._id}`).emit('booking:start', {
      bookingId: updatedBooking._id,
      booking: updatedBooking,
    });

    // if (!updatedBooking) {
    //   return res.status(404).json({ success: false, message: 'Booking not found', });
    // }

    // // Real-time update
    // io.to(`booking:${updatedBooking._id}`).emit('booking:extend', {
    //   bookingId: updatedBooking._id,
    //   booking: updatedBooking,
    //   extendMinutes,
    // });

    return res.json({ success: true, message: 'Time extended successfully', newTimerEndTime, });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error extending time', });
  }
};


// admin access api
export const getBookingsForAdmin1 = async (req: Request, res: Response): Promise<any> => {
  try {
    // const page = parseInt(req.query.page as string) || 1;
    // const limit = parseInt(req.query.limit as string) || 20;
    // const skip = (page - 1) * limit;
    // Get all bookings with service and user basic info populated
    const bookings = await Booking.find({})
      .populate('service_id', 'service_name description discountAmount')
      .populate('maid_id', 'name address phone skill')  // This is okay now
      .populate('user_id', 'fullName phone')  // This is okay now
      // .select('_id user_id address_id booking_date booking_dates start_time duration_hours total_amount status booking_reference createdAt')
      .sort({ booking_date: -1 });
    // .limit(limit)
    // .skip(skip)

    // Extract all unique user_ids from populated objects
    const userIds = [...new Set(
      bookings.map(b => {
        const uid = (b.user_id as any)?._id || b.user_id;
        return uid.toString();
      })
    )];

    // Fetch all users (with addresses)
    const users = await User.find({ _id: { $in: userIds } }).select('_id addresses');
    const userMap = new Map(users.map(u => [(u._id as mongoose.Types.ObjectId).toString(), u]));

    // Transform the bookings
    const transformedBookings = bookings.map(booking => {
      const userIdStr = ((booking.user_id as any)?._id || booking.user_id).toString();
      const user = userMap.get(userIdStr);

      return {
        booking_id: booking._id,
        booking_date: booking.booking_date,
        booking_dates: booking.booking_dates,
        type: booking.type,
        start_time: booking.start_time,
        end_time: booking.end_time,
        extent_time: booking.extend_time || 0,
        duration_hours: booking.duration_hours,
        total_amount: booking.total_amount,
        status: booking.status,
        booking_reference: booking.booking_reference,
        maid_name: (booking as any).maid_id?.name,
        maid_phone: (booking as any).maid_id?.phone,
        maid_skill: (booking as any).maid_id?.skill,
        maid_address: (booking as any).maid_id?.address,
        service_name: (booking as any).service_id?.service_name,
        service_description: (booking as any).service_id?.description,
        service_price: (booking as any).service_id?.discountAmount,
        user_name: (booking as any).user_id?.fullName,
        user_phone: (booking as any).user_id?.phone,
        user_address: booking.address_id || null
      };
    });

    return res.status(200).json({
      success: true, data: transformedBookings,
      // pagination: { page, limit, hasMore: bookings.length === limit,},
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching bookings' });
  }
};
export const getBookingsForAdmin2 = async (req: any, res: any): Promise<any> => {
  try {
    let { startDate, endDate } = req.query;
    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date(start);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const bookings = await Booking.find({ booking_date: { $gte: start, $lte: end } })
      // const bookings = await Booking.find({})

      .populate('service_id', 'service_name description discountAmount')
      .populate('maid_id', 'name address phone skill')
      .populate('user_id', 'fullName phone')
      .sort({ booking_date: -1 });

    const transformedBookings = bookings.map(booking => {
      return {
        booking_id: booking._id,
        booking_date: booking.booking_date,
        booking_dates: booking.booking_dates,
        type: booking.type,
        start_time: booking.start_time,
        end_time: booking.end_time,
        extend_time: booking.extend_time || 0,
        total_extend_time: booking.total_extend_time || 0,
        duration_hours: booking.duration_hours,
        total_amount: booking.total_amount,
        status: booking.status,
        payment_status: booking.payment_status,
        razorpayOrderId: booking.razorpayOrderId,
        razorpayPaymentId: booking.razorpayPaymentId,
        booking_reference: booking.booking_reference,
        maid_name: (booking as any).maid_id?.name,
        maid_phone: (booking as any).maid_id?.phone,
        maid_skill: (booking as any).maid_id?.skill,
        maid_address: (booking as any).maid_id?.address,
        service_name: (booking as any).service_id?.service_name,
        service_description: (booking as any).service_id?.description,
        service_price: (booking as any).service_id?.discountAmount,
        user_name: (booking as any).user_id?.fullName,
        user_phone: (booking as any).user_id?.phone,
        user_address: booking.address_id || null
      };
    });

    return res.status(200).json({ success: true, data: transformedBookings, });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching bookings' });
  }
};
export const getBookingsForAdmin = async (req: any, res: any): Promise<any> => {
  try {
    let { startDate, endDate, hub } = req.query;

    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date(start);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    let query: any = {
      booking_date: { $gte: start, $lte: end },
    };

    // If hub is provided, enforce hub filter strictly
    if (hub) {
      const existingBuildings = await Building.find({ hub }).lean();

      if (!existingBuildings.length) {
        return res.status(404).json({
          success: false,
          message: "No buildings found for this hub, so no bookings available",
          data: [],
        });
      }

      const buildings = existingBuildings.map((b) => b.name);

      // Apply building filter
      query["address_id.building"] = { $in: buildings };
    }

    const bookings = await Booking.find(query)
      .populate("service_id", "service_name description discountAmount")
      .populate("maid_id", "name address phone skill")
      .populate("user_id", "fullName phone")
      .sort({ booking_date: -1 })
      .lean();

    const transformedBookings = bookings.map((booking: any) => ({
      booking_id: booking._id,
      booking_date: booking.booking_date,
      booking_dates: booking.booking_dates,
      type: booking.type,
      start_time: booking.start_time,
      end_time: booking.end_time,
      actual_start_time: booking.actual_start_time,
      // timer_end_time: booking.timer_end_time,
      timer_end_time: booking.booking_complete_date,
      extend_time: booking.extend_time || 0,
      total_extend_time: booking.total_extend_time || 0,
      duration_hours: booking.duration_hours,
      total_amount: booking.total_amount,
      status: booking.status,
      payment_status: booking.payment_status,
      razorpayOrderId: booking.razorpayOrderId,
      razorpayPaymentId: booking.razorpayPaymentId,
      booking_reference: booking.booking_reference,
      pin: booking.pin,
      pinVerify: booking.pinVerify,

      maid_name: booking.maid_id?.name || null,
      maid_phone: booking.maid_id?.phone || null,
      maid_skill: booking.maid_id?.skill || null,
      maid_address: booking.maid_id?.address || null,

      service_name: booking.service_id?.service_name || null,
      service_description: booking.service_id?.description || null,
      service_price: booking.service_id?.discountAmount || null,

      user_name: booking.user_id?.fullName || null,
      user_phone: booking.user_id?.phone || null,

      user_address: booking.address_id || null,

      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt
    }));

    return res.status(200).json({
      success: true,
      total: transformedBookings.length,
      data: transformedBookings,
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching bookings",
    });
  }
};

export const getBookingsByIdForAdmin = async (req: Request, res: Response): Promise<any> => {
  try {
    const { bookingId } = (req as any).params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    // Find booking by ID with all needed info populated
    const booking = await Booking.findById(bookingId)
      .populate('service_id', 'service_name description discountAmount')
      .populate('maid_id', 'name address phone skill')
      .populate('user_id', 'fullName phone addresses') // include addresses here directly
      // .select('_id user_id address_id booking_date start_time duration_hours total_amount status booking_reference')
      .lean(); // make it plain JS object for easy transformation

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Extract user address from populated user data
    const user = booking.user_id as any; // since it's populated, it's an object
    const address = user?.addresses?.find(
      (addr: any) => addr._id.toString() === booking.address_id.toString()
    );

    // Transform response
    const transformedBooking = {
      booking_id: booking._id,
      booking_date: booking.booking_date,
      booking_dates: booking.booking_dates,
      type: booking.type,
      start_time: booking.start_time,
      end_time: booking.end_time,
      extent_time: booking.extend_time || 0,
      total_extend_time: booking.total_extend_time || 0,
      duration_hours: booking.duration_hours,
      total_amount: booking.total_amount,
      status: booking.status,
      booking_reference: booking.booking_reference,

      maid_name: (booking.maid_id as any)?.name,
      maid_phone: (booking.maid_id as any)?.phone,
      maid_skill: (booking.maid_id as any)?.skill,
      maid_address: (booking.maid_id as any)?.address,

      service_name: (booking.service_id as any)?.service_name,
      service_description: (booking.service_id as any)?.description,
      service_price: (booking.service_id as any)?.discountAmount,

      user_id: user?._id,
      user_name: user?.fullName,
      user_phone: user?.phone,
      user_address: booking.address_id || null
    };

    // Send response
    return res.status(200).json({ success: true, data: transformedBooking });

  } catch (error) {
    console.error('Error fetching booking by ID:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching booking' });
  }
};
export const assignMaidToBooking = async (req: Request, res: Response): Promise<any> => {
  try {
    const { bookingId } = req.params;
    const { status, maid_id } = req.body;
    if (!maid_id) return res.status(400).json({ success: false, message: "Maid is Required" })
    // const exitMaid = await Maid.findById(maid_id)
    // if (!exitMaid) return res.status(404).json({ success: false, message: "Maid Not Found" })
    // if (exitMaid.working_status === false) return res.status(400).json({ success: false, message: "Maid not available" })
    const validStatuses = ['confirmed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const booking = await Booking.findById({ _id: bookingId, });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Generate a 4-digit PIN for the booking
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    // const booking_complete_date = new Date()
    const updateBooking = await Booking.findByIdAndUpdate(bookingId, { status, maid_id, pin }, { new: true });
    await sendNotificationToMaid(
      maid_id.toString(),
      "New Booking Assigned",
      `⚠️ ध्यान दें: नया काम असाइन किया गया है। MaidEazy ऐप खोलें और विवरण देखने के लिए रिफ्रेश दबाएँ।`,
      {
        type: "booking_assigned",
        bookingId: booking._id.toString(),
        userId: maid_id.toString()
      }
    );
    const maid = await User.findOne({ maidId: maid_id }); // or from existing data

    await sendNotificationToUser(
      booking.user_id.toString(),
      "Maid Assigned",
      `Your booking has been assigned to ${maid?.fullName || 'a maid'}. He will arrive on scheduled time.`,
      {
        type: "maid_assigned",
        bookingId: booking._id.toString(),
        userId: booking.user_id.toString()
      }
    );
    return res.json({ success: true, message: 'Booking status updated', updateBooking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error updating status' });
  }
};
export const updateAssignMaidToBooking = async (req: Request, res: Response): Promise<any> => {
  try {
    const { bookingId } = req.params;
    const { maid_id } = req.body;
    const status = "confirmed";
    if (!maid_id) return res.status(400).json({ success: false, message: "Maid is Required" })
    // const exitMaid = await Maid.findById(maid_id)
    // if (!exitMaid) return res.status(404).json({ success: false, message: "Maid Not Found" })
    // if (exitMaid.working_status === false) return res.status(400).json({ success: false, message: "Maid not available" })
    const validStatuses = ['confirmed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const booking = await Booking.findById({ _id: bookingId, });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Generate a 4-digit PIN for the booking
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    // const booking_complete_date = new Date()
    const updateBooking = await Booking.findByIdAndUpdate(bookingId, { status, maid_id, pin }, { new: true });
    await sendNotificationToMaid(
      maid_id.toString(),
      "New Booking Assigned",
      `⚠️ ध्यान दें: नया काम असाइन किया गया है। MaidEazy ऐप खोलें और विवरण देखने के लिए रिफ्रेश दबाएँ।`,
      {
        type: "booking_assigned",
        bookingId: booking._id.toString(),
        userId: maid_id.toString()
      }
    );
    const maid = await User.findOne({ maidId: maid_id }); // or from existing data

    await sendNotificationToUser(
      booking.user_id.toString(),
      "Maid Assigned",
      `Your booking has been assigned to ${maid?.fullName || 'a maid'}. He will arrive on scheduled time.`,
      {
        type: "maid_assigned",
        bookingId: booking._id.toString(),
        userId: booking.user_id.toString()
      }
    );
    return res.json({ success: true, message: 'Booking status updated', updateBooking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error updating status' });
  }
};
// update booking status pin
export const StartTimerByAdmin = async (req: Request, res: Response): Promise<any> => {
  try {
    const { bookingId } = req.params;
    const { pin } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }
    const booking = await Booking.findOne({ _id: bookingId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found or not assigned to this maid' });
    }
    // if (booking.pin !== String(pin)) {
    //   return res.status(400).json({ success: false, message: 'Invalid PIN' });
    // }
    if (booking.status === 'ongoing') {
      return res.status(400).json({ success: false, message: 'Booking Already have ongoing' });
    }
    const maidBooking = await Booking.findOne({ maid_id: booking.maid_id, status: 'ongoing' });
    if (maidBooking) {
      return res.status(400).json({ success: false, message: 'This Maid one booking already have ongoing' });
    }
    const maid = await Maid.findById(booking.maid_id)
    if (!maid) return res.status(404).json({ success: false, message: "Maid Not Found" })
    maid.is_booked = true
    await maid.save()
    const actualStartTime = new Date();
    const timerEndTime = new Date(actualStartTime.getTime() + (booking.duration_hours + booking.extend_time) * 60 * 60 * 1000);

    const bookings = await Booking.findByIdAndUpdate(bookingId, {
      actual_start_time: actualStartTime,
      timer_end_time: timerEndTime,
      status: 'ongoing',
      pinVerify: "Verified",
      // booking_complete_date: new Date()
    }, { new: true });
    if (!bookings) {
      return res.status(404).json({ message: "Booking not found" });
    }
    await bookings?.populate('user_id', 'fullName profile_image')
    await bookings?.populate('maid_id', 'name profile_image')
    // Start the real-time timer  starttime durationHours extend
    io.to(`booking:${booking._id}`).emit('booking:start', {
      bookingId: booking._id,
      booking: bookings
    });

    return res.json({ success: true, message: 'Timer started successfully', duration_hours: booking.duration_hours, timerEndTime });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error starting timer' });
  }
};


// Get Bookings New,OnGoing and Complete
const getBookingsByStatus = async (req: Request, res: Response, statusList: string[]) => {
  try {
    const userId = (req as any).user._id;

    const bookings = await Booking.find({
      user_id: userId,
      status: { $in: statusList }
    })
      .populate('maid_id')
      .populate('service_id')
      .sort({ booking_date: -1 });

    const now = moment().tz("Asia/Kolkata");

    const updatedBookings = bookings.map((booking: any) => {
      let isEditable = true;

      if (booking.start_time && booking.booking_date) {
        const bookingMoment = moment(booking.booking_date).tz("Asia/Kolkata");

        const time = booking.start_time.trim().toUpperCase();
        const [timePart, meridian] = [time.slice(0, -2), time.slice(-2)];
        let [hours, minutes] = timePart.split(":").map(Number);

        if (meridian === "PM" && hours !== 12) hours += 12;
        if (meridian === "AM" && hours === 12) hours = 0;

        bookingMoment.set({
          hour: hours,
          minute: minutes,
          second: 0,
          millisecond: 0,
        });
        const diffInMinutes = bookingMoment.diff(now, "minutes");
        if (diffInMinutes <= 30 || booking.status === 'ongoing' || booking.status === 'completed' || booking.status === 'cancelled' || booking.status === 'failed') {
          isEditable = false;
        }
      }

      return { ...booking.toObject(), isEditable, };
    });
    return res.status(200).json({ success: true, data: updatedBookings });

  } catch (error) {
    console.error("Error fetching bookings:", error);
    return res.status(500).json({ success: false, message: 'Server error fetching bookings' });
  }
};
export const getNewBookings = async (req: Request, res: Response) => {
  return getBookingsByStatus(req, res, ['pending', 'assigned', 'confirmed']);
};
export const getOngoingBookings = async (req: Request, res: Response) => {
  return getBookingsByStatus(req, res, ['ongoing']);
};
export const getCompletedBookings = async (req: Request, res: Response) => {
  return getBookingsByStatus(req, res, ['completed']);
};
export const getCancelledBookings = async (req: Request, res: Response) => {
  return getBookingsByStatus(req, res, ['cancelled']);
};


export const checkBookinguserSameSlots = async (req: Request, res: Response): Promise<any> => {
  try {
    console.log("check booking time slots")
    const { bookingDate, startTime } = req.body
    if (!bookingDate && !startTime) {
      res.status(400).json({ success: false, message: "Booking Date StartTime are required" });
      return;
    }
    const bookingDateObj = new Date(bookingDate);
    const startOfDay = new Date(bookingDateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(bookingDateObj);
    endOfDay.setHours(23, 59, 59, 999);
    const setting = await Setting.findOne();
    const limit = setting?.bookingPerSlot ?? 3;
    const bookingsCount = await Booking.countDocuments({
      booking_date: { $gte: startOfDay, $lte: endOfDay },
      start_time: startTime,
      status: { $in: ['pending', 'confirmed'] }
    });
    if (bookingsCount >= limit) {
      return res.status(200).json({
        success: false,
        message: "This time slot is fully booked. Please choose another time slot."
      });
    }
    return res.status(200).json({ success: true, message: 'Booking status updated' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error updating status' });
  }
};
export const checkBookingSlots = async (req: Request, res: Response): Promise<any> => {
  try {
    // console.log("checkk booking time slots")
    req.body.startTime = req.body.startTime.replace(" ", "");
    const userId = (req as any).user._id;
    const { bookingDate, startTime } = req.body
    if (!bookingDate && !startTime) {
      res.status(400).json({ success: false, message: "Booking Date StartTime are required" });
      return;
    }
    // console.log(req.body)
    const bookingDateObj = new Date(bookingDate);
    const startOfDay = new Date(bookingDateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(bookingDateObj);
    endOfDay.setHours(23, 59, 59, 999);
    const setting = await Setting.findOne();
    const limit = setting?.bookingPerSlot ?? 3;
    const userLimit = setting?.bookingPerUserSlot ?? 2;
    const bookingsCount = await Booking.countDocuments({
      booking_date: { $gte: startOfDay, $lte: endOfDay },
      start_time: startTime,
      status: { $in: ['pending', 'confirmed'] }
    });
    // console.log("limint"+ limit)
    // console.log("bookingCount"+ bookingsCount)
    if (bookingsCount >= limit) {
      return res.status(200).json({
        success: false,
        message: "This time slot is fully booked. Please choose another time slot."
      });
    }
    const bookingsUserDayCount = await Booking.countDocuments({
      user_id: userId,
      start_time: startTime,
      booking_date: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      status: { $nin: ["cancelled", "failed"] }
    });

    if (bookingsUserDayCount >= userLimit) {
      return res.status(200).json({
        success: false,
        message: "Same Date and Time Slot booking already exists. Please select another time slot."
      });
    }
    return res.status(200).json({ success: true, message: 'Booking status updated' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error updating status' });
  }
};
export const createBooking = async (req: Request, res: Response): Promise<any> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const appversion = await appVersion.findOne();
    console.log(req.body)
    const { serviceId, addressId, bookingDate, bookingType, bookingDates, type, startTime, endTime, payment_details, isFreeBooking, isWallet, isCOD, walletAmount } = req.body;
    const userId = (req as any).user._id;

    const user = await User.findById(userId).select("freeOffer offerBookingCount wallet_balance addresses bookingCount isBlock isActive appVersionCode");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found", });
    }
    // check if user is blocked
    if (user.isBlock) {
      return res.status(400).json({ success: false, message: "Your account is blocked. Please contact support.", });
    }
    if (!user.isActive) {
      return res.status(400).json({ success: false, message: "Your account is deactive or deleted.", });
    }
    if (
      (user.deviceType === 'android' && appversion?.androidVersionCode && user.appVersionCode < appversion.androidVersionCode) ||
      (user.deviceType === 'ios' && appversion?.iosVersionCode && user.appVersionCode < appversion.iosVersionCode)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please update your app to the latest version to continue booking."
      });
    }
    const normalizeTime = (time: string): string => {
      return time.replace(/\s+/g, '').toUpperCase();
    };
    // --------------------------------------------
    // console.log("booking date"+ bookingDate)
    if (startTime === "08:00PM") {
      return res.status(400).json({
        success: false,
        message: "This time slot is fully booked. Please choose another time slot."
      });
    }
    // -----------------------------------------------------
    const bookingTime: string = req.body.startTime.replace(/\s/g, "");
    const timeSlotDocs = await TimeSlot.find({ isActive: true });
    if (!timeSlotDocs.length) {
      return res.status(404).json({ success: false, message: "No active TimeSlot configuration found" });
    }
    // Search in all periods (Morning, Afternoon, Evening)
    let matchedSlot: { timeSlot: string; isActive: boolean } | undefined;

    for (const doc of timeSlotDocs) {
      matchedSlot = doc.time.find(slot =>
        normalizeTime(slot.timeSlot) === normalizeTime(bookingTime)
      );
      if (matchedSlot) break;
    }
    if (!matchedSlot) {
      return res.status(404).json({ success: false, message: "Time slot not found in database" });
    }
    if (!matchedSlot.isActive) {
      return res.status(400).json({ success: false, message: "This time slot is not available for booking" });
    }
    //  ------------Check Time Slot--------------------------------
    const bookingDateObj = new Date(bookingDate);
    const startOfDay = new Date(bookingDateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(bookingDateObj);
    endOfDay.setHours(23, 59, 59, 999);
    const setting = await Setting.findOne();
    const limit = setting?.bookingPerSlot ?? 3;
    const bookingsCount = await Booking.countDocuments({
      booking_date: { $gte: startOfDay, $lte: endOfDay },
      start_time: startTime,
      status: { $in: ['pending', 'confirm'] }
    });
    if (bookingsCount >= limit) {
      return res.status(400).json({
        success: false,
        message: "This time slot is fully booked. Please choose another time slot."
      });
    }
    // .------------------------------------------------------------
    // Fetch user and service
    // const user = await User.findById(userId).select("freeOffer offerBookingCount wallet_balance addresses bookingCount");
    // if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Get correct addressId (priority: body → user's first)
    const selectedAddressId = addressId ?? (user.addresses?.[0]?._id?.toString() ?? null);
    if (!selectedAddressId) {
      return res.status(400).json({ success: false, message: "No address found for user" });
    }
    // Find address object from user's address array
    const selectedAddress = user.addresses.find((addr: any) => addr._id.toString() === selectedAddressId);

    if (!selectedAddress) {
      return res.status(404).json({ success: false, message: "Address not found in user" });
    }
    if (selectedAddress.serviceAvailable === false) {
      return res.status(400).json({ success: false, message: `Service is not available at the selected address`, });
    }
    const address = {
      type: selectedAddress.type || undefined,
      house: selectedAddress.house || undefined,
      street: selectedAddress.street || undefined,
      wing_plot: selectedAddress.wing_plot || undefined,
      city: selectedAddress.city || undefined,
      state: selectedAddress.state || undefined,
      pincode: selectedAddress.pincode || undefined,
      flat: selectedAddress.flat || undefined,
      building: selectedAddress.building || undefined,
      latitude: selectedAddress.latitude || undefined,
      longitude: selectedAddress.longitude || undefined,
    };
    const service = await Service.findById(serviceId).select("duration");
    if (!service) return res.status(400).json({ success: false, message: "Invalid service" });

    // Validate payment details from frontend
    if (!payment_details || !payment_details.total_amount) {
      return res.status(400).json({ success: false, message: "Payment details are required" });
    }

    // Generate booking reference
    const bookings = await Booking.find().sort({ createdAt: -1 });
    let newRef: string;
    if (bookings.length === 0) {
      newRef = getNextBookingReference();
    } else {
      const lastBooking = bookings[0]!;
      newRef = getNextBookingReference(lastBooking.booking_reference);
    }
    const sec = Number(service.duration ?? 0) * 3600;
    // Create booking document
    const booking = await Booking.create({
      user_id: userId,
      service_id: serviceId,
      address_id: address,
      type: type,
      booking_date: bookingDate || undefined,
      booking_dates: bookingDates || undefined,
      start_time: startTime.replace(/\s/g, ""),
      end_time: endTime,
      duration_hours: sec,
      payment_details: payment_details,
      total_amount: Number(payment_details.total_amount) + Number(payment_details.wallet_amount),
      payble_amount: Number(payment_details.total_amount),
      status: "failed",
      booking_reference: newRef,
      isFreeBooking: isFreeBooking,
      bookingType: bookingType
    });

    // ✅ Update booking count and save user
    if (isFreeBooking) {
      user.offerBookingCount = (user.offerBookingCount ?? 0) + 1;
      user.freeOffer.freeBookings = (user.freeOffer.freeBookings ?? 0) + 1
      user.freeOffer.lastBooking = new Date()
      booking.payment_status = "success";
      booking.paymentType = "Online";
      booking.remark = "New User Offer";
      booking.status = 'pending';
      // Send notification to admins
      await sendNotificationToAdmins(
        'New Booking Created',
        `A new booking has been created with BookingId ${newRef}`,
        {
          type: "new_booking",
          bookingId: booking._id.toString(),
          userId: userId.toString()
        });
      await sendNotificationToUser(
        userId.toString(),
        'New Booking Created',
        `A new booking has been created with BookingId ${newRef}`,
        {
          type: "new_booking",
          bookingId: booking._id.toString(),
          userId: userId.toString()
        });
    }
    user.bookingCount = (user.bookingCount ?? 0) + 1;
    if (isWallet && payment_details.total_amount == 0) {
      user.wallet_balance = (user.wallet_balance ?? 0) - Number(payment_details.wallet_amount) || walletAmount
      // req.body.payment_method = 'wallet';
      // req.body.amount = Number(payment_details.total_amount) + Number(payment_details.wallet_amount) || walletAmount
      // req.body.booking_id = booking._id;
      // req.body.payment_status = "success";
      // req.body.payment_gateway = 'wallet';
      // req.body.transaction_id = 'pay_' + new Date().getTime();
      // req.body.user_id = userId;
      booking.payment_status = "success";
      booking.paymentType = "Online";
      booking.paymentDate = new Date();
      booking.status = 'pending';
      // await Payment.create(req.body);
      await sendNotificationToAdmins(
        'New Booking Created',
        `A new booking has been created with BookingId ${newRef}`,
        {
          type: "new_booking",
          bookingId: booking._id.toString(),
          userId: userId.toString()
        });
      await sendNotificationToUser(
        userId.toString(),
        'New Booking Created',
        `A new booking has been created with BookingId ${newRef}`,
        {
          type: "new_booking",
          bookingId: booking._id.toString(),
          userId: userId.toString()
        });
    }
    if (isCOD) {
      // req.body.payment_method = 'cod';
      // req.body.amount = Number(payment_details.total_amount) + Number(payment_details.wallet_amount) || walletAmount
      // req.body.booking_id = booking._id;
      // req.body.payment_status = "unpaid";
      // req.body.payment_gateway = 'cod';
      // req.body.transaction_id = 'pay_' + new Date().getTime();
      // req.body.user_id = userId;
      booking.payment_status = "unpaid";
      booking.paymentType = "cod";
      booking.paymentDate = new Date();
      booking.status = 'pending';
      // await Payment.create(req.body);
      await sendNotificationToAdmins(
        'New Booking Created',
        `A new booking has been created with BookingId ${newRef}`,
        {
          type: "new_booking",
          bookingId: booking._id.toString(),
          userId: userId.toString()
        });
      await sendNotificationToUser(
        userId.toString(),
        'New Booking Created',
        `A new booking has been created with BookingId ${newRef}`,
        {
          type: "new_booking",
          bookingId: booking._id.toString(),
          userId: userId.toString()
        });
    }
    await booking.save();
    await user.save();
    if (!isFreeBooking && (!isWallet && payment_details.total_amount != 0)) {

      console.log("callinggggggggg")
      // const userId = (req as any).user._id;
      // const { total_amount } = req.body;
      const options = {
        amount: booking.payble_amount * 100, // assuming amount in rupees
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      };
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID!,
        key_secret: process.env.RAZORPAY_SECRET!,
      });
      const order = await razorpay.orders.create(options);
      await Payment.create({
        user_id: userId,
        booking_id: booking._id,
        isBooking: 'booking',
        amount: booking.payble_amount,
        order_id: order.id,
        // transaction_id: order.receipt,
        transaction_id: 'pay_' + new Date().getTime(),
        payment_gateway: "razorpay",
        payment_status: "pending",
        type: 'Single',
        payment_order: order
      });
    }
    return res.status(201).json({ success: true, message: "Booking created successfully", booking, });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error creating booking" });
  }
};

// Admin Create Booking
export const createBookingAdmin = async (req: Request, res: Response): Promise<any> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    console.log(req.body)
    req.body.bookingType = 'new'
    req.body.type = 'single'
    const { userId, serviceId, addressId, bookingDate, bookingType, bookingDates, type, startTime, endTime, payment_details, isFreeBooking, isWallet, isCOD, walletAmount } = req.body;
    // const userId = (req as any).user._id;

    const normalizeTime = (time: string): string => {
      return time.replace(/\s+/g, '').toUpperCase();
    };
    // --------------------------------------------
    // console.log("booking date"+ bookingDate)
    // if (bookingDate === "2026-03-03") {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Services are not available on 3 March due to the Holi festival. Please choose another date."
    //   });
    // }
    // -----------------------------------------------------
    const bookingTime: string = req.body.startTime.replace(/\s/g, "");
    const timeSlotDocs = await TimeSlot.find({ isActive: true });
    if (!timeSlotDocs.length) {
      return res.status(404).json({ success: false, message: "No active TimeSlot configuration found" });
    }
    // Search in all periods (Morning, Afternoon, Evening)
    let matchedSlot: { timeSlot: string; isActive: boolean } | undefined;

    for (const doc of timeSlotDocs) {
      matchedSlot = doc.time.find(slot =>
        normalizeTime(slot.timeSlot) === normalizeTime(bookingTime)
      );
      if (matchedSlot) break;
    }
    if (!matchedSlot) {
      return res.status(404).json({ success: false, message: "Time slot not found in database" });
    }
    if (!matchedSlot.isActive) {
      return res.status(400).json({ success: false, message: "This time slot is not available for booking" });
    }
    //  ------------Check Time Slot--------------------------------
    const bookingDateObj = new Date(bookingDate);
    const startOfDay = new Date(bookingDateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(bookingDateObj);
    endOfDay.setHours(23, 59, 59, 999);
    const setting = await Setting.findOne();
    const limit = setting?.bookingPerSlot ?? 3;
    const bookingsCount = await Booking.countDocuments({
      booking_date: { $gte: startOfDay, $lte: endOfDay },
      start_time: startTime,
      status: { $in: ['pending', 'confirm'] }
    });
    if (bookingsCount >= limit) {
      return res.status(400).json({ success: false, message: "This time slot is fully booked. Please choose another time slot." });
    }
    // .------------------------------------------------------------
    // Fetch user and service
    const user = await User.findById(userId).select("freeOffer offerBookingCount wallet_balance addresses bookingCount");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Get correct addressId (priority: body → user's first)
    const selectedAddressId = addressId ?? (user.addresses?.[0]?._id?.toString() ?? null);
    if (!selectedAddressId) {
      return res.status(400).json({ success: false, message: "No address found for user" });
    }
    // Find address object from user's address array
    const selectedAddress = user.addresses.find((addr: any) => addr._id.toString() === selectedAddressId);

    if (!selectedAddress) {
      return res.status(404).json({ success: false, message: "Address not found in user" });
    }
    const address = {
      type: selectedAddress.type || undefined,
      house: selectedAddress.house || undefined,
      street: selectedAddress.street || undefined,
      wing_plot: selectedAddress.wing_plot || undefined,
      city: selectedAddress.city || undefined,
      state: selectedAddress.state || undefined,
      pincode: selectedAddress.pincode || undefined,
      flat: selectedAddress.flat || undefined,
      building: selectedAddress.building || undefined,
      latitude: selectedAddress.latitude || undefined,
      longitude: selectedAddress.longitude || undefined,
    };
    const service = await Service.findById(serviceId).select("duration");
    if (!service) return res.status(400).json({ success: false, message: "Invalid service" });

    // Validate payment details from frontend
    if (!payment_details || !payment_details.total_amount) {
      return res.status(400).json({ success: false, message: "Payment details are required" });
    }

    // Generate booking reference
    const bookings = await Booking.find().sort({ createdAt: -1 });
    let newRef: string;
    if (bookings.length === 0) {
      newRef = getNextBookingReference();
    } else {
      const lastBooking = bookings[0]!;
      newRef = getNextBookingReference(lastBooking.booking_reference);
    }
    const sec = Number(service.duration ?? 0) * 3600;
    // Create booking document
    const booking = await Booking.create({
      user_id: userId,
      service_id: serviceId,
      address_id: address,
      type: type,
      booking_date: bookingDate || undefined,
      booking_dates: bookingDates || undefined,
      start_time: startTime.replace(/\s/g, ""),
      end_time: endTime,
      duration_hours: sec,
      payment_details: payment_details,
      total_amount: Number(payment_details.total_amount) + Number(payment_details.wallet_amount),
      payble_amount: Number(payment_details.total_amount),
      status: "pending",
      payment_status: "success",
      booking_reference: newRef,
      isFreeBooking: isFreeBooking,
      bookingType: bookingType
    });

    // ✅ Update booking count and save user
    if (isFreeBooking) {
      user.offerBookingCount = (user.offerBookingCount ?? 0) + 1;
      user.freeOffer.freeBookings = (user.freeOffer.freeBookings ?? 0) + 1
      user.freeOffer.lastBooking = new Date()
      booking.payment_status = "success";
      booking.paymentType = "Online";
      booking.remark = "New User Offer";
      booking.status = 'pending';
      // Send notification to admins
      await sendNotificationToAdmins(
        'New Booking Created',
        `A new booking has been created with BookingId ${newRef}`,
        {
          type: "new_booking",
          bookingId: booking._id.toString(),
          userId: userId.toString()
        });
      await sendNotificationToUser(
        userId.toString(),
        'New Booking Created',
        `A new booking has been created with BookingId ${newRef}`,
        {
          type: "new_booking",
          bookingId: booking._id.toString(),
          userId: userId.toString()
        });
    }
    user.bookingCount = (user.bookingCount ?? 0) + 1;
    if (isWallet && payment_details.total_amount == 0) {
      user.wallet_balance = (user.wallet_balance ?? 0) - Number(payment_details.wallet_amount) || walletAmount
      req.body.payment_method = 'wallet';
      req.body.amount = Number(payment_details.total_amount) + Number(payment_details.wallet_amount) || walletAmount
      req.body.booking_id = booking._id;
      req.body.payment_status = "success";
      req.body.payment_gateway = 'wallet';
      req.body.transaction_id = 'pay_' + new Date().getTime();
      req.body.user_id = userId;
      booking.payment_status = "success";
      booking.paymentType = "Online";
      booking.paymentDate = new Date();
      booking.status = 'pending';
      await Payment.create(req.body);
      await sendNotificationToAdmins(
        'New Booking Created',
        `A new booking has been created with BookingId ${newRef}`,
        {
          type: "new_booking",
          bookingId: booking._id.toString(),
          userId: userId.toString()
        });
      await sendNotificationToUser(
        userId.toString(),
        'New Booking Created',
        `A new booking has been created with BookingId ${newRef}`,
        {
          type: "new_booking",
          bookingId: booking._id.toString(),
          userId: userId.toString()
        });
    }
    if (isCOD) {
      req.body.payment_method = 'cod';
      req.body.amount = Number(payment_details.total_amount) + Number(payment_details.wallet_amount) || walletAmount
      req.body.booking_id = booking._id;
      req.body.payment_status = "unpaid";
      req.body.payment_gateway = 'cod';
      req.body.transaction_id = 'pay_' + new Date().getTime();
      req.body.user_id = userId;
      booking.payment_status = "unpaid";
      booking.paymentType = "cod";
      booking.paymentDate = new Date();
      booking.status = 'pending';
      await Payment.create(req.body);
      await sendNotificationToAdmins(
        'New Booking Created',
        `A new booking has been created with BookingId ${newRef}`,
        {
          type: "new_booking",
          bookingId: booking._id.toString(),
          userId: userId.toString()
        });
      await sendNotificationToUser(
        userId.toString(),
        'New Booking Created',
        `A new booking has been created with BookingId ${newRef}`,
        {
          type: "new_booking",
          bookingId: booking._id.toString(),
          userId: userId.toString()
        });
    }
    await booking.save();
    await user.save();
    return res.status(201).json({ success: true, message: "Booking created successfully", booking, });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error creating booking" });
  }
};
export const updateBookingAdmin = async (req: Request, res: Response): Promise<any> => {
  try {
    const { bookingId } = req.params;
    const { userId, status, serviceId, addressId, bookingDate, startTime, endTime, payment_details, isFreeBooking, isWallet, isCOD, walletAmount } = req.body;

    // 🔍 Find booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // 🔥 Normalize time
    const normalizeTime = (time: string) => time.replace(/\s+/g, '').toUpperCase();

    // ✅ Time slot validation
    if (startTime) {
      const bookingTime = startTime.replace(/\s/g, "");
      const timeSlotDocs = await TimeSlot.find({ isActive: true });

      let matchedSlot;
      for (const doc of timeSlotDocs) {
        matchedSlot = doc.time.find(slot =>
          normalizeTime(slot.timeSlot) === normalizeTime(bookingTime)
        );
        if (matchedSlot) break;
      }

      if (!matchedSlot) {
        return res.status(400).json({ success: false, message: "Invalid time slot" });
      }

      if (!matchedSlot.isActive) {
        return res.status(400).json({ success: false, message: "Time slot not available" });
      }

      // 🔥 Booking limit check
      const bookingDateObj = new Date(bookingDate || booking.booking_date);
      const startOfDay = new Date(bookingDateObj.setHours(0, 0, 0, 0));
      const endOfDay = new Date(bookingDateObj.setHours(23, 59, 59, 999));

      const setting = await Setting.findOne();
      const limit = setting?.bookingPerSlot ?? 3;

      const count = await Booking.countDocuments({
        _id: { $ne: bookingId }, // exclude current booking
        booking_date: { $gte: startOfDay, $lte: endOfDay },
        start_time: startTime,
        status: { $in: ['pending', 'confirm'] }
      });

      if (count >= limit) {
        return res.status(400).json({
          success: false,
          message: "This slot is already full"
        });
      }
    }

    // ✅ User check
    const user = await User.findById(userId || booking.user_id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // ✅ Address update
    let address = booking.address_id;
    if (addressId) {
      const selectedAddress = user.addresses.find(
        (addr: any) => addr._id.toString() === addressId
      );

      if (!selectedAddress) {
        return res.status(404).json({ success: false, message: "Address not found" });
      }
      address = {
        type: selectedAddress.type || '',
        house: selectedAddress.house || '',
        street: selectedAddress.street || '',
        wing_plot: selectedAddress.wing_plot || '',
        city: selectedAddress.city || '',
        state: selectedAddress.state || '',
        pincode: selectedAddress.pincode || '',
        flat: selectedAddress.flat || '',
        building: selectedAddress.building || '',
      };
    }

    // ✅ Service duration update
    let duration = booking.duration_hours;
    if (serviceId) {
      const service = await Service.findById(serviceId);
      if (!service) {
        return res.status(400).json({ success: false, message: "Invalid service" });
      }
      duration = Number(service.duration ?? 0) * 3600;
    }

    // ✅ Update fields
    booking.user_id = userId || booking.user_id;
    booking.service_id = serviceId || booking.service_id;
    booking.status = status || booking.status;
    booking.address_id = address;
    booking.booking_date = bookingDate || booking.booking_date;
    booking.start_time = startTime ? startTime.replace(/\s/g, "") : booking.start_time;
    booking.end_time = endTime || booking.end_time;
    booking.duration_hours = duration;

    // ✅ Payment update (optional)
    if (payment_details) {
      booking.payment_details = payment_details;
      booking.total_amount =
        Number(payment_details.total_amount) + Number(payment_details.wallet_amount || 0);
      booking.payble_amount = Number(payment_details.total_amount);
    }

    // ✅ Save booking
    await booking.save();

    return res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      booking
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error updating booking"
    });
  }
};

export function calculateEndTime(startTime: string, hoursStr: string): string {
  const hours: number = parseFloat(hoursStr);
  if (isNaN(hours)) {
    throw new Error("Invalid duration format");
  }

  const time: string = startTime.slice(0, -2);
  const modifier: string = startTime.slice(-2).toUpperCase(); // AM or PM

  const parts = time.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid start time format");
  }

  let hour: number = Number(parts[0]);
  let minute: number = Number(parts[1]);

  if (isNaN(hour) || isNaN(minute)) {
    throw new Error("Invalid start time values");
  }

  // Convert to 24-hour format
  if (modifier === "PM" && hour !== 12) hour += 12;
  if (modifier === "AM" && hour === 12) hour = 0;

  let totalMinutes: number = hour * 60 + minute;
  totalMinutes += hours * 60;

  let endHour: number = Math.floor(totalMinutes / 60) % 24;
  let endMinute: number = totalMinutes % 60;

  const endModifier: string = endHour >= 12 ? "PM" : "AM";
  endHour = endHour % 12 || 12;

  const formattedHour = endHour.toString().padStart(2, "0");
  const formattedMinute = endMinute.toString().padStart(2, "0");

  return `${formattedHour}:${formattedMinute}${endModifier}`;
}

// Reschedule Booking by User
export const updateBooking = async (req: Request, res: Response): Promise<any> => {
  try {
    const { bookingId } = req.params;
    const { serviceId, addressId, bookingDate, bookingDates, startTime, endTime, status, payment_status, payment_details } = req.body;

    const userId = (req as any).user._id;

    // Find booking
    const booking = await Booking.findOne({ _id: bookingId, user_id: userId }).populate('service_id')
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const service = booking.service_id as any;
    if (startTime && service?.duration) {
      const endTime = calculateEndTime(startTime, service.duration);
      // console.log("calculated endTime:", endTime);
      booking.end_time = endTime;
    }

    // Normal field updates
    if (bookingDate) booking.booking_date = bookingDate;
    if (bookingDates) booking.booking_dates = bookingDates;
    if (startTime) booking.start_time = startTime;
    if (endTime) booking.end_time = endTime;

    await booking.save();
    // ADMIN NOTIFICATION
    await sendNotificationToAdmins(
      "Booking Rescheduled",
      `Booking ${booking.booking_reference} rescheduled.`,
      {
        type: "booking_user_rescheduled",
        bookingId: booking._id.toString(),
        userId: booking.user_id.toString(),
      }
    );

    // USER NOTIFICATION
    await sendNotificationToUser(
      booking.user_id.toString(),
      "Booking Rescheduled",
      `Booking ${booking.booking_reference} rescheduled.`,
      {
        type: "booking_user_rescheduled",
        bookingId: booking._id.toString(),
      }
    );

    return res.status(200).json({ success: true, message: "Booking updated successfully", booking });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error while updating booking" });
  }
};
// Reschedule Booking By Admin
export const updateBookingByAdmin = async (req: Request, res: Response): Promise<any> => {
  try {
    const { bookingId } = req.params;
    const { bookingDate, bookingDates, startTime, endTime, status } = req.body;
    // Find booking
    const booking = await Booking.findOne({ _id: bookingId }).populate('service_id')
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    const service = booking.service_id as any;
    if (startTime && service?.duration) {
      const endTime = calculateEndTime(startTime, service.duration);
      // console.log("calculated endTime:", endTime);
      booking.end_time = endTime;
    }

    // Normal field updates
    if (bookingDate) booking.booking_date = bookingDate;
    if (status) booking.status = status;
    if (bookingDates) booking.booking_dates = bookingDates;
    if (startTime) booking.start_time = startTime;
    if (endTime) booking.end_time = endTime;

    await booking.save();
    return res.status(200).json({ success: true, message: "Booking updated successfully", booking });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error while updating booking" });
  }
};

// after notification implement
export const assignMaidToBooking1 = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const { maid_id } = req.body;

    if (!maid_id) {
      return res.status(400).json({ success: false, message: "Maid is required" });
    }
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    // 🔔 Notify Maid ONLY
    await sendNotification({
      receiverRole: "maid",
      receiverId: maid_id,
      title: "New Booking Assigned",
      body: `You have a new booking request (${booking.booking_reference})`,
      data: {
        type: "new_booking",
        bookingId: booking._id.toString(),
        userId: booking.user_id.toString(),
        maidId: maid_id,
      },
    });
    return res.json({ success: true, message: "Booking sent to maid for acceptance", booking, });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const maidAcceptBooking = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const maidId = (req as any).user.maidId;

    const booking = await Booking.findOne({ _id: bookingId, status: "pending", });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    booking.status = "confirmed";
    await booking.save();

    // 🔔 Notify Admin
    await sendNotificationBookingToAdmin(
      "Booking Accepted",
      `Maid accepted booking ${booking.booking_reference}`,
      {
        type: "booking_accepted",
        bookingId: booking._id.toString(),
        maidId: maidId.toString(),
      });
    // await sendNotification({
    //   receiverRole: "user",
    //   receiverId: booking.user_id.toString(),
    //   title: "Booking Confirmed",
    //   body: "Your booking has been confirmed by the maid",
    //   data: {
    //     type: "booking_confirmed",
    //     bookingId: booking._id.toString(),
    //     maidId: maidId.toString(),
    //   },
    // });
    return res.json({ success: true, message: "Booking accepted successfully" });

  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const maidRejectBooking = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const maidId = (req as any).user.maidId;

    const booking = await Booking.findOne({ _id: bookingId, status: "pending", });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    booking.status = "pending";
    await booking.save();
    //Admin ONLY
    await sendNotificationBookingToAdmin(
      "Booking Rejected",
      `Maid rejected booking ${booking.booking_reference}`,
      {
        type: "booking_rejected",
        bookingId: booking._id.toString(),
        maidId: maidId.toString(),
      });
    return res.json({ success: true, message: "Booking rejected successfully" });

  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// For Ring Stop
export const stopRingByUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const { bookingId } = req.params;
    const userId = (req as any).user._id;
    const isUserRing = false;
    const booking = await Booking.findOne({ _id: bookingId, user_id: userId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    await Booking.findByIdAndUpdate(bookingId, { isUserRing });
    return res.status(200).json({ success: true, message: 'Booking status updated' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error updating status' });
  }
};
export const stopRingByMaid = async (req: Request, res: Response): Promise<any> => {
  try {
    const { bookingId } = req.params;
    const maidId = (req as any).user.maidId;
    const isMaidRing = false;
    const booking = await Booking.findOne({ _id: bookingId, maid_id: maidId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    await Booking.findByIdAndUpdate(bookingId, { isMaidRing });
    return res.status(200).json({ success: true, message: 'Booking status updated' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error updating status' });
  }
};

// automatically cancelled the booking start time + after 2 hours
export const autoCancelPendingBookings = () => {
  // Run every 10 minutes (IST-safe logic)
  cron.schedule("*/10 * * * *", async () => {
    try {
      const nowIST = moment.tz("Asia/Kolkata");
      const pendingBookings = await Booking.find({ status: "pending", });
      for (const booking of pendingBookings) {
        if (!booking.booking_date || !booking.start_time) continue;

        const bookingStartIST = moment.tz(booking.booking_date, "Asia/Kolkata").clone();

        const time = booking.start_time.trim().toUpperCase();
        const timePart = time.slice(0, -2);
        const meridian = time.slice(-2);

        const [hoursStr, minutesStr] = timePart.split(":");

        let hours = Number(hoursStr);
        let minutes = Number(minutesStr);
        if (meridian === "PM" && hours !== 12) hours += 12;
        if (meridian === "AM" && hours === 12) hours = 0;

        bookingStartIST.set({
          hour: hours,
          minute: minutes,
          second: 0,
          millisecond: 0,
        });

        const cancelTimeIST = bookingStartIST.clone().add(2, "hours");

        if (nowIST.isAfter(cancelTimeIST)) {
          const user = await User.findById(booking.user_id);

          if (user) {
            user.wallet_balance = (user.wallet_balance ?? 0) + Number(booking.payment_details?.total_amount ?? 0);
            await user.save();
          }
          booking.status = "cancelled";
          booking.payment_status = "refunded";
          booking.cancelled_at = nowIST.toDate();
          // console.log(booking.booking_reference)
          await booking.save();

          // ADMIN NOTIFICATION
          await sendNotificationToAdmins(
            "Booking Auto Cancelled",
            `Booking ${booking.booking_reference} was auto cancelled due to no confirmation after 2 hours.`,
            {
              type: "booking_auto_cancelled",
              bookingId: booking._id.toString(),
              userId: booking.user_id.toString(),
            }
          );

          // USER NOTIFICATION
          await sendNotificationToUser(
            booking.user_id.toString(),
            "Booking Cancelled",
            `Your booking ${booking.booking_reference} was cancelled because the service did not start within the allowed time. The amount has been refunded to your wallet.`,
            {
              type: "booking_auto_cancelled",
              bookingId: booking._id.toString(),
            }
          );
        }
      }
      // console.log("[CRON] Auto-cancel pending bookings executed (IST)");
    } catch (err) {
      console.error("[CRON] Auto-cancel error:", err);
    }
  });
};

// update the user address if building available in building collection
export const updateUserAddressWithBuilding = () => {
  cron.schedule("*/10 * * * *", async () => {
    try {
      console.log("[CRON] Checking service availability...");

      // 1. Get users who have serviceAvailable = false
      const users = await User.find({
        addresses: { $elemMatch: { serviceAvailable: false } }
      });

      for (const user of users) {
        let isUserUpdated = false;
        for (const address of user.addresses) {
          if (!address.serviceAvailable && address.building) {
            const buildingExists = await Building.findOne({
              name: address.building
            });
            if (buildingExists) {
              address.serviceAvailable = true;
              isUserUpdated = true;
            } else {
              address.serviceAvailable = false;
            }
          }
        }
        if (isUserUpdated) {
          await user.save();
        }
      }
      // console.log("[CRON] Service availability check completed.");
    } catch (err) {
      console.error("[CRON] Auto-cancel error:", err);
    }
  });
}

export const updateBookingPaymentStatus1 = () => {

  // run every 1 minute
  cron.schedule("*/1 * * * *", async () => {
    try {
      console.log("=== Booking Reconciliation Cron Started ===", new Date());

      // 1️⃣ Get today's date range
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      // 2️⃣ Get LAST successful payment per user (ONLY TODAY)
      const usersWithLastPayment = await Payment.aggregate([
        {
          $match: {
            payment_status: "success",
            createdAt: {
              $gte: startOfToday,
              $lte: endOfToday
            }
          }
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$userId",
            lastPaymentDate: { $first: "$createdAt" }
          }
        }
      ]);

      console.log(
        `Users with today's successful payment: ${usersWithLastPayment.length}`
      );

      // 3️⃣ Confirm latest pending booking for that user
      for (const user of usersWithLastPayment) {
        const booking = await Booking.findOne({
          userId: user._id,
          status: "failed"
        }).sort({ createdAt: -1 });

        if (booking) {
          booking.status = "pending";
          await booking.save();

          console.log(
            `✅ Booking confirmed | bookingId=${booking._id} | userId=${user._id}`
          );
        }
      }

      console.log("=== Booking Reconciliation Cron Completed ===\n");

    } catch (error) {
      console.error("❌ Booking Cron Error:", error);
    }
  });
};



export const createBooking1 = async (req: Request, res: Response): Promise<any> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    console.log(req.body)
    const { userId, serviceId, addressId, bookingDate, bookingType, bookingDates, type, startTime, endTime, payment_details, isFreeBooking } = req.body;
    // const userId = (req as any).user._id;

    const normalizeTime = (time: string): string => {
      return time.replace(/\s+/g, '').toUpperCase();
    };
    // --------------------------------------------
    // console.log("booking date"+ bookingDate)
    if (bookingDate === "2026-03-03") {
      return res.status(400).json({
        success: false,
        message: "Services are not available on 3 March due to the Holi festival. Please choose another date."
      });
    }
    // -----------------------------------------------------
    const bookingTime: string = req.body.startTime;
    const timeSlotDocs = await TimeSlot.find({ isActive: true });
    if (!timeSlotDocs.length) {
      return res.status(404).json({ success: false, message: "No active TimeSlot configuration found" });
    }
    // Search in all periods (Morning, Afternoon, Evening)
    let matchedSlot: { timeSlot: string; isActive: boolean } | undefined;

    for (const doc of timeSlotDocs) {
      matchedSlot = doc.time.find(slot =>
        normalizeTime(slot.timeSlot) === normalizeTime(bookingTime)
      );
      if (matchedSlot) break;
    }
    if (!matchedSlot) {
      return res.status(404).json({ success: false, message: "Time slot not found in database" });
    }
    if (!matchedSlot.isActive) {
      return res.status(400).json({ success: false, message: "This time slot is not available for booking" });
    }
    //  ------------Check Time Slot--------------------------------
    const bookingDateObj = new Date(bookingDate);
    const startOfDay = new Date(bookingDateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(bookingDateObj);
    endOfDay.setHours(23, 59, 59, 999);
    const setting = await Setting.findOne();
    const limit = setting?.bookingPerSlot ?? 3;
    const bookingsCount = await Booking.countDocuments({
      booking_date: { $gte: startOfDay, $lte: endOfDay },
      start_time: startTime,
      status: { $in: ['pending', 'confirm'] }
    });
    if (bookingsCount >= limit) {
      return res.status(400).json({
        success: false,
        message: "This time slot is fully booked. Please choose another time slot."
      });
    }
    // .------------------------------------------------------------
    // Fetch user and service
    const user = await User.findById(userId).select("freeOffer offerBookingCount wallet_balance addresses bookingCount");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Get correct addressId (priority: body → user's first)
    const selectedAddressId = addressId ?? (user.addresses?.[0]?._id?.toString() ?? null);
    if (!selectedAddressId) {
      return res.status(400).json({ success: false, message: "No address found for user" });
    }
    // Find address object from user's address array
    const selectedAddress = user.addresses.find((addr: any) => addr._id.toString() === selectedAddressId);

    if (!selectedAddress) {
      return res.status(404).json({ success: false, message: "Address not found in user" });
    }
    const address = {
      type: selectedAddress.type || undefined,
      house: selectedAddress.house || undefined,
      street: selectedAddress.street || undefined,
      wing_plot: selectedAddress.wing_plot || undefined,
      city: selectedAddress.city || undefined,
      state: selectedAddress.state || undefined,
      pincode: selectedAddress.pincode || undefined,
      flat: selectedAddress.flat || undefined,
      building: selectedAddress.building || undefined,
      latitude: selectedAddress.latitude || undefined,
      longitude: selectedAddress.longitude || undefined,
    };
    const service = await Service.findById(serviceId).select("duration");
    if (!service) return res.status(400).json({ success: false, message: "Invalid service" });

    // Validate payment details from frontend
    if (!payment_details || !payment_details.total_amount) {
      return res.status(400).json({ success: false, message: "Payment details are required" });
    }

    // Generate booking reference
    const bookings = await Booking.find().sort({ createdAt: -1 });
    let newRef: string;
    if (bookings.length === 0) {
      newRef = getNextBookingReference();
    } else {
      const lastBooking = bookings[0]!;
      newRef = getNextBookingReference(lastBooking.booking_reference);
    }
    const sec = Number(service.duration ?? 0) * 3600;
    // Create booking document
    const booking = await Booking.create({
      user_id: userId,
      service_id: serviceId,
      address_id: address,
      type: type,
      booking_date: bookingDate || undefined,
      booking_dates: bookingDates || undefined,
      start_time: startTime,
      end_time: endTime,
      duration_hours: sec,
      payment_details: payment_details,
      total_amount: Number(payment_details.total_amount) + Number(payment_details.wallet_amount),
      payble_amount: Number(payment_details.total_amount),
      status: "pending",
      booking_reference: newRef,
      isFreeBooking: isFreeBooking,
      bookingType: bookingType
    });

    // ✅ Update booking count and save user
    user.bookingCount = (user.bookingCount ?? 0) + 1;
    await booking.save();
    await user.save();

    return res.status(201).json({ success: true, message: "Booking created successfully", booking, });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error creating booking" });
  }
};