require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads dir
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'bis-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(flash());

// Passport (Google OAuth)
const { router: authRouter, passport } = require('./routes/auth');
app.use(passport.initialize());
app.use(passport.session());

const { requireAuth, setLocals } = require('./middleware/auth');
app.use(setLocals);

// Routes
app.use('/', authRouter);

const db = require('./database/db');

// Dashboard
app.get('/', requireAuth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM assets WHERE archived = 0').get().c;
  const active = db.prepare("SELECT COUNT(*) as c FROM assets WHERE status = 'Active' AND archived = 0").get().c;
  const broken = db.prepare("SELECT COUNT(*) as c FROM assets WHERE status = 'Broken' AND archived = 0").get().c;
  const onLoan = db.prepare("SELECT COUNT(*) as c FROM assets WHERE status = 'On Loan' AND archived = 0").get().c;
  const inStorage = db.prepare("SELECT COUNT(*) as c FROM assets WHERE status = 'In Storage' AND archived = 0").get().c;
  const inRepair = db.prepare("SELECT COUNT(*) as c FROM assets WHERE status = 'In Repair' AND archived = 0").get().c;

  const byCategory = db.prepare('SELECT category, COUNT(*) as count FROM assets WHERE archived = 0 GROUP BY category ORDER BY count DESC').all();
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM assets WHERE archived = 0 GROUP BY status ORDER BY count DESC').all();
  const recentActivity = db.prepare(`SELECT al.*, u.name as user_name, a.asset_code FROM activity_log al LEFT JOIN users u ON al.user_id = u.id LEFT JOIN assets a ON al.asset_id = a.id ORDER BY al.created_at DESC LIMIT 10`).all();

  res.render('dashboard', { total, active, broken, onLoan, inStorage, inRepair, byCategory, byStatus, recentActivity });
});

app.use('/assets', require('./routes/assets'));
app.use('/loans', require('./routes/loans'));
app.use('/maintenance', require('./routes/maintenance'));
app.use('/reports', require('./routes/reports'));
app.use('/admin/users', require('./routes/users'));

// Lookup by asset_code (for QR scanning)
app.get('/lookup/:code', requireAuth, (req, res) => {
  const asset = db.prepare('SELECT id FROM assets WHERE asset_code = ?').get(req.params.code);
  if (asset) return res.redirect(`/assets/${asset.id}`);
  req.flash('error', 'Asset not found');
  res.redirect('/assets');
});

app.listen(PORT, () => console.log(`BIS Inventory running on http://localhost:${PORT}`));
