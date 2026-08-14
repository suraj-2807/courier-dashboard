-- ============================================================
-- Migration: AWB System, Invoice, and Save/Push Workflow
-- Run this in phpMyAdmin or MySQL CLI
-- ============================================================

-- Add vendor AWB2 for forwarded shipments
ALTER TABLE shipments
  ADD COLUMN vendor_awb_number_2 VARCHAR(255) DEFAULT '' AFTER vendor_awb_number;

-- Add invoice fields
ALTER TABLE shipments
  ADD COLUMN invoice_type VARCHAR(50) DEFAULT 'INVOICE' AFTER vendor_raw_response,
  ADD COLUMN invoice_note TEXT DEFAULT NULL AFTER invoice_type,
  ADD COLUMN invoice_items JSON DEFAULT NULL AFTER invoice_note,
  ADD COLUMN invoice_pdf_path VARCHAR(500) DEFAULT '' AFTER invoice_items;

-- Add lock field (true after API push, prevents edits)
ALTER TABLE shipments
  ADD COLUMN is_locked BOOLEAN DEFAULT FALSE AFTER invoice_pdf_path;

-- Add no_of_pieces, content_description, declared_value, cod_amount columns if not present
-- These may already exist from earlier migrations, so we use IF NOT EXISTS style
-- (MySQL doesn't support IF NOT EXISTS for ALTER, so these will error if already present — that's OK)

ALTER TABLE shipments
  ADD COLUMN no_of_pieces INT DEFAULT 1 AFTER height;

ALTER TABLE shipments
  ADD COLUMN content_description VARCHAR(500) DEFAULT '' AFTER no_of_pieces;

ALTER TABLE shipments
  ADD COLUMN declared_value DECIMAL(12,2) DEFAULT 0 AFTER content_description;

ALTER TABLE shipments
  ADD COLUMN cod_amount DECIMAL(12,2) DEFAULT 0 AFTER declared_value;

-- Add invoice-related sender/receiver fields that may be needed
ALTER TABLE shipments
  ADD COLUMN sender_company VARCHAR(255) DEFAULT '' AFTER cod_amount,
  ADD COLUMN sender_address_2 VARCHAR(500) DEFAULT '' AFTER sender_company,
  ADD COLUMN sender_gstin_type VARCHAR(50) DEFAULT '' AFTER sender_address_2,
  ADD COLUMN sender_gstin_no VARCHAR(100) DEFAULT '' AFTER sender_gstin_type,
  ADD COLUMN receiver_address_2 VARCHAR(500) DEFAULT '' AFTER sender_gstin_no,
  ADD COLUMN receiver_gstin_type VARCHAR(50) DEFAULT '' AFTER receiver_address_2,
  ADD COLUMN receiver_gstin_no VARCHAR(100) DEFAULT '' AFTER receiver_gstin_type;

-- Add invoice export fields
ALTER TABLE shipments
  ADD COLUMN invoice_no VARCHAR(100) DEFAULT '' AFTER receiver_gstin_no,
  ADD COLUMN invoice_date VARCHAR(50) DEFAULT '' AFTER invoice_no,
  ADD COLUMN invoice_currency VARCHAR(10) DEFAULT 'INR' AFTER invoice_date,
  ADD COLUMN hs_code VARCHAR(50) DEFAULT '' AFTER invoice_currency,
  ADD COLUMN export_reason VARCHAR(255) DEFAULT '' AFTER hs_code,
  ADD COLUMN terms_of_trade VARCHAR(10) DEFAULT 'CIF' AFTER export_reason;
