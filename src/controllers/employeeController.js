const Employee = require('../models/Employee');
const EmployeeService = require('../models/EmployeeService');
const BusinessOwner = require('../models/BusinessOwner');
const Category = require('../models/Category');
const mongoose = require('mongoose');
const fs = require('fs').promises;
const { uploadToCloudinary } = require('../utility/cloudinary');

/**
 * Helper function to verify business owner access
 */
const verifyBusinessOwnerAccess = async (req, employeeId = null) => {
  const businessOwner = await BusinessOwner.findOne({ userId: req.user._id });

  if (!businessOwner) {
    throw new Error('Business owner profile not found');
  }

  if (employeeId) {
    const employee = await Employee.findOne({
      _id: employeeId,
      businessOwnerId: businessOwner._id,
      isActive: true
    });

    if (!employee) {
      throw new Error('Employee not found or access denied');
    }

    return { businessOwner, employee };
  }

  return { businessOwner };
};

/**
 * Create employee with first service (atomic transaction)
 * POST /api/business-owners/employees
 */
exports.createEmployeeWithService = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      fullName,
      mobileNumber,
      email,
      headline,
      description,
      categories,
      whyChooseService,
      basePrice,
      appointmentEnabled,
      appointmentSlots
    } = req.body;

    // Validate required fields
    if (!fullName || !mobileNumber || !email) {
      return res.status(400).json({
        success: false,
        message: 'Employee full name, mobile number, and email are required'
      });
    }

    if (!headline || !description) {
      return res.status(400).json({
        success: false,
        message: 'Service headline and description are required'
      });
    }

    // Validate service photo uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Service photo is required'
      });
    }

    // Parse categories
    let parsedCategories;
    try {
      parsedCategories = JSON.parse(categories);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid categories format'
      });
    }

    if (!parsedCategories || parsedCategories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one category is required'
      });
    }

    // Validate categories exist
    const existingCategories = await Category.find({
      _id: { $in: parsedCategories },
      isActive: true
    });

    if (existingCategories.length !== parsedCategories.length) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({
        success: false,
        message: 'One or more invalid categories'
      });
    }

    // Parse why choose service
    let parsedWhyChoose = {
      reason1: '',
      reason2: '',
      reason3: '',
      reason4: ''
    };
    if (whyChooseService) {
      try {
        parsedWhyChoose = JSON.parse(whyChooseService);
      } catch (error) {
        // Use default if parsing fails
      }
    }

    // Validate pricing
    const isAppointmentEnabled = appointmentEnabled === 'true' || appointmentEnabled === true;

    if (isAppointmentEnabled) {
      let parsedSlots;
      try {
        parsedSlots = JSON.parse(appointmentSlots);
      } catch (error) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          success: false,
          message: 'Invalid appointment slots format'
        });
      }

      if (!parsedSlots || parsedSlots.length === 0) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          success: false,
          message: 'At least one appointment slot is required when appointment is enabled'
        });
      }
    } else {
      if (!basePrice || parseFloat(basePrice) <= 0) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          success: false,
          message: 'Base price is required when appointment is disabled'
        });
      }
    }

    // Get business owner
    const { businessOwner } = await verifyBusinessOwnerAccess(req);

    // Upload service photo to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.path, 'employee-services');

    if (!uploadResult.success) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(500).json({
        success: false,
        message: 'Failed to upload service photo'
      });
    }

    // Create Employee
    const employee = new Employee({
      businessOwnerId: businessOwner._id,
      fullName,
      mobileNumber,
      email,
      isActive: true
    });

    await employee.save({ session });

    // Create EmployeeService
    const serviceData = {
      employeeId: employee._id,
      businessOwnerId: businessOwner._id,
      servicePhoto: uploadResult.url,
      categories: parsedCategories,
      headline,
      description,
      whyChooseService: parsedWhyChoose,
      appointmentEnabled: isAppointmentEnabled,
      isActive: true
    };

    if (isAppointmentEnabled) {
      serviceData.appointmentSlots = JSON.parse(appointmentSlots);
      serviceData.basePrice = 0;
    } else {
      serviceData.basePrice = parseFloat(basePrice);
      serviceData.appointmentSlots = [];
    }

    const employeeService = new EmployeeService(serviceData);
    await employeeService.save({ session });

    // Commit transaction
    await session.commitTransaction();

    // Cleanup local file
    await fs.unlink(req.file.path).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Employee and service created successfully',
      data: {
        employee,
        service: employeeService
      }
    });

  } catch (error) {
    await session.abortTransaction();

    // Cleanup uploaded file
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    console.error('Create employee error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'An error occurred while creating employee',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    session.endSession();
  }
};

