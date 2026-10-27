import { Request, RequestHandler, Response } from 'express';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import Razorpay from 'razorpay';
import crypto from "node:crypto";
import Offer from '../models/Offer.js';
import { sendNotificationToAdmins, sendNotificationToUser } from '../utils/firebase.js';
import Booking from '../models/Booking.js';
import Service from '../models/Service.js';
import { io } from '../server.js';

/**
 * RAZORPAY WEBHOOK
 * IMPORTANT: This route MUST use express.raw()
 */
export const razorpayWebhook1 = async (req: Request, res: Response) => {
  try {
    console.log("calling")
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET as string;
    const razorpaySignature = req.headers["x-razorpay-signature"] as string;

    if (!razorpaySignature) {
      console.log("Missing webhook signature");
      return res.status(400).json({ success: false, message: "Missing webhook signature" });
    }

    /* ============================
       1️⃣ VERIFY WEBHOOK SIGNATURE
    ============================ */
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body) // 🔥 RAW BUFFER ONLY
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      console.log("Invalid webhook signature");
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    /* ============================
       2️⃣ PARSE PAYLOAD
    ============================ */
    const payload = JSON.parse(req.body.toString());
    const event = payload.event;

    /* ============================
       3️⃣ HANDLE PAYMENT CAPTURED
    ============================ */
    if (event === "payment.captured") {
      console.log("Payment captured");

      const payment = payload.payload.payment.entity;
      // console.log(payment)
      // console.log(payment.order_id)
      const transaction = await Payment.findOne({
        order_id: payment.order_id, isBooking: 'booking'
      });
      if (transaction) {
        console.log("Payment already processed");
        const booking = await Booking.findById(transaction?.booking_id);
        if (!booking) {
          console.log("Booking not found");
          return res.status(200).json({ success: true, message: "Booking not found, ignored" });
        }
        console.log("yes booking found")
        booking.paymentType = "Online";
        booking.payment_status = "success";
        booking.status = "pending";
        booking.paymentType = "Online";
        booking.paymentDate = new Date();
        if (transaction?.order_id) {
          booking.razorpayOrderId = transaction.order_id;
        }
        if (transaction?.transaction_id) {
          booking.razorpayPaymentId = transaction.transaction_id;
        }
        transaction.payment_status = "success"
        await transaction?.save()
        await booking.save();
      } else {
        console.log("capture but payment not found")
      }
    }

    /* ============================
       4️⃣ ACKNOWLEDGE WEBHOOK
    ============================ */
    console.log("Webhook processed successfully");
    return res.status(200).json({ success: true, message: "Webhook processed successfully" });

  } catch (err) {
    console.error("Razorpay Webhook Error:", err);
    return res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
};

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

