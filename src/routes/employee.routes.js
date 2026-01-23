const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { uploadEmployeeServicePhoto, uploadEmployeeFiles, handleUploadError } = require('../middleware/upload');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/business-owners/employees
 * @desc    Create employee with first service
 * @access  Private (Business Owner only)
 */
router.post(
  '/',
  auth,
  uploadEmployeeFiles,
  handleUploadError,
  employeeController.createEmployeeWithService
);

/**
 * @route   GET /api/business-owners/employees
 * @desc    List all employees for business owner
 * @access  Private (Business Owner only)
 */
router.get(
  '/',
  auth,
  employeeController.listEmployees
);

/**
 * @route   GET /api/business-owners/employees/search
 * @desc    Search employees for business owner
 * @access  Private (Business Owner only)
 * @query   q, page, limit
 */
router.get(
  '/search',
  auth,
  employeeController.searchEmployees
);

/**
 * @route   GET /api/business-owners/employees/:id/overview
 * @desc    Get employee overview, activities, and orders
 * @access  Private (Business Owner only)
 */
router.get(
  '/:id/overview',
  auth,
  employeeController.getEmployeeOverview
);

/**
 * @route   GET /api/business-owners/employees/:id
 * @desc    Get employee detail with all services
 * @access  Private (Business Owner only)
 */
router.get(
  '/:id',
  auth,
  employeeController.getEmployeeDetail
);

/**
 * @route   GET /api/business-owners/employees/:id/phone
 * @desc    Get employee phone number
 * @access  Private (Business Owner only)
 */
router.get(
  '/:id/phone',
  auth,
  employeeController.getEmployeePhoneNumber
);

/**
 * @route   PUT /api/business-owners/employees/:id
 * @desc    Update employee information
 * @access  Private (Business Owner only)
 */
router.put(
  '/:id',
  auth,
  uploadEmployeeFiles,
  handleUploadError,
  employeeController.updateEmployee
);

/**
 * @route   PATCH /api/business-owners/employees/:id/toggle-status
 * @desc    Block/unblock employee
 * @access  Private (Business Owner only)
 */
router.patch(
  '/:id/toggle-status',
  auth,
  employeeController.toggleEmployeeStatus
);

/**
 * @route   DELETE /api/business-owners/employees/:id
 * @desc    Delete employee (cascade soft delete services)
 * @access  Private (Business Owner only)
 */
router.delete(
  '/:id',
  auth,
  employeeController.deleteEmployee
);

/**
 * @route   POST /api/business-owners/employees/:employeeId/services
 * @desc    Add service to existing employee
 * @access  Private (Business Owner only)
 */
router.post(
  '/:employeeId/services',
  auth,
  uploadEmployeeServicePhoto,
  handleUploadError,
  employeeController.addService
);

/**
 * @route   GET /api/business-owners/employees/:employeeId/services
 * @desc    Get all services for an employee
 * @access  Private (Business Owner only)
 */
router.get(
  '/:employeeId/services',
  auth,
  employeeController.getEmployeeServices
);

/**
 * @route   PUT /api/business-owners/employees/:employeeId/services/:id
 * @desc    Update employee service
 * @access  Private (Business Owner only)
 */
router.put(
  '/:employeeId/services/:id',
  auth,
  uploadEmployeeServicePhoto,
  handleUploadError,
  employeeController.updateService
);

/**
 * @route   DELETE /api/business-owners/employees/:employeeId/services/:id
 * @desc    Delete employee service
 * @access  Private (Business Owner only)
 */
router.delete(
  '/:employeeId/services/:id',
  auth,
  employeeController.deleteService
);

module.exports = router;
