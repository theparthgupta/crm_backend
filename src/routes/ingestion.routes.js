const express = require('express');
const router = express.Router();
const ingestionController = require('../controllers/ingestion.controller');

router.post('/customers', ingestionController.ingestCustomer);

router.post('/orders', ingestionController.ingestOrder);

module.exports = router;
