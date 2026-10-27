import express from "express"
import { checkInAttendance, checkOutAttendance, getAttendanceListByMaid, getDailyAttendance, markAttendance, updateMarkAttendance } from "../controllers/attendance.controller.js";
import { requireAdmin } from "../middleware/admin.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router()

router.use(authenticateToken);

router.post("/check-in", requireAdmin, checkInAttendance);
router.post("/check-out", requireAdmin, checkOutAttendance);
router.post("/admin/check-in-check-out", requireAdmin, markAttendance);
router.put("/admin/update-attendance",requireAdmin,updateMarkAttendance)
router.get("/maid-attedance/:id", requireAdmin, getAttendanceListByMaid);
router.get("/daily", requireAdmin, getDailyAttendance);

export default router;
