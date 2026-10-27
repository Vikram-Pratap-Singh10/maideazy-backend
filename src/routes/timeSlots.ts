import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { getAllTimeSlots, getTimeSlotById, getTimeSlotByLabel, createTimeSlot, updateTimeSlot, deleteTimeSlot, getTimeSlotss, getTimeSlots, updateTimeSlotStatus, toggleTimeSlots } from '../controllers/timeSlotController.js';
import { body } from 'express-validator';

const router = express.Router();

const timeSlotValidation = [
  body("label").isIn(["Morning", "Afternoon", "Evening"]).withMessage("Label must be one of: Morning, Afternoon, Evening"),
  body("times").isArray({ min: 1 }).withMessage("Times must be a non-empty array"),
  body("times.*").isString().withMessage("Each time must be a string")
];

// All time slot routes require authentication

// Public routes (authenticated users can view time slots)
// router.get('/', getAllTimeSlots);
router.get('/', getTimeSlots);
router.get('/label/:label', getTimeSlotByLabel);
router.get('/:slotId', getTimeSlotById);
router.use(authenticateToken);

// Admin only routes
router.post('/', requireAdmin, createTimeSlot);
router.get("/time/timeslots", requireAdmin, getTimeSlotss)
router.get("/slot-status/time", requireAdmin, getTimeSlots)
router.put('/update', requireAdmin, updateTimeSlotStatus);
router.put('/:slotId', requireAdmin, updateTimeSlot);
router.delete('/:slotId', requireAdmin, deleteTimeSlot);
router.get('/close-all/time-slot', requireAdmin, toggleTimeSlots);

export default router;