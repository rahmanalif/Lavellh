const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, changePassword } = require('../controllers/authController');
const { requestPasswordReset, verifyOTP, resetPassword } = require('../controllers/passwordResetController');
const auth = require('../middleware/auth');
const { uploadProfilePicture, handleUploadError } = require('../middleware/upload');

// Public routes - Authentication
router.post('/register', register);
router.post('/login', login);

// Public routes - Password Reset
router.post('/forgot-password', requestPasswordReset);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', auth, getMe);
router.put('/me', auth, uploadProfilePicture, handleUploadError, updateProfile);
router.post('/change-password', auth, changePassword);

module.exports = router;