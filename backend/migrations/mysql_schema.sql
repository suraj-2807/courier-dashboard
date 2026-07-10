-- ============================================================
-- Courier Admin — MySQL Schema
-- Migrated from Supabase (PostgreSQL)
-- Run this in Hostinger phpMyAdmin or MySQL CLI
-- ============================================================

-- Use strict mode for data integrity
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';

-- ── 1. Users ──
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'operator', 'viewer') DEFAULT 'operator',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. Senders ──
CREATE TABLE IF NOT EXISTS senders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  address TEXT DEFAULT NULL,
  city VARCHAR(100) DEFAULT '',
  state VARCHAR(100) DEFAULT '',
  pincode VARCHAR(20) DEFAULT '',
  country VARCHAR(50) DEFAULT 'INDIA',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. Receivers ──
CREATE TABLE IF NOT EXISTS receivers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  address TEXT DEFAULT NULL,
  city VARCHAR(100) DEFAULT '',
  state VARCHAR(100) DEFAULT '',
  pincode VARCHAR(20) DEFAULT '',
  country VARCHAR(50) DEFAULT 'INDIA',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. Courier Providers ──
CREATE TABLE IF NOT EXISTS courier_providers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) DEFAULT '',
  tracking_url VARCHAR(500) DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 5. Vendor API Configs ──
CREATE TABLE IF NOT EXISTS vendor_api_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Basic Info
  name VARCHAR(255) NOT NULL,
  vendor_code VARCHAR(100) DEFAULT '',

  -- Authentication
  auth_type ENUM('token', 'inline', 'api_key') DEFAULT 'inline',
  auth_url VARCHAR(500) DEFAULT '',
  auth_payload_template JSON DEFAULT NULL,
  auth_credentials TEXT DEFAULT '',
  auth_token_path VARCHAR(255) DEFAULT '',

  -- Shipment API
  shipment_api_url VARCHAR(500) DEFAULT '',
  shipment_api_method ENUM('POST', 'PUT') DEFAULT 'POST',
  request_template JSON DEFAULT NULL,
  field_mapping JSON DEFAULT NULL,
  headers_template JSON DEFAULT NULL,

  -- Response Parsing
  response_tracking_path VARCHAR(255) DEFAULT '',
  response_success_path VARCHAR(255) DEFAULT '',
  response_success_value VARCHAR(255) DEFAULT '',

  -- Vendor Services
  available_services JSON DEFAULT NULL,

  -- Settings
  environment ENUM('production', 'staging') DEFAULT 'production',
  is_active BOOLEAN DEFAULT TRUE,

  -- API Push Log (last result)
  last_push_status VARCHAR(50) DEFAULT '',
  last_push_at TIMESTAMP NULL DEFAULT NULL,
  last_push_response JSON DEFAULT NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_vendor_api_configs_active ON vendor_api_configs(is_active);
CREATE INDEX idx_vendor_api_configs_vendor_code ON vendor_api_configs(vendor_code);

-- ── 6. Shipments ──
CREATE TABLE IF NOT EXISTS shipments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(100) NOT NULL,
  sender_id INT DEFAULT NULL,
  receiver_id INT DEFAULT NULL,
  courier_provider_id INT DEFAULT NULL,
  vendor_config_id INT DEFAULT NULL,
  service_code VARCHAR(100) DEFAULT '',
  vendor_code VARCHAR(100) DEFAULT '',
  product_code VARCHAR(100) DEFAULT '',
  tracking_number VARCHAR(100) NOT NULL,
  weight DECIMAL(10,2) DEFAULT 0,
  length DECIMAL(10,2) DEFAULT 0,
  breadth DECIMAL(10,2) DEFAULT 0,
  height DECIMAL(10,2) DEFAULT 0,
  payment_mode VARCHAR(50) DEFAULT 'prepaid',
  package_type VARCHAR(50) DEFAULT 'parcel',
  total_amount DECIMAL(12,2) DEFAULT 0,
  shipping_charge DECIMAL(12,2) DEFAULT 0,
  order_reference VARCHAR(255) DEFAULT '',
  remarks TEXT DEFAULT NULL,
  status VARCHAR(50) DEFAULT 'pending',

  -- Vendor API fields
  vendor_awb_number VARCHAR(255) DEFAULT '',
  vendor_tracking_url VARCHAR(500) DEFAULT '',
  vendor_label_url VARCHAR(500) DEFAULT '',
  vendor_push_status ENUM('pending', 'success', 'failed', 'skipped') DEFAULT 'pending',
  vendor_raw_response JSON DEFAULT NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Foreign Keys
  FOREIGN KEY (sender_id) REFERENCES senders(id) ON DELETE SET NULL,
  FOREIGN KEY (receiver_id) REFERENCES receivers(id) ON DELETE SET NULL,
  FOREIGN KEY (courier_provider_id) REFERENCES courier_providers(id) ON DELETE SET NULL,
  FOREIGN KEY (vendor_config_id) REFERENCES vendor_api_configs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX idx_shipments_order_id ON shipments(order_id);
