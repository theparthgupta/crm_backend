const mongoose = require('mongoose');

const communicationLogSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },
    message: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED'],
      default: 'PENDING'
    },
    deliveryAttempts: {
      type: Number,
      default: 0
    },
    lastAttemptAt: {
      type: Date
    },
    failureReason: {
      type: String
    },
    vendorResponse: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

// Indexes for efficient querying
communicationLogSchema.index({ campaignId: 1, customerId: 1 });
communicationLogSchema.index({ status: 1 });
communicationLogSchema.index({ createdAt: 1 });

const CommunicationLog = mongoose.model('CommunicationLog', communicationLogSchema);
module.exports = CommunicationLog; 