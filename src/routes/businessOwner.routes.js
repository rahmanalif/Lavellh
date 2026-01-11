const express = require('express');
const router = express.Router();
const businessOwnerController = require('../controllers/businessOwnerController');
const { uploadIdCards, uploadBusinessOwnerFiles, uploadProfilePicture, handleUploadError } = require('../middleware/upload');
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

module.exports = router;
