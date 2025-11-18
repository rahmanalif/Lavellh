const express = require('express');
const router = express.Router();
const providerController = require('../controllers/providerController');
const { uploadIdCards, uploadProfilePicture, handleUploadError } = require('../middleware/upload');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/providers/register
 * @desc    Register a new provider with ID card verification
 * @access  Public
 */
router.post(
  '/register',
  uploadIdCards,
  handleUploadError,
  providerController.registerProvider
);

/**
 * @route   POST /api/providers/login
 * @desc    Login provider
 * @access  Public
 */
router.post('/login', providerController.loginProvider);

/**
 * @route   GET /api/providers/me
 * @desc    Get current provider profile
 * @access  Private (Provider only)
 */
router.get('/me', auth, providerController.getProviderProfile);

/**
 * @route   PUT /api/providers/me
 * @desc    Update current provider profile
 * @access  Private (Provider only)
 */
router.put('/me', auth, uploadProfilePicture, handleUploadError, providerController.updateProviderProfile);

/**
 * @route   POST /api/providers/change-password
 * @desc    Change provider password
 * @access  Private (Provider only)
 */
router.post('/change-password', auth, providerController.changePassword);

module.exports = router;
