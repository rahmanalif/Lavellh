const express = require('express');
const router = express.Router();
const eventManagerController = require('../controllers/eventManagerController');
const eventController = require('../controllers/eventController');
const { uploadEventManagerFiles, uploadProfilePicture, uploadEventImage, handleUploadError } = require('../middleware/upload');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/event-managers/register
 * @desc    Register a new event manager with ID card uploads
 * @access  Public
 */
router.post(
  '/register',
  uploadEventManagerFiles,
  handleUploadError,
  eventManagerController.registerEventManager
);

/**
 * @route   POST /api/event-managers/login
 * @desc    Login event manager
 * @access  Public
 */
router.post('/login', eventManagerController.loginEventManager);

/**
 * @route   POST /api/event-managers/logout
 * @desc    Logout event manager (revoke refresh token)
 * @access  Public
 */
router.post('/logout', eventManagerController.logout);

/**
 * @route   POST /api/event-managers/logout-all
 * @desc    Logout event manager from all devices
 * @access  Private (Event Manager only)
 */
router.post('/logout-all', auth, eventManagerController.logoutAll);

// ============ PASSWORD RESET ROUTES ============

/**
 * @route   POST /api/event-managers/forgot-password
 * @desc    Request password reset - Send OTP to email
 * @access  Public
 */
router.post('/forgot-password', eventManagerController.forgotPassword);

/**
 * @route   POST /api/event-managers/verify-otp
 * @desc    Verify OTP code
 * @access  Public
 */
router.post('/verify-otp', eventManagerController.verifyOTP);

/**
 * @route   POST /api/event-managers/reset-password
 * @desc    Reset password with OTP verification
 * @access  Public
 */
router.post('/reset-password', eventManagerController.resetPasswordWithOTP);

/**
 * @route   GET /api/event-managers/me
 * @desc    Get current event manager profile
 * @access  Private (Event Manager only)
 */
router.get('/me', auth, eventManagerController.getEventManagerProfile);

/**
 * @route   PUT /api/event-managers/me
 * @desc    Update current event manager profile (including password change)
 * @access  Private (Event Manager only)
 * @note    Password fields (currentPassword, newPassword, confirmPassword) are optional
 *          Only include them when you want to change the password
 */
router.put('/me', auth, uploadProfilePicture, handleUploadError, eventManagerController.updateEventManagerProfile);

// ============ EVENT MANAGEMENT ROUTES ============

/**
 * @route   POST /api/event-managers/events
 * @desc    Create a new event (draft)
 * @access  Private (Event Manager only)
 */
router.post('/events', auth, uploadEventImage, handleUploadError, eventController.createEvent);

/**
 * @route   GET /api/event-managers/events/stats
 * @desc    Get event statistics for the authenticated event manager
 * @access  Private (Event Manager only)
 */
router.get('/events/stats', auth, eventController.getEventStats);

/**
 * @route   GET /api/event-managers/events
 * @desc    Get all events for the authenticated event manager
 * @access  Private (Event Manager only)
 * @query   status - Filter by event status (draft, published, cancelled, completed)
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 10)
 */
router.get('/events', auth, eventController.getMyEvents);

/**
 * @route   GET /api/event-managers/events/:id
 * @desc    Get a single event by ID
 * @access  Private (Event Manager only)
 */
router.get('/events/:id', auth, eventController.getEventById);

/**
 * @route   PUT /api/event-managers/events/:id
 * @desc    Update an event (draft or published without tickets sold)
 * @access  Private (Event Manager only)
 */
router.put('/events/:id', auth, uploadEventImage, handleUploadError, eventController.updateEvent);

/**
 * @route   PUT /api/event-managers/events/:id/publish
 * @desc    Publish an event (change status from draft to published)
 * @access  Private (Event Manager only)
 */
router.put('/events/:id/publish', auth, eventController.publishEvent);

/**
 * @route   PUT /api/event-managers/events/:id/cancel
 * @desc    Cancel an event
 * @access  Private (Event Manager only)
 * @body    cancellationReason - Reason for cancellation
 */
router.put('/events/:id/cancel', auth, eventController.cancelEvent);

/**
 * @route   DELETE /api/event-managers/events/:id
 * @desc    Delete an event (only drafts with no tickets sold)
 * @access  Private (Event Manager only)
 */
router.delete('/events/:id', auth, eventController.deleteEvent);

module.exports = router;
