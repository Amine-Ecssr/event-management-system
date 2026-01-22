-- Migration: Add invitation email configuration and custom email templates for events
-- Adds invitation email config, custom email templates per event, and email job tracking

-- Add invitation email configuration fields to email_config table
ALTER TABLE "email_config" 
  ADD COLUMN IF NOT EXISTS "invitation_from_email" text,
  ADD COLUMN IF NOT EXISTS "invitation_from_name" text;

COMMENT ON COLUMN "email_config"."invitation_from_email" IS 'Dedicated sender email for event invitations (separate from regular reminders)';
COMMENT ON COLUMN "email_config"."invitation_from_name" IS 'Dedicated sender name for event invitations';

-- Create event_custom_emails table for storing custom invitation emails per event
CREATE TABLE IF NOT EXISTS "event_custom_emails" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" varchar NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "created_by_user_id" integer,
  CONSTRAINT "event_custom_emails_event_id_fkey" 
    FOREIGN KEY ("event_id") 
    REFERENCES "events"("id") 
    ON DELETE CASCADE,
  CONSTRAINT "event_custom_emails_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL
);

-- Only one active custom email per event
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_custom_email_per_event" 
  ON "event_custom_emails"("event_id") 
  WHERE "is_active" = true;

-- Index for performance
CREATE INDEX IF NOT EXISTS "IDX_event_custom_emails_event_id" 
  ON "event_custom_emails"("event_id");

COMMENT ON TABLE "event_custom_emails" IS 'Custom invitation email templates per event. Allows full customization of invitation emails for specific events.';
COMMENT ON COLUMN "event_custom_emails"."is_active" IS 'Whether this custom email template is currently active. Only one can be active per event.';

-- Create invitation_email_jobs table for tracking bulk email sending jobs
CREATE TABLE IF NOT EXISTS "invitation_email_jobs" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" varchar NOT NULL,
  "status" text NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed', 'cancelled'
  "total_recipients" integer NOT NULL DEFAULT 0,
  "emails_sent" integer NOT NULL DEFAULT 0,
  "emails_failed" integer NOT NULL DEFAULT 0,
  "wait_time_seconds" integer NOT NULL DEFAULT 2, -- Wait time between emails in seconds
  "use_custom_email" boolean NOT NULL DEFAULT false, -- Whether to use custom email or generic template
  "started_at" timestamp,
  "completed_at" timestamp,
  "error_message" text,
  "created_at" timestamp DEFAULT now(),
  "created_by_user_id" integer,
  CONSTRAINT "invitation_email_jobs_event_id_fkey" 
    FOREIGN KEY ("event_id") 
    REFERENCES "events"("id") 
    ON DELETE CASCADE,
  CONSTRAINT "invitation_email_jobs_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL
);

-- Indexes for querying jobs
CREATE INDEX IF NOT EXISTS "IDX_invitation_email_jobs_event_id" 
  ON "invitation_email_jobs"("event_id");
CREATE INDEX IF NOT EXISTS "IDX_invitation_email_jobs_status" 
  ON "invitation_email_jobs"("status");
CREATE INDEX IF NOT EXISTS "IDX_invitation_email_jobs_created_at" 
  ON "invitation_email_jobs"("created_at");

COMMENT ON TABLE "invitation_email_jobs" IS 'Tracks bulk invitation email sending jobs. Each job processes invitees sequentially with configured wait times.';
COMMENT ON COLUMN "invitation_email_jobs"."wait_time_seconds" IS 'Seconds to wait between sending each email to avoid rate limiting';
COMMENT ON COLUMN "invitation_email_jobs"."use_custom_email" IS 'If true, uses event-specific custom email; if false, uses generic template';

-- Add generic invitation email templates to email_templates table
-- English template
INSERT INTO "email_templates" ("type", "language", "subject", "body", "greeting", "footer", "brand_color", "text_color", "bg_color", "font_family", "font_size", "is_rtl")
VALUES (
  'invitation',
  'en',
  'You are invited: {{eventName}}',
  '<h1 style="color: {{brandColor}};">{{eventName}}</h1>
<p>{{description}}</p>
<div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-left: 4px solid {{brandColor}};">
  <p><strong>Date:</strong> {{startDate}} - {{endDate}}</p>
  <p><strong>Time:</strong> {{startTime}} - {{endTime}}</p>
  <p><strong>Location:</strong> {{location}}</p>
  <p><strong>Organizers:</strong> {{organizers}}</p>
</div>
<p>We look forward to your participation in this event.</p>
{{#if url}}
<p><a href="{{url}}" style="display: inline-block; padding: 10px 20px; background-color: {{brandColor}}; color: white; text-decoration: none; border-radius: 5px;">More Information</a></p>
{{/if}}',
  'Dear {{contactName}},',
  '<p>Best regards,<br/>ECSSR Events Team</p>',
  '#BC9F6D',
  '#333333',
  '#FFFFFF',
  'Arial, sans-serif',
  '16px',
  false
)
ON CONFLICT ("type", "language") DO UPDATE SET
  "subject" = EXCLUDED."subject",
  "body" = EXCLUDED."body",
  "greeting" = EXCLUDED."greeting",
  "footer" = EXCLUDED."footer",
  "updated_at" = now();

-- Arabic template
INSERT INTO "email_templates" ("type", "language", "subject", "body", "greeting", "footer", "brand_color", "text_color", "bg_color", "font_family", "font_size", "is_rtl")
VALUES (
  'invitation',
  'ar',
  'دعوة للحضور: {{eventName}}',
  '<h1 style="color: {{brandColor}};">{{eventName}}</h1>
<p>{{description}}</p>
<div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-right: 4px solid {{brandColor}};">
  <p><strong>التاريخ:</strong> {{startDate}} - {{endDate}}</p>
  <p><strong>الوقت:</strong> {{startTime}} - {{endTime}}</p>
  <p><strong>الموقع:</strong> {{location}}</p>
  <p><strong>المنظمون:</strong> {{organizers}}</p>
</div>
<p>نتطلع إلى مشاركتكم في هذه الفعالية.</p>
{{#if url}}
<p><a href="{{url}}" style="display: inline-block; padding: 10px 20px; background-color: {{brandColor}}; color: white; text-decoration: none; border-radius: 5px;">المزيد من المعلومات</a></p>
{{/if}}',
  'عزيزي {{contactName}}،',
  '<p>مع أطيب التحيات،<br/>فريق فعاليات المركز</p>',
  '#BC9F6D',
  '#333333',
  '#FFFFFF',
  'Arial, sans-serif',
  '16px',
  true
)
ON CONFLICT ("type", "language") DO UPDATE SET
  "subject" = EXCLUDED."subject",
  "body" = EXCLUDED."body",
  "greeting" = EXCLUDED."greeting",
  "footer" = EXCLUDED."footer",
  "updated_at" = now();
