const BaseRepository = require("./BaseRepository");

class BAPBRepository extends BaseRepository {
  constructor() {
    super("bapb");
  }

  /**
   * Find BAPB by ID with all relations
   */
  async findByIdWithRelations(id) {
    try {
      const { data, error } = await this.db
        .from(this.tableName)
        .select(
          `
          *,
          vendor:users!bapb_vendor_id_fkey(id, name, email, company, phone),
          pic_gudang:users!bapb_pic_gudang_id_fkey(id, name, email),
          items:bapb_items(*),
          approvals:bapb_approvals(
            *,
            approver:users(id, name, email, role)
          ),
          attachments:bapb_attachments(
            *,
            uploader:users(id, name, email)
          )
        `
        )
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Error finding BAPB with relations:", error);
      throw error;
    }
  }

  /**
   * Find all BAPB with pagination and filters
   */
  async findAllWithRelations(filters = {}, pagination = {}) {
    try {
      let query = this.db.from(this.tableName).select(
        `
          *,
          vendor:users!bapb_vendor_id_fkey(id, name, email, company),
          pic_gudang:users!bapb_pic_gudang_id_fkey(id, name, email),
          items:bapb_items(*)
        `,
        { count: "exact" }
      );

      // Apply filters
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.vendor_id) query = query.eq("vendor_id", filters.vendor_id);
      if (filters.pic_gudang_id) query = query.eq("pic_gudang_id", filters.pic_gudang_id);
      if (filters.date_from) query = query.gte("delivery_date", filters.date_from);
      if (filters.date_to) query = query.lte("delivery_date", filters.date_to);

      // Apply pagination
      const limit = pagination.limit || 10;
      const offset = pagination.offset || 0;

      query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return { data, count };
    } catch (error) {
      console.error("Error finding BAPB with relations:", error);
      throw error;
    }
  }

  /**
   * Create BAPB with items
   * FIXED: Properly map field names and ensure items are created
   */
  async createWithItems(bapbData, items = []) {
    try {
      console.log("📝 Creating BAPB with data:", JSON.stringify(bapbData, null, 2));
      console.log("📦 Items to create:", JSON.stringify(items, null, 2));

      // Create BAPB first
      const bapb = await this.create(bapbData);
      console.log("✅ BAPB created:", bapb.id);

      // Create items if provided
      if (items && items.length > 0) {
        // Map field names from camelCase to snake_case for database
        const itemsToCreate = items.map((item) => ({
          bapb_id: bapb.id,
          item_name: item.itemName || item.item_name,
          quantity_ordered: item.quantityOrdered || item.quantity_ordered,
          quantity_received: item.quantityReceived || item.quantity_received,
          unit: item.unit,
          condition: item.condition,
          notes: item.notes || null,
        }));

        console.log("💾 Inserting items:", JSON.stringify(itemsToCreate, null, 2));

        const { data: createdItems, error: itemsError } = await this.db.from("bapb_items").insert(itemsToCreate).select();

        if (itemsError) {
          console.error("❌ Error creating items:", itemsError);
          // Rollback: delete the BAPB if items creation failed
          await this.delete(bapb.id);
          throw new Error(`Failed to create BAPB items: ${itemsError.message}`);
        }

        console.log("✅ Items created successfully:", createdItems.length);
      } else {
        console.warn("⚠️ No items provided for BAPB");
      }

      // Return BAPB with items
      const result = await this.findByIdWithRelations(bapb.id);
      console.log("📋 Final BAPB with items:", JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error("❌ Error creating BAPB with items:", error);
      throw error;
    }
  }

  /**
   * Update BAPB with items
   * FIXED: Properly handle field name mapping
   */
  async updateWithItems(id, bapbData, items = null) {
    try {
      console.log("📝 Updating BAPB:", id);
      console.log("📦 Update data:", JSON.stringify(bapbData, null, 2));
      console.log("📦 New items:", items ? JSON.stringify(items, null, 2) : "No items update");

      // Update BAPB
      await this.update(id, bapbData);

      // Update items if provided
      if (items !== null && Array.isArray(items)) {
        // Delete old items
        const { error: deleteError } = await this.db.from("bapb_items").delete().eq("bapb_id", id);

        if (deleteError) {
          console.error("❌ Error deleting old items:", deleteError);
          throw deleteError;
        }

        // Insert new items
        if (items.length > 0) {
          const itemsToCreate = items.map((item) => ({
            bapb_id: id,
            item_name: item.itemName || item.item_name,
            quantity_ordered: item.quantityOrdered || item.quantity_ordered,
            quantity_received: item.quantityReceived || item.quantity_received,
            unit: item.unit,
            condition: item.condition,
            notes: item.notes || null,
          }));

          const { error: insertError } = await this.db.from("bapb_items").insert(itemsToCreate);

          if (insertError) {
            console.error("❌ Error inserting new items:", insertError);
            throw insertError;
          }
        }
      }

      // Return updated BAPB with items
      return await this.findByIdWithRelations(id);
    } catch (error) {
      console.error("❌ Error updating BAPB with items:", error);
      throw error;
    }
  }

  /**
   * Update BAPB status
   */
  async updateStatus(id, status, additionalData = {}) {
    const updateData = { status, ...additionalData };
    return await this.update(id, updateData);
  }

  /**
   * Get BAPB by number
   */
  async findByNumber(bapbNumber) {
    return await this.findOne({ bapb_number: bapbNumber });
  }

  /**
   * Generate BAPB number
   * FIXED: Better error handling and counting
   */
  async generateBAPBNumber() {
    try {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");

      // Count BAPBs in current month
      const startOfMonth = new Date(year, date.getMonth(), 1).toISOString();
      const endOfMonth = new Date(year, date.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { count, error } = await this.db.from(this.tableName).select("*", { count: "exact", head: true }).gte("created_at", startOfMonth).lte("created_at", endOfMonth);

      if (error) {
        console.error("Error counting BAPBs:", error);
        throw error;
      }

      const sequence = String((count || 0) + 1).padStart(4, "0");
      return `BAPB/${year}/${month}/${sequence}`;
    } catch (error) {
      console.error("Error generating BAPB number:", error);
      throw error;
    }
  }

  /**
   * Create approval record
   */
  async createApproval(approvalData) {
    try {
      const { data, error } = await this.db.from("bapb_approvals").insert(approvalData).select().single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error creating approval:", error);
      throw error;
    }
  }

  /**
   * Get approval history
   */
  async getApprovalHistory(bapbId) {
    try {
      const { data, error } = await this.db
        .from("bapb_approvals")
        .select(
          `
          *,
          approver:users(id, name, email, role)
        `
        )
        .eq("bapb_id", bapbId)
        .order("approved_at", { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error getting approval history:", error);
      throw error;
    }
  }

  /**
   * Check if user already approved
   */
  async hasUserApproved(bapbId, approverId) {
    try {
      const { data, error } = await this.db.from("bapb_approvals").select("id").eq("bapb_id", bapbId).eq("approver_id", approverId).eq("action", "approved").single();

      if (error && error.code !== "PGRST116") throw error;
      return !!data;
    } catch (error) {
      console.error("Error checking approval:", error);
      throw error;
    }
  }

  /**
   * Get BAPB statistics by vendor
   */
  async getVendorStatistics(vendorId) {
    try {
      const [total, draft, submitted, approved, rejected] = await Promise.all([
        this.count({ vendor_id: vendorId }),
        this.count({ vendor_id: vendorId, status: "draft" }),
        this.count({ vendor_id: vendorId, status: "submitted" }),
        this.count({ vendor_id: vendorId, status: "approved" }),
        this.count({ vendor_id: vendorId, status: "rejected" }),
      ]);

      return {
        total,
        by_status: { draft, submitted, approved, rejected },
      };
    } catch (error) {
      console.error("Error getting vendor statistics:", error);
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
        .select(
          `
          *,
          vendor:users!bapb_vendor_id_fkey(id, name, email, company),
          items:bapb_items(*)
        `
        )
        .in("status", ["submitted", "in_review"])
        .order("created_at", { ascending: false });

      // Filter based on role
      if (role === "pic_gudang") {
        query = query.or(`pic_gudang_id.is.null,pic_gudang_id.eq.${userId}`);
      } else if (role === "vendor") {
        query = query.eq("vendor_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data;
    } catch (error) {
      console.error("Error getting pending approvals:", error);
      throw error;
    }
  }

  /**
   * Get statistics by vendor type
   */
  async getStatisticsByVendorType() {
    try {
      const { data, error } = await this.db.from(this.tableName).select(`
        *,
        vendor:users!bapb_vendor_id_fkey(role)
      `);

      if (error) throw error;

      const stats = {
        vendor_barang: 0,
        vendor_jasa: 0,
        vendor_legacy: 0,
        total: data.length,
      };

      data.forEach((bapb) => {
        if (bapb.vendor?.role === "vendor_barang") {
          stats.vendor_barang++;
        } else if (bapb.vendor?.role === "vendor_jasa") {
          stats.vendor_jasa++;
        } else if (bapb.vendor?.role === "vendor") {
          stats.vendor_legacy++;
        }
      });

      return stats;
    } catch (error) {
      console.error("Error getting statistics by vendor type:", error);
      throw error;
    }
  }
}

module.exports = new BAPBRepository();
