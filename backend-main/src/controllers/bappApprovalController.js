const BAPPRepository = require('../repositories/BAPPRepository');
const notificationService = require('../services/notificationService');

/**
 * Approve BAPP
 * @route POST /api/bapp/:id/approve
 * @access Private (Approver, Admin)
 */
exports.approveBAPP = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const approverId = req.user.id;

    const bapp = await BAPPRepository.findByIdWithRelations(id);

    if (!bapp) {
      return res.status(404).json({
        success: false,
        message: 'BAPP not found'
      });
    }

    // Check status
    if (!['submitted', 'in_review'].includes(bapp.status)) {
      return res.status(400).json({
        success: false,
        message: 'BAPP must be in submitted or in_review status to be approved'
      });
    }

    // Check authorization
    if (!['approver', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to approve BAPP'
      });
    }

    // Check if user already approved
    const hasApproved = await BAPPRepository.hasUserApproved(id, approverId);
    if (hasApproved) {
      return res.status(400).json({
        success: false,
        message: 'You have already approved this BAPP'
      });
    }

    // ✅ ADDED: Cek signature untuk BAPP
    const { supabaseAdmin } = require('../config/supabase');
    const { data: existingSignature } = await supabaseAdmin
      .from('bapp_attachments')
      .select('*')
      .eq('bapp_id', id)
      .eq('uploaded_by', approverId)
      .eq('file_type', 'signature')
      .single();

    if (!existingSignature) {
      return res.status(400).json({
        success: false,
        message: 'Please upload your signature first before approving. Use POST /api/bapp/:id/signature to upload.',
        hint: 'Signature must be uploaded separately before approval'
      });
    }

    // Create approval record
    await BAPPRepository.createApproval({
      bapp_id: id,
      approver_id: approverId,
      action: 'approved',
      notes
    });

    // Update BAPP status and assign Direksi if not assigned
    const updateData = { status: 'approved' };
    if (!bapp.direksi_pekerjaan_id && req.user.role === 'approver') {
      updateData.direksi_pekerjaan_id = approverId;
    }

    await BAPPRepository.update(id, updateData);

    // Send notification
    await notificationService.notifyBAPPApproved(bapp, req.user.name);

    // Fetch updated BAPP
    const updatedBAPP = await BAPPRepository.findByIdWithRelations(id);

    res.status(200).json({
      success: true,
      message: 'BAPP approved successfully',
      data: updatedBAPP
    });
  } catch (error) {
    console.error('Approve BAPP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving BAPP',
      error: error.message
    });
  }
};

/**
 * Reject BAPP
 * @route POST /api/bapp/:id/reject
 * @access Private (Approver, Admin)
 */
exports.rejectBAPP = async (req, res) => {
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

    const bapp = await BAPPRepository.findById(id);

    if (!bapp) {
      return res.status(404).json({
        success: false,
        message: 'BAPP not found'
      });
    }

    // Check status
    if (!['submitted', 'in_review'].includes(bapp.status)) {
      return res.status(400).json({
        success: false,
        message: 'BAPP must be in submitted or in_review status to be rejected'
      });
    }

    // Check authorization
    if (!['approver', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject BAPP'
      });
    }

    // Create rejection record
    await BAPPRepository.createApproval({
      bapp_id: id,
      approver_id: approverId,
      action: 'rejected',
      notes
    });

    // Update BAPP status
    await BAPPRepository.update(id, {
      status: 'rejected',
      rejection_reason: rejectionReason
    });

    // Send notification
    await notificationService.notifyBAPPRejected(bapp, rejectionReason);

    // Fetch updated BAPP
    const updatedBAPP = await BAPPRepository.findByIdWithRelations(id);

    res.status(200).json({
      success: true,
      message: 'BAPP rejected',
      data: updatedBAPP
    });
  } catch (error) {
    console.error('Reject BAPP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting BAPP',
      error: error.message
    });
  }
};

/**
 * Request revision for BAPP
 * @route POST /api/bapp/:id/revision
 * @access Private (Approver, Admin)
 */
exports.requestRevisionBAPP = async (req, res) => {
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

    const bapp = await BAPPRepository.findById(id);

    if (!bapp) {
      return res.status(404).json({
        success: false,
        message: 'BAPP not found'
      });
    }

    // Check status
    if (!['submitted', 'in_review'].includes(bapp.status)) {
      return res.status(400).json({
        success: false,
        message: 'BAPP must be in submitted or in_review status to request revision'
      });
    }

    // Check authorization
    if (!['approver', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to request revision'
      });
    }

    // Create revision request record
    await BAPPRepository.createApproval({
      bapp_id: id,
      approver_id: approverId,
      action: 'revision_required',
      notes
    });

    // Update BAPP status
    await BAPPRepository.update(id, {
      status: 'revision_required',
      rejection_reason: revisionReason
    });

    // Send notification
    await notificationService.notifyBAPPRevisionRequired(bapp, revisionReason);

    // Fetch updated BAPP
    const updatedBAPP = await BAPPRepository.findByIdWithRelations(id);

    res.status(200).json({
      success: true,
      message: 'Revision requested for BAPP',
      data: updatedBAPP
    });
  } catch (error) {
    console.error('Request revision BAPP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error requesting revision',
      error: error.message
    });
  }
};

/**
 * Get approval history for BAPP
 * @route GET /api/bapp/:id/approvals
 * @access Private
 */
exports.getBAPPApprovalHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const approvals = await BAPPRepository.getApprovalHistory(id);

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