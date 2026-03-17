const express = require('express');
const bcrypt = require('bcrypt');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../database/db');
const router = express.Router();

// ─── Passport: Google OAuth Strategy ────────────────────────────────────────
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
  const email = profile.emails && profile.emails[0] && profile.emails[0].value;
  if (!email) return done(null, false, { message: 'No email returned from Google.' });

  // RULE: Only allow users whose email is already in the database
  let user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);

  if (!user) {
    // Also check if they've been pre-registered and we can link by email
    return done(null, false, { message: `Access denied. Your email (${email}) is not registered in the system. Please contact the IT administrator.` });
  }

  // Link google_id if not already linked
  if (!user.google_id) {
    db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(profile.id, user.id);
    user.google_id = profile.id;
  }

  return done(null, user);
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  done(null, user || false);
});

// ─── Routes ─────────────────────────────────────────────────────────────────

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  const error = req.flash ? req.flash('error') : [];
  const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your-client-id-here');
  res.render('auth/login', { error, googleEnabled });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
  if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
    req.flash('error', 'Invalid username or password');
    return res.redirect('/login');
  }
  req.session.user = { id: user.id, username: user.username, role: user.role, name: user.name };
  const returnTo = req.session.returnTo || '/';
  delete req.session.returnTo;
  res.redirect(returnTo);
});

// ─── Google OAuth ────────────────────────────────────────────────────────────

router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', failureFlash: true }),
  (req, res) => {
    // Success — set session and redirect
    req.session.user = {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      name: req.user.name
    };
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(returnTo);
  }
);

// ─── Logout ──────────────────────────────────────────────────────────────────

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = { router, passport };
