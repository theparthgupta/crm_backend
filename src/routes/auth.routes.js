const express = require('express');
const router = express.Router();
const passport = require('passport');
const { ensureAuthenticated } = require('../middleware/auth');

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: process.env.FRONTEND_URL || 'http://localhost:3000' 
  }),
  (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/campaigns`);
  }
);

// Logout route
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { 
      console.error('Logout error:', err);
      return res.status(500).json({ message: 'Logout failed' });
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      // Clear the session cookie (replace 'connect.sid' if you have a custom cookie name)
      res.clearCookie('connect.sid'); 
      res.status(200).json({ message: 'Logged out successfully' });
    });
  });
});

// Authentication check endpoint
router.get('/check', (req, res) => {
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
router.get('/me', ensureAuthenticated, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      picture: req.user.picture
    }
  });
});

module.exports = router; 