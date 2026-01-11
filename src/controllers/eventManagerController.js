const User = require('../models/User');
const EventManager = require('../models/EventManager');
const RefreshToken = require('../models/RefreshToken');
const { getTokenExpiresIn } = require('../utility/jwt');
const fs = require('fs').promises;
const { uploadToCloudinary, deleteFromCloudinary } = require('../utility/cloudinary');
const crypto = require('crypto');
const { sendOTPEmail } = require('../utility/emailService');

/**
 * Register a new event manager
 * POST /api/event-managers/register
 */
exports.registerEventManager = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phoneNumber,
      password,
      confirmPassword,
      dateOfBirth,
      idType,
      identificationNumber
    } = req.body;

    // Validate required fields
    if (!fullName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name and password are required'
      });
    }

    if (!dateOfBirth || !idType || !identificationNumber) {
      return res.status(400).json({
        success: false,
        message: 'Date of birth, ID type, and identification number are required'
      });
    }

    // Validate email or phone number is provided
    if (!email && !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Either email or phone number is required'
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

    // Validate ID type
    const validIdTypes = ['passport', 'national_id', 'driver_license'];
    if (!validIdTypes.includes(idType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID type. Must be passport, national_id, or driver_license'
      });
    }

    // Validate date of birth
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date of birth format'
      });
    }
    if (dob >= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Date of birth must be in the past'
      });
    }

    // Get ID card image paths
    const idCardFrontPath = req.files?.idCardFront ? req.files.idCardFront[0].path : null;
    const idCardBackPath = req.files?.idCardBack ? req.files.idCardBack[0].path : null;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        ...(email ? [{ email: email.toLowerCase() }] : []),
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

    // Upload ID card images to Cloudinary
    let frontImageUrl = null;
    let backImageUrl = null;

    if (idCardFrontPath) {
      const frontUploadResult = await uploadToCloudinary(idCardFrontPath, 'id-cards');
      if (frontUploadResult.success) {
        frontImageUrl = frontUploadResult.url;
      }
      // Delete local file after upload
      await fs.unlink(idCardFrontPath).catch(() => {});
    }

    if (idCardBackPath) {
      const backUploadResult = await uploadToCloudinary(idCardBackPath, 'id-cards');
      if (backUploadResult.success) {
        backImageUrl = backUploadResult.url;
      }
      // Delete local file after upload
      await fs.unlink(idCardBackPath).catch(() => {});
    }

    // Start a database transaction to ensure atomic operations
    const session = await User.startSession();
    session.startTransaction();

    try {
      // Create User account
      const user = new User({
        fullName,
        email: email ? email.toLowerCase() : undefined,
        phoneNumber: phoneNumber || undefined,
        password,
        userType: 'eventManager',
        authProvider: 'local',
        termsAccepted: true
      });

      await user.save({ session });

      // Create EventManager profile
      const eventManager = new EventManager({
        userId: user._id,
        dateOfBirth: dob,
        idType,
        identificationNumber,
        idCard: {
          frontImage: frontImageUrl,
          backImage: backImageUrl
        }
      });

      await eventManager.save({ session });

      // Commit the transaction
      await session.commitTransaction();

      // Generate access token and refresh token
      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();

      // Calculate refresh token expiration
      const refreshExpiresIn = getTokenExpiresIn('refresh');
      const expiresAt = new Date(Date.now() + refreshExpiresIn * 1000);

      // Store refresh token in database
      const refreshTokenDoc = new RefreshToken({
        userId: user._id,
        token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
        expiresAt,
        deviceInfo: {
          userAgent: req.headers['user-agent'],
          ip: req.ip || req.connection.remoteAddress
        }
      });

      await refreshTokenDoc.save();

      // Get access token expiration time
      const accessExpiresIn = getTokenExpiresIn('access');

      // Return success response
      res.status(201).json({
        success: true,
        message: 'Event manager registration successful',
        data: {
          user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            userType: user.userType,
            authProvider: user.authProvider
          },
          eventManager: {
            id: eventManager._id,
            dateOfBirth: eventManager.dateOfBirth,
            idType: eventManager.idType,
            identificationNumber: eventManager.identificationNumber,
            idCardUploaded: {
              front: !!frontImageUrl,
              back: !!backImageUrl
            }
          },
          accessToken,
          refreshToken,
          expiresIn: accessExpiresIn,
          tokenType: 'Bearer'
        }
      });

    } catch (transactionError) {
      // Rollback the transaction on error
      await session.abortTransaction();
      throw transactionError;
    } finally {
      // End the session
      session.endSession();
    }

  } catch (error) {
    console.error('Event manager registration error:', error);

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
 * Login event manager
 * POST /api/event-managers/login
 */
exports.loginEventManager = async (req, res) => {
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
      userType: 'eventManager' // Only allow event managers to login through this endpoint
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

    // Get event manager profile
    const eventManager = await EventManager.findOne({ userId: user._id });

    if (!eventManager) {
      return res.status(404).json({
        success: false,
        message: 'Event manager profile not found'
      });
    }

    // Generate access token and refresh token
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Calculate refresh token expiration
    const refreshExpiresIn = getTokenExpiresIn('refresh');
    const expiresAt = new Date(Date.now() + refreshExpiresIn * 1000);

    // Store refresh token in database
    const refreshTokenDoc = new RefreshToken({
      userId: user._id,
      token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
      expiresAt,
      deviceInfo: {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress
      }
    });

    await refreshTokenDoc.save();

    // Get access token expiration time
    const accessExpiresIn = getTokenExpiresIn('access');

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
        eventManager: {
          id: eventManager._id,
          dateOfBirth: eventManager.dateOfBirth,
          idType: eventManager.idType,
          identificationNumber: eventManager.identificationNumber
        },
        accessToken,
        refreshToken,
        expiresIn: accessExpiresIn,
        tokenType: 'Bearer'
      }
    });

  } catch (error) {
    console.error('Event manager login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login',
      error: error.message
    });
  }
};

