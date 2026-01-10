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
const bookingRoutes = require('./booking.routes');
const appointmentRoutes = require('./appointment.routes');
const wishlistRoutes = require('./wishlist.routes');
const providerBookingRoutes = require('./provider.booking.routes');
const providerAppointmentRoutes = require('./provider.appointment.routes');
const businessOwnerRoutes = require('./businessOwner.routes');
const eventManagerRoutes = require('./eventManager.routes');
const homeRoutes = require('./home.routes');
const userRoutes = require('./user.routes');

// Use auth routes
router.use('/auth', authRoutes);

// Use OAuth routes (merged into /auth)
router.use('/auth', oauthRoutes);

// Use provider routes
router.use('/providers', providerRoutes);

// Use provider service routes
router.use('/providers/services', serviceRoutes);

// Use provider booking management routes
router.use('/providers/bookings', providerBookingRoutes);

// Use provider appointment management routes
router.use('/providers/appointments', providerAppointmentRoutes);

// Use admin routes
router.use('/admin', adminRoutes);

// Use category routes (public)
router.use('/categories', categoryRoutes);

// Use public service routes
router.use('/services', publicServiceRoutes);

// Use booking routes (for regular service bookings)
router.use('/bookings', bookingRoutes);

// Use appointment routes (for appointment-based bookings)
router.use('/appointments', appointmentRoutes);

// Use wishlist routes
router.use('/wishlist', wishlistRoutes);

// Use business owner routes
router.use('/business-owners', businessOwnerRoutes);

// Use event manager routes
router.use('/event-managers', eventManagerRoutes);

// Use home routes (public)
router.use('/home', homeRoutes);

// Use user routes (authenticated)
router.use('/user', userRoutes);

// Public settings route (Terms & Conditions, Privacy Policy, etc.)
const adminController = require('../controllers/adminController');
router.get('/settings/:key', adminController.getPublicSettings);

module.exports = router;