// Payment Stats
export const getPaymentStats = async (req: Request, res: Response) => {
  try {
    const now = new Date();

    // ---- TODAY ----
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // ---- THIS MONTH ----
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ---- THIS QUARTER ----
    const quarter = Math.floor(now.getMonth() / 3);
    const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1);

    // ---- THIS YEAR ----
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const stats = await Payment.aggregate([
      {
        $match: {
          payment_status: { $in: ["success", "completed"] },
          createdAt: { $lte: now }
        }
      },
      {
        $facet: {
          today: [
            { $match: { createdAt: { $gte: startOfToday } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ],
          month: [
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ],
          quarter: [
            { $match: { createdAt: { $gte: startOfQuarter } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ],
          year: [
            { $match: { createdAt: { $gte: startOfYear } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ],
          totalRevenue: [
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ]
        }
      }
    ]);

    const result = {
      todayTotal: stats[0].today[0]?.total || 0,
      thisMonthTotal: stats[0].month[0]?.total || 0,
      quarterTotal: stats[0].quarter[0]?.total || 0,
      yearTotal: stats[0].year[0]?.total || 0,
      totalRevenue: stats[0].totalRevenue[0]?.total || 0
    };
    return res.status(200).json({ success: true, data: result });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get Payments by Admin
export const getPaymentByAdmin = async (req: Request, res: Response): Promise<any> => {
  try {
    const { startDate, endDate, payment_status, payment_method } = req.query;
    let filter: any = {};
    if (payment_status) filter.payment_status = payment_status;
    if (payment_method) filter.payment_method = payment_method;
    // if (startDate && endDate) {
    const start = startDate ? new Date(startDate as string) : new Date()
    const end = endDate ? new Date(endDate as string) : new Date()
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    filter.createdAt = { $gte: start, $lte: end };
    // }
    // console.log(filter)
    const payments = await Payment.find(filter).populate('user_id', 'fullName phone').sort({ createdAt: -1 });

    if (!payments.length) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    return res.status(200).json({ success: true, data: payments });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


// Normally here you would integrate Razorpay or another gateway
export const processPayment: RequestHandler = async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).user?._id;
  const { bookingId, amount, paymentMethod, transactionId, paymentGateway, bookingOffer, } = req.body;
  try {
    const user = await User.findById(userId)
    if (!user) return res.status(400).json({ success: false, message: "Unauthorized User" })

    const payment = await Payment.create({
      booking_id: bookingId || undefined,
      user_id: userId,
      amount,
      payment_method: paymentMethod || undefined,
      transaction_id: transactionId || undefined,
      payment_gateway: paymentGateway || undefined,
      payment_status: 'completed'
    });
    if (bookingOffer) {
      const offer = await Offer.findOne({
        $or: [{ type: "onlyNew" }, { isActive: true }]
      });
      if (offer) {
        user.freeOffer.offerName = offer.title;
        user.freeOffer.freeBookings = offer.conditions?.bookingsLimit ?? 0;
        user.freeOffer.bookingsLimit = offer.conditions?.bookingsLimit ?? 0;
        user.freeOffer.perBookingDuration = offer.conditions?.perBookingDuration ?? 0
        const validityDays = offer.conditions?.validityDays ?? 0;
        const validateDate = new Date();
        validateDate.setDate(validateDate.getDate() + validityDays);
        user.freeOffer.validityDays = validateDate;
      }
    }
    if (!payment) return res.status(400).json({ success: false, message: "something went wrong" })
    user.wallet_balance += amount;
    await user.save();
    // return res.status(200).json({success:true, message: "payment successful", orderId: razorpay_order_id, paymentId: razorpay_payment_id, });
    return res.status(200).json({ success: true, message: 'Payment recorded' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Payment processing error' });
  }
};

export const getPaymentByUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?._id;
    const payment = await Payment.find({ user_id: userId })
    if (payment.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    return res.status(200).json({ success: true, data: payment });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getPaymentByBooking = async (req: Request, res: Response): Promise<any> => {
  try {
    const bookingId = req.params.bookingId;
    const payment = await Payment.findOne({ booking_id: bookingId });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    return res.status(200).json({ success: true, data: payment });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
// create-order payment
export const addAmountInWallet: RequestHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_SECRET!,
    });
    console.log('first-old')
    console.log(req.body)
    const userId = (req as any).user._id;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const payment = await Payment.findOne({
      user_id: userId,
      isBooking: "booking",
      payment_status: "pending",
      createdAt: {
        $gte: startOfToday,
        $lte: endOfToday
      }
    }).sort({ createdAt: -1 });
    // const payment = await Payment.findOne({ user_id: userId, isBooking: 'booking', payment_status: 'pending' }).sort({ createdAt: -1 });
    if (!payment) {
      const { total_amount } = req.body;
      const options = {
        amount: Math.round(Number(total_amount) * 100), // assuming amount in rupees
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      };
      const order = await razorpay.orders.create(options);
      return res.status(200).json({ success: true, order });
      // return res.status(500).json({ error: "Failed to create order" });
    }

    const order = payment.payment_order?.[0] ?? null;
    console.log("order")
    console.log(order)
    return res.status(200).json({ success: true, order });

  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Internal Server Error" })
  }
}
// single booking verify payment
export const verifyPaymentProcess: RequestHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    console.log("single")
    // console.log(req.body)
    const userId = (req as any).user?._id;
    const { payment_method, bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature, } = req.body;
    if (!bookingId && !razorpay_order_id && !razorpay_payment_id && !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "bookingId, orderId, paymentId and signature are required",
      });
    }
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (booking.payment_status === "success") {
      return res.status(200).json({ success: true, message: "Payment already verified", });
    }
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      booking.payment_status = "failed";
      booking.status = "failed";
      await booking.save();
      // req.body.amount = booking.total_amount
      // req.body.booking_id = bookingId
      // req.body.payment_status = "failed";
      // req.body.payment_gateway = 'razorpay';
      // req.body.transaction_id = razorpay_payment_id;
      // req.body.order_id = razorpay_order_id;
      // req.body.user_id = userId;
      // req.body.payment_method = payment_method || undefined;
      const payment = await Payment.findOneAndUpdate(
        { order_id: razorpay_order_id },
        {
          amount: booking.total_amount,
          booking_id: bookingId,
          transaction_id: razorpay_payment_id,
          payment_status: "failed",
          payment_method,
          payment_gateway: 'razorpay',
          type: 'Single'
        },
        { new: true }
      );
      // await Payment.create(req.body);
      return res.status(400).json({ success: false, message: "Invalid payment signature", });
    } else {
      // console.log("Verify Calling")
      booking.payment_status = "success";
      booking.paymentType = "Online";
      booking.paymentDate = new Date();
      booking.status = "pending";
      booking.razorpayOrderId = razorpay_order_id;
      booking.razorpayPaymentId = razorpay_payment_id;
      await booking.save();
      // req.body.payment_method = payment_method || undefined;
      // req.body.amount = booking.payment_details.total_amount + booking.payment_details.wallet_amount
      // req.body.booking_id = bookingId
      // req.body.payment_status = "success";
      // req.body.transaction_id = razorpay_payment_id;
      // req.body.order_id = razorpay_order_id;
      // req.body.payment_gateway = 'razorpay';
      // req.body.user_id = userId;
      // console.log(user.wallet_balance)
      user.wallet_balance = (user.wallet_balance ?? 0) - (booking.payment_details.wallet_amount)
      await user.save()
      // console.log(user)
      // await Payment.create(req.body);
      const payment = await Payment.findOneAndUpdate(
        { order_id: razorpay_order_id },
        {
          amount: booking.payment_details.total_amount + booking.payment_details.wallet_amount,
          booking_id: bookingId,
          transaction_id: razorpay_payment_id,
          payment_status: "success",
          payment_method,
          payment_gateway: 'razorpay',
          type: 'Single'
        },
        { new: true }
      );
      await sendNotificationToAdmins(
        'New Booking Created',
        `A new booking has been created with BookingId ${booking.booking_reference}`,
        {
          type: "new_booking",
          bookingId: booking._id.toString(),
          userId: userId.toString()
        });
      await sendNotificationToUser(
        userId.toString(),
        'New Booking Created',
        `A new booking has been created with BookingId ${booking.booking_reference}`,
        {
          type: "new_booking",
          bookingId: booking._id.toString(),
          userId: userId.toString()
        });
      return res.status(200).json({ success: true, message: "Payment verified successfully", bookingId, paymentId: razorpay_payment_id, });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Internal Server Error", });
  }
};
// offer booking verify payment
export const verifyPayment: RequestHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    console.log("offer")
    console.log(req.body)
    const userId = (req as any).user?._id;
    const { total_amount, payment_method, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!total_amount && !razorpay_order_id && !razorpay_payment_id && !razorpay_signature) {
      return res.status(400).json({ success: false, message: "amount,payment,order id and signature required" })
    }
    const user = await User.findById(userId)
    if (!user) return res.status(400).json({ success: false, message: "Unauthorized User" });

    const sha = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET!);
    //order_id + "|" + razorpay_payment_id
    sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = sha.digest("hex");
    if (digest !== razorpay_signature) {
      req.body.payment_status = "failed";
      req.body.payment_gateway = 'razorpay';
      req.body.transaction_id = razorpay_payment_id;
      req.body.order_id = razorpay_order_id;
      req.body.amount = total_amount
      req.body.payment_method = payment_method || undefined;
      req.body.user_id = userId;
      req.body.remark = 'Offer booking payment failed';
      req.body.type = 'Offer'
      await Payment.create(req.body);
      // const payment = await Payment.findOneAndUpdate(
      //   { order_id: razorpay_order_id },
      //   {
      //     amount: total_amount,
      //     transaction_id: razorpay_payment_id,
      //     payment_status: "failed",
      //     payment_method,
      //     payment_gateway: 'razorpay'
      //   },
      //   { new: true }
      // );
      return res.status(400).json({ msg: "Transaction is not legit!" });
    } else {
      console.log("offer")
      req.body.payment_status = "success";
      req.body.transaction_id = razorpay_payment_id;
      req.body.order_id = razorpay_order_id;
      req.body.payment_gateway = 'razorpay';
      req.body.amount = total_amount
      req.body.payment_method = payment_method || undefined;
      req.body.user_id = userId;
      req.body.remark = 'Offer booking payment successful';
      req.body.type = 'Offer'
      await Payment.create(req.body);
      // const payment = await Payment.findOneAndUpdate(
      //   { order_id: razorpay_order_id },
      //   {
      //     amount: total_amount,
      //     transaction_id: razorpay_payment_id,
      //     payment_status: "success",
      //     payment_method,
      //     payment_gateway: 'razorpay'
      //   },
      //   { new: true }
      // );

      const offer = await Offer.findOne({ type: "onlyNew", isActive: true });
      if (offer) {
        user.freeOffer.offerName = offer.title;
        user.freeOffer.freeBookings = 0;
        const date = new Date();
        date.setDate(date.getDate() - 1);
        user.freeOffer.lastBooking = date;
        user.freeOffer.bookingsLimit = offer.conditions?.bookingsLimit ?? 0;
        user.freeOffer.perBookingDuration = offer.conditions?.perBookingDuration ?? 0
        const validityDays = offer.conditions?.validityDays ?? 0;
        const validateDate = new Date();
        validateDate.setDate(validateDate.getDate() + validityDays);
        user.freeOffer.validityDays = validateDate;
        user.isNewUser = false
        await user.save()
      }

      return res.status(200).json({ msg: "success", orderId: razorpay_order_id, paymentId: razorpay_payment_id, });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Internal Server Error" })
  }
}
// multiple booking verify payment
export const verifyPaymentMultipleBookings: RequestHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    // console.log("multiple")
    // console.log(req.body)
    const userId = (req as any).user?._id;

    const { payment_method, bookings, razorpay_order_id, razorpay_payment_id, razorpay_signature, } = req.body;

    if (!Array.isArray(bookings) || bookings.length === 0 || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "bookings, orderId, paymentId and signature are required", });
    }

    const bookingIds = bookings.map(b => b.bookingId);
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Fetch all bookings
    const bookingDocs = await Booking.find({ _id: { $in: bookingIds } });

    if (bookingDocs.length !== bookingIds.length) {
      return res.status(404).json({ success: false, message: "One or more bookings not found", });
    }

    // Calculate TOTAL AMOUNT
    const totalAmount = bookingDocs.reduce((sum, b) => sum + (b.payment_details.total_amount || 0), 0);

    // Verify Razorpay signature ONCE
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    // PAYMENT FAILED
    if (expectedSignature !== razorpay_signature) {
      await Booking.updateMany(
        { _id: { $in: bookingIds } },
        { payment_status: "failed", status: "failed" }
      );

      // Create ONE failed payment record
      await Payment.create({
        user_id: userId,
        booking_ids: bookingIds,
        amount: totalAmount,
        payment_status: "failed",
        payment_gateway: "razorpay",
        order_id: razorpay_order_id,
        transaction_id: razorpay_payment_id,
        payment_method: payment_method || undefined,
        type: 'Multiple'
      });
      // const payment = await Payment.findOneAndUpdate(
      //   { order_id: razorpay_order_id },
      //   {
      //     booking_ids: bookingIds,
      //     amount: totalAmount,
      //     transaction_id: razorpay_payment_id,
      //     payment_status: "failed",
      //     payment_method,
      //     payment_gateway: 'razorpay'
      //   },
      //   { new: true }
      // );
      return res.status(400).json({ success: false, message: "Invalid payment signature", });
    }

    // PAYMENT SUCCESS
    await Booking.updateMany({ _id: { $in: bookingIds } },
      {
        payment_status: "success",
        paymentType: "Online",
        paymentDate: new Date(),
        status: "pending",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      });
    const booking = await Booking.findById(bookings[0].bookingId);
    let remainingWallet = booking?.payment_details.wallet_amount ?? 0;
    user.wallet_balance = (user.wallet_balance ?? 0) - remainingWallet
    await user.save()
    // console.log(user.wallet_balance)
    // console.log("wallet suer" + user)
    // console.log(remainingWallet + "remainingWallet")
    for (let item of bookings) {
      const booking = await Booking.findById(item.bookingId);
      if (!booking) continue;
      const serviceCharges = booking.payment_details.service_charge; // 120
      let walletUsed = 0;
      let onlineAmount = 0;

      if (remainingWallet >= serviceCharges) {
        // wallet can fully pay this booking
        walletUsed = serviceCharges;
        onlineAmount = 0;
      } else {
        // wallet partially pays
        walletUsed = remainingWallet;
        onlineAmount = serviceCharges - remainingWallet;
      }
      booking.payment_details.wallet_amount = walletUsed;
      booking.payment_details.total_amount = onlineAmount;
      remainingWallet -= walletUsed;
      if (remainingWallet < 0) remainingWallet = 0;
      await booking.save();
    }
    await Payment.create({
      user_id: userId,
      booking_ids: bookingIds,
      amount: totalAmount,
      payment_status: "success",
      payment_gateway: "razorpay",
      order_id: razorpay_order_id,
      transaction_id: razorpay_payment_id,
      payment_method: payment_method || undefined,
      type: 'Multiple'
    });
    // const payment = await Payment.findOneAndUpdate(
    //   { order_id: razorpay_order_id },
    //   {
    //     booking_ids: bookingIds,
    //     amount: totalAmount,
    //     transaction_id: razorpay_payment_id,
    //     payment_status: "success",
    //     payment_method,
    //     payment_gateway: 'razorpay'
    //   },
    //   { new: true }
    // );

    // Notify admin (can be once or per booking — here ONCE)
    const bookingRefs = bookingDocs.map(b => b.booking_reference).join(', ');
    await sendNotificationToAdmins(
      "New Bookings Created",
      `New bookings created.: ${bookingRefs}`,
      {
        type: "new_booking",
        bookingIds: bookingIds.join(","),
        userId: userId.toString(),
      }
    );
    await sendNotificationToUser(
      userId.toString(),
      'New Booking Created',
      `A new bookings has been created with BookingIds ${bookingRefs}`,
      {
        type: "new_booking",
        bookingIds: bookingIds.join(","),
        userId: userId.toString()
      });

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      // paymentId: payment._id,
      totalAmount,
      bookings: bookingIds.map(id => ({ bookingId: id })),
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Internal Server Error", });
  }
};
// extend time booking verify payment
export const verifyPaymentExtendTime: RequestHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?._id;
    const { bookingId, extendMinutes, extendAmount, payment_method, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!extendMinutes && !extendAmount && !bookingId && !razorpay_order_id && !razorpay_payment_id && !razorpay_signature) {
      return res.status(400).json({ success: false, message: "extendMinutes, extendAmount, bookingId, payment, order id and signature are required" })
    }
    const user = await User.findById(userId)
    if (!user) return res.status(400).json({ success: false, message: "Unauthorized User" });
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

    const sha = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET!);
    //order_id + "|" + razorpay_payment_id
    sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = sha.digest("hex");
    if (digest !== razorpay_signature) {
      booking.extend_time = 0;
      await booking.save();
      req.body.payment_status = "failed";
      req.body.payment_gateway = 'razorpay';
      req.body.transaction_id = razorpay_payment_id;
      req.body.order_id = razorpay_order_id,
        req.body.amount = extendAmount
      req.body.payment_method = payment_method || undefined;
      req.body.user_id = userId;
      req.body.remark = "Extend time payment failed"
      req.body.type = 'Extend'
      await Payment.create(req.body);
      // const payment = await Payment.findOneAndUpdate(
      //   { order_id: razorpay_order_id },
      //   {
      //     amount: extendAmount,
      //     transaction_id: razorpay_payment_id,
      //     payment_status: "failed",
      //     payment_method,
      //     payment_gateway: 'razorpay',
      //     remark: 'Extend time payment failed'
      //   },
      //   { new: true }
      // );
      return res.status(400).json({ msg: "Transaction is not legit!" });
    } else {
      req.body.payment_status = "success";
      req.body.transaction_id = razorpay_payment_id;
      req.body.order_id = razorpay_order_id,
        req.body.payment_gateway = 'razorpay';
      req.body.amount = extendAmount
      req.body.payment_method = payment_method || undefined;
      req.body.user_id = userId;
      req.body.remark = "Extend time payment successful";
      req.body.type = 'Extend'
      await Payment.create(req.body);
      // const payment = await Payment.findOneAndUpdate(
      //   { order_id: razorpay_order_id },
      //   {
      //     amount: extendAmount,
      //     transaction_id: razorpay_payment_id,
      //     payment_status: "success",
      //     payment_method,
      //     payment_gateway: 'razorpay',
      //     remark: 'Extend time payment success'
      //   },
      //   { new: true }
      // );

      // Update booking extendntime 
      // Convert minutes → ms
      const extendMs = extendMinutes * 60 * 1000;
      const newExtendTime = (booking.total_extend_time ?? 0) + extendMinutes;
      const newTimerEndTime = new Date(booking.timer_end_time.getTime() + extendMs);
      // console.log("sedonc", extendMinutes)
      const updatedBooking = await Booking.findByIdAndUpdate(
        bookingId, {
        total_extend_time: newExtendTime,
        extend_time: extendMinutes,
        timer_end_time: newTimerEndTime,
        duration_hours: ((booking.duration_hours || 0) + (extendMinutes * 60))
      }, { new: true })
        .populate('user_id', 'fullName profile_image')
        .populate('maid_id', 'name profile_image');
      if (!updatedBooking) {
        return res.status(404).json({ success: false, message: 'Booking not found', });
      }
      updatedBooking.total_amount = updatedBooking.total_amount + extendAmount
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

      return res.status(200).json({ msg: "success", orderId: razorpay_order_id, paymentId: razorpay_payment_id, });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Internal Server Error" })
  }
}

