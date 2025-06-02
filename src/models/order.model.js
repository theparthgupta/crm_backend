const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: Number,
      required: true,
      unique: true
    },
    customerId: {
      type: Number,
      required: true,
    },
    orderAmount: {
      type: Number,
      required: true,
    },
    orderDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      default: 'PLACED',
    }
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ orderId: 1 }, { unique: true });
orderSchema.index({ customerId: 1 });
const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
