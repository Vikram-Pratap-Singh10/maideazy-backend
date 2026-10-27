import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { getAllOffers, getOfferById, getOffersByService, createOffer, updateOffer, deleteOffer, applyOfferToService, getNewUserOffer } from '../controllers/offerController.js';
import { body } from 'express-validator';

const router = express.Router();

const offerValidation = [
    body("title").notEmpty().withMessage("Title is required"),
    body("type").notEmpty().withMessage("Type must be either 'arrival' or 'promotional'")
];

// All offer routes require authentication
router.use(authenticateToken);

// Public routes (authenticated users can view offers)
router.get('/', getAllOffers);
router.get('/:offerId', getOfferById);
router.get('/new-user/offer', getNewUserOffer);
router.get('/service/:serviceId', getOffersByService);

// Apply offer route
router.post('/apply', applyOfferToService);

// Admin only routes
router.post('/', requireAdmin, offerValidation, createOffer);
router.patch('/:offerId', requireAdmin, updateOffer);
router.delete('/:offerId', requireAdmin, deleteOffer);

export default router;