export const createBookingPaymentOrder: RequestHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_SECRET!,
    });

    const { total_amount } = req.body;
    const options = {
      amount: total_amount * 100, // assuming amount in rupees
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);
    if (!order) return res.status(500).json({ error: "Failed to create order" });
    return res.status(200).json({ success: true, data: order });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Internal Server Error" })
  }
}
export const verifyBookingPayment: RequestHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    const { serviceId, addressId, bookingDate, bookingDates, type, startTime, endTime, payment_details, offerBooking, isFreeBooking, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "payment, order id and signature required" })
    }
    const sha = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET!);
    sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = sha.digest("hex");
    if (digest !== razorpay_signature) {
      return res.status(400).json({ msg: "Transaction is not legit!" });
    }
    const userId = (req as any).user?._id;

    // Fetch user and service
    const user = await User.findById(userId).select("wallet_balance addresses bookingCount");
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

    if (!payment_details || !payment_details.total_amount) {
      return res.status(400).json({ success: false, message: "Payment details are required" });
    }
    const serviceAmount = payment_details.total_amount;

    // Generate booking reference
    const bookings = await Booking.find().sort({ createdAt: -1 });
    let newRef: string;
    if (bookings.length === 0) {
      newRef = getNextBookingReference();
    } else {
      const lastBooking = bookings[0]!;
      newRef = getNextBookingReference(lastBooking.booking_reference);
    }
    // console.log("Generated Reference:", newRef);
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    // Create booking document with pending_payment status
    const booking = await Booking.create({
      user_id: userId,
      service_id: serviceId,
      address_id: address,
      type: type,
      booking_date: bookingDate || undefined,
      booking_dates: bookingDates || undefined,
      start_time: startTime,
      end_time: endTime,
      duration_hours: service.duration,
      payment_details: payment_details,
      total_amount: serviceAmount,
      payment_status: "pending_payment",
      pin: pin,
      booking_reference: newRef,
      isFreeBooking: isFreeBooking
    });

    // ✅ Update booking count and save user
    if (offerBooking || isFreeBooking) {
      user.offerBookingCount = (user.offerBookingCount ?? 0) + 1;
      user.freeOffer.freeBookings = (user.freeOffer.freeBookings ?? 0) + 1
    }
    user.bookingCount = (user.bookingCount ?? 0) + 1;
    await user.save();

    await Payment.create({
      booking_id: booking._id,
      user_id: userId,
      amount: booking.total_amount,
      payment_method: 'razorpay',
      transaction_id: razorpay_payment_id,
      payment_gateway: 'razorpay',
      payment_status: 'success'
    });

    // Send notification to admins
    await sendNotificationToAdmins(
      'New Booking Created',
      `A new booking has been created with reference ${newRef}`,
      {
        type: "new_booking",
        bookingId: booking._id.toString(),
        userId: userId.toString()
      });
    const message = "Booking created successfully. Proceed to payment.";
    return res.status(201).json({ success: true, message, booking, orderId: razorpay_order_id, paymentId: razorpay_payment_id });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Internal Server Error" })
  }
}



