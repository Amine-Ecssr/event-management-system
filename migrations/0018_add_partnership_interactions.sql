-- Migration: Add Partnership Interactions and Partnership Tasks
-- This migration adds interaction tracking for partnerships (similar to lead_interactions)
-- and extends the tasks table to support partnership-linked tasks

-- ==================== Partnership Interactions Table ====================
-- Stores timeline of interactions with partnerships (emails, calls, meetings, etc.)

CREATE TABLE IF NOT EXISTS "partnership_interactions" (
  "id" SERIAL PRIMARY KEY,
  "organization_id" INTEGER NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  
  -- Interaction type: email, phone_call, meeting, document_sent, proposal_submitted, review_session, other
  "type" TEXT NOT NULL,
  
  -- Content
  "description" TEXT NOT NULL,
  "description_ar" TEXT,
  
  -- Outcome (optional - what resulted from this interaction)
  "outcome" TEXT,
  "outcome_ar" TEXT,
  
  -- Date/time of interaction
  "interaction_date" TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Metadata
  "created_by_user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP DEFAULT NOW()
);

-- Create indexes for partnership_interactions
CREATE INDEX IF NOT EXISTS "IDX_partnership_interactions_org_id" ON "partnership_interactions"("organization_id");
CREATE INDEX IF NOT EXISTS "IDX_partnership_interactions_type" ON "partnership_interactions"("type");
CREATE INDEX IF NOT EXISTS "IDX_partnership_interactions_date" ON "partnership_interactions"("interaction_date");

COMMENT ON TABLE "partnership_interactions" IS 'Timeline of interactions with partnerships - emails, calls, meetings, etc.';
COMMENT ON COLUMN "partnership_interactions"."type" IS 'Type of interaction: email, phone_call, meeting, document_sent, proposal_submitted, review_session, other';
COMMENT ON COLUMN "partnership_interactions"."organization_id" IS 'References the partner organization';

-- ==================== Extend Tasks Table for Partnerships ====================
-- Add partnership_id column to tasks table to support partnership-linked tasks
-- (Tasks can now belong to events, leads, OR partnerships - mutually exclusive)

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "partnership_id" INTEGER REFERENCES "organizations"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "IDX_tasks_partnership_id" ON "tasks"("partnership_id");

-- Add comments for clarity
COMMENT ON COLUMN "tasks"."partnership_id" IS 'References organizations for partnership-based tasks (mutually exclusive with event_department_id and lead_id)';

-- Note: The application layer enforces that only one of event_department_id, lead_id, or partnership_id is set
-- We don't add a database constraint because:
-- 1. It requires modifying existing rows
-- 2. The existing schema allows nullable FKs
-- 3. Application validation is sufficient