CREATE INDEX idx_shipments_vendor_config ON shipments(vendor_config_id);
CREATE INDEX idx_shipments_created_at ON shipments(created_at);

-- ── 7. Tracking Events ──
CREATE TABLE IF NOT EXISTS tracking_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shipment_id INT NOT NULL,
  status VARCHAR(100) DEFAULT '',
  description TEXT DEFAULT NULL,
  location VARCHAR(255) DEFAULT '',
  event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_tracking_events_shipment ON tracking_events(shipment_id);
CREATE INDEX idx_tracking_events_time ON tracking_events(event_time);

-- ── 8. Vendor API Push Logs ──
CREATE TABLE IF NOT EXISTS vendor_api_push_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_config_id INT DEFAULT NULL,
  shipment_id INT DEFAULT NULL,
  request_url VARCHAR(500) DEFAULT '',
  request_payload JSON DEFAULT NULL,
  response_status INT DEFAULT 0,
  response_body JSON DEFAULT NULL,
  tracking_number_received VARCHAR(255) DEFAULT '',
  status ENUM('success', 'failed', 'pending') DEFAULT 'pending',
  error_message TEXT DEFAULT NULL,
  pushed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (vendor_config_id) REFERENCES vendor_api_configs(id) ON DELETE SET NULL,
  FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_push_logs_vendor ON vendor_api_push_logs(vendor_config_id);
CREATE INDEX idx_push_logs_shipment ON vendor_api_push_logs(shipment_id);

-- ── 9. Rate Companies ──
CREATE TABLE IF NOT EXISTS rate_companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 10. Rate Services ──
CREATE TABLE IF NOT EXISTS rate_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES rate_companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_company_service (company_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_rate_services_company ON rate_services(company_id);

-- ── 11. Rate Entries (Weight × Zone grid) ──
CREATE TABLE IF NOT EXISTS rate_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_id INT NOT NULL,
  weight VARCHAR(50) NOT NULL,
  zone_1 DECIMAL(10,2) DEFAULT 0,
  zone_2 DECIMAL(10,2) DEFAULT 0,
  zone_3 DECIMAL(10,2) DEFAULT 0,
  zone_4 DECIMAL(10,2) DEFAULT 0,
  zone_5 DECIMAL(10,2) DEFAULT 0,
  zone_6 DECIMAL(10,2) DEFAULT 0,
  zone_7 DECIMAL(10,2) DEFAULT 0,
  zone_8 DECIMAL(10,2) DEFAULT 0,
  zone_9 DECIMAL(10,2) DEFAULT 0,
  zone_10 DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_id) REFERENCES rate_services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_rate_entries_service ON rate_entries(service_id);

-- ── 12. Postcode → Zone Mappings (per service) ──
CREATE TABLE IF NOT EXISTS postcode_zones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_id INT NOT NULL,
  postcode VARCHAR(20) NOT NULL,
  city VARCHAR(255) DEFAULT '',
  zone VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_id) REFERENCES rate_services(id) ON DELETE CASCADE,
  UNIQUE KEY unique_service_postcode (service_id, postcode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_postcode_zones_service ON postcode_zones(service_id);
CREATE INDEX idx_postcode_zones_postcode ON postcode_zones(postcode);
