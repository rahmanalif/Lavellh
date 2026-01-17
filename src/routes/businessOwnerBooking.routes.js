const express = require('express');
const router = express.Router();
const businessOwnerBookingController = require('../controllers/businessOwnerBookingController');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/business-owner-bookings
 * @desc    Create a booking for a business owner service
 * @access  Private (User)
 */
router.post('/', auth, businessOwnerBookingController.createBusinessOwnerBooking);

/**
 * @route   GET /api/business-owner-bookings/my-bookings
 * @desc    Get current user's business owner bookings
 * @access  Private (User)
 */
router.get('/my-bookings', auth, businessOwnerBookingController.getMyBusinessOwnerBookings);

/**
 * @route   GET /api/business-owner-bookings/:id
 * @desc    Get business owner booking by ID
 * @access  Private (User)
 */
router.get('/:id', auth, businessOwnerBookingController.getBusinessOwnerBookingById);

/**
 * @route   PATCH /api/business-owner-bookings/:id/cancel
 * @desc    Cancel a business owner booking
 * @access  Private (User)
 */
router.patch('/:id/cancel', auth, businessOwnerBookingController.cancelBusinessOwnerBooking);

module.exports = router;
