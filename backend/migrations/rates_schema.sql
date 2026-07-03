-- ============================================================
-- Rates Management — MySQL Schema
-- Run after main schema
-- ============================================================

-- ── 9. Rate Zones ──
CREATE TABLE IF NOT EXISTS rate_zones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  zone_name VARCHAR(100) NOT NULL,
  zone_code VARCHAR(20) NOT NULL UNIQUE,
  description VARCHAR(255) DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 10. Rate Cards ──
CREATE TABLE IF NOT EXISTS rate_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  zone_id INT NOT NULL,
  weight_from DECIMAL(10,2) NOT NULL DEFAULT 0,
  weight_to DECIMAL(10,2) NOT NULL DEFAULT 0.50,
  rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  additional_weight_rate DECIMAL(12,2) DEFAULT 0,
  courier_provider_id INT DEFAULT NULL,
  service_type VARCHAR(50) DEFAULT 'standard',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (zone_id) REFERENCES rate_zones(id) ON DELETE CASCADE,
  FOREIGN KEY (courier_provider_id) REFERENCES courier_providers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_rate_cards_zone ON rate_cards(zone_id);
CREATE INDEX idx_rate_cards_weight ON rate_cards(weight_from, weight_to);
CREATE INDEX idx_rate_cards_service ON rate_cards(service_type);

-- ── 11. Pincode Zone Mappings ──
CREATE TABLE IF NOT EXISTS pincode_zone_mappings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pincode VARCHAR(20) NOT NULL,
  city VARCHAR(100) DEFAULT '',
  state VARCHAR(100) DEFAULT '',
  country VARCHAR(50) DEFAULT 'INDIA',
  zone_id INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (zone_id) REFERENCES rate_zones(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_pincode_zone_pincode ON pincode_zone_mappings(pincode);
CREATE INDEX idx_pincode_zone_state ON pincode_zone_mappings(state);
CREATE INDEX idx_pincode_zone_zone ON pincode_zone_mappings(zone_id);
