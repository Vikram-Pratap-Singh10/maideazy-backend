import { NextFunction, Request, Response } from 'express';
import Maid from '../models/Maid.js';
import moment from "moment-timezone";
import MaidAvailability from '../models/MaidAvailability.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import cloudinary from '../middleware/cloudinary.js';
import Setting from '../models/Setting.js';
import { checkInAttendance, checkOutAttendance } from './attendance.controller.js';

interface MulterFile extends Express.Multer.File {
  buffer: Buffer;
}

export const getAllMaids = async (req: Request, res: Response): Promise<void> => {
  try {
    const maids = await Maid.find();
    res.status(200).json({ success: true, data: maids });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getMaidById = async (req: Request, res: Response): Promise<void> => {
  try {
    const maidId = req.params.maidId;
    const maid = await Maid.findById(maidId);
    if (!maid) {
      res.status(404).json({ success: false, message: 'Maid not found' });
      return;
    }
    res.json({ success: true, data: maid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const maidId = req.params.maidId;
    const availability = await MaidAvailability.find({ maid_id: maidId })
      .select('available_date start_time end_time is_booked')
      .sort({ available_date: 1 });
    res.json({ success: true, data: availability });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Create new maid (Admin only)
export const createMaid = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const existMaid = await Maid.findOne({ phone: req.body.phone, is_active: true })
    const user = await User.findOne({ phone: req.body.phone, isActive: true })
    if (user) return res.status(400).json({ success: false, message: " maid already exist" });
    if (existMaid) {
      return res.status(400).json({ success: false, message: "Maid Already Exist" })
    }
    const file = req.file as MulterFile;
    if (file) {
      const imageUrl: string = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "maideazy/maids" },
          (error, result) => {
            if (error) return reject(error);
            if (result) return resolve(result.secure_url);
            reject(new Error("Upload failed"));
          }
        );
        uploadStream.end(file.buffer);
      });
      req.body.profile_image = imageUrl;
    }
    req.body.working_status = false;
    const maid = await Maid.create(req.body);
    if (!maid) return res.status(400).json({ success: true, message: "Bad Request" })
    await User.create({ maidId: maid._id, role: "maid", maid_address: req.body.address, fullName: req.body.name, phone: req.body.phone, email: req.body.email || undefined, profile_image: req.body.profile_image || undefined })
    return res.status(201).json({ success: true, data: maid });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: err });
  }
};
// Update maid (Admin only)
export const updateMaid = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file as MulterFile;
    if (file) {
      const imageUrl: string = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "maideazy/maids" },
          (error, result) => {
            if (error) return reject(error);
            if (result) return resolve(result.secure_url);
            reject(new Error("Upload failed"));
          }
        );
        uploadStream.end(file.buffer);
      });
      req.body.profile_image = imageUrl;
    }
    const maidId = req.params.maidId;
    const updates = req.body;

    const maid = await Maid.findByIdAndUpdate(maidId, updates, { new: true });
    if (!maid) {
      res.status(404).json({ success: false, message: 'Maid not found' });
      return;
    }
    await User.findOneAndUpdate({ maidId: maid._id.toString() }, { fullName: maid.name, phone: maid.phone, email: maid.email, profile_image: maid.profile_image, isActive: maid.is_active }, { new: true })
    res.status(200).json({ success: true, data: maid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error updating maid' });
  }
};
// Delete maid (Admin only - soft delete)
export const deleteMaid = async (req: Request, res: Response): Promise<void> => {
  try {
    const maidId = req.params.maidId;

    const maid = await Maid.findByIdAndDelete(maidId);
    if (!maid) {
      res.status(404).json({ success: false, message: 'Maid not found' });
      return;
    }
    await User.findOneAndDelete({ maidId: maid._id.toString() })
    res.json({ success: true, message: 'Maid deactivated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error deleting maid' });
  }
};
export const getAllMaidsAdmin1 = async (req: Request, res: Response): Promise<any> => {
  try {
    const maids = await Maid.find()
    const available = await MaidAvailability.find().select('maid_id start_time end_time is_booked status')
    if (maids.length == 0) return res.status(404).json({ success: false, message: "Maids Not Found" })
    const maidWithCount = await Promise.all(
      maids.map(async (maid) => {
        const bookingCount = await Booking.countDocuments({ maid_id: maid._id });
        return {
          ...maid.toObject(),
          bookingCount
        };
      }));
    return res.status(200).json({ success: true, data: maidWithCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
export const getAllMaidsAdmin = async (req: Request, res: Response): Promise<any> => {
  try {
    const maids = await Maid.find({ is_active: true });
    if (maids.length === 0) {
      return res.status(404).json({ success: false, message: "Maids Not Found" });
    }
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const available = await MaidAvailability.find().select("maid_id start_time end_time is_booked status");

    const maidWithDetails = await Promise.all(
      maids.map(async (maid) => {
        const maidObj = maid.toObject();
        const availability = available.find((item: any) => item.maid_id.toString() === maid._id.toString());
        const bookingCount = await Booking.countDocuments({
          maid_id: maid._id, booking_date: {
            $gte: startOfToday,
            $lte: endOfToday
          }
        });
        return {
          ...maidObj,
          bookingCount,
          availability: availability || null,
        };
      }));

    return res.status(200).json({ success: true, data: maidWithDetails, });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
export const getAllMaidsByHubAdmin = async (req: Request, res: Response): Promise<any> => {
  try {
    const maids = await Maid.find({ hub: req.params.hub });
    if (maids.length === 0) {
      return res.status(404).json({ success: false, message: "Maids Not Found" });
    }
    const available = await MaidAvailability.find().select("maid_id start_time end_time is_booked status");

    const maidWithDetails = await Promise.all(
      maids.map(async (maid) => {
        const maidObj = maid.toObject();
        const availability = available.find((item: any) => item.maid_id.toString() === maid._id.toString());
        const bookingCount = await Booking.countDocuments({ maid_id: maid._id });
        return {
          ...maidObj,
          bookingCount,
          availability: availability || null,
        };
      }));

    return res.status(200).json({ success: true, data: maidWithDetails, });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get Booking By Maid
export const getBookingsByMaid1 = async (req: Request, res: Response) => {
  try {
    const maidId = (req as any).user.maidId;

    const nowIST = moment().tz("Asia/Kolkata");
    const todayStartIST = nowIST.clone().startOf("day");
    const todayStartUTC = todayStartIST.utc().toDate();

    const bookings = await Booking.find({
      maid_id: maidId,
      status: { $in: ["pending", "confirmed", "ongoing", "completed", "cancelled"] },
      booking_date: { $gte: todayStartUTC }
    })
      .populate("user_id", "fullName profile_image phone")
      .sort({ booking_date: 1 });

    const setting = await Setting.findOne({});
    const contact_number = setting?.mobile || "8433635600";

    const updatedBookings = bookings.filter((booking: any) => {
      const bookingDateIST = moment(booking.booking_date).tz("Asia/Kolkata").startOf("day");

      // If booking is in future date → always allow
      if (bookingDateIST.isAfter(todayStartIST)) return true;

      // If booking is today → check start_time
      if (bookingDateIST.isSame(todayStartIST)) {
        const bookingStartTimeIST = moment.tz(
          `${bookingDateIST.format("YYYY-MM-DD")} ${booking.start_time}`,
          "YYYY-MM-DD hh:mm A",
          "Asia/Kolkata"
        );

        return bookingStartTimeIST.isSameOrAfter(nowIST);
      }

      return false;
    }).map((booking: any) => ({
      ...booking.toObject(),
      booking_date_ist: moment(booking.booking_date)
        .tz("Asia/Kolkata")
        .format("YYYY-MM-DD"),
      start_time_ist: booking.start_time,
      contact_number
    }));

    res.status(200).json({ success: true, data: updatedBookings });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching bookings"
    });
  }
};
// only booking date
export const getBookingsByMaid = async (req: Request, res: Response) => {
  try {
    const maidId = (req as any).user.maidId;
    const today = moment().tz("Asia/Kolkata").startOf("day").toDate();
    const bookings = await Booking.find({
      maid_id: maidId,
      $or: [
        {
          status: { $in: ["pending", "confirmed"] },
          booking_date: { $gte: today }
        },
        {
          status: { $in: ["cancelled", "ongoing", "completed"] }
        }
      ]
    })
      .populate("user_id", "fullName profile_image phone")
      .sort({ booking_date: 1 });
    const setting = await Setting.findOne({});
    const contact_number = setting?.mobile || "8433635600";
    const updatedBookings = bookings.map((booking: any) => ({
      ...booking.toObject(),
      contact_number
    }));
    res.status(200).json({ success: true, data: updatedBookings });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ success: false, message: "Server error fetching bookings" });
  }
};

// Get Completed Booking By Maid
export const getCompletedBookingsByMaid = async (req: Request, res: Response) => {
  try {
    const maidId = (req as any).user.maidId;
    // Get all bookings with service and user basic info populated
    const bookings = await Booking.find({ maid_id: maidId, status: { $in: ["completed", 'cancelled'] } })
      .populate('user_id', 'fullName profile_image')
      .sort({ booking_date: -1 });
    res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ success: false, message: 'Server error fetching bookings' });
  }
};

export const toggleMaidOnlineStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const maidId = (req as any).user.maidId;
    const maid = await Maid.findById(maidId);
    if (!maid) {
      return res.status(404).json({ success: false, message: "Maid not found" });
    }
    maid.is_online = !maid.is_online;
    const updateMaid = await maid.save();
    // maid.is_online ? checkInAttendance(maidId) : checkOutAttendance(maidId)
    if (maid.is_online === false) {
      maid.working_status = false;
      await maid.save();
    } else {
      checkOutAttendance(maidId)
    }
    return res.status(200).json({ success: true, message: maid.is_online ? "Maid is now Online" : "Maid is now Offline", data: maid.is_online });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
export const checkMaidOnlineOffline = async (req: Request, res: Response): Promise<Response> => {
  try {
    const maidId = (req as any).user.maidId;
    const maid = await Maid.findById(maidId);
    if (!maid) {
      return res.status(404).json({ success: false, message: "Maid not found" });
    }
    return res.status(200).json({ success: true, data: maid.is_online });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};