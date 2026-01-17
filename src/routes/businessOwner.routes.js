const express = require('express');
const router = express.Router();
const businessOwnerController = require('../controllers/businessOwnerController');
const faqController = require('../controllers/faqController');
const businessOwnerBookingController = require('../controllers/businessOwnerBookingController');
const { uploadIdCards, uploadBusinessOwnerFiles, uploadProfilePicture, uploadBusinessProfileFiles, handleUploadError } = require('../middleware/upload');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/business-owners/register
 * @desc    Register a new business owner with ID card uploads
 * @access  Public
 */
router.post(
  '/register',
  uploadBusinessOwnerFiles,
  handleUploadError,
  businessOwnerController.registerBusinessOwner
);

/**
 * @route   POST /api/business-owners/login
 * @desc    Login business owner
 * @access  Public
 */
router.post('/login', businessOwnerController.loginBusinessOwner);

/**
 * @route   POST /api/business-owners/logout
 * @desc    Logout business owner (revoke refresh token)
 * @access  Public
 */
router.post('/logout', businessOwnerController.logout);

/**
 * @route   POST /api/business-owners/logout-all
 * @desc    Logout business owner from all devices
 * @access  Private (Business Owner only)
 */
router.post('/logout-all', auth, businessOwnerController.logoutAll);

// ============ PASSWORD RESET ROUTES ============

/**
 * @route   POST /api/business-owners/forgot-password
 * @desc    Request password reset - Send OTP to email
 * @access  Public
 */
router.post('/forgot-password', businessOwnerController.forgotPassword);

/**
 * @route   POST /api/business-owners/verify-otp
 * @desc    Verify OTP code
 * @access  Public
 */
router.post('/verify-otp', businessOwnerController.verifyOTP);

/**
 * @route   POST /api/business-owners/reset-password
 * @desc    Reset password with OTP verification
 * @access  Public
 */
router.post('/reset-password', businessOwnerController.resetPasswordWithOTP);

/**
 * @route   GET /api/business-owners/me
 * @desc    Get current business owner profile
 * @access  Private (Business Owner only)
 */
router.get('/me', auth, businessOwnerController.getBusinessOwnerProfile);

/**
 * @route   PUT /api/business-owners/me
 * @desc    Update current business owner profile (including password change)
 * @access  Private (Business Owner only)
 * @note    Password fields (currentPassword, newPassword, confirmPassword) are optional
 *          Only include them when you want to change the password
 */
router.put('/me', auth, uploadProfilePicture, handleUploadError, businessOwnerController.updateBusinessOwnerProfile);

// ============ BUSINESS PROFILE ROUTES ============

/**
 * @route   GET /api/business-owners/business-profile
 * @desc    Get business profile (separate from personal profile)
 * @access  Private (Business Owner only)
 */
router.get('/business-profile', auth, businessOwnerController.getBusinessProfile);

/**
 * @route   POST /api/business-owners/business-profile
 * @desc    Create business profile (first time setup)
 * @access  Private (Business Owner only)
 * @note    Required fields: name, categories (array), location
 *          Optional fields: about, coverPhoto (file), businessPhotos (files - max 10)
 */
router.post('/business-profile', auth, uploadBusinessProfileFiles, handleUploadError, businessOwnerController.createBusinessProfile);

/**
 * @route   PUT /api/business-owners/business-profile
 * @desc    Update existing business profile (cover photo, name, categories, location, about, photos)
 * @access  Private (Business Owner only)
 * @note    Business profile must be created first using POST
 */
router.put('/business-profile', auth, uploadBusinessProfileFiles, handleUploadError, businessOwnerController.updateBusinessProfile);

/**
 * @route   DELETE /api/business-owners/business-profile/photos/:photoIndex
 * @desc    Delete a specific business profile photo by index
 * @access  Private (Business Owner only)
 */
router.delete('/business-profile/photos/:photoIndex', auth, businessOwnerController.deleteBusinessProfilePhoto);

// ============ BANK INFORMATION ROUTES ============

/**
 * @route   GET /api/business-owners/bank-information
 * @desc    Get business owner's bank information
 * @access  Private (Business Owner only)
 */
router.get('/bank-information', auth, businessOwnerController.getBankInformation);

/**
 * @route   POST /api/business-owners/bank-information
 * @desc    Save business owner's bank information (create)
 * @access  Private (Business Owner only)
 */
router.post('/bank-information', auth, businessOwnerController.saveBankInformation);

/**
 * @route   PUT /api/business-owners/bank-information
 * @desc    Update business owner's bank information
 * @access  Private (Business Owner only)
 */
router.put('/bank-information', auth, businessOwnerController.updateBankInformation);

/**
 * @route   DELETE /api/business-owners/bank-information/document
 * @desc    Delete bank verification document
 * @access  Private (Business Owner only)
 */
