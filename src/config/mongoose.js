// src/config/mongoose.js
const mongoose = require('mongoose');
const { MONGODB_URI } = process.env;

const connectToMongo = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(' Connected to MongoDB');
  } catch (err) {
    console.error(' MongoDB connection error:', err);
    process.exit(1);
  }
};

module.exports = connectToMongo;
