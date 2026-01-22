-- Unified Initial Schema Migration for EventVue
-- Creates all necessary tables for the ECSSR Events Calendar system
-- This is a consolidated migration for fresh installations

-- Users table for authentication
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"password" text,
	"role" text DEFAULT 'admin' NOT NULL,
	"keycloak_id" text,
	"email" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_keycloak_id_unique" UNIQUE("keycloak_id")
);

-- Auth identities table for managing multiple auth providers
CREATE TABLE "auth_identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"external_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Session management table
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);

-- Categories table for event categorization
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "categories_name_en_unique" UNIQUE("name_en")
);

-- Events table - main event data
-- Consolidated columns: agenda fields (from migration 0001) and archive fields (from migration 0002)
CREATE TABLE "events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"description" text,
	"description_ar" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"start_time" varchar(5),
	"end_time" varchar(5),
	"location" text,
	"location_ar" text,
	"organizers" text,
	"organizers_ar" text,
	"url" text,
	"category" text,
	"category_ar" text,
	"category_id" integer,
	"event_type" text DEFAULT 'local' NOT NULL,
	"event_scope" text DEFAULT 'external' NOT NULL,
	"expected_attendance" integer,
	"is_scraped" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"admin_modified" boolean DEFAULT false NOT NULL,
	"reminder_1_week" boolean DEFAULT true NOT NULL,
	"reminder_1_day" boolean DEFAULT true NOT NULL,
	"reminder_weekly" boolean DEFAULT false NOT NULL,
	"reminder_daily" boolean DEFAULT false NOT NULL,
	"reminder_morning_of" boolean DEFAULT false NOT NULL,
	-- Agenda file columns (originally from migration 0001)
	"agenda_en_file_name" text,
	"agenda_en_stored_file_name" text,
	"agenda_ar_file_name" text,
	"agenda_ar_stored_file_name" text,
	-- Archive feature columns (originally from migration 0002)
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp
);

-- Reminder queue table for scheduled reminders
CREATE TABLE "reminder_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"reminder_type" varchar NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_reminder" UNIQUE("event_id","scheduled_for","reminder_type")
);

-- Core system settings table
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_csv_export" boolean DEFAULT false NOT NULL,
	"file_uploads_enabled" boolean DEFAULT false NOT NULL,
	"scraped_events_enabled" boolean DEFAULT true NOT NULL,
	"daily_reminder_global_enabled" boolean DEFAULT false NOT NULL,
	"daily_reminder_global_time" text DEFAULT '08:00'
);

-- Email configuration table
CREATE TABLE "email_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"provider" text DEFAULT 'resend' NOT NULL,
	"api_key" text,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_secure" boolean DEFAULT true,
	"smtp_user" text,
	"smtp_password" text,
	"from_email" text,
	"from_name" text,
	"default_recipients" text,
	"global_cc_list" text,
	"language" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Email templates table for different email types and languages
CREATE TABLE "email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"subject" text,
	"body" text,
	"greeting" text,
	"footer" text,
	"requirements_title" text,
	"custom_requirements_title" text,
	"requirement_item_template" text,
	"brand_color" text DEFAULT '#BC9F6D',
	"text_color" text DEFAULT '#333333',
	"bg_color" text DEFAULT '#FFFFFF',
	"font_family" text DEFAULT 'Arial, sans-serif',
	"font_size" text DEFAULT '16px',
	"requirements_brand_color" text DEFAULT '#BC9F6D',
	"requirements_text_color" text DEFAULT '#333333',
	"requirements_bg_color" text DEFAULT '#F5F5F5',
	"requirements_font_family" text DEFAULT 'Arial, sans-serif',
	"requirements_font_size" text DEFAULT '16px',
	"footer_brand_color" text DEFAULT '#BC9F6D',
	"footer_text_color" text DEFAULT '#666666',
	"footer_bg_color" text DEFAULT '#FFFFFF',
	"footer_font_family" text DEFAULT 'Arial, sans-serif',
	"footer_font_size" text DEFAULT '14px',
	"is_rtl" boolean DEFAULT false NOT NULL,
	"additional_config" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_email_template" UNIQUE("type","language")
);

-- WhatsApp configuration table
CREATE TABLE "whatsapp_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"chat_id" text,
	"chat_name" text,
	"updates_chat_id" text,
	"updates_chat_name" text,
	"language" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- WhatsApp templates table for message templates
CREATE TABLE "whatsapp_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"template" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_whatsapp_template" UNIQUE("type","language")
);

