import express from 'express';
import { body } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { addReview, getReviewsByMaid, getReviewsByUser } from '../controllers/reviewController.js';
import multer from 'multer';
import { requireUser } from '../middleware/admin.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.use(authenticateToken);

const reviewValidation = [
  body('bookingId').optional().notEmpty().withMessage('bookingId required'),
  body('maidId').optional().notEmpty().withMessage('maidId required'),
  body('rating')
    .optional().notEmpty()
    .withMessage('rating between 1 and 5 required'),
  body('reviewMessage').optional().isString(),
]

// Add review for a booking and maid
router.post('/', reviewValidation, requireUser, addReview);

// Get reviews by maid
router.get('/maid/:maidId', getReviewsByMaid);
router.get('/user/:bookingId', getReviewsByUser);

export default router;
