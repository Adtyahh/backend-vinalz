const { supabaseAdmin } = require('../config/supabase');
const BAPBRepository = require('../repositories/BAPBRepository');
const BAPPRepository = require('../repositories/BAPPRepository');
const fs = require('fs').promises;
const path = require('path');

// Ensure upload directory exists
const ensureUploadDir = async () => {
  const uploadDir = path.join(__dirname, '../../uploads/signatures');
  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
  }
  return uploadDir;
};

// ========== BAPB SIGNATURES ==========

exports.uploadBAPBSignature = async (req, res) => {
  try {
    const { id } = req.params;
    const { signatureData } = req.body;
    const userId = req.user.id;

    if (!signatureData) {
      return res.status(400).json({
        success: false,
        message: 'Signature data is required'
      });
    }

    const base64Regex = /^data:image\/(png|jpeg|jpg);base64,/;
    if (!base64Regex.test(signatureData)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid signature format. Must be base64 image data'
      });
    }

    const bapb = await BAPBRepository.findById(id);

    if (!bapb) {
      return res.status(404).json({
        success: false,
        message: 'BAPB not found'
      });
    }

    // Check authorization - vendor_barang instead of vendor
    const canSign = 
      (req.user.role === 'vendor_barang' && bapb.vendor_id === userId) ||
      (req.user.role === 'pic_gudang' && (bapb.pic_gudang_id === userId || bapb.pic_gudang_id === null)) ||
      ['approver', 'admin'].includes(req.user.role);

    if (!canSign) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to sign this BAPB'
      });
    }

    const uploadDir = await ensureUploadDir();

    const base64Data = signatureData.replace(base64Regex, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const filename = `bapb_${id}_${userId}_${Date.now()}.png`;
    const filePath = path.join(uploadDir, filename);

    await fs.writeFile(filePath, imageBuffer);

    // Create attachment record
    const { data: attachment, error } = await supabaseAdmin
      .from('bapb_attachments')
      .insert({
        bapb_id: id,
        file_type: 'signature',
        file_path: `/uploads/signatures/${filename}`,
        file_name: filename,
        uploaded_by: userId
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Signature uploaded successfully',
      data: {
        id: attachment.id,
        filePath: attachment.file_path,
        fileName: attachment.file_name,
        uploadedBy: userId,
        uploadedAt: attachment.created_at
      }
    });
  } catch (error) {
    console.error('Upload BAPB signature error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading signature',
      error: error.message
    });
  }
};

exports.getBAPBSignatures = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: signatures, error } = await supabaseAdmin
      .from('bapb_attachments')
      .select(`
        *,
        uploader:users!bapb_attachments_uploaded_by_fkey(id, name, email, role)
      `)
      .eq('bapb_id', id)
      .eq('file_type', 'signature')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: signatures
    });
  } catch (error) {
    console.error('Get BAPB signatures error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching signatures',
      error: error.message
    });
  }
};

// ========== BAPP SIGNATURES ==========

exports.uploadBAPPSignature = async (req, res) => {
  try {
    const { id } = req.params;
    const { signatureData } = req.body;
    const userId = req.user.id;

    if (!signatureData) {
      return res.status(400).json({
        success: false,
        message: 'Signature data is required'
      });
    }

    const base64Regex = /^data:image\/(png|jpeg|jpg);base64,/;
    if (!base64Regex.test(signatureData)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid signature format. Must be base64 image data'
      });
    }

    const bapp = await BAPPRepository.findById(id);

    if (!bapp) {
      return res.status(404).json({
        success: false,
        message: 'BAPP not found'
      });
    }

    // Check authorization - vendor_jasa instead of vendor
    const canSign = 
      (req.user.role === 'vendor_jasa' && bapp.vendor_id === userId) ||
      (req.user.role === 'approver' && (bapp.direksi_pekerjaan_id === userId || bapp.direksi_pekerjaan_id === null)) ||
      ['approver', 'admin'].includes(req.user.role);

    if (!canSign) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to sign this BAPP'
      });
    }

    const uploadDir = await ensureUploadDir();

    const base64Data = signatureData.replace(base64Regex, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const filename = `bapp_${id}_${userId}_${Date.now()}.png`;
    const filePath = path.join(uploadDir, filename);

    await fs.writeFile(filePath, imageBuffer);

    const { data: attachment, error } = await supabaseAdmin
      .from('bapp_attachments')
      .insert({
        bapp_id: id,
        file_type: 'signature',
        file_path: `/uploads/signatures/${filename}`,
        file_name: filename,
        uploaded_by: userId
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Signature uploaded successfully',
      data: {
        id: attachment.id,
        filePath: attachment.file_path,
        fileName: attachment.file_name,
        uploadedBy: userId,
        uploadedAt: attachment.created_at
      }
    });
  } catch (error) {
    console.error('Upload BAPP signature error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading signature',
      error: error.message
    });
  }
};

exports.getBAPPSignatures = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: signatures, error } = await supabaseAdmin
      .from('bapp_attachments')
      .select(`
        *,
        uploader:users!bapp_attachments_uploaded_by_fkey(id, name, email, role)
      `)
      .eq('bapp_id', id)
      .eq('file_type', 'signature')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: signatures
    });
  } catch (error) {
    console.error('Get BAPP signatures error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching signatures',
      error: error.message
    });
  }
};

// ========== DELETE SIGNATURE ==========

exports.deleteSignature = async (req, res) => {
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
      .eq('file_type', 'signature')
      .single();

    if (fetchError || !attachment) {
      return res.status(404).json({
        success: false,
        message: 'Signature not found'
      });
    }

    // Check authorization
    if (attachment.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this signature'
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
      message: 'Signature deleted successfully'
    });
  } catch (error) {
    console.error('Delete signature error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting signature',
      error: error.message
    });
  }
};

module.exports = exports;