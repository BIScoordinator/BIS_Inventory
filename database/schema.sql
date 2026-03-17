CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','staff','viewer')),
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_code TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  brand TEXT,
  model TEXT NOT NULL,
  serial_number TEXT,
  asset_tag TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','In Repair','Broken','Disposed','In Storage','On Loan')),
  condition TEXT DEFAULT 'Good' CHECK(condition IN ('Good','Fair','Poor')),
  location TEXT,
  assigned_to TEXT,
  purchase_date DATE,
  warranty_expiry DATE,
  purchase_price REAL,
  notes TEXT,
  photo_path TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  borrowed_by TEXT NOT NULL,
  borrowed_date DATE NOT NULL,
  expected_return DATE,
  actual_return DATE,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  technician TEXT,
  cost REAL DEFAULT 0,
  outcome TEXT DEFAULT 'Pending' CHECK(outcome IN ('Repaired','Unrepairable','Pending','Replaced')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  asset_id INTEGER REFERENCES assets(id),
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_archived ON assets(archived);
CREATE INDEX IF NOT EXISTS idx_assets_asset_code ON assets(asset_code);
CREATE INDEX IF NOT EXISTS idx_loans_asset_id ON loans(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_asset_id ON maintenance_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_activity_asset_id ON activity_log(asset_id);
