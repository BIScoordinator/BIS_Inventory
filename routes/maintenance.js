const express = require('express');
const db = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const logs = db.prepare(`
    SELECT m.*, a.asset_code, a.model, a.brand
    FROM maintenance_logs m JOIN assets a ON m.asset_id = a.id
    ORDER BY m.date DESC LIMIT 100
  `).all();
  const assets = db.prepare("SELECT id, asset_code, model, brand FROM assets WHERE archived = 0 ORDER BY asset_code").all();
  res.render('maintenance/index', { logs, assets });
});

router.post('/', requireRole('admin', 'staff'), (req, res) => {
  const { asset_id, date, description, technician, cost, outcome } = req.body;
  if (!asset_id || !date || !description) {
    req.flash('error', 'Asset, date, and description are required');
    return res.redirect('/maintenance');
  }
  db.prepare('INSERT INTO maintenance_logs (asset_id, date, description, technician, cost, outcome) VALUES (?, ?, ?, ?, ?, ?)').run(
    asset_id, date, description, technician || null, cost || 0, outcome || 'Pending'
  );
  if (outcome === 'Repaired') {
    db.prepare("UPDATE assets SET status = 'Active', condition = 'Fair', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(asset_id);
  } else if (outcome === 'Unrepairable') {
    db.prepare("UPDATE assets SET status = 'Broken', condition = 'Poor', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(asset_id);
  } else if (req.body.set_repair === '1') {
    db.prepare("UPDATE assets SET status = 'In Repair', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(asset_id);
  }
  db.prepare('INSERT INTO activity_log (user_id, action, asset_id, details) VALUES (?, ?, ?, ?)').run(
    req.session.user.id, 'Maintenance logged', asset_id, description.substring(0, 100)
  );
  req.flash('success', 'Maintenance log added');
  res.redirect('/maintenance');
});

module.exports = router;
