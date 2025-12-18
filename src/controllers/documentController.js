const BAPBRepository = require('../repositories/BAPBRepository');
const BAPPRepository = require('../repositories/BAPPRepository');
const pdfService = require('../services/pdfService');
const { supabaseAdmin } = require('../config/supabase');
const path = require('path');
const fs = require('fs').promises;

/**
 * Generate and download BAPB PDF document
 * @route GET /api/documents/bapb/:id/pdf
 * @access Private
 */
exports.generateBAPBPDF = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch complete BAPB data
    const bapb = await BAPBRepository.findByIdWithRelations(id);

    if (!bapb) {
      return res.status(404).json({
        success: false,
        message: 'BAPB not found'
      });
    }

    // Check authorization
    if (req.user.role === 'vendor' && bapb.vendor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this BAPB'
      });
    }

    // Prepare signature paths
    const signatures = {
      vendorSignature: null,
      picGudangSignature: null
    };

    // Find signatures from attachments
    if (bapb.attachments && bapb.attachments.length > 0) {
      bapb.attachments.forEach(attachment => {
        if (attachment.file_type !== 'signature') return;
        
        const fullPath = path.join(__dirname, '../..', attachment.file_path);
        
        if (attachment.uploaded_by === bapb.vendor_id) {
          signatures.vendorSignature = fullPath;
        } else if (bapb.pic_gudang_id && attachment.uploaded_by === bapb.pic_gudang_id) {
          signatures.picGudangSignature = fullPath;
        }
      });
    }

    // Generate PDF
    const { filePath, fileName } = await pdfService.generateBAPBPDF(bapb, signatures);

    // Send file as download
    res.download(filePath, fileName, async (err) => {
      if (err) {
        console.error('Error sending file:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error downloading PDF'
          });
        }
      }

      // Clean up temp file after download
      try {
        await fs.unlink(filePath);
      } catch (unlinkErr) {
        console.error('Error deleting temp file:', unlinkErr);
      }
    });

  } catch (error) {
    console.error('Generate BAPB PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating PDF',
      error: error.message
    });
  }
};

/**
 * Generate and download BAPP PDF document
 * @route GET /api/documents/bapp/:id/pdf
 * @access Private
 */
exports.generateBAPPPDF = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch complete BAPP data
    const bapp = await BAPPRepository.findByIdWithRelations(id);

    if (!bapp) {
      return res.status(404).json({
        success: false,
        message: 'BAPP not found'
      });
    }

    // Check authorization
    if (req.user.role === 'vendor' && bapp.vendor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this BAPP'
      });
    }

    // Prepare signature paths
    const signatures = {
      vendorSignature: null,
      approverSignature: null
    };

    // Find signatures
    if (bapp.attachments && bapp.attachments.length > 0) {
      bapp.attachments.forEach(attachment => {
        if (attachment.file_type !== 'signature') return;
        
        const fullPath = path.join(__dirname, '../..', attachment.file_path);
        
        if (attachment.uploaded_by === bapp.vendor_id) {
          signatures.vendorSignature = fullPath;
        } else if (bapp.direksi_pekerjaan_id && attachment.uploaded_by === bapp.direksi_pekerjaan_id) {
          signatures.approverSignature = fullPath;
        }
      });
    }

    // Generate PDF
    const { filePath, fileName } = await pdfService.generateBAPPPDF(bapp, signatures);

    // Send file as download
    res.download(filePath, fileName, async (err) => {
      if (err) {
        console.error('Error sending file:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error downloading PDF'
          });
        }
      }

      // Clean up temp file
      try {
        await fs.unlink(filePath);
      } catch (unlinkErr) {
        console.error('Error deleting temp file:', unlinkErr);
      }
    });

  } catch (error) {
    console.error('Generate BAPP PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating PDF',
      error: error.message
    });
  }
};

/**
 * Preview BAPB PDF (return as base64 for frontend preview)
 * @route GET /api/documents/bapb/:id/preview
 * @access Private
 */
