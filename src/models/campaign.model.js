const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Segment',
      required: true
    },
    message: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED'],
      default: 'DRAFT'
    },
    schedule: {
      type: Date
    },
    stats: {
      totalAudience: {
        type: Number,
        default: 0
      },
      sentCount: {
        type: Number,
        default: 0
      },
      failedCount: {
        type: Number,
        default: 0
      },
      successRate: {
        type: Number,
        default: 0
      }
    }
  },
  { timestamps: true }
);

// Indexes for efficient querying
campaignSchema.index({ userId: 1, createdAt: -1 });
campaignSchema.index({ status: 1 });
campaignSchema.index({ schedule: 1 });

const Campaign = mongoose.model('Campaign', campaignSchema);
module.exports = Campaign;