-- Departments table for managing stakeholder organizations
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"keycloak_group_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"cc_list" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "departments_name_unique" UNIQUE("name"),
	CONSTRAINT "departments_keycloak_group_id_unique" UNIQUE("keycloak_group_id")
);

-- Department emails table
CREATE TABLE "department_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"department_id" integer NOT NULL,
	"email" text NOT NULL,
	"label" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);

-- Department accounts table for linking users to departments
CREATE TABLE "department_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"department_id" integer NOT NULL,
	"primary_email_id" integer NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "department_accounts_user_id_unique" UNIQUE("user_id")
);

-- Department requirements table for task templates
CREATE TABLE "department_requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"department_id" integer NOT NULL,
	"title" text NOT NULL,
	"title_ar" text,
	"description" text,
	"description_ar" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"notification_emails" text[],
	"created_at" timestamp DEFAULT now()
);

-- Event departments junction table
CREATE TABLE "event_departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"department_id" integer NOT NULL,
	"selected_requirement_ids" text[],
	"custom_requirements" text,
	"notify_on_create" boolean DEFAULT true NOT NULL,
	"notify_on_update" boolean DEFAULT false NOT NULL,
	"daily_reminder_enabled" boolean DEFAULT false NOT NULL,
	"daily_reminder_time" text DEFAULT '08:00',
	"last_reminder_sent_at" timestamp,
	"created_at" timestamp DEFAULT now()
);

-- Tasks table for department-specific event tasks
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_department_id" integer NOT NULL,
	"title" text NOT NULL,
	"title_ar" text,
	"description" text,
	"description_ar" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_date" date,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"notification_emails" text[]
);

-- Task comments table
CREATE TABLE "task_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"author_user_id" integer,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);

-- Task comment attachments table
CREATE TABLE "task_comment_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"stored_file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"uploaded_by_user_id" integer
);

-- Updates table for department periodic updates
CREATE TABLE "updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"period_start" date NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"department_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"updated_by_user_id" integer,
	CONSTRAINT "unique_update_period" UNIQUE("type","period_start","department_id")
);

-- Archived events table (from migration 0002)
CREATE TABLE "archived_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"description" text,
	"description_ar" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"start_time" varchar(5),
	"end_time" varchar(5),
	"location" text,
	"location_ar" text,
	"organizers" text,
	"organizers_ar" text,
	"url" text,
	"category" text,
	"category_ar" text,
	"category_id" integer,
	"event_type" text DEFAULT 'local' NOT NULL,
	"event_scope" text DEFAULT 'external' NOT NULL,
	"original_event_id" varchar,
	"actual_attendees" integer,
	"highlights" text,
	"highlights_ar" text,
	"impact" text,
	"impact_ar" text,
	"key_takeaways" text,
	"key_takeaways_ar" text,
	"photo_keys" text[],
	"thumbnail_keys" text[],
	"youtube_video_ids" text[],
	"archived_by_user_id" integer,
	"created_directly" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Archive media table (from migration 0002)
CREATE TABLE "archive_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"archived_event_id" integer NOT NULL,
	"object_key" text NOT NULL,
	"thumbnail_key" text,
	"original_file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"caption" text,
	"caption_ar" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"uploaded_by_user_id" integer,
	"uploaded_at" timestamp DEFAULT now(),
	CONSTRAINT "archive_media_object_key_unique" UNIQUE("object_key")
);

