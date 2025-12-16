const BAPBRepository = require('../repositories/BAPBRepository');
const notificationService = require('../services/notificationService');
const fs = require('fs');   
const path = require('path'); 

/**
 * Approve BAPB
 * @route POST /api/bapb/:id/approve
 * @access Private (PIC Gudang, Approver, Admin)
 */
exports.approveBAPB = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;  // Hanya ambil notes dari body
    const approverId = req.user.id;

    const bapb = await BAPBRepository.findByIdWithRelations(id);

    if (!bapb) {
      return res.status(404).json({
        success: false,
        message: 'BAPB not found'
      });
    }

    // Check status
    if (!['submitted', 'in_review'].includes(bapb.status)) {
      return res.status(400).json({
        success: false,
        message: 'BAPB must be in submitted or in_review status to be approved'
      });
    }

    // Check authorization
    if (!['pic_gudang', 'approver', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to approve BAPB'
      });
    }

    // Check if user already approved
    const hasApproved = await BAPBRepository.hasUserApproved(id, approverId);
    if (hasApproved) {
      return res.status(400).json({
        success: false,
        message: 'You have already approved this BAPB'
      });
    }

    // ✅ FIXED: Cek apakah user sudah upload signature
    const { supabaseAdmin } = require('../config/supabase');
    const { data: existingSignature, error: signatureError } = await supabaseAdmin
      .from('bapb_attachments')
      .select('*')
      .eq('bapb_id', id)
      .eq('uploaded_by', approverId)
      .eq('file_type', 'signature')
      .maybeSingle();
    
    console.log('🔍 Checking signature:', {
      bapb_id: id,
      uploaded_by: approverId,
      signatureFound: !!existingSignature,
      signatureError: signatureError
    });

    if (!existingSignature) {
      return res.status(400).json({
        success: false,
        message: 'Please upload your signature first before approving. Use POST /api/bapb/:id/signature to upload.',
        hint: 'Signature must be uploaded separately before approval',
        debug: {
          bapb_id: id,
          user_id: approverId,
          user_role: req.user.role
        }
      });
    }
    // Create approval record
    await BAPBRepository.createApproval({
      bapb_id: id,
      approver_id: approverId,
      action: 'approved',
      notes
    });

    // Update BAPB status and assign PIC if not assigned
    const updateData = { status: 'approved' };
    if (!bapb.pic_gudang_id && req.user.role === 'pic_gudang') {
      updateData.pic_gudang_id = approverId;
    }

    await BAPBRepository.update(id, updateData);

    // Send notification
    await notificationService.notifyBAPBApproved(bapb, req.user.name);

    // Fetch updated BAPB
    const updatedBAPB = await BAPBRepository.findByIdWithRelations(id);

    res.status(200).json({
      success: true,
      message: 'BAPB approved successfully',
      data: updatedBAPB
    });
  } catch (error) {
    console.error('Approve BAPB error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving BAPB',
      error: error.message
    });
  }
};

/**
 * Reject BAPB
 * @route POST /api/bapb/:id/reject
 * @access Private (PIC Gudang, Approver, Admin)
 */
exports.rejectBAPB = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, rejectionReason } = req.body;
    const approverId = req.user.id;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const bapb = await BAPBRepository.findById(id);

    if (!bapb) {
      return res.status(404).json({
        success: false,
        message: 'BAPB not found'
      });
    }

    // Check status
    if (!['submitted', 'in_review'].includes(bapb.status)) {
      return res.status(400).json({
        success: false,
        message: 'BAPB must be in submitted or in_review status to be rejected'
      });
    }

    // Check authorization
    if (!['pic_gudang', 'approver', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject BAPB'
      });
    }

    // Create rejection record
    await BAPBRepository.createApproval({
      bapb_id: id,
      approver_id: approverId,
      action: 'rejected',
      notes
    });

    // Update BAPB status
    await BAPBRepository.update(id, {
      status: 'rejected',
      rejection_reason: rejectionReason
    });

    // Send notification
    await notificationService.notifyBAPBRejected(bapb, rejectionReason);

    // Fetch updated BAPB
    const updatedBAPB = await BAPBRepository.findByIdWithRelations(id);

    res.status(200).json({
      success: true,
      message: 'BAPB rejected',
      data: updatedBAPB
    });
  } catch (error) {
    console.error('Reject BAPB error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting BAPB',
      error: error.message
    });
  }
};

/**
 * Request revision for BAPB
 * @route POST /api/bapb/:id/revision
 * @access Private (PIC Gudang, Approver, Admin)
 */
exports.requestRevisionBAPB = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, revisionReason } = req.body;
    const approverId = req.user.id;

    if (!revisionReason || revisionReason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Revision reason is required'
      });
    }

    const bapb = await BAPBRepository.findById(id);

    if (!bapb) {
      return res.status(404).json({
        success: false,
        message: 'BAPB not found'
      });
    }

    // Check status
    if (!['submitted', 'in_review'].includes(bapb.status)) {
      return res.status(400).json({
        success: false,
        message: 'BAPB must be in submitted or in_review status to request revision'
      });
    }

    // Check authorization
    if (!['pic_gudang', 'approver', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to request revision'
      });
    }

    // Create revision request record
    await BAPBRepository.createApproval({
      bapb_id: id,
      approver_id: approverId,
      action: 'revision_required',
      notes
    });

    // Update BAPB status
    await BAPBRepository.update(id, {
      status: 'revision_required',
      rejection_reason: revisionReason
    });

    // Send notification
    await notificationService.notifyBAPBRevisionRequired(bapb, revisionReason);

    // Fetch updated BAPB
    const updatedBAPB = await BAPBRepository.findByIdWithRelations(id);

    res.status(200).json({
      success: true,
      message: 'Revision requested for BAPB',
      data: updatedBAPB
    });
  } catch (error) {
    console.error('Request revision BAPB error:', error);
    res.status(500).json({
      success: false,
      message: 'Error requesting revision',
      error: error.message
    });
  }
};

/**
 * Get approval history for BAPB
 * @route GET /api/bapb/:id/approvals
 * @access Private
 */
exports.getBAPBApprovalHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const approvals = await BAPBRepository.getApprovalHistory(id);

    res.status(200).json({
      success: true,
      data: approvals
    });
  } catch (error) {
    console.error('Get approval history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching approval history',
      error: error.message
    });
  }
};
