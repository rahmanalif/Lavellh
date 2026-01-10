const User = require('../models/User');
const Provider = require('../models/Provider');
const Portfolio = require('../models/Portfolio');
const RefreshToken = require('../models/RefreshToken');
const ocrService = require('../utility/ocrService');
const { getTokenExpiresIn } = require('../utility/jwt');
const fs = require('fs').promises;
const { uploadToCloudinary, deleteFromCloudinary } = require('../utility/cloudinary');
const crypto = require('crypto');

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
          accessToken,
          refreshToken,
          expiresIn: accessExpiresIn,
          tokenType: 'Bearer'
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
        provider: {
          id: provider._id,
          verificationStatus: provider.verificationStatus,
          occupation: provider.occupation,
          rating: provider.rating,
          totalReviews: provider.totalReviews,
          completedJobs: provider.completedJobs,
          isAvailable: provider.isAvailable
        },
        accessToken,
        refreshToken,
        expiresIn: accessExpiresIn,
        tokenType: 'Bearer'
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
      fullName,
      email,
      phoneNumber,
      occupation,
      servicesOffered,
      isAvailable
    } = req.body;

    const userId = req.user._id;

    // Find user and provider
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const provider = await Provider.findOne({ userId: userId });
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found'
      });
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

    // Update location if provided
    const { latitude, longitude, address, activityTime } = req.body;
    if (latitude !== undefined && longitude !== undefined) {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);

      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid latitude or longitude'
        });
      }

      user.location = {
        type: 'Point',
        coordinates: [lon, lat], // [longitude, latitude] - GeoJSON format
        address: address || user.location?.address || ''
      };
    } else if (address) {
      // Update only address if coordinates not provided
      if (!user.location) {
        user.location = {
          type: 'Point',
          coordinates: [0, 0],
          address: address
        };
      } else {
        user.location.address = address;
      }
    }

    // Update activity time in provider
    if (activityTime !== undefined) provider.activityTime = activityTime;

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

    // Update provider-specific fields
    if (occupation !== undefined) provider.occupation = occupation;
    if (servicesOffered !== undefined) provider.servicesOffered = servicesOffered;
    if (isAvailable !== undefined) provider.isAvailable = isAvailable;

    await provider.save();

    // Fetch updated provider with populated user data
    const updatedProvider = await Provider.findOne({ userId: userId })
      .populate('userId', '-password -resetPasswordOTP -resetPasswordOTPExpires');

    res.status(200).json({
      success: true,
      message: 'Provider profile updated successfully',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          profilePicture: user.profilePicture,
          userType: user.userType,
          location: user.location ? {
            latitude: user.location.coordinates[1],
            longitude: user.location.coordinates[0],
            address: user.location.address,
            coordinates: user.location.coordinates
          } : null
        },
        provider: {
          id: provider._id,
          occupation: provider.occupation,
          servicesOffered: provider.servicesOffered,
          isAvailable: provider.isAvailable,
          verificationStatus: provider.verificationStatus,
          rating: provider.rating,
          totalReviews: provider.totalReviews,
          completedJobs: provider.completedJobs,
          activityTime: provider.activityTime
        }
      }
    });

  } catch (error) {
    console.error('Update provider profile error:', error);

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
      message: 'An error occurred while updating provider profile',
      error: error.message
    });
  }
};

/**
 * Change provider password
 * POST /api/providers/change-password
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All password fields are required'
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

    // Find user with password field
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
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
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
};

/**
 * Add portfolio item
 * POST /api/providers/portfolio
 */
