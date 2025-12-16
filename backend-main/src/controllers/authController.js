const UserRepository = require('../repositories/UserRepository');
const jwt = require('jsonwebtoken');

/**
 * Generate JWT Token
 * @param {string} userId - User ID
 * @returns {string} JWT Token
 */
const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

/**
 * Register new user
 * @route POST /api/auth/register
 * @access Public
 */
exports.register = async (req, res) => {
  try {
    const { email, password, name, role, phone, company } = req.body;

    // Validate required fields
    if (!email || !password || !name || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, name, and role'
      });
    }

    // Validate role
    const validRoles = ['vendor', 'vendor_barang', 'vendor_jasa', 'pic_gudang', 'admin', 'approver'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    // Check if user exists
    const existingUser = await UserRepository.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Create user (password hashing handled in repository)
    const user = await UserRepository.createUser({
      email,
      password,
      name,
      role,
      phone,
      company
    });

    // Generate token
    const token = signToken(user.id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { 
        user,
        token 
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 * @access Public
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Verify password (handled in repository)
    const user = await UserRepository.verifyPassword(email, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is inactive. Please contact administrator.'
      });
    }

    // Generate token
    const token = signToken(user.id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { 
        user,
        token 
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
};

/**
 * Get current user profile
 * @route GET /api/auth/profile
 * @access Private
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await UserRepository.getProfile(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
};

/**
 * Refresh token
 * @route POST /api/auth/refresh-token
 * @access Private
 */
exports.refreshToken = async (req, res) => {
  try {
    const userId = req.user.id;

    // Verify user still exists and is active
    const user = await UserRepository.getProfile(userId);

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Generate new token
    const newToken = signToken(userId);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: { 
        token: newToken 
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Error refreshing token',
      error: error.message
    });
  }
};