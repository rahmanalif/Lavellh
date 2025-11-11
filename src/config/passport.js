const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const AppleStrategy = require('passport-apple').Strategy;
const User = require('../models/User');

// Serialize user for the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists with this Google ID
        let user = await User.findOne({
          authProvider: 'google',
          providerId: profile.id
        });

        if (user) {
          // User exists, return the user
          return done(null, user);
        }

        // Check if user exists with the same email
        const existingUser = await User.findOne({
          email: profile.emails[0].value
        });

        if (existingUser) {
          // User exists with same email but different auth provider
          // You can choose to link accounts or return error
          return done(null, false, {
            message: 'An account with this email already exists. Please sign in with your original method.'
          });
        }

        // Create new user
        user = await User.create({
          fullName: profile.displayName,
          email: profile.emails[0].value,
          authProvider: 'google',
          providerId: profile.id,
          profilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
          isEmailVerified: true, // Google emails are verified
          termsAccepted: true
        });

        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

// Facebook OAuth Strategy
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL || '/api/auth/facebook/callback',
      profileFields: ['id', 'displayName', 'email', 'picture.type(large)']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists with this Facebook ID
        let user = await User.findOne({
          authProvider: 'facebook',
          providerId: profile.id
        });

        if (user) {
          // User exists, return the user
          return done(null, user);
        }

        // Check if user exists with the same email (if email provided)
        if (profile.emails && profile.emails[0]) {
          const existingUser = await User.findOne({
            email: profile.emails[0].value
          });

          if (existingUser) {
            // User exists with same email but different auth provider
            return done(null, false, {
              message: 'An account with this email already exists. Please sign in with your original method.'
            });
          }
        }

        // Create new user
        user = await User.create({
          fullName: profile.displayName || 'Facebook User',
          email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
          authProvider: 'facebook',
          providerId: profile.id,
          profilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
          isEmailVerified: profile.emails && profile.emails[0] ? true : false,
          termsAccepted: true
        });

        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

// Apple OAuth Strategy
passport.use(
  new AppleStrategy(
    {
      clientID: process.env.APPLE_SERVICE_ID,
      teamID: process.env.APPLE_TEAM_ID,
      callbackURL: process.env.APPLE_CALLBACK_URL || '/api/auth/apple/callback',
      keyID: process.env.APPLE_KEY_ID,
      privateKeyString: process.env.APPLE_PRIVATE_KEY,
      scope: ['name', 'email']
    },
    async (accessToken, refreshToken, idToken, profile, done) => {
      try {
        // Check if user already exists with this Apple ID
        let user = await User.findOne({
          authProvider: 'apple',
          providerId: profile.id
        });

        if (user) {
          // User exists, return the user
          return done(null, user);
        }

        // Check if user exists with the same email
        if (profile.email) {
          const existingUser = await User.findOne({
            email: profile.email
          });

          if (existingUser) {
            // User exists with same email but different auth provider
            return done(null, false, {
              message: 'An account with this email already exists. Please sign in with your original method.'
            });
          }
        }

        // Apple only provides name on first sign-in
        const fullName = profile.name
          ? `${profile.name.firstName || ''} ${profile.name.lastName || ''}`.trim()
          : 'Apple User';

        // Create new user
        user = await User.create({
          fullName: fullName,
          email: profile.email || null,
          authProvider: 'apple',
          providerId: profile.id,
          isEmailVerified: profile.email ? true : false,
          termsAccepted: true
        });

        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

module.exports = passport;
