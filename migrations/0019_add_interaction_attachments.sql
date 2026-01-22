-- Migration: Add Interaction Attachments
-- Description: Add attachments support for lead and partnership interactions
-- Date: 2024-12-20

-- Create interaction_attachments table
CREATE TABLE IF NOT EXISTS interaction_attachments (
  id SERIAL PRIMARY KEY,
  
  -- Polymorphic relationship to lead or partnership interactions
  lead_interaction_id INTEGER REFERENCES lead_interactions(id) ON DELETE CASCADE,
  partnership_interaction_id INTEGER REFERENCES partnership_interactions(id) ON DELETE CASCADE,
  
  -- File metadata
  object_key TEXT NOT NULL UNIQUE, -- MinIO object key
  original_file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL, -- bytes
  mime_type VARCHAR(100) NOT NULL,
  
  -- Metadata
  uploaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraint: must belong to either lead or partnership interaction (not both, not neither)
  CONSTRAINT check_interaction_parent CHECK (
    (lead_interaction_id IS NOT NULL AND partnership_interaction_id IS NULL) OR
    (lead_interaction_id IS NULL AND partnership_interaction_id IS NOT NULL)
  )
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS IDX_interaction_attachments_lead ON interaction_attachments(lead_interaction_id);
CREATE INDEX IF NOT EXISTS IDX_interaction_attachments_partnership ON interaction_attachments(partnership_interaction_id);
CREATE INDEX IF NOT EXISTS IDX_interaction_attachments_uploaded_by ON interaction_attachments(uploaded_by_user_id);
