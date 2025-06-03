const Joi = require('joi');
const Segment = require('../models/segment.model');
const Customer = require('../models/customer.model');
const ruleToMongoFilter = require('../utils/ruleToMongoFilter');

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
    res.json(segment);
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

module.exports = {
  previewSegment,
  saveSegment,
  getSegments,
  getSegmentById,
  updateSegment,
  deleteSegment,
};
