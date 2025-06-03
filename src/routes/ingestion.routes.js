const express = require('express');
const router = express.Router();
const { ingestCustomer, ingestOrder, batchIngestCustomers } = require('../controllers/ingestion.controller');

// Customer ingestion endpoints
router.post('/customers', ingestCustomer);
router.post('/customers/batch', batchIngestCustomers);

// Order ingestion endpoint
router.post('/orders', ingestOrder);

module.exports = router;
