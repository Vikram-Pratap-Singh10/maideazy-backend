import { Request, Response } from 'express';
import ArrivalConfig, { IArrivalConfig } from '../models/ArrivalConfig.js';
import { validationResult } from 'express-validator';

interface AuthRequest extends Request {
  user?: any;
}

// Get all active arrival configs
export const getAllArrivalConfigs = async (req: Request, res: Response): Promise<void> => {
  try {
    const arrivalConfigs = await ArrivalConfig.find({ isActive: true })
    res.json({ success: true, data: arrivalConfigs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get arrival config by ID
export const getArrivalConfigById = async (req: Request, res: Response): Promise<void> => {
  try {
    const configId = req.params.configId;
    const arrivalConfig = await ArrivalConfig.findById(configId)
    if (!arrivalConfig) {
      res.status(404).json({ success: false, message: 'Arrival config not found' });
      return;
    }
    res.json({ success: true, data: arrivalConfig });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get arrival config by season
export const getArrivalConfigBySeason = async (req: Request, res: Response): Promise<void> => {
  try {
    const season = req.params.season;
    const arrivalConfig = await ArrivalConfig.findOne({ season, isActive: true })
    if (!arrivalConfig) {
      res.status(404).json({ success: false, message: 'Arrival config not found for this season' });
      return;
    }
    res.json({ success: true, data: arrivalConfig });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Create new arrival config (Admin only)
export const createArrivalConfig = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const configData = req.body;
    // Add createdBy from authenticated user (assuming admin middleware sets req.user)
    configData.createdBy = req.user?.id || req.body.createdBy;

    const arrivalConfig = await ArrivalConfig.create(configData);
    return res.status(201).json({ success: true, data: arrivalConfig });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error creating arrival config' });
  }
};

// Update arrival config (Admin only)
export const updateArrivalConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const configId = req.params.configId;
    const updates = req.body;

    const arrivalConfig = await ArrivalConfig.findByIdAndUpdate(configId, updates, { new: true })
    if (!arrivalConfig) {
      res.status(404).json({ success: false, message: 'Arrival config not found' });
      return;
    }

    res.json({ success: true, data: arrivalConfig });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error updating arrival config' });
  }
};

// Delete arrival config (Admin only - soft delete by setting isActive to false)
export const deleteArrivalConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const configId = req.params.configId;

    const arrivalConfig = await ArrivalConfig.findByIdAndUpdate(
      configId,
      { isActive: false },
      { new: true }
    );

    if (!arrivalConfig) {
      res.status(404).json({ success: false, message: 'Arrival config not found' });
      return;
    }

    res.json({ success: true, message: 'Arrival config deactivated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error deleting arrival config' });
  }
};

// Get current active arrival config based on season
export const getCurrentArrivalConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    // Determine season based on month
    let season: 'summer' | 'winter' | 'rainy' | 'default';
    if (currentMonth >= 3 && currentMonth <= 5) {
      season = 'summer';
    } else if (currentMonth >= 6 && currentMonth <= 9) {
      season = 'rainy';
    } else if (currentMonth >= 10 || currentMonth <= 2) {
      season = 'winter';
    } else {
      season = 'default';
    }

    const arrivalConfig = await ArrivalConfig.findOne({
      season,
      isActive: true,
      $or: [
        { effectiveFrom: { $lte: now }, effectiveTo: { $gte: now } },
        { effectiveFrom: null, effectiveTo: null }
      ]
    })

    if (!arrivalConfig) {
      // Fallback to default season
      const defaultConfig = await ArrivalConfig.findOne({
        season: 'default',
        isActive: true
      })
      if (!defaultConfig) {
        res.status(404).json({ success: false, message: 'No active arrival config found' });
        return;
      }

      res.json({ success: true, data: defaultConfig });
      return;
    }

    res.json({ success: true, data: arrivalConfig });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};