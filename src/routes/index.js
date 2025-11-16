const express = require('express');
const router = express.Router();

// Import auth routes
const authRoutes = require('./auth');
const oauthRoutes = require('./auth.oauth.routes');
const providerRoutes = require('./provider.routes');
const adminRoutes = require('./admin.routes');
const categoryRoutes = require('./category.routes');
const serviceRoutes = require('./service.routes');
const publicServiceRoutes = require('./service.public.routes');

// Use auth routes
router.use('/auth', authRoutes);

// Use OAuth routes (merged into /auth)
router.use('/auth', oauthRoutes);

// Use provider routes
router.use('/providers', providerRoutes);

// Use provider service routes
router.use('/providers/services', serviceRoutes);

// Use admin routes
router.use('/admin', adminRoutes);

// Use category routes (public)
router.use('/categories', categoryRoutes);

// Use public service routes
router.use('/services', publicServiceRoutes);

// Add other routes...

module.exports = router;