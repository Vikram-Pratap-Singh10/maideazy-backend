import type { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import cloudinary from "../middleware/cloudinary.js";
import Banner from "../models/Banner.js";


interface MulterFile extends Express.Multer.File {
    buffer: Buffer;
}

export const createBanner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ success: false, errors: errors.array() });
            return;
        }
        req.body.createdBy = (req as any).user._id;
        const file = req.file as MulterFile;
        if (file) {
            const imageUrl: string = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: "maideazy/banners" },
                    (error, result) => {
                        if (error) return reject(error);
                        if (result) return resolve(result.secure_url);
                        reject(new Error("Upload failed"));
                    }
                );
                uploadStream.end(file.buffer);
            });
            req.body.image = imageUrl;
        }
        const { title, subtitle, description, image, redirectUrl, startDate, endDate, isActive, position, bannerType, createdBy } = req.body;

        const banner = await Banner.create({ title, subtitle, description, image, redirectUrl, startDate, endDate, isActive, position, bannerType, createdBy });
        res.status(201).json({ success: true, message: "Banner created successfully", data: banner });
    } catch (err) {
        console.log(err);
        next(err);
    }
};

export const getAllBanners = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const banners = await Banner.find({ isActive: true });
        if (banners.length === 0) {
            res.status(404).json({ success: false,data:[], message: "Banners Not Found" })
            return;
        }
        res.status(200).json({ success: true, data: banners });
    } catch (err) {
        console.log(err);
        next(err);
    }
};

export const getBannerById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const banner = await Banner.findById(id);
        if (!banner) {
            res.status(404).json({ success: false, message: 'Banner not found' });
            return;
        }
        res.status(200).json({ success: true, data: banner });
    } catch (err) {
        console.log(err);
        next(err);
    }
};

export const updateBanner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ success: false, errors: errors.array() });
            return;
        }
        const file = req.file as MulterFile;
        if (file) {
            const imageUrl: string = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: "maideazy/banners" },
                    (error, result) => {
                        if (error) return reject(error);
                        if (result) return resolve(result.secure_url);
                        reject(new Error("Upload failed"));
                    }
                );
                uploadStream.end(file.buffer);
            });
            req.body.image = imageUrl;
        }
        const { id } = req.params;
        const { title, subtitle, description, image, redirectUrl, startDate, endDate, isActive, position, bannerType, createdBy } = req.body;

        const banner = await Banner.findByIdAndUpdate(id, { title, subtitle, description, image, redirectUrl, startDate, endDate, isActive, position, bannerType, createdBy }, { new: true });
        if (!banner) {
            res.status(404).json({ success: false, message: 'Banner not found' });
            return;
        }
        res.status(200).json({ success: true, message: "Banner updated successfully", data: banner });
    } catch (err) {
        console.log(err);
        next(err);
    }
};

export const deleteBanner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const banner = await Banner.findByIdAndUpdate(id, { isActive: false }, { new: true });
        if (!banner) {
            res.status(404).json({ success: false, message: 'Banner not found' });
            return;
        }
        res.status(200).json({ success: true, message: "Banner deleted successfully" });
    } catch (err) {
        console.log(err);
        next(err);
    }
};