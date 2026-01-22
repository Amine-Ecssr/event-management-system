-- Add due_date_basis column to department_requirements
-- This column determines whether the task due date defaults to event_start or event_end

ALTER TABLE "department_requirements" 
ADD COLUMN IF NOT EXISTS "due_date_basis" TEXT NOT NULL DEFAULT 'event_end';

-- Add comment for clarity
COMMENT ON COLUMN "department_requirements"."due_date_basis" IS 'Determines default due date for tasks: event_start or event_end';
