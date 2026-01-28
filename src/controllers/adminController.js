const Admin = require('../models/Admin');
const User = require('../models/User');
const Provider = require('../models/Provider');
const BusinessOwner = require('../models/BusinessOwner');
const EventManager = require('../models/EventManager');
const Settings = require('../models/Settings');
const Employee = require('../models/Employee');
const EmployeeService = require('../models/EmployeeService');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const Appointment = require('../models/Appointment');
const BusinessOwnerBooking = require('../models/BusinessOwnerBooking');
const BusinessOwnerAppointment = require('../models/BusinessOwnerAppointment');
const AdminRefreshToken = require('../models/AdminRefreshToken');
const { generateAccessToken, generateRefreshToken, getTokenExpiresIn, verifyRefreshToken } = require('../utility/jwt');
const { deleteFromCloudinary } = require('../utility/cloudinary');
const crypto = require('crypto');

// Simple HTML sanitizer function to prevent XSS
// For production, consider using a library like 'sanitize-html' or 'DOMPurify'
const sanitizeHtml = (html) => {
  if (!html) return '';

  // Remove script tags and their content
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers
  clean = clean.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  clean = clean.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');

  // Remove javascript: URLs
  clean = clean.replace(/javascript\s*:/gi, '');

  return clean;
};

/**
 * Admin Login
 * POST /api/admin/login
 */
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find admin by email and include password
    const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password');

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your admin account has been deactivated. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await admin.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await admin.updateLastLogin();

    const tokenPayload = {
      adminId: admin._id,
      role: admin.role
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    const accessExpiresIn = getTokenExpiresIn('access');
    const refreshExpiresIn = getTokenExpiresIn('refresh');
    const refreshExpiresAt = new Date(Date.now() + refreshExpiresIn * 1000);

    await AdminRefreshToken.create({
      adminId: admin._id,
      token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
      expiresAt: refreshExpiresAt,
      deviceInfo: {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress
      }
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        admin: {
          id: admin._id,
          fullName: admin.fullName,
          email: admin.email,
          role: admin.role,
          permissions: admin.permissions,
          lastLogin: admin.lastLogin
        },
        accessToken,
        refreshToken,
        expiresIn: accessExpiresIn,
        tokenType: 'Bearer'
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login',
      error: error.message
    });
  }
};

/**
 * Refresh Admin Access Token
 * POST /api/admin/refresh-token
 */
exports.refreshAdminToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    if (!decoded.adminId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token type'
      });
    }

    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const storedToken = await AdminRefreshToken.findOne({
      token: hashedToken,
      adminId: decoded.adminId
    });

    if (!storedToken || !storedToken.isValid()) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    const admin = await Admin.findById(decoded.adminId);
    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Admin not found or inactive'
      });
    }

    const tokenPayload = {
      adminId: admin._id,
      role: admin.role
    };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    const refreshExpiresIn = getTokenExpiresIn('refresh');
    const refreshExpiresAt = new Date(Date.now() + refreshExpiresIn * 1000);

    storedToken.isRevoked = true;
    storedToken.lastUsedAt = new Date();
    await storedToken.save();

    await AdminRefreshToken.create({
      adminId: admin._id,
      token: crypto.createHash('sha256').update(newRefreshToken).digest('hex'),
      expiresAt: refreshExpiresAt,
      deviceInfo: {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress
      }
    });

    const accessExpiresIn = getTokenExpiresIn('access');

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: accessExpiresIn,
        tokenType: 'Bearer'
      }
    });
  } catch (error) {
    console.error('Admin token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Error refreshing token',
      error: error.message
    });
  }
};

/**
 * Get Admin Profile
 * GET /api/admin/me
 */
exports.getAdminProfile = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        admin: req.admin
      }
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching admin profile',
      error: error.message
    });
  }
};

