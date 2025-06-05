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
      // Set status based on schedule date: RUNNING if in the past or no schedule, SCHEDULED if in the future
      status: (!value.schedule || new Date(value.schedule) <= new Date()) ? 'RUNNING' : 'SCHEDULED', 
      stats: {
        totalAudience: customers.length,
        sentCount: 0,
        failedCount: 0,
        successRate: 0
      }
    });

    await campaign.save();

    // If status is RUNNING (either no schedule or past schedule), start sending messages immediately
    if (campaign.status === 'RUNNING') {
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

// Get campaign by ID
const getCampaignById = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.user._id
    })
    .select('+aiSummary'); // Explicitly select aiSummary field

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found or not authorized' });
    }

    // Get delivery statistics
    const deliveryStats = await CommunicationLog.aggregate([
      { $match: { campaignId: campaign._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Format delivery stats
    const stats = {
      total: campaign.stats.totalAudience || 0,
      sent: 0,
      failed: 0,
      pending: 0
    };

    deliveryStats.forEach(stat => {
      stats[stat._id.toLowerCase()] = stat.count;
    });

    // Get campaign status
    let status = campaign.status;
    if (status === 'SCHEDULED' && new Date(campaign.scheduledFor) <= new Date()) {
      status = 'IN_PROGRESS';
    }

    // Get segment details
    const segment = await Segment.findById(campaign.segmentId)
      .select('name rules')
      .lean();

    // Calculate progress based on total audience
    const progress = stats.total > 0 
      ? ((stats.sent + stats.failed) / stats.total) * 100 
      : 0;

    res.json({
      ...campaign.toObject(),
      segment,
      deliveryStats: stats,
      status,
      progress,
      totalAudience: stats.total,
      aiSummary: campaign.aiSummary // Include the aiSummary field
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
};

// Get delivery logs for a campaign
const getCampaignLogs = async (req, res) => {
  try {
    const campaignId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status; // Optional filter by status

    // Verify campaign exists and belongs to user
    const campaign = await Campaign.findOne({
      _id: campaignId,
      userId: req.user._id
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found or not authorized' });
    }

    // Build query
    const query = { campaignId };
    if (status) {
      query.status = status.toUpperCase(); // Ensure status is uppercase to match DB
    }

    // Get logs with pagination and customer details
    const logs = await CommunicationLog.find(query)
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await CommunicationLog.countDocuments(query);

    // Format response
    const formattedLogs = logs.map(log => ({
      customerId: log.customerId._id,
      customerName: log.customerId.name,
      customerEmail: log.customerId.email,
      status: log.status,
      timestamp: log.lastAttemptAt || log.createdAt,
      error: log.failureReason,
      messageId: log.vendorResponse?.messageId,
      message: log.message // Include the message content
    }));

    // Get delivery statistics for the filtered logs
    const stats = await CommunicationLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Format stats
    const deliveryStats = {
      total: campaign.stats.totalAudience || 0,
      sent: 0,
      failed: 0,
      pending: 0
    };

    stats.forEach(stat => {
      deliveryStats[stat._id.toLowerCase()] = stat.count;
    });

    res.json({
      logs: formattedLogs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      stats: deliveryStats
    });
  } catch (error) {
    console.error('Error fetching campaign logs:', error);
    res.status(500).json({ error: 'Failed to fetch campaign logs' });
  }
};

// Subscribe to campaign updates
const subscribeToCampaignUpdates = async (req, res) => {
  try {
    const campaignId = req.params.id;

    // Verify campaign exists and belongs to user
    const campaign = await Campaign.findOne({
      _id: campaignId,
      userId: req.user._id
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found or not authorized' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial state
    const sendUpdate = async () => {
      try {
        // Get latest delivery stats
        const deliveryStats = await CommunicationLog.aggregate([
          { $match: { campaignId: campaign._id } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]);

        // Format stats
        const stats = {
          total: campaign.stats.totalAudience || 0,
          sent: 0,
          failed: 0,
          pending: 0
        };

        deliveryStats.forEach(stat => {
          stats[stat._id.toLowerCase()] = stat.count;
        });

        // Get campaign status
        let status = campaign.status;
        if (status === 'SCHEDULED' && new Date(campaign.scheduledFor) <= new Date()) {
          status = 'IN_PROGRESS';
        }

        // Calculate progress based on total audience
        const progress = stats.total > 0 
          ? ((stats.sent + stats.failed) / stats.total) * 100 
          : 0;

        // Check if campaign is complete
        const isComplete = status === 'COMPLETED' || status === 'FAILED';
        const hasProcessedAll = stats.total > 0 && (stats.sent + stats.failed) >= stats.total;

        // Send update
        res.write(`data: ${JSON.stringify({
          status,
          stats,
          progress,
          totalAudience: stats.total,
          timestamp: new Date().toISOString(),
          isComplete: isComplete || hasProcessedAll
        })}\n\n`);

        // Continue sending updates if campaign is not completed
        if (!isComplete && !hasProcessedAll) {
          setTimeout(sendUpdate, 5000); // Update every 5 seconds
        } else {
          // Send one final update with complete stats
          const finalStats = await CommunicationLog.aggregate([
            { $match: { campaignId: campaign._id } },
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ]);

          const finalStatsObj = {
            total: campaign.stats.totalAudience || 0,
            sent: 0,
            failed: 0,
            pending: 0
          };

          finalStats.forEach(stat => {
            finalStatsObj[stat._id.toLowerCase()] = stat.count;
          });

          const finalProgress = finalStatsObj.total > 0 
            ? ((finalStatsObj.sent + finalStatsObj.failed) / finalStatsObj.total) * 100 
            : 0;

          res.write(`data: ${JSON.stringify({
            status: 'COMPLETED',
            stats: finalStatsObj,
            progress: finalProgress,
            totalAudience: finalStatsObj.total,
            timestamp: new Date().toISOString(),
            isComplete: true
          })}\n\n`);

          res.end();
        }
      } catch (error) {
        console.error('Error sending campaign update:', error);
        res.end();
      }
    };

    // Start sending updates
    sendUpdate();

    // Handle client disconnect
    req.on('close', () => {
      res.end();
    });
  } catch (error) {
    console.error('Error setting up campaign updates:', error);
    res.status(500).json({ error: 'Failed to set up campaign updates' });
  }
};

module.exports = {
  createCampaign,
  getCampaigns,
  getCampaignById,
  getCampaignLogs,
  subscribeToCampaignUpdates
};
