-- ============================================================
-- Vendor Rate Management Portal — Database Migration
-- ADDITIVE ONLY — preserves all existing tables and data
-- Run AFTER the original database.sql has been applied
-- ============================================================

-- 1. Add columns to existing 'vendors' table
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER slug,
  ADD COLUMN IF NOT EXISTS contact_info TEXT NULL AFTER is_active,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER contact_info,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- 2. Add is_latest flag to import_batches
ALTER TABLE import_batches
  ADD COLUMN IF NOT EXISTS is_latest TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN IF NOT EXISTS sheet_names TEXT NULL AFTER is_latest,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER error_message;

-- Mark the most recent 'active' batch per vendor as is_latest
UPDATE import_batches b
  INNER JOIN (
    SELECT vendor_id, MAX(id) AS max_id
    FROM import_batches
    WHERE status = 'active'
    GROUP BY vendor_id
  ) latest ON b.id = latest.max_id
SET b.is_latest = 1;

-- 3. Vendor worksheet metadata — tracks sheets detected per import
CREATE TABLE IF NOT EXISTS vendor_worksheets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id BIGINT UNSIGNED NOT NULL,
  batch_id BIGINT UNSIGNED NOT NULL,
  sheet_name VARCHAR(190) NOT NULL,
  sheet_type ENUM('regular','zonewise','zones','country_services','unknown') NOT NULL DEFAULT 'unknown',
  row_count INT UNSIGNED NOT NULL DEFAULT 0,
  column_headers TEXT NULL,
  display_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ws_vendor_batch (vendor_id, batch_id),
  CONSTRAINT fk_ws_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  CONSTRAINT fk_ws_batch FOREIGN KEY (batch_id) REFERENCES import_batches(id)
) ENGINE=InnoDB;

-- 4. Vendor calculation configuration
CREATE TABLE IF NOT EXISTS vendor_calc_config (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id BIGINT UNSIGNED NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  config_value TEXT NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_vendor_config (vendor_id, config_key),
  CONSTRAINT fk_cc_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id)
) ENGINE=InnoDB;

-- 5. Rate audit log — tracks all edits
CREATE TABLE IF NOT EXISTS rate_audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id BIGINT UNSIGNED NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  action ENUM('insert','update','delete') NOT NULL,
  admin_user VARCHAR(100) DEFAULT 'admin',
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_table_record (table_name, record_id),
  INDEX idx_audit_date (created_at)
) ENGINE=InnoDB;

-- 6. Add source tracking column to rate rows
ALTER TABLE vendor_rate_rows
  ADD COLUMN IF NOT EXISTS is_manually_modified TINYINT(1) NOT NULL DEFAULT 0 AFTER raw_json,
  ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP NULL AFTER is_manually_modified;

-- 7. Add source tracking to zone rows
ALTER TABLE vendor_zone_rows
  ADD COLUMN IF NOT EXISTS is_manually_modified TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP NULL;

-- 8. Add source tracking to country services
ALTER TABLE vendor_country_services
  ADD COLUMN IF NOT EXISTS is_manually_modified TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP NULL;

-- 9. Populate vendor_worksheets from existing data
INSERT IGNORE INTO vendor_worksheets (vendor_id, batch_id, sheet_name, sheet_type, row_count, display_order)
SELECT vendor_id, batch_id, sheet_name,
  CASE
    WHEN rate_type = 'regular' THEN 'regular'
    WHEN rate_type = 'zonewise' THEN 'zonewise'
    ELSE 'unknown'
  END,
  COUNT(*),
  0
FROM vendor_rate_rows
GROUP BY vendor_id, batch_id, sheet_name, rate_type;

-- Add zone sheet entries
INSERT IGNORE INTO vendor_worksheets (vendor_id, batch_id, sheet_name, sheet_type, row_count, display_order)
SELECT vendor_id, batch_id, 'Postcode Zones', 'zones', COUNT(*), 10
FROM vendor_zone_rows
GROUP BY vendor_id, batch_id;

-- Add country services sheet entries
INSERT IGNORE INTO vendor_worksheets (vendor_id, batch_id, sheet_name, sheet_type, row_count, display_order)
SELECT vendor_id, batch_id, 'Country Services', 'country_services', COUNT(*), 20
FROM vendor_country_services
GROUP BY vendor_id, batch_id;

-- 10. Insert default calc config for existing vendors (Pacific-style)
INSERT IGNORE INTO vendor_calc_config (vendor_id, config_key, config_value, description)
SELECT id, 'base_weight_kg', '0.5', 'Base weight in kg for rate calculation'
FROM vendors;

INSERT IGNORE INTO vendor_calc_config (vendor_id, config_key, config_value, description)
SELECT id, 'weight_increment_kg', '0.5', 'Weight increment in kg for additional charges'
FROM vendors;

INSERT IGNORE INTO vendor_calc_config (vendor_id, config_key, config_value, description)
SELECT id, 'base_weight_label', '500 Gms', 'Column header for base weight rate'
FROM vendors;

INSERT IGNORE INTO vendor_calc_config (vendor_id, config_key, config_value, description)
SELECT id, 'addl_weight_label', 'Addl 500 Gms', 'Column header for additional weight rate'
FROM vendors;

INSERT IGNORE INTO vendor_calc_config (vendor_id, config_key, config_value, description)
SELECT id, 'rounding_method', 'ceil_increment', 'How to round weight: ceil_increment, next_slab, exact'
FROM vendors;

INSERT IGNORE INTO vendor_calc_config (vendor_id, config_key, config_value, description)
SELECT id, 'currency', 'INR', 'Currency code for rates'
FROM vendors;
