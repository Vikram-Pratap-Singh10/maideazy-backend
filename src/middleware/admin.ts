import { Request, Response, NextFunction } from 'express';
import User from '../models/User.js';

export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    const user = await User.findById(userId).select('role');
    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }
    if (user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Admin access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const requireUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user._id;

    const user = await User.findById(userId).select('role');
    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    if (user.role !== 'user') {
      res.status(403).json({ success: false, message: 'User access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('User middleware error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};