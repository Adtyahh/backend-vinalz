const BAPBRepository = require('../repositories/BAPBRepository');
const notificationService = require('../services/notificationService');

/**
 * Helper function to check if user can manage BAPB
 * @param {string} userRole - User's role
 * @returns {boolean}
 */
const canManageBAPB = (userRole) => {
  return ['vendor_barang', 'vendor', 'admin'].includes(userRole);
};

/**
 * Helper function to check if user is BAPB vendor type
 * @param {string} userRole
 * @returns {boolean}
 */
const isVendorBarang = (userRole) => {
  return ['vendor_barang', 'vendor'].includes(userRole);
};

/**
 * Create BAPB - FIXED VERSION WITH VENDOR TYPE CHECK
 * @route POST /api/bapb
 * @access Private (Vendor Barang)
 */
exports.createBAPB = async (req, res) => {
  try {
    const { orderNumber, deliveryDate, items, notes } = req.body;
    const vendorId = req.user.id;

    console.log('📥 Received BAPB creation request:', {
      orderNumber,
      deliveryDate,
      itemsCount: items ? items.length : 0,
      notes,
      userRole: req.user.role
    });

    // FIXED: Validation - only vendor_barang can create BAPB
    if (!canManageBAPB(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only vendor barang can create BAPB',
        error: `Your role (${req.user.role}) is not authorized to create BAPB. Only vendor_barang can create BAPB for goods delivery.`
      });
    }

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required. Please provide items array.'
      });
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (!item.itemName) {
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1}: itemName is required`
        });
      }
      
      if (item.quantityOrdered === undefined || item.quantityOrdered === null) {
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1}: quantityOrdered is required`
        });
      }
      
      if (item.quantityReceived === undefined || item.quantityReceived === null) {
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1}: quantityReceived is required`
        });
      }
      
      if (!item.unit) {
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1}: unit is required`
        });
      }
    }

    // Generate BAPB number
    const bapbNumber = await BAPBRepository.generateBAPBNumber();
    console.log('🔢 Generated BAPB number:', bapbNumber);

    // Prepare BAPB data
    const bapbData = {
      bapb_number: bapbNumber,
      vendor_id: vendorId,
      order_number: orderNumber,
      delivery_date: deliveryDate,
      notes,
      status: 'draft'
    };

    console.log('💾 Creating BAPB with data:', bapbData);
    console.log('📦 Items:', items);

    // Create BAPB with items
    const bapb = await BAPBRepository.createWithItems(bapbData, items);

    console.log('✅ BAPB created successfully:', bapb.id);

    // Verify items were created
    if (!bapb.items || bapb.items.length === 0) {
      console.error('⚠️ WARNING: BAPB created but no items found!');
      return res.status(500).json({
        success: false,
        message: 'BAPB created but items were not saved properly. Please try again.',
        debug: {
          bapbId: bapb.id,
          itemsReceived: items.length,
          itemsSaved: 0
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'BAPB created successfully',
      data: bapb
    });
  } catch (error) {
    console.error('❌ Create BAPB error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating BAPB',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Get all BAPBs
 * @route GET /api/bapb
 * @access Private
 */
exports.getAllBAPB = async (req, res) => {
  try {
    const { status, vendorId, page = 1, limit = 10 } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (vendorId) filters.vendor_id = vendorId;

    // If user is vendor barang, only show their BAPBs
    if (isVendorBarang(req.user.role)) {
      filters.vendor_id = req.user.id;
    }

    const pagination = {
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    };

    const result = await BAPBRepository.findAllWithRelations(filters, pagination);

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
    console.error('Get all BAPB error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching BAPBs',
      error: error.message
    });
  }
};

/**
 * Get single BAPB
 * @route GET /api/bapb/:id
 * @access Private
 */
exports.getBAPBById = async (req, res) => {
  try {
    const { id } = req.params;

    const bapb = await BAPBRepository.findByIdWithRelations(id);

    if (!bapb) {
      return res.status(404).json({
        success: false,
        message: 'BAPB not found'
      });
    }

    // Check authorization with vendor type
    if (isVendorBarang(req.user.role) && bapb.vendor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this BAPB'
      });
    }

    res.status(200).json({
      success: true,
      data: bapb
    });
  } catch (error) {
    console.error('Get BAPB by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching BAPB',
      error: error.message
    });
  }
};

/**
 * Update BAPB
 * @route PUT /api/bapb/:id
 * @access Private (Vendor Barang)
 */
