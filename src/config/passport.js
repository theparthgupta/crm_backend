const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const User = require('../models/user.model');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
      proxy: true // Add this to handle proxy settings
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if the user already exists in our database
        const existingUser = await User.findOne({ googleId: profile.id });

        if (existingUser) {
          // Update last login time
          existingUser.lastLogin = new Date();
          await existingUser.save();
          return done(null, existingUser);
        }

        // No user found, create a new user
        const newUser = await new User({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          picture: profile.photos[0].value,
          accessToken: accessToken,
          refreshToken: refreshToken,
          lastLogin: new Date()
        }).save();

        return done(null, newUser);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// Serialize user: store user ID in the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user: find user by ID from the session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport; 