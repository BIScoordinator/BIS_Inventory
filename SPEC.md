# BIS Inventory System — Build Spec

## What to build
A web-based IT asset inventory management system for Bali Island School (BIS).

## Stack
- Backend: Node.js + Express.js
- Database: SQLite (via better-sqlite3)
- Frontend: Vanilla HTML + Bootstrap 5 + DataTables.js + Chart.js
- Auth: express-session + bcrypt
- QR codes: qrcode npm package
- PDF: pdfkit
- CSV export: json2csv
- Process manager: pm2

## Database Schema

### assets
- id, asset_code (BIS-YYYY-NNN), category, brand, model, serial_number, asset_tag
- status (Active | In Repair | Broken | Disposed | In Storage | On Loan)
- condition (Good | Fair | Poor)
- location, assigned_to, purchase_date, warranty_expiry, purchase_price, notes
- photo_path (path to uploaded photo)
- archived (boolean, default false)
- created_at, updated_at

### loans
- id, asset_id, borrowed_by, borrowed_date, expected_return, actual_return, notes, created_by, created_at

### maintenance_logs
- id, asset_id, date, description, technician, cost, outcome (Repaired | Unrepairable | Pending | Replaced), created_at

### users
- id, username, password_hash, role (admin | staff | viewer), name, created_at

### activity_log
- id, user_id, action, asset_id, details, created_at

## Features

### 1. Dashboard (/)
- KPI cards: Total Assets, Active, Broken, On Loan, In Storage
- Chart.js doughnut: assets by category
- Chart.js bar: assets by status
- Recent activity feed (last 10 actions)

### 2. Assets (/assets)
- DataTables table with: Asset Code, Category, Brand/Model, Status, Location, Assigned To, Age, Actions
- Filter by: category, status, location
- Search across all fields
- Actions: View, Edit, Archive, Generate QR, Checkout
- Archived assets in SEPARATE tab (not mixed with active)

### 3. Asset Detail (/assets/:id)
- Full info display
- QR code (printable)
- Loan history
- Maintenance history
- Activity log for this asset
- Photo upload/display

### 4. Add/Edit Asset (/assets/new, /assets/:id/edit)
- Full form with all fields
- Photo upload
- Validation

### 5. Loans/Checkout (/loans)
- Checkout form: select asset, borrower name, expected return date
- Check-in button on active loans
- Overdue loans highlighted in red
- Full loan history

### 6. Maintenance (/maintenance)
- Log repair/service events per asset
- Fields: date, description, technician, cost, outcome
- History view per asset

### 7. Reports (/reports)
- Export all assets → CSV and PDF
- Export by category, status
- Overdue loans report
- Assets by age / lifecycle report (lifecycle = 5 years for laptops)
- On-screen report preview before download

### 8. QR Codes
- Generate QR per asset linking to /assets/:asset_code
- Print page with QR label grid (4x per page, with asset code + model printed below QR)

### 9. Users (/admin/users) — Admin only
- List users, add/edit/deactivate
- Roles: admin (full), staff (view + checkout + maintenance), viewer (read-only)

### 10. Authentication
- Login page (clean, BIS branded)
- Session-based auth
- Default admin: username=admin, password=BIS@Admin2026

## UI Design
- Clean, professional, school-appropriate
- Bootstrap 5 with a blue/white color scheme (#1a5276 primary)
- Sidebar navigation
- Responsive (works on tablets too)
- Font Awesome icons for actions
- Toast notifications for success/error feedback

## Data Migration
The file `inventory_data.tsv` contains existing BIS hardware data with columns:
Model, Qtty, Used, Broken, DoP (Date of Purchase), Old (age years), Stock

Migration script (`scripts/migrate.js`) should:
- Parse TSV file
- For each model row, create individual asset records:
  - "Used" count → status: Active
  - "Stock" count → status: In Storage  
  - "Broken" count → status: Broken
  - Remaining (Qtty - Used - Broken - Stock) → status: In Storage
- Auto-generate asset codes: BIS-[YEAR]-[NNN]
- Infer category from model name (MBA/MBP = Laptop, iMac/D* = Desktop, etc.)
- Parse purchase date from "Month, YYYY" format

## Project Structure
```
bis-inventory/
├── server.js
├── package.json
├── .env
├── database/
│   ├── schema.sql
│   ├── db.js
│   └── bis_inventory.db
├── routes/
│   ├── assets.js
│   ├── loans.js
│   ├── maintenance.js
│   ├── reports.js
│   ├── users.js
│   └── auth.js
├── middleware/
│   └── auth.js
├── public/
│   ├── css/app.css
│   ├── js/app.js
│   └── uploads/ (photos)
├── views/
│   ├── partials/ (header, sidebar, footer)
│   ├── dashboard.html
│   ├── assets/
│   ├── loans/
│   ├── maintenance/
│   ├── reports/
│   ├── admin/
│   └── auth/login.html
├── scripts/
│   └── migrate.js
└── README.md
```

## When finished
1. Run `npm install` and `node scripts/migrate.js` to seed data
2. Start with `node server.js` on port 3000
3. Verify it works at http://localhost:3000
4. Run: openclaw system event --text "Done: BIS inventory system built and running at http://localhost:3000 — login: admin / BIS@Admin2026" --mode now
