const User = require('../models/User');
const BusinessOwner = require('../models/BusinessOwner');
const RefreshToken = require('../models/RefreshToken');
const { getTokenExpiresIn } = require('../utility/jwt');
const fs = require('fs').promises;
const { uploadToCloudinary, deleteFromCloudinary } = require('../utility/cloudinary');
const crypto = require('crypto');
const { sendOTPEmail } = require('../utility/emailService');

/**
 * Register a new business owner
 * POST /api/business-owners/register
 */
exports.registerBusinessOwner = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phoneNumber,
      password,
      confirmPassword,
      occupation,
      referenceId,
      dateOfBirth,
      businessName,
      businessCategory,
      businessAddress,
    } = req.body;

    // Validate required fields
    if (!fullName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name and password are required'
      });
    }

    if (!businessName || !businessCategory){
      return res.status(400).json({
        success: false,
        message: 'Business name and business category are required'
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

    // Get ID card image paths
    const idCardFrontPath = req.files?.idCardFront ? req.files.idCardFront[0].path : null;
    const idCardBackPath = req.files?.idCardBack ? req.files.idCardBack[0].path : null;
    const businessPhotoPath = req.files?.businessPhoto ? req.files.businessPhoto[0].path : null;

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
      if (businessPhotoPath) await fs.unlink(businessPhotoPath).catch(() => {});

      return res.status(400).json({
        success: false,
        message: 'User with this email or phone number already exists'
      });
    }

    // Upload ID card images to Cloudinary
    let frontImageUrl = null;
    let backImageUrl = null;
    let businessPhotoUrl = null;

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

    if (businessPhotoPath) {
      const businessUploadResult = await uploadToCloudinary(businessPhotoPath, 'business-photos');
      if (businessUploadResult.success) {
        businessPhotoUrl = businessUploadResult.url;
      }
      await fs.unlink(businessPhotoPath).catch(() => {});
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
        userType: 'businessOwner',
        authProvider: 'local',
        termsAccepted: true
      });

      await user.save({ session });

      // Create BusinessOwner profile
      const businessOwner = new BusinessOwner({
        userId: user._id,
        dateOfBirth: dateOfBirth || null,
        businessName,
        businessCategory,
        businessAddress: businessAddress ? { fullAddress: businessAddress } : null,
        businessPhoto: businessPhotoUrl,
        idCard: {
          frontImage: frontImageUrl,
          backImage: backImageUrl
        },
        occupation: occupation || null,
        referenceId: referenceId || null
      });

      await businessOwner.save({ session });

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
        message: 'Business owner registration successful.',
        data: {
          user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            userType: user.userType,
            authProvider: user.authProvider
          },
          businessOwner: {
            id: businessOwner._id,
            dateOfBirth: businessOwner.dateOfBirth,
            businessName: businessOwner.businessName,
            businessCategory: businessOwner.businessCategory,
            businessAddress: businessOwner.businessAddress,
            businessPhoto: businessOwner.businessPhoto,
            occupation: businessOwner.occupation,
            referenceId: businessOwner.referenceId,
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
    console.error('Business owner registration error:', error);

    // Clean up uploaded files on error
    if (req.files) {
      if (req.files.idCardFront) {
        await fs.unlink(req.files.idCardFront[0].path).catch(() => {});
      }
      if (req.files.idCardBack) {
        await fs.unlink(req.files.idCardBack[0].path).catch(() => {});
      }
      if (req.files.businessPhoto) {
        await fs.unlink(req.files.businessPhoto[0].path).catch(() => {});
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
 * Login business owner
 * POST /api/business-owners/login
 */
exports.loginBusinessOwner = async (req, res) => {
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
      userType: 'businessOwner' // Only allow business owners to login through this endpoint
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

    // Get business owner profile
    const businessOwner = await BusinessOwner.findOne({ userId: user._id });

    if (!businessOwner) {
      return res.status(404).json({
        success: false,
        message: 'Business owner profile not found'
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
        businessOwner: {
          id: businessOwner._id,
          occupation: businessOwner.occupation,
          referenceId: businessOwner.referenceId
        },
        accessToken,
        refreshToken,
        expiresIn: accessExpiresIn,
        tokenType: 'Bearer'
      }
    });

  } catch (error) {
    console.error('Business owner login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login',
      error: error.message
    });
  }
};

/**
 * Get business owner profile
 * GET /api/business-owners/me
 */
exports.getBusinessOwnerProfile = async (req, res) => {
  try {
    // User is already attached to req by auth middleware
    const businessOwner = await BusinessOwner.findOne({ userId: req.user._id })
      .populate('userId', '-password -resetPasswordOTP -resetPasswordOTPExpires');

    if (!businessOwner) {
      return res.status(404).json({
        success: false,
        message: 'Business owner profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        businessOwner
      }
    });

  } catch (error) {
    console.error('Get business owner profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching business owner profile',
      error: error.message
    });
  }
};

/**
 * Update business owner profile
 * PUT /api/business-owners/me
 */
exports.updateBusinessOwnerProfile = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phoneNumber,
      dateOfBirth,
      occupation,
      currentPassword,
      newPassword,
      confirmPassword
    } = req.body;

    const userId = req.user._id;

    // Find user and business owner
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const businessOwner = await BusinessOwner.findOne({ userId: userId });
    if (!businessOwner) {
      return res.status(404).json({
        success: false,
        message: 'Business owner profile not found'
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

    // Update business owner specific fields
    if (occupation !== undefined) businessOwner.occupation = occupation;
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
      businessOwner.dateOfBirth = dob;
    }

    await businessOwner.save();

    res.status(200).json({
      success: true,
      message: 'Business owner profile updated successfully',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          profilePicture: user.profilePicture,
          userType: user.userType
        },
        businessOwner: {
          id: businessOwner._id,
          dateOfBirth: businessOwner.dateOfBirth,
          occupation: businessOwner.occupation,
          referenceId: businessOwner.referenceId,
          businessName: businessOwner.businessName,
          businessCategory: businessOwner.businessCategory,
          businessAddress: businessOwner.businessAddress
        }
      }
    });

  } catch (error) {
    console.error('Update business owner profile error:', error);

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
      message: 'An error occurred while updating business owner profile',
      error: error.message
    });
  }
};

