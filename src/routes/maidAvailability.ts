import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { getMaidAvailability, createAvailability, updateAvailability, deleteAvailability, getAllAvailability } from '../controllers/maidAvailabilityController.js';

const router = express.Router();

// All availability routes require authentication
router.use(authenticateToken);

// Get availability for a specific maid (public for authenticated users)
router.get('/maid/:maidId', getMaidAvailability);

// Admin only routes for managing availability
router.post('/maid/:maidId', requireAdmin, createAvailability);
router.patch('/maid/:maidId', requireAdmin, updateAvailability);
router.delete('/maid/:availabilityId', requireAdmin, deleteAvailability);

// Get all availability slots (Admin only)
router.get('/maid', requireAdmin, getAllAvailability);

export default router;