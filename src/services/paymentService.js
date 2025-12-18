const { supabaseAdmin } = require('../config/supabase');
const BAPBRepository = require('../repositories/BAPBRepository');
const BAPPRepository = require('../repositories/BAPPRepository');
const UserRepository = require('../repositories/UserRepository');
const moment = require('moment');
const notificationService = require('./notificationService');

class PaymentService {
  /**
   * Simulate payment processing for approved BAPB
   */
  async processBAPBPayment(bapbId, paymentData) {
    try {
      // Fetch BAPB data
      const bapb = await BAPBRepository.findByIdWithRelations(bapbId);

      if (!bapb) {
        throw new Error('BAPB not found');
      }

      // Check if BAPB is approved
      if (bapb.status !== 'approved') {
        throw new Error('BAPB must be approved before payment processing');
      }

      // Simulate payment gateway call
      const paymentResult = await this.simulatePaymentGateway({
        documentType: 'BAPB',
        documentNumber: bapb.bapb_number,
        vendorId: bapb.vendor_id,
        vendorName: bapb.vendor?.name || 'Unknown',
        amount: paymentData.amount,
        description: `Payment for ${bapb.bapb_number} - ${bapb.order_number}`,
        metadata: {
          bapbId: bapb.id,
          orderNumber: bapb.order_number,
          deliveryDate: bapb.delivery_date,
        },
      });

      // Log payment attempt
      await this.logPaymentAttempt({
        documentType: 'BAPB',
        documentId: bapb.id,
        documentNumber: bapb.bapb_number,
        vendorId: bapb.vendor_id,
        amount: paymentData.amount,
        status: paymentResult.status,
        paymentMethod: paymentData.paymentMethod || 'bank_transfer',
        transactionId: paymentResult.transactionId,
        gatewayResponse: paymentResult,
      });

      // Notify vendor about payment
      if (paymentResult.status === 'success') {
        await notificationService.notifyPaymentProcessed(bapb.vendor_id, {
          documentType: 'BAPB',
          documentId: bapb.id,
          documentNumber: bapb.bapb_number,
          amount: paymentData.amount,
          transactionId: paymentResult.transactionId,
        });
      }

      return {
        success: true,
        message: 'Payment processed successfully (SIMULATION)',
        data: {
          bapbNumber: bapb.bapb_number,
          vendorName: bapb.vendor?.name,
          amount: paymentData.amount,
          transactionId: paymentResult.transactionId,
          status: paymentResult.status,
          estimatedSettlement: paymentResult.estimatedSettlement,
          simulationNote: 'This is a simulated payment - No actual money transferred',
        },
      };
    } catch (error) {
      console.error('BAPB payment processing error:', error);
      throw error;
    }
  }

  /**
   * Simulate payment processing for approved BAPP
   */
  async processBAPPPayment(bappId, paymentData) {
    try {
      const bapp = await BAPPRepository.findByIdWithRelations(bappId);

      if (!bapp) {
        throw new Error('BAPP not found');
      }

      if (bapp.status !== 'approved') {
        throw new Error('BAPP must be approved before payment processing');
      }

      // Calculate payment based on progress percentage
      const progressBasedAmount = (paymentData.contractAmount * bapp.total_progress) / 100;

      const paymentResult = await this.simulatePaymentGateway({
        documentType: 'BAPP',
        documentNumber: bapp.bapp_number,
        vendorId: bapp.vendor_id,
        vendorName: bapp.vendor?.name || 'Unknown',
        amount: paymentData.amount || progressBasedAmount,
        description: `Payment for ${bapp.bapp_number} - ${bapp.project_name} (${bapp.total_progress}% complete)`,
        metadata: {
          bappId: bapp.id,
          contractNumber: bapp.contract_number,
          projectName: bapp.project_name,
          totalProgress: bapp.total_progress,
          contractAmount: paymentData.contractAmount,
        },
      });

      await this.logPaymentAttempt({
        documentType: 'BAPP',
        documentId: bapp.id,
        documentNumber: bapp.bapp_number,
        vendorId: bapp.vendor_id,
        amount: paymentData.amount || progressBasedAmount,
        status: paymentResult.status,
        paymentMethod: paymentData.paymentMethod || 'bank_transfer',
        transactionId: paymentResult.transactionId,
        gatewayResponse: paymentResult,
      });

      // Notify vendor about payment
      if (paymentResult.status === 'success') {
        await notificationService.notifyPaymentProcessed(bapp.vendor_id, {
          documentType: 'BAPP',
          documentId: bapp.id,
          documentNumber: bapp.bapp_number,
          amount: paymentData.amount,
          transactionId: paymentResult.transactionId,
        });
      }

      return {
        success: true,
        message: 'Payment processed successfully (SIMULATION)',
        data: {
          bappNumber: bapp.bapp_number,
          projectName: bapp.project_name,
          vendorName: bapp.vendor?.name,
          totalProgress: bapp.total_progress,
          contractAmount: paymentData.contractAmount,
          calculatedAmount: progressBasedAmount.toFixed(2),
          paidAmount: paymentData.amount || progressBasedAmount,
          transactionId: paymentResult.transactionId,
          status: paymentResult.status,
          estimatedSettlement: paymentResult.estimatedSettlement,
          simulationNote: 'This is a simulated payment - No actual money transferred',
        },
      };
    } catch (error) {
      console.error('BAPP payment processing error:', error);
      throw error;
    }
  }

