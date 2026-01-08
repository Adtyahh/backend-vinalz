const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { protect } = require('../middlewares/authMiddleware');
const { validateUUIDParam } = require('../middlewares/validationMiddleware');

// ==================== BAPB Document Routes ====================

/**
 * @route   GET /api/documents/bapb/:id/pdf
 * @desc    Generate and download BAPB PDF
 * @access  Private
 */
router.get('/bapb/:id/pdf', protect, validateUUIDParam('id'), documentController.generateBAPBPDF);

/**
 * @route   GET /api/documents/bapb/:id/preview
 * @desc    Generate and preview BAPB PDF (Base64)
 * @access  Private
 */
router.get('/bapb/:id/preview', protect, validateUUIDParam('id'), documentController.previewBAPBPDF);

// ==================== BAPP Document Routes ====================

/**
 * @route   GET /api/documents/bapp/:id/pdf
 * @desc    Generate and download BAPP PDF
 * @access  Private
 */
router.get('/bapp/:id/pdf', protect, validateUUIDParam('id'), documentController.generateBAPPPDF);

/**
 * @route   GET /api/documents/bapp/:id/preview
 * @desc    Generate and preview BAPP PDF (Base64)
 * @access  Private
 */
router.get('/bapp/:id/preview', protect, validateUUIDParam('id'), documentController.previewBAPPPDF);

// ==================== Completed Documents Routes ====================

/**
 * @route   GET /api/documents/completed
 * @desc    Get all completed (approved) documents
 * @access  Private
 */
router.get('/completed', protect, documentController.getCompletedDocuments);

/**
 * @route   GET /api/documents/:id/download?type=BAPB|BAPP
 * @desc    Download completed document by ID
 * @access  Private
 */
router.get('/:id/download', protect, validateUUIDParam('id'), documentController.downloadCompletedDocument);



module.exports = router;
