const BaseRepository = require('./BaseRepository');

class BAPPRepository extends BaseRepository {
  constructor() {
    super('bapp');
  }

  /**
   * Find BAPP by ID with all relations
   */
  async findByIdWithRelations(id) {
    try {
      const { data, error } = await this.db
        .from(this.tableName)
        .select(`
          *,
          vendor:users!bapp_vendor_id_fkey(id, name, email, company, phone),
          direksi_pekerjaan:users!bapp_direksi_pekerjaan_id_fkey(id, name, email),
          work_items:bapp_work_items(*),
          approvals:bapp_approvals(
            *,
            approver:users(id, name, email, role)
          ),
          attachments:bapp_attachments(
            *,
            uploader:users(id, name, email)
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error finding BAPP with relations:', error);
      throw error;
    }
  }

  /**
   * Find all BAPP with pagination and filters
   */
  async findAllWithRelations(filters = {}, pagination = {}) {
    try {
      let query = this.db
        .from(this.tableName)
        .select(`
          *,
          vendor:users!bapp_vendor_id_fkey(id, name, email, company),
          direksi_pekerjaan:users!bapp_direksi_pekerjaan_id_fkey(id, name, email),
          work_items:bapp_work_items(*)
        `, { count: 'exact' });

      // Apply filters
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.vendor_id) query = query.eq('vendor_id', filters.vendor_id);
      if (filters.direksi_pekerjaan_id) query = query.eq('direksi_pekerjaan_id', filters.direksi_pekerjaan_id);
      if (filters.project_name) query = query.ilike('project_name', `%${filters.project_name}%`);
      if (filters.start_date_from) query = query.gte('start_date', filters.start_date_from);
      if (filters.start_date_to) query = query.lte('start_date', filters.start_date_to);
      if (filters.min_progress !== undefined) query = query.gte('total_progress', filters.min_progress);
      if (filters.max_progress !== undefined) query = query.lte('total_progress', filters.max_progress);

      // Apply pagination
      const limit = pagination.limit || 10;
      const offset = pagination.offset || 0;

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return { data, count };
    } catch (error) {
      console.error('Error finding BAPP with relations:', error);
      throw error;
    }
  }

  /**
   * Create BAPP with work items - FIXED VERSION
   */
  async createWithWorkItems(bappData, workItems = []) {
    try {
      console.log('📝 Creating BAPP with data:', JSON.stringify(bappData, null, 2));
      console.log('📦 Work items to create:', JSON.stringify(workItems, null, 2));

      // Calculate total progress from work items
      const totalProgress = this._calculateTotalProgress(workItems);

      // Create BAPP first
      const bapp = await this.create({
        ...bappData,
        total_progress: totalProgress
      });

      console.log('✅ BAPP created:', bapp.id);

      // Create work items if provided
      if (workItems && workItems.length > 0) {
        // FIXED: Map field names from camelCase to snake_case for database
        const itemsToCreate = workItems.map(item => ({
          bapp_id: bapp.id,
          work_item_name: item.workItemName || item.work_item_name,
          planned_progress: item.plannedProgress || item.planned_progress || 0,
          actual_progress: item.actualProgress || item.actual_progress || 0,
          unit: item.unit,
          quality: item.quality || 'acceptable',
          notes: item.notes || null
        }));

        console.log('💾 Inserting work items:', JSON.stringify(itemsToCreate, null, 2));

        const { data: createdItems, error: itemsError } = await this.db
          .from('bapp_work_items')
          .insert(itemsToCreate)
          .select();

        if (itemsError) {
          console.error('❌ Error creating work items:', itemsError);
          // Rollback: delete the BAPP if items creation failed
          await this.delete(bapp.id);
          throw new Error(`Failed to create BAPP work items: ${itemsError.message}`);
        }

        console.log('✅ Work items created successfully:', createdItems.length);
      } else {
        console.warn('⚠️ No work items provided for BAPP');
      }

      // Return BAPP with work items
      const result = await this.findByIdWithRelations(bapp.id);
      console.log('📋 Final BAPP with items:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('❌ Error creating BAPP with work items:', error);
      throw error;
    }
  }

  /**
   * Update BAPP with work items - FIXED VERSION
   */
  async updateWithWorkItems(id, bappData, workItems = null) {
    try {
      console.log('📝 Updating BAPP:', id);
      console.log('📦 Update data:', JSON.stringify(bappData, null, 2));
      console.log('📦 New work items:', workItems ? JSON.stringify(workItems, null, 2) : 'No items update');

      let updateData = { ...bappData };

      // Recalculate total progress if work items are provided
      if (workItems !== null && Array.isArray(workItems)) {
        updateData.total_progress = this._calculateTotalProgress(workItems);

        // Delete old work items
        const { error: deleteError } = await this.db
          .from('bapp_work_items')
          .delete()
          .eq('bapp_id', id);

        if (deleteError) {
          console.error('❌ Error deleting old work items:', deleteError);
          throw deleteError;
        }

        // Insert new work items
        if (workItems.length > 0) {
          // FIXED: Map field names correctly
          const itemsToCreate = workItems.map(item => ({
            bapp_id: id,
            work_item_name: item.workItemName || item.work_item_name,
            planned_progress: item.plannedProgress || item.planned_progress || 0,
            actual_progress: item.actualProgress || item.actual_progress || 0,
            unit: item.unit,
            quality: item.quality || 'acceptable',
            notes: item.notes || null
          }));

          const { error: insertError } = await this.db
            .from('bapp_work_items')
            .insert(itemsToCreate);

          if (insertError) {
            console.error('❌ Error inserting new work items:', insertError);
            throw insertError;
          }
        }
      }

      // Update BAPP
      await this.update(id, updateData);

      // Return updated BAPP with work items
      return await this.findByIdWithRelations(id);
    } catch (error) {
      console.error('❌ Error updating BAPP with work items:', error);
      throw error;
    }
  }

  /**
   * Update BAPP status
   */
  async updateStatus(id, status, additionalData = {}) {
    const updateData = { status, ...additionalData };
    return await this.update(id, updateData);
  }

  /**
   * Get BAPP by number
   */
  async findByNumber(bappNumber) {
    return await this.findOne({ bapp_number: bappNumber });
  }

  /**
   * Generate BAPP number - FIXED VERSION
   */
  async generateBAPPNumber() {
    try {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');

      // Count BAPPs in current month
      const startOfMonth = new Date(year, date.getMonth(), 1).toISOString();
      const endOfMonth = new Date(year, date.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { count, error } = await this.db
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      if (error) {
        console.error('Error counting BAPPs:', error);
        throw error;
      }

      const sequence = String((count || 0) + 1).padStart(4, '0');
      return `BAPP/${year}/${month}/${sequence}`;
    } catch (error) {
      console.error('Error generating BAPP number:', error);
      throw error;
    }
  }

  /**
   * Create approval record
   */
  async createApproval(approvalData) {
    try {
      const { data, error } = await this.db
        .from('bapp_approvals')
        .insert(approvalData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating approval:', error);
      throw error;
    }
  }

  /**
   * Get approval history
   */
  async getApprovalHistory(bappId) {
    try {
      const { data, error } = await this.db
        .from('bapp_approvals')
        .select(`
          *,
          approver:users(id, name, email, role)
        `)
        .eq('bapp_id', bappId)
        .order('approved_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting approval history:', error);
      throw error;
    }
  }

  /**
   * Check if user already approved
   */
  async hasUserApproved(bappId, approverId) {
    try {
      const { data, error } = await this.db
        .from('bapp_approvals')
        .select('id')
        .eq('bapp_id', bappId)
        .eq('approver_id', approverId)
        .eq('action', 'approved')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    } catch (error) {
      console.error('Error checking approval:', error);
      throw error;
    }
  }

  /**
   * Get BAPP statistics by vendor
   */
  async getVendorStatistics(vendorId) {
    try {
      const [total, draft, submitted, approved, rejected] = await Promise.all([
        this.count({ vendor_id: vendorId }),
        this.count({ vendor_id: vendorId, status: 'draft' }),
        this.count({ vendor_id: vendorId, status: 'submitted' }),
        this.count({ vendor_id: vendorId, status: 'approved' }),
        this.count({ vendor_id: vendorId, status: 'rejected' })
      ]);

      // Get average progress
      const { data: progressData } = await this.db
        .from(this.tableName)
        .select('total_progress')
        .eq('vendor_id', vendorId);

      const avgProgress = progressData.length > 0
        ? progressData.reduce((sum, item) => sum + parseFloat(item.total_progress || 0), 0) / progressData.length
        : 0;

      return {
        total,
        by_status: { draft, submitted, approved, rejected },
        average_progress: avgProgress.toFixed(2)
      };
    } catch (error) {
      console.error('Error getting vendor statistics:', error);
      throw error;
    }
  }

  /**
   * Get statistics by vendor type
   */
  async getStatisticsByVendorType() {
    try {
      const { data, error } = await this.db
        .from(this.tableName)
        .select(`
          *,
          vendor:users!bapp_vendor_id_fkey(role)
        `);

      if (error) throw error;

      const stats = {
        vendor_jasa: 0,
        vendor_barang: 0,
        vendor_legacy: 0,
        total: data.length
      };

      data.forEach(bapp => {
        if (bapp.vendor?.role === 'vendor_jasa') {
          stats.vendor_jasa++;
        } else if (bapp.vendor?.role === 'vendor_barang') {
          stats.vendor_barang++;
        } else if (bapp.vendor?.role === 'vendor') {
          stats.vendor_legacy++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting statistics by vendor type:', error);
      throw error;
    }
  }

  /**
   * Get pending approvals for user
   */
  async getPendingApprovals(userId, role) {
    try {
      let query = this.db
        .from(this.tableName)
        .select(`
          *,
          vendor:users!bapp_vendor_id_fkey(id, name, email, company),
          work_items:bapp_work_items(*)
        `)
        .in('status', ['submitted', 'in_review'])
        .order('created_at', { ascending: false });

      // Filter based on role
      if (role === 'approver') {
        query = query.or(`direksi_pekerjaan_id.is.null,direksi_pekerjaan_id.eq.${userId}`);
      } else if (role === 'vendor') {
        query = query.eq('vendor_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      throw error;
    }
  }

  /**
   * Calculate total progress from work items (private)
   */
  _calculateTotalProgress(workItems) {
    if (!workItems || workItems.length === 0) return 0;

    const totalActualProgress = workItems.reduce((sum, item) => {
      return sum + parseFloat(item.actual_progress || item.actualProgress || 0);
    }, 0);

    return (totalActualProgress / workItems.length).toFixed(2);
  }
}

module.exports = new BAPPRepository();