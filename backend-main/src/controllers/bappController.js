const BAPPRepository = require('../repositories/BAPPRepository');
const notificationService = require('../services/notificationService');

/**
 * Helper function to check if user can manage BAPP
 * @param {string} userRole - User's role
 * @returns {boolean}
 */
const canManageBAPP = (userRole) => {
  return ['vendor_jasa', 'vendor', 'admin'].includes(userRole);
};

/**
 * Helper function to check if user is BAPP vendor type
 * @param {string} userRole
 * @returns {boolean}
 */
const isVendorJasa = (userRole) => {
  return ['vendor_jasa', 'vendor'].includes(userRole);
};

/**
 * Create BAPP - FIXED VERSION
 * @route POST /api/bapp
 * @access Private (Vendor Jasa)
 */
exports.createBAPP = async (req, res) => {
  try {
    const { 
      contractNumber, 
      projectName, 
      projectLocation, 
      startDate, 
      endDate, 
      completionDate, 
      workItems, 
      notes 
    } = req.body;
    
    const vendorId = req.user.id;

    console.log('📥 Received BAPP creation request:', {
      contractNumber,
      projectName,
      projectLocation,
      startDate,
      endDate,
      workItemsCount: workItems ? workItems.length : 0,
      notes
    });

    // Validate vendor type
    if (!canManageBAPP(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only vendor jasa can create BAPP',
        error: `Your role (${req.user.role}) is not authorized to create BAPP. Please contact administrator if you need access.`
      });
    }

    // Validation
    if (!contractNumber || !projectName || !projectLocation || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Contract number, project name, location, start date, and end date are required'
      });
    }

    // FIXED: Validate work items array
    if (!workItems || !Array.isArray(workItems) || workItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one work item is required. Please provide workItems array.'
      });
    }

    // FIXED: Validate each work item
    for (let i = 0; i < workItems.length; i++) {
      const item = workItems[i];
      
      if (!item.workItemName) {
        return res.status(400).json({
          success: false,
          message: `Work item ${i + 1}: workItemName is required`
        });
      }
      
      if (item.plannedProgress === undefined || item.plannedProgress === null) {
        return res.status(400).json({
          success: false,
          message: `Work item ${i + 1}: plannedProgress is required`
        });
      }
      
      if (item.actualProgress === undefined || item.actualProgress === null) {
        return res.status(400).json({
          success: false,
          message: `Work item ${i + 1}: actualProgress is required`
        });
      }
      
      if (!item.unit) {
        return res.status(400).json({
          success: false,
          message: `Work item ${i + 1}: unit is required`
        });
      }
    }

    // Generate BAPP number
    const bappNumber = await BAPPRepository.generateBAPPNumber();
    console.log('🔢 Generated BAPP number:', bappNumber);

    // Prepare BAPP data
    const bappData = {
      bapp_number: bappNumber,
      vendor_id: vendorId,
      contract_number: contractNumber,
      project_name: projectName,
      project_location: projectLocation,
      start_date: startDate,
      end_date: endDate,
      completion_date: completionDate,
      notes,
      status: 'draft'
    };

    console.log('💾 Creating BAPP with data:', bappData);
    console.log('📦 Work items:', workItems);

    // Create BAPP with work items
    const bapp = await BAPPRepository.createWithWorkItems(bappData, workItems);

    console.log('✅ BAPP created successfully:', bapp.id);

    // Verify work items were created
    if (!bapp.work_items || bapp.work_items.length === 0) {
      console.error('⚠️ WARNING: BAPP created but no work items found!');
      return res.status(500).json({
        success: false,
        message: 'BAPP created but work items were not saved properly. Please try again.',
        debug: {
          bappId: bapp.id,
          workItemsReceived: workItems.length,
          workItemsSaved: 0
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'BAPP created successfully',
      data: bapp
    });
  } catch (error) {
    console.error('❌ Create BAPP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating BAPP',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Get all BAPPs
 * @route GET /api/bapp
 * @access Private
 */
exports.getAllBAPP = async (req, res) => {
  try {
    const { status, vendorId, page = 1, limit = 10, projectName } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (vendorId) filters.vendor_id = vendorId;
    if (projectName) filters.project_name = projectName;

    // Check for vendor_jasa or legacy vendor
    if (isVendorJasa(req.user.role)) {
      filters.vendor_id = req.user.id;
    }

    const pagination = {
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    };

    const result = await BAPPRepository.findAllWithRelations(filters, pagination);

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: {
        total: result.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.count / limit)
      }
    });
  } catch (error) {
    console.error('Get all BAPP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching BAPPs',
      error: error.message
    });
  }
};

/**
 * Get single BAPP
 * @route GET /api/bapp/:id
 * @access Private
 */
exports.getBAPPById = async (req, res) => {
  try {
    const { id } = req.params;

    const bapp = await BAPPRepository.findByIdWithRelations(id);

    if (!bapp) {
      return res.status(404).json({
        success: false,
        message: 'BAPP not found'
      });
    }

    // Check authorization with vendor_jasa
    if (isVendorJasa(req.user.role) && bapp.vendor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this BAPP'
      });
    }

    res.status(200).json({
      success: true,
      data: bapp
    });
  } catch (error) {
    console.error('Get BAPP by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching BAPP',
      error: error.message
    });
  }
};

/**
 * Update BAPP
 * @route PUT /api/bapp/:id
 * @access Private (Vendor Jasa)
 */
