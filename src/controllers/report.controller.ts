import { Request, Response, NextFunction } from 'express';
import Reports from '../models/Reports.js';
import Maid from '../models/Maid.js';
import Block from '../models/Block.js';

export const reportMaid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { maid_id, reason, details } = req.body;
        const reporterId = (req as any).user!._id;

        if (reporterId.toString() === maid_id) {
            res.status(400).json({ success: false, message: 'Cannot report yourself', });
            return;
        }

        const reportedUser = await Maid.findById(maid_id);
        if (!reportedUser) {
            res.status(400).json({ success: false, message: 'User Not Found', });
            return;
        }
        await Reports.create({ user_id: reporterId, maid_id: maid_id, reason, details, });
        reportedUser.reportedCount += 1;
        await reportedUser.save();
        res.status(201).json({ success: true, message: 'Report submitted successfully', });
    } catch (error) {
        next(error);
    }
};
// Get all reported maids (Admin only)
export const getReportMaids = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const report = await Reports.find()
            .populate('user_id', 'name email phone')
            .populate('maid_id', 'name email phone reportedCount');
        res.status(200).json({ success: true, data: report, });
    } catch (error) {
        next(error);
    }
};

export const blockMaid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const maid_id = req.params.maid_id;
        const blockerId = (req as any).user!._id;
        if (blockerId.toString() === maid_id) {
            res.status(400).json({ success: false, message: 'Cannot block yourself', });
            return;
        }
        const blockedUser = await Maid.findById(maid_id);
        if (!blockedUser) {
            res.status(400).json({ success: false, message: 'Maid Not Found', });
            return;
        }
        const existingBlock = await Block.findOne({ user_id: blockerId, maid_id: maid_id, });
        if (existingBlock) {
            res.status(400).json({ success: false, message: 'Maid is already blocked', });
            return;
        }
        await Block.create({ user_id: blockerId, maid_id: maid_id, });
        res.status(201).json({ success: true, message: 'Maid blocked successfully', });
    } catch (error) {
        next(error);
    }
};
export const unblockMaid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const maid_id = req.params.maid_id;
        const blockerId = (req as any).user!._id;

        const block = await Block.findOne({ user_id: blockerId, maid_id: maid_id, });
        if (!block) {
            res.status(404).json({ success: false, message: 'Block record not found', });
            return;
        }
        await Block.deleteOne({ _id: block._id });
        res.json({ success: true, message: 'Maid unblocked successfully', });

    } catch (error) {
        next(error);
    }
};
export const getBlockMaids = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const blockMaid = await Block.find()
            .populate('user_id', 'name email phone')
            .populate('maid_id', 'name email phone reportedCount');
        res.status(200).json({ success: true, data: blockMaid, });
    } catch (error) {
        next(error);
    }
};
export const getBlockMaidByUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const blockMaid = await Block.find({ user_id: req.params.userId }).populate('maid_id');
        res.status(200).json({ success: true, data: blockMaid, });
    } catch (error) {
        next(error);
    }
};
