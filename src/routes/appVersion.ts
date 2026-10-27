import express from 'express';
import { body } from 'express-validator';
import { 
  createAppVersion, 
  getAllAppVersions, 
  getLatestAppVersion, 
  updateAppVersion, 
  deleteAppVersion 
} from '../controllers/appVersionController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = express.Router();

// Validation middleware
const appVersionValidation = [
  body('androidLink').notEmpty().withMessage('Android link is required'),
  body('iosLink').notEmpty().withMessage('iOS link is required'),
  body('isSkip').isBoolean().withMessage('isSkip must be a boolean'),
  body('visible').isBoolean().withMessage('visible must be a boolean')
];

// Public route - Get latest app version (for app update check)
router.get('/latest', getLatestAppVersion);

// Admin only routes - All these routes require authentication and admin role
router.post('/', authenticateToken, requireAdmin, createAppVersion);
router.get('/', authenticateToken, requireAdmin, getAllAppVersions);
router.put('/:id', authenticateToken, requireAdmin, updateAppVersion);
router.delete('/:id', authenticateToken, requireAdmin, deleteAppVersion);

export default router;
