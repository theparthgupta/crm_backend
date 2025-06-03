const Joi = require('joi');
const Campaign = require('../models/campaign.model');
const Segment = require('../models/segment.model');
const Customer = require('../models/customer.model');
const CommunicationLog = require('../models/communicationLog.model');
const ruleToMongoFilter = require('../utils/ruleToMongoFilter');
const vendorService = require('../services/vendorService');
const { generateCampaignSummary } = require('../services/aiService');

const createCampaign = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    segmentId: Joi.string().required(),
    message: Joi.string().required(),
    schedule: Joi.date().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const segment = await Segment.findById(value.segmentId);
    if (!segment) return res.status(404).json({ error: 'Segment not found' });

    // Ensure segment belongs to the logged-in user
    if (segment.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Forbidden: You can only create campaigns for your own segments.' });
    }

    // Get customers matching segment rules
    const filter = ruleToMongoFilter(segment.rules);
    const customers = await Customer.find(filter);

    // Create campaign record
    const campaign = new Campaign({
      userId: req.user._id, // Associate campaign with the logged-in user
      name: value.name,
      segmentId: value.segmentId,
      message: value.message,
      schedule: value.schedule,
      status: value.schedule ? 'SCHEDULED' : 'RUNNING', // Set status based on schedule
      stats: {
        totalAudience: customers.length,
        sentCount: 0,
        failedCount: 0,
        successRate: 0
      }
    });

    await campaign.save();

    // If no schedule, start sending messages immediately
    if (!value.schedule) {
      const deliveryResults = await vendorService.batchProcessMessages(customers, value.message);
      
      // Create communication log entries and update campaign stats
      let sentCount = 0;
      let failedCount = 0;

      const logEntries = deliveryResults.map(result => {
        // Find customer by simulated customerId, assuming vendorService returns it
        const customer = customers.find(c => c.customerId === result.customerId);
         // Handle case where customer is not found (shouldn't happen if segment logic is correct)
        if (!customer) {
            console.warn(`Customer not found for simulated delivery result: ${result.customerId}`);
            return null; // Skip creating log for this result
        }

        if (result.status === 'SENT') {
          sentCount++;
        } else {
          failedCount++;
        }
        return {
          campaignId: campaign._id,
          customerId: customer._id, // Use actual customer _id
          message: value.message,
          status: result.status,
          failureReason: result.error,
          vendorResponse: result // Store the full vendor response including messageId
        };
      }).filter(log => log !== null); // Filter out any null entries

      // Only insert if there are valid log entries
      if (logEntries.length > 0) {
        await CommunicationLog.insertMany(logEntries);
      }

      // Update campaign status and stats after sending
      campaign.stats.sentCount = sentCount;
      campaign.stats.failedCount = failedCount;
      campaign.stats.successRate = customers.length > 0 ? (sentCount / customers.length) * 100 : 0;
      campaign.status = 'COMPLETED'; // Mark as completed after immediate send

      await campaign.save();
    }

    res.status(201).json({ 
      message: 'Campaign created successfully', 
      campaign 
    });
  } catch (err) {
    console.error('Campaign error:', err);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
};

// Get all campaigns for the logged-in user
const getCampaigns = async (req, res) => {
  try {
    // Filter campaigns by the logged-in user's ID
    const campaigns = await Campaign.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('segmentId', 'name audienceSize');
    
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ message: 'Error fetching campaigns', error: error.message });
  }
};

// Get a specific campaign by ID for the logged-in user and include AI summary
const getCampaignById = async (req, res) => {
  try {
    // Find campaign by ID and ensure it belongs to the logged-in user
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('segmentId', 'name audienceSize')
      .lean(); // Use .lean() for plain JavaScript objects
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found or not authorized' });
    }

    // Generate AI summary if campaign is completed and has stats
    let aiSummary = null;
    if (campaign.status === 'COMPLETED' && campaign.stats) {
        aiSummary = await generateCampaignSummary({
            name: campaign.name,
            totalAudience: campaign.stats.totalAudience,
            sentCount: campaign.stats.sentCount,
            failedCount: campaign.stats.failedCount,
            successRate: campaign.stats.successRate
        });
    }
    
    // Add the AI summary to the campaign object
    campaign.aiSummary = aiSummary;

    res.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign or generating summary:', error);
    res.status(500).json({ message: 'Error fetching campaign or generating summary', error: error.message });
  }
};

module.exports = {
  createCampaign,
  getCampaigns,
  getCampaignById
};
