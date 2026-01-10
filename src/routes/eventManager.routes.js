const express = require('express');
const router = express.Router();
const eventManagerController = require('../controllers/eventManagerController');
const { uploadEventManagerFiles, uploadProfilePicture, handleUploadError } = require('../middleware/upload');
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

module.exports = router;
