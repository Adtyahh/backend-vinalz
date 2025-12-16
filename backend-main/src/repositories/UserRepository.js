const BaseRepository = require('./BaseRepository');
const bcrypt = require('bcryptjs');

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  /**
   * Find user by email
   * @param {string} email 
   * @returns {object|null}
   */
  async findByEmail(email) {
    return await this.findOne({ email: email.toLowerCase() });
  }

  /**
   * Create user with hashed password
   * @param {object} userData 
   * @returns {object}
   */
  async createUser(userData) {
    try {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Prepare user data
      const userToCreate = {
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        name: userData.name,
        role: userData.role,
        phone: userData.phone || null,
        company: userData.company || null,
        is_active: userData.is_active !== undefined ? userData.is_active : true
      };

      // Create user
      const user = await this.create(userToCreate);

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      return userWithoutPassword;
    } catch (error) {
      if (error.code === '23505') {
        throw new Error('Email already exists');
      }
      throw error;
    }
  }

  /**
   * Verify user password
   * @param {string} email 
   * @param {string} password 
   * @returns {object|null}  
   */
  async verifyPassword(email, password) {
    try {
      const user = await this.findByEmail(email);

      if (!user) return null;

      const isValid = await bcrypt.compare(password, user.password);

      if (!isValid) return null;

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      console.error('Error verifying password:', error);
      throw error;
    }
  }

  /**
   * Update user password
   * @param {string} userId 
   * @param {string} newPassword 
   * @returns {boolean}
   */
  async updatePassword(userId, newPassword) {
    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      await this.update(userId, { password: hashedPassword });

      return true;
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  }

  /**
   * Get users by role
   * @param {string} role 
   * @param {object} options 
   * @returns {array}
   */
  async findByRole(role, options = {}) {
    const filters = { 
      role,
      is_active: true 
    };

    const { data } = await this.findAll(filters, {
      ...options,
      order: [['name', 'ASC']]
    });

    return data;
  }

  /**
   * Search users
   * @param {string} searchTerm 
   * @param {object} filters 
   * @param {object} options 
   * @returns {object} 
   */
  
  // Tambahkan method untuk membedakan vendor
  async findVendorsByType(vendorType) {
    const roleMap = {
      'barang': 'vendor_barang',
      'jasa': 'vendor_jasa'
    };
    
    const role = roleMap[vendorType] || 'vendor_barang';
    
    return await this.findByRole(role);
  }

  async createVendor(userData, vendorType = 'barang') {
    const roleMap = {
      'barang': 'vendor_barang',
      'jasa': 'vendor_jasa'
    };
    
    userData.role = roleMap[vendorType] || 'vendor_barang';
    
    return await this.createUser(userData);
  }
  async searchUsers(searchTerm, filters = {}, options = {}) {
    try {
      let query = this.db
        .from(this.tableName)
        .select('id, email, name, role, phone, company, is_active, created_at', { count: 'exact' });

      // Apply search
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%`);
      }

      // Apply additional filters
      if (filters.role) {
        query = query.eq('role', filters.role);
      }

      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
        if (options.offset) {
          query = query.range(options.offset, options.offset + options.limit - 1);
        }
      }

      // Apply ordering
      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      return { data, count };
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  /**
   * Toggle user active status
   * @param {string} userId 
   * @returns {object}
   */
  async toggleActive(userId) {
    try {
      const user = await this.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      return await this.update(userId, { is_active: !user.is_active });
    } catch (error) {
      console.error('Error toggling user active status:', error);
      throw error;
    }
  }

  /**
   * Get user profile without sensitive data
   * @param {string} userId 
   * @returns {object|null}
   */
  async getProfile(userId) {
    try {
      const { data, error } = await this.db
        .from(this.tableName)
        .select('id, email, name, role, phone, company, is_active, created_at, updated_at')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {string} userId 
   * @param {object} profileData 
   * @returns {object}
   */
  async updateProfile(userId, profileData) {
    try {
      // Only allow updating specific fields
      const allowedFields = ['name', 'phone', 'company'];
      const updateData = {};

      allowedFields.forEach(field => {
        if (profileData[field] !== undefined) {
          updateData[field] = profileData[field];
        }
      });

      if (Object.keys(updateData).length === 0) {
        throw new Error('No valid fields to update');
      }

      const { data, error } = await this.db
        .from(this.tableName)
        .update(updateData)
        .eq('id', userId)
        .select('id, email, name, role, phone, company, is_active')
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Get statistics
   * @returns {object}
   */
  async getStatistics() {
    try {
      const { data: stats, error } = await this.db.rpc('get_user_statistics');

      if (error) {
        // Fallback if RPC doesn't exist
        const [total, active, byRole] = await Promise.all([
          this.count(),
          this.count({ is_active: true }),
          this._countByRole()
        ]);

        return {
          total,
          active,
          inactive: total - active,
          by_role: byRole
        };
      }

      return stats;
    } catch (error) {
      console.error('Error getting user statistics:', error);
      throw error;
    }
  }

  async _countByRole() {
    try {
      const roles = ['vendor', 'pic_gudang', 'admin', 'approver'];
      const counts = {};

      for (const role of roles) {
        counts[role] = await this.count({ role });
      }

      return counts;
    } catch (error) {
      console.error('Error counting by role:', error);
      return {};
    }
  }
}

module.exports = new UserRepository();