import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import {
  getAllArrivalConfigs,
  getArrivalConfigById,
  getArrivalConfigBySeason,
  createArrivalConfig,
  updateArrivalConfig,
  deleteArrivalConfig,
  getCurrentArrivalConfig
} from '../controllers/arrivalConfigController.js';
import { body } from 'express-validator';

const router = express.Router();

const arrivalConfigValidation = [
  body("season").isIn(["summer", "winter", "rainy", "default"]).withMessage("Season must be one of: summer, winter, rainy, default"),
  body("arrivalTime").isNumeric().withMessage("Arrival time must be a number"),
];

// All arrival config routes require authentication
router.use(authenticateToken);

// Public routes (authenticated users can view arrival configs)
router.get('/', getAllArrivalConfigs);
router.get('/current', getCurrentArrivalConfig);
router.get('/season/:season', getArrivalConfigBySeason);
router.get('/:configId', getArrivalConfigById);

// Admin only routes
router.post('/', requireAdmin, arrivalConfigValidation, createArrivalConfig);
router.put('/:configId', requireAdmin, updateArrivalConfig);
router.delete('/:configId', requireAdmin, deleteArrivalConfig);

export default router;