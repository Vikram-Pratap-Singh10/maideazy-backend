import { Request, Response, NextFunction } from "express";
import ServicePriceOverride from "../models/ServicePriceOverride.js";

export const createServiceOverride1 = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { serviceId, date, servicePricePerMinute, pincode, demoServicePricePerMinute } = req.body;

        const existing = await ServicePriceOverride.findOne({ serviceId, date });
        if (existing) {
            return res.status(400).json({ success: false, message: "Override already exists for this service on this date" });
        }
        const override = await ServicePriceOverride.create({ serviceId, date, pincode, servicePricePerMinute, demoServicePricePerMinute });
        res.status(201).json({ success: true, data: override });
    } catch (error) {
        next(error);
    }
};
export const createServiceOverride = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { serviceId, date, servicePricePerMinute, pincode, demoServicePricePerMinute } = req.body;

        let selectedDate: Date | null = null;

        // if (date) {
        //   selectedDate = new Date(date);
        //   selectedDate.setUTCHours(0, 0, 0, 0); // ✅ important
        // }

        // ✅ Build dynamic query
        const query: any = { serviceId };

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

        const existing = await ServicePriceOverride.findOne(query);

        if (existing) {
            return res.status(400).json({ success: false, message: "Override already exists for given condition" });
        }

        const override = await ServicePriceOverride.create({
            serviceId,
            date,
            pincode,
            servicePricePerMinute,
            demoServicePricePerMinute
        });

        res.status(201).json({ success: true, data: override });

    } catch (error) {
        next(error);
    }
};

export const updateServiceOverride = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { id } = req.params;
        const override = await ServicePriceOverride.findByIdAndUpdate(id, req.body, { new: true });
        if (!override) {
            return res.status(404).json({ success: false, message: "Override not found" });
        }
        res.status(200).json({ success: true, data: override });
    } catch (error) {
        next(error);
    }
};

export const getServiceOverridesByDate = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { date, pincode } = req.query;
        const where: any = {};
        if (date) {
            where.date = new Date(date as string);
        }
        if (pincode) {
            where.pincode = pincode;
        }
        const overrides = await ServicePriceOverride.find(where);
        res.status(200).json({ success: true, data: overrides });
    } catch (error) {
        next(error);
    }
};

export const deleteServiceOverride = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { id } = req.params;
        const override = await ServicePriceOverride.findByIdAndDelete(id);
        if (!override) {
            return res.status(404).json({ success: false, message: "Override not found" });
        }
        res.status(200).json({ success: true, message: "Override deleted successfully" });
    } catch (error) {
        next(error);
    }
};