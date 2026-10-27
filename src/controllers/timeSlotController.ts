import { Request, Response } from 'express';
import TimeSlot from '../models/TimeSlot.js';
import Maid from '../models/Maid.js';
import Setting from '../models/Setting.js';
import TimeSlotDateOverride from '../models/TimeSlotDateOverride.js';

interface AuthRequest extends Request {
  user?: any;
}

// Get all active time slots
export const getAllTimeSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const timeSlots = await TimeSlot.find({ isActive: true });
    res.json({ success: true, data: timeSlots });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get time slot by ID
export const getTimeSlotById = async (req: Request, res: Response): Promise<void> => {
  try {
    const slotId = req.params.slotId;
    const timeSlot = await TimeSlot.findById(slotId);
    if (!timeSlot) {
      res.status(404).json({ success: false, message: 'Time slot not found' });
      return;
    }
    const response = {
      _id: timeSlot._id,
      label: timeSlot.label,
      times: Array.isArray(timeSlot.time)
        ? timeSlot.time
          .filter((t: any) => t.isActive === true)
          .map((t: any) => t.timeSlot)
        : [],
      isActive: timeSlot.isActive,
    };
    res.status(200).json({ success: true, data: response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get time slot by label
export const getTimeSlotByLabel = async (req: Request, res: Response): Promise<void> => {
  try {
    const label = req.params.label;
    const timeSlot = await TimeSlot.findOne({ label, isActive: true });
    if (!timeSlot) {
      res.status(404).json({ success: false, message: 'Time slot not found for this time period' });
      return;
    }
    const response = {
      _id: timeSlot._id,
      label: timeSlot.label,
      times: Array.isArray(timeSlot.time)
        ? timeSlot.time
          .filter((t: any) => t.isActive === true)
          .map((t: any) => t.timeSlot)
        : [],
      isActive: timeSlot.isActive,
    };
    res.status(200).json({ success: true, data: response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Create new time slot (Admin only)
export const createTimeSlot = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const slotData = req.body;
    const exitingSlot = await TimeSlot.findOne({ isActive: true, label: slotData.label });
    if (exitingSlot) {
      res.status(400).json({ success: false, message: 'this time period already exists' });
      return
    }
    const timeSlot = await TimeSlot.create(slotData);
    return res.status(201).json({ success: true, data: timeSlot });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error creating time slot' });
  }
};


/* ============================
   Time helper
============================ */
const timeToMinutes = (time: string): number => {
  const parts = time.trim().toUpperCase().split(" ");

  if (!parts[0] || !parts[1]) {
    throw new Error(`Invalid time format: ${time}`);
  }

  const timePart: string = parts[0];
  const modifier: string = parts[1];

  const timeParts = timePart.split(":");

  if (!timeParts[0] || !timeParts[1]) {
    throw new Error(`Invalid time format: ${time}`);
  }

  let hours = Number(timeParts[0]);
  const minutes = Number(timeParts[1]);

  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
};



/* ============================
   Types
============================ */
interface IMaidRange {
  start: number;
  end: number;
}

interface ITimeItem {
  timeSlot: string;
  isActive: boolean;
}

interface ITimeSlotDoc {
  _id: string;
  label: string;
  time: ITimeItem[];
  isActive: boolean;
}
// Get time slots considering maid availability only User access
export const getTimeSlots1 = async (req: Request, res: Response): Promise<Response> => {
  try {
    /* 1️⃣ Maid availability */
    const availableMaids = await Maid.find({ is_active: true })
      .select("start_time end_time")
      .lean<{ start_time: string; end_time: string }[]>();

    const maidRanges: IMaidRange[] = availableMaids
      .filter(m => m.start_time && m.end_time)
      .map(m => ({
        start: timeToMinutes(m.start_time),
        end: timeToMinutes(m.end_time),
      }));

    /* 2️⃣ Time slots */
    const slots = await TimeSlot.find({ isActive: true }).lean<ITimeSlotDoc[]>();

    const response = slots.map(slot => ({
      _id: slot._id,
      label: slot.label,
      isActive: slot.isActive,
      times: Array.isArray(slot.time)
        ? slot.time
          .filter(t => t.isActive)
          .filter(t => {
            const slotMinutes = timeToMinutes(t.timeSlot);

            // ✅ Check inside any maid range
            return maidRanges.some(
              range =>
                slotMinutes >= range.start &&
                slotMinutes < range.end
            );
          })
          .map(t => t.timeSlot)
        : [],
    }));

    return res.status(200).json({ success: true, data: response, });

  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Server Error",
    });
  }
};
// latest update
export const getTimeSlots2 = async (req: Request, res: Response): Promise<Response> => {
  try {

    const { date } = req.query;
    console.log("time slots date coming" + date)
    /*  Get global time range */
    const setting = await Setting.findOne().select("start_time end_time").lean<{
      start_time: string;
      end_time: string;
    }>();

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: "Setting not found",
      });
    }

    const startMinutes = timeToMinutes(setting.start_time);
    const endMinutes = timeToMinutes(setting.end_time);

    /* Get time slots */
    const slots = await TimeSlot.find({ isActive: true }).lean<ITimeSlotDoc[]>();


    /* Check if all slots closed for this date */
    let closeAllSlots = false;

    if (date) {
      const closeAll = await TimeSlotDateOverride.findOne({
        date: new Date(date as string),
        closeAllSlots: true
      }).lean();

      if (closeAll) {
        closeAllSlots = true;
      }
    }


    /* Get overrides for selected date */
    let overrides: any[] = [];

    if (date && !closeAllSlots) {
      overrides = await TimeSlotDateOverride.find({
        date: new Date(date as string),
        closeAllSlots: { $ne: true }
      }).lean();
    }

    /* Convert override slots to map */
    const overrideMap = new Map(
      overrides.map(o => [o.timeSlot, o.isActive])
    );


    /*Build response */
    const response = slots.map(slot => ({

      _id: slot._id,
      label: slot.label,
      isActive: slot.isActive,

      times: closeAllSlots
        ? [] // all slots closed
        : Array.isArray(slot.time)
          ? slot.time
            .filter(t => {

              const slotMinutes = timeToMinutes(t.timeSlot);

              /* check global setting range */
              if (slotMinutes < startMinutes || slotMinutes >= endMinutes) {
                return false;
              }

              /* check default slot active */
              if (!t.isActive) return false;

              /* check override */
              if (overrideMap.has(t.timeSlot)) {
                return overrideMap.get(t.timeSlot);
              }

              return true;
            })
            .map(t => t.timeSlot)
          : [],
    }));


    return res.status(200).json({ success: true, data: response, });

  } catch (error: unknown) {
    console.log(error);
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Server Error", });

  }
};
// latest update with pincode
export const getTimeSlots11 = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { date, pincode } = req.query;

    /* 1. Get global time range */
    const setting = await Setting.findOne().select("start_time end_time").lean<{
      start_time: string;
      end_time: string;
    }>();

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: "Setting not found",
      });
    }

    const startMinutes = timeToMinutes(setting.start_time);
    const endMinutes = timeToMinutes(setting.end_time);

    // let startOfDay: Date | null = null;
    // let endOfDay: Date | null = null;

    // if (date) {
    //   startOfDay = new Date(date as string);
    //   startOfDay.setUTCHours(0, 0, 0, 0);

    //   endOfDay = new Date(date as string);
    //   endOfDay.setUTCHours(23, 59, 59, 999);
    // }
    /* ✅ Default to current date if not provided */
    const selectedDate = date ? new Date(date as string) : new Date();

    const startOfDay = new Date(selectedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(selectedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    /* 2. Get all slots */
    const slots = await TimeSlot.find({ isActive: true }).lean<ITimeSlotDoc[]>();

    /* 3. Check closeAllSlots (priority wise) */
    let closeAllSlots = false;

    if (date || pincode) {
      const closeAll = await TimeSlotDateOverride.findOne({
        $or: [
          { date: { $gte: startOfDay, $lte: endOfDay }, pincode },

          { date: { $gte: startOfDay, $lte: endOfDay }, pincode: { $in: [null, undefined] } },

          { pincode, date: { $in: [null, undefined] } }
        ],
        closeAllSlots: true
      }).lean();

      if (closeAll) closeAllSlots = true;
    }

    /* 4. Get overrides */
    let overrides: any[] = [];

    if (!closeAllSlots && (date || pincode)) {
      overrides = await TimeSlotDateOverride.find({
        closeAllSlots: { $ne: true },
        $or: [
          { date: { $gte: startOfDay, $lte: endOfDay }, pincode },

          { date: { $gte: startOfDay, $lte: endOfDay }, pincode: { $in: [null, undefined] } },

          { pincode, date: { $in: [null, undefined] } }
        ]
      }).lean();
    }

    /* 5. Build override map with priority */
    const overrideMap = new Map<string, boolean>();

    overrides.forEach(o => {
      const key = o.timeSlot;

      // assign priority score
      let priority = 1;
      if (o.date && o.pincode) priority = 3;
      else if (o.pincode) priority = 2;
      else if (o.date) priority = 1;

      // store with priority
      if (!overrideMap.has(key)) {
        overrideMap.set(key, o.isActive);
      } else {
        // override based on higher priority
        const existing = overrides.find(x => x.timeSlot === key);
        let existingPriority = 1;
        if (existing?.date && existing?.pincode) existingPriority = 3;
        else if (existing?.date) existingPriority = 2;
        else if (existing?.pincode) existingPriority = 1;

        if (priority > existingPriority) {
          overrideMap.set(key, o.isActive);
        }
      }
    });

    /* 6. Build response */
    const response = slots.map(slot => ({
      _id: slot._id,
      label: slot.label,
      isActive: slot.isActive,

      times: closeAllSlots
        ? []
        : Array.isArray(slot.time)
          ? slot.time
            .filter(t => {
              const slotMinutes = timeToMinutes(t.timeSlot);

              /* global time check */
              if (slotMinutes < startMinutes || slotMinutes >= endMinutes) {
                return false;
              }

              /* default slot active */
              if (!t.isActive) return false;

              /* override check */
              if (overrideMap.has(t.timeSlot)) {
                return overrideMap.get(t.timeSlot);
              }

              return true;
            })
            .map(t => t.timeSlot)
          : [],
    }));

    return res.status(200).json({ success: true, data: response, });

  } catch (error: unknown) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Server Error",
    });
  }
};
export const getTimeSlots = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { date, pincode } = req.query;
    // console.log("timeslots date coming:", date, "pincode:", pincode);
    /* 1. Get global time range */
    const setting = await Setting.findOne().select("start_time end_time").lean<{
      start_time: string;
      end_time: string;
    }>();

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: "Setting not found",
      });
    }

    const startMinutes = timeToMinutes(setting.start_time);
    const endMinutes = timeToMinutes(setting.end_time);

    /* ✅ Default to current date if not provided */
    const selectedDate = date ? new Date(date as string) : new Date();

    const startOfDay = new Date(selectedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(selectedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    /* 2. Get all slots */
    const slots = await TimeSlot.find({ isActive: true }).lean<ITimeSlotDoc[]>();

    /* 3. Check closeAllSlots (priority wise) */
    let closeAllSlots = false;

    const closeAll = await TimeSlotDateOverride.findOne({
      closeAllSlots: true,
      $or: [
        // date + pincode
        ...(pincode ? [{
          date: { $gte: startOfDay, $lte: endOfDay },
          pincode
        }] : []),

        // date only (global for that date)
        {
          date: { $gte: startOfDay, $lte: endOfDay },
          pincode: null
        },

        // pincode only
        ...(pincode ? [{
          pincode,
          date: null
        }] : []),

        // global fallback (no date, no pincode)
        {
          date: null,
          pincode: null
        }
      ]
    }).lean();

    if (closeAll) closeAllSlots = true;

    /* 4. Get overrides */
    let overrides: any[] = [];

    if (!closeAllSlots) {
      overrides = await TimeSlotDateOverride.find({
        closeAllSlots: { $ne: true },
        $or: [
          ...(pincode ? [{
            date: { $gte: startOfDay, $lte: endOfDay },
            pincode
          }] : []),

          {
            date: { $gte: startOfDay, $lte: endOfDay },
            pincode: null
          },

          ...(pincode ? [{
            pincode,
            date: null
          }] : []),

          {
            date: null,
            pincode: null
          }
        ]
      }).lean();
    }

    /* 5. Build override map with priority */
    const overrideMap = new Map<string, boolean>();

    overrides.forEach(o => {
      const key = o.timeSlot;

      // assign priority score
      let priority = 1;
      if (o.date && o.pincode) priority = 3;
      else if (o.pincode) priority = 2;
      else if (o.date) priority = 1;

      // store with priority
      if (!overrideMap.has(key)) {
        overrideMap.set(key, o.isActive);
      } else {
        // override based on higher priority
        const existing = overrides.find(x => x.timeSlot === key);
        let existingPriority = 1;
        if (existing?.date && existing?.pincode) existingPriority = 3;
        else if (existing?.date) existingPriority = 2;
        else if (existing?.pincode) existingPriority = 1;

        if (priority > existingPriority) {
          overrideMap.set(key, o.isActive);
        }
      }
    });

    //
    // const BLOCKED_SLOT = "08:00 PM";

    // const filteredSlots = slots.map(slot => ({
    //   ...slot,
    //   time: slot.time?.filter(t => t.timeSlot !== BLOCKED_SLOT)
    // }));

    /* 6. Build response */
    const response = slots.map(slot => ({
      _id: slot._id,
      label: slot.label,
      isActive: slot.isActive,

      times: closeAllSlots
        ? []
        : Array.isArray(slot.time)
          ? slot.time
            .filter(t => {
              const slotMinutes = timeToMinutes(t.timeSlot);

              /* global time check */
              if (slotMinutes < startMinutes || slotMinutes >= endMinutes) {
                return false;
              }

              /* default slot active */
              if (!t.isActive) return false;

              /* override check */
              if (overrideMap.has(t.timeSlot)) {
                return overrideMap.get(t.timeSlot);
              }

              return true;
            })
            .map(t => t.timeSlot)
          : [],
    }));

    return res.status(200).json({ success: true, data: response, });

  } catch (error: unknown) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Server Error",
    });
  }
};

