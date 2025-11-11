const User = require('../models/User');
const { generateToken } = require('../utility/jwt'); // Changed from '../utils/jwt'


// Register user
const register = async (req, res) => {
  try {
    // Log request body for debugging (remove in production)
    console.log('Register request body:', req.body);

    const { fullName, email, phoneNumber, password, termsAccepted } = req.body;

    // Validate required fields
    if (!fullName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name and password are required'
      });
    }

    // Validate that at least email or phoneNumber is provided
    if (!email && !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Either email or phone number is required'
      });
    }

    // Validate terms acceptance
    if (!termsAccepted || termsAccepted !== true) {
      return res.status(400).json({
        success: false,
        message: 'You must accept the terms and conditions'
      });
    }

    // Check if user already exists with email or phone
    const query = [];
    if (email) query.push({ email });
    if (phoneNumber) query.push({ phoneNumber });

    const existingUser = await User.findOne({
      $or: query
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or phone number'
      });
    }

    // Create new user
    const user = new User({
      fullName,
      email: email || undefined,
      phoneNumber: phoneNumber || undefined,
      password,
      termsAccepted,
      userType: 'user' // Explicitly set as user type
    });

    await user.save();

    // Generate token
    const token = generateToken({
      id: user._id,
      userType: user.userType
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          userType: user.userType,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified
        },
        token
      }
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error in registration',
      error: error.message
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    // Log request body for debugging (remove in production)
    console.log('Login request body:', req.body);

    const { email, phoneNumber, password } = req.body;

    // Validate that at least email or phoneNumber is provided
    if (!email && !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number is required'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Build query to find user by email or phone
    const query = {};
    if (email) query.email = email;
    if (phoneNumber) query.phoneNumber = phoneNumber;

    // Find user by email or phone - need to select password explicitly
    const user = await User.findOne(email ? { email } : { phoneNumber }).select('+password');

    if (!user) {
      return res.status(400).json({
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

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken({
      id: user._id,
      userType: user.userType
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          userType: user.userType,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified
        },
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error in login',
      error: error.message
    });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          fullName: req.user.fullName,
          email: req.user.email,
          phoneNumber: req.user.phoneNumber,
          userType: req.user.userType,
          isEmailVerified: req.user.isEmailVerified,
          isPhoneVerified: req.user.isPhoneVerified,
          isActive: req.user.isActive,
          createdAt: req.user.createdAt
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user data',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getMe
};