// New Payment
// create-order payment
export const createOrder: RequestHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_SECRET!,
    });
    console.log('first')
    console.log(req.body)
    const userId = (req as any).user._id;

    const { total_amount, extendMinutes, bookingId, bookingIds, bookingType } = req.body;
    const options = {
      amount: Math.round(Number(total_amount) * 100), // assuming amount in rupees
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);
    await Payment.create({
      user_id: userId,
      booking_id: bookingId,
      booking_ids: bookingIds,
      isBooking: bookingType,
      amount: total_amount,
      order_id: order.id,
      transaction_id: 'pay_' + new Date().getTime(),
      payment_gateway: "razorpay",
      payment_status: "pending",
      extend_time: extendMinutes || 0
      // payment_method
      // payment_order: order
    });
    return res.status(200).json({ success: true, order });

  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Internal Server Error" })
  }
}
export const razorpayWebhook = async (req: Request, res: Response) => {
  try {
    console.log("calling-webhook")
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET as string;
    const razorpaySignature = req.headers["x-razorpay-signature"] as string;

    if (!razorpaySignature) {
      console.log("Missing webhook signature");
      return res.status(400).json({ success: false, message: "Missing webhook signature" });
    }

    /* ============================
       1️⃣ VERIFY WEBHOOK SIGNATURE
    ============================ */
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body) // 🔥 RAW BUFFER ONLY
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      console.log("Invalid webhook signature");
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    /* ============================
       2️⃣ PARSE PAYLOAD
    ============================ */
    const payload = JSON.parse(req.body.toString());
    const event = payload.event;

    /* ============================
       3️⃣ HANDLE PAYMENT CAPTURED
    ============================ */
    if (event === "payment.captured") {
      console.log("Payment captured");

      const payment = payload.payload.payment.entity;
      // -----------------------------------------------------------------------------------
      const transactions = await Payment.findOne({
        order_id: payment.order_id, isBooking: 'booking'
      });
      if (transactions) {
        console.log("Payment already processed");
        const booking = await Booking.findById(transactions?.booking_id);
        if (!booking) {
          console.log("Booking not found");
          return res.status(200).json({ success: true, message: "Booking not found, ignored" });
        }
        console.log("yes booking found")
        booking.paymentType = "Online";
        booking.payment_status = "success";
        booking.status = "pending";
        booking.paymentType = "Online";
        booking.paymentDate = new Date();
        if (transactions?.order_id) {
          booking.razorpayOrderId = transactions.order_id;
        }
        if (transactions?.transaction_id) {
          booking.razorpayPaymentId = transactions.transaction_id;
        }
        transactions.payment_status = "success"
        await transactions?.save()
        await booking.save();
      } else {
        console.log("capture but payment not found")
      }
      // -----------------------------------------------------------------------------------
      // console.log(payment)
      // console.log(payment.order_id)
      const transaction = await Payment.findOne({
        order_id: payment.order_id,
        isBooking: { $in: ['single', 'multiple', 'offer', 'extend'] }
      });

      if (!transaction) {
        console.log("Transaction not found");
        return res.status(200).json({
          success: true,
          message: "Transaction not found, ignored",
        });
      }

      /* ============================
         SINGLE BOOKING
      ============================ */
      if (transaction.isBooking === "single") {
        const booking = await Booking.findById(transaction.booking_id);
        console.log("singleeee")
        if (!booking) {
          console.log("Booking not found");
          return res.status(200).json({
            success: true,
            message: "Booking not found, ignored",
          });
        }
        const user = await User.findById(transaction.user_id);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        booking.paymentType = "Online";
        booking.payment_status = "success";
        booking.status = "pending";
        booking.paymentDate = new Date();
        booking.razorpayOrderId = transaction.order_id;
        booking.razorpayPaymentId = transaction.transaction_id;

        transaction.payment_status = "success";
        transaction.type = "Single";
        user.wallet_balance = (user.wallet_balance ?? 0) - (booking.payment_details.wallet_amount)
        await user.save()

        await transaction.save();
        await booking.save();
      }

      /* ============================
         MULTIPLE BOOKINGS
      ============================ */
      else if (
        transaction.isBooking === "multiple" &&
        Array.isArray(transaction.booking_ids) &&
        transaction.booking_ids.length > 0
      ) {
        console.log("multiiii")
        await Booking.updateMany(
          { _id: { $in: transaction.booking_ids } },
          {
            payment_status: "success",
            paymentType: "Online",
            paymentDate: new Date(),
            status: "pending",
            razorpayOrderId: transaction.order_id,
            razorpayPaymentId: transaction.transaction_id,
          }
        );
        transaction.payment_status = "success";
        transaction.type = "Multiple";
        await transaction.save();

        const user = await User.findById(transaction.user_id);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        // Fetch all bookings
        const bookingDocs = await Booking.find({ _id: { $in: transaction.booking_ids } });

        if (bookingDocs.length !== transaction.booking_ids.length) {
          return res.status(404).json({ success: false, message: "One or more bookings not found", });
        }

        const totalAmount = bookingDocs.reduce((sum, b) => sum + (b.payment_details.wallet_amount || 0), 0);
        const totalAmountNum = Number(totalAmount || 0);
        const userWallet = Number(user.wallet_balance || 0);

        user.wallet_balance = userWallet - totalAmountNum;
        await user.save();
        // const booking = await Booking.findById(transaction.booking_ids[0]);
        // let remainingWallet = booking?.payment_details.wallet_amount ?? 0;
        // user.wallet_balance = (user.wallet_balance ?? 0) - remainingWallet
        // await user.save()
        // console.log(user.wallet_balance)
        // console.log("wallet suer" + user)
        // console.log(remainingWallet + "remainingWallet")
        // for (let item of transaction.booking_ids) {
        //   const booking = await Booking.findById(item);
        //   if (!booking) continue;
        //   const serviceCharges = booking.payment_details.service_charge; // 120
        //   let walletUsed = 0;
        //   let onlineAmount = 0;

        //   if (remainingWallet >= serviceCharges) {
        //     // wallet can fully pay this booking
        //     walletUsed = serviceCharges;
        //     onlineAmount = 0;
        //   } else {
        //     // wallet partially pays
        //     walletUsed = remainingWallet;
        //     onlineAmount = serviceCharges - remainingWallet;
        //   }
        //   booking.payment_details.wallet_amount = walletUsed;
        //   booking.payment_details.total_amount = onlineAmount;
        //   remainingWallet -= walletUsed;
        //   if (remainingWallet < 0) remainingWallet = 0;
        //   await booking.save();
        // }
      } else if (transaction.isBooking === 'offer') {
        console.log("offerrrrr")
        const user = await User.findById(transaction.user_id)
        if (!user) return res.status(400).json({ success: false, message: "Unauthorized User" });
        const offer = await Offer.findOne({ type: "onlyNew", isActive: true });
        if (offer) {
          user.freeOffer.offerName = offer.title;
          user.freeOffer.freeBookings = 0;
          const date = new Date();
          date.setDate(date.getDate() - 1);
          user.freeOffer.lastBooking = date;
          user.freeOffer.bookingsLimit = offer.conditions?.bookingsLimit ?? 0;
          user.freeOffer.perBookingDuration = offer.conditions?.perBookingDuration ?? 0
          const validityDays = offer.conditions?.validityDays ?? 0;
          const validateDate = new Date();
          validateDate.setDate(validateDate.getDate() + validityDays);
          user.freeOffer.validityDays = validateDate;
          user.isNewUser = false
          await user.save()

          transaction.payment_status = "success";
          transaction.type = 'Offer';
          await transaction.save();
        }

      } else if (transaction.isBooking === "extend") {
        console.log("exttttttt")
        const booking = await Booking.findOne({ _id: transaction.booking_id, user_id: transaction.user_id, status: 'ongoing', });

        if (!booking) {
          return res.status(404).json({ success: false, message: 'Booking not found or not ongoing', });
        }
        if (!booking.timer_end_time) {
          return res.status(400).json({ success: false, message: 'Timer not started yet', });
        }
        const extendMs = transaction.extend_time * 60 * 1000;
        const newExtendTime = (booking.total_extend_time ?? 0) + transaction.extend_time;
        const newTimerEndTime = new Date(booking.timer_end_time.getTime() + extendMs);
        // console.log("sedonc", extendMinutes)
        const updatedBooking = await Booking.findByIdAndUpdate(
          transaction.booking_id, {
          total_extend_time: newExtendTime,
          extend_time: transaction.extend_time,
          timer_end_time: newTimerEndTime,
          duration_hours: ((booking.duration_hours || 0) + (transaction.extend_time * 60))
        }, { new: true })
          .populate('user_id', 'fullName profile_image')
          .populate('maid_id', 'name profile_image');
        if (!updatedBooking) {
          return res.status(404).json({ success: false, message: 'Booking not found', });
        }
        updatedBooking.total_amount = updatedBooking.total_amount + transaction.amount
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
        transaction.payment_status = "success";
        transaction.type = 'Extend';
        await transaction.save();
      }
    }

    /* ============================
       4️⃣ ACKNOWLEDGE WEBHOOK
    ============================ */
    console.log("Webhook processed successfully");
    return res.status(200).json({ success: true, message: "Webhook processed successfully" });

  } catch (err) {
    console.error("Razorpay Webhook Error:", err);
    return res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
};