/**
 * Get event manager profile
 * GET /api/event-managers/me
 */
exports.getEventManagerProfile = async (req, res) => {
  try {
    // User is already attached to req by auth middleware
    const eventManager = await EventManager.findOne({ userId: req.user._id })
      .populate('userId', '-password -resetPasswordOTP -resetPasswordOTPExpires');

    if (!eventManager) {
      return res.status(404).json({
        success: false,
        message: 'Event manager profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        eventManager
      }
    });

  } catch (error) {
    console.error('Get event manager profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching event manager profile',
      error: error.message
    });
  }
};

/**
 * Update event manager profile
 * PUT /api/event-managers/me
 */
exports.updateEventManagerProfile = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phoneNumber,
      dateOfBirth,
      currentPassword,
      newPassword,
      confirmPassword
    } = req.body;

    const userId = req.user._id;

    // Find user and event manager
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const eventManager = await EventManager.findOne({ userId: userId });
    if (!eventManager) {
      return res.status(404).json({
        success: false,
        message: 'Event manager profile not found'
      });
    }

    // Handle password change if provided (all three password fields must be present)
    if (currentPassword || newPassword || confirmPassword) {
      // Validate all password fields are provided
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'To change password, current password, new password, and confirm password are all required'
        });
      }

      // Validate new password and confirm password match
      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password and confirm password do not match'
        });
      }

      // Validate new password strength
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
      }

      // Check if user has a password (OAuth users might not)
      if (!user.password) {
        return res.status(400).json({
          success: false,
          message: 'Cannot change password for OAuth-authenticated accounts'
        });
      }

      // Verify current password
      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Check if new password is same as current
      const isSamePassword = await user.comparePassword(newPassword);
      if (isSamePassword) {
        return res.status(400).json({
          success: false,
          message: 'New password must be different from current password'
        });
      }

      // Update password
      user.password = newPassword;
    }

    // Check if email is being changed and already exists
    if (email && email !== user.email) {
      const emailExists = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: userId }
      });

      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use by another account'
        });
      }
    }

    // Check if phone number is being changed and already exists
    if (phoneNumber && phoneNumber !== user.phoneNumber) {
      const phoneExists = await User.findOne({
        phoneNumber,
        _id: { $ne: userId }
      });

      if (phoneExists) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already in use by another account'
        });
      }
    }

    // Update user fields
    if (fullName) user.fullName = fullName;
    if (email) user.email = email.toLowerCase();
    if (phoneNumber) user.phoneNumber = phoneNumber;

    // Handle profile picture upload
    if (req.file) {
      try {
        // Upload new profile picture to Cloudinary
        const uploadResult = await uploadToCloudinary(req.file.path, 'profiles');

        if (uploadResult.success) {
          // Delete old profile picture from Cloudinary if exists
          if (user.profilePicture) {
            // Extract public ID from URL
            const urlParts = user.profilePicture.split('/');
            const publicIdWithExtension = urlParts.slice(-2).join('/');
            const publicId = publicIdWithExtension.split('.')[0];
            await deleteFromCloudinary(publicId);
          }

          user.profilePicture = uploadResult.url;
        }

        // Delete local file after upload
        await fs.unlink(req.file.path);
      } catch (uploadError) {
        console.error('Profile picture upload error:', uploadError);
        // Continue even if upload fails - don't block profile update
      }
    }

    await user.save();

    // Update event manager specific fields
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      if (isNaN(dob.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date of birth format'
        });
      }
      if (dob >= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Date of birth must be in the past'
        });
      }
      eventManager.dateOfBirth = dob;
    }

    await eventManager.save();

    res.status(200).json({
      success: true,
      message: 'Event manager profile updated successfully',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          profilePicture: user.profilePicture,
          userType: user.userType
        },
        eventManager: {
          id: eventManager._id,
          dateOfBirth: eventManager.dateOfBirth,
          idType: eventManager.idType,
          identificationNumber: eventManager.identificationNumber
        }
      }
    });

  } catch (error) {
    console.error('Update event manager profile error:', error);

    // Clean up uploaded file if exists
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'An error occurred while updating event manager profile',
      error: error.message
    });
  }
};

