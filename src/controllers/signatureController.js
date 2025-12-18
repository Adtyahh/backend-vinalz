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

    console.log('📝 Upload BAPB signature request:', {
      bapb_id: id,
      user_id: userId,
      user_role: req.user.role
    });

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

    console.log('📋 BAPB info:', {
      id: bapb.id,
      vendor_id: bapb.vendor_id,
      pic_gudang_id: bapb.pic_gudang_id,
      status: bapb.status
    });

    // ✅ FIXED: Simplified authorization - allow pic_gudang and approver to sign anytime
    const canSign = 
      (req.user.role === 'vendor_barang' && bapb.vendor_id === userId) ||
      ['pic_gudang', 'approver', 'admin'].includes(req.user.role);

    if (!canSign) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to sign this BAPB',
        debug: {
          userRole: req.user.role,
          userId: userId,
          bapbVendorId: bapb.vendor_id,
          bapbPicGudangId: bapb.pic_gudang_id
        }
      });
    }

    const uploadDir = await ensureUploadDir();

    const base64Data = signatureData.replace(base64Regex, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const filename = `bapb_${id}_${userId}_${Date.now()}.png`;
    const filePath = path.join(uploadDir, filename);

    await fs.writeFile(filePath, imageBuffer);

    console.log('💾 Signature file saved:', filePath);

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

    if (error) {
      console.error('❌ Error saving to database:', error);
      throw error;
    }

    console.log('✅ Signature saved to database:', attachment.id);

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
    console.error('❌ Upload BAPB signature error:', error);
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

// Helper endpoint untuk debug
exports.checkSignatureStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; 
    const userId = req.user.id;

    const tableName = type === 'bapp' ? 'bapp_attachments' : 'bapb_attachments';
    const foreignKey = type === 'bapp' ? 'bapp_id' : 'bapb_id';

    const { supabaseAdmin } = require('../config/supabase');

    // Get all signatures for this document
    const { data: allSignatures, error } = await supabaseAdmin
      .from(tableName)
      .select('*, uploader:users!uploaded_by(id, name, email, role)')
      .eq(foreignKey, id)
      .eq('file_type', 'signature');

    if (error) throw error;

    // Check if current user has signature
    const userSignature = allSignatures?.find(sig => sig.uploaded_by === userId);

    res.status(200).json({
      success: true,
      data: {
        currentUserId: userId,
        currentUserRole: req.user.role,
        hasSignature: !!userSignature,
        userSignature: userSignature || null,
        allSignatures: allSignatures || [],
        totalSignatures: allSignatures?.length || 0
      }
    });
  } catch (error) {
    console.error('Check signature status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking signature status',
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

    console.log('📝 Upload BAPP signature request:', {
      bapp_id: id,
      user_id: userId,
      user_role: req.user.role
    });

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

    console.log('📋 BAPP info:', {
      id: bapp.id,
      vendor_id: bapp.vendor_id,
      direksi_pekerjaan_id: bapp.direksi_pekerjaan_id,
      status: bapp.status
    });

    // ✅ FIXED: Simplified authorization - allow approver to sign anytime
    const canSign = 
      (req.user.role === 'vendor_jasa' && bapp.vendor_id === userId) ||
      ['approver', 'admin'].includes(req.user.role);

    if (!canSign) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to sign this BAPP',
        debug: {
          userRole: req.user.role,
          userId: userId,
          bappVendorId: bapp.vendor_id
        }
      });
    }

    const uploadDir = await ensureUploadDir();

    const base64Data = signatureData.replace(base64Regex, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const filename = `bapp_${id}_${userId}_${Date.now()}.png`;
    const filePath = path.join(uploadDir, filename);

    await fs.writeFile(filePath, imageBuffer);

    console.log('💾 Signature file saved:', filePath);

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

    if (error) {
      console.error('❌ Error saving to database:', error);
      throw error;
    }

    console.log('✅ Signature saved to database:', attachment.id);

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
    console.error('❌ Upload BAPP signature error:', error);
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
    const { type } = req.query; 

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
      console.log('✅ Signature file deleted:', fullPath);
    } catch (err) {
      console.error('⚠️ Error deleting file:', err);
    }

    // Delete database record
    const { error: deleteError } = await supabaseAdmin
      .from(tableName)
      .delete()
      .eq('id', attachmentId);

    if (deleteError) throw deleteError;

    console.log('✅ Signature record deleted from DB');

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