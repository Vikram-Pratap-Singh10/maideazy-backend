import { Request, Response } from 'express';
import Maid from '../models/Maid.js';

// Get availability for a specific maid
export const getMaidAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const maidId = req.params.maidId;
    const availability = await Maid.findById(maidId).select('name email phone start_time end_time working_status is_active')
    res.status(200).json({ success: true, data: availability });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Create availability slot for a maid (Maid/Admin only)
export const createAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { maidId } = req.params;
    const { start_time, end_time } = req.body;
    const availability = await Maid.findByIdAndUpdate(maidId, { start_time, end_time, is_booked: false });
    res.status(201).json({ success: true, data: availability });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error creating availability' });
  }
};

// Update availability slot (Maid/Admin only)
export const updateAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { maidId } = req.params;
    const updates = req.body;
    const availability = await Maid.findByIdAndUpdate(maidId, updates, { new: true });
    if (!availability) {
      res.status(404).json({ success: false, message: 'Maid not found' });
      return;
    }
    res.status(200).json({ success: true, data: availability });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error updating' });
  }
};

// Delete availability slot (Maid/Admin only)
export const deleteAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { availabilityId } = req.params;
    const availability = await Maid.findByIdAndUpdate(availabilityId, { working_status: false }, { new: true });
    if (!availability) {
      res.status(404).json({ success: false, message: 'Availability not found' });
      return;
    }
    res.json({ success: true, message: 'Availability deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error deleting availability' });
  }
};

// Get all availability slots (Admin only)
export const getAllAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const availability = await Maid.find({ is_active: true }).select('name email phone start_time end_time working_status is_booked is_active')
    // .select('start_time end_time is_booked status')
    res.status(200).json({ success: true, data: availability });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};