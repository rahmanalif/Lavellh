const express = require('express');
const router = express.Router();
const businessOwnerController = require('../controllers/businessOwnerController');
const { uploadIdCards, uploadProfilePicture, handleUploadError } = require('../middleware/upload');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/business-owners/register
 * @desc    Register a new business owner with ID card uploads
 * @access  Public
 */
router.post(
  '/register',
  uploadIdCards,
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
 * @route   GET /api/business-owners/me
 * @desc    Get current business owner profile
 * @access  Private (Business Owner only)
 */
router.get('/me', auth, businessOwnerController.getBusinessOwnerProfile);

/**
 * @route   PUT /api/business-owners/me
 * @desc    Update current business owner profile
 * @access  Private (Business Owner only)
 */
router.put('/me', auth, uploadProfilePicture, handleUploadError, businessOwnerController.updateBusinessOwnerProfile);

/**
 * @route   POST /api/business-owners/change-password
 * @desc    Change business owner password
 * @access  Private (Business Owner only)
 */
router.post('/change-password', auth, businessOwnerController.changePassword);

module.exports = router;
