const express = require('express');
const router = express.Router();
const { previewSegment, saveSegment, getSegments, getSegmentById, generateRulesFromNl, updateSegment, deleteSegment } = require('../controllers/segment.controller');
const { ensureAuthenticated } = require('../middleware/auth');

// Apply authentication middleware to all segment routes
router.use(ensureAuthenticated);

router.post('/preview', previewSegment);
router.post('/generate-rules', generateRulesFromNl);
router.post('/', saveSegment);
router.get('/', getSegments);
router.get('/:id', getSegmentById);
router.put('/:id', updateSegment);
router.delete('/:id', deleteSegment);

module.exports = router;
