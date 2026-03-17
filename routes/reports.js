const express = require('express');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const totalAssets = db.prepare('SELECT COUNT(*) as c FROM assets WHERE archived = 0').get().c;
  const byCategory = db.prepare('SELECT category, COUNT(*) as count FROM assets WHERE archived = 0 GROUP BY category ORDER BY count DESC').all();
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM assets WHERE archived = 0 GROUP BY status ORDER BY count DESC').all();
  const overdueLoans = db.prepare(`SELECT l.*, a.asset_code, a.model FROM loans l JOIN assets a ON l.asset_id = a.id WHERE l.actual_return IS NULL AND l.expected_return < date('now') ORDER BY l.expected_return`).all();
  const agingAssets = db.prepare(`SELECT *, ROUND(julianday('now') - julianday(purchase_date)) / 365.25 as age_years FROM assets WHERE archived = 0 AND purchase_date IS NOT NULL ORDER BY purchase_date ASC LIMIT 50`).all();
  res.render('reports/index', { totalAssets, byCategory, byStatus, overdueLoans, agingAssets });
});

// CSV export
router.get('/export/csv', requireAuth, (req, res) => {
  const { category, status } = req.query;
  let sql = 'SELECT asset_code, category, brand, model, serial_number, status, condition, location, assigned_to, purchase_date, warranty_expiry, purchase_price, notes FROM assets WHERE archived = 0';
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY asset_code';

  const assets = db.prepare(sql).all(...params);
  const parser = new Parser();
  const csv = parser.parse(assets);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=bis-assets-${Date.now()}.csv`);
  res.send(csv);
});

// PDF export
router.get('/export/pdf', requireAuth, (req, res) => {
  const { category, status } = req.query;
  let sql = 'SELECT * FROM assets WHERE archived = 0';
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY asset_code';

  const assets = db.prepare(sql).all(...params);
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=bis-assets-${Date.now()}.pdf`);
  doc.pipe(res);

  doc.fontSize(18).text('BIS Inventory Report', { align: 'center' });
  doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()} | Total: ${assets.length} assets`, { align: 'center' });
  doc.moveDown();

  const headers = ['Asset Code', 'Category', 'Brand', 'Model', 'Status', 'Location', 'Purchase Date'];
  const colWidths = [90, 70, 70, 100, 70, 90, 80];
  let y = doc.y;
  let x = 40;

  // Header row
  doc.font('Helvetica-Bold').fontSize(8);
  headers.forEach((h, i) => { doc.text(h, x, y, { width: colWidths[i] }); x += colWidths[i] + 10; });
  y += 15;
  doc.moveTo(40, y).lineTo(760, y).stroke();
  y += 5;

  doc.font('Helvetica').fontSize(7);
  for (const a of assets) {
    if (y > 540) { doc.addPage(); y = 40; }
    x = 40;
    const row = [a.asset_code, a.category, a.brand || '', a.model, a.status, a.location || '', a.purchase_date || ''];
    row.forEach((val, i) => { doc.text(val, x, y, { width: colWidths[i] }); x += colWidths[i] + 10; });
    y += 14;
  }

  doc.end();
});

// Overdue loans report
router.get('/overdue', requireAuth, (req, res) => {
  const overdueLoans = db.prepare(`SELECT l.*, a.asset_code, a.model, a.brand FROM loans l JOIN assets a ON l.asset_id = a.id WHERE l.actual_return IS NULL AND l.expected_return < date('now') ORDER BY l.expected_return`).all();
  res.json(overdueLoans);
});

module.exports = router;
