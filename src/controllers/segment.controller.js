const Joi = require('joi');
const Segment = require('../models/segment.model');
const Customer = require('../models/customer.model');
const ruleToMongoFilter = require('../utils/ruleToMongoFilter');
const { generateSegmentRules } = require('../services/aiService'); // Import AI service for rule generation

// Joi schema for segment rules (allowing flexible structure)
const rulesSchema = Joi.object();

// Schema for saving a segment
const saveSegmentSchema = Joi.object({
  name: Joi.string().required(),
  rules: rulesSchema.required(),
});

// Schema for updating a segment
const updateSegmentSchema = Joi.object({
  name: Joi.string().optional(),
  rules: rulesSchema.optional(),
});

// Schema for natural language query
const nlQuerySchema = Joi.object({
  query: Joi.string().required()
});

// Preview audience size for a given set of rules
const previewSegment = async (req, res) => {
  const { error, value } = rulesSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const filter = ruleToMongoFilter(value);
    const audienceSize = await Customer.countDocuments(filter);
    res.json({ audienceSize });
  } catch (err) {
    console.error('Error previewing segment:', err);
    res.status(500).json({ error: 'Failed to preview segment' });
  }
};

// Save a new segment
const saveSegment = async (req, res) => {
  const { error, value } = saveSegmentSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    // Associate segment with the logged-in user
    const segment = new Segment({
      userId: req.user._id, // Get user ID from authenticated request
      name: value.name,
      rules: value.rules,
    });

    // Calculate audience size before saving (optional but good for UX)
    const filter = ruleToMongoFilter(value.rules);
    segment.audienceSize = await Customer.countDocuments(filter);

    await segment.save();
    res.status(201).json(segment);
  } catch (err) {
    console.error('Error saving segment:', err);
    res.status(500).json({ error: 'Failed to save segment' });
  }
};

// Get all segments for the logged-in user
const getSegments = async (req, res) => {
  try {
    // Filter segments by the logged-in user's ID
    const segments = await Segment.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(segments);
  } catch (err) {
    console.error('Error fetching segments:', err);
    res.status(500).json({ error: 'Failed to fetch segments' });
  }
};

// Get a specific segment by ID for the logged-in user
const getSegmentById = async (req, res) => {
  try {
    // Find segment by ID and ensure it belongs to the logged-in user
    const segment = await Segment.findOne({ _id: req.params.id, userId: req.user._id });

    if (!segment) {
      return res.status(404).json({ error: 'Segment not found or not authorized' });
    }

    // Calculate current audience size based on rules
    const filter = ruleToMongoFilter(segment.rules);
    const currentAudienceSize = await Customer.countDocuments(filter);

    // Return segment details with the calculated audience size
    res.json({
        ...segment.toObject(), // Convert Mongoose document to plain object
        audienceSize: currentAudienceSize // Override or add the calculated size
    });

  } catch (err) {
    console.error('Error fetching segment:', err);
    res.status(500).json({ error: 'Failed to fetch segment' });
  }
};

// Update a segment for the logged-in user
const updateSegment = async (req, res) => {
  const { error, value } = updateSegmentSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    // Find and update segment by ID, ensuring it belongs to the logged-in user
    const segment = await Segment.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      value,
      { new: true }
    );

    if (!segment) {
      return res.status(404).json({ error: 'Segment not found or not authorized' });
    }

    // Recalculate audience size if rules were updated
    if (value.rules) {
        const filter = ruleToMongoFilter(segment.rules);
        segment.audienceSize = await Customer.countDocuments(filter);
        await segment.save(); // Save again to update audienceSize
    }

    res.json(segment);
  } catch (err) {
    console.error('Error updating segment:', err);
    res.status(500).json({ error: 'Failed to update segment' });
  }
};

// Delete a segment for the logged-in user
const deleteSegment = async (req, res) => {
  try {
    // Find and delete segment by ID, ensuring it belongs to the logged-in user
    const segment = await Segment.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

    if (!segment) {
      return res.status(404).json({ error: 'Segment not found or not authorized' });
    }
    res.json({ message: 'Segment deleted successfully' });
  } catch (err) {
    console.error('Error deleting segment:', err);
    res.status(500).json({ error: 'Failed to delete segment' });
  }
};

// Generate segment rules from natural language
const generateRulesFromNl = async (req, res) => {
  const { error, value } = nlQuerySchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const nlQuery = value.query;
    const generatedRules = await generateSegmentRules(nlQuery);

    if (!generatedRules) {
      return res.status(500).json({ error: 'Could not generate rules from natural language.' });
    }

    // Handle date placeholders for 'since' operator
    // This is a basic example; a more robust solution might be needed
    const replaceDatePlaceholders = (rules) => {
        if (!rules || !rules.rules || !Array.isArray(rules.rules)) return rules;

        rules.rules = rules.rules.map(rule => {
            if (rule.operator === 'since' && typeof rule.value === 'string' && rule.value.startsWith('PAST_DATE_') && rule.value.endsWith('_ISO')) {
                // Extract time period from placeholder (e.g., '6_MONTHS', '90_DAYS')
                const periodPlaceholder = rule.value.substring(10, rule.value.length - 4); 
                let date = new Date();

                if (periodPlaceholder.endsWith('_MONTHS')) {
                    const months = parseInt(periodPlaceholder.split('_')[0], 10);
                    date.setMonth(date.getMonth() - months);
                } else if (periodPlaceholder.endsWith('_DAYS')) {
                    const days = parseInt(periodPlaceholder.split('_')[0], 10);
                    date.setDate(date.getDate() - days);
                } 
                // Add more date logic here for other units (years, etc.) if needed
                
                // Use start of day for consistency
                date.setHours(0, 0, 0, 0);
                rule.value = date.toISOString(); // Replace placeholder with ISO string
            }
            // Recursively process nested rules if applicable
            if (rule.operator && rule.rules) {
                replaceDatePlaceholders(rule);
            }
            return rule;
        });
        return rules;
    };

    const finalRules = replaceDatePlaceholders(generatedRules);

    res.json({ rules: finalRules });

  } catch (err) {
    console.error('Error generating rules from NL:', err);
    res.status(500).json({ error: 'Failed to generate rules from natural language' });
  }
};

module.exports = {
  previewSegment,
  saveSegment,
  getSegments,
  getSegmentById,
  updateSegment,
  deleteSegment,
  generateRulesFromNl // Export the new function
};
