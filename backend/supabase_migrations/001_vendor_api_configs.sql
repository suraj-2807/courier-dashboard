-- vendor_api_configs table for storing courier vendor API connections
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS vendor_api_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  vendor_name TEXT DEFAULT '',
  api_url TEXT NOT NULL,
  user_id_encrypted TEXT DEFAULT '',
  password_encrypted TEXT DEFAULT '',
  customer_code TEXT DEFAULT '',
  company_code TEXT DEFAULT '',
  product_code TEXT DEFAULT 'SPX',
  service_name TEXT DEFAULT 'SELF',
  lsp_type TEXT DEFAULT 'I',
  environment TEXT DEFAULT 'production' CHECK (environment IN ('production', 'staging')),
  is_active BOOLEAN DEFAULT true,
  webhook_url TEXT DEFAULT '',
  webhook_events JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (optional, disable if using service key)
-- ALTER TABLE vendor_api_configs ENABLE ROW LEVEL SECURITY;

-- Create an index on is_active for quick filtering
CREATE INDEX IF NOT EXISTS idx_vendor_api_configs_active ON vendor_api_configs(is_active);

-- Create a function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_vendor_api_configs_updated_at ON vendor_api_configs;
CREATE TRIGGER update_vendor_api_configs_updated_at
  BEFORE UPDATE ON vendor_api_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
