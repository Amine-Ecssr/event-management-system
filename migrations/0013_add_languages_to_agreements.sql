-- Add languages column to partnership_agreements table
ALTER TABLE partnership_agreements 
ADD COLUMN languages TEXT[];

-- Create GIN index for array search performance
CREATE INDEX IDX_partnership_agreements_languages ON partnership_agreements USING GIN(languages);
