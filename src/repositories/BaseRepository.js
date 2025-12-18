const { supabaseAdmin } = require('../config/supabase');

/**
 * Base Repository Pattern untuk Supabase
 * Menyediakan operasi CRUD dasar yang dapat diextend oleh repository lain
 */
class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
    this.db = supabaseAdmin;
  }

  /**
   * Find record by ID
   * @param {string} id - Record ID
   * @param {object} options - Query options (select, with relations)
   * @returns {object|null}
   */
  async findById(id, options = {}) {
    try {
      let query = this.db.from(this.tableName).select(options.select || '*').eq('id', id);

      // Handle relations/joins if specified
      if (options.include) {
        query = this._buildIncludes(query, options.include);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`Error in findById (${this.tableName}):`, error);
      throw error;
    }
  }

  /**
   * Find all records with filters
   * @param {object} filters - Where conditions
   * @param {object} options - Query options
   * @returns {array}
   */
  async findAll(filters = {}, options = {}) {
    try {
      let query = this.db.from(this.tableName).select(options.select || '*', { count: 'exact' });

      // Apply filters
      query = this._applyFilters(query, filters);

      // Apply includes/relations
      if (options.include) {
        query = this._buildIncludes(query, options.include);
      }

      // Apply ordering
      if (options.order) {
        options.order.forEach(([column, direction]) => {
          query = query.order(column, { ascending: direction === 'ASC' });
        });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
        if (options.offset) {
          query = query.range(options.offset, options.offset + options.limit - 1);
        }
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return { data, count };
    } catch (error) {
      console.error(`Error in findAll (${this.tableName}):`, error);
      throw error;
    }
  }

  /**
   * Find one record by filters
   * @param {object} filters - Where conditions
   * @param {object} options - Query options
   * @returns {object|null}
   */
  async findOne(filters = {}, options = {}) {
    try {
      let query = this.db.from(this.tableName).select(options.select || '*');

      query = this._applyFilters(query, filters);

      if (options.include) {
        query = this._buildIncludes(query, options.include);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`Error in findOne (${this.tableName}):`, error);
      throw error;
    }
  }

  /**
   * Create new record
   * @param {object} data - Record data
   * @param {object} options - Query options
   * @returns {object}
   */
  async create(data, options = {}) {
    try {
      let query = this.db.from(this.tableName).insert(data).select();

      if (options.select) {
        query = query.select(options.select);
      }

      const { data: result, error } = await query.single();

      if (error) throw error;

      return result;
    } catch (error) {
      console.error(`Error in create (${this.tableName}):`, error);
      throw error;
    }
  }

  /**
   * Bulk create records
   * @param {array} dataArray - Array of record data
   * @returns {array}
   */
  async bulkCreate(dataArray) {
    try {
      const { data, error } = await this.db.from(this.tableName).insert(dataArray).select();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error(`Error in bulkCreate (${this.tableName}):`, error);
      throw error;
    }
  }

  /**
   * Update record by ID
   * @param {string} id - Record ID
   * @param {object} data - Update data
   * @param {object} options - Query options
   * @returns {object}
   */
  async update(id, data, options = {}) {
    try {
      const { data: result, error } = await this.db
        .from(this.tableName)
        .update(data)
        .eq('id', id)
        .select(options.select || '*')
        .single();

      if (error) throw error;

      return result;
    } catch (error) {
      console.error(`Error in update (${this.tableName}):`, error);
      throw error;
    }
  }

  /**
   * Update records by filters
   * @param {object} filters - Where conditions
   * @param {object} data - Update data
   * @returns {array}
   */
  async updateMany(filters, data) {
    try {
      let query = this.db.from(this.tableName).update(data);

      query = this._applyFilters(query, filters);

      const { data: result, error } = await query.select();

      if (error) throw error;

      return result;
    } catch (error) {
      console.error(`Error in updateMany (${this.tableName}):`, error);
      throw error;
    }
  }

  /**
   * Delete record by ID
   * @param {string} id - Record ID
   * @returns {boolean}
   */
  async delete(id) {
    try {
      const { error } = await this.db.from(this.tableName).delete().eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error(`Error in delete (${this.tableName}):`, error);
      throw error;
    }
  }

  /**
   * Delete many records by filters
   * @param {object} filters - Where conditions
   * @returns {number} - Count of deleted records
   */
  async deleteMany(filters) {
    try {
      let query = this.db.from(this.tableName).delete();

      query = this._applyFilters(query, filters);

      const { data, error, count } = await query.select('*', { count: 'exact' });

      if (error) throw error;

      return count || data?.length || 0;
    } catch (error) {
      console.error(`Error in deleteMany (${this.tableName}):`, error);
      throw error;
    }
  }

  /**
   * Count records
   * @param {object} filters - Where conditions
   * @returns {number}
   */
  async count(filters = {}) {
    try {
      let query = this.db.from(this.tableName).select('*', { count: 'exact', head: true });

      query = this._applyFilters(query, filters);

      const { count, error } = await query;

      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error(`Error in count (${this.tableName}):`, error);
      throw error;
    }
  }

  /**
   * Check if record exists
   * @param {object} filters - Where conditions
   * @returns {boolean}
   */
  async exists(filters) {
    const count = await this.count(filters);
    return count > 0;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Apply filters to query
   * @private
   */
  _applyFilters(query, filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value === null) {
        query = query.is(key, null);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Handle operators
        if (value.$eq !== undefined) query = query.eq(key, value.$eq);
        if (value.$ne !== undefined) query = query.neq(key, value.$ne);
        if (value.$gt !== undefined) query = query.gt(key, value.$gt);
        if (value.$gte !== undefined) query = query.gte(key, value.$gte);
        if (value.$lt !== undefined) query = query.lt(key, value.$lt);
        if (value.$lte !== undefined) query = query.lte(key, value.$lte);
        if (value.$in !== undefined) query = query.in(key, value.$in);
        if (value.$like !== undefined) query = query.ilike(key, `%${value.$like}%`);
      } else if (Array.isArray(value)) {
        query = query.in(key, value);
      } else {
        query = query.eq(key, value);
      }
    });

    return query;
  }

  /**
   * Build includes/relations
   * @private
   */
  _buildIncludes(query, includes) {
    // Supabase handles this differently - you need to specify in select
    // This is a placeholder for more complex relation handling
    return query;
  }

  /**
   * Execute raw query (use with caution)
   * @param {string} query - SQL query
   * @param {array} params - Query parameters
   * @returns {array}
   */
  async rawQuery(query, params = []) {
    try {
      const { data, error } = await this.db.rpc('execute_sql', {
        query_text: query,
        query_params: params
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error in rawQuery:', error);
      throw error;
    }
  }
}

module.exports = BaseRepository;