-- Foreign key constraints
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "department_accounts" ADD CONSTRAINT "department_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "department_accounts" ADD CONSTRAINT "department_accounts_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "department_accounts" ADD CONSTRAINT "department_accounts_primary_email_id_department_emails_id_fk" FOREIGN KEY ("primary_email_id") REFERENCES "public"."department_emails"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "department_emails" ADD CONSTRAINT "department_emails_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "department_requirements" ADD CONSTRAINT "department_requirements_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_departments" ADD CONSTRAINT "event_departments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_departments" ADD CONSTRAINT "event_departments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "events" ADD CONSTRAINT "events_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "reminder_queue" ADD CONSTRAINT "reminder_queue_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "task_comment_attachments" ADD CONSTRAINT "task_comment_attachments_comment_id_task_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."task_comments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "task_comment_attachments" ADD CONSTRAINT "task_comment_attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_event_department_id_event_departments_id_fk" FOREIGN KEY ("event_department_id") REFERENCES "public"."event_departments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "updates" ADD CONSTRAINT "updates_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "updates" ADD CONSTRAINT "updates_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "archived_events" ADD CONSTRAINT "archived_events_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "archived_events" ADD CONSTRAINT "archived_events_original_event_id_events_id_fk" FOREIGN KEY ("original_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "archived_events" ADD CONSTRAINT "archived_events_archived_by_user_id_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "archive_media" ADD CONSTRAINT "archive_media_archived_event_id_archived_events_id_fk" FOREIGN KEY ("archived_event_id") REFERENCES "public"."archived_events"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "archive_media" ADD CONSTRAINT "archive_media_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

-- Indexes for performance optimization
CREATE INDEX "IDX_auth_identities_user_id" ON "auth_identities" USING btree ("user_id");
CREATE INDEX "IDX_auth_identities_provider_external" ON "auth_identities" USING btree ("provider","external_id");
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");
CREATE INDEX "IDX_task_comment_attachments_comment_id" ON "task_comment_attachments" USING btree ("comment_id");
CREATE INDEX "IDX_task_comments_task_id" ON "task_comments" USING btree ("task_id");
CREATE INDEX "IDX_tasks_event_department_id" ON "tasks" USING btree ("event_department_id");
CREATE INDEX "IDX_tasks_status" ON "tasks" USING btree ("status");
CREATE INDEX "IDX_updates_type_period" ON "updates" USING btree ("type","period_start");
CREATE INDEX "IDX_updates_department_id" ON "updates" USING btree ("department_id");
CREATE INDEX "IDX_email_templates_type_language" ON "email_templates" USING btree ("type","language");
CREATE INDEX "IDX_whatsapp_templates_type_language" ON "whatsapp_templates" USING btree ("type","language");
CREATE INDEX "IDX_archived_events_original_event_id" ON "archived_events" USING btree ("original_event_id");
CREATE INDEX "IDX_archived_events_start_date" ON "archived_events" USING btree ("start_date");
CREATE INDEX "IDX_archived_events_category_id" ON "archived_events" USING btree ("category_id");
CREATE INDEX "IDX_archive_media_archived_event_id" ON "archive_media" USING btree ("archived_event_id");
CREATE INDEX "IDX_archive_media_display_order" ON "archive_media" USING btree ("archived_event_id","display_order");

-- Insert default settings row
INSERT INTO "settings" (id, public_csv_export, file_uploads_enabled, scraped_events_enabled, daily_reminder_global_enabled, daily_reminder_global_time)
VALUES (1, false, false, true, false, '08:00');

-- Insert default email configuration
INSERT INTO "email_config" (id, enabled, provider, language)
VALUES (1, false, 'resend', 'en');

-- Insert default WhatsApp configuration
INSERT INTO "whatsapp_config" (id, enabled, language)
VALUES (1, false, 'en');

-- Insert default email templates (English)
INSERT INTO "email_templates" (type, language, subject, body, greeting, footer, requirements_title, custom_requirements_title, brand_color, text_color, bg_color, font_family, font_size, is_rtl)
VALUES 
('stakeholder', 'en', 'New Event: {{eventName}}', '<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>Date:</strong> {{startDate}} - {{endDate}}</p><p><strong>Location:</strong> {{location}}</p>', 'Dear {{name}}', '<p>Best regards,<br/>ECSSR Events Team</p>', 'Your Requirements for this Event', 'Additional Requirements:', '#BC9F6D', '#333333', '#FFFFFF', 'Arial, sans-serif', '16px', false),
('reminder', 'en', 'Reminder: {{eventName}}', '<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>Date:</strong> {{startDate}} - {{endDate}}</p>', 'Dear {{name}}', '<p>Best regards,<br/>ECSSR Events Team</p>', 'Your Requirements for this Event', NULL, '#BC9F6D', '#333333', '#FFFFFF', 'Arial, sans-serif', '16px', false),
('management_summary', 'en', 'Event Summary: {{eventName}}', '<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>Date:</strong> {{startDate}} - {{endDate}}</p><p><strong>Expected Attendance:</strong> {{expectedAttendance}}</p>', NULL, '<p>Best regards,<br/>ECSSR Management</p>', 'Stakeholder Assignments', NULL, '#BC9F6D', '#333333', '#FFFFFF', 'Arial, sans-serif', '16px', false),
('task_completion', 'en', 'Task Completed: {{taskTitle}} - {{eventName}}', '<p>Dear Team,</p><p>Kindly note that the following task has been marked as completed:</p>', NULL, '<p>Best regards,<br/>ECSSR Events Team</p>', NULL, NULL, '#BC9F6D', '#333333', '#FFFFFF', 'Arial, sans-serif', '16px', false),
('updates', 'en', NULL, NULL, NULL, NULL, NULL, NULL, '#BC9F6D', '#333333', '#FFFFFF', 'Arial, sans-serif', '16px', false);

-- Insert default email templates (Arabic)
INSERT INTO "email_templates" (type, language, subject, body, greeting, footer, requirements_title, brand_color, text_color, bg_color, font_family, font_size, is_rtl)
VALUES 
('stakeholder', 'ar', 'فعالية جديدة: {{eventName}}', '<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>التاريخ:</strong> {{startDate}} - {{endDate}}</p><p><strong>الموقع:</strong> {{location}}</p>', 'عزيزي {{name}}', '<p>مع أطيب التحيات،<br/>فريق فعاليات المركز</p>', 'متطلباتك لهذه الفعالية', '#BC9F6D', '#333333', '#FFFFFF', 'Arial, sans-serif', '16px', false),
('reminder', 'ar', 'تذكير بالفعالية: {{eventName}}', '<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>التاريخ:</strong> {{startDate}} - {{endDate}}</p>', 'عزيزي {{name}}', '<p>مع أطيب التحيات،<br/>فريق فعاليات المركز</p>', 'متطلباتك لهذه الفعالية', '#BC9F6D', '#333333', '#FFFFFF', 'Arial, sans-serif', '16px', false),
('management_summary', 'ar', 'ملخص إداري: {{eventName}}', '<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>التاريخ:</strong> {{startDate}} - {{endDate}}</p><p><strong>العدد المتوقع للحضور:</strong> {{expectedAttendance}}</p>', NULL, '<p>مع أطيب التحيات،<br/>إدارة المركز</p>', 'تكليفات أصحاب المصلحة', '#BC9F6D', '#333333', '#FFFFFF', 'Arial, sans-serif', '16px', false),
('task_completion', 'ar', 'تم إنجاز المهمة: {{taskTitle}} - {{eventName}}', '<p>عزيزي الفريق،</p><p>يرجى العلم بأنه تم إنجاز المهمة التالية:</p>', NULL, '<p>مع أطيب التحيات،<br/>فريق فعاليات المركز</p>', NULL, '#BC9F6D', '#333333', '#FFFFFF', 'Arial, sans-serif', '16px', false),
('updates', 'ar', NULL, NULL, NULL, NULL, NULL, '#BC9F6D', '#333333', '#FFFFFF', 'Arial, sans-serif', '16px', false);

-- Insert default WhatsApp templates (English)
INSERT INTO "whatsapp_templates" (type, language, template)
VALUES 
('event_created', 'en', '🎉 New Event Created!\n\n📅 {{eventName}}\n📍 {{location}}\n🕐 {{startDate}} - {{endDate}}\n\n{{description}}'),
('reminder', 'en', '⏰ Event Reminder\n\n📅 {{eventName}}\n📍 {{location}}\n🕐 {{startDate}}\n\n{{description}}');

-- Insert default WhatsApp templates (Arabic)
INSERT INTO "whatsapp_templates" (type, language, template)
VALUES 
('event_created', 'ar', '🎉 تم إنشاء حدث جديد!\n\n📅 {{eventName}}\n📍 {{location}}\n🕐 {{startDate}} - {{endDate}}\n\n{{description}}'),
('reminder', 'ar', '⏰ تذكير بالحدث\n\n📅 {{eventName}}\n📍 {{location}}\n🕐 {{startDate}}\n\n{{description}}');

-- ============================================================================
-- Contacts & Event Speakers Feature
-- ============================================================================

-- Organizations table (editable dropdown values)
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "organizations_name_en_unique" UNIQUE("name_en")
);

