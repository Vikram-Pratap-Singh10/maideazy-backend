import express from "express";
import multer from "multer";
import { authenticateToken } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { createBanner, deleteBanner, getAllBanners, getBannerById, updateBanner } from "../controllers/bannerController.js";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.use(authenticateToken);

router.post('/', upload.single("image"), requireAdmin, createBanner);
router.get('/', getAllBanners);
router.get('/:id', getBannerById);
router.put('/:id',  upload.single("image"), requireAdmin, updateBanner);
router.delete('/:id', requireAdmin, deleteBanner);

export default router;