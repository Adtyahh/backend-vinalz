// src/controllers/attachmentController.js
const { supabaseAdmin } = require('../config/supabase');
const BAPBRepository = require('../repositories/BAPBRepository');
const BAPPRepository = require('../repositories/BAPPRepository');
const fs = require('fs').promises;
const path = require('path');

// Ensure upload directory exists
const ensureUploadDir = async (subdir = 'documents') => {
  const uploadDir = path.join(__dirname, `../../uploads/${subdir}`);
  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
  }
  return uploadDir;
};

// ========== BAPB ATTACHMENTS ==========

exports.uploadBAPBDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileData, fileName, fileType = 'supporting_doc' } = req.body;

    if (!fileData || !fileName) {
      return res.status(400).json({
        success: false,
        message: 'File data and file name are required'
      });
    }

    const bapb = await BAPBRepository.findById(id);

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
        message: 'Not authorized to upload documents for this BAPB'
      });
    }

    const uploadDir = await ensureUploadDir('documents');

    // Handle base64 file data
    let base64Data = fileData;
    const base64Regex = /^data:([A-Za-z-+\/]+);base64,/;
    if (base64Regex.test(fileData)) {
      base64Data = fileData.replace(base64Regex, '');
    }

    const fileBuffer = Buffer.from(base64Data, 'base64');

    // Generate unique filename
    const ext = path.extname(fileName);
    const basename = path.basename(fileName, ext);
    const uniqueFileName = `${basename}_${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, uniqueFileName);

    // Save file
    await fs.writeFile(filePath, fileBuffer);

    // Create attachment record
    const { data: attachment, error } = await supabaseAdmin
      .from('bapb_attachments')
      .insert({
        bapb_id: id,
        file_type: fileType,
        file_path: `/uploads/documents/${uniqueFileName}`,
        file_name: uniqueFileName,
        uploaded_by: req.user.id
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        id: attachment.id,
        filePath: attachment.file_path,
        fileName: attachment.file_name,
        fileType: attachment.file_type,
        uploadedBy: req.user.id,
        uploadedAt: attachment.created_at
      }
    });
  } catch (error) {
    console.error('Upload BAPB document error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading document',
      error: error.message
    });
  }
};

exports.getBAPBAttachments = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileType } = req.query;

    let query = supabaseAdmin
      .from('bapb_attachments')
      .select(`
        *,
        uploader:users!bapb_attachments_uploaded_by_fkey(id, name, email, role)
      `)
      .eq('bapb_id', id);

    if (fileType) {
      query = query.eq('file_type', fileType);
    }

    query = query.order('created_at', { ascending: false });

    const { data: attachments, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: attachments
    });
  } catch (error) {
    console.error('Get BAPB attachments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching attachments',
      error: error.message
    });
  }
};

// ========== BAPP ATTACHMENTS ==========

exports.uploadBAPPDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileData, fileName, fileType = 'supporting_doc' } = req.body;

    if (!fileData || !fileName) {
      return res.status(400).json({
        success: false,
        message: 'File data and file name are required'
      });
    }

    const bapp = await BAPPRepository.findById(id);

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
        message: 'Not authorized to upload documents for this BAPP'
      });
    }

    const uploadDir = await ensureUploadDir('documents');

    let base64Data = fileData;
    const base64Regex = /^data:([A-Za-z-+\/]+);base64,/;
    if (base64Regex.test(fileData)) {
      base64Data = fileData.replace(base64Regex, '');
    }

    const fileBuffer = Buffer.from(base64Data, 'base64');

    const ext = path.extname(fileName);
    const basename = path.basename(fileName, ext);
    const uniqueFileName = `${basename}_${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, uniqueFileName);

    await fs.writeFile(filePath, fileBuffer);

    const { data: attachment, error } = await supabaseAdmin
      .from('bapp_attachments')
      .insert({
        bapp_id: id,
        file_type: fileType,
        file_path: `/uploads/documents/${uniqueFileName}`,
        file_name: uniqueFileName,
        uploaded_by: req.user.id
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        id: attachment.id,
        filePath: attachment.file_path,
        fileName: attachment.file_name,
        fileType: attachment.file_type,
        uploadedBy: req.user.id,
        uploadedAt: attachment.created_at
      }
    });
  } catch (error) {
    console.error('Upload BAPP document error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading document',
      error: error.message
    });
  }
};

exports.getBAPPAttachments = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileType } = req.query;

    let query = supabaseAdmin
      .from('bapp_attachments')
      .select(`
        *,
        uploader:users!bapp_attachments_uploaded_by_fkey(id, name, email, role)
      `)
      .eq('bapp_id', id);

    if (fileType) {
      query = query.eq('file_type', fileType);
    }

    query = query.order('created_at', { ascending: false });

    const { data: attachments, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: attachments
    });
  } catch (error) {
    console.error('Get BAPP attachments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching attachments',
      error: error.message
    });
  }
};

// ========== DELETE ATTACHMENT ==========

exports.deleteAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    const { type } = req.query; // 'bapb' or 'bapp'

    const tableName = type === 'bapb' ? 'bapb_attachments' : 'bapp_attachments';
    const foreignKey = type === 'bapb' ? 'bapb_id' : 'bapp_id';

    const { data: attachment, error: fetchError } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .eq('id', attachmentId)
      .eq(foreignKey, id)
      .single();

    if (fetchError || !attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }

    // Check authorization
    if (attachment.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this attachment'
      });
    }

    // Delete file from filesystem
    const fullPath = path.join(__dirname, '../..', attachment.file_path);
    try {
      await fs.unlink(fullPath);
    } catch (err) {
      console.error('Error deleting file:', err);
    }

    // Delete database record
    const { error: deleteError } = await supabaseAdmin
      .from(tableName)
      .delete()
      .eq('id', attachmentId);

    if (deleteError) throw deleteError;

    res.status(200).json({
      success: true,
      message: 'Attachment deleted successfully'
    });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting attachment',
      error: error.message
    });
  }
};

// ========== DOWNLOAD ATTACHMENT ==========

exports.downloadAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    const { type } = req.query;

    const tableName = type === 'bapb' ? 'bapb_attachments' : 'bapp_attachments';
    const foreignKey = type === 'bapb' ? 'bapb_id' : 'bapp_id';

    const { data: attachment, error } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .eq('id', attachmentId)
      .eq(foreignKey, id)
      .single();

    if (error || !attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }

    const fullPath = path.join(__dirname, '../..', attachment.file_path);

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Send file
    res.download(fullPath, attachment.file_name);
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading attachment',
      error: error.message
    });
  }
};

module.exports = exports;