-- Positions table (editable dropdown values)
CREATE TABLE "positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "positions_name_en_unique" UNIQUE("name_en")
);

-- Countries table (pre-populated, NOT user-editable)
CREATE TABLE "countries" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(2) NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text,
	CONSTRAINT "countries_code_unique" UNIQUE("code")
);

-- Contacts table
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text,
	"title" text,
	"title_ar" text,
	"organization_id" integer,
	"position_id" integer,
	"country_id" integer,
	"phone" text,
	"email" text,
	"profile_picture_key" text,
	"profile_picture_thumbnail_key" text,
	"is_eligible_speaker" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Event speakers junction table
CREATE TABLE "event_speakers" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"contact_id" integer NOT NULL,
	"role" text,
	"role_ar" text,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "event_speakers_event_contact_unique" UNIQUE("event_id", "contact_id")
);

-- Archived event speakers junction table
CREATE TABLE "archived_event_speakers" (
	"id" serial PRIMARY KEY NOT NULL,
	"archived_event_id" integer NOT NULL,
	"contact_id" integer,
	"role" text,
	"role_ar" text,
	"display_order" integer DEFAULT 0,
	"speaker_name_en" text,
	"speaker_name_ar" text,
	"speaker_title" text,
	"speaker_title_ar" text,
	"speaker_position" text,
	"speaker_position_ar" text,
	"speaker_organization" text,
	"speaker_organization_ar" text,
	"speaker_profile_picture_key" text,
	"speaker_profile_picture_thumbnail_key" text,
	"created_at" timestamp DEFAULT now()
);

