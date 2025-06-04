const Joi = require('joi');
const Customer = require('../models/customer.model');
const Order = require('../models/order.model');

// Schema for customer data validation
const customerSchema = Joi.object({
  customerId: Joi.number().required(),
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().allow(''),
  totalSpend: Joi.number().default(0),
  visitCount: Joi.number().default(0),
  lastPurchase: Joi.date().allow(null)
});

// Schema for order data validation
const orderSchema = Joi.object({
  orderId: Joi.string().required(),
  customerId: Joi.number().required(),
  amount: Joi.number().required(),
  items: Joi.array().items(
    Joi.object({
      productId: Joi.string().required(),
      quantity: Joi.number().required(),
      price: Joi.number().required()
    })
  ).required(),
  status: Joi.string().valid('PENDING', 'COMPLETED', 'CANCELLED').required(),
  orderDate: Joi.date().required()
});

// Ingest customer data
const ingestCustomer = async (req, res) => {
  try {
    const { error, value } = customerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Update or create customer
    const customer = await Customer.findOneAndUpdate(
      { customerId: value.customerId },
      value,
      { upsert: true, new: true }
    );

    res.status(200).json({
      message: 'Customer data ingested successfully',
      customer
    });
  } catch (error) {
    console.error('Customer ingestion error:', error);
    res.status(500).json({ error: 'Failed to ingest customer data' });
  }
};

// Ingest order data
const ingestOrder = async (req, res) => {
  try {
    const { error, value } = orderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Create new order
    const order = new Order(value);
    await order.save();

    // Update customer stats
    await Customer.findOneAndUpdate(
      { customerId: value.customerId },
      {
        $inc: { 
          totalSpend: value.amount,
          visitCount: 1
        },
        lastPurchase: value.orderDate
      }
    );

    res.status(200).json({
      message: 'Order data ingested successfully',
      order
    });
  } catch (error) {
    console.error('Order ingestion error:', error);
    res.status(500).json({ error: 'Failed to ingest order data' });
  }
};

// Batch ingest customers
const batchIngestCustomers = async (req, res) => {
  try {
    const { customers } = req.body;
    if (!Array.isArray(customers)) {
      return res.status(400).json({ error: 'Customers must be an array' });
    }

    const results = await Promise.all(
      customers.map(async (customerData) => {
        const { error, value } = customerSchema.validate(customerData);
        if (error) {
          return { error: error.details[0].message, data: customerData };
        }

        try {
          const customer = await Customer.findOneAndUpdate(
            { customerId: value.customerId },
            value,
            { upsert: true, new: true }
          );
          return { success: true, customer };
        } catch (err) {
          return { error: err.message, data: customerData };
        }
      })
    );

    res.status(200).json({
      message: 'Batch customer ingestion completed',
      results
    });
  } catch (error) {
    console.error('Batch customer ingestion error:', error);
    res.status(500).json({ error: 'Failed to process batch customer ingestion' });
  }
};

// Batch ingest orders
const batchIngestOrders = async (req, res) => {
  try {
    const { orders } = req.body;
    if (!Array.isArray(orders)) {
      return res.status(400).json({ error: 'Orders must be an array' });
    }

    const results = await Promise.all(
      orders.map(async (orderData) => {
        const { error, value } = orderSchema.validate(orderData);
        if (error) {
          return { error: error.details[0].message, data: orderData };
        }

        try {
          // Create new order
          const order = new Order(value);
          await order.save();

          // Update customer stats
          await Customer.findOneAndUpdate(
            { customerId: value.customerId },
            {
              $inc: { 
                totalSpend: value.amount,
                visitCount: 1
              },
              lastPurchase: value.orderDate
            }
          );

          return { success: true, order };
        } catch (err) {
          return { error: err.message, data: orderData };
        }
      })
    );

    res.status(200).json({
      message: 'Batch order ingestion completed',
      results
    });
  } catch (error) {
    console.error('Batch order ingestion error:', error);
    res.status(500).json({ error: 'Failed to process batch order ingestion' });
  }
};

module.exports = {
  ingestCustomer,
  ingestOrder,
  batchIngestCustomers,
  batchIngestOrders
};
