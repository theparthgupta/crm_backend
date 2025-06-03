require('dotenv').config();
const express = require('express');
const connectToMongo = require('./config/mongoose');
const session = require('express-session');
const passport = require('passport');
require('./config/passport');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());

const ingestionRoutes = require('./routes/ingestion.routes');
app.use('/api/ingest', ingestionRoutes);

// Health check 
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

connectToMongo().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
  });
});

const segmentRoutes = require('./routes/segment.routes');
app.use('/api/segments', segmentRoutes);

const campaignRoutes = require('./routes/campaign.routes');
app.use('/api/campaigns', campaignRoutes);

const deliveryReceiptRoutes = require('./routes/deliveryReceipt.routes');
app.use('/api/delivery-receipts', deliveryReceiptRoutes);

app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

app.get('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

const { startScheduler } = require('./scheduler/campaignScheduler');
startScheduler();