/**
 * List all employees for business owner
 * GET /api/business-owners/employees
 */
exports.listEmployees = async (req, res) => {
  try {
    const { businessOwner } = await verifyBusinessOwnerAccess(req);

    // Get employees with service count
    const employees = await Employee.aggregate([
      {
        $match: {
          businessOwnerId: businessOwner._id,
          isActive: true
        }
      },
      {
        $lookup: {
          from: 'employeeservices',
          localField: '_id',
          foreignField: 'employeeId',
          as: 'services'
        }
      },
      {
        $addFields: {
          serviceCount: {
            $size: {
              $filter: {
                input: '$services',
                as: 'service',
                cond: { $eq: ['$$service.isActive', true] }
              }
            }
          }
        }
      },
      {
        $project: {
          fullName: 1,
          mobileNumber: 1,
          email: 1,
          isActive: 1,
          serviceCount: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      count: employees.length,
      data: employees
    });

  } catch (error) {
    console.error('List employees error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'An error occurred while fetching employees'
    });
  }
};

/**
 * Get employee detail with all services
 * GET /api/business-owners/employees/:id
 */
exports.getEmployeeDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const { employee } = await verifyBusinessOwnerAccess(req, id);

    // Get all services for this employee
    const services = await EmployeeService.find({
      employeeId: id,
      isActive: true
    }).populate('categories', 'name');

    res.status(200).json({
      success: true,
      data: {
        employee,
        services
      }
    });

  } catch (error) {
    console.error('Get employee detail error:', error);
    res.status(error.message === 'Employee not found or access denied' ? 404 : 500).json({
      success: false,
      message: error.message || 'An error occurred while fetching employee details'
    });
  }
};

/**
 * Update employee information
 * PUT /api/business-owners/employees/:id
 */
exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, mobileNumber, email } = req.body;

    const { employee } = await verifyBusinessOwnerAccess(req, id);

    // Update fields if provided
    if (fullName) employee.fullName = fullName;
    if (mobileNumber) employee.mobileNumber = mobileNumber;
    if (email) employee.email = email;

    await employee.save();

    res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      data: employee
    });

  } catch (error) {
    console.error('Update employee error:', error);
    res.status(error.message === 'Employee not found or access denied' ? 404 : 500).json({
      success: false,
      message: error.message || 'An error occurred while updating employee'
    });
  }
};

/**
 * Delete employee (cascade soft delete all services)
 * DELETE /api/business-owners/employees/:id
 */
exports.deleteEmployee = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const { employee } = await verifyBusinessOwnerAccess(req, id);

    // Soft delete employee
    employee.isActive = false;
    await employee.save({ session });

    // Cascade soft delete all services
    await EmployeeService.updateMany(
      { employeeId: id },
      { $set: { isActive: false } },
      { session }
    );

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Employee and associated services deleted successfully'
    });

  } catch (error) {
    await session.abortTransaction();

    console.error('Delete employee error:', error);
    res.status(error.message === 'Employee not found or access denied' ? 404 : 500).json({
      success: false,
      message: error.message || 'An error occurred while deleting employee'
    });
  } finally {
    session.endSession();
  }
};

/**
 * Add service to existing employee
 * POST /api/business-owners/employees/:employeeId/services
 */
