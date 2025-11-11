const express = require('express');
const router = express.Router();

// Import auth routes
const authRoutes = require('./auth');
const oauthRoutes = require('./auth.oauth.routes');
const providerRoutes = require('./provider.routes');

// Use auth routes
router.use('/auth', authRoutes);

// Use OAuth routes (merged into /auth)
router.use('/auth', oauthRoutes);

// Use provider routes
router.use('/providers', providerRoutes);

// Add other routes...

module.exports = router;