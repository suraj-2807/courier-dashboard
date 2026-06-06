-- ============================================================
-- Migration 003: Add vendor API fields to shipments table
-- Run this in your Supabase SQL editor
-- ============================================================

-- Add vendor API response fields to shipments table
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS vendor_config_id UUID REFERENCES vendor_api_configs(id) ON DELETE SET NULL;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS vendor_awb_number TEXT DEFAULT '';
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS vendor_tracking_url TEXT DEFAULT '';
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS vendor_label_url TEXT DEFAULT '';
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS vendor_push_status TEXT DEFAULT 'pending'
  CHECK (vendor_push_status IN ('pending', 'success', 'failed', 'skipped'));
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS vendor_raw_response JSONB DEFAULT '{}'::jsonb;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS service_code TEXT DEFAULT '';

-- Index for vendor config lookup
CREATE INDEX IF NOT EXISTS idx_shipments_vendor_config ON shipments(vendor_config_id);

-- Add shipment_id FK to push logs if not already referencing shipments
-- (the 002 migration created shipment_id as UUID without FK since shipments table schema varies)
