-- Migration: 0016_add_agreement_attachments
-- Description: Add attachment support for partnership agreements
-- Created: 2024-12-19

-- Create agreement_attachments table for storing multiple file attachments per agreement
CREATE TABLE IF NOT EXISTS agreement_attachments (
  id SERIAL PRIMARY KEY,
  agreement_id INTEGER NOT NULL REFERENCES partnership_agreements(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  uploaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Create index for efficient lookups by agreement_id
CREATE INDEX IF NOT EXISTS IDX_agreement_attachments_agreement_id ON agreement_attachments(agreement_id);
