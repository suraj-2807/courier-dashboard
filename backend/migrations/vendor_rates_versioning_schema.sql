-- ============================================================
-- Vendor Rates Versioning & Multi-Sheet Tariff Schema
-- Supports Pacific, Flyshift, ACX, and future courier vendors
-- Run after mysql_schema.sql
-- ============================================================

-- ── 1. Vendor Rate Versions ──
CREATE TABLE IF NOT EXISTS vendor_rate_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_code VARCHAR(50) NOT NULL,
  version_name VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) DEFAULT '',
  file_size INT DEFAULT 0,
  status ENUM('draft', 'validated', 'active', 'archived', 'failed') DEFAULT 'draft',
  validation_summary JSON DEFAULT NULL,
  effective_from DATE NULL,
  effective_to DATE NULL,
  uploaded_by INT NULL,
  activated_by INT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  activated_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (activated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_vrv_vendor_status ON vendor_rate_versions(vendor_code, status);

-- ── 2. Normalized Vendor Rates (Self Network / Direct Routes) ──
CREATE TABLE IF NOT EXISTS vendor_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version_id INT NOT NULL,
  vendor_code VARCHAR(50) NOT NULL,
  service_code VARCHAR(100) NOT NULL,
  service_name VARCHAR(255) DEFAULT '',
  destination_country VARCHAR(100) NOT NULL,
  country_code VARCHAR(10) DEFAULT '',
  transit_time VARCHAR(100) DEFAULT '',
  base_500g DECIMAL(12,2) DEFAULT 0,
  addl_500g DECIMAL(12,2) DEFAULT 0,
  doc_type ENUM('DOC', 'NON-DOC', 'ALL') DEFAULT 'ALL',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (version_id) REFERENCES vendor_rate_versions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_vr_version_dest ON vendor_rates(version_id, destination_country);
CREATE INDEX idx_vr_version_service ON vendor_rates(version_id, service_code);
CREATE INDEX idx_vr_vendor ON vendor_rates(vendor_code);

-- ── 3. Normalized Rate Slabs (6kg++, 11kg++, 21kg++, 31kg++, 51kg++, 71kg++) ──
CREATE TABLE IF NOT EXISTS vendor_rate_slabs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rate_id INT NOT NULL,
  min_weight DECIMAL(10,3) NOT NULL,
  max_weight DECIMAL(10,3) NULL,
  rate_per_kg DECIMAL(12,2) NOT NULL,
  rate_type ENUM('per_kg', 'flat') DEFAULT 'per_kg',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rate_id) REFERENCES vendor_rates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_vrs_rate_weight ON vendor_rate_slabs(rate_id, min_weight, max_weight);

-- ── 4. Country & Regional Postcode Zones ──
CREATE TABLE IF NOT EXISTS vendor_postcode_zones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version_id INT NOT NULL,
  country_code VARCHAR(10) NOT NULL,
  postcode VARCHAR(50) NOT NULL,
  postcode_prefix VARCHAR(20) DEFAULT '',
  city VARCHAR(255) DEFAULT '',
  state_province VARCHAR(100) DEFAULT '',
  zone VARCHAR(50) NOT NULL,
  is_remote BOOLEAN DEFAULT FALSE,
  remote_remarks VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (version_id) REFERENCES vendor_rate_versions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_vpz_lookup ON vendor_postcode_zones(version_id, country_code, postcode);
CREATE INDEX idx_vpz_prefix ON vendor_postcode_zones(version_id, country_code, postcode_prefix);
CREATE INDEX idx_vpz_zone ON vendor_postcode_zones(version_id, zone);

-- ── 5. Vendor Remote Areas ──
CREATE TABLE IF NOT EXISTS vendor_remote_areas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version_id INT NOT NULL,
  country_name VARCHAR(100) NOT NULL,
  country_code VARCHAR(10) DEFAULT '',
  postcode_from VARCHAR(50) DEFAULT '',
  postcode_to VARCHAR(50) DEFAULT '',
  postcode_exact VARCHAR(50) DEFAULT '',
  city VARCHAR(255) DEFAULT '',
  carrier_network VARCHAR(50) DEFAULT 'DPD',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (version_id) REFERENCES vendor_rate_versions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_vra_lookup ON vendor_remote_areas(version_id, country_name, postcode_exact);
CREATE INDEX idx_vra_country ON vendor_remote_areas(version_id, country_code);
