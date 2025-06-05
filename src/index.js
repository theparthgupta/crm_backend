require('dotenv').config();
const express = require('express');
const connectToMongo = require('./config/mongoose');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
require('./config/passport');

const app = express();
const PORT = process.env.PORT || 4000;

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth.routes');
const customerRoutes = require('./routes/customer.routes');
const segmentRoutes = require('./routes/segment.routes');
const campaignRoutes = require('./routes/campaign.routes');
const ingestionRoutes = require('./routes/ingestion.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const deliveryReceiptRoutes = require('./routes/deliveryReceipt.routes');

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/segments', segmentRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/ingest', ingestionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/delivery-receipts', deliveryReceiptRoutes);

// Health check 
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start scheduler
const { startScheduler } = require('./scheduler/campaignScheduler');
startScheduler();

// Connect to MongoDB and start server
connectToMongo().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
  });
});

app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: process.env.FRONTEND_URL || 'http://localhost:3000' }),
  (req, res) => {
    // Redirect to frontend dashboard
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/campaigns`);
  }
);

app.get('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
  });
});

// Authentication check endpoint
app.get('/api/auth/check', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true
    });
  } else {
    res.status(401).json({
      authenticated: false,
      message: 'Not authenticated'
    });
  }
});

// Get current user details
app.get('/api/auth/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        picture: req.user.picture
      }
    });
  } else {
    res.status(401).json({
      authenticated: false,
      message: 'Not authenticated'
    });
  }
});

