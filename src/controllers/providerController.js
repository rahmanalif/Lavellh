const User = require('../models/User');
const Provider = require('../models/Provider');
const ocrService = require('../utility/ocrService');
const { generateToken } = require('../utility/jwt');
const fs = require('fs').promises;

/**
 * Register a new provider
 * POST /api/providers/register
 */
exports.registerProvider = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      confirmPassword,
      occupation,
      referenceId,
      phoneNumber
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, and password are required'
      });
    }

    // Validate password match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if ID card images are uploaded (both optional now)
    // Just store the images, no OCR or validation
    const idCardFrontPath = req.files?.idCardFront ? req.files.idCardFront[0].path : null;
    const idCardBackPath = req.files?.idCardBack ? req.files.idCardBack[0].path : null;

    if (idCardFrontPath) {
      console.log('ID card front uploaded (stored for records only, no validation)');
    }

    if (idCardBackPath) {
      console.log('ID card back uploaded (stored for records only, no validation)');
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        ...(phoneNumber ? [{ phoneNumber }] : [])
      ]
    });

    if (existingUser) {
      // Clean up uploaded files
      if (idCardFrontPath) await fs.unlink(idCardFrontPath).catch(() => {});
      if (idCardBackPath) await fs.unlink(idCardBackPath).catch(() => {});

      return res.status(400).json({
        success: false,
        message: 'User with this email or phone number already exists'
      });
    }

    // Start a database transaction to ensure atomic operations
    const session = await User.startSession();
    session.startTransaction();

    try {
      // Create User account
      const user = new User({
        fullName,
        email: email.toLowerCase(),
        phoneNumber,
        password,
        userType: 'provider',
        authProvider: 'local',
        termsAccepted: true
      });

      await user.save({ session });

      // Create Provider profile
      const provider = new Provider({
        userId: user._id,
        idCard: {
          frontImage: req.files?.idCardFront ? req.files.idCardFront[0].filename : null,
          backImage: req.files?.idCardBack ? req.files.idCardBack[0].filename : null,
          idNumber: null, // No OCR extraction - to be filled manually by admin
          fullNameOnId: fullName, // Use provided full name
          dateOfBirth: null, // To be filled manually by admin
          expiryDate: null,
          issuedDate: null,
          nationality: null,
          address: null
        },
        occupation: occupation || null,
        referenceId: referenceId || null,
        verificationStatus: 'pending' // Requires admin approval
      });

      await provider.save({ session });

      // Commit the transaction
      await session.commitTransaction();

      // Generate JWT token
      const token = generateToken({
        id: user._id,
        userType: user.userType
      });

      // Return success response
      res.status(201).json({
        success: true,
        message: 'Provider registration successful. Your account is pending verification.',
        data: {
          user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            userType: user.userType,
            authProvider: user.authProvider
          },
          provider: {
            id: provider._id,
            verificationStatus: provider.verificationStatus,
            occupation: provider.occupation,
            referenceId: provider.referenceId,
            idCardUploaded: {
              front: !!idCardFrontPath,
              back: !!idCardBackPath
            }
          },
          token
        }
      });

    } catch (transactionError) {
      // Rollback the transaction on error
      await session.abortTransaction();
      throw transactionError; // Re-throw to be caught by outer catch block
    } finally {
      // End the session
      session.endSession();
    }

  } catch (error) {
    console.error('Provider registration error:', error);

    // Clean up uploaded files on error
    if (req.files) {
      if (req.files.idCardFront) {
        await fs.unlink(req.files.idCardFront[0].path).catch(() => {});
      }
      if (req.files.idCardBack) {
        await fs.unlink(req.files.idCardBack[0].path).catch(() => {});
      }
    }

    res.status(500).json({
      success: false,
      message: 'An error occurred during registration',
      error: error.message
    });
  }
};

/**
 * Login provider
 * POST /api/providers/login
 */
exports.loginProvider = async (req, res) => {
  try {
    const { email, phoneNumber, password } = req.body;

    // Validate input
    if ((!email && !phoneNumber) || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number and password are required'
      });
    }

    // Find user by email or phone
    const user = await User.findOne({
      $or: [
        ...(email ? [{ email: email.toLowerCase() }] : []),
        ...(phoneNumber ? [{ phoneNumber }] : [])
      ],
      userType: 'provider' // Only allow providers to login through this endpoint
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Get provider profile
    const provider = await Provider.findOne({ userId: user._id });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found'
      });
    }

    // Check verification status
    if (provider.verificationStatus === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your provider account has been rejected. Please contact support.',
        verificationNotes: provider.verificationNotes
      });
    }

    // Generate JWT token
    const token = generateToken({
      id: user._id,
      userType: user.userType
    });

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          userType: user.userType,
          profilePicture: user.profilePicture
        },
        provider: {
          id: provider._id,
          verificationStatus: provider.verificationStatus,
          occupation: provider.occupation,
          rating: provider.rating,
          totalReviews: provider.totalReviews,
          completedJobs: provider.completedJobs,
          isAvailable: provider.isAvailable
        },
        token
      }
    });

  } catch (error) {
    console.error('Provider login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login',
      error: error.message
    });
  }
};

/**
 * Get provider profile
 * GET /api/providers/me
 */
exports.getProviderProfile = async (req, res) => {
  try {
    // User is already attached to req by auth middleware
    const provider = await Provider.findOne({ userId: req.user._id })
      .populate('userId', '-password -resetPasswordOTP -resetPasswordOTPExpires');

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        provider
      }
    });

  } catch (error) {
    console.error('Get provider profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching provider profile',
      error: error.message
    });
  }
};

/**
 * Update provider profile
 * PUT /api/providers/me
 */
exports.updateProviderProfile = async (req, res) => {
  try {
    const {
      occupation,
      servicesOffered,
      isAvailable
    } = req.body;

    const provider = await Provider.findOne({ userId: req.user._id });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found'
      });
    }

    // Update allowed fields
    if (occupation !== undefined) provider.occupation = occupation;
    if (servicesOffered !== undefined) provider.servicesOffered = servicesOffered;
    if (isAvailable !== undefined) provider.isAvailable = isAvailable;

    await provider.save();

    res.status(200).json({
      success: true,
      message: 'Provider profile updated successfully',
      data: {
        provider
      }
    });

  } catch (error) {
    console.error('Update provider profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating provider profile',
      error: error.message
    });
  }
};
