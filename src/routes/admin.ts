import express from 'express';
import multer from "multer";
import { bulkUpload, changePassword, createUser, deleteAdmin, deleteOldUser, deleteUser, getAdmins, getDashboardStats, getOldUser, getOtp, getRecentBookings, registerAdmin, testNotification, updateAdmin } from '../controllers/adminController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

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

router.post("/new-admin",registerAdmin)
router.use(authenticateToken)

router.get('/stats-dashboard', requireAdmin, getDashboardStats);
router.get("/recent-booking", requireAdmin, getRecentBookings)
router.post("/test-notification",requireAdmin,testNotification)
// who's user already used the new user offer
router.post("/old-user",requireAdmin,createUser)
router.delete("/old-user/:id/delete",requireAdmin,deleteOldUser)
router.get("/old-user/get",requireAdmin,getOldUser)
// Admin only routes
router.post("/old-user/excel-upload", uploadExcel.single("file"), bulkUpload);

router.put("/delete-user/:id",deleteUser)
router.post("/admin-create",registerAdmin)
router.get("/get-admin",requireAdmin,getAdmins)
router.put("/:id",requireAdmin,updateAdmin)
router.delete("/:id",requireAdmin,deleteAdmin)
router.post("/password-change",requireAdmin,changePassword)

router.get("/get-otp", requireAdmin, getOtp);

export default router;
