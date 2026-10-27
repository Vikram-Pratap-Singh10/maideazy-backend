import type { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import Settings from "../models/Setting.js";

export const createSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ success: false, errors: errors.array() });
            return;
        }
        const { email, mobile, name,isCOD, fbLink, igLink, whatsappNumber, servicePricePerMinute, demoServicePricePerMinute, gstPercentage, location, version, versionCode, forceUpdate } = req.body;

        const existingSettings = await Settings.findOne();
        if (existingSettings) {
            res.status(400).json({ success: false, message: 'Settings already exist. Use update instead.' });
            return;
        }

        const settings = await Settings.create({ email, fbLink,isCOD, igLink, mobile, name, whatsappNumber, servicePricePerMinute, demoServicePricePerMinute, gstPercentage, location, version, versionCode, forceUpdate });
        res.status(201).json({ success: true, message: "Settings created successfully", data: settings });
    } catch (err) {
        console.log(err);
        next(err);
    }
};

export const getSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const settings = await Settings.findOne();
        if (!settings) {
            res.status(404).json({ success: false, message: "Settings Not Found" })
            return;
        }
        res.status(200).json({ success: true, data: settings });
    } catch (err) {
        console.log(err);
        next(err);
    }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ success: false, errors: errors.array() });
            return;
        }
        const { email, mobile, name,isCOD, fbLink, igLink, servicePricePerMinute, demoServicePricePerMinute, whatsappNumber, gstPercentage, location, version, versionCode, forceUpdate } = req.body;

        const settings = await Settings.findOneAndUpdate({}, { email, mobile, name,isCOD, whatsappNumber, fbLink, igLink, servicePricePerMinute, demoServicePricePerMinute, gstPercentage, location, version, versionCode, forceUpdate }, { new: true, upsert: true });
        res.status(200).json({ success: true, message: "Settings updated successfully", data: settings });
    } catch (err) {
        console.log(err);
        next(err);
    }
};
export const updateBookingLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.body.bookingLimit) {
            res.status(400).json({ success: false, errors: 'Booking Limit is required' });
            return;
        }
        const settings = await Settings.findOneAndUpdate({}, { bookingPerSlot: req.body.bookingLimit,bookingPerUserSlot:req.body.bookingPerUserSlot }, { new: true, upsert: true });
        res.status(200).json({ success: true, message: "Settings updated successfully", data: settings });
    } catch (err) {
        console.log(err);
        next(err);
    }
};
export const updateStartEndTime = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.body.start_time && !req.body.end_time) {
            res.status(400).json({ success: false, errors: 'Start and End Time are required' });
            return;
        }
        const settings = await Settings.findOneAndUpdate({}, { start_time: req.body.start_time, end_time: req.body.end_time }, { new: true, upsert: true });
        res.status(200).json({ success: true, message: "Settings updated successfully", data: settings });
    } catch (err) {
        console.log(err);
        next(err);
    }
};
export const newOfferOnOrOff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const settings = await Settings.findOne();
        if (!settings) {
            res.status(404).json({ success: false, message: "Settings Not Found" })
            return;
        }
        if (settings.isNewOffer) {
            settings.isNewOffer = false
        } else {
            settings.isNewOffer = true
        }
        await settings.save();
        res.status(200).json({ success: true, data: settings });

    } catch (err) {
        console.log(err);
        next(err);
    }
}