/**
 * Get Dashboard Statistics
 * GET /api/admin/dashboard/stats
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const { year } = req.query;
    const reportYear = parseInt(year, 10) || new Date().getFullYear();
    const startOfYear = new Date(Date.UTC(reportYear, 0, 1));
    const endOfYear = new Date(Date.UTC(reportYear + 1, 0, 1));

    // Get counts
    const totalUsers = await User.countDocuments({ userType: 'user' });
    const totalProviders = await Provider.countDocuments();
    const totalBusinessOwners = await BusinessOwner.countDocuments();
    const totalEventManagers = await EventManager.countDocuments();
    const pendingProviders = await Provider.countDocuments({ verificationStatus: 'pending' });
    const approvedProviders = await Provider.countDocuments({ verificationStatus: 'approved' });
    const rejectedProviders = await Provider.countDocuments({ verificationStatus: 'rejected' });

    const paidStatuses = ['partial', 'completed', 'offline_paid'];

    const [
      bookingEarnings,
      appointmentEarnings,
      boBookingEarnings,
      boAppointmentEarnings
    ] = await Promise.all([
      Booking.aggregate([
        { $match: { paymentStatus: { $in: paidStatuses } } },
        { $group: { _id: null, total: { $sum: '$platformFee' } } }
      ]),
      Appointment.aggregate([
        { $match: { paymentStatus: { $in: ['completed', 'offline_paid'] } } },
        { $group: { _id: null, total: { $sum: '$platformFee' } } }
      ]),
      BusinessOwnerBooking.aggregate([
        { $match: { paymentStatus: { $in: paidStatuses } } },
        { $group: { _id: null, total: { $sum: '$platformFee' } } }
      ]),
      BusinessOwnerAppointment.aggregate([
        { $match: { paymentStatus: { $in: ['completed', 'offline_paid'] } } },
        { $group: { _id: null, total: { $sum: '$platformFee' } } }
      ])
    ]);

    const totalEarnings =
      (bookingEarnings[0]?.total || 0) +
      (appointmentEarnings[0]?.total || 0) +
      (boBookingEarnings[0]?.total || 0) +
      (boAppointmentEarnings[0]?.total || 0);

    const monthlyPipeline = (match, collection) =>
      collection.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $month: '$createdAt' },
            total: { $sum: '$platformFee' }
          }
        }
      ]);

    const [monthlyBooking, monthlyAppointment, monthlyBoBooking, monthlyBoAppointment] =
      await Promise.all([
        monthlyPipeline(
          { paymentStatus: { $in: paidStatuses }, createdAt: { $gte: startOfYear, $lt: endOfYear } },
          Booking
        ),
        monthlyPipeline(
          { paymentStatus: { $in: ['completed', 'offline_paid'] }, createdAt: { $gte: startOfYear, $lt: endOfYear } },
          Appointment
        ),
        monthlyPipeline(
          { paymentStatus: { $in: paidStatuses }, createdAt: { $gte: startOfYear, $lt: endOfYear } },
          BusinessOwnerBooking
        ),
        monthlyPipeline(
          { paymentStatus: { $in: ['completed', 'offline_paid'] }, createdAt: { $gte: startOfYear, $lt: endOfYear } },
          BusinessOwnerAppointment
        )
      ]);

    const monthlyTotals = Array.from({ length: 12 }, () => 0);
    const addMonthly = (items) => {
      items.forEach((row) => {
        const idx = row._id - 1;
        if (idx >= 0 && idx < 12) monthlyTotals[idx] += row.total || 0;
      });
    };
    addMonthly(monthlyBooking);
    addMonthly(monthlyAppointment);
    addMonthly(monthlyBoBooking);
    addMonthly(monthlyBoAppointment);

    // Get recent registrations
    const recentUsers = await User.find({ userType: 'user' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('fullName email createdAt isActive');

    const recentProviders = await Provider.find()
      .populate('userId', 'fullName email phoneNumber')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totals: {
            totalEarnings,
            totalUsers,
            totalProviders,
            totalBusinessOwners,
            totalEventManagers
          },
          users: {
            total: totalUsers
          },
          providers: {
            total: totalProviders,
            pending: pendingProviders,
            approved: approvedProviders,
            rejected: rejectedProviders
          },
          earnings: {
            year: reportYear,
            monthly: monthlyTotals
          }
        },
        recent: {
          users: recentUsers,
          providers: recentProviders
        }
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching dashboard statistics',
      error: error.message
    });
  }
};

/**
 * Get All Providers
 * GET /api/admin/providers
 */
exports.getAllProviders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) {
      query.verificationStatus = status;
    }

    const providers = await Provider.find(query)
      .populate('userId', 'fullName email phoneNumber isActive createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Provider.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        providers,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      }
    });

  } catch (error) {
    console.error('Get all providers error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching providers',
      error: error.message
    });
  }
};

/**
 * Get Provider Details
 * GET /api/admin/providers/:id
 */
exports.getProviderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const provider = await Provider.findById(id)
      .populate('userId', '-password -resetPasswordOTP -resetPasswordOTPExpires');

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        provider
      }
    });

  } catch (error) {
    console.error('Get provider details error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching provider details',
      error: error.message
    });
  }
};

/**
 * Approve Provider
 * PUT /api/admin/providers/:id/approve
 */
exports.approveProvider = async (req, res) => {
  try {
    const { id } = req.params;

    const provider = await Provider.findById(id);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    await provider.approve();

    res.status(200).json({
      success: true,
      message: 'Provider approved successfully',
      data: {
        provider
      }
    });

  } catch (error) {
    console.error('Approve provider error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while approving provider',
      error: error.message
    });
  }
};

/**
 * Reject Provider
 * PUT /api/admin/providers/:id/reject
 */
exports.rejectProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const provider = await Provider.findById(id);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    await provider.reject(reason);

    res.status(200).json({
      success: true,
      message: 'Provider rejected successfully',
      data: {
        provider
      }
    });

  } catch (error) {
    console.error('Reject provider error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while rejecting provider',
      error: error.message
    });
  }
};