// single booking verify payment
export const verifyPaymentProcess1: RequestHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    console.log("single")
    // console.log(req.body)
    const userId = (req as any).user?._id;
    const { payment_method, bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature, } = req.body;
    if (!bookingId && !razorpay_order_id && !razorpay_payment_id && !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "bookingId, orderId, paymentId and signature are required",
      });
    }
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (booking.payment_status === "success") {
      return res.status(200).json({ success: true, message: "Payment already verified", });
    }
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      // booking.payment_status = "failed";
      // booking.status = "failed";
      // await booking.save();
      // req.body.amount = booking.total_amount
      // req.body.booking_id = bookingId
      // req.body.payment_status = "failed";
      // req.body.payment_gateway = 'razorpay';
      // req.body.transaction_id = razorpay_payment_id;
      // req.body.order_id = razorpay_order_id;
      // req.body.user_id = userId;
      // req.body.payment_method = payment_method || undefined;
      // const payment = await Payment.findOneAndUpdate(
      //   { order_id: razorpay_order_id },
      //   {
      //     amount: booking.total_amount,
      //     booking_id: bookingId,
      //     transaction_id: razorpay_payment_id,
      //     payment_status: "failed",
      //     payment_method,
      //     payment_gateway: 'razorpay'
      //   },
      //   { new: true }
      // );
      // await Payment.create(req.body);
      return res.status(400).json({ success: false, message: "Invalid payment signature", });
    } else {
      // console.log("Verify Calling")
      // booking.payment_status = "success";
      // booking.paymentType = "Online";
      // booking.paymentDate = new Date();
      // booking.status = "pending";
      // booking.razorpayOrderId = razorpay_order_id;
      // booking.razorpayPaymentId = razorpay_payment_id;
      // await booking.save();
      // req.body.payment_method = payment_method || undefined;
      // req.body.amount = booking.payment_details.total_amount + booking.payment_details.wallet_amount
      // req.body.booking_id = bookingId
      // req.body.payment_status = "success";
      // req.body.transaction_id = razorpay_payment_id;
      // req.body.order_id = razorpay_order_id;
      // req.body.payment_gateway = 'razorpay';
      // req.body.user_id = userId;
      // console.log(user.wallet_balance)
      // user.wallet_balance = (user.wallet_balance ?? 0) - (booking.payment_details.wallet_amount)
      // await user.save()
      // console.log(user)
      // await Payment.create(req.body);
      // const payment = await Payment.findOneAndUpdate(
      //   { order_id: razorpay_order_id },
      //   {
      //     amount: booking.payment_details.total_amount + booking.payment_details.wallet_amount,
      //     booking_id: bookingId,
      //     transaction_id: razorpay_payment_id,
      //     payment_status: "success",
      //     payment_method,
      //     payment_gateway: 'razorpay'
      //   },
      //   { new: true }
      // );
      await sendNotificationToAdmins(
        'New Booking Created',
        `A new booking has been created with BookingId ${booking.booking_reference}`,
        {
          type: "new_booking",
          bookingId: booking._id.toString(),
          userId: userId.toString()
        });
      await sendNotificationToUser(
        userId.toString(),
        'New Booking Created',
        `A new booking has been created with BookingId ${booking.booking_reference}`,
        {
          type: "new_booking",
          bookingId: booking._id.toString(),
          userId: userId.toString()
        });
      return res.status(200).json({ success: true, message: "Payment verified successfully", bookingId, paymentId: razorpay_payment_id, });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Internal Server Error", });
  }
};
// offer booking verify payment
export const verifyPayment1: RequestHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    console.log("offer")
    console.log(req.body)
    const userId = (req as any).user?._id;
    const { total_amount, payment_method, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!total_amount && !razorpay_order_id && !razorpay_payment_id && !razorpay_signature) {
      return res.status(400).json({ success: false, message: "amount,payment,order id and signature required" })
    }
    const user = await User.findById(userId)
    if (!user) return res.status(400).json({ success: false, message: "Unauthorized User" });

    const sha = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET!);
    //order_id + "|" + razorpay_payment_id
    sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = sha.digest("hex");
    if (digest !== razorpay_signature) {
      // req.body.payment_status = "failed";
      // req.body.payment_gateway = 'razorpay';
      // req.body.transaction_id = razorpay_payment_id;
      // req.body.order_id = razorpay_order_id;
      // req.body.amount = total_amount
      // req.body.payment_method = payment_method || undefined;
      // req.body.user_id = userId;
      // await Payment.create(req.body);

      // const payment = await Payment.findOneAndUpdate(
      //   { order_id: razorpay_order_id },
      //   {
      //     amount: total_amount,
      //     transaction_id: razorpay_payment_id,
      //     payment_status: "failed",
      //     payment_method,
      //     payment_gateway: 'razorpay'
      //   },
      //   { new: true }
      // );
      return res.status(400).json({ msg: "Transaction is not legit!" });
    } else {
      console.log("offer")
      // req.body.payment_status = "success";
      // req.body.transaction_id = razorpay_payment_id;
      // req.body.order_id = razorpay_order_id;
      // req.body.payment_gateway = 'razorpay';
      // req.body.amount = total_amount
      // req.body.payment_method = payment_method || undefined;
      // req.body.user_id = userId;
      // await Payment.create(req.body);
      // const payment = await Payment.findOneAndUpdate(
      //   { order_id: razorpay_order_id },
      //   {
      //     amount: total_amount,
      //     transaction_id: razorpay_payment_id,
      //     payment_status: "success",
      //     payment_method,
      //     payment_gateway: 'razorpay'
      //   },
      //   { new: true }
      // );

      // const offer = await Offer.findOne({ type: "onlyNew", isActive: true });
      // if (offer) {
      //   user.freeOffer.offerName = offer.title;
      //   user.freeOffer.freeBookings = 0;
      //   const date = new Date();
      //   date.setDate(date.getDate() - 1);
      //   user.freeOffer.lastBooking = date;
      //   user.freeOffer.bookingsLimit = offer.conditions?.bookingsLimit ?? 0;
      //   user.freeOffer.perBookingDuration = offer.conditions?.perBookingDuration ?? 0
      //   const validityDays = offer.conditions?.validityDays ?? 0;
      //   const validateDate = new Date();
      //   validateDate.setDate(validateDate.getDate() + validityDays);
      //   user.freeOffer.validityDays = validateDate;
      //   user.isNewUser = false
      //   await user.save()
      // }

      return res.status(200).json({ msg: "success", orderId: razorpay_order_id, paymentId: razorpay_payment_id, });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Internal Server Error" })
  }
}
// multiple booking verify payment
export const verifyPaymentMultipleBookings1: RequestHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    // console.log("multiple")
    // console.log(req.body)
    const userId = (req as any).user?._id;

    const { payment_method, bookings, razorpay_order_id, razorpay_payment_id, razorpay_signature, } = req.body;

    if (!Array.isArray(bookings) || bookings.length === 0 || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "bookings, orderId, paymentId and signature are required", });
    }

    const bookingIds = bookings.map(b => b.bookingId);
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Fetch all bookings
    const bookingDocs = await Booking.find({ _id: { $in: bookingIds } });

    if (bookingDocs.length !== bookingIds.length) {
      return res.status(404).json({ success: false, message: "One or more bookings not found", });
    }

    // Calculate TOTAL AMOUNT
    const totalAmount = bookingDocs.reduce((sum, b) => sum + (b.payment_details.total_amount || 0), 0);

    // Verify Razorpay signature ONCE
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    // PAYMENT FAILED
    if (expectedSignature !== razorpay_signature) {
      await Booking.updateMany(
        { _id: { $in: bookingIds } },
        { payment_status: "failed", status: "failed" }
      );

      // Create ONE failed payment record
      await Payment.create({
        user_id: userId,
        booking_ids: bookingIds,
        amount: totalAmount,
        payment_status: "failed",
        payment_gateway: "razorpay",
        order_id: razorpay_order_id,
        transaction_id: razorpay_payment_id,
        payment_method: payment_method || undefined,
      });
      // const payment = await Payment.findOneAndUpdate(
      //   { order_id: razorpay_order_id },
      //   {
      //     booking_ids: bookingIds,
      //     amount: totalAmount,
      //     transaction_id: razorpay_payment_id,
      //     payment_status: "failed",
      //     payment_method,
      //     payment_gateway: 'razorpay'
      //   },
      //   { new: true }
      // );
      return res.status(400).json({ success: false, message: "Invalid payment signature", });
    }

    // PAYMENT SUCCESS
    await Booking.updateMany({ _id: { $in: bookingIds } },
      {
        payment_status: "success",
        paymentType: "Online",
        paymentDate: new Date(),
        status: "pending",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      });
    const booking = await Booking.findById(bookings[0].bookingId);
    let remainingWallet = booking?.payment_details.wallet_amount ?? 0;
    user.wallet_balance = (user.wallet_balance ?? 0) - remainingWallet
    await user.save()
    // console.log(user.wallet_balance)
    // console.log("wallet suer" + user)
    // console.log(remainingWallet + "remainingWallet")
    for (let item of bookings) {
      const booking = await Booking.findById(item.bookingId);
      if (!booking) continue;
      const serviceCharges = booking.payment_details.service_charge; // 120
      let walletUsed = 0;
      let onlineAmount = 0;

      if (remainingWallet >= serviceCharges) {
        // wallet can fully pay this booking
        walletUsed = serviceCharges;
        onlineAmount = 0;
      } else {
        // wallet partially pays
        walletUsed = remainingWallet;
        onlineAmount = serviceCharges - remainingWallet;
      }
      booking.payment_details.wallet_amount = walletUsed;
      booking.payment_details.total_amount = onlineAmount;
      remainingWallet -= walletUsed;
      if (remainingWallet < 0) remainingWallet = 0;
      await booking.save();
    }
    await Payment.create({
      user_id: userId,
      booking_ids: bookingIds,
      amount: totalAmount,
      payment_status: "success",
      payment_gateway: "razorpay",
      order_id: razorpay_order_id,
      transaction_id: razorpay_payment_id,
      payment_method: payment_method || undefined,
    });
    // const payment = await Payment.findOneAndUpdate(
    //   { order_id: razorpay_order_id },
    //   {
    //     booking_ids: bookingIds,
    //     amount: totalAmount,
    //     transaction_id: razorpay_payment_id,
    //     payment_status: "success",
    //     payment_method,
    //     payment_gateway: 'razorpay'
    //   },
    //   { new: true }
    // );

    // Notify admin (can be once or per booking — here ONCE)
    const bookingRefs = bookingDocs.map(b => b.booking_reference).join(', ');
    await sendNotificationToAdmins(
      "New Bookings Created",
      `New bookings created.: ${bookingRefs}`,
      {
        type: "new_booking",
        bookingIds: bookingIds.join(","),
        userId: userId.toString(),
      }
    );
    await sendNotificationToUser(
      userId.toString(),
      'New Booking Created',
      `A new bookings has been created with BookingIds ${bookingRefs}`,
      {
        type: "new_booking",
        bookingIds: bookingIds.join(","),
        userId: userId.toString()
      });

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      // paymentId: payment._id,
      totalAmount,
      bookings: bookingIds.map(id => ({ bookingId: id })),
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Internal Server Error", });
  }
};
// extend time booking verify payment
export const verifyPaymentExtendTime1: RequestHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?._id;
    const { bookingId, extendMinutes, extendAmount, payment_method, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!extendMinutes && !extendAmount && !bookingId && !razorpay_order_id && !razorpay_payment_id && !razorpay_signature) {
      return res.status(400).json({ success: false, message: "extendMinutes, extendAmount, bookingId, payment, order id and signature are required" })
    }
    const user = await User.findById(userId)
    if (!user) return res.status(400).json({ success: false, message: "Unauthorized User" });
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

    const sha = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET!);
    //order_id + "|" + razorpay_payment_id
    sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = sha.digest("hex");
    if (digest !== razorpay_signature) {
      // booking.extend_time = 0;
      // await booking.save();
      // req.body.payment_status = "failed";
      // req.body.payment_gateway = 'razorpay';
      // req.body.transaction_id = razorpay_payment_id;
      // req.body.order_id = razorpay_order_id,
      //   req.body.amount = extendAmount
      // req.body.payment_method = payment_method || undefined;
      // req.body.user_id = userId;
      // req.body.remark = "Extend time payment failed"
      // await Payment.create(req.body);

      // const payment = await Payment.findOneAndUpdate(
      //   { order_id: razorpay_order_id },
      //   {
      //     amount: extendAmount,
      //     transaction_id: razorpay_payment_id,
      //     payment_status: "failed",
      //     payment_method,
      //     payment_gateway: 'razorpay',
      //     remark: 'Extend time payment failed'
      //   },
      //   { new: true }
      // );
      return res.status(400).json({ msg: "Transaction is not legit!" });
    } else {
      // req.body.payment_status = "success";
      // req.body.transaction_id = razorpay_payment_id;
      // req.body.order_id = razorpay_order_id,
      //   req.body.payment_gateway = 'razorpay';
      // req.body.amount = extendAmount
      // req.body.payment_method = payment_method || undefined;
      // req.body.user_id = userId;
      // req.body.remark = "Extend time payment successful";
      // await Payment.create(req.body);

      // const payment = await Payment.findOneAndUpdate(
      //   { order_id: razorpay_order_id },
      //   {
      //     amount: extendAmount,
      //     transaction_id: razorpay_payment_id,
      //     payment_status: "success",
      //     payment_method,
      //     payment_gateway: 'razorpay',
      //     remark: 'Extend time payment success'
      //   },
      //   { new: true }
      // );

      // Update booking extendntime 
      // Convert minutes → ms
      // const extendMs = extendMinutes * 60 * 1000;
      // const newExtendTime = (booking.total_extend_time ?? 0) + extendMinutes;
      // const newTimerEndTime = new Date(booking.timer_end_time.getTime() + extendMs);
      // // console.log("sedonc", extendMinutes)
      // const updatedBooking = await Booking.findByIdAndUpdate(
      //   bookingId, {
      //   total_extend_time: newExtendTime,
      //   extend_time: extendMinutes,
      //   timer_end_time: newTimerEndTime,
      //   duration_hours: ((booking.duration_hours || 0) + (extendMinutes * 60))
      // }, { new: true })
      //   .populate('user_id', 'fullName profile_image')
      //   .populate('maid_id', 'name profile_image');
      // if (!updatedBooking) {
      //   return res.status(404).json({ success: false, message: 'Booking not found', });
      // }
      // updatedBooking.total_amount = updatedBooking.total_amount + extendAmount
      // await updatedBooking.save();
      // const now = new Date();
      // const diffMs: number = now.getTime() - updatedBooking.actual_start_time!.getTime();
      // const secondsDiff = Math.floor(diffMs / 1000);
      // const newSecond = updatedBooking.duration_hours - secondsDiff;
      // updatedBooking.duration_hours = newSecond > 0 ? newSecond : 0;
      // console.log("third", updatedBooking)
      // Real-time update
      // io.to(`booking:${updatedBooking._id}`).emit('booking:start', {
      //   bookingId: updatedBooking._id,
      //   booking: updatedBooking,
      // });

      return res.status(200).json({ msg: "success", orderId: razorpay_order_id, paymentId: razorpay_payment_id, });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Internal Server Error" })
  }
}