  /**
   * Simulate payment gateway response
   */
  async simulatePaymentGateway(paymentRequest) {
    // Simulate network delay (100-500ms)
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 400 + 100));

    // Generate transaction ID
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Simulate success rate (95% success)
    const isSuccess = Math.random() > 0.05;

    if (isSuccess) {
      return {
        status: 'success',
        transactionId,
        timestamp: new Date().toISOString(),
        amount: paymentRequest.amount,
        currency: 'IDR',
        paymentMethod: 'bank_transfer',
        estimatedSettlement: moment().add(1, 'days').format('YYYY-MM-DD'),
        gatewayReference: `GW-${transactionId}`,
        vendorId: paymentRequest.vendorId,
        vendorName: paymentRequest.vendorName,
        description: paymentRequest.description,
        metadata: paymentRequest.metadata,
        message: 'Payment successfully processed',
        simulationMode: true,
      };
    } else {
      const failureReasons = [
        'Insufficient funds in system account',
        'Vendor bank account validation failed',
        'Daily transaction limit exceeded',
        'Payment gateway timeout',
        'Vendor account suspended'
      ];

      const randomReason = failureReasons[Math.floor(Math.random() * failureReasons.length)];

      return {
        status: 'failed',
        transactionId,
        timestamp: new Date().toISOString(),
        amount: paymentRequest.amount,
        errorCode: 'PAYMENT_FAILED',
        errorMessage: randomReason,
        vendorId: paymentRequest.vendorId,
        simulationMode: true,
      };
    }
  }

  /**
   * Log payment attempt to database
   */
  async logPaymentAttempt(logData) {
    try {
      await supabaseAdmin.from('payment_logs').insert({
        document_type: logData.documentType,
        document_id: logData.documentId,
        document_number: logData.documentNumber,
        vendor_id: logData.vendorId,
        amount: logData.amount,
        payment_method: logData.paymentMethod,
        status: logData.status,
        transaction_id: logData.transactionId,
        gateway_response: logData.gatewayResponse,
        processed_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error logging payment attempt:', error);
    }
  }

  /**
   * Get payment logs for a document
   */
  async getPaymentLogs(documentType, documentId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('payment_logs')
        .select(`
          *,
          vendor:users!payment_logs_vendor_id_fkey(id, name, company, email)
        `)
        .eq('document_type', documentType)
        .eq('document_id', documentId)
        .order('processed_at', { ascending: false });

      if (error) throw error;

      return data.map((log) => ({
        id: log.id,
        transactionId: log.transaction_id,
        amount: log.amount,
        paymentMethod: log.payment_method,
        status: log.status,
        vendor: log.vendor,
        processedAt: log.processed_at,
        gatewayResponse: log.gateway_response,
      }));
    } catch (error) {
      console.error('Error fetching payment logs:', error);
      throw error;
    }
  }

  /**
   * Check if document is ready for payment
   */
  async checkPaymentReadiness(documentType, documentId) {
    try {
      const Repository = documentType === 'BAPB' ? BAPBRepository : BAPPRepository;
      const document = await Repository.findById(documentId);

      if (!document) {
        return {
          ready: false,
          reason: 'Document not found',
          blockers: ['Document does not exist'],
        };
      }

      const blockers = [];

      // Check approval status
      if (document.status !== 'approved') {
        blockers.push('Document is not approved');
      }

      // Check if already paid
      const { data: existingPayments } = await supabaseAdmin
        .from('payment_logs')
        .select('id')
        .eq('document_type', documentType)
        .eq('document_id', documentId)
        .eq('status', 'success');

      if (existingPayments && existingPayments.length > 0) {
        blockers.push('Payment already processed for this document');
      }

      // Check vendor details
      const vendor = await UserRepository.findById(document.vendor_id);
      if (!vendor || !vendor.is_active) {
        blockers.push('Vendor account is inactive or not found');
      }

      const numberField = documentType === 'BAPB' ? 'bapb_number' : 'bapp_number';

      return {
        ready: blockers.length === 0,
        reason: blockers.length > 0 ? 'Document not ready for payment' : 'Document ready for payment',
        blockers,
        document: {
          id: document.id,
          number: document[numberField],
          status: document.status,
          vendorId: document.vendor_id,
        },
      };
    } catch (error) {
      console.error('Error checking payment readiness:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();