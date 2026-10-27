import Attendance from "../models/Attendance.js";
import Maid from "../models/Maid.js";
import mongoose from "mongoose";
import { getAttendanceStatus } from "../utils/attendanceStatus.js";

const getISTNow = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset);
};

export const checkInAttendance = async (maid_id: string): Promise<any> => {
  try {
    if (!maid_id) {
      return { message: "maid_id is required" }
    }
    const maid = await Maid.findById(maid_id);
    if (!maid) {
      return { message: "Maid not found" }
    }
    maid.working_status = true;
    await maid.save();
    const istNow = getISTNow(); // must return IST date
    const date = new Date(istNow);
    date.setHours(0, 0, 0, 0); // IST start of day

    // Check if already checked in
    const existingAttendance = await Attendance.findOne({ maid_id, date, check_in_time: { $exists: true }, });

    if (existingAttendance) {
      return { message: "Already checked in for today", }
    }

    const status = await getAttendanceStatus(maid_id, istNow);
    const attendance = await Attendance.create({ maid_id, date, check_in_time: istNow, status, });

    return { message: "check-in successfully" }
  } catch (error) {
    console.error(error);
  }
};
export const checkOutAttendance = async (maid_id: string): Promise<any> => {
  try {
    if (!maid_id) {
      return { message: "maid_id is required" }
    }
    const istNow = getISTNow();
    const date = new Date(istNow);
    date.setHours(0, 0, 0, 0);
    const attendance = await Attendance.findOne({ maid_id, date });
    if (!attendance || !attendance.check_in_time) {
      return { message: "Check-in not found for today" }
    }
    if (attendance.check_out_time) {
      return { message: "Already checked out for today" };
    }
    const diffMinutes =
      (istNow.getTime() - attendance.check_in_time.getTime()) / (1000 * 60);

    if (diffMinutes <= 0) {
      return { message: "Invalid check-out time" }
    }
    attendance.check_out_time = istNow;
    attendance.total_hours = Math.floor(diffMinutes);
    await attendance.save();
    const maid = await Maid.findById(maid_id);
    if (!maid) {
      return { message: "Maid not found" }
    }
    maid.working_status = false;
    await maid.save();
    return { message: "Check-out marked successfully", }
  } catch (error) {
    console.error(error);
  }
};
export const checkInAttendance1 = async (req: any, res: any) => {
  try {
    const { maid_id } = req.body;

    if (!maid_id) {
      return res.status(400).json({ success: false, message: "maid_id is required", });
    }

    const istNow = getISTNow(); // must return IST date
    const date = new Date(istNow);
    date.setHours(0, 0, 0, 0); // IST start of day

    // Check if already checked in
    const existingAttendance = await Attendance.findOne({ maid_id, date, check_in_time: { $exists: true }, });

    if (existingAttendance) {
      return res.status(400).json({ success: false, message: "Already checked in for today", });
    }

    const status = await getAttendanceStatus(maid_id, istNow);

    const attendance = await Attendance.create({ maid_id, date, check_in_time: istNow, status, });

    return res.status(200).json({ success: true, data: attendance, });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error", });
  }
};

