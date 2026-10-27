import express from "express";
import { closeAllSlotsForDate, createTimeSlotOverride, deleteTimeSlotOverride, getTimeSlotOverridesByDate, toggleAllSlotsForDate, updateTimeSlotOverride } from "../controllers/timeSlotOverride.controller.js";
import { createServiceOverride, deleteServiceOverride, getServiceOverridesByDate, updateServiceOverride } from "../controllers/serviceOverride.controller.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";

const router = express.Router();

/* TimeSlot Overrides */
router.use(authenticateToken)

router.post("/timeslot-override",requireAdmin, createTimeSlotOverride);
router.post("/close-all-slots",requireAdmin, toggleAllSlotsForDate);
router.put("/timeslot-override/:id", updateTimeSlotOverride);
router.get("/timeslot-override", getTimeSlotOverridesByDate);
router.delete("/timeslot-override/:id", deleteTimeSlotOverride);

/* Service Overrides */

router.post("/service-override", createServiceOverride);
router.put("/service-override/:id", updateServiceOverride);
router.get("/service-override", getServiceOverridesByDate);
router.delete("/service-override/:id", deleteServiceOverride);

export default router;