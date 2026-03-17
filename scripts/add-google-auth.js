// Migration: add email + google_id columns to users table
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './database/bis_inventory.db';
const db = new Database(path.resolve(dbPath));

console.log('Running Google Auth migration...');

// Check existing columns
const cols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
console.log('Existing columns:', cols.join(', '));

// Add email column (without UNIQUE — we'll add index separately)
if (!cols.includes('email')) {
  db.exec("ALTER TABLE users ADD COLUMN email TEXT");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL");
  console.log('✅ Added column: email + unique index');
} else {
  console.log('ℹ️  email column already exists');
}

// Add google_id column
if (!cols.includes('google_id')) {
  db.exec("ALTER TABLE users ADD COLUMN google_id TEXT");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL");
  console.log('✅ Added column: google_id + unique index');
} else {
  console.log('ℹ️  google_id column already exists');
}

console.log('✅ Migration complete!');
db.close();
