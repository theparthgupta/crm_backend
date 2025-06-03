const Joi = require('joi');
const CommunicationLog = require('../models/communicationLog.model');
const vendorService = require('../services/vendorService');

// Schema for delivery receipt validation
const receiptSchema = Joi.object({
  messageId: Joi.string().required(),
  status: Joi.string().valid('SENT', 'FAILED').required(),
  error: Joi.string().allow(null),
  timestamp: Joi.date().default(() => new Date())
});

// Process delivery receipt
const processReceipt = async (req, res) => {
  try {
    const { error, value } = receiptSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Process receipt through vendor service
    const result = await vendorService.processDeliveryReceipt(value);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Update communication log
    const log = await CommunicationLog.findOneAndUpdate(
      { 'vendorResponse.messageId': value.messageId },
      {
        status: value.status,
        failureReason: value.error,
        lastAttemptAt: value.timestamp
      },
      { new: true }
    );

    if (!log) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({
      message: 'Receipt processed successfully',
      log
    });
  } catch (error) {
    console.error('Receipt processing error:', error);
    res.status(500).json({ error: 'Failed to process receipt' });
  }
};

// Batch process receipts
const batchProcessReceipts = async (req, res) => {
  try {
    const { receipts } = req.body;
    if (!Array.isArray(receipts)) {
      return res.status(400).json({ error: 'Receipts must be an array' });
    }

    const results = await Promise.all(
      receipts.map(async (receiptData) => {
        const { error, value } = receiptSchema.validate(receiptData);
        if (error) {
          return { error: error.details[0].message, data: receiptData };
        }

        try {
          const result = await vendorService.processDeliveryReceipt(value);
          if (!result.success) {
            return { error: result.error, data: receiptData };
          }

          const log = await CommunicationLog.findOneAndUpdate(
            { 'vendorResponse.messageId': value.messageId },
            {
              status: value.status,
              failureReason: value.error,
              lastAttemptAt: value.timestamp
            },
            { new: true }
          );

          return { success: true, log };
        } catch (err) {
          return { error: err.message, data: receiptData };
        }
      })
    );

    res.json({
      message: 'Batch receipt processing completed',
      results
    });
  } catch (error) {
    console.error('Batch receipt processing error:', error);
    res.status(500).json({ error: 'Failed to process batch receipts' });
  }
};

module.exports = {
  processReceipt,
  batchProcessReceipts
}; 