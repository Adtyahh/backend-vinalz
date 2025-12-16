const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { validateUUIDParam } = require('../middlewares/validationMiddleware');

// ==================== BAPB Payment Routes ====================

/**
 * @route   POST /api/payment/bapb/:id/process
 * @desc    Process payment for approved BAPB (Simulation)
 * @access  Private (Admin/Finance role)
 */
router.post('/bapb/:id/process', protect, authorize('admin'), validateUUIDParam('id'), paymentController.processBAPBPayment);

/**
 * @route   GET /api/payment/bapb/:id/logs?type=BAPB
 * @desc    Get payment logs for BAPB
 * @access  Private
 */
router.get('/bapb/:id/logs', protect, validateUUIDParam('id'), paymentController.getPaymentLogs);

/**
 * @route   GET /api/payment/bapb/:id/readiness?type=BAPB
 * @desc    Check if BAPB is ready for payment
 * @access  Private
 */
router.get('/bapb/:id/readiness', protect, validateUUIDParam('id'), paymentController.checkPaymentReadiness);


// ==================== BAPP Payment Routes ====================

/**
 * @route   POST /api/payment/bapp/:id/process
 * @desc    Process payment for approved BAPP (Simulation)
 * @access  Private (Admin/Finance role)
 */
router.post('/bapp/:id/process', protect, authorize('admin'), validateUUIDParam('id'), paymentController.processBAPPPayment);

/**
 * @route   GET /api/payment/bapp/:id/logs?type=BAPP
 * @desc    Get payment logs for BAPP
 * @access  Private
 */
router.get('/bapp/:id/logs', protect, validateUUIDParam('id'), paymentController.getPaymentLogs);

/**
 * @route   GET /api/payment/bapp/:id/readiness?type=BAPP
 * @desc    Check if BAPP is ready for payment
 * @access  Private
 */
router.get('/bapp/:id/readiness', protect, validateUUIDParam('id'), paymentController.checkPaymentReadiness);


module.exports = router;