import { Request, Response, NextFunction } from 'express';
import Notification from '../models/Notification.js';

export const getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.params.id || (req as any).user!._id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const notifications = await Notification.find({ role: "admin" })
            .populate('sender', 'fullName email phone')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        const unreadCount = await Notification.countDocuments({ role: "admin", isRead: false, });

        res.status(200).json({
            success: true,
            data: notifications,
            unreadCount,
            pagination: {
                page,
                limit,
                hasMore: notifications.length === limit,
            },
        });
    } catch (error) {
        next(error);
    }
};
export const getUnReadNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.params.id || (req as any).user!._id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const notifications = await Notification.find({ role: "admin", isRead: false })
            .populate('sender', 'fullName email phone')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        const unreadCount = await Notification.countDocuments({ role: "admin", isRead: false, });

        res.status(200).json({
            success: true,
            data: notifications,
            unreadCount,
            pagination: {
                page,
                limit,
                hasMore: notifications.length === limit,
            },
        });
    } catch (error) {
        next(error);
    }
};
export const getUnReadNotificationsByMaid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.params.id || (req as any).user!.maidId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const notifications = await Notification.find({ maid_id: userId, isRead: false })
            .populate('sender', 'fullName email phone')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        const unreadCount = await Notification.countDocuments({ maid_id: userId, isRead: false, });

        res.status(200).json({
            success: true,
            data: notifications,
            unreadCount,
            pagination: {
                page,
                limit,
                hasMore: notifications.length === limit,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const notificationId = req.params.id;
        const userId = (req as any).user!._id;
        const notification = await Notification.findOne({ _id: notificationId, role: "admin", });
        if (!notification) {
            res.status(404).json({ success: false, message: 'Notification not found' });
            return;
        }
        notification.isRead = true;
        await notification.save();
        res.json({ success: true, data: notification, });
    } catch (error) {
        next(error);
    }
};
export const deleteNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const notificationId = req.params.id;
        const userId = (req as any).user!._id;
        const notification = await Notification.findByIdAndDelete({ _id: notificationId, role: "admin" });
        if (!notification) {
            res.status(404).json({ success: false, message: 'Notification not found' });
            return;
        }
        res.status(200).json({ success: true, message: "Notification Delete Successfull" });
    } catch (error) {
        next(error);
    }
};