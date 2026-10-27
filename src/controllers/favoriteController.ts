import { NextFunction, Request, RequestHandler, Response } from "express";
import Favorites from "../models/Favorites.js";
import Booking from "../models/Booking.js"
import MaidAvailability from "../models/MaidAvailability.js";


export const addFavoriteMaid = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const userId = (req as any).user._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized User" })
        const { maid_id } = req.body;
        if (!maid_id) return res.status(400).json({ success: false, message: "Maid is Required" })
        const favorite = await Favorites.findOne({ user_id: userId, maid_id: maid_id })
        if (favorite) {
            return res.status(400).json({ success: false, message: "Already Add In Your Favorite" })
        }
        const newFavorite = await Favorites.create({ user_id: userId, maid_id: maid_id })
        return res.status(200).json({ success: true, message: "Add Successful" })
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
        return;
    }
}

export const removeFavoriteMaid = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const userId = (req as any).user._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized User" })
        const { maid_id } = req.body;
        if (!maid_id) return res.status(400).json({ success: false, message: "Maid is Required" })
        const favorite = await Favorites.findOneAndDelete({ user_id: userId, maid_id: maid_id })
        if (!favorite) {
            return res.status(404).json({ success: false, message: "Maid Not Found" })
        }
        return res.status(200).json({ success: true, message: "Delete Successful" })
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
        return;
    }
}

export const getFavoriteMaid = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const userId = (req as any).user._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized User" })
        const favorite = await Favorites.find({ user_id: userId }).select("-user_id").populate("maid_id")
        if (favorite.length === 0) {
            return res.status(404).json({ success: false, message: "Not Found" })
        }
        return res.status(200).json({ success: true, data: favorite })
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
        return;
    }
}

export const getFavoriteMaidByUserId = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { id } = req.params;
        const favorites = await Favorites.find({ user_id: id })
            .select("-user_id")
            .populate("maid_id");

        if (favorites.length === 0) {
            return res.status(404).json({ success: false, message: "Not Found" });
        }
        const available = await MaidAvailability.find().select("maid_id start_time end_time is_booked status");

        // Create final response
        const responseData = await Promise.all(

            favorites.map(async (fav: any) => {
                const maid = fav.maid_id;  // populated document
                const availability = available.find((item: any) => item.maid_id.toString() === maid._id.toString());
                const bookingCount = await Booking.countDocuments({ maid_id: maid._id });
                return {
                    bookingCount,
                    _id: maid._id,
                    name: maid.name,
                    email: maid.email,
                    phone: maid.phone,
                    address: maid.address,
                    age: maid.age,
                    work_type: maid.work_type,
                    languages: maid.languages,
                    skill: maid.skill,
                    experience_years: maid.experience_years,
                    hourly_rate: maid.hourly_rate,
                    rating: maid.rating,
                    total_reviews: maid.total_reviews,
                    profile_image: maid.profile_image,
                    bio: maid.bio,
                    is_active: maid.is_active,
                    createdAt: maid.createdAt,
                    updatedAt: maid.updatedAt,
                    marital_status: maid.marital_status,
                    is_booked: maid.is_booked,
                    working_status: maid.working_status,
                    availability: availability || null,
                };
            })
        );
        return res.status(200).json({ success: true, data: responseData });

    } catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


export const getFavoriteMaidByMaidId = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const userId = (req as any).user._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized User" })
        const favorite = await Favorites.findOne({ user_id: userId, maid_id: req.params.maidId }).select("-user_id").populate("maid_id")
        if (!favorite) {
            return res.status(200).json({ success: false, status: false, message: "Not Found" })
        }
        return res.status(200).json({ success: true, status: true, data: favorite })
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
        return;
    }
}