# Vendor Rate Management Portal v2.0

Enterprise multi-vendor shipping rate management, workbook import parser, calculation engine, and RESTful API suite deployed on Hostinger for Prince Express.

---

## What's New in v2.0

- **Modular Enterprise Architecture**: Replaced the legacy monolithic `index.php` with a sleek SPA-like shell and modular page controllers.
- **Dynamic Worksheet Detection**: Intelligently identifies and isolates Regular rates, Zonewise tariffs, Postcode-to-Zone mappings, and Service availability tabs.
- **Dedicated Calculation Engine (`includes/calculator.php`)**: Full support for base weight slabs, additional increments (e.g. 500 Gms + Addl 500 Gms), ceiling rounding, and automatic postcode-to-zone resolution.
- **Inline Rate Editor & Audit Logging**: Real-time rate adjustments with full audit history tracking in `rate_audit_log`.
- **Version Control & Rollbacks**: Multi-version imports with active version flags (`is_latest`) and one-click rollback capabilities.
- **Comprehensive REST API Suite**: Added `/api/calculate.php`, `/api/vendors.php`, `/api/sheets.php`, `/api/zones.php`, and upgraded `/api/rates.php` to full CRUD while preserving 100% backward compatibility for existing callers.
- **Interactive API Console & Sandbox**: Test live API queries directly from the admin dashboard with copyable cURL commands.
- **Automated Test Suite (`tests/test_suite.php`)**: Integrated unit and regression runner for parser logic, rate math, and security.

---

## Directory Structure

```
rates/
├── config.php              # DB credentials, admin password, API key (NEVER exposed)
├── composer.json           # PhpSpreadsheet dependencies
├── .htaccess               # Protects config, SQL, storage, and includes from direct HTTP access
├── index.php               # Modern application router & dashboard shell
├── database.sql            # Original schema (preserved)
├── migration.sql           # Additive database migration (safe to apply on live data)
│
├── includes/
│   ├── db.php              # PDO database singleton
│   ├── auth.php            # Session auth and API key verification
│   ├── helpers.php         # String, slug, rate formatters, and audit logging
│   ├── import.php          # PhpSpreadsheet workbook importer and tab classifier
│   └── calculator.php      # Slabs, incremental charges, and zone calculation engine
│
├── pages/
│   ├── dashboard.php       # Metrics, quick upload, and recent activity
│   ├── vendors.php         # Vendor catalog and status toggles
│   ├── vendor_detail.php   # Dynamic worksheet tabs, inline editor, and version history
│   ├── rate_calculator.php # Interactive rate calculation form
│   ├── rate_management.php # Global rate table filter and editor
│   ├── import_history.php  # Upload audit log, status filter, and version promotion
│   ├── api_docs.php        # Interactive API documentation and sandbox
│   ├── settings.php        # Diagnostics, table integrity, and one-click migration
│   └── _pagination.php     # Reusable pagination partial
│
├── api/
│   ├── _middleware.php     # CORS headers, JSON helpers, and authentication
│   ├── rates.php           # Upgraded rates CRUD (100% backward-compatible GET)
│   ├── calculate.php       # Dedicated calculation endpoint with full breakdown
│   ├── vendors.php         # Vendor listing, creation, and updates
│   ├── sheets.php          # Worksheet metadata and row retrieval
│   └── zones.php           # Postcode-to-zone resolver
│
├── assets/
│   ├── css/
│   │   └── app.css         # Enterprise dark-navy design system
│   └── js/
│       └── app.js          # Interactive tables, sorting, search, modals, and toasts
│
├── storage/
│   ├── uploads/            # Stored workbook files (.xlsx, .xls, .csv)
│   └── php-errors.log      # Application error log
│
└── tests/
    └── test_suite.php      # Automated regression & unit test suite
```

---

## Database Migration (Additive & 100% Safe)

The database migration is strictly **additive**. It does not alter or delete existing data or tables.

### Option 1: Via Admin Dashboard (Easiest)
1. Sign in to your portal.
2. Navigate to **Settings & Health** (`?page=settings`).
3. Click the **"Apply Additive Migration"** button.

### Option 2: Via phpMyAdmin on Hostinger
1. Open phpMyAdmin for database `u364134727_rates`.
2. Import `migration.sql`.

### New Tables Created:
- `vendor_worksheets`: Metadata for sheets detected in each workbook.
- `vendor_calc_config`: Calculation settings per vendor (base weight, increments, rounding).
- `rate_audit_log`: Audit trail of manual modifications.