exports.addService = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const {
      headline,
      description,
      categories,
      whyChooseService,
      basePrice,
      appointmentEnabled,
      appointmentSlots
    } = req.body;

    // Validate required fields
    if (!headline || !description) {
      return res.status(400).json({
        success: false,
        message: 'Service headline and description are required'
      });
    }

    // Validate service photo uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Service photo is required'
      });
    }

    // Verify employee access
    const { employee, businessOwner } = await verifyBusinessOwnerAccess(req, employeeId);

    // Parse and validate categories
    let parsedCategories;
    try {
      parsedCategories = JSON.parse(categories);
    } catch (error) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({
        success: false,
        message: 'Invalid categories format'
      });
    }

    const existingCategories = await Category.find({
      _id: { $in: parsedCategories },
      isActive: true
    });

    if (existingCategories.length !== parsedCategories.length) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({
        success: false,
        message: 'One or more invalid categories'
      });
    }

    // Parse why choose service
    let parsedWhyChoose = {
      reason1: '',
      reason2: '',
      reason3: '',
      reason4: ''
    };
    if (whyChooseService) {
      try {
        parsedWhyChoose = JSON.parse(whyChooseService);
      } catch (error) {
        // Use default
      }
    }

    // Validate pricing
    const isAppointmentEnabled = appointmentEnabled === 'true' || appointmentEnabled === true;

    if (isAppointmentEnabled) {
      let parsedSlots;
      try {
        parsedSlots = JSON.parse(appointmentSlots);
      } catch (error) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          success: false,
          message: 'Invalid appointment slots format'
        });
      }

      if (!parsedSlots || parsedSlots.length === 0) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          success: false,
          message: 'At least one appointment slot is required'
        });
      }
    } else {
      if (!basePrice || parseFloat(basePrice) <= 0) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          success: false,
          message: 'Base price is required when appointment is disabled'
        });
      }
    }

    // Upload service photo
    const uploadResult = await uploadToCloudinary(req.file.path, 'employee-services');

    if (!uploadResult.success) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(500).json({
        success: false,
        message: 'Failed to upload service photo'
      });
    }

    // Create service
    const serviceData = {
      employeeId: employee._id,
      businessOwnerId: businessOwner._id,
      servicePhoto: uploadResult.url,
      categories: parsedCategories,
      headline,
      description,
      whyChooseService: parsedWhyChoose,
      appointmentEnabled: isAppointmentEnabled,
      isActive: true
    };

    if (isAppointmentEnabled) {
      serviceData.appointmentSlots = JSON.parse(appointmentSlots);
      serviceData.basePrice = 0;
    } else {
      serviceData.basePrice = parseFloat(basePrice);
      serviceData.appointmentSlots = [];
    }

    const employeeService = new EmployeeService(serviceData);
    await employeeService.save();

    // Cleanup local file
    await fs.unlink(req.file.path).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Service added successfully',
      data: employeeService
    });

  } catch (error) {
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    console.error('Add service error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'An error occurred while adding service'
    });
  }
};

/**
 * Get all services for an employee
 * GET /api/business-owners/employees/:employeeId/services
 */
exports.getEmployeeServices = async (req, res) => {
  try {
    const { employeeId } = req.params;

    await verifyBusinessOwnerAccess(req, employeeId);

    const services = await EmployeeService.find({
      employeeId,
      isActive: true
    }).populate('categories', 'name');

    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });

  } catch (error) {
    console.error('Get employee services error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'An error occurred while fetching services'
    });
  }
};

/**
 * Update employee service
 * PUT /api/business-owners/employees/:employeeId/services/:id
 */
exports.updateService = async (req, res) => {
  try {
    const { employeeId, id } = req.params;
    const {
      headline,
      description,
      categories,
      whyChooseService,
      basePrice,
      appointmentEnabled,
      appointmentSlots
    } = req.body;

    await verifyBusinessOwnerAccess(req, employeeId);

    const service = await EmployeeService.findOne({
      _id: id,
      employeeId,
      isActive: true
    });

    if (!service) {
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Update photo if provided
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.path, 'employee-services');

      if (uploadResult.success) {
        service.servicePhoto = uploadResult.url;
      }

      await fs.unlink(req.file.path).catch(() => {});
    }

    // Update fields if provided
    if (headline) service.headline = headline;
    if (description) service.description = description;

    if (categories) {
      try {
        const parsedCategories = JSON.parse(categories);
        const existingCategories = await Category.find({
          _id: { $in: parsedCategories },
          isActive: true
        });

        if (existingCategories.length === parsedCategories.length) {
          service.categories = parsedCategories;
        }
      } catch (error) {
        // Keep existing categories
      }
    }

    if (whyChooseService) {
      try {
        service.whyChooseService = JSON.parse(whyChooseService);
      } catch (error) {
        // Keep existing
      }
    }

    // Update pricing
    if (appointmentEnabled !== undefined) {
      const isAppointmentEnabled = appointmentEnabled === 'true' || appointmentEnabled === true;
      service.appointmentEnabled = isAppointmentEnabled;

      if (isAppointmentEnabled && appointmentSlots) {
        try {
          service.appointmentSlots = JSON.parse(appointmentSlots);
          service.basePrice = 0;
        } catch (error) {
          // Keep existing
        }
      } else if (!isAppointmentEnabled && basePrice) {
        service.basePrice = parseFloat(basePrice);
        service.appointmentSlots = [];
      }
    }

    await service.save();

    res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      data: service
    });

  } catch (error) {
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    console.error('Update service error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'An error occurred while updating service'
    });
  }
};

/**
 * Delete employee service
 * DELETE /api/business-owners/employees/:employeeId/services/:id
 */
exports.deleteService = async (req, res) => {
  try {
    const { employeeId, id } = req.params;

    await verifyBusinessOwnerAccess(req, employeeId);

    const service = await EmployeeService.findOne({
      _id: id,
      employeeId,
      isActive: true
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    service.isActive = false;
    await service.save();

    res.status(200).json({
      success: true,
      message: 'Service deleted successfully'
    });

  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'An error occurred while deleting service'
    });
  }
};