// POST /api/attendance/check-out
export const checkOutAttendance1 = async (req: any, res: any) => {
  try {
    const { maid_id } = req.body;
    if (!maid_id) {
      return res.status(400).json({ success: false, message: "maid_id is required" });
    }
    const istNow = getISTNow();
    const date = new Date(istNow);
    date.setHours(0, 0, 0, 0);
    const attendance = await Attendance.findOne({ maid_id, date });
    if (!attendance || !attendance.check_in_time) {
      return res.status(400).json({ success: false, message: "Check-in not found for today" });
    }
    const diffMinutes =
      (istNow.getTime() - attendance.check_in_time.getTime()) / (1000 * 60);

    if (diffMinutes <= 0) {
      return res.status(400).json({ success: false, message: "Invalid check-out time" });
    }
    attendance.check_out_time = istNow;
    attendance.total_hours = Math.floor(diffMinutes);
    await attendance.save();
    return res.status(200).json({ success: true, message: "Check-out marked successfully", data: attendance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const updateMarkAttendance = async (req: any, res: any) => {
  try {
    const { maid_id, date, check_in_time, check_out_time } = req.body;

    if (!maid_id || !date) {
      return res.status(400).json({
        success: false,
        message: "maid_id and date are required"
      });
    }
    // normalize date (day start UTC)
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);
    // let attendance = await Attendance.findOne({ maid_id,date: attendanceDate});
    let attendance = await Attendance.findOne({
      date: attendanceDate,
      $or: [
        { maid_id: maid_id },
        { _id: maid_id }
      ]
    });

    if (!attendance) {
      return res.status(400).json({ success: false, message: "maid this date not found" });
    }
    const checkIn = new Date(check_in_time);
    const status = await getAttendanceStatus(maid_id, checkIn);
    const checkOut = new Date(check_out_time);
    if (checkOut <= checkIn) {
      return res.status(400).json({
        success: false, message: "Check-out time must be after check-in time"
      });
    }
    const diffMinutes = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60);
    attendance.check_in_time = checkIn;
    attendance.check_out_time = checkOut;
    attendance.total_hours = Math.floor(diffMinutes);
    attendance.status = status || "on-time";

    await attendance.save();
    return res.status(200).json({ success: true, message: "update marked successfully", data: attendance });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const markAttendance = async (req: any, res: any) => {
  try {
    const { maid_id, date, check_in_time, check_out_time } = req.body;

    if (!maid_id || !date) {
      return res.status(400).json({
        success: false,
        message: "maid_id and date are required"
      });
    }

    // normalize date (day start UTC)
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // find existing attendance
    let attendance = await Attendance.findOne({
      maid_id,
      date: attendanceDate
    });

    // ---------------------------
    // CASE 1: FIRST TIME (CHECK-IN)
    // ---------------------------
    if (!attendance) {
      if (!check_in_time) {
        return res.status(400).json({
          success: false,
          message: "check_in_time is required for first check-in"
        });
      }

      const checkIn = new Date(check_in_time);
      const status = await getAttendanceStatus(maid_id, checkIn);
      attendance = await Attendance.create({
        maid_id,
        date: attendanceDate,
        check_in_time: checkIn,
        status
      });

      return res.status(200).json({ success: true, message: "Check-in marked successfully", data: attendance });
    }

    // ---------------------------
    // CASE 2: CHECK-OUT
    // ---------------------------
    if (attendance.check_in_time && !attendance.check_out_time) {
      if (!check_out_time) {
        return res.status(400).json({
          success: false,
          message: "check_out_time is required for check-out"
        });
      }
      const checkOut = new Date(check_out_time);
      if (checkOut <= attendance.check_in_time) {
        return res.status(400).json({
          success: false,
          message: "Check-out time must be after check-in time"
        });
      }
      const diffMinutes =
        (checkOut.getTime() - attendance.check_in_time.getTime()) / (1000 * 60);
      attendance.check_out_time = checkOut;
      attendance.total_hours = Math.floor(diffMinutes);

      await attendance.save();

      return res.status(200).json({ success: true, message: "Check-out marked successfully", data: attendance });
    }

    // ---------------------------
    // CASE 3: ALREADY COMPLETED
    // ---------------------------
    return res.status(400).json({ success: false, message: "Attendance already completed for this date" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// GET /api/attendance/by-maid
export const getAttendanceListByMaid1 = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    let { startDate, endDate } = req.query;
    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date(start);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const data = await Maid.aggregate([
      {
        $match: { is_active: true }
      },
      {
        $lookup: {
          from: "attendances",
          let: { maid_id: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$maid_id", "$$maid_id"] },
                    { $gte: ["$date", start] },
                    { $lte: ["$date", end] }
                  ]
                }
              }
            }
          ],
          as: "attendance"
        }
      },
      {
        $unwind: {
          path: "$attendance",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          maidName: "$name",
          maidPhone: "$phone",
          maidEmail: "$email",

          date: "$attendance.date",

          displayDate: {
            $dateToString: {
              date: "$attendance.date",
              format: "%d-%m-%Y",
              timezone: "Asia/Kolkata"
            }
          },

          check_in_time: {
            $cond: [
              { $ifNull: ["$attendance.check_in_time", false] },
              {
                $dateToString: {
                  date: "$attendance.check_in_time",
                  format: "%H:%M",
                }
              },
              null
            ]
          },

          check_out_time: {
            $cond: [
              { $ifNull: ["$attendance.check_out_time", false] },
              {
                $dateToString: {
                  date: "$attendance.check_out_time",
                  format: "%H:%M",
                }
              },
              null
            ]
          },

          totalWorkingMinutes: {
            $ifNull: ["$attendance.total_hours", 0]
          },

          totalWorked: {
            $concat: [
              {
                $toString: {
                  $floor: { $divide: ["$attendance.total_hours", 60] }
                }
              },
              "h ",
              {
                $toString: {
                  $mod: ["$attendance.total_hours", 60]
                }
              },
              "m"
            ]
          },

          status: {
            $ifNull: ["$attendance.status", "absent"]
          }
        }
      },
      { $sort: { displayDate: -1, maidName: -1 } }
    ]);

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getAttendanceListByMaid = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const now = new Date();

    // ✅ Default: current month
    let start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);

    let end = endDate ? new Date(endDate) : now;
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const data = await Maid.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
          is_active: true
        }
      },
      {
        $lookup: {
          from: "attendances",
          let: { maid_id: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$maid_id", "$$maid_id"] },
                    { $gte: ["$date", start] },
                    { $lte: ["$date", end] }
                  ]
                }
              }
            }
          ],
          as: "attendance"
        }
      },
      { $unwind: "$attendance" },
      {
        $project: {
          maidName: "$name",
          maidPhone: "$phone",
          maidEmail: "$email",
          startTime: "$start_time",
          endTime: "$end_time",
          hub: "$hub",
          date: "$attendance.date",
          displayDate: {
            $dateToString: {
              date: "$attendance.date",
              format: "%d-%m-%Y",
              timezone: "Asia/Kolkata"
            }
          },
          check_in_time: {
            $dateToString: {
              date: "$attendance.check_in_time",
              format: "%H:%M",
              // timezone: "Asia/Kolkata"
            }
          },
          check_out_time: {
            $dateToString: {
              date: "$attendance.check_out_time",
              format: "%H:%M",
              // timezone: "Asia/Kolkata"
            }
          },
          totalWorkingMinutes: "$attendance.total_hours",
          totalWorked: {
            $concat: [
              {
                $toString: {
                  $floor: { $divide: ["$attendance.total_hours", 60] }
                }
              },
              "h ",
              {
                $toString: {
                  $mod: ["$attendance.total_hours", 60]
                }
              },
              "m"
            ]
          },
          status: "$attendance.status"
        }
      },
      { $sort: { date: -1 } }
    ]);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/attendance/daily