/**
 * Get All Users
 * GET /api/admin/users
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    const query = { userType: 'user' };

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-password -resetPasswordOTP -resetPasswordOTPExpires');

    const count = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        users,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      }
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching users',
      error: error.message
    });
  }
};

/**
 * Get Transactions (Admin)
 * GET /api/admin/transactions
 * @query type, status, page, limit, search, from, to
 */
exports.getTransactions = async (req, res) => {
  try {
    const {
      type = 'all',
      status,
      page = 1,
      limit = 20,
      search,
      from,
      to
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startDate = from ? new Date(from) : null;
    const endDate = to ? new Date(to) : null;

    const buildDateQuery = () => {
      if (!startDate && !endDate) return {};
      const range = {};
      if (startDate && !Number.isNaN(startDate.getTime())) range.$gte = startDate;
      if (endDate && !Number.isNaN(endDate.getTime())) range.$lte = endDate;
      return Object.keys(range).length ? { createdAt: range } : {};
    };

    const dateQuery = buildDateQuery();

    const matchPaymentStatus = status ? { paymentStatus: status } : {};
    const searchRegex = search ? new RegExp(search, 'i') : null;

    const results = [];

    if (type === 'all' || type === 'provider') {
      const providerBookingQuery = { ...dateQuery, ...matchPaymentStatus };
      const providerAppointmentQuery = { ...dateQuery, ...matchPaymentStatus };

      const [bookings, appointments] = await Promise.all([
        Booking.find(providerBookingQuery)
          .populate('userId', 'fullName email phoneNumber bankInformation')
          .populate({
            path: 'providerId',
            populate: { path: 'userId', select: 'fullName email phoneNumber bankInformation' }
          }),
        Appointment.find(providerAppointmentQuery)
          .populate('userId', 'fullName email phoneNumber bankInformation')
          .populate({
            path: 'providerId',
            populate: { path: 'userId', select: 'fullName email phoneNumber bankInformation' }
          })
      ]);

      bookings.forEach((b) => {
        const userName = b.userId?.fullName || '';
        const providerName = b.providerId?.userId?.fullName || '';
        if (searchRegex && !searchRegex.test(userName) && !searchRegex.test(providerName)) return;
        results.push({
          source: 'user_provider_booking',
          orderId: b._id,
          transactionId: b.paymentIntentId || b.duePaymentIntentId || b.checkoutSessionId || null,
          userName,
          providerName,
          paymentStatus: b.paymentStatus,
          paymentIntentStatus: b.paymentIntentStatus,
          duePaymentIntentStatus: b.duePaymentIntentStatus,
          amount: b.totalAmount,
          downPayment: b.downPayment,
          dueAmount: b.dueAmount,
          remainingAmount: b.remainingAmount,
          paidVia: b.paidVia,
          status: b.bookingStatus,
          date: b.createdAt,
          paidAt: b.duePaidAt || b.offlinePaidAt || null,
          userBankInformation: b.userId?.bankInformation || null,
          providerBankInformation: b.providerId?.userId?.bankInformation || null
        });
      });

      appointments.forEach((a) => {
        const userName = a.userId?.fullName || '';
        const providerName = a.providerId?.userId?.fullName || '';
        if (searchRegex && !searchRegex.test(userName) && !searchRegex.test(providerName)) return;
        results.push({
          source: 'user_provider_appointment',
          orderId: a._id,
          transactionId: a.paymentIntentId || a.checkoutSessionId || null,
          userName,
          providerName,
          paymentStatus: a.paymentStatus,
          paymentIntentStatus: a.paymentIntentStatus,
          duePaymentIntentStatus: null,
          amount: a.totalAmount,
          downPayment: a.downPayment,
          dueAmount: 0,
          remainingAmount: a.remainingAmount,
          paidVia: a.paidVia,
          status: a.appointmentStatus,
          date: a.createdAt,
          paidAt: a.paidAt || null,
          userBankInformation: a.userId?.bankInformation || null,
          providerBankInformation: a.providerId?.userId?.bankInformation || null
        });
      });
    }

    if (type === 'all' || type === 'businessOwner') {
      const boBookingQuery = { ...dateQuery, ...matchPaymentStatus };
      const boAppointmentQuery = { ...dateQuery, ...matchPaymentStatus };

      const [boBookings, boAppointments] = await Promise.all([
        BusinessOwnerBooking.find(boBookingQuery)
          .populate('userId', 'fullName email phoneNumber bankInformation')
          .populate({
            path: 'businessOwnerId',
            populate: { path: 'userId', select: 'fullName email phoneNumber' }
          }),
        BusinessOwnerAppointment.find(boAppointmentQuery)
          .populate('userId', 'fullName email phoneNumber bankInformation')
          .populate({
            path: 'businessOwnerId',
            populate: { path: 'userId', select: 'fullName email phoneNumber' }
          })
      ]);

      boBookings.forEach((b) => {
        const userName = b.userId?.fullName || '';
        const businessOwnerName = b.businessOwnerId?.userId?.fullName || '';
        if (searchRegex && !searchRegex.test(userName) && !searchRegex.test(businessOwnerName)) return;
        results.push({
          source: 'user_business_owner_booking',
          orderId: b._id,
          transactionId: b.paymentIntentId || b.duePaymentIntentId || b.checkoutSessionId || null,
          userName,
          businessOwnerName,
          paymentStatus: b.paymentStatus,
          paymentIntentStatus: b.paymentIntentStatus,
          duePaymentIntentStatus: b.duePaymentIntentStatus,
          amount: b.totalAmount,
          downPayment: b.downPayment,
          dueAmount: b.dueAmount,
          remainingAmount: b.remainingAmount,
          paidVia: b.paidVia,
          status: b.bookingStatus,
          date: b.createdAt,
          paidAt: b.duePaidAt || b.offlinePaidAt || null,
          userBankInformation: b.userId?.bankInformation || null,
          businessOwnerBankInformation: b.businessOwnerId?.bankInformation || null
        });
      });

      boAppointments.forEach((a) => {
        const userName = a.userId?.fullName || '';
        const businessOwnerName = a.businessOwnerId?.userId?.fullName || '';
        if (searchRegex && !searchRegex.test(userName) && !searchRegex.test(businessOwnerName)) return;
        results.push({
          source: 'user_business_owner_appointment',
          orderId: a._id,
          transactionId: a.paymentIntentId || a.checkoutSessionId || null,
          userName,
          businessOwnerName,
          paymentStatus: a.paymentStatus,
          paymentIntentStatus: a.paymentIntentStatus,
          duePaymentIntentStatus: null,
          amount: a.totalAmount,
          downPayment: a.downPayment,
          dueAmount: 0,
          remainingAmount: a.remainingAmount,
          paidVia: a.paidVia,
          status: a.appointmentStatus,
          date: a.createdAt,
          paidAt: a.paidAt || null,
          userBankInformation: a.userId?.bankInformation || null,
          businessOwnerBankInformation: a.businessOwnerId?.bankInformation || null
        });
      });
    }

    if (type === 'all' || type === 'eventManager') {
      const ticketQuery = { ...dateQuery, ...matchPaymentStatus };

      const ticketPurchases = await EventTicketPurchase.find(ticketQuery)
        .populate('userId', 'fullName email phoneNumber bankInformation')
        .populate('eventId', 'eventName eventLocation eventStartDateTime eventEndDateTime ticketPrice')
        .populate({
          path: 'eventManagerId',
          populate: { path: 'userId', select: 'fullName email phoneNumber' }
        });

      ticketPurchases.forEach((t) => {
        const userName = t.userId?.fullName || '';
        const eventManagerName = t.eventManagerId?.userId?.fullName || '';
        if (searchRegex && !searchRegex.test(userName) && !searchRegex.test(eventManagerName)) return;
        results.push({
          source: 'user_event_manager_ticket',
          orderId: t._id,
          transactionId: t.paymentIntentId || t.checkoutSessionId || null,
          userName,
          eventManagerName,
          paymentStatus: t.paymentStatus,
          paymentIntentStatus: t.paymentIntentStatus,
          duePaymentIntentStatus: null,
          amount: t.totalAmount,
          downPayment: 0,
          dueAmount: 0,
          remainingAmount: 0,
          paidVia: t.paymentStatus === 'completed' ? 'online' : null,
          status: t.paymentStatus,
          date: t.createdAt,
          paidAt: t.paidAt || null,
          userBankInformation: t.userId?.bankInformation || null,
          eventManagerBankInformation: null,
          event: {
            id: t.eventId?._id || null,
            name: t.eventId?.eventName || null,
            location: t.eventId?.eventLocation || null,
            startDateTime: t.eventId?.eventStartDateTime || null,
            endDateTime: t.eventId?.eventEndDateTime || null
          },
          quantity: t.quantity
        });
      });
    }

    results.sort((a, b) => new Date(b.date) - new Date(a.date));

    const total = results.length;
    const totalPages = Math.ceil(total / limitNum);
    const start = (pageNum - 1) * limitNum;
    const data = results.slice(start, start + limitNum);

    res.status(200).json({
      success: true,
      data: {
        transactions: data,
        total,
        currentPage: pageNum,
        totalPages,
        filters: {
          type,
          status: status || null,
          search: search || null,
          from: from || null,
          to: to || null
        },
        eventManagerTransactionsSupported: true
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching transactions',
      error: error.message
    });
  }
};

/**
 * Get User by ID
 * GET /api/admin/users/:id
 */
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ _id: id, userType: 'user' })
      .select('-password -resetPasswordOTP -resetPasswordOTPExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching user',
      error: error.message
    });
  }
};

