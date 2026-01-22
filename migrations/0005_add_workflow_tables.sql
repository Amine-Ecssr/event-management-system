-- Migration: Add Task Workflow Tables
-- Created: December 7, 2025
-- Description: Adds support for task template prerequisites and event workflows

-- Step 1: Add 'waiting' status to tasks table
-- First, we need to drop and recreate the constraint to include the new status
-- Note: PostgreSQL doesn't have a native ENUM type in this schema, status is TEXT with app-level validation

-- Step 2: Create prerequisite templates table
-- Links task templates (department_requirements) to their prerequisites
CREATE TABLE IF NOT EXISTS "task_template_prerequisites" (
  "id" SERIAL PRIMARY KEY,
  "task_template_id" INTEGER NOT NULL,
  "prerequisite_template_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW(),
  CONSTRAINT "task_template_prerequisites_task_template_id_fk" 
    FOREIGN KEY ("task_template_id") 
    REFERENCES "department_requirements"("id") 
    ON DELETE CASCADE,
  CONSTRAINT "task_template_prerequisites_prerequisite_template_id_fk" 
    FOREIGN KEY ("prerequisite_template_id") 
    REFERENCES "department_requirements"("id") 
    ON DELETE CASCADE,
  CONSTRAINT "unique_task_prerequisite" 
    UNIQUE ("task_template_id", "prerequisite_template_id"),
  -- Prevent self-referencing prerequisites
  CONSTRAINT "no_self_prerequisite" 
    CHECK ("task_template_id" != "prerequisite_template_id")
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS "idx_prerequisite_task_template" 
  ON "task_template_prerequisites"("task_template_id");
CREATE INDEX IF NOT EXISTS "idx_prerequisite_template" 
  ON "task_template_prerequisites"("prerequisite_template_id");

-- Step 3: Create event workflows table
-- Groups related tasks within an event (tasks linked by prerequisites)
CREATE TABLE IF NOT EXISTS "event_workflows" (
  "id" SERIAL PRIMARY KEY,
  "event_id" VARCHAR NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "created_by_user_id" INTEGER,
  CONSTRAINT "event_workflows_event_id_fk" 
    FOREIGN KEY ("event_id") 
    REFERENCES "events"("id") 
    ON DELETE CASCADE,
  CONSTRAINT "event_workflows_created_by_user_id_fk" 
    FOREIGN KEY ("created_by_user_id") 
    REFERENCES "users"("id") 
    ON DELETE SET NULL
);

-- Index for fast event lookup
CREATE INDEX IF NOT EXISTS "idx_event_workflows_event_id" 
  ON "event_workflows"("event_id");

-- Step 4: Create workflow tasks junction table
-- Links individual tasks to workflows and tracks their prerequisites
CREATE TABLE IF NOT EXISTS "workflow_tasks" (
  "id" SERIAL PRIMARY KEY,
  "workflow_id" INTEGER NOT NULL,
  "task_id" INTEGER NOT NULL,
  "prerequisite_task_id" INTEGER,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT NOW(),
  CONSTRAINT "workflow_tasks_workflow_id_fk" 
    FOREIGN KEY ("workflow_id") 
    REFERENCES "event_workflows"("id") 
    ON DELETE CASCADE,
  CONSTRAINT "workflow_tasks_task_id_fk" 
    FOREIGN KEY ("task_id") 
    REFERENCES "tasks"("id") 
    ON DELETE CASCADE,
  CONSTRAINT "workflow_tasks_prerequisite_task_id_fk" 
    FOREIGN KEY ("prerequisite_task_id") 
    REFERENCES "tasks"("id") 
    ON DELETE SET NULL,
  CONSTRAINT "unique_workflow_task" 
    UNIQUE ("workflow_id", "task_id")
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS "idx_workflow_tasks_workflow_id" 
  ON "workflow_tasks"("workflow_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_tasks_task_id" 
  ON "workflow_tasks"("task_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_tasks_prerequisite" 
  ON "workflow_tasks"("prerequisite_task_id");
