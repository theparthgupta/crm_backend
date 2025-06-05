const Campaign = require('../models/campaign.model');
const mongoose = require('mongoose');

/**
 * Get dashboard statistics and recent campaigns
 * Optimized for performance using MongoDB aggregation
 */
const getDashboardStats = async (req, res) => {
  try {
    // Get user ID from authenticated request
    const userId = req.user._id;

    // Use MongoDB aggregation for efficient data retrieval
    const [stats, recentCampaigns] = await Promise.all([
      // Get overall campaign statistics
      Campaign.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            totalCampaigns: { $sum: 1 },
            activeCampaigns: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['RUNNING', 'SCHEDULED']] },
                  1,
                  0
                ]
              }
            },
            totalAudience: { $sum: '$stats.totalAudience' },
            totalSent: { $sum: '$stats.sentCount' },
            totalFailed: { $sum: '$stats.failedCount' }
          }
        },
        {
          $project: {
            _id: 0,
            totalCampaigns: 1,
            activeCampaigns: 1,
            totalAudience: 1,
            successRate: {
              $cond: [
                { $eq: [{ $add: ['$totalSent', '$totalFailed'] }, 0] },
                0,
                {
                  $multiply: [
                    { $divide: ['$totalSent', { $add: ['$totalSent', '$totalFailed'] }] },
                    100
                  ]
                }
              ]
            }
          }
        }
      ]),

      // Get recent campaigns with essential fields
      Campaign.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name status stats schedule createdAt')
        .lean()
    ]);

    // Format the response
    const response = {
      stats: stats[0] || {
        totalCampaigns: 0,
        activeCampaigns: 0,
        totalAudience: 0,
        successRate: 0
      },
      recentCampaigns: recentCampaigns.map(campaign => ({
        name: campaign.name,
        status: campaign.status,
        messagesSent: campaign.stats.sentCount,
        successRate: campaign.stats.successRate,
        audienceSize: campaign.stats.totalAudience,
        scheduledDate: campaign.schedule,
        createdAt: campaign.createdAt
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard statistics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getDashboardStats
}; 