/**
 * Toggle User Active Status
 * PUT /api/admin/users/:id/toggle-status
 */
exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        user
      }
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating user status',
      error: error.message
    });
  }
};

/**
 * Delete User Account Permanently
 * DELETE /api/admin/users/:id
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Make sure we're only deleting regular users
    if (user.userType !== 'user') {
      return res.status(400).json({
        success: false,
        message: 'This endpoint is only for deleting regular users'
      });
    }

    // Delete profile picture from Cloudinary if exists
    if (user.profilePicture) {
      try {
        const urlParts = user.profilePicture.split('/');
        const publicIdWithExtension = urlParts.slice(-2).join('/');
        const publicId = publicIdWithExtension.split('.')[0];
        await deleteFromCloudinary(publicId);
      } catch (err) {
        console.error('Error deleting profile picture:', err);
      }
    }

    // Delete the user account
    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'User account deleted permanently'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while deleting user',
      error: error.message
    });
  }
};

/**
 * Toggle Provider Active Status (Block/Unblock)
 * PUT /api/admin/providers/:id/toggle-status
 */
exports.toggleProviderStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const provider = await Provider.findById(id);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Toggle the user's isActive status
    const user = await User.findById(provider.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `Provider ${user.isActive ? 'unblocked' : 'blocked'} successfully`,
      data: {
        provider: {
          id: provider._id,
          userId: user._id,
          fullName: user.fullName,
          email: user.email,
          isActive: user.isActive
        }
      }
    });

  } catch (error) {
    console.error('Toggle provider status error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating provider status',
      error: error.message
    });
  }
};

