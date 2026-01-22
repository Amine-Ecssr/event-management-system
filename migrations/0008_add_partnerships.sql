-- Migration: Add Partnership Management Feature
-- This migration extends organizations with partnership fields and creates supporting tables
-- Consolidated from: 0008_add_partnerships.sql + 0010_add_partnership_types.sql

-- =============================================
-- 1. Create partnership_types table
-- =============================================

CREATE TABLE IF NOT EXISTS "partnership_types" (
  "id" SERIAL PRIMARY KEY,
  "name_en" TEXT NOT NULL,
  "name_ar" TEXT,
  "description" TEXT,
  "description_ar" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW(),
  CONSTRAINT "partnership_types_name_en_unique" UNIQUE("name_en")
);

-- Insert default partnership types
INSERT INTO "partnership_types" ("name_en", "name_ar", "description") VALUES
  ('Strategic', 'استراتيجي', 'Strategic partnership'),
  ('Sponsor', 'راعي', 'Sponsorship partnership'),
  ('Media', 'إعلامي', 'Media partnership'),
  ('Academic', 'أكاديمي', 'Academic partnership'),
  ('Government', 'حكومي', 'Government partnership'),
  ('Corporate', 'شركات', 'Corporate partnership'),
  ('NGO', 'منظمات غير حكومية', 'Non-governmental organization partnership')
ON CONFLICT ("name_en") DO NOTHING;

-- =============================================
-- 2. Extend organizations table with partnership fields
-- =============================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_partner BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS partnership_status TEXT, -- 'active', 'pending', 'suspended', 'terminated'
  ADD COLUMN IF NOT EXISTS partnership_type_id INTEGER REFERENCES partnership_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS partnership_start_date DATE,
  ADD COLUMN IF NOT EXISTS partnership_end_date DATE, -- null = indefinite
  ADD COLUMN IF NOT EXISTS agreement_signed_by TEXT, -- Name of person who signed from partner side
  ADD COLUMN IF NOT EXISTS agreement_signed_by_us TEXT, -- Our representative who signed
  ADD COLUMN IF NOT EXISTS partnership_notes TEXT, -- General notes about the partnership
  ADD COLUMN IF NOT EXISTS logo_key TEXT, -- MinIO object key for partner logo
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS primary_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;

-- Index for filtering partners
CREATE INDEX IF NOT EXISTS idx_organizations_is_partner ON organizations(is_partner);
CREATE INDEX IF NOT EXISTS idx_organizations_partnership_status ON organizations(partnership_status);

-- =============================================
-- 3. Partnership Agreements table
-- =============================================

CREATE TABLE IF NOT EXISTS partnership_agreements (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Agreement details
  title TEXT NOT NULL,
  title_ar TEXT,
  description TEXT,
  description_ar TEXT,
  agreement_type TEXT NOT NULL, -- 'mou', 'nda', 'sponsorship', 'collaboration', 'other'
  
  -- Dates
  signed_date DATE,
  effective_date DATE,
  expiry_date DATE, -- null = no expiry
  
  -- Signatories
  partner_signatory TEXT,
  partner_signatory_title TEXT,
  our_signatory TEXT,
  our_signatory_title TEXT,
  
  -- Document storage (MinIO)
  document_key TEXT, -- MinIO object key for agreement PDF
  document_file_name TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'pending_approval', 'active', 'expired', 'terminated'
  
  -- Metadata
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partnership_agreements_org_id ON partnership_agreements(organization_id);
CREATE INDEX IF NOT EXISTS idx_partnership_agreements_status ON partnership_agreements(status);

-- =============================================
-- 4. Partnership Activities table
-- =============================================

CREATE TABLE IF NOT EXISTS partnership_activities (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Activity details
  title TEXT NOT NULL,
  title_ar TEXT,
  description TEXT,
  description_ar TEXT,
  activity_type TEXT NOT NULL, -- 'joint_event', 'sponsorship', 'collaboration', 'training', 'exchange', 'meeting', 'other'
  
  -- Date and timing
  start_date DATE NOT NULL,
  end_date DATE,
  
  -- Linked event (optional)
  event_id VARCHAR REFERENCES events(id) ON DELETE SET NULL,
  
  -- Outcome and impact
  outcome TEXT,
  outcome_ar TEXT,
  impact_score INTEGER, -- 1-5 scale
  
  -- Metadata
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partnership_activities_org_id ON partnership_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_partnership_activities_type ON partnership_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_partnership_activities_event_id ON partnership_activities(event_id);

-- =============================================
-- 5. Partnership Contacts junction table
-- =============================================

CREATE TABLE IF NOT EXISTS partnership_contacts (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role TEXT, -- 'primary', 'liaison', 'technical', 'executive', 'other'
  role_ar TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_partnership_contact UNIQUE(organization_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_partnership_contacts_org_id ON partnership_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_partnership_contacts_contact_id ON partnership_contacts(contact_id);
