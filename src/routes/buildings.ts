import multer from "multer";
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import {
  getAllBuildings,
  getBuildingById,
  createBuilding,
  updateBuilding,
  deleteBuilding,
  getAllHubs,
  getAddBuildingAdmin,
  bulkUpload,
  getAllHubsForBooking,
} from '../controllers/buildingController.js';

const router = express.Router();


export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv" // .csv
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel or CSV files are allowed"));
    }
  }
});




// Public routes (authenticated users can view buildings)
router.get('/get-by-pincode/:pincode', getAllBuildings);
router.get('/get-building', getAllBuildings);
router.get('/hub', getAllHubs);
router.get('/booking/hub', getAllHubsForBooking);
router.get('/:buildingId', getBuildingById);

// All building routes require authentication
router.use(authenticateToken);


// Admin only routes
router.post("/excel-upload", uploadExcel.single("file"), bulkUpload);
router.post('/', requireAdmin, createBuilding);
router.get('/', requireAdmin, getAddBuildingAdmin);
router.put('/:buildingId', requireAdmin, updateBuilding);
router.delete('/:buildingId', requireAdmin, deleteBuilding);

export default router;