### Columns Added to Existing Tables:
- `vendors`: `is_active`, `contact_info`, `notes`, `updated_at`.
- `import_batches`: `is_latest`, `sheet_names`, `notes`.
- `vendor_rate_rows`: `is_manually_modified`, `modified_at`.

---

## REST API Documentation

All API requests require authentication via the `X-API-Key` HTTP header:
```http
X-API-Key: YOUR_API_KEY
```

### 1. Calculate Shipping Rate (Recommended)
`GET /api/calculate.php`

**Parameters:**
- `vendor` (string, required): e.g. `pacific`
- `country` (string, required): Destination country, e.g. `USA`
- `service_code` (string, required): Service code, e.g. `PXC-EX NY SELF`
- `weight_kg` (float, required): Package weight in kg, e.g. `1.5`
- `postcode` (string, optional): Required for zone-based tariffs, e.g. `10001`

**Example Request:**
```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  "https://rates.princeexp.com/api/calculate.php?vendor=pacific&country=USA&service_code=PXC-EX%20NY%20SELF&weight_kg=1.5&postcode=10001"
```

**Example Response:**
```json
{
  "ok": true,
  "vendor": {
    "name": "Pacific",
    "slug": "pacific",
    "batch_id": 1
  },
  "query": {
    "country": "USA",
    "service_code": "PXC-EX NY SELF",
    "weight_kg": 1.5,
    "postcode": "10001"
  },
  "calculation": {
    "success": true,
    "rate_type": "regular",
    "service_code": "PXC-EX NY SELF",
    "country": "USA",
    "charged_weight_kg": 1.5,
    "base_rate": 850.0,
    "addl_rate": 250.0,
    "total_rate": 1350.0,
    "currency": "INR",
    "breakdown": [
      { "description": "Base rate (0.5 kg)", "amount": 850.0 },
      { "description": "Additional 2 x 0.5 kg @ 250.00", "amount": 500.0 }
    ]
  }
}
```

---

### 2. Rates CRUD API
`/api/rates.php`

- **`GET /api/rates.php`**: Lookup rate records. 100% backward-compatible with v1.0 parameters (`vendor`, `country`, `service_code`, `weight_kg`, `postcode`, `limit`, `offset`).
- **`POST /api/rates.php`**: Insert new rate row.
- **`PATCH /api/rates.php?id={ID}`**: Edit rate row (triggers audit log).
- **`DELETE /api/rates.php?id={ID}`**: Delete rate row.

---

### 3. Vendors API
`/api/vendors.php`

- **`GET /api/vendors.php`**: List all vendors with active version and row count metrics.
- **`GET /api/vendors.php?slug=pacific`**: Get vendor details and active worksheets.
- **`POST /api/vendors.php`**: Create vendor (`name`, `contact_info`, `notes`).
- **`PATCH /api/vendors.php?id={ID}`**: Update vendor details or active status.

---

### 4. Worksheets API
`GET /api/sheets.php?vendor=pacific`

Returns worksheet metadata, detected types (`regular`, `zonewise`, `zones`, `country_services`), row counts, and column header schemas.

---

### 5. Postcode Zone Lookup API
`GET /api/zones.php?vendor=pacific&country=USA&postcode=10001`

Resolves destination postal code to its assigned shipping zone and town/city.

---

## Running the Automated Test Suite

### Via Admin Browser:
Navigate to `https://rates.princeexp.com/?page=tests` to view the graphical test runner.

### Via Command Line:
```bash
php tests/test_suite.php
```

All test cases validate:
- String and weight slugification/parsing
- Unquoted rate flag detection (`-`, `N/A`)
- Database connectivity and schema integrity
- Rate calculator engine math and validation bounds
- Authentication rejection and approval

---

## Hostinger Deployment Instructions

1. **Upload Files**: Upload the project directory to `public_html/rates/` on Hostinger via FTP or File Manager.
2. **Preserve `config.php`**: Do **not** overwrite `config.php`—your live database credentials and API key are already configured in it.
3. **Run Migration**: Visit `https://rates.princeexp.com/?page=settings` and click "Apply Additive Migration".
4. **File Permissions**: Verify that `storage/uploads/` has write permissions (`0750` or `0755`).
5. **Verify Tests**: Open `https://rates.princeexp.com/?page=tests` to confirm all assertions pass.
