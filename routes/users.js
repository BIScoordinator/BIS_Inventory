const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../database/db');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

// List users
router.get('/', requireRole('admin'), (req, res) => {
  const users = db.prepare('SELECT id, username, role, name, email, google_id, active, created_at FROM users ORDER BY created_at DESC').all();
  res.render('admin/users', { users });
});

// Create user — password optional (Google-only users just need email + name + role)
router.post('/', requireRole('admin'), (req, res) => {
  const { name, email, role, password } = req.body;

  if (!name || !email) {
    req.flash('error', 'Name and email are required');
    return res.redirect('/admin/users');
  }

  // Check email uniqueness
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) {
    req.flash('error', 'A user with that email already exists');
    return res.redirect('/admin/users');
  }

  // Generate a username from email if not provided
  const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '.');

  const hash = password && password.trim() ? bcrypt.hashSync(password, 10) : null;

  db.prepare('INSERT INTO users (username, password_hash, role, name, email) VALUES (?, ?, ?, ?, ?)').run(
    username, hash, role || 'viewer', name, email.toLowerCase().trim()
  );

  req.flash('success', `User ${name} added — they can now sign in with Google using ${email}`);
  res.redirect('/admin/users');
});

// Update user
router.post('/:id', requireRole('admin'), (req, res) => {
  const { role, name, email, password, active } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) { req.flash('error', 'User not found'); return res.redirect('/admin/users'); }

  const newEmail = email ? email.toLowerCase().trim() : user.email;
  const isActive = active === 'on' ? 1 : 0;

  if (password && password.trim()) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ?, role = ?, name = ?, email = ?, active = ? WHERE id = ?')
      .run(hash, role, name, newEmail, isActive, req.params.id);
  } else {
    db.prepare('UPDATE users SET role = ?, name = ?, email = ?, active = ? WHERE id = ?')
      .run(role, name, newEmail, isActive, req.params.id);
  }

  req.flash('success', 'User updated');
  res.redirect('/admin/users');
});

module.exports = router;