/**
 * Delete Provider Account Permanently
 * DELETE /api/admin/providers/:id
 */
exports.deleteProvider = async (req, res) => {
  try {
    const { id } = req.params;

    const provider = await Provider.findById(id);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    const userId = provider.userId;

    // Delete ID card images from Cloudinary if they exist
    if (provider.idCard?.frontImage) {
      try {
        const urlParts = provider.idCard.frontImage.split('/');
        const publicIdWithExtension = urlParts.slice(-2).join('/');
        const publicId = publicIdWithExtension.split('.')[0];
        await deleteFromCloudinary(publicId);
      } catch (err) {
        console.error('Error deleting front ID card image:', err);
      }
    }

    if (provider.idCard?.backImage) {
      try {
        const urlParts = provider.idCard.backImage.split('/');
        const publicIdWithExtension = urlParts.slice(-2).join('/');
        const publicId = publicIdWithExtension.split('.')[0];
        await deleteFromCloudinary(publicId);
      } catch (err) {
        console.error('Error deleting back ID card image:', err);
      }
    }

    // Delete profile picture from Cloudinary if exists
    const user = await User.findById(userId);
    if (user?.profilePicture) {
      try {
        const urlParts = user.profilePicture.split('/');
        const publicIdWithExtension = urlParts.slice(-2).join('/');
        const publicId = publicIdWithExtension.split('.')[0];
        await deleteFromCloudinary(publicId);
      } catch (err) {
        console.error('Error deleting profile picture:', err);
      }
    }

    // Delete the provider profile
    await Provider.findByIdAndDelete(id);

    // Delete the user account
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'Provider account deleted permanently'
    });

  } catch (error) {
    console.error('Delete provider error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while deleting provider',
      error: error.message
    });
  }
};

/**
 * Create New Admin (Super-admin only)
 * POST /api/admin/admins
 */
exports.createAdmin = async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;

    // Validate input
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, and password are required'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Validate role
    const validRoles = ['super-admin', 'admin'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this email already exists'
      });
    }

    // Create new admin
    const admin = new Admin({
      fullName,
      email: email.toLowerCase(),
      password,
      role: role || 'admin',
      createdBy: req.admin._id
    });

    await admin.save();

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: {
        admin: {
          id: admin._id,
          fullName: admin.fullName,
          email: admin.email,
          role: admin.role,
          permissions: admin.permissions,
          isActive: admin.isActive,
          createdAt: admin.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while creating admin',
      error: error.message
    });
  }
};

/**
 * Get All Admins (Super-admin only)
 * GET /api/admin/admins
 */
exports.getAllAdmins = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const admins = await Admin.find()
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-password -resetPasswordOTP -resetPasswordOTPExpires');

    const count = await Admin.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        admins,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        total: count
      }
    });

  } catch (error) {
    console.error('Get all admins error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching admins',
      error: error.message
    });
  }
};

/**
 * Get Admin by ID (Super-admin only)
 * GET /api/admin/admins/:id
 */
exports.getAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    const admin = await Admin.findById(id)
      .populate('createdBy', 'fullName email')
      .select('-password -resetPasswordOTP -resetPasswordOTPExpires');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        admin
      }
    });

  } catch (error) {
    console.error('Get admin by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching admin',
      error: error.message
    });
  }
};

/**
 * Update Admin (Super-admin only)
 * PUT /api/admin/admins/:id
 */