exports.previewBAPBPDF = async (req, res) => {
  try {
    const { id } = req.params;

    const bapb = await BAPBRepository.findByIdWithRelations(id);

    if (!bapb) {
      return res.status(404).json({
        success: false,
        message: 'BAPB not found'
      });
    }

    if (req.user.role === 'vendor' && bapb.vendor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const signatures = { vendorSignature: null, picGudangSignature: null };
    
    if (bapb.attachments) {
      bapb.attachments.forEach(att => {
        if (att.file_type !== 'signature') return;
        const fullPath = path.join(__dirname, '../..', att.file_path);
        if (att.uploaded_by === bapb.vendor_id) signatures.vendorSignature = fullPath;
        else if (bapb.pic_gudang_id && att.uploaded_by === bapb.pic_gudang_id) signatures.picGudangSignature = fullPath;
      });
    }

    const { filePath } = await pdfService.generateBAPBPDF(bapb, signatures);
    
    // Read file as base64
    const pdfBuffer = await fs.readFile(filePath);
    const pdfBase64 = pdfBuffer.toString('base64');

    // Clean up
    await fs.unlink(filePath);

    res.status(200).json({
      success: true,
      data: {
        pdf: `data:application/pdf;base64,${pdfBase64}`,
        fileName: `BAPB-${bapb.bapb_number.replace(/\//g, '-')}.pdf`
      }
    });

  } catch (error) {
    console.error('Preview BAPB PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating preview',
      error: error.message
    });
  }
};

/**
 * Preview BAPP PDF
 * @route GET /api/documents/bapp/:id/preview
 * @access Private
 */
exports.previewBAPPPDF = async (req, res) => {
  try {
    const { id } = req.params;

    const bapp = await BAPPRepository.findByIdWithRelations(id);

    if (!bapp) {
      return res.status(404).json({
        success: false,
        message: 'BAPP not found'
      });
    }

    if (req.user.role === 'vendor' && bapp.vendor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const signatures = { vendorSignature: null, approverSignature: null };
    
    if (bapp.attachments) {
      bapp.attachments.forEach(att => {
        if (att.file_type !== 'signature') return;
        const fullPath = path.join(__dirname, '../..', att.file_path);
        if (att.uploaded_by === bapp.vendor_id) signatures.vendorSignature = fullPath;
        else if (bapp.direksi_pekerjaan_id && att.uploaded_by === bapp.direksi_pekerjaan_id) signatures.approverSignature = fullPath;
      });
    }

    const { filePath } = await pdfService.generateBAPPPDF(bapp, signatures);
    
    const pdfBuffer = await fs.readFile(filePath);
    const pdfBase64 = pdfBuffer.toString('base64');

    await fs.unlink(filePath);

    res.status(200).json({
      success: true,
      data: {
        pdf: `data:application/pdf;base64,${pdfBase64}`,
        fileName: `BAPP-${bapp.bapp_number.replace(/\//g, '-')}.pdf`
      }
    });

  } catch (error) {
    console.error('Preview BAPP PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating preview',
      error: error.message
    });
  }
};

/**
 * Get all completed (approved) documents (BAPB & BAPP)
 * @route GET /api/documents/completed
 * @access Private
 */
