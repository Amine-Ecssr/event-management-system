-- Migration: Add termination clause fields to partnership_agreements table
-- Adds bilingual (English/Arabic) termination clause/terms text fields

ALTER TABLE partnership_agreements 
ADD COLUMN termination_clause TEXT,
ADD COLUMN termination_clause_ar TEXT;

-- Add comment for documentation
COMMENT ON COLUMN partnership_agreements.termination_clause IS 'Termination clause/terms in English';
COMMENT ON COLUMN partnership_agreements.termination_clause_ar IS 'Termination clause/terms in Arabic';
