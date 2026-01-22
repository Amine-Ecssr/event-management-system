-- Migration: Add event_invitees table for tracking event invitations
-- This table links contacts to events they were invited to (distinct from attendees and speakers)

-- Create event_invitees junction table
CREATE TABLE IF NOT EXISTS "event_invitees" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" varchar NOT NULL,
  "contact_id" integer NOT NULL,
  "rsvp" boolean NOT NULL DEFAULT false,
  "registered" boolean NOT NULL DEFAULT false,
  "invite_email_sent" boolean NOT NULL DEFAULT false,
  "invited_at" timestamp DEFAULT now(),
  "rsvp_at" timestamp,
  "registered_at" timestamp,
  "invite_email_sent_at" timestamp,
  "notes" text,
  "created_at" timestamp DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE "event_invitees" 
  ADD CONSTRAINT "event_invitees_event_id_fkey" 
  FOREIGN KEY ("event_id") 
  REFERENCES "events"("id") 
  ON DELETE CASCADE;

ALTER TABLE "event_invitees" 
  ADD CONSTRAINT "event_invitees_contact_id_fkey" 
  FOREIGN KEY ("contact_id") 
  REFERENCES "contacts"("id") 
  ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "IDX_event_invitees_event_id" ON "event_invitees"("event_id");
CREATE INDEX IF NOT EXISTS "IDX_event_invitees_contact_id" ON "event_invitees"("contact_id");
CREATE INDEX IF NOT EXISTS "IDX_event_invitees_rsvp" ON "event_invitees"("rsvp");
CREATE INDEX IF NOT EXISTS "IDX_event_invitees_registered" ON "event_invitees"("registered");
CREATE INDEX IF NOT EXISTS "IDX_event_invitees_invite_email_sent" ON "event_invitees"("invite_email_sent");

-- Add unique constraint to prevent duplicate invitation records
ALTER TABLE "event_invitees" 
  ADD CONSTRAINT "unique_event_invitee" 
  UNIQUE("event_id", "contact_id");

-- Add comment for documentation
COMMENT ON TABLE "event_invitees" IS 'Junction table linking events to contacts who were invited. Tracks RSVP, registration status, and email delivery for conversion rate analysis in engagement page.';
COMMENT ON COLUMN "event_invitees"."rsvp" IS 'Whether the invitee has confirmed attendance (RSVP). False by default.';
COMMENT ON COLUMN "event_invitees"."rsvp_at" IS 'Timestamp when RSVP was confirmed/updated.';
COMMENT ON COLUMN "event_invitees"."registered" IS 'Whether the invitee has registered online. False by default. Helps track registration vs attendance conversion.';
COMMENT ON COLUMN "event_invitees"."registered_at" IS 'Timestamp when registration was completed.';
COMMENT ON COLUMN "event_invitees"."invite_email_sent" IS 'Whether the invitation email was sent to this invitee. False by default. Used by email sending feature.';
COMMENT ON COLUMN "event_invitees"."invite_email_sent_at" IS 'Timestamp when invitation email was sent.';