-- Foreign key constraints for contacts feature
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "event_speakers" ADD CONSTRAINT "event_speakers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_speakers" ADD CONSTRAINT "event_speakers_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "archived_event_speakers" ADD CONSTRAINT "archived_event_speakers_archived_event_id_archived_events_id_fk" FOREIGN KEY ("archived_event_id") REFERENCES "public"."archived_events"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "archived_event_speakers" ADD CONSTRAINT "archived_event_speakers_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;

-- Indexes for contacts feature
CREATE INDEX "IDX_contacts_organization_id" ON "contacts" USING btree ("organization_id");
CREATE INDEX "IDX_contacts_position_id" ON "contacts" USING btree ("position_id");
CREATE INDEX "IDX_contacts_country_id" ON "contacts" USING btree ("country_id");
CREATE INDEX "IDX_contacts_is_eligible_speaker" ON "contacts" USING btree ("is_eligible_speaker");
CREATE INDEX "IDX_event_speakers_event_id" ON "event_speakers" USING btree ("event_id");
CREATE INDEX "IDX_event_speakers_contact_id" ON "event_speakers" USING btree ("contact_id");
CREATE INDEX "IDX_archived_event_speakers_archived_event_id" ON "archived_event_speakers" USING btree ("archived_event_id");
CREATE INDEX "IDX_archived_event_speakers_contact_id" ON "archived_event_speakers" USING btree ("contact_id");

