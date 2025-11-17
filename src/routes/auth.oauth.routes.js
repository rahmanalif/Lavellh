const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      userType: user.userType,
      authProvider: user.authProvider
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Helper function to send response with token
const sendTokenResponse = (res, user) => {
  const token = generateToken(user);

  res.json({
    success: true,
    message: 'Authentication successful',
    token,
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePicture: user.profilePicture,
      userType: user.userType,
      authProvider: user.authProvider
    }
  });
};

// ============================================
// GOOGLE OAUTH ROUTES
// ============================================

// @route   GET /api/auth/google
// @desc    Initiate Google OAuth
// @access  Public
router.get('/google',
  passport.authenticate('google', {
    session: false,
    scope: ['profile', 'email']
  })
);

// @route   GET /api/auth/google/callback
// @desc    Google OAuth callback
// @access  Public
router.get('/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/login?error=google_auth_failed'
  }),
  (req, res) => {
    // Successful authentication
    if (req.user) {
      sendTokenResponse(res, req.user);
    } else {
      res.status(401).json({
        success: false,
        message: 'Google authentication failed'
      });
    }
  }
);

// ============================================
// FACEBOOK OAUTH ROUTES
// ============================================

// @route   GET /api/auth/facebook
// @desc    Initiate Facebook OAuth
// @access  Public
router.get('/facebook',
  passport.authenticate('facebook', {
    session: false,
    scope: ['email', 'public_profile']
  })
);

// @route   GET /api/auth/facebook/callback
// @desc    Facebook OAuth callback
// @access  Public
router.get('/facebook/callback',
  passport.authenticate('facebook', {
    session: false,
    failureRedirect: '/login?error=facebook_auth_failed'
  }),
  (req, res) => {
    // Successful authentication
    if (req.user) {
      sendTokenResponse(res, req.user);
    } else {
      res.status(401).json({
        success: false,
        message: 'Facebook authentication failed'
      });
    }
  }
);

// ============================================
// APPLE OAUTH ROUTES
// ============================================

// @route   POST /api/auth/apple
// @desc    Initiate Apple OAuth
// @access  Public
router.post('/apple',
  passport.authenticate('apple', {
    session: false,
    scope: ['name', 'email']
  })
);

// @route   POST /api/auth/apple/callback
// @desc    Apple OAuth callback
// @access  Public
router.post('/apple/callback',
  passport.authenticate('apple', {
    session: false,
    failureRedirect: '/login?error=apple_auth_failed'
  }),
  (req, res) => {
    // Successful authentication
    if (req.user) {
      sendTokenResponse(res, req.user);
    } else {
      res.status(401).json({
        success: false,
        message: 'Apple authentication failed'
      });
    }
  }
);

// ============================================
// LOGOUT ROUTE
// ============================================

// @route   POST /api/auth/logout
// @desc    Logout user (client should delete token)
// @access  Public
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully. Please delete your token on the client side.'
  });
});

// ============================================
// CHECK AUTH STATUS
// ============================================

// @route   GET /api/auth/me
// @desc    Get current user info
// @access  Private
const protect = require('../middleware/auth');

router.get('/me', protect, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
      phoneNumber: req.user.phoneNumber,
      profilePicture: req.user.profilePicture,
      userType: req.user.userType,
      authProvider: req.user.authProvider,
      createdAt: req.user.createdAt
    }
  });
});

module.exports = router;