exports.addPortfolioItem = async (req, res) => {
  try {
    const { title, about, serviceType, displayOrder } = req.body;
    const userId = req.user._id;

    // Find provider
    const provider = await Provider.findOne({ userId });
    if (!provider) {
      // Clean up uploaded files
      if (req.files) {
        if (req.files.beforeImage) await fs.unlink(req.files.beforeImage[0].path).catch(() => {});
        if (req.files.afterImage) await fs.unlink(req.files.afterImage[0].path).catch(() => {});
      }
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found'
      });
    }

    // Validate required fields
    if (!title || !about) {
      if (req.files) {
        if (req.files.beforeImage) await fs.unlink(req.files.beforeImage[0].path).catch(() => {});
        if (req.files.afterImage) await fs.unlink(req.files.afterImage[0].path).catch(() => {});
      }
      return res.status(400).json({
        success: false,
        message: 'Title and description are required'
      });
    }

    // Validate images
    if (!req.files || !req.files.beforeImage || !req.files.afterImage) {
      if (req.files) {
        if (req.files.beforeImage) await fs.unlink(req.files.beforeImage[0].path).catch(() => {});
        if (req.files.afterImage) await fs.unlink(req.files.afterImage[0].path).catch(() => {});
      }
      return res.status(400).json({
        success: false,
        message: 'Both before and after images are required'
      });
    }

    // Upload images to Cloudinary
    let beforeImageUrl, afterImageUrl;

    try {
      const beforeUpload = await uploadToCloudinary(req.files.beforeImage[0].path, 'portfolio');
      const afterUpload = await uploadToCloudinary(req.files.afterImage[0].path, 'portfolio');

      if (!beforeUpload.success || !afterUpload.success) {
        throw new Error('Failed to upload images');
      }

      beforeImageUrl = beforeUpload.url;
      afterImageUrl = afterUpload.url;

      // Delete local files after upload
      await fs.unlink(req.files.beforeImage[0].path).catch(() => {});
      await fs.unlink(req.files.afterImage[0].path).catch(() => {});
    } catch (uploadError) {
      // Clean up local files
      if (req.files.beforeImage) await fs.unlink(req.files.beforeImage[0].path).catch(() => {});
      if (req.files.afterImage) await fs.unlink(req.files.afterImage[0].path).catch(() => {});

      return res.status(500).json({
        success: false,
        message: 'Failed to upload images',
        error: uploadError.message
      });
    }

    // Create portfolio item
    const portfolio = new Portfolio({
      providerId: provider._id,
      title,
      beforeImage: beforeImageUrl,
      afterImage: afterImageUrl,
      about,
      serviceType: serviceType || null,
      displayOrder: displayOrder || 0
    });

    await portfolio.save();

    res.status(201).json({
      success: true,
      message: 'Portfolio item added successfully',
      data: {
        portfolio
      }
    });

  } catch (error) {
    console.error('Add portfolio item error:', error);

    // Clean up uploaded files on error
    if (req.files) {
      if (req.files.beforeImage) await fs.unlink(req.files.beforeImage[0].path).catch(() => {});
      if (req.files.afterImage) await fs.unlink(req.files.afterImage[0].path).catch(() => {});
    }

    res.status(500).json({
      success: false,
      message: 'An error occurred while adding portfolio item',
      error: error.message
    });
  }
};

/**
 * Get all portfolio items for current provider
 * GET /api/providers/portfolio
 */
exports.getMyPortfolio = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find provider
    const provider = await Provider.findOne({ userId });
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found'
      });
    }

    // Get portfolio items
    const portfolioItems = await Portfolio.find({
      providerId: provider._id,
      isActive: true
    }).sort({ displayOrder: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        portfolio: portfolioItems,
        count: portfolioItems.length
      }
    });

  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching portfolio',
      error: error.message
    });
  }
};

/**
 * Get single portfolio item
 * GET /api/providers/portfolio/:id
 */
exports.getPortfolioItem = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Find provider
    const provider = await Provider.findOne({ userId });
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found'
      });
    }

    // Get portfolio item
    const portfolio = await Portfolio.findOne({
      _id: id,
      providerId: provider._id
    });

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        portfolio
      }
    });

  } catch (error) {
    console.error('Get portfolio item error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching portfolio item',
      error: error.message
    });
  }
};

/**
 * Update portfolio item
 * PUT /api/providers/portfolio/:id
 */
