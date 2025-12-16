// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone number (Indonesian format)
const isValidPhone = (phone) => {
  const phoneRegex = /^(\+62|62|0)[0-9]{9,12}$/;
  return phoneRegex.test(phone);
};

// Validate UUID format
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Registration validation
exports.validateRegistration = (req, res, next) => {
  const { email, password, name, role } = req.body;
  const errors = [];

  if (!email || !isValidEmail(email)) {
    errors.push('Valid email is required');
  }

  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  if (!name || name.trim().length < 3) {
    errors.push('Name must be at least 3 characters');
  }

  // Hanya vendor_barang, vendor_jasa, pic_gudang, admin, approver
  const validRoles = ['vendor_barang', 'vendor_jasa', 'pic_gudang', 'admin', 'approver'];
  if (!role || !validRoles.includes(role)) {
    errors.push(`Role must be one of: ${validRoles.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

// Login validation
exports.validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || !isValidEmail(email)) {
    errors.push('Valid email is required');
  }

  if (!password) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

// BAPB creation validation
exports.validateBAPB = (req, res, next) => {
  const { orderNumber, deliveryDate, items } = req.body;
  const errors = [];

  if (!orderNumber || orderNumber.trim().length === 0) {
    errors.push('Order number is required');
  }

  if (!deliveryDate) {
    errors.push('Delivery date is required');
  } else {
    const date = new Date(deliveryDate);
    if (isNaN(date.getTime())) {
      errors.push('Invalid delivery date format');
    }
  }

  if (items && Array.isArray(items)) {
    items.forEach((item, index) => {
      if (!item.itemName || item.itemName.trim().length === 0) {
        errors.push(`Item ${index + 1}: Item name is required`);
      }
      if (!item.quantityOrdered || item.quantityOrdered < 0) {
        errors.push(`Item ${index + 1}: Valid quantity ordered is required`);
      }
      if (!item.quantityReceived || item.quantityReceived < 0) {
        errors.push(`Item ${index + 1}: Valid quantity received is required`);
      }
      if (!item.unit || item.unit.trim().length === 0) {
        errors.push(`Item ${index + 1}: Unit is required`);
      }
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

// BAPP creation validation
exports.validateBAPP = (req, res, next) => {
  const { contractNumber, projectName, projectLocation, startDate, endDate, workItems } = req.body;
  const errors = [];

  if (!contractNumber || contractNumber.trim().length === 0) {
    errors.push('Contract number is required');
  }

  if (!projectName || projectName.trim().length === 0) {
    errors.push('Project name is required');
  }

  if (!projectLocation || projectLocation.trim().length === 0) {
    errors.push('Project location is required');
  }

  if (!startDate) {
    errors.push('Start date is required');
  } else {
    const date = new Date(startDate);
    if (isNaN(date.getTime())) {
      errors.push('Invalid start date format');
    }
  }

  if (!endDate) {
    errors.push('End date is required');
  } else {
    const date = new Date(endDate);
    if (isNaN(date.getTime())) {
      errors.push('Invalid end date format');
    }
    if (startDate && new Date(endDate) < new Date(startDate)) {
      errors.push('End date must be after start date');
    }
  }

  if (workItems && Array.isArray(workItems)) {
    workItems.forEach((item, index) => {
      if (!item.workItemName || item.workItemName.trim().length === 0) {
        errors.push(`Work item ${index + 1}: Work item name is required`);
      }
      if (item.plannedProgress === undefined || item.plannedProgress < 0 || item.plannedProgress > 100) {
        errors.push(`Work item ${index + 1}: Planned progress must be between 0 and 100`);
      }
      if (item.actualProgress === undefined || item.actualProgress < 0 || item.actualProgress > 100) {
        errors.push(`Work item ${index + 1}: Actual progress must be between 0 and 100`);
      }
      if (!item.unit || item.unit.trim().length === 0) {
        errors.push(`Work item ${index + 1}: Unit is required`);
      }
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

// UUID parameter validation
exports.validateUUIDParam = (paramName = 'id') => {
  return (req, res, next) => {
    const uuid = req.params[paramName];
    
    if (!uuid || !isValidUUID(uuid)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} format`
      });
    }
    
    next();
  };
};