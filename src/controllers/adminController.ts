import { Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import XLSX from "xlsx";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Maid from "../models/Maid.js";
import { sendNotification, sendNotificationToAdmins } from '../utils/firebase.js';
import offerUsedUser from '../models/offerUsedUser.js';
import Payment from '../models/Payment.js';
import Otp from '../models/Otp.js';

export const getDashboardStats1 = async (req: Request, res: Response): Promise<void> => {
  try {
    // Dates for this and last month
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // ===== USERS =====
    const totalUsers = await User.countDocuments({ role: "user" });
    const thisMonthUsers = await User.countDocuments({
      role: "user",
      createdAt: { $gte: startOfThisMonth },
    });
    const lastMonthUsers = await User.countDocuments({
      role: "user",
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    // ===== MAIDS =====
    const totalMaids = await Maid.countDocuments();
    const thisMonthMaids = await Maid.countDocuments({
      createdAt: { $gte: startOfThisMonth },
    });
    const lastMonthMaids = await Maid.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    // ===== BOOKINGS =====
    const totalBookings = await Booking.countDocuments();
    const thisMonthBookings = await Booking.countDocuments({
      createdAt: { $gte: startOfThisMonth },
    });
    const lastMonthBookings = await Booking.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    // ===== REVENUE =====
    const totalRevenueResult = await Booking.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalRevenue = totalRevenueResult[0]?.total || 0;

    const thisMonthRevenueResult = await Booking.aggregate([
      { $match: { createdAt: { $gte: startOfThisMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const thisMonthRevenue = thisMonthRevenueResult[0]?.total || 0;

    const lastMonthRevenueResult = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const lastMonthRevenue = lastMonthRevenueResult[0]?.total || 0;

    // ===== GROWTH CALCULATIONS =====
    const calcGrowth = (current: number, previous: number): number => {
      if (previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    const stats = {
      users: {
        total: totalUsers,
        growth: calcGrowth(thisMonthUsers, lastMonthUsers).toFixed(2),
      },
      maids: {
        total: totalMaids,
        growth: calcGrowth(thisMonthMaids, lastMonthMaids).toFixed(2),
      },
      bookings: {
        total: totalBookings,
        growth: calcGrowth(thisMonthBookings, lastMonthBookings).toFixed(2),
      },
      revenue: {
        total: totalRevenue,
        growth: calcGrowth(thisMonthRevenue, lastMonthRevenue).toFixed(2),
      },
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Get recent bookings (last 7 days)
export const getRecentBookings = async (req: Request, res: Response): Promise<any> => {
  try {
    // Get date of 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find recent bookings (last 7 days)
    const recentBookings = await Booking.find({ createdAt: { $gte: sevenDaysAgo } })
      .populate("user_id", "fullName email")
      .populate("maid_id", "name")
      .populate("service_id", "service_name")
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      count: recentBookings.length,
      recentBookings,
    });
  } catch (error) {
    console.error("Recent Bookings Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// Get Today new Booking, Today Completed Booking, Pending Booking, Ongoing Booking
export const getDashboardStats22 = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();

    // Today start & end
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Month dates
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // ======= TODAY BOOKINGS =======
    const todayNewBookings = await Booking.countDocuments({
      createdAt: { $gte: startOfToday, $lte: endOfToday }
    });

    const todayCompletedBookings = await Booking.countDocuments({
      status: "completed",
      booking_complete_date: { $gte: startOfToday, $lte: endOfToday }
    });

    const todayconfirmedBookings = await Booking.countDocuments({
      status: "confirmed",
      booking_complete_date: { $gte: startOfToday, $lte: endOfToday }
    });

    const todayPendingBookings = await Booking.countDocuments({
      status: "pending",
      createdAt: { $gte: startOfToday, $lte: endOfToday }
    });

    const todayOngoingBookings = await Booking.countDocuments({
      status: "ongoing",
      booking_complete_date: { $gte: startOfToday, $lte: endOfToday }
    });

    // ======= EXISTING MONTHLY STATS =======
    const totalUsers = await User.countDocuments({ isActive: true, role: "user" });
    const thisMonthUsers = await User.countDocuments({
      isActive: true, role: "user", createdAt: { $gte: startOfThisMonth }
    });
    const lastMonthUsers = await User.countDocuments({
      isActive: true, role: "user",
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
    });

    const totalMaids = await Maid.countDocuments({ is_active: true });
    const thisMonthMaids = await Maid.countDocuments({
      is_active: true, createdAt: { $gte: startOfThisMonth }
    });
    const lastMonthMaids = await Maid.countDocuments({
      is_active: true, createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
    });

    const totalBookings = await Booking.countDocuments();
    const thisMonthBookings = await Booking.countDocuments({
      createdAt: { $gte: startOfThisMonth }
    });
    const lastMonthBookings = await Booking.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
    });

    // ======= TODAY TOTAL HOURS =======
    const todayBookings = await Booking.find({
      booking_date: { $gte: startOfToday, $lte: endOfToday },
      status: { $in: ["confirmed", "ongoing", "completed"] }
    })
      .populate("service_id", "duration")
      .select("total_extend_time service_id");

    let totalHours = 0;

    todayBookings.forEach((booking: any) => {
      const serviceDurationHours = booking?.service_id?.duration || 0;
      const extendMinutes = booking?.total_extend_time || 0;

      const extendHours = extendMinutes / 60;

      totalHours += serviceDurationHours + extendHours;
    });

    // ======= REVENUE STATS =======
    const totalRevenueResult = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalRevenue = totalRevenueResult[0]?.total || 0;

    const thisMonthRevenueResult = await Payment.aggregate([
      { $match: { createdAt: { $gte: startOfThisMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const thisMonthRevenue = thisMonthRevenueResult[0]?.total || 0;

    const lastMonthRevenueResult = await Payment.aggregate([
      { $match: { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const lastMonthRevenue = lastMonthRevenueResult[0]?.total || 0;

    // ======= Growth function =======
    const calcGrowth = (current: number, previous: number): number => {
      if (previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    // RESPONSE
    const stats = {
      // today: {
      //   newBookings: todayNewBookings + todayconfirmedBookings,
      //   completedBookings: todayCompletedBookings,
      //   pendingBookings: todayPendingBookings,
      //   ongoingBookings: todayOngoingBookings
      // },
      today: {
        newBookings: todayNewBookings + todayconfirmedBookings,
        completedBookings: todayCompletedBookings,
        pendingBookings: todayPendingBookings,
        ongoingBookings: todayOngoingBookings,
        totalHours: Number(totalHours.toFixed(2))
      },
      users: {
        total: totalUsers,
        growth: calcGrowth(thisMonthUsers, lastMonthUsers).toFixed(2),
      },
      maids: {
        total: totalMaids,
        growth: calcGrowth(thisMonthMaids, lastMonthMaids).toFixed(2),
      },
      // bookings: {
      //   total: totalBookings,
      //   growth: calcGrowth(thisMonthBookings, lastMonthBookings).toFixed(2),
      // },
      bookings: {
        total: totalBookings,
        growth: calcGrowth(thisMonthBookings, lastMonthBookings).toFixed(2),
        totalHours: Number(totalHours.toFixed(2))
      },
      revenue: {
        total: totalRevenue,
        growth: calcGrowth(thisMonthRevenue, lastMonthRevenue).toFixed(2),
      },
    };

    res.json({ success: true, stats });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {

    const { type = "tillDate" } = req.query;

    const now = new Date();

    // End of today
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    let startDate: Date | null = null;

    // ===== DATE FILTER LOGIC =====
    switch (type) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;

      case "pastWeek":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;

      case "last1Month":
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;

      case "last3Months":
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        startDate.setHours(0, 0, 0, 0);
        break;

      case "last6Months":
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 6);
        startDate.setHours(0, 0, 0, 0);
        break;

      case "last12Months":
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 12);
        startDate.setHours(0, 0, 0, 0);
        break;

      case "tillDate":
      default:
        startDate = null;
    }

    // ===== COMMON DATE FILTER =====
    const dateFilter: any = startDate
      ? { createdAt: { $gte: startDate, $lte: endDate } }
      : {};

    const dateFilter1: any = startDate
      ? { booking_date: { $gte: startDate, $lte: endDate } }
      : {};

    // ===== BOOKINGS =====
    const totalBookings = await Booking.countDocuments({
      ...dateFilter1,
      status: { $nin: ["failed", "cancelled"] }
    });
    const completedBookings = await Booking.countDocuments({
      ...dateFilter1,
      status: "completed"
    });

    const confirmedBookings = await Booking.countDocuments({
      ...dateFilter1,
      status: "confirmed"
    });

    const pendingBookings = await Booking.countDocuments({
      ...dateFilter1,
      status: "pending"
    });

    const ongoingBookings = await Booking.countDocuments({
      ...dateFilter1,
      status: "ongoing"
    });

    // ===== HOURS CALCULATION =====
    const bookings = await Booking.find({
      ...dateFilter1,
      status: { $in: ["completed"] }
    })
      .populate("service_id", "duration")
      .select("service_id total_extend_time");

    let totalHours = 0;

    bookings.forEach((booking: any) => {
      const duration = booking?.service_id?.duration || 0;
      const extendMinutes = booking?.total_extend_time || 0;

      totalHours += duration + extendMinutes / 60;
    });

    // ===== USERS =====
    const totalUsers = await User.countDocuments({
      role: "user",
      isActive: true,
      ...dateFilter
    });

    // ===== MAIDS =====
    const totalMaids = await Maid.countDocuments({
      is_active: true,
      ...dateFilter
    });

    // ===== REVENUE =====
    const revenueMatch = startDate
      ? {
        createdAt: { $gte: startDate, $lte: now },
        payment_status: "success"
      }
      : { payment_status: "success" };

    const revenueResult = await Payment.aggregate([
      { $match: revenueMatch },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;

    // ===== RESPONSE =====
    const stats = {
      filterType: type,
      bookings: {
        total: totalBookings,
        completed: completedBookings,
        confirmed: confirmedBookings,
        pending: pendingBookings,
        ongoing: ongoingBookings,
        totalHours: Number(totalHours.toFixed(2))
      },
      users: totalUsers,
      maids: totalMaids,
      revenue: totalRevenue
    };

    res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};


export const testNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, title, body } = req.body
    console.log("calling")
    await sendNotificationToAdmins(
      'New Booking Created',
      `A new booking has been created with reference`,
      {
        type: "new_booking",
      });
    // await sendNotification(token,title,body);
    res.status(200).json({ success: true, message: "successful" })
    return
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Interanl Server Error" })
    return;
  }
}

// Already Used New User Offer
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body.phone) {
      res.status(400).json({ success: false, message: "Phone is Required" })
      return;
    }
    const user = await offerUsedUser.create(req.body);
    if (!user) {
      res.status(400).json({ success: false, message: "something went wrong" });
      return;
    }
    res.status(200).json({ success: true, message: "create successful", data: user })
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}
export const getOldUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await offerUsedUser.find({ isOffer: true })
    if (user.length === 0) {
      res.status(404).json({ success: false, message: "Not Found" });
      return;
    }
    res.status(200).json({ success: true, data: user })
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}
export const deleteOldUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const user = await offerUsedUser.findByIdAndDelete(id)
    if (!user) {
      res.status(404).json({ success: false, message: "Not Found" });
      return;
    }
    res.status(200).json({ success: true, message: "Deleted Successfull", data: user })
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}
// Bulk Upload Old User from Excel/CSV (Admin only)
interface IExcelRow {
  // name?: string;
  phone: string;
}

export const bulkUpload = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: "File is required" });
      return;
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      res.status(400).json({ success: false, message: "No sheet found in Excel file" });
      return;
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      res.status(400).json({ success: false, message: "No sheet found in Excel file" });
      return;
    }
    const rows = XLSX.utils.sheet_to_json<IExcelRow>(sheet, { defval: "" });

    if (!rows.length) {
      res.status(400).json({ success: false, message: "Empty file" });
      return;
    }

    const requiredFields: (keyof IExcelRow)[] = ["phone"];

    const validData: { phone: string }[] = [];
    const invalidData: { row: number; error: string }[] = [];

    // 1️⃣ Validate rows
    rows.forEach((row, index) => {
      const missing = requiredFields.filter(
        (field) => !row[field] || String(row[field]).trim() === ""
      );

      if (missing.length) {
        invalidData.push({
          row: index + 2,
          error: `Missing fields: ${missing.join(", ")}`
        });
        return;
      }

      validData.push({
        // name: String(row.name).trim(),
        phone: String(row.phone).trim()
      });
    });

    if (!validData.length) {
      res.status(400).json({ success: false, message: "No valid rows found", errors: invalidData });
      return;
    }

    // 2️⃣ Get existing phones from DB (single query)
    const phones = validData.map(v => v.phone);

    const existingRecords = await offerUsedUser.find(
      { phone: { $in: phones } },
      { phone: 1, _id: 0 }
    );

    const existingPhones = new Set(existingRecords.map(r => r.phone));

    // 3️⃣ Separate new & duplicate
    const toInsert = validData.filter(v => !existingPhones.has(v.phone));
    const alreadyExists = validData
      .filter(v => existingPhones.has(v.phone))
      .map(v => v.phone);

    // 4️⃣ Insert only new phones
    if (toInsert.length) {
      await offerUsedUser.insertMany(toInsert, { ordered: false });
    }

    // 5️⃣ Response
    res.status(200).json({
      success: true,
      inserted: toInsert.length,
      failed: invalidData.length + alreadyExists.length,
      alreadyExists,
      validationErrors: invalidData
    });

  } catch (error: any) {
    console.error("Bulk upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Bulk upload failed"
    });
  }
};



export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, message: "Id is required" });
      return;
    }
    const user = await User.findOneAndUpdate({ _id: id }, { isActive: req.body.isActive }, { new: true });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found or already deleted', });
      return;
    }
    res.status(200).json({ success: true, message: "user delete successful" })
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// Create Admin's
export const registerAdmin = async (req: any, res: any) => {
  try {
    const { fullName, phone, email, password } = req.body;
    if (!fullName || !phone || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    const existing = await User.findOne({ $or: [{ email }, { phone }] });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Admin already exists' });
    }
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);
    const user = await User.create({ fullName, phone, email, password: hashedPassword, role: 'admin' });

    res.status(201).json({ success: true, message: 'Admin registered successfully', data: { id: user._id, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getAdmins = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find({ role: 'admin' });
    res.status(200).json({ success: true, data: users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const updateAdmin = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { fullName, phone, email, password } = req.body;
    const admin = await User.findOne({ _id: id, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    if (email || phone) {
      const exist = await User.findOne({ _id: { $ne: id }, $or: [{ email }, { phone }] });

      if (exist) {
        return res.status(400).json({ success: false, message: 'Email or phone already in use' });
      }
    }
    if (fullName) admin.fullName = fullName;
    if (email) admin.email = email;
    if (phone) admin.phone = phone;
    if (password) {
      const salt = await bcryptjs.genSalt(10);
      admin.password = await bcryptjs.hash(password, salt);
    }

    await admin.save();

    res.status(200).json({ success: true, message: 'Admin updated successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteAdmin = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const admin = await User.findOne({ _id: id, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    admin.isActive = false;
    await admin.save();

    res.status(200).json({ success: true, message: 'Admin deleted successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const changePassword = async (req: any, res: any) => {
  try {
    const userId = (req as any).user._id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "All password fields are required", });
    }
    const existing = await User.findById(userId);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Admin not found", });
    }
    // Correct bcrypt compare
    const isMatch = await bcryptjs.compare(currentPassword, existing.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Current password is incorrect", });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "New password and confirm password do not match", });
    }
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(newPassword, salt);
    existing.password = hashedPassword;
    await existing.save();

    return res.status(200).json({ success: true, message: "Password updated successfully", });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ success: false, message: "Server error", });
  }
};

//get otp
export const getOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await Otp.find();
    res.status(200).json({ success: true, data: users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};