const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const User = require('../models/user.model');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback' // This matches the Authorized redirect URI you set in Google Cloud
    },
    async (accessToken, refreshToken, profile, done) => {
      // Check if the user already exists in our database
      const existingUser = await User.findOne({ googleId: profile.id });

      if (existingUser) {
        // User already exists, return that user
        return done(null, existingUser);
      } else {
        // No user found, create a new user
        const newUser = await new User({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value, // Google returns an array of emails
          picture: profile.photos[0].value, // Google returns an array of photos
          accessToken: accessToken, // Store the access token if needed (be cautious with storing tokens)
          refreshToken: refreshToken // Store the refresh token if needed
        }).save();

        // Return the new user
        done(null, newUser);
      }
    }
  )
);

// Serialize user: store user ID in the session
passport.serializeUser((user, done) => {
  done(null, user.id); // user.id is the MongoDB _id
});

// Deserialize user: find user by ID from the session
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

module.exports = passport; 