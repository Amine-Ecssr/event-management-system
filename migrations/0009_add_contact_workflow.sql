-- Migration: Add Lead Management System
-- This migration creates tables for lead tracking, interactions, and tasks
-- Then unifies the tasks table to support both events and leads

-- =============================================
-- 1. Leads table
-- =============================================
-- This is for tracking external leads in partnership workflows,
-- separate from internal contacts in the 'contacts' table

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  
  -- Contact information
  name TEXT NOT NULL,
  name_ar TEXT,
  email TEXT,
  phone TEXT,
  
  -- Classification
  type TEXT NOT NULL DEFAULT 'lead', -- 'lead', 'partner', 'customer', 'vendor', 'other'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'in_progress', 'inactive'
  
  -- Optional link to organization
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  organization_name TEXT, -- For display when no organization link
  
  -- Notes
  notes TEXT,
  notes_ar TEXT,
  
  -- Metadata
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS IDX_leads_type ON leads(type);
CREATE INDEX IF NOT EXISTS IDX_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS IDX_leads_organization ON leads(organization_id);
CREATE INDEX IF NOT EXISTS IDX_leads_name ON leads(name);

-- =============================================
-- 2. Lead Interactions table
-- =============================================
-- Timeline of interactions with a lead

CREATE TABLE IF NOT EXISTS lead_interactions (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  
  -- Interaction type
  type TEXT NOT NULL, -- 'email', 'phone_call', 'meeting', 'other'
  
  -- Content
  description TEXT NOT NULL,
  description_ar TEXT,
  
  -- Outcome (optional - what resulted from this interaction)
  outcome TEXT,
  outcome_ar TEXT,
  
  -- Date/time of interaction
  interaction_date TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Metadata
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS IDX_lead_interactions_lead_id ON lead_interactions(lead_id);
CREATE INDEX IF NOT EXISTS IDX_lead_interactions_type ON lead_interactions(type);
CREATE INDEX IF NOT EXISTS IDX_lead_interactions_date ON lead_interactions(interaction_date);

-- =============================================
-- 3. Unify Tasks Table to Support Both Events and Leads
-- =============================================

-- Make eventDepartmentId nullable to allow lead-only tasks
ALTER TABLE "tasks" ALTER COLUMN "event_department_id" DROP NOT NULL;

-- Add lead_id to tasks table
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "lead_id" INTEGER REFERENCES "leads"("id") ON DELETE CASCADE;

-- Add priority field to tasks (to match lead_tasks)
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'medium';

-- Add check constraint to ensure task belongs to either event or lead (not both, not neither)
ALTER TABLE "tasks" ADD CONSTRAINT "task_belongs_to_event_or_lead" 
  CHECK (
    (event_department_id IS NOT NULL AND lead_id IS NULL) OR 
    (event_department_id IS NULL AND lead_id IS NOT NULL)
  );

-- Add departmentId for direct department assignment (used for lead tasks)
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "department_id" INTEGER REFERENCES "departments"("id") ON DELETE SET NULL;

-- Add notification_emails column for consistency with lead workflow needs
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "notification_emails" TEXT[];

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS "IDX_tasks_lead_id" ON "tasks"("lead_id");
CREATE INDEX IF NOT EXISTS "IDX_tasks_department_id" ON "tasks"("department_id");
CREATE INDEX IF NOT EXISTS "IDX_tasks_priority" ON "tasks"("priority");

-- Comment on the unified structure
COMMENT ON COLUMN "tasks"."event_department_id" IS 'References event_departments for event-based tasks (mutually exclusive with lead_id)';
COMMENT ON COLUMN "tasks"."lead_id" IS 'References leads for lead-based tasks (mutually exclusive with event_department_id)';
COMMENT ON COLUMN "tasks"."department_id" IS 'Direct department assignment for lead tasks (used when lead_id is set)';
COMMENT ON COLUMN "tasks"."priority" IS 'Task priority: high, medium, or low';
