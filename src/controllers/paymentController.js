const paymentService = require('../services/paymentService');
const { asyncHandler } = require('../utils/errorHandler');

// Process payment for BAPB
exports.processBAPBPayment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, paymentMethod } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    const result = await paymentService.processBAPBPayment(id, { amount, paymentMethod });

    res.status(200).json(result);
});

// Process payment for BAPP
exports.processBAPPPayment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, contractAmount, paymentMethod } = req.body;

    if (!contractAmount || contractAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Contract amount is required' });
    }

    const result = await paymentService.processBAPPPayment(id, { amount, contractAmount, paymentMethod });

    res.status(200).json(result);
});

// Get payment logs for a document
exports.getPaymentLogs = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { type } = req.query; // 'BAPB' or 'BAPP'

    if (!type || !['BAPB', 'BAPP'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Query parameter type (BAPB/BAPP) is required' });
    }

    const logs = await paymentService.getPaymentLogs(type, id);

    res.status(200).json({ success: true, data: logs });
});

// Check document readiness for payment
exports.checkPaymentReadiness = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { type } = req.query;

    if (!type || !['BAPB', 'BAPP'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Query parameter type (BAPB/BAPP) is required' });
    }

    const readiness = await paymentService.checkPaymentReadiness(type, id);

    res.status(200).json({ success: true, data: readiness });
});

module.exports = exports;