exports.updatePortfolioItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, about, serviceType, displayOrder, isActive } = req.body;
    const userId = req.user._id;

    // Find provider
    const provider = await Provider.findOne({ userId });
    if (!provider) {
      if (req.files) {
        if (req.files.beforeImage) await fs.unlink(req.files.beforeImage[0].path).catch(() => {});
        if (req.files.afterImage) await fs.unlink(req.files.afterImage[0].path).catch(() => {});
      }
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found'
      });
    }

    // Find portfolio item
    const portfolio = await Portfolio.findOne({
      _id: id,
      providerId: provider._id
    });

    if (!portfolio) {
      if (req.files) {
        if (req.files.beforeImage) await fs.unlink(req.files.beforeImage[0].path).catch(() => {});
        if (req.files.afterImage) await fs.unlink(req.files.afterImage[0].path).catch(() => {});
      }
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }

    // Update text fields
    if (title !== undefined) portfolio.title = title;
    if (about !== undefined) portfolio.about = about;
    if (serviceType !== undefined) portfolio.serviceType = serviceType;
    if (displayOrder !== undefined) portfolio.displayOrder = displayOrder;
    if (isActive !== undefined) portfolio.isActive = isActive;

    // Update images if provided
    if (req.files) {
      try {
        if (req.files.beforeImage) {
          // Upload new before image
          const beforeUpload = await uploadToCloudinary(req.files.beforeImage[0].path, 'portfolio');
          if (beforeUpload.success) {
            // Delete old image from Cloudinary
            if (portfolio.beforeImage) {
              const urlParts = portfolio.beforeImage.split('/');
              const publicIdWithExtension = urlParts.slice(-2).join('/');
              const publicId = publicIdWithExtension.split('.')[0];
              await deleteFromCloudinary(publicId);
            }
            portfolio.beforeImage = beforeUpload.url;
          }
          await fs.unlink(req.files.beforeImage[0].path).catch(() => {});
        }

        if (req.files.afterImage) {
          // Upload new after image
          const afterUpload = await uploadToCloudinary(req.files.afterImage[0].path, 'portfolio');
          if (afterUpload.success) {
            // Delete old image from Cloudinary
            if (portfolio.afterImage) {
              const urlParts = portfolio.afterImage.split('/');
              const publicIdWithExtension = urlParts.slice(-2).join('/');
              const publicId = publicIdWithExtension.split('.')[0];
              await deleteFromCloudinary(publicId);
            }
            portfolio.afterImage = afterUpload.url;
          }
          await fs.unlink(req.files.afterImage[0].path).catch(() => {});
        }
      } catch (uploadError) {
        console.error('Image upload error during update:', uploadError);
        // Continue with text field updates even if image upload fails
      }
    }

    await portfolio.save();

    res.status(200).json({
      success: true,
      message: 'Portfolio item updated successfully',
      data: {
        portfolio
      }
    });

  } catch (error) {
    console.error('Update portfolio item error:', error);

    if (req.files) {
      if (req.files.beforeImage) await fs.unlink(req.files.beforeImage[0].path).catch(() => {});
      if (req.files.afterImage) await fs.unlink(req.files.afterImage[0].path).catch(() => {});
    }

    res.status(500).json({
      success: false,
      message: 'An error occurred while updating portfolio item',
      error: error.message
    });
  }
};

/**
 * Delete portfolio item
 * DELETE /api/providers/portfolio/:id
 */
exports.deletePortfolioItem = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Find provider
    const provider = await Provider.findOne({ userId });
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found'
      });
    }

    // Find and delete portfolio item
    const portfolio = await Portfolio.findOneAndDelete({
      _id: id,
      providerId: provider._id
    });

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }

    // Delete images from Cloudinary
    try {
      if (portfolio.beforeImage) {
        const urlParts = portfolio.beforeImage.split('/');
        const publicIdWithExtension = urlParts.slice(-2).join('/');
        const publicId = publicIdWithExtension.split('.')[0];
        await deleteFromCloudinary(publicId);
      }

      if (portfolio.afterImage) {
        const urlParts = portfolio.afterImage.split('/');
        const publicIdWithExtension = urlParts.slice(-2).join('/');
        const publicId = publicIdWithExtension.split('.')[0];
        await deleteFromCloudinary(publicId);
      }
    } catch (deleteError) {
      console.error('Error deleting images from Cloudinary:', deleteError);
      // Continue even if image deletion fails
    }

    res.status(200).json({
      success: true,
      message: 'Portfolio item deleted successfully'
    });

  } catch (error) {
    console.error('Delete portfolio item error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while deleting portfolio item',
      error: error.message
    });
  }
};

/**
 * Get public portfolio for a provider (for users to view)
 * GET /api/providers/:providerId/portfolio
 */
exports.getProviderPortfolio = async (req, res) => {
  try {
    const { providerId } = req.params;

    // Get active portfolio items
    const portfolioItems = await Portfolio.find({
      providerId,
      isActive: true
    }).sort({ displayOrder: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        portfolio: portfolioItems,
        count: portfolioItems.length
      }
    });

  } catch (error) {
    console.error('Get provider portfolio error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching provider portfolio',
      error: error.message
    });
  }
};