/**
 * Forgot password - Send OTP to email
 * POST /api/business-owners/forgot-password
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

    // Find business owner user by email
    const user = await User.findOne({
      email: email.toLowerCase(),
      userType: 'businessOwner'
    });

    if (!user) {
      // For security, don't reveal if user exists or not
      return res.status(200).json({
        success: true,
        message: 'If a business owner account exists with this email, you will receive an OTP shortly.'
      });
    }

    // Check if business owner profile exists
    const businessOwner = await BusinessOwner.findOne({ userId: user._id });
    if (!businessOwner) {
      return res.status(200).json({
        success: true,
        message: 'If a business owner account exists with this email, you will receive an OTP shortly.'
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
      console.log(`Password reset OTP sent to business owner email: ${user.email}`);

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
 * POST /api/business-owners/verify-otp
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

    // Find business owner user with OTP fields
    const user = await User.findOne({
      email: email.toLowerCase(),
      userType: 'businessOwner'
    }).select('+resetPasswordOTP +resetPasswordOTPExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request'
      });
    }

    // Verify business owner profile exists
    const businessOwner = await BusinessOwner.findOne({ userId: user._id });
    if (!businessOwner) {
      return res.status(400).json({
        success: false,
        message: 'Business owner profile not found'
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
 * POST /api/business-owners/reset-password
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

    // Find business owner user with OTP fields and password
    const user = await User.findOne({
      email: email.toLowerCase(),
      userType: 'businessOwner'
    }).select('+resetPasswordOTP +resetPasswordOTPExpires +password');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request'
      });
    }

    // Verify business owner profile exists
    const businessOwner = await BusinessOwner.findOne({ userId: user._id });
    if (!businessOwner) {
      return res.status(400).json({
        success: false,
        message: 'Business owner profile not found'
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