exports.updateBAPB = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderNumber, deliveryDate, notes, items } = req.body;

    const bapb = await BAPBRepository.findById(id);

    if (!bapb) {
      return res.status(404).json({
        success: false,
        message: 'BAPB not found'
      });
    }

    // Check authorization with vendor type
    if (isVendorBarang(req.user.role) && bapb.vendor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this BAPB'
      });
    }

    // Additional validation for vendor type
    if (!canManageBAPB(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only vendor barang can update BAPB'
      });
    }

    // Check status
    if (!['draft', 'revision_required'].includes(bapb.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update BAPB that is not in draft or revision status'
      });
    }

    // Prepare update data
    const updateData = {};
    if (orderNumber) updateData.order_number = orderNumber;
    if (deliveryDate) updateData.delivery_date = deliveryDate;
    if (notes !== undefined) updateData.notes = notes;

    // If was in revision, change to draft
    if (bapb.status === 'revision_required') {
      updateData.status = 'draft';
      updateData.rejection_reason = null;
    }

    // Update BAPB with items
    const updatedBAPB = await BAPBRepository.updateWithItems(id, updateData, items);

    res.status(200).json({
      success: true,
      message: 'BAPB updated successfully',
      data: updatedBAPB
    });
  } catch (error) {
    console.error('Update BAPB error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating BAPB',
      error: error.message
    });
  }
};

/**
 * Delete BAPB
 * @route DELETE /api/bapb/:id
 * @access Private (Vendor Barang)
 */
exports.deleteBAPB = async (req, res) => {
  try {
    const { id } = req.params;

    const bapb = await BAPBRepository.findById(id);

    if (!bapb) {
      return res.status(404).json({
        success: false,
        message: 'BAPB not found'
      });
    }

    // Check authorization with vendor type
    if (isVendorBarang(req.user.role) && bapb.vendor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this BAPB'
      });
    }

    // Additional validation for vendor type
    if (!canManageBAPB(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only vendor barang can delete BAPB'
      });
    }

    // Check status
    if (bapb.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only delete BAPB in draft status'
      });
    }

    await BAPBRepository.delete(id);

    res.status(200).json({
      success: true,
      message: 'BAPB deleted successfully'
    });
  } catch (error) {
    console.error('Delete BAPB error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting BAPB',
      error: error.message
    });
  }
};

/**
 * Submit BAPB for review
 * @route POST /api/bapb/:id/submit
 * @access Private (Vendor Barang)
 */
exports.submitBAPB = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('📤 Submitting BAPB:', id);

    const bapb = await BAPBRepository.findByIdWithRelations(id);

    if (!bapb) {
      return res.status(404).json({
        success: false,
        message: 'BAPB not found'
      });
    }

    console.log('📋 BAPB data:', {
      id: bapb.id,
      status: bapb.status,
      vendor_id: bapb.vendor_id,
      itemsCount: bapb.items ? bapb.items.length : 0
    });

    // Check authorization
    if (bapb.vendor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit this BAPB'
      });
    }

    // Additional validation for vendor type
    if (!canManageBAPB(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only vendor barang can submit BAPB'
      });
    }

    // Check status
    if (!['draft', 'revision_required'].includes(bapb.status)) {
      return res.status(400).json({
        success: false,
        message: 'Can only submit BAPB in draft or revision status'
      });
    }

    // Validate has items
    if (!bapb.items || bapb.items.length === 0) {
      console.error('⚠️ BAPB has no items!');
      return res.status(400).json({
        success: false,
        message: 'BAPB must have at least one item. Please add items before submitting.',
        debug: {
          bapbId: bapb.id,
          itemsFound: bapb.items ? bapb.items.length : 0
        }
      });
    }

    console.log('✅ Validation passed, updating status to submitted');

    // Update status
    await BAPBRepository.updateStatus(id, 'submitted');

    // Send notification
    await notificationService.notifyBAPBSubmitted(bapb);

    // Fetch updated BAPB
    const updatedBAPB = await BAPBRepository.findByIdWithRelations(id);

    res.status(200).json({
      success: true,
      message: 'BAPB submitted successfully',
      data: updatedBAPB
    });
  } catch (error) {
    console.error('❌ Submit BAPB error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting BAPB',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Get BAPB statistics by vendor type
 * @route GET /api/bapb/statistics/by-vendor-type
 * @access Private (Admin)
 */
exports.getBAPBStatisticsByVendorType = async (req, res) => {
  try {
    // Only admin can access this
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const statistics = await BAPBRepository.getStatisticsByVendorType();

    res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Get BAPB statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};

/**
 * Validate if user can create BAPB (utility endpoint)
 * @route GET /api/bapb/validate-access
 * @access Private
 */
exports.validateBAPBAccess = async (req, res) => {
  try {
    const hasAccess = canManageBAPB(req.user.role);

    res.status(200).json({
      success: true,
      data: {
        hasAccess,
        userRole: req.user.role,
        allowedRoles: ['vendor_barang', 'vendor', 'admin'],
        message: hasAccess 
          ? 'User can manage BAPB' 
          : 'User cannot manage BAPB. Only vendor_barang can create/manage BAPB.'
      }
    });
  } catch (error) {
    console.error('Validate BAPB access error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating access',
      error: error.message
    });
  }
};