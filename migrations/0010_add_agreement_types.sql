-- Migration: Add Agreement Types Table and Migrate Data
-- This migration creates the agreement_types table, migrates existing data,
-- and updates the partnership_agreements table to use foreign keys

-- =============================================
-- 1. Create agreement_types table
-- =============================================

CREATE TABLE IF NOT EXISTS "agreement_types" (
  "id" SERIAL PRIMARY KEY,
  "name_en" TEXT NOT NULL,
  "name_ar" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW(),
  CONSTRAINT "agreement_types_name_en_unique" UNIQUE("name_en")
);

-- Insert default agreement types
INSERT INTO "agreement_types" ("name_en", "name_ar") VALUES
  ('MoU', 'مذكرة تفاهم'),
  ('NDA', 'اتفاقية عدم إفشاء'),
  ('Contract', 'عقد'),
  ('Letter of Intent', 'خطاب نوايا'),
  ('Service Agreement', 'اتفاقية خدمة'),
  ('Collaboration Agreement', 'اتفاقية تعاون'),
  ('Sponsorship Agreement', 'اتفاقية رعاية'),
  ('Other', 'أخرى')
ON CONFLICT ("name_en") DO NOTHING;

-- =============================================
-- 2. Add agreement_type_id column to partnership_agreements
-- =============================================

ALTER TABLE "partnership_agreements" 
ADD COLUMN IF NOT EXISTS "agreement_type_id" INTEGER REFERENCES "agreement_types"("id") ON DELETE SET NULL;

-- =============================================
-- 3. Migrate existing agreement_type data to agreement_type_id
-- =============================================

-- Map old text values to new foreign keys
UPDATE "partnership_agreements" 
SET "agreement_type_id" = (
  SELECT "id" FROM "agreement_types" 
  WHERE LOWER(REPLACE("name_en", ' ', '_')) = LOWER("partnership_agreements"."agreement_type")
     OR LOWER(REPLACE("name_en", ' ', '')) = LOWER(REPLACE("partnership_agreements"."agreement_type", '_', ''))
     OR ("name_en" = 'MoU' AND "partnership_agreements"."agreement_type" = 'mou')
     OR ("name_en" = 'NDA' AND "partnership_agreements"."agreement_type" = 'nda')
     OR ("name_en" = 'Sponsorship Agreement' AND "partnership_agreements"."agreement_type" IN ('sponsorship', 'sponsorship_agreement'))
     OR ("name_en" = 'Collaboration Agreement' AND "partnership_agreements"."agreement_type" IN ('collaboration', 'collaboration_agreement'))
     OR ("name_en" = 'Service Agreement' AND "partnership_agreements"."agreement_type" = 'service_agreement')
     OR ("name_en" = 'Contract' AND "partnership_agreements"."agreement_type" = 'contract')
     OR ("name_en" = 'Letter of Intent' AND "partnership_agreements"."agreement_type" = 'letter_of_intent')
     OR ("name_en" = 'Other' AND "partnership_agreements"."agreement_type" = 'other')
  LIMIT 1
)
WHERE "agreement_type" IS NOT NULL;

-- =============================================
-- 4. Drop old agreement_type column
-- =============================================

ALTER TABLE "partnership_agreements" 
DROP COLUMN IF EXISTS "agreement_type";

-- =============================================
-- 5. Add index for performance
-- =============================================

CREATE INDEX IF NOT EXISTS "IDX_partnership_agreements_agreement_type_id" 
ON "partnership_agreements"("agreement_type_id");
