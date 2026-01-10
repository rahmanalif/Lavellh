const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const auth = require('../middleware/auth');

/**
 * Protected routes for home page (require authentication)
 */

// Get featured providers (paid providers sorted by proximity)
// GET /api/home/featured-providers?latitude=40.7128&longitude=-74.0060&maxDistance=50000&limit=20
router.get('/featured-providers', auth, homeController.getFeaturedProviders);

// Get nearby providers grouped by category (for user homepage)
// GET /api/home/nearby-providers?latitude=40.7128&longitude=-74.0060&maxDistance=10000
router.get('/nearby-providers', auth, homeController.getNearbyProvidersByCategory);

// Get all categories with provider count
// GET /api/home/categories
router.get('/categories', auth, homeController.getHomeCategories);

// Get provider details
// GET /api/home/provider/:providerId?latitude=40.7128&longitude=-74.0060
router.get('/provider/:providerId', auth, homeController.getProviderDetails);

// Get all providers (for testing - to get valid provider IDs)
// GET /api/home/all-providers
router.get('/all-providers', auth, homeController.getAllProviders);

module.exports = router;
