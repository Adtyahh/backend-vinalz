// src/controllers/notificationController.js
const notificationService = require('../services/notificationService');
const { supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../utils/errorHandler');

/**
 * Get all notifications for current user
 * @route GET /api/notifications
 * @access Private
 */
exports.getMyNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { isRead, type, priority, page, limit } = req.query;

  const result = await notificationService.getUserNotifications(userId, {
    isRead,
    type,
    priority,
    page,
    limit
  });

  res.status(200).json({
    success: true,
    data: result.notifications,
    pagination: result.pagination
  });
});

/**
 * Get unread notification count
 * @route GET /api/notifications/unread-count
 * @access Private
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const count = await notificationService.getUnreadCount(userId);

  res.status(200).json({
    success: true,
    data: { count }
  });
});

/**
 * Get single notification by ID
 * @route GET /api/notifications/:id
 * @access Private
 */
exports.getNotificationById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const { data: notification, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  res.status(200).json({
    success: true,
    data: notification
  });
});

/**
 * Mark notification as read
 * @route PUT /api/notifications/:id/read
 * @access Private
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const notification = await notificationService.markAsRead(id, userId);

  res.status(200).json({
    success: true,
    message: 'Notification marked as read',
    data: notification
  });
});

/**
 * Mark all notifications as read
 * @route PUT /api/notifications/mark-all-read
 * @access Private
 */
exports.markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const result = await notificationService.markAllAsRead(userId);

  res.status(200).json({
    success: true,
    message: `${result.count} notifications marked as read`,
    data: result
  });
});

/**
 * Delete notification
 * @route DELETE /api/notifications/:id
 * @access Private
 */
exports.deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  await notificationService.deleteNotification(id, userId);

  res.status(200).json({
    success: true,
    message: 'Notification deleted successfully'
  });
});

/**
 * Delete all read notifications
 * @route DELETE /api/notifications/clear-read
 * @access Private
 */
exports.clearReadNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const { error } = await supabaseAdmin
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .eq('is_read', true);

  if (error) throw error;

  res.status(200).json({
    success: true,
    message: 'Read notifications cleared'
  });
});

/**
 * Get notification statistics
 * @route GET /api/notifications/stats
 * @access Private
 */
exports.getNotificationStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get all notifications for this user
  const { data: notifications, error } = await supabaseAdmin
    .from('notifications')
    .select('type, priority, is_read')
    .eq('user_id', userId);

  if (error) throw error;

  const total = notifications.length;
  const unread = notifications.filter(n => !n.is_read).length;
  const read = total - unread;

  // Group by type
  const byType = notifications.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {});

  // Group by priority
  const byPriority = notifications.reduce((acc, n) => {
    acc[n.priority] = (acc[n.priority] || 0) + 1;
    return acc;
  }, {});

  res.status(200).json({
    success: true,
    data: {
      total,
      unread,
      read,
      byType,
      byPriority
    }
  });
});

/**
 * Test notification (Admin only - for testing)
 * @route POST /api/notifications/test
 * @access Private (Admin)
 */
exports.testNotification = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const notification = await notificationService.createNotification({
    userId,
    type: 'general',
    title: 'Test Notification',
    message: 'This is a test notification to verify the system is working correctly.',
    priority: 'medium',
    actionUrl: '/dashboard'
  });

  res.status(201).json({
    success: true,
    message: 'Test notification created',
    data: notification
  });
});

module.exports = exports;