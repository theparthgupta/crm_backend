const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    customerId: {
      type: Number,
      required: true,
      unique: true
    },
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    totalSpend: {
      type: Number,
      default: 0.0,
    },
    visitCount: {
      type: Number,
      default: 0,
    },
    lastPurchase: {
      type: Date,
    }
  },
  {
    timestamps: true,
  }
);

customerSchema.index({ customerId: 1 }, { unique: true });

const Customer = mongoose.model('Customer', customerSchema);
module.exports = Customer;
