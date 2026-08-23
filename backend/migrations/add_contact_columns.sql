-- Migration: Add missing columns to senders and receivers tables
-- These columns exist in the booking form but were missing from the contact tables

ALTER TABLE senders
  ADD COLUMN IF NOT EXISTS company VARCHAR(255) DEFAULT '' AFTER name,
  ADD COLUMN IF NOT EXISTS address_2 TEXT DEFAULT NULL AFTER address,
  ADD COLUMN IF NOT EXISTS country VARCHAR(50) DEFAULT 'INDIA' AFTER pincode,
  ADD COLUMN IF NOT EXISTS gstin_type VARCHAR(50) DEFAULT '' AFTER country,
  ADD COLUMN IF NOT EXISTS gstin_no VARCHAR(50) DEFAULT '' AFTER gstin_type;

ALTER TABLE receivers
  ADD COLUMN IF NOT EXISTS company VARCHAR(255) DEFAULT '' AFTER name,
  ADD COLUMN IF NOT EXISTS address_2 TEXT DEFAULT NULL AFTER address,
  ADD COLUMN IF NOT EXISTS country VARCHAR(50) DEFAULT '' AFTER pincode,
  ADD COLUMN IF NOT EXISTS gstin_type VARCHAR(50) DEFAULT '' AFTER country,
  ADD COLUMN IF NOT EXISTS gstin_no VARCHAR(50) DEFAULT '' AFTER gstin_type;
