const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const categoryController = require('../controllers/categoryController');
const { verifyAdminToken, requirePermission, requireSuperAdmin } = require('../middleware/adminAuth');

/**
 * @route   POST /api/admin/login
 * @desc    Admin login
 * @access  Public
 */
router.post('/login', adminController.loginAdmin);

/**
 * @route   GET /api/admin/me
 * @desc    Get admin profile
 * @access  Private (Admin)
 */
router.get('/me', verifyAdminToken, adminController.getAdminProfile);

/**
 * @route   GET /api/admin/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private (Admin)
 */
router.get('/dashboard/stats', verifyAdminToken, adminController.getDashboardStats);

// ============ PROVIDER MANAGEMENT ============

/**
 * @route   GET /api/admin/providers
 * @desc    Get all providers with filters
 * @access  Private (Admin with canManageProviders permission)
 */
router.get(
  '/providers',
  verifyAdminToken,
  requirePermission('canManageProviders'),
  adminController.getAllProviders
);

/**
 * @route   GET /api/admin/providers/:id
 * @desc    Get provider details
 * @access  Private (Admin with canManageProviders permission)
 */
router.get(
  '/providers/:id',
  verifyAdminToken,
  requirePermission('canManageProviders'),
  adminController.getProviderDetails
);

/**
 * @route   PUT /api/admin/providers/:id/approve
 * @desc    Approve provider
 * @access  Private (Admin with canManageProviders permission)
 */
router.put(
  '/providers/:id/approve',
  verifyAdminToken,
  requirePermission('canManageProviders'),
  adminController.approveProvider
);

/**
 * @route   PUT /api/admin/providers/:id/reject
 * @desc    Reject provider with reason
 * @access  Private (Admin with canManageProviders permission)
 */
router.put(
  '/providers/:id/reject',
  verifyAdminToken,
  requirePermission('canManageProviders'),
  adminController.rejectProvider
);

// ============ USER MANAGEMENT ============

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with search and pagination
 * @access  Private (Admin with canManageUsers permission)
 */
router.get(
  '/users',
  verifyAdminToken,
  requirePermission('canManageUsers'),
  adminController.getAllUsers
);

/**
 * @route   PUT /api/admin/users/:id/toggle-status
 * @desc    Toggle user active/inactive status
 * @access  Private (Admin with canManageUsers permission)
 */
router.put(
  '/users/:id/toggle-status',
  verifyAdminToken,
  requirePermission('canManageUsers'),
  adminController.toggleUserStatus
);

// ============ ADMIN MANAGEMENT (Super-Admin Only) ============

/**
 * @route   POST /api/admin/admins
 * @desc    Create new admin
 * @access  Private (Super-Admin only)
 */
router.post(
  '/admins',
  verifyAdminToken,
  requireSuperAdmin,
  adminController.createAdmin
);

// ============ CATEGORY MANAGEMENT ============

/**
 * @route   POST /api/admin/categories
 * @desc    Create new category
 * @access  Private (Admin with canManageSettings permission)
 */
router.post(
  '/categories',
  verifyAdminToken,
  requirePermission('canManageSettings'),
  categoryController.createCategory
);

/**
 * @route   GET /api/admin/categories
 * @desc    Get all categories (including inactive)
 * @access  Private (Admin)
 */
router.get(
  '/categories',
  verifyAdminToken,
  categoryController.getAllCategoriesAdmin
);

/**
 * @route   GET /api/admin/categories/:id
 * @desc    Get category by ID
 * @access  Private (Admin)
 */
router.get(
  '/categories/:id',
  verifyAdminToken,
  categoryController.getCategoryByIdAdmin
);

/**
 * @route   PUT /api/admin/categories/:id
 * @desc    Update category
 * @access  Private (Admin with canManageSettings permission)
 */
router.put(
  '/categories/:id',
  verifyAdminToken,
  requirePermission('canManageSettings'),
  categoryController.updateCategory
);

/**
 * @route   PUT /api/admin/categories/:id/toggle-status
 * @desc    Toggle category active/inactive status
 * @access  Private (Admin with canManageSettings permission)
 */
router.put(
  '/categories/:id/toggle-status',
  verifyAdminToken,
  requirePermission('canManageSettings'),
  categoryController.toggleCategoryStatus
);

/**
 * @route   DELETE /api/admin/categories/:id
 * @desc    Delete category
 * @access  Private (Admin with canManageSettings permission)
 */
router.delete(
  '/categories/:id',
  verifyAdminToken,
  requirePermission('canManageSettings'),
  categoryController.deleteCategory
);

module.exports = router;
