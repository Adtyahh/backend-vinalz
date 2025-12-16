const express = require('express');
const router = express.Router();
const bappController = require('../controllers/bappController');
const bappApprovalController = require('../controllers/bappApprovalController');
const signatureController = require('../controllers/signatureController');         
const attachmentController = require('../controllers/attachmentController');     
  
const { protect, authorize, authorizeVendorType } = require('../middlewares/authMiddleware');
const { validateBAPP, validateUUIDParam } = require('../middlewares/validationMiddleware');

// ==================== BAPP UTILITY ROUTES (HARUS DI ATAS) ====================
// PENTING: Routes tanpa :id parameter harus di atas routes dengan :id

/**
 * @route   GET /api/bapp/validate-access
 * @desc    Validate if user can create BAPP
 * @access  Private
 */
router.get('/validate-access', protect, bappController.validateBAPPAccess);

/**
 * @route   GET /api/bapp/statistics/by-vendor-type
 * @desc    Get BAPP statistics by vendor type
 * @access  Private (Admin)
 */
router.get('/statistics/by-vendor-type', protect, authorize('admin'), bappController.getBAPPStatisticsByVendorType);

// ==================== BAPP CORE CRUD ROUTES ====================

router.get('/', protect, bappController.getAllBAPP);
router.post('/', protect, authorize('vendor_jasa', 'vendor', 'admin'), validateBAPP, bappController.createBAPP);
router.get('/:id', protect, validateUUIDParam('id'), bappController.getBAPPById);
router.put('/:id', protect, authorize('vendor_jasa', 'vendor', 'admin'), validateUUIDParam('id'), bappController.updateBAPP);
router.delete('/:id', protect, authorize('vendor_jasa', 'vendor', 'admin'), validateUUIDParam('id'), bappController.deleteBAPP);
router.post('/:id/submit', protect, authorize('vendor_jasa', 'vendor', 'admin'), validateUUIDParam('id'), bappController.submitBAPP);

// ==================== BAPP APPROVAL ROUTES ====================

router.post('/:id/approve', protect, authorize('approver', 'admin'), validateUUIDParam('id'), bappApprovalController.approveBAPP);
router.post('/:id/reject', protect, authorize('approver', 'admin'), validateUUIDParam('id'), bappApprovalController.rejectBAPP);
router.post('/:id/revision', protect, authorize('approver', 'admin'), validateUUIDParam('id'), bappApprovalController.requestRevisionBAPP);
router.get('/:id/approvals', protect, validateUUIDParam('id'), bappApprovalController.getBAPPApprovalHistory);

// ==================== BAPP SIGNATURE ROUTES ====================

router.post('/:id/signature', protect, validateUUIDParam('id'), signatureController.uploadBAPPSignature);
router.get('/:id/signatures', protect, validateUUIDParam('id'), signatureController.getBAPPSignatures);

// ==================== BAPP ATTACHMENT ROUTES ====================

router.post('/:id/attachments', protect, validateUUIDParam('id'), attachmentController.uploadBAPPDocument);
router.get('/:id/attachments', protect, validateUUIDParam('id'), attachmentController.getBAPPAttachments);
router.delete('/:id/attachments/:attachmentId', protect, validateUUIDParam('id'), validateUUIDParam('attachmentId'), attachmentController.deleteAttachment);
router.get('/:id/attachments/:attachmentId/download', protect, validateUUIDParam('id'), validateUUIDParam('attachmentId'), attachmentController.downloadAttachment);

module.exports = router;