exports.updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, password, role, isActive } = req.body;

    const admin = await Admin.findById(id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Prevent super-admin from demoting themselves
    if (admin._id.toString() === req.admin._id.toString() && role && role !== 'super-admin') {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own role'
      });
    }

    // Check if email is being changed and already exists
    if (email && email.toLowerCase() !== admin.email) {
      const emailExists = await Admin.findOne({
        email: email.toLowerCase(),
        _id: { $ne: id }
      });

      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use by another admin'
        });
      }
    }

    // Validate role if provided
    if (role) {
      const validRoles = ['super-admin', 'admin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        });
      }
    }

    // Update fields
    if (fullName) admin.fullName = fullName;
    if (email) admin.email = email.toLowerCase();
    if (role) admin.role = role;
    if (isActive !== undefined) admin.isActive = isActive;

    // Update password if provided
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
      }
      admin.password = password;
    }

    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Admin updated successfully',
      data: {
        admin: {
          id: admin._id,
          fullName: admin.fullName,
          email: admin.email,
          role: admin.role,
          permissions: admin.permissions,
          isActive: admin.isActive,
          updatedAt: admin.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating admin',
      error: error.message
    });
  }
};

/**
 * Delete Admin (Super-admin only)
 * DELETE /api/admin/admins/:id
 */
exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent super-admin from deleting themselves
    if (id === req.admin._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const admin = await Admin.findById(id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    await Admin.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Admin deleted successfully'
    });

  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while deleting admin',
      error: error.message
    });
  }
};

/**
 * Toggle Admin Active Status (Super-admin only)
 * PUT /api/admin/admins/:id/toggle-status
 */
