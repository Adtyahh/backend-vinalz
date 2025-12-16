// src/services/notificationService.js
const { supabaseAdmin } = require('../config/supabase');

class NotificationService {
  
  /**
   * Create a new notification
   */
  async createNotification(notificationData) {
    try {
      const {
        userId,
        type,
        title,
        message,
        relatedDocumentType,
        relatedDocumentId,
        relatedDocumentNumber,
        actionUrl,
        priority = 'medium',
        metadata = {}
      } = notificationData;

      const { data, error } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: userId,
          type,
          title,
          message,
          related_document_type: relatedDocumentType,
          related_document_id: relatedDocumentId,
          related_document_number: relatedDocumentNumber,
          action_url: actionUrl,
          priority,
          metadata,
          is_read: false
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Create notifications for multiple users
   */
  async createBulkNotifications(userIds, notificationData) {
    try {
      const notifications = userIds.map(userId => ({
        user_id: userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        related_document_type: notificationData.relatedDocumentType,
        related_document_id: notificationData.relatedDocumentId,
        related_document_number: notificationData.relatedDocumentNumber,
        action_url: notificationData.actionUrl,
        priority: notificationData.priority || 'medium',
        metadata: notificationData.metadata || {},
        is_read: false
      }));

      const { error } = await supabaseAdmin
        .from('notifications')
        .insert(notifications);

      if (error) throw error;
      
      return {
        success: true,
        count: notifications.length
      };
    } catch (error) {
      console.error('Error creating bulk notifications:', error);
      throw error;
    }
  }

  /**
   * Notify when BAPB is submitted
   */
  async notifyBAPBSubmitted(bapb) {
    try {
      // Get all PIC Gudang and Approvers
      const { data: recipients, error } = await supabaseAdmin
        .from('users')
        .select('id')
        .in('role', ['pic_gudang', 'approver', 'admin'])
        .eq('is_active', true);

      if (error) throw error;

      const recipientIds = recipients.map(u => u.id);

      await this.createBulkNotifications(recipientIds, {
        type: 'bapb_submitted',
        title: 'BAPB Baru Menunggu Review',
        message: `BAPB ${bapb.bapb_number} telah disubmit dan menunggu pemeriksaan.`,
        relatedDocumentType: 'BAPB',
        relatedDocumentId: bapb.id,
        relatedDocumentNumber: bapb.bapb_number,
        actionUrl: `/bapb/${bapb.id}`,
        priority: 'high',
        metadata: {
          vendorId: bapb.vendor_id,
          orderNumber: bapb.order_number,
          deliveryDate: bapb.delivery_date
        }
      });

      console.log(`✅ Notified ${recipientIds.length} users about BAPB submission`);
    } catch (error) {
      console.error('Error notifying BAPB submission:', error);
    }
  }

  /**
   * Notify vendor when BAPB is approved
   */
  async notifyBAPBApproved(bapb, approverName) {
    try {
      await this.createNotification({
        userId: bapb.vendor_id,
        type: 'bapb_approved',
        title: 'BAPB Disetujui',
        message: `BAPB ${bapb.bapb_number} telah disetujui oleh ${approverName}.`,
        relatedDocumentType: 'BAPB',
        relatedDocumentId: bapb.id,
        relatedDocumentNumber: bapb.bapb_number,
        actionUrl: `/bapb/${bapb.id}`,
        priority: 'high',
        metadata: {
          approverName,
          approvedAt: new Date()
        }
      });

      console.log(`✅ Notified vendor about BAPB approval`);
    } catch (error) {
      console.error('Error notifying BAPB approval:', error);
    }
  }

  /**
   * Notify vendor when BAPB is rejected
   */
  async notifyBAPBRejected(bapb, rejectionReason) {
    try {
      await this.createNotification({
        userId: bapb.vendor_id,
        type: 'bapb_rejected',
        title: 'BAPB Ditolak',
        message: `BAPB ${bapb.bapb_number} ditolak. Alasan: ${rejectionReason}`,
        relatedDocumentType: 'BAPB',
        relatedDocumentId: bapb.id,
        relatedDocumentNumber: bapb.bapb_number,
        actionUrl: `/bapb/${bapb.id}`,
        priority: 'urgent',
        metadata: {
          rejectionReason,
          rejectedAt: new Date()
        }
      });

      console.log(`✅ Notified vendor about BAPB rejection`);
    } catch (error) {
      console.error('Error notifying BAPB rejection:', error);
    }
  }

  /**
   * Notify vendor when BAPB needs revision
   */
  async notifyBAPBRevisionRequired(bapb, revisionReason) {
    try {
      await this.createNotification({
        userId: bapb.vendor_id,
        type: 'bapb_revision_required',
        title: 'BAPB Perlu Revisi',
        message: `BAPB ${bapb.bapb_number} memerlukan revisi. Catatan: ${revisionReason}`,
        relatedDocumentType: 'BAPB',
        relatedDocumentId: bapb.id,
        relatedDocumentNumber: bapb.bapb_number,
        actionUrl: `/bapb/${bapb.id}/edit`,
        priority: 'high',
        metadata: {
          revisionReason,
          requestedAt: new Date()
        }
      });

      console.log(`✅ Notified vendor about BAPB revision request`);
    } catch (error) {
      console.error('Error notifying BAPB revision:', error);
    }
  }

  /**
   * Notify when BAPP is submitted
   */
  async notifyBAPPSubmitted(bapp) {
    try {
      const { data: recipients, error } = await supabaseAdmin
        .from('users')
        .select('id')
        .in('role', ['approver', 'admin'])
        .eq('is_active', true);

      if (error) throw error;

      const recipientIds = recipients.map(u => u.id);

      await this.createBulkNotifications(recipientIds, {
        type: 'bapp_submitted',
        title: 'BAPP Baru Menunggu Review',
        message: `BAPP ${bapp.bapp_number} untuk proyek "${bapp.project_name}" telah disubmit.`,
        relatedDocumentType: 'BAPP',
        relatedDocumentId: bapp.id,
        relatedDocumentNumber: bapp.bapp_number,
        actionUrl: `/bapp/${bapp.id}`,
        priority: 'high',
        metadata: {
          vendorId: bapp.vendor_id,
          projectName: bapp.project_name,
          totalProgress: bapp.total_progress
        }
      });

      console.log(`✅ Notified ${recipientIds.length} users about BAPP submission`);
    } catch (error) {
      console.error('Error notifying BAPP submission:', error);
    }
  }

  /**
   * Notify vendor when BAPP is approved
   */
  async notifyBAPPApproved(bapp, approverName) {
    try {
      await this.createNotification({
        userId: bapp.vendor_id,
        type: 'bapp_approved',
        title: 'BAPP Disetujui',
        message: `BAPP ${bapp.bapp_number} untuk proyek "${bapp.project_name}" telah disetujui oleh ${approverName}.`,
        relatedDocumentType: 'BAPP',
        relatedDocumentId: bapp.id,
        relatedDocumentNumber: bapp.bapp_number,
        actionUrl: `/bapp/${bapp.id}`,
        priority: 'high',
        metadata: {
          approverName,
          projectName: bapp.project_name,
          totalProgress: bapp.total_progress,
          approvedAt: new Date()
        }
      });

      console.log(`✅ Notified vendor about BAPP approval`);
    } catch (error) {
      console.error('Error notifying BAPP approval:', error);
    }
  }

  /**
   * Notify vendor when BAPP is rejected
   */
  async notifyBAPPRejected(bapp, rejectionReason) {
    try {
      await this.createNotification({
        userId: bapp.vendor_id,
        type: 'bapp_rejected',
        title: 'BAPP Ditolak',
        message: `BAPP ${bapp.bapp_number} ditolak. Alasan: ${rejectionReason}`,
        relatedDocumentType: 'BAPP',
        relatedDocumentId: bapp.id,
        relatedDocumentNumber: bapp.bapp_number,
        actionUrl: `/bapp/${bapp.id}`,
        priority: 'urgent',
        metadata: {
          rejectionReason,
          projectName: bapp.project_name,
          rejectedAt: new Date()
        }
      });

      console.log(`✅ Notified vendor about BAPP rejection`);
    } catch (error) {
      console.error('Error notifying BAPP rejection:', error);
    }
  }

  /**
   * Notify vendor when BAPP needs revision
   */
  async notifyBAPPRevisionRequired(bapp, revisionReason) {
    try {
      await this.createNotification({
        userId: bapp.vendor_id,
        type: 'bapp_revision_required',
        title: 'BAPP Perlu Revisi',
        message: `BAPP ${bapp.bapp_number} memerlukan revisi. Catatan: ${revisionReason}`,
        relatedDocumentType: 'BAPP',
        relatedDocumentId: bapp.id,
        relatedDocumentNumber: bapp.bapp_number,
        actionUrl: `/bapp/${bapp.id}/edit`,
        priority: 'high',
        metadata: {
          revisionReason,
          projectName: bapp.project_name,
          requestedAt: new Date()
        }
      });

      console.log(`✅ Notified vendor about BAPP revision request`);
    } catch (error) {
      console.error('Error notifying BAPP revision:', error);
    }
  }

  /**
   * Notify vendor about payment processing
   */
  async notifyPaymentProcessed(vendorId, paymentData) {
    try {
      await this.createNotification({
        userId: vendorId,
        type: 'payment_processed',
        title: 'Pembayaran Diproses',
        message: `Pembayaran untuk ${paymentData.documentNumber} sebesar Rp ${paymentData.amount.toLocaleString('id-ID')} telah diproses.`,
        relatedDocumentType: paymentData.documentType,
        relatedDocumentId: paymentData.documentId,
        relatedDocumentNumber: paymentData.documentNumber,
        actionUrl: `/payment/${paymentData.documentType.toLowerCase()}/${paymentData.documentId}`,
        priority: 'high',
        metadata: {
          amount: paymentData.amount,
          transactionId: paymentData.transactionId,
          processedAt: new Date()
        }
      });

      console.log(`✅ Notified vendor about payment processing`);
    } catch (error) {
      console.error('Error notifying payment:', error);
    }
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId, filters = {}) {
    try {
      const {
        isRead,
        type,
        priority,
        page = 1,
        limit = 20
      } = filters;

      let query = supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      if (isRead !== undefined) {
        query = query.eq('is_read', isRead === 'true' || isRead === true);
      }

      if (type) {
        query = query.eq('type', type);
      }

      if (priority) {
        query = query.eq('priority', priority);
      }

      const offset = (page - 1) * limit;

      query = query
        .order('is_read', { ascending: true })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      const unreadCount = await this.getUnreadCount(userId);

      return {
        notifications: data,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
          unreadCount
        }
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId) {
    try {
      const { count, error } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_read', false)
        .select();

      if (error) throw error;

      return {
        success: true,
        count: data.length
      };
    } catch (error) {
      console.error('Error marking all as read:', error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId, userId) {
    try {
      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();