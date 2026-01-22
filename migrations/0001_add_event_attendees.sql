-- Migration: Add event_attendees table for tracking event attendance
-- This table links contacts to events they attended (distinct from speakers)

-- Create event_attendees junction table
CREATE TABLE IF NOT EXISTS "event_attendees" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" varchar NOT NULL,
  "contact_id" integer NOT NULL,
  "attended_at" timestamp DEFAULT now(),
  "notes" text,
  "created_at" timestamp DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE "event_attendees" 
  ADD CONSTRAINT "event_attendees_event_id_fkey" 
  FOREIGN KEY ("event_id") 
  REFERENCES "events"("id") 
  ON DELETE CASCADE;

ALTER TABLE "event_attendees" 
  ADD CONSTRAINT "event_attendees_contact_id_fkey" 
  FOREIGN KEY ("contact_id") 
  REFERENCES "contacts"("id") 
  ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "IDX_event_attendees_event_id" ON "event_attendees"("event_id");
CREATE INDEX IF NOT EXISTS "IDX_event_attendees_contact_id" ON "event_attendees"("contact_id");

-- Add unique constraint to prevent duplicate attendance records
ALTER TABLE "event_attendees" 
  ADD CONSTRAINT "unique_event_attendee" 
  UNIQUE("event_id", "contact_id");

-- Add comment for documentation
COMMENT ON TABLE "event_attendees" IS 'Junction table linking events to contacts who attended. Privacy note: This data is NOT transferred to archived events - only the count is stored in archived_events.actualAttendees.';
