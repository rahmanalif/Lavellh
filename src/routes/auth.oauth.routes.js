const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');
const Provider = require('../models/Provider');
const BusinessOwner = require('../models/BusinessOwner');

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

// Helper function to send response with token (standard user)
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

// Helper function to send response with token for Provider
const sendProviderTokenResponse = async (res, user) => {
  try {
    const provider = await Provider.findOne({ userId: user._id });
    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Provider authentication successful',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        profilePicture: user.profilePicture,
        userType: user.userType,
        authProvider: user.authProvider
      },
      provider: {
        id: provider._id,
        verificationStatus: provider.verificationStatus,
        categories: provider.categories,
        rating: provider.rating,
        isAvailable: provider.isAvailable
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching provider profile',
      error: error.message
    });
  }
};

// Helper function to send response with token for BusinessOwner
const sendBusinessOwnerTokenResponse = async (res, user) => {
  try {
    const businessOwner = await BusinessOwner.findOne({ userId: user._id });
    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Business Owner authentication successful',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        profilePicture: user.profilePicture,
        userType: user.userType,
        authProvider: user.authProvider
      },
      businessOwner: {
        id: businessOwner._id,
        occupation: businessOwner.occupation,
        referenceId: businessOwner.referenceId
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching business owner profile',
      error: error.message
    });
  }
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

// ============================================
// PROVIDER OAUTH ROUTES
// ============================================

// @route   GET /api/auth/google/provider
// @desc    Initiate Google OAuth for Provider
// @access  Public
router.get('/google/provider',
  passport.authenticate('google-provider', {
    session: false,
    scope: ['profile', 'email']
  })
);

// @route   GET /api/auth/google/provider/callback
// @desc    Google OAuth callback for Provider
// @access  Public
router.get('/google/provider/callback',
  passport.authenticate('google-provider', {
    session: false,
    failureRedirect: '/login?error=google_provider_auth_failed'
  }),
  async (req, res) => {
    if (req.user) {
      await sendProviderTokenResponse(res, req.user);
    } else {
      res.status(401).json({
        success: false,
        message: 'Google Provider authentication failed'
      });
    }
  }
);

// @route   GET /api/auth/facebook/provider
// @desc    Initiate Facebook OAuth for Provider
// @access  Public
router.get('/facebook/provider',
  passport.authenticate('facebook-provider', {
    session: false,
    scope: ['email', 'public_profile']
  })
);

// @route   GET /api/auth/facebook/provider/callback
// @desc    Facebook OAuth callback for Provider
// @access  Public
router.get('/facebook/provider/callback',
  passport.authenticate('facebook-provider', {
    session: false,
    failureRedirect: '/login?error=facebook_provider_auth_failed'
  }),
  async (req, res) => {
    if (req.user) {
      await sendProviderTokenResponse(res, req.user);
    } else {
      res.status(401).json({
        success: false,
        message: 'Facebook Provider authentication failed'
      });
    }
  }
);

// @route   POST /api/auth/apple/provider
// @desc    Initiate Apple OAuth for Provider
// @access  Public
router.post('/apple/provider',
  passport.authenticate('apple-provider', {
    session: false,
    scope: ['name', 'email']
  })
);

// @route   POST /api/auth/apple/provider/callback
// @desc    Apple OAuth callback for Provider
// @access  Public
router.post('/apple/provider/callback',
  passport.authenticate('apple-provider', {
    session: false,
    failureRedirect: '/login?error=apple_provider_auth_failed'
  }),
  async (req, res) => {
    if (req.user) {
      await sendProviderTokenResponse(res, req.user);
    } else {
      res.status(401).json({
        success: false,
        message: 'Apple Provider authentication failed'
      });
    }
  }
);

// ============================================
// BUSINESS OWNER OAUTH ROUTES
// ============================================

// @route   GET /api/auth/google/business-owner
// @desc    Initiate Google OAuth for Business Owner
// @access  Public
router.get('/google/business-owner',
  passport.authenticate('google-business-owner', {
    session: false,
    scope: ['profile', 'email']
  })
);

// @route   GET /api/auth/google/business-owner/callback
// @desc    Google OAuth callback for Business Owner
// @access  Public
router.get('/google/business-owner/callback',
  passport.authenticate('google-business-owner', {
    session: false,
    failureRedirect: '/login?error=google_business_owner_auth_failed'
  }),
  async (req, res) => {
    if (req.user) {
      await sendBusinessOwnerTokenResponse(res, req.user);
    } else {
      res.status(401).json({
        success: false,
        message: 'Google Business Owner authentication failed'
      });
    }
  }
);

// @route   GET /api/auth/facebook/business-owner
// @desc    Initiate Facebook OAuth for Business Owner
// @access  Public
router.get('/facebook/business-owner',
  passport.authenticate('facebook-business-owner', {
    session: false,
    scope: ['email', 'public_profile']
  })
);

// @route   GET /api/auth/facebook/business-owner/callback
// @desc    Facebook OAuth callback for Business Owner
// @access  Public
router.get('/facebook/business-owner/callback',
  passport.authenticate('facebook-business-owner', {
    session: false,
    failureRedirect: '/login?error=facebook_business_owner_auth_failed'
  }),
  async (req, res) => {
    if (req.user) {
      await sendBusinessOwnerTokenResponse(res, req.user);
    } else {
      res.status(401).json({
        success: false,
        message: 'Facebook Business Owner authentication failed'
      });
    }
  }
);

// @route   POST /api/auth/apple/business-owner
// @desc    Initiate Apple OAuth for Business Owner
// @access  Public
router.post('/apple/business-owner',
  passport.authenticate('apple-business-owner', {
    session: false,
    scope: ['name', 'email']
  })
);

// @route   POST /api/auth/apple/business-owner/callback
// @desc    Apple OAuth callback for Business Owner
// @access  Public
router.post('/apple/business-owner/callback',
  passport.authenticate('apple-business-owner', {
    session: false,
    failureRedirect: '/login?error=apple_business_owner_auth_failed'
  }),
  async (req, res) => {
    if (req.user) {
      await sendBusinessOwnerTokenResponse(res, req.user);
    } else {
      res.status(401).json({
        success: false,
        message: 'Apple Business Owner authentication failed'
      });
    }
  }
);

module.exports = router;
