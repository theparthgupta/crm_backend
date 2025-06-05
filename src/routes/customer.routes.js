const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Customer = require('../models/customer.model');

// Apply authentication middleware to all customer routes
router.use(ensureAuthenticated);

// Get all customers
router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get customer by ID
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

module.exports = router; 