exports.toggleAdminStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent super-admin from deactivating themselves
    if (id === req.admin._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }

    const admin = await Admin.findById(id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    admin.isActive = !admin.isActive;
    await admin.save();

    res.status(200).json({
      success: true,
      message: `Admin ${admin.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        admin: {
          id: admin._id,
          fullName: admin.fullName,
          email: admin.email,
          isActive: admin.isActive
        }
      }
    });

  } catch (error) {
    console.error('Toggle admin status error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating admin status',
      error: error.message
    });
  }
};

/**
 * Get All Business Owners
 * GET /api/admin/business-owners
 */
exports.getAllBusinessOwners = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    // Build search query for users
    let userQuery = { userType: 'businessOwner' };

    if (search) {
      userQuery.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Find matching user IDs first
    const matchingUsers = await User.find(userQuery).select('_id');
    const userIds = matchingUsers.map(u => u._id);

    const businessOwners = await BusinessOwner.find({ userId: { $in: userIds } })
      .populate('userId', 'fullName email phoneNumber isActive createdAt profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await BusinessOwner.countDocuments({ userId: { $in: userIds } });

    res.status(200).json({
      success: true,
      data: {
        businessOwners,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        total: count
      }
    });

  } catch (error) {
    console.error('Get all business owners error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching business owners',
      error: error.message
    });
  }
};

/**
 * Get Business Owner Details
 * GET /api/admin/business-owners/:id
 */
exports.getBusinessOwnerDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const businessOwner = await BusinessOwner.findById(id)
      .populate('userId', '-password -resetPasswordOTP -resetPasswordOTPExpires')
      .populate('businessCategory', 'name')
      .populate('businessProfile.categories', 'name');

    if (!businessOwner) {
      return res.status(404).json({
        success: false,
        message: 'Business owner not found'
      });
    }

    const totalEmployees = await Employee.countDocuments({ businessOwnerId: businessOwner._id });

    res.status(200).json({
      success: true,
      data: {
        businessOwner: {
          ...businessOwner.toObject(),
          totalEmployees
        }
      }
    });

  } catch (error) {
    console.error('Get business owner details error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching business owner details',
      error: error.message
    });
  }
};

/**
 * Get Business Owner Employees
 * GET /api/admin/business-owners/:id/employees
 */
exports.getBusinessOwnerEmployees = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, search } = req.query;

    const businessOwner = await BusinessOwner.findById(id);
    if (!businessOwner) {
      return res.status(404).json({
        success: false,
        message: 'Business owner not found'
      });
    }

    const query = { businessOwnerId: id };
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobileNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const employees = await Employee.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Employee.countDocuments(query);

    const employeeIds = employees.map((e) => e._id);
    const serviceCounts = await EmployeeService.aggregate([
      { $match: { employeeId: { $in: employeeIds } } },
      { $group: { _id: '$employeeId', count: { $sum: 1 } } }
    ]);
    const serviceCountMap = new Map(serviceCounts.map((s) => [s._id.toString(), s.count]));

    const data = employees.map((e) => ({
      ...e.toObject(),
      serviceCount: serviceCountMap.get(e._id.toString()) || 0
    }));

    res.status(200).json({
      success: true,
      data: {
        businessOwnerId: id,
        employees: data,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        total: count
      }
    });
  } catch (error) {
    console.error('Get business owner employees error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching employees',
      error: error.message
    });
  }
};

/**
 * Get Employee Details (Admin)
 * GET /api/admin/employees/:id
 */
exports.getEmployeeDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findById(id)
      .populate('businessOwnerId', 'businessName businessCategory businessAddress');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const services = await EmployeeService.find({ employeeId: id })
      .select('headline description basePrice appointmentEnabled isActive servicePhoto category createdAt updatedAt');

    res.status(200).json({
      success: true,
      data: {
        employee,
        services
      }
    });
  } catch (error) {
    console.error('Get employee details error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching employee details',
      error: error.message
    });
  }
};

/**
 * Get Events for an Event Manager (Admin)
 * GET /api/admin/event-managers/:id/events
 */
exports.getEventManagerEvents = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, search, status } = req.query;

    const eventManager = await EventManager.findById(id);
    if (!eventManager) {
      return res.status(404).json({
        success: false,
        message: 'Event manager not found'
      });
    }

    const query = { eventManagerId: id };
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { eventName: { $regex: search, $options: 'i' } },
        { eventLocation: { $regex: search, $options: 'i' } },
        { eventManagerName: { $regex: search, $options: 'i' } }
      ];
    }

    const events = await Event.find(query)
      .sort({ eventStartDateTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        eventManagerId: id,
        events,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        total: count
      }
    });
  } catch (error) {
    console.error('Get event manager events error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching events',
      error: error.message
    });
  }
};

/**
 * Toggle Business Owner Active Status (Block/Unblock)
 * PUT /api/admin/business-owners/:id/toggle-status
 */
exports.toggleBusinessOwnerStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const businessOwner = await BusinessOwner.findById(id);

    if (!businessOwner) {
      return res.status(404).json({
        success: false,
        message: 'Business owner not found'
      });
    }

    // Toggle the user's isActive status
    const user = await User.findById(businessOwner.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `Business owner ${user.isActive ? 'unblocked' : 'blocked'} successfully`,
      data: {
        businessOwner: {
          id: businessOwner._id,
          userId: user._id,
          fullName: user.fullName,
          email: user.email,
          isActive: user.isActive
        }
      }
    });

  } catch (error) {
    console.error('Toggle business owner status error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating business owner status',
      error: error.message
    });
  }
};

/**
 * Delete Business Owner Account Permanently
 * DELETE /api/admin/business-owners/:id
 */
exports.deleteBusinessOwner = async (req, res) => {
  try {
    const { id } = req.params;

    const businessOwner = await BusinessOwner.findById(id);

    if (!businessOwner) {
      return res.status(404).json({
        success: false,
        message: 'Business owner not found'
      });
    }

    const userId = businessOwner.userId;

    // Delete ID card images from Cloudinary if they exist
    if (businessOwner.idCard?.frontImage) {
      try {
        const urlParts = businessOwner.idCard.frontImage.split('/');
        const publicIdWithExtension = urlParts.slice(-2).join('/');
        const publicId = publicIdWithExtension.split('.')[0];
        await deleteFromCloudinary(publicId);
      } catch (err) {
        console.error('Error deleting front ID card image:', err);
      }
    }

    if (businessOwner.idCard?.backImage) {
      try {
        const urlParts = businessOwner.idCard.backImage.split('/');
        const publicIdWithExtension = urlParts.slice(-2).join('/');
        const publicId = publicIdWithExtension.split('.')[0];
        await deleteFromCloudinary(publicId);
      } catch (err) {
        console.error('Error deleting back ID card image:', err);
      }
    }

    // Delete profile picture from Cloudinary if exists
    const user = await User.findById(userId);
    if (user?.profilePicture) {
      try {
        const urlParts = user.profilePicture.split('/');
        const publicIdWithExtension = urlParts.slice(-2).join('/');
        const publicId = publicIdWithExtension.split('.')[0];
        await deleteFromCloudinary(publicId);
      } catch (err) {
        console.error('Error deleting profile picture:', err);
      }
    }

    // Delete the business owner profile
    await BusinessOwner.findByIdAndDelete(id);

    // Delete the user account
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'Business owner account deleted permanently'
    });

  } catch (error) {
    console.error('Delete business owner error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while deleting business owner',
      error: error.message
    });
  }
};

// ============ EVENT MANAGER MANAGEMENT ============

/**
 * Get All Event Managers with Search and Pagination
 * GET /api/admin/event-managers
 */
exports.getAllEventManagers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    // Build search query for users
    let userQuery = { userType: 'eventManager' };

    if (search) {
      userQuery.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Find matching user IDs first
    const matchingUsers = await User.find(userQuery).select('_id');
    const userIds = matchingUsers.map(u => u._id);

    const eventManagers = await EventManager.find({ userId: { $in: userIds } })
      .populate('userId', 'fullName email phoneNumber isActive createdAt profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await EventManager.countDocuments({ userId: { $in: userIds } });

    res.status(200).json({
      success: true,
      data: {
        eventManagers,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        total: count
      }
    });

  } catch (error) {
    console.error('Get all event managers error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching event managers',
      error: error.message
    });
  }
};

/**
 * Get Event Manager Details
 * GET /api/admin/event-managers/:id
 */
exports.getEventManagerDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const eventManager = await EventManager.findById(id)
      .populate('userId', '-password -resetPasswordOTP -resetPasswordOTPExpires');

    if (!eventManager) {
      return res.status(404).json({
        success: false,
        message: 'Event manager not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        eventManager
      }
    });

  } catch (error) {
    console.error('Get event manager details error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching event manager details',
      error: error.message
    });
  }
};

/**
 * Toggle Event Manager Active Status (Block/Unblock)
 * PUT /api/admin/event-managers/:id/toggle-status
 */
exports.toggleEventManagerStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const eventManager = await EventManager.findById(id);

    if (!eventManager) {
      return res.status(404).json({
        success: false,
        message: 'Event manager not found'
      });
    }

    // Toggle the user's isActive status
    const user = await User.findById(eventManager.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `Event manager ${user.isActive ? 'unblocked' : 'blocked'} successfully`,
      data: {
        eventManager: {
          id: eventManager._id,
          userId: user._id,
          fullName: user.fullName,
          email: user.email,
          isActive: user.isActive
        }
      }
    });

  } catch (error) {
    console.error('Toggle event manager status error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating event manager status',
      error: error.message
    });
  }
};

/**
 * Delete Event Manager Account Permanently
 * DELETE /api/admin/event-managers/:id
 */
exports.deleteEventManager = async (req, res) => {
  try {
    const { id } = req.params;

    const eventManager = await EventManager.findById(id);

    if (!eventManager) {
      return res.status(404).json({
        success: false,
        message: 'Event manager not found'
      });
    }

    const userId = eventManager.userId;

    // Delete ID card images from Cloudinary if they exist
    if (eventManager.idCard?.frontImage) {
      try {
        const urlParts = eventManager.idCard.frontImage.split('/');
        const publicIdWithExtension = urlParts.slice(-2).join('/');
        const publicId = publicIdWithExtension.split('.')[0];
        await deleteFromCloudinary(publicId);
      } catch (err) {
        console.error('Error deleting front ID card image:', err);
      }
    }

    if (eventManager.idCard?.backImage) {
      try {
        const urlParts = eventManager.idCard.backImage.split('/');
        const publicIdWithExtension = urlParts.slice(-2).join('/');
        const publicId = publicIdWithExtension.split('.')[0];
        await deleteFromCloudinary(publicId);
      } catch (err) {
        console.error('Error deleting back ID card image:', err);
      }
    }

    // Delete profile picture from Cloudinary if exists
    const user = await User.findById(userId);
    if (user?.profilePicture) {
      try {
        const urlParts = user.profilePicture.split('/');
        const publicIdWithExtension = urlParts.slice(-2).join('/');
        const publicId = publicIdWithExtension.split('.')[0];
        await deleteFromCloudinary(publicId);
      } catch (err) {
        console.error('Error deleting profile picture:', err);
      }
    }

    // Delete the event manager profile
    await EventManager.findByIdAndDelete(id);

    // Delete the user account
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'Event manager account deleted permanently'
    });

  } catch (error) {
    console.error('Delete event manager error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while deleting event manager',
      error: error.message
    });
  }
};

/**
 * Create or Update Settings (Terms & Conditions, Privacy Policy, etc.)
 * PUT /api/admin/settings/:key
 */
exports.updateSettings = async (req, res) => {
  try {
    const { key } = req.params;
    const { title, content } = req.body;

    // Validate key
    const validKeys = ['terms_and_conditions', 'privacy_policy', 'about_us', 'faq'];
    if (!validKeys.includes(key)) {
      return res.status(400).json({
        success: false,
        message: `Invalid settings key. Must be one of: ${validKeys.join(', ')}`
      });
    }

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    // Sanitize HTML content to prevent XSS
    const sanitizedContent = sanitizeHtml(content);

    // Find and update or create
    const settings = await Settings.findOneAndUpdate(
      { key },
      {
        key,
        title,
        content: sanitizedContent,
        lastUpdatedBy: req.admin._id,
        isActive: true
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      message: `${title} updated successfully`,
      data: {
        settings
      }
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating settings',
      error: error.message
    });
  }
};

/**
 * Get Settings by Key (Admin)
 * GET /api/admin/settings/:key
 */
exports.getSettingsByKey = async (req, res) => {
  try {
    const { key } = req.params;

    const settings = await Settings.findOne({ key })
      .populate('lastUpdatedBy', 'fullName email');

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        settings
      }
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching settings',
      error: error.message
    });
  }
};

/**
 * Get All Settings (Admin)
 * GET /api/admin/settings
 */
exports.getAllSettings = async (req, res) => {
  try {
    const settings = await Settings.find()
      .populate('lastUpdatedBy', 'fullName email')
      .sort({ key: 1 });

    res.status(200).json({
      success: true,
      data: {
        settings
      }
    });

  } catch (error) {
    console.error('Get all settings error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching settings',
      error: error.message
    });
  }
};

/**
 * Get Public Settings (No Auth Required)
 * GET /api/settings/:key
 */
exports.getPublicSettings = async (req, res) => {
  try {
    const { key } = req.params;

    const settings = await Settings.findOne({ key, isActive: true })
      .select('key title content updatedAt');

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        settings
      }
    });

  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching content',
      error: error.message
    });
  }
};