export const razorpayWebhook2 = async (req: Request, res: Response) => {
  try {
    console.log("Calling Razorpay Webhook");

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET as string;
    const razorpaySignature = req.headers["x-razorpay-signature"] as string;

    if (!razorpaySignature) {
      console.log("Missing webhook signature");
      return res.status(400).json({ success: false, message: "Missing webhook signature" });
    }

    // Verify webhook signature (raw body required)
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body) // Make sure middleware uses express.raw() for webhook route
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      console.log("Invalid webhook signature");
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    // Parse payload
    const payload = JSON.parse(req.body.toString());
    const event = payload.event;

    if (event !== "payment.captured") {
      console.log("Event not handled:", event);
      return res.status(200).json({ success: true, message: "Event ignored" });
    }

    console.log("Payment captured event");

    const paymentEntity = payload.payload.payment.entity;
    const orderId = paymentEntity.order_id;

    // Find payment record
    const transaction = await Payment.findOne({ order_id: orderId });
    if (!transaction) {
      console.log("Transaction not found, ignoring");
      return res.status(200).json({ success: true, message: "Transaction not found" });
    }

    // Mark transaction as success
    transaction.payment_status = "success";
    await transaction.save();

    const user = await User.findById(transaction.user_id);
    if (!user) {
      console.log("User not found for transaction");
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // =============================
    // SINGLE BOOKING
    // =============================
    if (transaction.isBooking === "single") {
      const booking = await Booking.findById(transaction.booking_id);
      if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

      booking.payment_status = "success";
      booking.paymentType = "Online";
      booking.paymentDate = new Date();
      booking.status = "pending";
      booking.razorpayOrderId = orderId;
      booking.razorpayPaymentId = transaction.transaction_id;

      user.wallet_balance = (user.wallet_balance ?? 0) - (booking.payment_details.wallet_amount || 0);

      await user.save();
      await booking.save();
    }

    // =============================
    // MULTIPLE BOOKINGS
    // =============================
    else if (transaction.isBooking === "multiple" && Array.isArray(transaction.booking_ids) && transaction.booking_ids.length > 0) {
      const bookingDocs = await Booking.find({ _id: { $in: transaction.booking_ids } });
      const totalWalletUsed = bookingDocs.reduce((sum, b) => sum + (b.payment_details.wallet_amount || 0), 0);

      // Update all bookings
      await Booking.updateMany(
        { _id: { $in: transaction.booking_ids } },
        {
          payment_status: "success",
          paymentType: "Online",
          paymentDate: new Date(),
          status: "pending",
          razorpayOrderId: orderId,
          razorpayPaymentId: transaction.transaction_id,
        }
      );

      // Deduct wallet
      user.wallet_balance = (user.wallet_balance ?? 0) - totalWalletUsed;
      await user.save();
    }

    // =============================
    // OFFER BOOKING
    // =============================
    else if (transaction.isBooking === "offer") {
      const offer = await Offer.findOne({ type: "onlyNew", isActive: true });
      if (offer) {
        user.freeOffer.offerName = offer.title;
        user.freeOffer.freeBookings = 0;
        const date = new Date();
        date.setDate(date.getDate() - 1);
        user.freeOffer.lastBooking = date;
        user.freeOffer.bookingsLimit = offer.conditions?.bookingsLimit ?? 0;
        user.freeOffer.perBookingDuration = offer.conditions?.perBookingDuration ?? 0;
        const validityDays = offer.conditions?.validityDays ?? 0;
        const validateDate = new Date();
        validateDate.setDate(validateDate.getDate() + validityDays);
        user.freeOffer.validityDays = validateDate;
        user.isNewUser = false;
        await user.save();
      }
    }

    // =============================
    // EXTEND BOOKING
    // =============================
    else if (transaction.isBooking === "extend") {
      const booking = await Booking.findOne({ _id: transaction.booking_id, user_id: transaction.user_id, status: 'ongoing' });
      if (booking && booking.timer_end_time) {
        const extendMs = booking.extend_time * 60 * 1000;
        const newExtendTime = (booking.total_extend_time ?? 0) + booking.extend_time;
        const newTimerEndTime = new Date(booking.timer_end_time.getTime() + extendMs);

        booking.total_extend_time = newExtendTime;
        booking.timer_end_time = newTimerEndTime;
        booking.duration_hours = (booking.duration_hours || 0) + booking.extend_time * 60;
        booking.total_amount = (booking.total_amount || 0) + transaction.amount;

        await booking.save();

        // Real-time update
        io.to(`booking:${booking._id}`).emit('booking:start', {
          bookingId: booking._id,
          booking,
        });
      }
    }

    console.log("Webhook processed successfully");
    return res.status(200).json({ success: true, message: "Webhook processed successfully" });

  } catch (err) {
    console.error("Razorpay Webhook Error:", err);
    return res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
};