-- Seed countries table with ISO 3166-1 countries
INSERT INTO "countries" (code, name_en, name_ar) VALUES
('AE', 'United Arab Emirates', 'الإمارات العربية المتحدة'),
('AF', 'Afghanistan', 'أفغانستان'),
('AL', 'Albania', 'ألبانيا'),
('DZ', 'Algeria', 'الجزائر'),
('AD', 'Andorra', 'أندورا'),
('AO', 'Angola', 'أنغولا'),
('AG', 'Antigua and Barbuda', 'أنتيغوا وباربودا'),
('AR', 'Argentina', 'الأرجنتين'),
('AM', 'Armenia', 'أرمينيا'),
('AU', 'Australia', 'أستراليا'),
('AT', 'Austria', 'النمسا'),
('AZ', 'Azerbaijan', 'أذربيجان'),
('BS', 'Bahamas', 'جزر البهاما'),
('BH', 'Bahrain', 'البحرين'),
('BD', 'Bangladesh', 'بنغلاديش'),
('BB', 'Barbados', 'باربادوس'),
('BY', 'Belarus', 'بيلاروسيا'),
('BE', 'Belgium', 'بلجيكا'),
('BZ', 'Belize', 'بليز'),
('BJ', 'Benin', 'بنين'),
('BT', 'Bhutan', 'بوتان'),
('BO', 'Bolivia', 'بوليفيا'),
('BA', 'Bosnia and Herzegovina', 'البوسنة والهرسك'),
('BW', 'Botswana', 'بوتسوانا'),
('BR', 'Brazil', 'البرازيل'),
('BN', 'Brunei', 'بروناي'),
('BG', 'Bulgaria', 'بلغاريا'),
('BF', 'Burkina Faso', 'بوركينا فاسو'),
('BI', 'Burundi', 'بوروندي'),
('CV', 'Cabo Verde', 'الرأس الأخضر'),
('KH', 'Cambodia', 'كمبوديا'),
('CM', 'Cameroon', 'الكاميرون'),
('CA', 'Canada', 'كندا'),
('CF', 'Central African Republic', 'جمهورية أفريقيا الوسطى'),
('TD', 'Chad', 'تشاد'),
('CL', 'Chile', 'تشيلي'),
('CN', 'China', 'الصين'),
('CO', 'Colombia', 'كولومبيا'),
('KM', 'Comoros', 'جزر القمر'),
('CG', 'Congo', 'الكونغو'),
('CD', 'Congo (DRC)', 'الكونغو الديمقراطية'),
('CR', 'Costa Rica', 'كوستاريكا'),
('CI', 'Côte d''Ivoire', 'ساحل العاج'),
('HR', 'Croatia', 'كرواتيا'),
('CU', 'Cuba', 'كوبا'),
('CY', 'Cyprus', 'قبرص'),
('CZ', 'Czechia', 'التشيك'),
('DK', 'Denmark', 'الدنمارك'),
('DJ', 'Djibouti', 'جيبوتي'),
('DM', 'Dominica', 'دومينيكا'),
('DO', 'Dominican Republic', 'جمهورية الدومينيكان'),
('EC', 'Ecuador', 'الإكوادور'),
('EG', 'Egypt', 'مصر'),
('SV', 'El Salvador', 'السلفادور'),
('GQ', 'Equatorial Guinea', 'غينيا الاستوائية'),
('ER', 'Eritrea', 'إريتريا'),
('EE', 'Estonia', 'إستونيا'),
('SZ', 'Eswatini', 'إسواتيني'),
('ET', 'Ethiopia', 'إثيوبيا'),
('FJ', 'Fiji', 'فيجي'),
('FI', 'Finland', 'فنلندا'),
('FR', 'France', 'فرنسا'),
('GA', 'Gabon', 'الغابون'),
('GM', 'Gambia', 'غامبيا'),
('GE', 'Georgia', 'جورجيا'),
('DE', 'Germany', 'ألمانيا'),
('GH', 'Ghana', 'غانا'),
('GR', 'Greece', 'اليونان'),
('GD', 'Grenada', 'غرينادا'),
('GT', 'Guatemala', 'غواتيمالا'),
('GN', 'Guinea', 'غينيا'),
('GW', 'Guinea-Bissau', 'غينيا بيساو'),
('GY', 'Guyana', 'غيانا'),
('HT', 'Haiti', 'هايتي'),
('HN', 'Honduras', 'هندوراس'),
('HU', 'Hungary', 'المجر'),
('IS', 'Iceland', 'آيسلندا'),
('IN', 'India', 'الهند'),
('ID', 'Indonesia', 'إندونيسيا'),
('IR', 'Iran', 'إيران'),
('IQ', 'Iraq', 'العراق'),
('IE', 'Ireland', 'أيرلندا'),
('IL', 'Israel', 'إسرائيل'),
('IT', 'Italy', 'إيطاليا'),
('JM', 'Jamaica', 'جامايكا'),
('JP', 'Japan', 'اليابان'),
('JO', 'Jordan', 'الأردن'),
('KZ', 'Kazakhstan', 'كازاخستان'),
('KE', 'Kenya', 'كينيا'),
('KI', 'Kiribati', 'كيريباتي'),
('KP', 'North Korea', 'كوريا الشمالية'),
('KR', 'South Korea', 'كوريا الجنوبية'),
('KW', 'Kuwait', 'الكويت'),
('KG', 'Kyrgyzstan', 'قيرغيزستان'),
('LA', 'Laos', 'لاوس'),
('LV', 'Latvia', 'لاتفيا'),
('LB', 'Lebanon', 'لبنان'),
('LS', 'Lesotho', 'ليسوتو'),
('LR', 'Liberia', 'ليبيريا'),
('LY', 'Libya', 'ليبيا'),
('LI', 'Liechtenstein', 'ليختنشتاين'),
('LT', 'Lithuania', 'ليتوانيا'),
('LU', 'Luxembourg', 'لوكسمبورغ'),
('MG', 'Madagascar', 'مدغشقر'),
('MW', 'Malawi', 'ملاوي'),
('MY', 'Malaysia', 'ماليزيا'),
('MV', 'Maldives', 'المالديف'),
('ML', 'Mali', 'مالي'),
('MT', 'Malta', 'مالطا'),
('MH', 'Marshall Islands', 'جزر مارشال'),
('MR', 'Mauritania', 'موريتانيا'),
('MU', 'Mauritius', 'موريشيوس'),
('MX', 'Mexico', 'المكسيك'),
('FM', 'Micronesia', 'ميكرونيزيا'),
('MD', 'Moldova', 'مولدوفا'),
('MC', 'Monaco', 'موناكو'),
('MN', 'Mongolia', 'منغوليا'),
('ME', 'Montenegro', 'الجبل الأسود'),
('MA', 'Morocco', 'المغرب'),
('MZ', 'Mozambique', 'موزمبيق'),
('MM', 'Myanmar', 'ميانمار'),
('NA', 'Namibia', 'ناميبيا'),
('NR', 'Nauru', 'ناورو'),
('NP', 'Nepal', 'نيبال'),
('NL', 'Netherlands', 'هولندا'),
('NZ', 'New Zealand', 'نيوزيلندا'),
('NI', 'Nicaragua', 'نيكاراغوا'),
('NE', 'Niger', 'النيجر'),
('NG', 'Nigeria', 'نيجيريا'),
('MK', 'North Macedonia', 'مقدونيا الشمالية'),
('NO', 'Norway', 'النرويج'),
('OM', 'Oman', 'عُمان'),
('PK', 'Pakistan', 'باكستان'),
('PW', 'Palau', 'بالاو'),
('PS', 'Palestine', 'فلسطين'),
('PA', 'Panama', 'بنما'),
('PG', 'Papua New Guinea', 'بابوا غينيا الجديدة'),
('PY', 'Paraguay', 'باراغواي'),
('PE', 'Peru', 'بيرو'),
('PH', 'Philippines', 'الفلبين'),
('PL', 'Poland', 'بولندا'),
('PT', 'Portugal', 'البرتغال'),
('QA', 'Qatar', 'قطر'),
('RO', 'Romania', 'رومانيا'),
('RU', 'Russia', 'روسيا'),
('RW', 'Rwanda', 'رواندا'),
('KN', 'Saint Kitts and Nevis', 'سانت كيتس ونيفيس'),
('LC', 'Saint Lucia', 'سانت لوسيا'),
('VC', 'Saint Vincent and the Grenadines', 'سانت فنسنت والغرينادين'),
('WS', 'Samoa', 'ساموا'),
('SM', 'San Marino', 'سان مارينو'),
('ST', 'Sao Tome and Principe', 'ساو تومي وبرينسيبي'),
('SA', 'Saudi Arabia', 'المملكة العربية السعودية'),
('SN', 'Senegal', 'السنغال'),
('RS', 'Serbia', 'صربيا'),
('SC', 'Seychelles', 'سيشل'),
('SL', 'Sierra Leone', 'سيراليون'),
('SG', 'Singapore', 'سنغافورة'),
('SK', 'Slovakia', 'سلوفاكيا'),
('SI', 'Slovenia', 'سلوفينيا'),
('SB', 'Solomon Islands', 'جزر سليمان'),
('SO', 'Somalia', 'الصومال'),
('ZA', 'South Africa', 'جنوب أفريقيا'),
('SS', 'South Sudan', 'جنوب السودان'),
('ES', 'Spain', 'إسبانيا'),
('LK', 'Sri Lanka', 'سريلانكا'),
('SD', 'Sudan', 'السودان'),
('SR', 'Suriname', 'سورينام'),
('SE', 'Sweden', 'السويد'),
('CH', 'Switzerland', 'سويسرا'),
('SY', 'Syria', 'سوريا'),
('TW', 'Taiwan', 'تايوان'),
('TJ', 'Tajikistan', 'طاجيكستان'),
('TZ', 'Tanzania', 'تنزانيا'),
('TH', 'Thailand', 'تايلاند'),
('TL', 'Timor-Leste', 'تيمور الشرقية'),
('TG', 'Togo', 'توغو'),
('TO', 'Tonga', 'تونغا'),
('TT', 'Trinidad and Tobago', 'ترينيداد وتوباغو'),
('TN', 'Tunisia', 'تونس'),
('TR', 'Turkey', 'تركيا'),
('TM', 'Turkmenistan', 'تركمانستان'),
('TV', 'Tuvalu', 'توفالو'),
('UG', 'Uganda', 'أوغندا'),
('UA', 'Ukraine', 'أوكرانيا'),
('GB', 'United Kingdom', 'المملكة المتحدة'),
('US', 'United States', 'الولايات المتحدة'),
('UY', 'Uruguay', 'أوروغواي'),
('UZ', 'Uzbekistan', 'أوزبكستان'),
('VU', 'Vanuatu', 'فانواتو'),
('VA', 'Vatican City', 'الفاتيكان'),
('VE', 'Venezuela', 'فنزويلا'),
('VN', 'Vietnam', 'فيتنام'),
('YE', 'Yemen', 'اليمن'),
('ZM', 'Zambia', 'زامبيا'),
('ZW', 'Zimbabwe', 'زيمبابوي');

