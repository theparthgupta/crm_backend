const cron = require('node-cron');
const Campaign = require('../models/campaign.model');
const Segment = require('../models/segment.model');
const Customer = require('../models/customer.model');
const CommunicationLog = require('../models/communicationLog.model');
const ruleToMongoFilter = require('../utils/ruleToMongoFilter');
const vendorService = require('../services/vendorService');
const { generateCampaignSummary } = require('../services/aiService');

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
    const logEntries = [];

    for (const customer of customers) {
      let status = 'FAILED';
      let failureReason = '';
      let vendorResponse = null;
      try {
        const message = personalizeMessage(campaign.message, customer);
        const result = await vendorService.sendMessage(customer, message);
        
        if (result.success) {
          status = 'SENT';
          sentCount++;
        } else {
          status = 'FAILED';
          failureReason = result.error || 'Unknown error';
          failedCount++;
        }
        vendorResponse = result;
      } catch (error) {
        console.error(`Failed to send message to ${customer.email}:`, error);
        status = 'FAILED';
        failureReason = error.message || 'Internal scheduler error';
        failedCount++;
      }

      logEntries.push({
        campaignId: campaign._id,
        customerId: customer._id,
        message: campaign.message,
        status: status,
        failureReason: failureReason,
        vendorResponse: vendorResponse,
        lastAttemptAt: new Date()
      });
    }

    if (logEntries.length > 0) {
      await CommunicationLog.insertMany(logEntries);
    }

    campaign.stats.sentCount = sentCount;
    campaign.stats.failedCount = failedCount;
    campaign.stats.successRate = customers.length > 0 ? (sentCount / customers.length) * 100 : 0;
    campaign.status = 'COMPLETED';

    if (campaign.status === 'COMPLETED' && campaign.stats.totalAudience > 0) {
        try {
            const aiSummaryText = await generateCampaignSummary({
                name: campaign.name,
                totalAudience: campaign.stats.totalAudience,
                sentCount: campaign.stats.sentCount,
                failedCount: campaign.stats.failedCount,
                successRate: campaign.stats.successRate
            });
            campaign.aiSummary = aiSummaryText;
        } catch (aiError) {
            console.error('Error generating AI summary for campaign', campaign._id, ':', aiError);
            campaign.aiSummary = 'Could not generate AI summary.';
        }
    }

    await campaign.save();

  } catch (error) {
    console.error('Error sending campaign:', error);
    campaign.status = 'FAILED';
    await campaign.save();
  }
}

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
        campaign.status = 'IN_PROGRESS';
        await campaign.save();
        await sendCampaign(campaign);
      }
    } catch (error) {
      console.error('Error in campaign scheduler:', error);
    }
  });
}

module.exports = { startScheduler };
