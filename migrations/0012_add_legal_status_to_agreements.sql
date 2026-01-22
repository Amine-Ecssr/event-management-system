-- Add legal_status column to partnership_agreements table
ALTER TABLE partnership_agreements 
ADD COLUMN legal_status TEXT CHECK (legal_status IN ('binding', 'non-binding'));

-- Create index for legal_status
CREATE INDEX IDX_partnership_agreements_legal_status ON partnership_agreements(legal_status);
