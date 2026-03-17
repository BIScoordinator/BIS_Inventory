const express = require('express');
const db = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const activeLoans = db.prepare(`
    SELECT l.*, a.asset_code, a.model, a.brand, a.category
    FROM loans l JOIN assets a ON l.asset_id = a.id
    WHERE l.actual_return IS NULL ORDER BY l.borrowed_date DESC
  `).all();
  const pastLoans = db.prepare(`
    SELECT l.*, a.asset_code, a.model, a.brand, a.category
    FROM loans l JOIN assets a ON l.asset_id = a.id
    WHERE l.actual_return IS NOT NULL ORDER BY l.actual_return DESC LIMIT 50
  `).all();
  const availableAssets = db.prepare("SELECT id, asset_code, model, brand FROM assets WHERE status IN ('Active','In Storage') AND archived = 0 ORDER BY asset_code").all();
  res.render('loans/index', { activeLoans, pastLoans, availableAssets });
});

// Checkout
router.post('/checkout', requireRole('admin', 'staff'), (req, res) => {
  const { asset_id, borrowed_by, expected_return, notes } = req.body;
  if (!asset_id || !borrowed_by) {
    req.flash('error', 'Asset and borrower are required');
    return res.redirect('/loans');
  }
  db.prepare('INSERT INTO loans (asset_id, borrowed_by, borrowed_date, expected_return, notes, created_by) VALUES (?, ?, date("now"), ?, ?, ?)').run(
    asset_id, borrowed_by, expected_return || null, notes || null, req.session.user.id
  );
  db.prepare("UPDATE assets SET status = 'On Loan', assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(borrowed_by, asset_id);
  db.prepare('INSERT INTO activity_log (user_id, action, asset_id, details) VALUES (?, ?, ?, ?)').run(
    req.session.user.id, 'Checked out', asset_id, `Loaned to ${borrowed_by}`
  );
  req.flash('success', 'Asset checked out');
  res.redirect('/loans');
});

// Check-in
router.post('/:id/checkin', requireRole('admin', 'staff'), (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ? AND actual_return IS NULL').get(req.params.id);
  if (!loan) { req.flash('error', 'Loan not found'); return res.redirect('/loans'); }
  db.prepare('UPDATE loans SET actual_return = date("now") WHERE id = ?').run(req.params.id);
  db.prepare("UPDATE assets SET status = 'Active', assigned_to = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(loan.asset_id);
  db.prepare('INSERT INTO activity_log (user_id, action, asset_id, details) VALUES (?, ?, ?, ?)').run(
    req.session.user.id, 'Checked in', loan.asset_id, `Returned by ${loan.borrowed_by}`
  );
  req.flash('success', 'Asset checked in');
  res.redirect('/loans');
});

module.exports = router;