exports.getCompletedDocuments = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Fetch approved BAPB
    let bapbQuery = supabaseAdmin
      .from('bapb')
      .select(`
        *,
        vendor:users!bapb_vendor_id_fkey(id, name, email, company),
        items:bapb_items(*)
      `)
      .eq('status', 'approved')
      .order('updated_at', { ascending: false });

    // Filter by role
    if (userRole === 'vendor') {
      bapbQuery = bapbQuery.eq('vendor_id', userId);
    }

    const { data: bapbData, error: bapbError } = await bapbQuery;
    if (bapbError) throw bapbError;

    // Fetch approved BAPP
    let bappQuery = supabaseAdmin
      .from('bapp')
      .select(`
        *,
        vendor:users!bapp_vendor_id_fkey(id, name, email, company),
        work_items:bapp_work_items(*)
      `)
      .eq('status', 'approved')
      .order('updated_at', { ascending: false });

    if (userRole === 'vendor') {
      bappQuery = bappQuery.eq('vendor_id', userId);
    }

    const { data: bappData, error: bappError } = await bappQuery;
    if (bappError) throw bappError;

    // Map BAPB to unified format
    const bapbDocuments = (bapbData || []).map(doc => ({
      id: doc.id,
      type: 'BAPB',
      document_number: doc.bapb_number,
      status: doc.status,
      vendor: doc.vendor,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      approved_at: doc.updated_at, 
      completed_at: doc.updated_at,
      items: doc.items || []
    }));

    // Map BAPP to unified format
    const bappDocuments = (bappData || []).map(doc => ({
      id: doc.id,
      type: 'BAPP',
      document_number: doc.bapp_number,
      status: doc.status,
      vendor: doc.vendor,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      approved_at: doc.updated_at,
      completed_at: doc.updated_at,
      items: doc.work_items || []
    }));

    // Combine and sort by updated_at
    const allDocuments = [...bapbDocuments, ...bappDocuments].sort(
      (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
    );

    res.status(200).json({
      success: true,
      data: allDocuments,
      count: allDocuments.length
    });

  } catch (error) {
    console.error('Get completed documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching completed documents',
      error: error.message
    });
  }
};

/**
 * Download single completed document
 * @route GET /api/documents/:id/download
 * @access Private
 */
exports.downloadCompletedDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; 

    if (!type || !['BAPB', 'BAPP'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter type (BAPB or BAPP) is required'
      });
    }

    // Fetch document based on type
    let document, signatures;

    if (type === 'BAPB') {
      document = await BAPBRepository.findByIdWithRelations(id);
      
      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'BAPB not found'
        });
      }

      // Check authorization
      if (req.user.role === 'vendor' && document.vendor_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to download this document'
        });
      }

      // Get signatures
      signatures = { vendorSignature: null, picGudangSignature: null };
      
      if (document.attachments) {
        document.attachments.forEach(att => {
          if (att.file_type !== 'signature') return;
          const fullPath = path.join(__dirname, '../..', att.file_path);
          if (att.uploaded_by === document.vendor_id) signatures.vendorSignature = fullPath;
          else if (document.pic_gudang_id && att.uploaded_by === document.pic_gudang_id) signatures.picGudangSignature = fullPath;
        });
      }

      // Generate PDF
      const { filePath, fileName } = await pdfService.generateBAPBPDF(document, signatures);

      // Send file
      res.download(filePath, fileName, async (err) => {
        if (err) console.error('Error sending file:', err);
        try {
          await fs.unlink(filePath);
        } catch (unlinkErr) {
          console.error('Error deleting temp file:', unlinkErr);
        }
      });

    } else { 
      document = await BAPPRepository.findByIdWithRelations(id);
      
      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'BAPP not found'
        });
      }

      if (req.user.role === 'vendor' && document.vendor_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to download this document'
        });
      }

      signatures = { vendorSignature: null, approverSignature: null };
      
      if (document.attachments) {
        document.attachments.forEach(att => {
          if (att.file_type !== 'signature') return;
          const fullPath = path.join(__dirname, '../..', att.file_path);
          if (att.uploaded_by === document.vendor_id) signatures.vendorSignature = fullPath;
          else if (document.direksi_pekerjaan_id && att.uploaded_by === document.direksi_pekerjaan_id) signatures.approverSignature = fullPath;
        });
      }

      const { filePath, fileName } = await pdfService.generateBAPPPDF(document, signatures);

      res.download(filePath, fileName, async (err) => {
        if (err) console.error('Error sending file:', err);
        try {
          await fs.unlink(filePath);
        } catch (unlinkErr) {
          console.error('Error deleting temp file:', unlinkErr);
        }
      });
    }

  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading document',
      error: error.message
    });
  }
};

module.exports = exports;
