const UserRepository = require('../repositories/UserRepository');

/**
 * Get all users (admin only)
 * @route GET /api/users
 * @access Private (Admin)
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { role, isActive, page = 1, limit = 10, search } = req.query;

    const filters = {};
    
    if (role) {
      filters.role = role;
    }
    
    if (isActive !== undefined) {
      filters.is_active = isActive === 'true';
    }

    const options = {
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    };

    let result;
    
    if (search) {
      // Use search method
      result = await UserRepository.searchUsers(search, filters, options);
    } else {
      // Use findAll method
      result = await UserRepository.findAll(filters, options);
    }

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: {
        total: result.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.count / limit)
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

/**
 * Get user by ID
 * @route GET /api/users/:id
 * @access Private
 */
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await UserRepository.getProfile(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

/**
 * Update current user profile
 * @route PUT /api/users/profile
 * @access Private
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, company } = req.body;

    // Validate at least one field is provided
    if (!name && phone === undefined && company === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one field to update'
      });
    }

    const profileData = {};
    if (name) profileData.name = name;
    if (phone !== undefined) profileData.phone = phone;
    if (company !== undefined) profileData.company = company;

    const updatedUser = await UserRepository.updateProfile(userId, profileData);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

/**
 * Update user (admin only)
 * @route PUT /api/users/:id
 * @access Private (Admin)
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, company, role, is_active } = req.body;

    // Check if user exists
    const existingUser = await UserRepository.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate role if provided
    if (role) {
      const validRoles = ['vendor', 'pic_gudang', 'admin', 'approver'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (company !== undefined) updateData.company = company;
    if (role !== undefined) updateData.role = role;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const updatedUser = await UserRepository.update(id, updateData);

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

/**
 * Delete user (admin only)
 * @route DELETE /api/users/:id
 * @access Private (Admin)
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const user = await UserRepository.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await UserRepository.delete(id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

/**
 * Change password
 * @route PUT /api/users/change-password
 * @access Private
 */
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    // Get user with password
    const user = await UserRepository.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isValid = await UserRepository.verifyPassword(user.email, currentPassword);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    await UserRepository.updatePassword(userId, newPassword);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
};

/**
 * Get users by role (for dropdowns, etc.)
 * @route GET /api/users/role/:role
 * @access Private
 */
exports.getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;

    const validRoles = ['vendor', 'pic_gudang', 'admin', 'approver'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    const users = await UserRepository.findByRole(role);

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get users by role error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

/**
 * Toggle user active status
 * @route PUT /api/users/:id/toggle-active
 * @access Private (Admin)
 */
exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deactivation
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own active status'
      });
    }

    const updatedUser = await UserRepository.toggleActive(id);

    res.status(200).json({
      success: true,
      message: `User ${updatedUser.is_active ? 'activated' : 'deactivated'} successfully`,
      data: updatedUser
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling user status',
      error: error.message
    });
  }
};

/**
 * Get user statistics
 * @route GET /api/users/statistics
 * @access Private (Admin)
 */
exports.getUserStatistics = async (req, res) => {
  try {
    const statistics = await UserRepository.getStatistics();

    res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Get user statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user statistics',
      error: error.message
    });
  }
};