-- ============================================================================
-- Settings Extension - Archive Feature
-- ============================================================================

-- Add archive_enabled flag to settings table (if not already exists)
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "archive_enabled" boolean DEFAULT true NOT NULL;

-- ============================================================================
-- Event File Storage Feature
-- ============================================================================

-- Event folders table - Virtual folder metadata for event files
CREATE TABLE "event_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"parent_folder_id" integer,
	"path" varchar(1000) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"created_by_user_id" integer
);

-- Event files table - File metadata with source tracking
CREATE TABLE "event_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_folder_id" integer NOT NULL,
	"object_key" varchar(500) NOT NULL,
	"thumbnail_key" varchar(500),
	"original_file_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"source_type" varchar(50) DEFAULT 'upload' NOT NULL,
	"source_id" integer,
	"uploaded_by_user_id" integer,
	"uploaded_at" timestamp DEFAULT now(),
	CONSTRAINT "event_files_object_key_unique" UNIQUE("object_key")
);

-- Folder access templates - Reusable permission templates
CREATE TABLE "folder_access_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"permissions" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"created_by_user_id" integer,
	CONSTRAINT "folder_access_templates_name_unique" UNIQUE("name")
);

-- Event folder permissions - Folder-level access control
CREATE TABLE "event_folder_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_folder_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"permission_level" varchar(20) NOT NULL,
	"granted_by_user_id" integer,
	"granted_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_folder_user_permission" UNIQUE("event_folder_id", "user_id")
);

