#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// Initialize DB
const db = require('../database/db');

console.log('=== BIS Inventory Migration ===\n');

// 1. Create default admin user
const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existingAdmin) {
  const hash = bcrypt.hashSync('BIS@Admin2026', 10);
  db.prepare('INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)').run('admin', hash, 'admin', 'Administrator');
  console.log('Created default admin user (admin / BIS@Admin2026)');
} else {
  console.log('Admin user already exists');
}

// 2. Parse and import inventory data
const tsvPath = path.join(__dirname, '..', 'inventory_data.tsv');
if (!fs.existsSync(tsvPath)) {
  console.log('No inventory_data.tsv found, skipping data import');
  process.exit(0);
}

const tsvContent = fs.readFileSync(tsvPath, 'utf8');
const lines = tsvContent.trim().split('\n');
// Split on 2+ whitespace chars to handle variable spacing
const header = lines[0].split(/\s{2,}/).map(h => h.trim());
const rows = lines.slice(1).map(line => {
  const cols = line.split(/\s{2,}/).map(c => c.trim());
  const obj = {};
  header.forEach((h, i) => obj[h] = cols[i] || '');
  return obj;
});

console.log(`\nParsed ${rows.length} models from TSV\n`);

// Category inference
function inferCategory(model) {
  const m = model.toLowerCase();
  if (m.includes('mba') || m.includes('mbp') || m.includes('e7') || m.includes('e205') || m.includes('v3-') || m.includes('s3-') || m.includes('gl752')) return 'Laptop';
  if (m.includes('imac')) return 'Desktop';
  if (m.includes('macmini') || m.includes('mac mini')) return 'Desktop';
  if (m.includes('d3') || m.includes('d5') || m.includes('20-') || m.includes('310-') || m.includes('df1')) return 'Desktop';
  if (m.includes('rs')) return 'Printer';
  return 'Other';
}

// Brand inference
function inferBrand(model) {
  const m = model.toLowerCase();
  if (m.includes('mba') || m.includes('mbp') || m.includes('imac') || m.includes('macmini')) return 'Apple';
  if (m.includes('e7')) return 'Dell';
  if (m.includes('e205')) return 'ASUS';
  if (m.includes('v3-') || m.includes('s3-')) return 'Acer';
  if (m.includes('gl752')) return 'ASUS';
  if (m.includes('d3') || m.includes('d5')) return 'Dell';
  if (m.includes('20-') || m.includes('310-')) return 'Lenovo';
  if (m.includes('df1')) return 'HP';
  if (m.includes('rs')) return 'Epson';
  return '';
}

// Parse purchase date from "Month, YYYY" format
function parsePurchaseDate(dateStr) {
  if (!dateStr) return null;
  const months = { january:1, february:2, march:3, april:4, may:5, june:6, july:7, august:8, september:9, october:10, november:11, december:12 };
  const match = dateStr.match(/(\w+),?\s*(\d{4})/);
  if (!match) return null;
  const month = months[match[1].toLowerCase()];
  const year = parseInt(match[2]);
  if (!month || !year) return null;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

// Asset code counter - find max existing
let codeCounter = {};
function getNextCode(year) {
  if (!codeCounter[year]) {
    const last = db.prepare("SELECT asset_code FROM assets WHERE asset_code LIKE ? ORDER BY asset_code DESC LIMIT 1").get(`BIS-${year}-%`);
    if (last) {
      codeCounter[year] = parseInt(last.asset_code.split('-')[2], 10);
    } else {
      codeCounter[year] = 0;
    }
  }
  codeCounter[year]++;
  return `BIS-${year}-${String(codeCounter[year]).padStart(3, '0')}`;
}

// Check if we already have data
const existingCount = db.prepare('SELECT COUNT(*) as c FROM assets').get().c;
if (existingCount > 0) {
  console.log(`Database already has ${existingCount} assets. Skipping import.`);
  console.log('\nMigration complete!');
  process.exit(0);
}

const insertAsset = db.prepare(`INSERT INTO assets (asset_code, category, brand, model, status, condition, purchase_date, notes, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`);

const insertMany = db.transaction(() => {
  let totalCreated = 0;

  for (const row of rows) {
    const model = row.Model;
    const qty = parseInt(row.Qtty) || 0;
    const used = parseInt(row.Used) || 0;
    const broken = parseInt(row.Broken) || 0;
    const stock = parseInt(row.Stock) || 0;
    const purchaseDate = parsePurchaseDate(row.DoP);
    const category = inferCategory(model);
    const brand = inferBrand(model);

    if (qty === 0 && used === 0 && broken === 0 && stock === 0) continue;

    // Determine purchase year for asset code
    const purchaseYear = purchaseDate ? purchaseDate.substring(0, 4) : '2020';

    // Determine condition based on age
    const ageYears = parseFloat(row.Old) || 0;
    const condition = ageYears > 8 ? 'Poor' : ageYears > 4 ? 'Fair' : 'Good';

    // Create individual assets
    // "Used" count -> Active
    for (let i = 0; i < used; i++) {
      const code = getNextCode(purchaseYear);
      insertAsset.run(code, category, brand, model, 'Active', condition, purchaseDate, `Migrated from inventory data`);
      totalCreated++;
    }

    // "Stock" count -> In Storage
    for (let i = 0; i < stock; i++) {
      const code = getNextCode(purchaseYear);
      insertAsset.run(code, category, brand, model, 'In Storage', condition, purchaseDate, `Migrated from inventory data`);
      totalCreated++;
    }

    // "Broken" count -> Broken
    for (let i = 0; i < broken; i++) {
      const code = getNextCode(purchaseYear);
      insertAsset.run(code, category, brand, model, 'Broken', 'Poor', purchaseDate, `Migrated from inventory data`);
      totalCreated++;
    }

    // Remaining (Qtty - Used - Broken - Stock) -> In Storage
    const remaining = qty - used - broken - stock;
    for (let i = 0; i < remaining; i++) {
      const code = getNextCode(purchaseYear);
      insertAsset.run(code, category, brand, model, 'In Storage', condition, purchaseDate, `Migrated from inventory data`);
      totalCreated++;
    }

    console.log(`  ${model}: ${qty} total → ${used} active, ${broken} broken, ${stock} stock, ${Math.max(0, remaining)} remaining`);
  }

  return totalCreated;
});

const totalCreated = insertMany();
console.log(`\nCreated ${totalCreated} individual asset records`);

// Log migration activity
db.prepare('INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)').run(
  1, 'Data migration', `Imported ${totalCreated} assets from inventory_data.tsv`
);

console.log('\nMigration complete!');
console.log(`\nStart the server with: node server.js`);
console.log(`Login at http://localhost:3000 with admin / BIS@Admin2026`);
