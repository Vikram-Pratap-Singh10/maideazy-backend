import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { processPayment, getPaymentByBooking, getPaymentByUser, addAmountInWallet, verifyPaymentProcess, createBookingPaymentOrder, verifyBookingPayment, verifyPayment, verifyPaymentMultipleBookings, verifyPaymentExtendTime, getPaymentByAdmin, getPaymentStats, createOrder, verifyPaymentProcess1, verifyPayment1, verifyPaymentMultipleBookings1, verifyPaymentExtendTime1 } from '../controllers/paymentController.js';
import { requireAdmin } from '../middleware/admin.js';

const router = express.Router();

router.use(authenticateToken);

// Get Payment List and Stats
router.get("/admin/payment-stats", requireAdmin, getPaymentStats)
router.get("/admin/get-payments", requireAdmin, getPaymentByAdmin)
// Process payment for booking
router.post('/process', processPayment);

// Get payment transaction by booking id
router.get('/booking/:bookingId', getPaymentByBooking);
router.get('/', getPaymentByUser);

// Add Amount In User Wallet
router.post("/add-amount", addAmountInWallet)
router.post("/create-order", createOrder)
router.post("/verify-amount", verifyPaymentProcess)
router.post("/offer/verify-amount", verifyPayment)
router.post("/multiple-bookings/verify-amount", verifyPaymentMultipleBookings)
router.post("/extend-time/verify-amount", verifyPaymentExtendTime)
router.post("/booking-payment", createBookingPaymentOrder)
router.post("/payment-verify", verifyBookingPayment)


router.post("/verify-payment", verifyPaymentProcess1)
router.post("/offer/verify-payment", verifyPayment1)
router.post("/multiple-bookings/verify-payment", verifyPaymentMultipleBookings1)
router.post("/extend-time/verify-payment", verifyPaymentExtendTime1)

export default router;