-- Event access grants - Event-wide access grants
CREATE TABLE "event_access_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"user_id" integer NOT NULL,
	"template_id" integer,
	"permission_level" varchar(20) DEFAULT 'view' NOT NULL,
	"granted_by_user_id" integer,
	"granted_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_event_user_access" UNIQUE("event_id", "user_id")
);

-- Foreign key constraints for event file storage
ALTER TABLE "event_folders" ADD CONSTRAINT "event_folders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_folders" ADD CONSTRAINT "event_folders_parent_folder_id_event_folders_id_fk" FOREIGN KEY ("parent_folder_id") REFERENCES "public"."event_folders"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_folders" ADD CONSTRAINT "event_folders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "event_files" ADD CONSTRAINT "event_files_event_folder_id_event_folders_id_fk" FOREIGN KEY ("event_folder_id") REFERENCES "public"."event_folders"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_files" ADD CONSTRAINT "event_files_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "folder_access_templates" ADD CONSTRAINT "folder_access_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "event_folder_permissions" ADD CONSTRAINT "event_folder_permissions_event_folder_id_event_folders_id_fk" FOREIGN KEY ("event_folder_id") REFERENCES "public"."event_folders"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_folder_permissions" ADD CONSTRAINT "event_folder_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_folder_permissions" ADD CONSTRAINT "event_folder_permissions_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "event_access_grants" ADD CONSTRAINT "event_access_grants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_access_grants" ADD CONSTRAINT "event_access_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_access_grants" ADD CONSTRAINT "event_access_grants_template_id_folder_access_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."folder_access_templates"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "event_access_grants" ADD CONSTRAINT "event_access_grants_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

-- Indexes for performance optimization
CREATE INDEX "IDX_event_folders_event_id" ON "event_folders" USING btree ("event_id");
CREATE INDEX "IDX_event_folders_parent_folder_id" ON "event_folders" USING btree ("parent_folder_id");
CREATE INDEX "IDX_event_folders_path" ON "event_folders" USING btree ("event_id", "path");

CREATE INDEX "IDX_event_files_event_folder_id" ON "event_files" USING btree ("event_folder_id");
CREATE INDEX "IDX_event_files_source" ON "event_files" USING btree ("source_type", "source_id");
CREATE INDEX "IDX_event_files_uploaded_by" ON "event_files" USING btree ("uploaded_by_user_id");

CREATE INDEX "IDX_folder_access_templates_is_default" ON "folder_access_templates" USING btree ("is_default");

CREATE INDEX "IDX_event_folder_permissions_folder_id" ON "event_folder_permissions" USING btree ("event_folder_id");
CREATE INDEX "IDX_event_folder_permissions_user_id" ON "event_folder_permissions" USING btree ("user_id");

CREATE INDEX "IDX_event_access_grants_event_id" ON "event_access_grants" USING btree ("event_id");
CREATE INDEX "IDX_event_access_grants_user_id" ON "event_access_grants" USING btree ("user_id");

-- Insert default permission templates
INSERT INTO "folder_access_templates" (name, description, permissions, is_default)
VALUES 
('View Only', 'Can view and download files but cannot upload or modify', '{"canView": true, "canDownload": true, "canUpload": false, "canDelete": false, "canManage": false}', true),
('Contributor', 'Can view, download, and upload files but cannot delete or manage', '{"canView": true, "canDownload": true, "canUpload": true, "canDelete": false, "canManage": false}', false),
('Full Access', 'Full access to view, upload, delete, and manage files', '{"canView": true, "canDownload": true, "canUpload": true, "canDelete": true, "canManage": true}', false);
