const express = require('express');
const router = express.Router();
const businessOwnerBookingController = require('../controllers/businessOwnerBookingController');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/business-owner-appointments
 * @desc    Create an appointment for a business owner service
 * @access  Private (User)
 */
router.post('/', auth, businessOwnerBookingController.createBusinessOwnerAppointment);

/**
 * @route   GET /api/business-owner-appointments/my-appointments
 * @desc    Get current user's business owner appointments
 * @access  Private (User)
 */
router.get('/my-appointments', auth, businessOwnerBookingController.getMyBusinessOwnerAppointments);

/**
 * @route   GET /api/business-owner-appointments/available-slots/:serviceId
 * @desc    Get available appointment slots for a business owner service
 * @access  Public
 */
router.get('/available-slots/:serviceId', businessOwnerBookingController.getAvailableBusinessOwnerSlots);

/**
 * @route   GET /api/business-owner-appointments/:id
 * @desc    Get business owner appointment by ID
 * @access  Private (User)
 */
router.get('/:id', auth, businessOwnerBookingController.getBusinessOwnerAppointmentById);

/**
 * @route   PATCH /api/business-owner-appointments/:id/cancel
 * @desc    Cancel a business owner appointment
 * @access  Private (User)
 */
router.patch('/:id/cancel', auth, businessOwnerBookingController.cancelBusinessOwnerAppointment);

module.exports = router;
