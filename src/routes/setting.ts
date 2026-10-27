import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { createSettings, getSettings, updateBookingLimit, updateSettings, updateStartEndTime } from "../controllers/settingController.js";


const router = express.Router();

router.use(authenticateToken);

router.post('/', requireAdmin, createSettings);
router.get('/', getSettings);
router.put('/', requireAdmin, updateSettings);
router.put('/booking-limit', requireAdmin, updateBookingLimit);
router.put('/company-time', requireAdmin, updateStartEndTime);

export default router;