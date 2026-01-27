const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const auth = require('../middleware/auth');

/**
 * BOOKING ROUTES - For regular service bookings (appointmentEnabled = false)
 */

/**
 * @route   POST /api/bookings
 * @desc    Create a new booking for a regular service
 * @access  Private (User must be authenticated)
 * @body    { serviceId, bookingDate, downPayment, userNotes }
 */
router.post('/', auth, bookingController.createBooking);

/**
 * @route   GET /api/bookings/my-bookings
 * @desc    Get current user's bookings
 * @access  Private
 * @query   status, page, limit
 */
router.get('/my-bookings', auth, bookingController.getMyBookings);

/**
 * @route   GET /api/bookings/:id/payment-status
 * @desc    Get payment status for a booking
 * @access  Private (Owner only)
 */
router.get('/:id/payment-status', auth, bookingController.getBookingPaymentStatus);

/**
 * @route   GET /api/bookings/:id
 * @desc    Get single booking by ID
 * @access  Private (Owner only)
 */
router.get('/:id', auth, bookingController.getBookingById);

/**
 * @route   PATCH /api/bookings/:id/cancel
 * @desc    Cancel a booking
 * @access  Private (Owner only)
 * @body    { cancellationReason }
 */
router.patch('/:id/cancel', auth, bookingController.cancelBooking);

/**
 * @route   POST /api/bookings/:id/review
 * @desc    Add review for a completed booking
 * @access  Private (Owner only)
 * @body    { rating, comment }
 */
router.post('/:id/review', auth, bookingController.addBookingReview);

/**
 * @route   GET /api/bookings/:id/due/intent
 * @desc    Get due payment client secret
 * @access  Private (User)
 */
router.get('/:id/due/intent', auth, bookingController.getDuePaymentIntent);

/**
 * @route   POST /api/bookings/:id/due/confirm
 * @desc    Confirm due payment
 * @access  Private (User)
 */
router.post('/:id/due/confirm', auth, bookingController.confirmDuePayment);

/**
 * @route   GET /api/bookings/:id/checkout-session
 * @desc    Get Stripe checkout session URL for down payment
 * @access  Private (User)
 */
router.get('/:id/checkout-session', auth, bookingController.getCheckoutSession);

module.exports = router;