/**
 * Forgot password - Send OTP to email
 * POST /api/event-managers/forgot-password
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find event manager user by email
    const user = await User.findOne({
      email: email.toLowerCase(),
      userType: 'eventManager'
    });

    if (!user) {
      // For security, don't reveal if user exists or not
      return res.status(200).json({
        success: true,
        message: 'If an event manager account exists with this email, you will receive an OTP shortly.'
      });
    }

    // Check if event manager profile exists
    const eventManager = await EventManager.findOne({ userId: user._id });
    if (!eventManager) {
      return res.status(200).json({
        success: true,
        message: 'If an event manager account exists with this email, you will receive an OTP shortly.'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Generate OTP
    const otp = user.generatePasswordResetOTP();
    await user.save({ validateBeforeSave: false });

    // Send OTP via email
    try {
      await sendOTPEmail(user.email, otp, user.fullName);
      console.log(`Password reset OTP sent to event manager email: ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'OTP has been sent to your email. Please check and enter the code.',
        data: {
          email: user.email,
          expiresIn: '10 minutes'
        }
      });
    } catch (sendError) {
      // Clear the OTP if sending failed
      user.resetPasswordOTP = undefined;
      user.resetPasswordOTPExpires = undefined;
      await user.save({ validateBeforeSave: false });

      console.error('Error sending OTP:', sendError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? sendError.message : undefined
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Verify OTP
 * POST /api/event-managers/verify-otp
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate inputs
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required'
      });
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'OTP must be a 6-digit number'
      });
    }

    // Find event manager user with OTP fields
    const user = await User.findOne({
      email: email.toLowerCase(),
      userType: 'eventManager'
    }).select('+resetPasswordOTP +resetPasswordOTPExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request'
      });
    }

    // Verify event manager profile exists
    const eventManager = await EventManager.findOne({ userId: user._id });
    if (!eventManager) {
      return res.status(400).json({
        success: false,
        message: 'Event manager profile not found'
      });
    }

    // Verify OTP
    const isValid = user.verifyPasswordResetOTP(otp);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new one.'
      });
    }

    // OTP is valid
    res.status(200).json({
      success: true,
      message: 'OTP verified successfully. You can now reset your password.',
      data: {
        email: user.email
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while verifying OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Reset password with OTP
 * POST /api/event-managers/reset-password
 */
exports.resetPasswordWithOTP = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    // Validate inputs
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required'
      });
    }

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password are required'
      });
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match'
      });
    }

    // Validate password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Find event manager user with OTP fields and password
    const user = await User.findOne({
      email: email.toLowerCase(),
      userType: 'eventManager'
    }).select('+resetPasswordOTP +resetPasswordOTPExpires +password');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request'
      });
    }

    // Verify event manager profile exists
    const eventManager = await EventManager.findOne({ userId: user._id });
    if (!eventManager) {
      return res.status(400).json({
        success: false,
        message: 'Event manager profile not found'
      });
    }

    // Verify OTP
    const isValid = user.verifyPasswordResetOTP(otp);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new one.'
      });
    }

    // Update password and clear OTP
    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while resetting password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
