CREATE DATABASE IF NOT EXISTS `u364134727_rates`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `u364134727_rates`;

CREATE TABLE IF NOT EXISTS vendors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  slug VARCHAR(190) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS import_batches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id BIGINT UNSIGNED NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  file_sha256 CHAR(64) NOT NULL,
  status ENUM('processing','active','failed') NOT NULL DEFAULT 'processing',
  imported_rows INT UNSIGNED NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_batch_vendor_status (vendor_id,status,id),
  CONSTRAINT fk_batch_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id)
) ENGINE=InnoDB;

-- One shared table, partitioned by vendor + import version.
-- This avoids creating unsafe/different SQL table structures for every vendor.
CREATE TABLE IF NOT EXISTS vendor_rate_rows (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NOT NULL,
  vendor_id BIGINT UNSIGNED NOT NULL,
  sheet_name VARCHAR(190) NOT NULL,
  source_row INT UNSIGNED NOT NULL,
  rate_type ENUM('regular','zonewise') NOT NULL,
  service_code VARCHAR(100) NULL,
  service_name VARCHAR(190) NULL,
  country VARCHAR(190) NULL,
  weight_label VARCHAR(100) NULL,
  weight_kg DECIMAL(12,4) NULL,
  zone VARCHAR(80) NULL,
  rate DECIMAL(14,4) NULL,
  rate_raw VARCHAR(100) NULL,
  transit_time VARCHAR(100) NULL,
  raw_json LONGTEXT NULL,
  INDEX idx_rates_api (vendor_id,batch_id,country,service_code,weight_kg),
  INDEX idx_rates_zone (vendor_id,batch_id,country,zone,weight_kg),
  CONSTRAINT fk_rate_batch FOREIGN KEY (batch_id) REFERENCES import_batches(id),
  CONSTRAINT fk_rate_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vendor_zone_rows (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NOT NULL,
  vendor_id BIGINT UNSIGNED NOT NULL,
  country VARCHAR(190) NOT NULL,
  postcode VARCHAR(100) NOT NULL,
  zone VARCHAR(80) NULL,
  town_city VARCHAR(190) NULL,
  INDEX idx_zone_lookup (vendor_id,batch_id,country,postcode),
  CONSTRAINT fk_zone_batch FOREIGN KEY (batch_id) REFERENCES import_batches(id),
  CONSTRAINT fk_zone_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vendor_country_services (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NOT NULL,
  vendor_id BIGINT UNSIGNED NOT NULL,
  service_code VARCHAR(100) NOT NULL,
  country VARCHAR(190) NOT NULL,
  INDEX idx_service_lookup (vendor_id,batch_id,country,service_code),
  CONSTRAINT fk_cs_batch FOREIGN KEY (batch_id) REFERENCES import_batches(id),
  CONSTRAINT fk_cs_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id)
) ENGINE=InnoDB;
