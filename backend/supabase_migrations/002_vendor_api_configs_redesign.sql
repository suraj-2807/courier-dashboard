-- ============================================================
-- Migration 002: Redesign vendor_api_configs for multi-vendor support
-- Run this in your Supabase SQL editor
-- WARNING: This drops the old table. Backup any existing data first.
-- ============================================================

-- Drop old table and related objects
DROP TABLE IF EXISTS vendor_api_configs CASCADE;

-- Create redesigned table
CREATE TABLE vendor_api_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- ── Basic Info ──
  name TEXT NOT NULL,                          -- Display name e.g. "FlySwift Production"
  vendor_code TEXT NOT NULL DEFAULT '',         -- Short code e.g. "flyswift", "pacific"

  -- ── Authentication ──
  auth_type TEXT NOT NULL DEFAULT 'inline'      -- 'token', 'inline', 'api_key'
    CHECK (auth_type IN ('token', 'inline', 'api_key')),
  auth_url TEXT DEFAULT '',                     -- Token endpoint (used when auth_type = 'token')
  auth_payload_template JSONB DEFAULT '{}'::jsonb,  -- Template for auth request body
  auth_credentials TEXT DEFAULT '',             -- Encrypted JSON of actual credential values
  auth_token_path TEXT DEFAULT '',              -- JSONPath to extract token from auth response e.g. "data.token"

  -- ── Shipment API ──
  shipment_api_url TEXT NOT NULL DEFAULT '',    -- Main shipment/label creation endpoint
  shipment_api_method TEXT DEFAULT 'POST'       -- HTTP method
    CHECK (shipment_api_method IN ('POST', 'PUT')),
  request_template JSONB DEFAULT '{}'::jsonb,   -- Full JSON template of vendor's expected request body
  field_mapping JSONB DEFAULT '{}'::jsonb,      -- Maps internal field names → vendor field names
  headers_template JSONB DEFAULT '{}'::jsonb,   -- Custom headers e.g. {"Authorization": "Bearer {{token}}"}

  -- ── Response Parsing ──
  response_tracking_path TEXT DEFAULT '',       -- JSONPath to extract tracking/AWB from response
  response_success_path TEXT DEFAULT '',        -- JSONPath to check success e.g. "status"
  response_success_value TEXT DEFAULT '',       -- Expected value at success path e.g. "success"

  -- ── Vendor Services ──
  available_services JSONB DEFAULT '[]'::jsonb,  -- Array of {name, code} for vendor services

  -- ── Settings ──
  environment TEXT DEFAULT 'production'
    CHECK (environment IN ('production', 'staging')),
  is_active BOOLEAN DEFAULT true,

  -- ── API Push Log (last result) ──
  last_push_status TEXT DEFAULT '',             -- 'success', 'failed', ''
  last_push_at TIMESTAMPTZ,
  last_push_response JSONB DEFAULT '{}'::jsonb,

  -- ── Timestamps ──
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_api_configs_active ON vendor_api_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_vendor_api_configs_vendor_code ON vendor_api_configs(vendor_code);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vendor_api_configs_updated_at
  BEFORE UPDATE ON vendor_api_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── API Push Logs Table ──
-- Stores history of all API push attempts
CREATE TABLE IF NOT EXISTS vendor_api_push_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_config_id UUID REFERENCES vendor_api_configs(id) ON DELETE SET NULL,
  shipment_id UUID,                            -- FK to shipments table
  request_url TEXT DEFAULT '',
  request_payload JSONB DEFAULT '{}'::jsonb,
  response_status INTEGER,
  response_body JSONB DEFAULT '{}'::jsonb,
  tracking_number_received TEXT DEFAULT '',
  status TEXT DEFAULT 'pending'                -- 'success', 'failed', 'pending'
    CHECK (status IN ('success', 'failed', 'pending')),
  error_message TEXT DEFAULT '',
  pushed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_logs_vendor ON vendor_api_push_logs(vendor_config_id);
CREATE INDEX IF NOT EXISTS idx_push_logs_shipment ON vendor_api_push_logs(shipment_id);