// Not Using
export const getTimeSlotsq = async (req: Request, res: Response) => {
  try {
    const data = await TimeSlot.find({ isActive: false }).lean();

    const response = data.map(item => ({
      _id: item._id,
      label: item.label,
      times: Array.isArray(item.time)
        ? item.time
          .filter((t: any) => t.isActive === true)
          .map((t: any) => t.timeSlot)
        : [],
      isActive: item.isActive,
    }));

    return res.status(200).json({ success: true, data: response });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
// Get All TimeSlots Admin only
export const getTimeSlotss = async (req: Request, res: Response) => {
  try {
    const data = await TimeSlot.find().lean();

    return res.status(200).json({ success: true, data: data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
// Update TimeSlot Status (Admin only)
export const updateTimeSlotStatus = async (req: Request, res: Response) => {
  try {
    const { timeSlotId, slotId, status } = req.body;

    if (!timeSlotId || !slotId || typeof status !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "timeSlotId, slotId and status are required"
      });
    }

    const updated = await TimeSlot.findOneAndUpdate(
      {
        _id: slotId,
        "time._id": timeSlotId
      },
      {
        $set: {
          "time.$.isActive": status
        }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Time slot not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Time slot status updated successfully",
      data: updated
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update time slot (Admin only)
export const updateTimeSlot = async (req: Request, res: Response): Promise<void> => {
  try {
    const slotId = req.params.slotId;
    const updates = req.body;

    const timeSlot = await TimeSlot.findByIdAndUpdate(slotId, updates, { new: true });
    if (!timeSlot) {
      res.status(404).json({ success: false, message: 'Time slot not found' });
      return;
    }

    res.json({ success: true, data: timeSlot });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error updating time slot' });
  }
};

// Delete time slot (Admin only - soft delete by setting isActive to false)
export const deleteTimeSlot = async (req: Request, res: Response): Promise<void> => {
  try {
    const slotId = req.params.slotId;

    const timeSlot = await TimeSlot.findByIdAndUpdate(slotId, { isActive: false }, { new: true });

    if (!timeSlot) {
      res.status(404).json({ success: false, message: 'Time slot not found' });
      return;
    }

    res.json({ success: true, message: 'Time slot deactivated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error deleting time slot' });
  }
};

// Toggle All Time Slots (Close if open, Open if closed)
export const toggleTimeSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if any active time slot exists
    const activeSlot = await TimeSlot.findOne({ isActive: true });

    // If any slot is active → CLOSE all
    if (activeSlot) {
      await TimeSlot.updateMany(
        { isActive: true },
        { $set: { isActive: false } }
      );

      res.status(200).json({
        success: true,
        action: 'closed',
        message: 'All time slots closed successfully',
      });
      return;
    }

    // If no active slot → OPEN all
    await TimeSlot.updateMany(
      { isActive: false },
      { $set: { isActive: true } }
    );

    res.status(200).json({
      success: true,
      action: 'opened',
      message: 'All time slots opened successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error while toggling time slots',
    });
  }
};