export const getDailyAttendance = async (req: any, res: any) => {
  try {
    let { startDate, endDate } = req.query;
    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date(start);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    // const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    // // Current time
    // const now = new Date();
    // // Start date
    // let start = startDate ? new Date(startDate as string) : new Date(now);
    // // End date
    // let end = endDate ? new Date(endDate as string) : new Date(start);
    // // Convert to IST, set day boundaries, convert back to UTC
    // start = new Date(new Date(start.getTime() + IST_OFFSET).setHours(0, 0, 0, 0) - IST_OFFSET);
    // end = new Date(new Date(end.getTime() + IST_OFFSET).setHours(23, 59, 59, 999) - IST_OFFSET);

    // console.log(start.toISOString());
    // console.log(end.toISOString());

    const data = await Maid.aggregate([
      {
        $match: { is_active: true }
      },
      {
        $lookup: {
          from: "attendances",
          let: { maid_id: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$maid_id", "$$maid_id"] },
                    { $gte: ["$date", start] },
                    { $lte: ["$date", end] }
                  ]
                }
              }
            }
          ],
          as: "attendance"
        }
      },
      {
        $unwind: {
          path: "$attendance",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          maidName: "$name",
          maidPhone: "$phone",
          maidEmail: "$email",
          startTime: "$start_time",
          endTime: "$end_time",
          hub: "$hub",

          date: "$attendance.date",

          displayDate: {
            $dateToString: {
              date: "$attendance.date",
              format: "%d-%m-%Y",
              timezone: "Asia/Kolkata"
            }
          },

          check_in_time: {
            $cond: [{ $ifNull: ["$attendance.check_in_time", false] },
            {
              $dateToString: {
                date: "$attendance.check_in_time",
                format: "%H:%M",
              }
            },
              null
            ]
          },

          check_out_time: {
            $cond: [
              { $ifNull: ["$attendance.check_out_time", false] },
              {
                $dateToString: {
                  date: "$attendance.check_out_time",
                  format: "%H:%M",
                }
              },
              null
            ]
          },

          totalWorkingMinutes: {
            $ifNull: ["$attendance.total_hours", 0]
          },

          totalWorked: {
            $concat: [
              {
                $toString: {
                  $floor: { $divide: ["$attendance.total_hours", 60] }
                }
              },
              "h ",
              {
                $toString: {
                  $mod: ["$attendance.total_hours", 60]
                }
              },
              "m"
            ]
          },

          status: {
            $ifNull: ["$attendance.status", "absent"]
          }
        }
      },
      { $sort: { displayDate: -1, maidName: -1 } }
    ]);

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



