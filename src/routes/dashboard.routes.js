const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboard.controller');
const { ensureAuthenticated } = require('../middleware/auth');

// Apply authentication middleware to all dashboard routes
router.use(ensureAuthenticated);

// Get dashboard statistics
router.get('/stats', getDashboardStats);

module.exports = router; 