const express = require('express');
const router = express.Router();
const { createCampaign, getCampaigns, getCampaignById, getCampaignLogs, subscribeToCampaignUpdates } = require('../controllers/campaign.controller');
const { ensureAuthenticated } = require('../middleware/auth');

// Apply authentication middleware to all campaign routes
router.use(ensureAuthenticated);

router.post('/', createCampaign);
router.get('/', getCampaigns);
router.get('/:id', getCampaignById);
router.get('/:id/logs', getCampaignLogs);
router.get('/:id/updates', subscribeToCampaignUpdates);

module.exports = router;
