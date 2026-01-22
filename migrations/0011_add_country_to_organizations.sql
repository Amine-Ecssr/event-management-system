-- Add country_id column to organizations table
ALTER TABLE organizations 
ADD COLUMN country_id INTEGER REFERENCES countries(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IDX_organizations_country_id ON organizations(country_id);
