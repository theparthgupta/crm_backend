const Joi = require('joi');
const Customer = require('../models/customer.model');
const Order = require('../models/order.model');

const customerSchema = Joi.object({
  customerId: Joi.number().integer().required(),
  name: Joi.string().max(255).allow('', null),
  email: Joi.string().email().required(),
  phone: Joi.string().max(50).allow('', null),
});

const orderSchema = Joi.object({
  orderId: Joi.number().integer().required(),
  customerId: Joi.number().integer().required(),
  orderAmount: Joi.number().precision(2).required(),
  orderDate: Joi.date().iso().required(),
});

const ingestCustomer = async (req, res) => {
  const { error, value } = customerSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { customerId, name, email, phone } = value;
  try {
    const customer = await Customer.findOneAndUpdate(
      { customerId },
      { name, email, phone },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.status(201).json({
      message: 'Customer ingested successfully',
      customer,
    });
  } catch (err) {
    console.error('Error ingesting customer:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const ingestOrder = async (req, res) => {
  const { error, value } = orderSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { orderId, customerId, orderAmount, orderDate } = value;
  try {
    const order = new Order({
      orderId,
      customerId,
      orderAmount,
      orderDate,
    });
    await order.save();

    const customer = await Customer.findOne({ customerId });
    if (customer) {
      customer.visitCount += 1;
      customer.totalSpend += orderAmount;
      // If lastPurchase is null or older than this orderDate, update
      if (!customer.lastPurchase || new Date(orderDate) > customer.lastPurchase) {
        customer.lastPurchase = orderDate;
      }
      await customer.save();
    } else {
      // If the customer record does not exist, you could:
      //  a) reject the order (400 Bad Request)  
      //  b) create a new customer skeleton  
      // Here we’ll choose to create a minimal customer record.
      await Customer.create({
        customerId,
        name: '',
        email: '',
        phone: '',
        visitCount: 1,
        totalSpend: orderAmount,
        lastPurchase: orderDate,
      });
    }

    return res.status(201).json({
      message: 'Order ingested and customer updated',
      order,
    });
  } catch (err) {
    console.error('Error ingesting order:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Order with this ID already exists' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  ingestCustomer,
  ingestOrder,
};
