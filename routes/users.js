const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../database/db');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireRole('admin'), (req, res) => {
  const users = db.prepare('SELECT id, username, role, name, active, created_at FROM users ORDER BY created_at DESC').all();
  res.render('admin/users', { users });
});

router.post('/', requireRole('admin'), (req, res) => {
  const { username, password, role, name } = req.body;
  if (!username || !password || !name) {
    req.flash('error', 'All fields are required');
    return res.redirect('/admin/users');
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    req.flash('error', 'Username already exists');
    return res.redirect('/admin/users');
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)').run(username, hash, role || 'viewer', name);
  req.flash('success', 'User created');
  res.redirect('/admin/users');
});

router.post('/:id', requireRole('admin'), (req, res) => {
  const { role, name, password, active } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) { req.flash('error', 'User not found'); return res.redirect('/admin/users'); }

  if (password && password.trim()) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ?, role = ?, name = ?, active = ? WHERE id = ?').run(hash, role, name, active === 'on' ? 1 : 0, req.params.id);
  } else {
    db.prepare('UPDATE users SET role = ?, name = ?, active = ? WHERE id = ?').run(role, name, active === 'on' ? 1 : 0, req.params.id);
  }
  req.flash('success', 'User updated');
  res.redirect('/admin/users');
});

module.exports = router;