router.delete('/bank-information/document', auth, businessOwnerController.deleteBankVerificationDocument);

// ============ FAQ ROUTES ============

/**
 * @route   GET /api/business-owners/faqs
 * @desc    Get active FAQs
 * @access  Private (Business Owner only)
 */
router.get('/faqs', auth, faqController.getActiveFaqs);

// ============ PRIVACY POLICY ROUTE ============

/**
 * @route   GET /api/business-owners/privacy-policy
 * @desc    Get privacy policy
 * @access  Private (Business Owner only)
 */
router.get('/privacy-policy', auth, businessOwnerController.getPrivacyPolicy);

// ============ TERMS AND CONDITIONS ROUTE ============

/**
 * @route   GET /api/business-owners/terms-and-conditions
 * @desc    Get terms and conditions
 * @access  Private (Business Owner only)
 */
router.get('/terms-and-conditions', auth, businessOwnerController.getTermsAndConditions);

// ============ BUSINESS OWNER BOOKING MANAGEMENT ============

/**
 * @route   GET /api/business-owners/bookings
 * @desc    Get all bookings for business owner's services
 * @access  Private (Business Owner only)
 */
router.get('/bookings', auth, businessOwnerBookingController.getBusinessOwnerBookings);

/**
 * @route   GET /api/business-owners/bookings/:id
 * @desc    Get booking details
 * @access  Private (Business Owner only)
 */
router.get('/bookings/:id', auth, businessOwnerBookingController.getBusinessOwnerBookingDetails);

/**
 * @route   PATCH /api/business-owners/bookings/:id/accept
 * @desc    Accept a booking request
 * @access  Private (Business Owner only)
 */
router.patch('/bookings/:id/accept', auth, businessOwnerBookingController.acceptBusinessOwnerBooking);

/**
 * @route   PATCH /api/business-owners/bookings/:id/reject
 * @desc    Reject a booking request
 * @access  Private (Business Owner only)
 */
router.patch('/bookings/:id/reject', auth, businessOwnerBookingController.rejectBusinessOwnerBooking);

/**
 * @route   PATCH /api/business-owners/bookings/:id/start
 * @desc    Mark booking as in progress
 * @access  Private (Business Owner only)
 */
router.patch('/bookings/:id/start', auth, businessOwnerBookingController.startBusinessOwnerBooking);

/**
 * @route   PATCH /api/business-owners/bookings/:id/complete
 * @desc    Mark booking as completed
 * @access  Private (Business Owner only)
 */
router.patch('/bookings/:id/complete', auth, businessOwnerBookingController.completeBusinessOwnerBooking);

// ============ BUSINESS OWNER APPOINTMENT MANAGEMENT ============

/**
 * @route   GET /api/business-owners/appointments
 * @desc    Get all appointments for business owner's services
 * @access  Private (Business Owner only)
 */
router.get('/appointments', auth, businessOwnerBookingController.getBusinessOwnerAppointments);

/**
 * @route   GET /api/business-owners/appointments/:id
 * @desc    Get appointment details
 * @access  Private (Business Owner only)
 */
router.get('/appointments/:id', auth, businessOwnerBookingController.getBusinessOwnerAppointmentDetails);

/**
 * @route   PATCH /api/business-owners/appointments/:id/accept
 * @desc    Accept an appointment request
 * @access  Private (Business Owner only)
 */
router.patch('/appointments/:id/accept', auth, businessOwnerBookingController.acceptBusinessOwnerAppointment);

/**
 * @route   PATCH /api/business-owners/appointments/:id/reject
 * @desc    Reject an appointment request
 * @access  Private (Business Owner only)
 */
router.patch('/appointments/:id/reject', auth, businessOwnerBookingController.rejectBusinessOwnerAppointment);

/**
 * @route   PATCH /api/business-owners/appointments/:id/reschedule
 * @desc    Reschedule an appointment
 * @access  Private (Business Owner only)
 */
router.patch('/appointments/:id/reschedule', auth, businessOwnerBookingController.rescheduleBusinessOwnerAppointment);

/**
 * @route   PATCH /api/business-owners/appointments/:id/start
 * @desc    Mark appointment as in progress
 * @access  Private (Business Owner only)
 */
router.patch('/appointments/:id/start', auth, businessOwnerBookingController.startBusinessOwnerAppointment);

/**
 * @route   PATCH /api/business-owners/appointments/:id/complete
 * @desc    Mark appointment as completed
 * @access  Private (Business Owner only)
 */
router.patch('/appointments/:id/complete', auth, businessOwnerBookingController.completeBusinessOwnerAppointment);

/**
 * @route   PATCH /api/business-owners/appointments/:id/no-show
 * @desc    Mark appointment as no-show
 * @access  Private (Business Owner only)
 */
router.patch('/appointments/:id/no-show', auth, businessOwnerBookingController.markBusinessOwnerNoShow);

module.exports = router;
