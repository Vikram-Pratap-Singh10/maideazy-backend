import express from 'express';
import { body } from 'express-validator';
import { assignMaidToBooking, createBooking, getBookingsForAdmin, getUserBookings, updateBookingStatus, submitPinAndStartTimer, extendBookingTime, getBookingsByIdForAdmin, cancleBookingByUser, getNewBookings, getOngoingBookings, getCompletedBookings, getCancelledBookings, createMultipleBooking, updateAssignMaidToBooking, updateBooking, closeBooking, stopRingByUser, stopRingByMaid, StartTimerByAdmin, updateBookingByAdmin, createBooking1, checkBookingSlots, updateBookingPaymentStatus, createBookingAdmin, updateBookingAdmin } from '../controllers/bookingController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, requireUser } from '../middleware/admin.js';

const router = express.Router();
// Only For Bookings
router.get('/free-access/all-booking', getBookingsForAdmin);
router.use(authenticateToken);

const bookingValidation = [
  body('serviceId').isString().withMessage('Valid serviceId required'),
]

router.post('/multiple-booking', createMultipleBooking);
router.post('/', bookingValidation, createBooking);
router.post('/admin', bookingValidation, createBookingAdmin);
router.put('/admin/:bookingId', updateBookingAdmin);
router.post('/booking-slots-check', checkBookingSlots);
router.patch('/update-booking/:bookingId', updateBooking);
router.get('/', getUserBookings);
router.patch('/close-booking/:bookingId', closeBooking);
router.patch('/:bookingId/cancel', cancleBookingByUser);
router.patch('/:bookingId/status', updateBookingStatus);
router.patch('/payment-type/:bookingId', updateBookingPaymentStatus);
router.post('/:bookingId/submit-pin', submitPinAndStartTimer);
router.post('/extend-time', extendBookingTime);
// Admin only routes
router.get('/all-booking', requireAdmin, getBookingsForAdmin);
router.get('/booking-by-id/:bookingId', requireAdmin, getBookingsByIdForAdmin);
router.put("/:bookingId", requireAdmin, assignMaidToBooking)
router.put("/update-maid/:bookingId", requireAdmin, updateAssignMaidToBooking)
router.put("/start-timer/:bookingId/booking",requireAdmin,StartTimerByAdmin)
router.patch('/reschedule-booking/:bookingId',requireAdmin, updateBookingByAdmin);
// Get User New,Complete and Ongoing Booking
router.get("/new", getNewBookings)
router.get("/ongoing", getOngoingBookings)
router.get("/completed", getCompletedBookings)
router.get("/cancelled", getCancelledBookings)

// Stop Ring Routes
router.patch('/user/stop-ring/:bookingId', stopRingByUser);
router.patch('/maid/stop-ring/:bookingId', stopRingByMaid);

router.post("/with-admin-booking",createBooking1)

export default router;
