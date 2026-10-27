import { Request, Response, NextFunction } from "express";
import TimeSlotDateOverride from "../models/TimeSlotDateOverride.js";


export const createTimeSlotOverride = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { date, pincode, timeSlotId, timeSlot, isActive } = req.body;

         const query: any = { timeSlotId, timeSlot };

        if (date && pincode) {
            // both date + pincode
            query.date = date;
            query.pincode = pincode;

        } else if (date) {
            // date only (no pincode)
            query.date = date;
            query.pincode = { $in: [null, undefined] };

        } else if (pincode) {
            // pincode only (no date)
            query.pincode = pincode;
            query.date = { $in: [null, undefined] };
        }
        const existing = await TimeSlotDateOverride.findOne(query);
        if (existing) {
            return res.status(400).json({ success: false, message: "Override already exists for this slot" });
        }

        const override = await TimeSlotDateOverride.create({ date, pincode, timeSlotId, timeSlot, isActive });

        res.status(201).json({ success: true, data: override });
    } catch (error) {
        next(error);
    }
};

export const updateTimeSlotOverride = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const override = await TimeSlotDateOverride.findByIdAndUpdate(id, { isActive }, { new: true });

        if (!override) {
            return res.status(404).json({ success: false, message: "Override not found" });
        }
        res.json({ success: true, data: override });
    } catch (error) {
        next(error);
    }
};


export const getTimeSlotOverridesByDate = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
        const { date, pincode } = req.query;
        const where: any = {};
        if (date) {
            where.date = new Date(date as string);
        }
        if (pincode) {
            where.pincode = pincode;
        }
        const overrides = await TimeSlotDateOverride.find(where).sort({ createdAt: -1 }).lean();
        return res.status(200).json({ success: true, data: overrides });
    } catch (error) {
        next(error);
    }
};

export const closeAllSlotsForDate = async (req: Request, res: Response): Promise<any> => {
    try {
        const { date, pincode } = req.body;
        const existing = await TimeSlotDateOverride.findOne({ date: new Date(date), pincode: pincode, closeAllSlots: true });
        if (existing) {
            return res.status(400).json({ success: false, message: "Slots already closed for this date" });
        }
        const record = await TimeSlotDateOverride.create({ date: new Date(date), closeAllSlots: true });
        res.status(200).json({ success: true, message: "All slots closed for this date", data: record });
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: "Server error" });

    }
};
export const toggleAllSlotsForDate = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { date, pincode, } = req.body;
        if (!date) {
            return res.status(400).json({ success: false, message: "Date is required" });
        }
        const parsedDate = new Date(date);
        const existing = await TimeSlotDateOverride.findOne({ date: parsedDate, pincode: pincode, closeAllSlots: true });
        if (existing) {
            await TimeSlotDateOverride.deleteOne({ _id: existing._id });
            return res.status(200).json({
                success: true, message: "All slots opened for this date",
                data: {
                    date: parsedDate,
                    closeAllSlots: false
                }
            });
        }
        const record = await TimeSlotDateOverride.create({ date: parsedDate, pincode: pincode, closeAllSlots: true });
        return res.status(200).json({ success: true, message: "All slots closed for this date", data: record });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Server error" });

    }
};

export const deleteTimeSlotOverride = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { id } = req.params;

        const override = await TimeSlotDateOverride.findByIdAndDelete(id);
        if (!override) {
            return res.status(404).json({ success: false, message: "Override not found" });
        }
        res.json({ success: true, message: "Override deleted successfully" });
    } catch (error) {
        next(error);
    }
};