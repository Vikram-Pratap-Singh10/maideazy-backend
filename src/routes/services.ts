import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { getAllServices, getServiceById, createService, updateService, deleteService, viewAllServices, getAllServicesWithOfferApply } from '../controllers/serviceController.js';
import { body } from 'express-validator';

const router = express.Router();

const serviceValidation = [
  body("service_name").notEmpty().withMessage("Service Name is Required"),
  // body("description").notEmpty().withMessage("Description is Required"),
  body("duration").notEmpty().withMessage("Duration Name is Required"),
  body("discountAmount").notEmpty().withMessage("discountAmount Name is Required")
]
router.use(authenticateToken);
router.get('/view-services', requireAdmin, viewAllServices);
// All service routes require authentication
router.get('/', getAllServicesWithOfferApply);
router.get('/all-service', getAllServices);
router.get('/:serviceId', getServiceById);

// Public routes (authenticated users can view services)

// Admin only routes
router.post('/', requireAdmin, serviceValidation, createService);
router.patch('/:serviceId', requireAdmin, updateService);
router.delete('/:serviceId', requireAdmin, deleteService);

export default router;