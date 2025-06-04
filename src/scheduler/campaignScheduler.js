const cron = require('node-cron');
const Campaign = require('../models/campaign.model');
const Segment = require('../models/segment.model');
const Customer = require('../models/customer.model');
const ruleToMongoFilter = require('../utils/ruleToMongoFilter');
const vendorService = require('../services/vendorService');

function personalizeMessage(template, customer) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => customer[key] || '');
}

async function sendCampaign(campaign) {
  try {
    const segment = await Segment.findById(campaign.segmentId);
    if (!segment) throw new Error('Segment not found');

    const filter = ruleToMongoFilter(segment.rules);
    const customers = await Customer.find(filter);

    let sentCount = 0;
    let failedCount = 0;

    for (const customer of customers) {
      try {
        const message = personalizeMessage(campaign.message, customer);
        const result = await vendorService.sendMessage(customer, message);
        
        if (result.success) {
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error(`Failed to send message to ${customer.email}:`, error);
        failedCount++;
      }
    }

    // Update campaign stats
    campaign.stats.sentCount = sentCount;
    campaign.stats.failedCount = failedCount;
    campaign.stats.successRate = customers.length > 0 ? (sentCount / customers.length) * 100 : 0;
    campaign.status = 'COMPLETED';
    await campaign.save();

  } catch (error) {
    console.error('Error sending campaign:', error);
    campaign.status = 'FAILED';
    await campaign.save();
  }
}

// Check every minute for campaigns that need sending
function startScheduler() {
  cron.schedule('* * * * *', async () => {
    console.log('Checking for campaigns to send...');
    const now = new Date();
    
    try {
      const campaigns = await Campaign.find({
        status: 'SCHEDULED',
        schedule: { $lte: now }
      });

      for (const campaign of campaigns) {
        await sendCampaign(campaign);
      }
    } catch (error) {
      console.error('Error in campaign scheduler:', error);
    }
  });
}

module.exports = { startScheduler };