exports.updateBAPP = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      contractNumber, 
      projectName, 
      projectLocation, 
      startDate, 
      endDate, 
      completionDate, 
      notes, 
      workItems 
    } = req.body;

    const bapp = await BAPPRepository.findById(id);

    if (!bapp) {
      return res.status(404).json({
        success: false,
        message: 'BAPP not found'
      });
    }

    // Check authorization with vendor type validation
    if (isVendorJasa(req.user.role) && bapp.vendor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this BAPP'
      });
    }

    // Additional validation for vendor type
    if (!canManageBAPP(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only vendor jasa can update BAPP'
      });
    }

    // Check status
    if (!['draft', 'revision_required'].includes(bapp.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update BAPP that is not in draft or revision status'
      });
    }

    // Prepare update data
    const updateData = {};
    if (contractNumber) updateData.contract_number = contractNumber;
    if (projectName) updateData.project_name = projectName;
    if (projectLocation) updateData.project_location = projectLocation;
    if (startDate) updateData.start_date = startDate;
    if (endDate) updateData.end_date = endDate;
    if (completionDate !== undefined) updateData.completion_date = completionDate;
    if (notes !== undefined) updateData.notes = notes;

    // If was in revision, change to draft
    if (bapp.status === 'revision_required') {
      updateData.status = 'draft';
      updateData.rejection_reason = null;
    }

    // Update BAPP with work items
    const updatedBAPP = await BAPPRepository.updateWithWorkItems(id, updateData, workItems);

    res.status(200).json({
      success: true,
      message: 'BAPP updated successfully',
      data: updatedBAPP
    });
  } catch (error) {
    console.error('Update BAPP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating BAPP',
      error: error.message
    });
  }
};

/**
 * Delete BAPP
 * @route DELETE /api/bapp/:id
 * @access Private (Vendor Jasa)
 */
exports.deleteBAPP = async (req, res) => {
  try {
    const { id } = req.params;

    const bapp = await BAPPRepository.findById(id);

    if (!bapp) {
      return res.status(404).json({
        success: false,
        message: 'BAPP not found'
      });
    }

    // Check authorization with vendor type validation
    if (isVendorJasa(req.user.role) && bapp.vendor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this BAPP'
      });
    }

    // Additional validation for vendor type
    if (!canManageBAPP(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only vendor jasa can delete BAPP'
      });
    }

    // Check status
    if (bapp.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only delete BAPP in draft status'
      });
    }

    await BAPPRepository.delete(id);

    res.status(200).json({
      success: true,
      message: 'BAPP deleted successfully'
    });
  } catch (error) {
    console.error('Delete BAPP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting BAPP',
      error: error.message
    });
  }
};

/**
 * Submit BAPP for review - FIXED VERSION
 * @route POST /api/bapp/:id/submit
 * @access Private (Vendor Jasa)
 */
exports.submitBAPP = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('📤 Submitting BAPP:', id);

    const bapp = await BAPPRepository.findByIdWithRelations(id);

    if (!bapp) {
      return res.status(404).json({
        success: false,
        message: 'BAPP not found'
      });
    }

    console.log('📋 BAPP data:', {
      id: bapp.id,
      status: bapp.status,
      vendor_id: bapp.vendor_id,
      workItemsCount: bapp.work_items ? bapp.work_items.length : 0
    });

    // Check authorization - must be the vendor owner
    if (bapp.vendor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit this BAPP'
      });
    }

    // Additional validation for vendor type
    if (!canManageBAPP(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only vendor jasa can submit BAPP'
      });
    }

    // Check status
    if (!['draft', 'revision_required'].includes(bapp.status)) {
      return res.status(400).json({
        success: false,
        message: 'Can only submit BAPP in draft or revision status'
      });
    }

    // FIXED: Validate has work items
    if (!bapp.work_items || bapp.work_items.length === 0) {
      console.error('⚠️ BAPP has no work items!');
      return res.status(400).json({
        success: false,
        message: 'BAPP must have at least one work item. Please add work items before submitting.',
        debug: {
          bappId: bapp.id,
          workItemsFound: bapp.work_items ? bapp.work_items.length : 0
        }
      });
    }

    console.log('✅ Validation passed, updating status to submitted');

    // Update status
    await BAPPRepository.updateStatus(id, 'submitted');

    // Send notification
    await notificationService.notifyBAPPSubmitted(bapp);

    // Fetch updated BAPP
    const updatedBAPP = await BAPPRepository.findByIdWithRelations(id);

    res.status(200).json({
      success: true,
      message: 'BAPP submitted successfully',
      data: updatedBAPP
    });
  } catch (error) {
    console.error('❌ Submit BAPP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting BAPP',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Get BAPP statistics by vendor type
 * @route GET /api/bapp/statistics/by-vendor-type
 * @access Private (Admin)
 */
exports.getBAPPStatisticsByVendorType = async (req, res) => {
  try {
    // Only admin can access this
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const statistics = await BAPPRepository.getStatisticsByVendorType();

    res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Get BAPP statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};

/**
 * Validate if user can create BAPP (utility endpoint)
 * @route GET /api/bapp/validate-access
 * @access Private
 */
exports.validateBAPPAccess = async (req, res) => {
  try {
    const hasAccess = canManageBAPP(req.user.role);

    res.status(200).json({
      success: true,
      data: {
        hasAccess,
        userRole: req.user.role,
        allowedRoles: ['vendor_jasa', 'vendor', 'admin'],
        message: hasAccess 
          ? 'User can manage BAPP' 
          : 'User cannot manage BAPP. Only vendor_jasa can create/manage BAPP.'
      }
    });
  } catch (error) {
    console.error('Validate BAPP access error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating access',
      error: error.message
    });
  }
};