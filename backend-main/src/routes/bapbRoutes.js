const express = require('express');
const router = express.Router();
const bapbController = require('../controllers/bapbController');
const bapbApprovalController = require('../controllers/bapbApprovalController'); 
const signatureController = require('../controllers/signatureController');         
const attachmentController = require('../controllers/attachmentController');     

const { protect, authorize, authorizeVendorType } = require('../middlewares/authMiddleware');
const { validateBAPB, validateUUIDParam } = require('../middlewares/validationMiddleware');

// ==================== BAPB CORE CRUD ROUTES ====================

router.get('/', protect, bapbController.getAllBAPB);
router.post('/:id/submit', protect, authorize('vendor', 'vendor_barang', 'vendor_jasa'),bapbController.submitBAPB);
router.get('/:id', protect, validateUUIDParam('id'), bapbController.getBAPBById);
router.put('/:id', protect, authorize('vendor'), validateUUIDParam('id'), bapbController.updateBAPB);
router.delete('/:id', protect, authorize('vendor'), validateUUIDParam('id'), bapbController.deleteBAPB);
router.post('/:id/submit', protect, authorize('vendor'), validateUUIDParam('id'), bapbController.submitBAPB);
router.post('/', protect, authorizeVendorType('barang'), validateBAPB, bapbController.createBAPB);
router.get('/statistics/by-vendor-type', protect, authorize('admin'), bapbController.getBAPBStatisticsByVendorType);
router.get('/validate-access', protect, bapbController.validateBAPBAccess);


// ==================== BAPB APPROVAL ROUTES ====================

router.post('/:id/approve', protect, authorize('pic_gudang', 'approver', 'admin'), validateUUIDParam('id'), bapbApprovalController.approveBAPB);
router.post('/:id/reject', protect, authorize('pic_gudang', 'approver', 'admin'), validateUUIDParam('id'), bapbApprovalController.rejectBAPB);
router.post('/:id/revision', protect, authorize('pic_gudang', 'approver', 'admin'), validateUUIDParam('id'), bapbApprovalController.requestRevisionBAPB);
router.get('/:id/approvals', protect, validateUUIDParam('id'), bapbApprovalController.getBAPBApprovalHistory);

// ==================== BAPB SIGNATURE ROUTES  ====================

/**
 * @route   POST /api/bapb/:id/signature
 * @desc    Upload signature for BAPB
 * @access  Private (Vendor or PIC Gudang)
 */
router.post('/:id/signature', protect, validateUUIDParam('id'), signatureController.uploadBAPBSignature);

/**
 * @route   GET /api/bapb/:id/signatures
 * @desc    Get all signatures for BAPB
 * @access  Private
 */
router.get('/:id/signatures', protect, validateUUIDParam('id'), signatureController.getBAPBSignatures);


// ==================== BAPB ATTACHMENT ROUTES ====================

/**
 * @route   POST /api/bapb/:id/attachments
 * @desc    Upload supporting document for BAPB
 * @access  Private
 */
router.post('/:id/attachments', protect, validateUUIDParam('id'), attachmentController.uploadBAPBDocument);

/**
 * @route   GET /api/bapb/:id/attachments
 * @desc    Get all attachments for BAPB
 * @access  Private
 */
router.get('/:id/attachments', protect, validateUUIDParam('id'), attachmentController.getBAPBAttachments);

/**
 * @route   DELETE /api/bapb/:id/attachments/:attachmentId
 * @desc    Delete attachment for BAPB (Uses type=bapb query in controller)
 * @access  Private (Uploader or Admin)
 */
router.delete('/:id/attachments/:attachmentId', protect, validateUUIDParam('id'), validateUUIDParam('attachmentId'), attachmentController.deleteAttachment);

/**
 * @route   GET /api/bapb/:id/attachments/:attachmentId/download
 * @desc    Download attachment for BAPB (Uses type=bapb query in controller)
 * @access  Private
 */
router.get('/:id/attachments/:attachmentId/download', protect, validateUUIDParam('id'), validateUUIDParam('attachmentId'), attachmentController.downloadAttachment);


module.exports = router;
