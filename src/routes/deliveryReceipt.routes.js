const express = require('express');
const router = express.Router();
const { processReceipt, batchProcessReceipts } = require('../controllers/deliveryReceipt.controller');

// Process single receipt
router.post('/', processReceipt);

// Process batch of receipts
router.post('/batch', batchProcessReceipts);

module.exports = router; 