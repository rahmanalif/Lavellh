const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { requestPasswordReset, verifyOTP, resetPassword } = require('../controllers/passwordResetController');
const auth = require('../middleware/auth');

// Public routes - Authentication
router.post('/register', register);
router.post('/login', login);

// Public routes - Password Reset
router.post('/forgot-password', requestPasswordReset);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', auth, getMe);

module.exports = router;