import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { getAllMaids, getMaidById, getAvailability, createMaid, updateMaid, deleteMaid, getBookingsByMaid, getAllMaidsAdmin, getAllMaidsByHubAdmin, getCompletedBookingsByMaid, toggleMaidOnlineStatus, checkMaidOnlineOffline } from '../controllers/maidController.js';
import multer from 'multer';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });


// All maid routes require authentication
router.use(authenticateToken);

// Admin only routes
router.post('/', requireAdmin, upload.single("profile_image"), createMaid);
router.patch('/:maidId', requireAdmin, upload.single("profile_image"), updateMaid);
router.delete('/:maidId', requireAdmin, deleteMaid);
router.get("/view-maids", requireAdmin, getAllMaidsAdmin)
router.get("/hub/view-maids/:hub", requireAdmin, getAllMaidsByHubAdmin)

// Get Booking by Maid
router.get("/booking-list", getBookingsByMaid)
router.get("/completed-booking-list", getCompletedBookingsByMaid)
router.put("/online-status", toggleMaidOnlineStatus);
router.get("/online-status", checkMaidOnlineOffline);

// Public routes (authenticated users can view maids)
router.get('/', getAllMaids);
router.get('/:maidId', getMaidById);
router.get('/:maidId/availability', getAvailability);


export default router;
