const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { validateUUIDParam } = require('../middlewares/validationMiddleware');

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for current user
 * @query   isRead, type, priority, page, limit
 * @access  Private
 */
router.get('/', protect, notificationController.getMyNotifications);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/unread-count', protect, notificationController.getUnreadCount);

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics
 * @access  Private
 */
router.get('/stats', protect, notificationController.getNotificationStats);

/**
 * @route   PUT /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/mark-all-read', protect, notificationController.markAllAsRead);

/**
 * @route   DELETE /api/notifications/clear-read
 * @desc    Delete all read notifications
 * @access  Private
 */
router.delete('/clear-read', protect, notificationController.clearReadNotifications);

/**
 * @route   POST /api/notifications/test
 * @desc    Create test notification (for testing purposes)
 * @access  Private (Admin only)
 */
router.post('/test', protect, authorize('admin'), notificationController.testNotification);

/**
 * @route   GET /api/notifications/:id
 * @desc    Get single notification by ID
 * @access  Private
 */
router.get('/:id', protect, validateUUIDParam('id'), notificationController.getNotificationById);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put('/:id/read', protect, validateUUIDParam('id'), notificationController.markAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
router.delete('/:id', protect, validateUUIDParam('id'), notificationController.deleteNotification);

module.exports = router;