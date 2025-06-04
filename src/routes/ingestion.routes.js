const express = require('express');
const router = express.Router();
const { ingestCustomer, ingestOrder, batchIngestCustomers, batchIngestOrders } = require('../controllers/ingestion.controller');

// Customer ingestion endpoints
router.post('/customers', ingestCustomer);
router.post('/customers/batch', batchIngestCustomers);

// Order ingestion endpoints
router.post('/orders', ingestOrder);
router.post('/orders/batch', batchIngestOrders);

module.exports = router;
