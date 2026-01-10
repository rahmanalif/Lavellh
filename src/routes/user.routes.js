const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const categoryController = require('../controllers/categoryController');

/**
 * USER ROUTES - Authenticated user endpoints
 * All routes require Bearer token authentication
 */

/**
 * @route   GET /api/user/categories
 * @desc    Get all active categories for authenticated users
 * @access  Private (Requires user authentication)
 * @query   parentOnly=true (optional) - Only show parent categories
 */
router.get('/categories', auth, categoryController.getAllCategories);

/**
 * @route   GET /api/user/categories/:slug
 * @desc    Get category by slug for authenticated users
 * @access  Private (Requires user authentication)
 */
router.get('/categories/:slug', auth, categoryController.getCategoryBySlug);

module.exports = router;
