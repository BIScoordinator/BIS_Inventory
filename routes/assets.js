const express = require('express');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const db = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'public', 'uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)) cb(null, true);
  else cb(new Error('Only image files allowed'));
}});

// List assets
router.get('/', requireAuth, (req, res) => {
  const { category, status, location, archived } = req.query;
  const showArchived = archived === '1';
  let sql = 'SELECT * FROM assets WHERE archived = ?';
  const params = [showArchived ? 1 : 0];

  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (location) { sql += ' AND location = ?'; params.push(location); }
  sql += ' ORDER BY created_at DESC';

  const assets = db.prepare(sql).all(...params);
  const categories = db.prepare('SELECT DISTINCT category FROM assets ORDER BY category').all().map(r => r.category);
  const statuses = db.prepare('SELECT DISTINCT status FROM assets ORDER BY status').all().map(r => r.status);
  const locations = db.prepare("SELECT DISTINCT location FROM assets WHERE location IS NOT NULL AND location != '' ORDER BY location").all().map(r => r.location);

  res.render('assets/index', { assets, categories, statuses, locations, filters: { category, status, location }, showArchived });
});

// New asset form
router.get('/new', requireRole('admin', 'staff'), (req, res) => {
  res.render('assets/form', { asset: null, editing: false });
});

// Create asset
router.post('/', requireRole('admin', 'staff'), upload.single('photo'), (req, res) => {
  const b = req.body;
  const code = generateAssetCode();
  const photo = req.file ? '/uploads/' + req.file.filename : null;

  db.prepare(`INSERT INTO assets (asset_code, category, brand, model, serial_number, asset_tag, status, condition, location, assigned_to, purchase_date, warranty_expiry, purchase_price, notes, photo_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    code, b.category, b.brand, b.model, b.serial_number, b.asset_tag,
    b.status || 'Active', b.condition || 'Good', b.location, b.assigned_to,
    b.purchase_date || null, b.warranty_expiry || null, b.purchase_price || null, b.notes, photo
  );

  const asset = db.prepare('SELECT id FROM assets WHERE asset_code = ?').get(code);
  logActivity(req.session.user.id, 'Created asset', asset.id, `Created ${code}`);
  req.flash('success', `Asset ${code} created`);
  res.redirect('/assets');
});

// View asset detail
router.get('/:id', requireAuth, (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) { req.flash('error', 'Asset not found'); return res.redirect('/assets'); }

  const loans = db.prepare('SELECT * FROM loans WHERE asset_id = ? ORDER BY borrowed_date DESC').all(asset.id);
  const maintenance = db.prepare('SELECT * FROM maintenance_logs WHERE asset_id = ? ORDER BY date DESC').all(asset.id);
  const activity = db.prepare(`SELECT al.*, u.name as user_name FROM activity_log al LEFT JOIN users u ON al.user_id = u.id WHERE al.asset_id = ? ORDER BY al.created_at DESC LIMIT 20`).all(asset.id);

  res.render('assets/detail', { asset, loans, maintenance, activity });
});

// QR code for asset
router.get('/:id/qr', requireAuth, async (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).send('Not found');
  const url = `${req.protocol}://${req.get('host')}/assets/${asset.id}`;
  const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 1 });
  res.json({ qr: qrDataUrl, asset });
});

// QR print page
router.get('/:id/qr-print', requireAuth, async (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).send('Not found');
  const url = `${req.protocol}://${req.get('host')}/assets/${asset.id}`;
  const qr = await QRCode.toDataURL(url, { width: 300, margin: 1 });
  res.render('assets/qr-print', { asset, qr });
});

// Bulk QR print
router.post('/qr-bulk', requireAuth, async (req, res) => {
  const ids = req.body.ids;
  if (!ids || !ids.length) { req.flash('error', 'No assets selected'); return res.redirect('/assets'); }
  const idList = Array.isArray(ids) ? ids : [ids];
  const assets = db.prepare(`SELECT * FROM assets WHERE id IN (${idList.map(() => '?').join(',')})`).all(...idList);
  const items = [];
  for (const asset of assets) {
    const url = `${req.protocol}://${req.get('host')}/assets/${asset.id}`;
    const qr = await QRCode.toDataURL(url, { width: 200, margin: 1 });
    items.push({ asset, qr });
  }
  res.render('assets/qr-bulk', { items });
});

// Edit form
router.get('/:id/edit', requireRole('admin', 'staff'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) { req.flash('error', 'Asset not found'); return res.redirect('/assets'); }
  res.render('assets/form', { asset, editing: true });
});

// Update asset
router.post('/:id', requireRole('admin', 'staff'), upload.single('photo'), (req, res) => {
  const b = req.body;
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) { req.flash('error', 'Asset not found'); return res.redirect('/assets'); }

  const photo = req.file ? '/uploads/' + req.file.filename : asset.photo_path;

  db.prepare(`UPDATE assets SET category=?, brand=?, model=?, serial_number=?, asset_tag=?, status=?, condition=?, location=?, assigned_to=?, purchase_date=?, warranty_expiry=?, purchase_price=?, notes=?, photo_path=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
    b.category, b.brand, b.model, b.serial_number, b.asset_tag,
    b.status, b.condition, b.location, b.assigned_to,
    b.purchase_date || null, b.warranty_expiry || null, b.purchase_price || null, b.notes, photo, req.params.id
  );

  logActivity(req.session.user.id, 'Updated asset', asset.id, `Updated ${asset.asset_code}`);
  req.flash('success', `Asset ${asset.asset_code} updated`);
  res.redirect(`/assets/${req.params.id}`);
});

// Archive/unarchive
router.post('/:id/archive', requireRole('admin'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) { req.flash('error', 'Asset not found'); return res.redirect('/assets'); }
  const newVal = asset.archived ? 0 : 1;
  db.prepare('UPDATE assets SET archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newVal, req.params.id);
  logActivity(req.session.user.id, newVal ? 'Archived asset' : 'Unarchived asset', asset.id, asset.asset_code);
  req.flash('success', `Asset ${newVal ? 'archived' : 'unarchived'}`);
  res.redirect('/assets');
});

function generateAssetCode() {
  const year = new Date().getFullYear();
  const last = db.prepare("SELECT asset_code FROM assets WHERE asset_code LIKE ? ORDER BY asset_code DESC LIMIT 1").get(`BIS-${year}-%`);
  let num = 1;
  if (last) {
    const parts = last.asset_code.split('-');
    num = parseInt(parts[2], 10) + 1;
  }
  return `BIS-${year}-${String(num).padStart(3, '0')}`;
}

function logActivity(userId, action, assetId, details) {
  db.prepare('INSERT INTO activity_log (user_id, action, asset_id, details) VALUES (?, ?, ?, ?)').run(userId, action, assetId, details);
}

module.exports = router;
