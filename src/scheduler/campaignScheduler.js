const cron = require('node-cron');
const Campaign = require('../models/campaign.model');
const Segment = require('../models/segment.model');
const Customer = require('../models/customer.model');
const ruleToMongoFilter = require('../utils/ruleToMongoFilter');

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
        const message = personalizeMessage(campaign.messageTemplate, customer);
        console.log(`Sending to ${customer.email}: ${message}`);
        sentCount++;
      } catch {
        failedCount++;
      }
    }

    campaign.status = 'sent';
    campaign.sentCount = sentCount;
    campaign.failedCount = failedCount;
    await campaign.save();
  } catch (error) {
    console.error('Error sending campaign:', error);
    campaign.status = 'failed';
    await campaign.save();
  }
}


// Check every minute for campaigns that need sending
function startScheduler() {
  cron.schedule('* * * * *', async () => {
    console.log('Checking for campaigns to send...');
    const now = new Date();
    const campaigns = await Campaign.find({
      status: 'pending',
      schedule: { $lte: now }
    });

    for (const campaign of campaigns) {
      await sendCampaign(campaign);
    }
  });
}

module.exports = { startScheduler };
