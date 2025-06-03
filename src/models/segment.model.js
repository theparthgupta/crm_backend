const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false // You can make it required later after auth
    },
    name: {
      type: String,
      required: true
    },
    rules: {
      type: mongoose.Schema.Types.Mixed, 
      required: true
    },
    audienceSize: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

const Segment = mongoose.model('Segment', segmentSchema);
module.exports = Segment;
