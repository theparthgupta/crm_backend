const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    name: {
      type: String,
      required: true
    },
    picture: {
      type: String
    },
    accessToken: {
      type: String
    },
    refreshToken: {
      type: String
    },
    lastLogin: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ googleId: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);
module.exports = User; 