CREATE TABLE "agreement_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"agreement_id" integer NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"original_file_name" varchar(255) NOT NULL,
	"object_key" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"uploaded_by_user_id" integer,
	"uploaded_at" timestamp DEFAULT now(),
	CONSTRAINT "agreement_attachments_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "agreement_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "agreement_types_name_en_unique" UNIQUE("name_en")
);
--> statement-breakpoint
CREATE TABLE "ai_chat_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"is_archived" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "ai_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"sources" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
	"original_event_media_id" integer,
	"uploaded_by_user_id" integer,
	"uploaded_at" timestamp DEFAULT now(),
	CONSTRAINT "archive_media_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"external_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "categories_name_en_unique" UNIQUE("name_en")
);
--> statement-breakpoint
CREATE TABLE "lead_interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"description_ar" text,
	"outcome" text,
	"outcome_ar" text,
	"interaction_date" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"author_user_id" integer,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_department_id" integer,
	"lead_id" integer,
	"partnership_id" integer,
	"department_id" integer,
	"title" text NOT NULL,
	"title_ar" text,
	"description" text,
	"description_ar" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"due_date" date,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"notification_emails" text[]
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(2) NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text,
	CONSTRAINT "countries_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "department_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"department_id" integer NOT NULL,
	"primary_email_id" integer NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "department_accounts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "department_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"department_id" integer NOT NULL,
	"email" text NOT NULL,
	"label" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "department_requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"department_id" integer NOT NULL,
	"title" text NOT NULL,
	"title_ar" text,
	"description" text,
	"description_ar" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"notification_emails" text[],
	"due_date_basis" text DEFAULT 'event_end' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
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
	"invitation_from_email" text,
	"invitation_from_name" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "event_access_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"user_id" integer NOT NULL,
	"template_id" integer,
	"permission_level" varchar(20) DEFAULT 'view' NOT NULL,
	"granted_by_user_id" integer,
	"granted_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_event_user_access" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "event_attendees" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"contact_id" integer NOT NULL,
	"attended_at" timestamp DEFAULT now(),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_event_attendee" UNIQUE("event_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "event_custom_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by_user_id" integer
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "event_folder_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_folder_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"permission_level" varchar(20) NOT NULL,
	"granted_by_user_id" integer,
	"granted_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_folder_user_permission" UNIQUE("event_folder_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "event_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"parent_folder_id" integer,
	"path" varchar(1000) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"created_by_user_id" integer
);
--> statement-breakpoint
CREATE TABLE "event_invitees" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"contact_id" integer NOT NULL,
	"rsvp" boolean DEFAULT false NOT NULL,
	"registered" boolean DEFAULT false NOT NULL,
	"invite_email_sent" boolean DEFAULT false NOT NULL,
	"invited_at" timestamp DEFAULT now(),
	"rsvp_at" timestamp,
	"registered_at" timestamp,
	"invite_email_sent_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_event_invitee" UNIQUE("event_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "event_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
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
	CONSTRAINT "event_media_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "event_speakers" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"contact_id" integer NOT NULL,
	"role" text,
	"role_ar" text,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_event_speaker" UNIQUE("event_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "event_workflows" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"created_by_user_id" integer
);
--> statement-breakpoint
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
	"agenda_en_file_name" text,
	"agenda_en_stored_file_name" text,
	"agenda_ar_file_name" text,
	"agenda_ar_stored_file_name" text,
	"is_scraped" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"admin_modified" boolean DEFAULT false NOT NULL,
	"reminder_1_week" boolean DEFAULT true NOT NULL,
	"reminder_1_day" boolean DEFAULT true NOT NULL,
	"reminder_weekly" boolean DEFAULT false NOT NULL,
	"reminder_daily" boolean DEFAULT false NOT NULL,
	"reminder_morning_of" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "interaction_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_interaction_id" integer,
	"partnership_interaction_id" integer,
	"object_key" text NOT NULL,
	"original_file_name" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"uploaded_by_user_id" integer,
	"uploaded_at" timestamp DEFAULT now(),
	CONSTRAINT "interaction_attachments_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "invitation_email_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_recipients" integer DEFAULT 0 NOT NULL,
	"emails_sent" integer DEFAULT 0 NOT NULL,
	"emails_failed" integer DEFAULT 0 NOT NULL,
	"wait_time_seconds" integer DEFAULT 2 NOT NULL,
	"use_custom_email" boolean DEFAULT false NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"created_by_user_id" integer
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"email" text,
	"phone" text,
	"type" text DEFAULT 'lead' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"organization_id" integer,
	"organization_name" text,
	"notes" text,
	"notes_ar" text,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text,
	"created_at" timestamp DEFAULT now(),
	"is_partner" boolean DEFAULT false NOT NULL,
	"partnership_status" text,
	"partnership_type_id" integer,
	"partnership_start_date" date,
	"partnership_end_date" date,
	"agreement_signed_by" text,
	"agreement_signed_by_us" text,
	"partnership_notes" text,
	"logo_key" text,
	"website" text,
	"primary_contact_id" integer,
	"country_id" integer,
	"inactivity_threshold_months" integer DEFAULT 6,
	"last_activity_date" timestamp,
	"notify_on_inactivity" boolean DEFAULT true,
	"last_inactivity_notification_sent" timestamp,
	CONSTRAINT "organizations_name_en_unique" UNIQUE("name_en")
);
--> statement-breakpoint
CREATE TABLE "partnership_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"title" text NOT NULL,
	"title_ar" text,
	"description" text,
	"description_ar" text,
	"activity_type" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"event_id" varchar,
	"outcome" text,
	"outcome_ar" text,
	"impact_score" integer,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partnership_agreements" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"title" text NOT NULL,
	"title_ar" text,
	"description" text,
	"description_ar" text,
	"agreement_type_id" integer,
	"signed_date" date,
	"effective_date" date,
	"expiry_date" date,
	"partner_signatory" text,
	"partner_signatory_title" text,
	"our_signatory" text,
	"our_signatory_title" text,
	"document_key" text,
	"document_file_name" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"legal_status" text,
	"languages" text[],
	"termination_clause" text,
	"termination_clause_ar" text,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partnership_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"body" text NOT NULL,
	"body_ar" text,
	"author_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partnership_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"role" text,
	"role_ar" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_partnership_contact" UNIQUE("organization_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "partnership_interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"description_ar" text,
	"outcome" text,
	"outcome_ar" text,
	"interaction_date" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partnership_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "partnership_types_name_en_unique" UNIQUE("name_en")
);
--> statement-breakpoint
CREATE TABLE "permission_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"permission_id" integer,
	"action" varchar(20) NOT NULL,
	"granted" boolean,
	"granted_by" integer,
	"reason" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"resource" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"description" text,
	"category" varchar(50),
	"is_dangerous" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "positions_name_en_unique" UNIQUE("name_en")
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" varchar(50) NOT NULL,
	"permission_id" integer,
	"granted" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "role_permissions_role_permission_id_unique" UNIQUE("role","permission_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_csv_export" boolean DEFAULT false NOT NULL,
	"file_uploads_enabled" boolean DEFAULT false NOT NULL,
	"scraped_events_enabled" boolean DEFAULT true NOT NULL,
	"archive_enabled" boolean DEFAULT true NOT NULL,
	"daily_reminder_global_enabled" boolean DEFAULT false NOT NULL,
	"daily_reminder_global_time" text DEFAULT '08:00',
	"allow_stakeholder_attendee_upload" boolean DEFAULT false NOT NULL,
	"stakeholder_upload_permissions" jsonb
);
--> statement-breakpoint
CREATE TABLE "task_template_prerequisites" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_template_id" integer NOT NULL,
	"prerequisite_template_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_task_prerequisite" UNIQUE("task_template_id","prerequisite_template_id")
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"permission_id" integer,
	"granted" boolean NOT NULL,
	"granted_by" integer,
	"reason" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_permissions_user_id_permission_id_unique" UNIQUE("user_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"password" text,
	"role" text DEFAULT 'employee' NOT NULL,
	"keycloak_id" text,
	"email" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_keycloak_id_unique" UNIQUE("keycloak_id")
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "whatsapp_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"template" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_whatsapp_template" UNIQUE("type","language")
);
--> statement-breakpoint
CREATE TABLE "workflow_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_id" integer NOT NULL,
	"task_id" integer NOT NULL,
	"prerequisite_task_id" integer,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_workflow_task" UNIQUE("workflow_id","task_id")
);
--> statement-breakpoint
ALTER TABLE "agreement_attachments" ADD CONSTRAINT "agreement_attachments_agreement_id_partnership_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."partnership_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_attachments" ADD CONSTRAINT "agreement_attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_conversations" ADD CONSTRAINT "ai_chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_conversation_id_ai_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_media" ADD CONSTRAINT "archive_media_archived_event_id_archived_events_id_fk" FOREIGN KEY ("archived_event_id") REFERENCES "public"."archived_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_media" ADD CONSTRAINT "archive_media_original_event_media_id_event_media_id_fk" FOREIGN KEY ("original_event_media_id") REFERENCES "public"."event_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_media" ADD CONSTRAINT "archive_media_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archived_event_speakers" ADD CONSTRAINT "archived_event_speakers_archived_event_id_archived_events_id_fk" FOREIGN KEY ("archived_event_id") REFERENCES "public"."archived_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archived_event_speakers" ADD CONSTRAINT "archived_event_speakers_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archived_events" ADD CONSTRAINT "archived_events_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archived_events" ADD CONSTRAINT "archived_events_original_event_id_events_id_fk" FOREIGN KEY ("original_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archived_events" ADD CONSTRAINT "archived_events_archived_by_user_id_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_interactions" ADD CONSTRAINT "lead_interactions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_interactions" ADD CONSTRAINT "lead_interactions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comment_attachments" ADD CONSTRAINT "task_comment_attachments_comment_id_task_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."task_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comment_attachments" ADD CONSTRAINT "task_comment_attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_event_department_id_event_departments_id_fk" FOREIGN KEY ("event_department_id") REFERENCES "public"."event_departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_partnership_id_organizations_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_accounts" ADD CONSTRAINT "department_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_accounts" ADD CONSTRAINT "department_accounts_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_accounts" ADD CONSTRAINT "department_accounts_primary_email_id_department_emails_id_fk" FOREIGN KEY ("primary_email_id") REFERENCES "public"."department_emails"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_emails" ADD CONSTRAINT "department_emails_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_requirements" ADD CONSTRAINT "department_requirements_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_access_grants" ADD CONSTRAINT "event_access_grants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_access_grants" ADD CONSTRAINT "event_access_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_access_grants" ADD CONSTRAINT "event_access_grants_template_id_folder_access_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."folder_access_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_access_grants" ADD CONSTRAINT "event_access_grants_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_custom_emails" ADD CONSTRAINT "event_custom_emails_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_custom_emails" ADD CONSTRAINT "event_custom_emails_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_departments" ADD CONSTRAINT "event_departments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_departments" ADD CONSTRAINT "event_departments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_files" ADD CONSTRAINT "event_files_event_folder_id_event_folders_id_fk" FOREIGN KEY ("event_folder_id") REFERENCES "public"."event_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_files" ADD CONSTRAINT "event_files_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_folder_permissions" ADD CONSTRAINT "event_folder_permissions_event_folder_id_event_folders_id_fk" FOREIGN KEY ("event_folder_id") REFERENCES "public"."event_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_folder_permissions" ADD CONSTRAINT "event_folder_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_folder_permissions" ADD CONSTRAINT "event_folder_permissions_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_folders" ADD CONSTRAINT "event_folders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_folders" ADD CONSTRAINT "event_folders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invitees" ADD CONSTRAINT "event_invitees_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invitees" ADD CONSTRAINT "event_invitees_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_media" ADD CONSTRAINT "event_media_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_media" ADD CONSTRAINT "event_media_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_speakers" ADD CONSTRAINT "event_speakers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_speakers" ADD CONSTRAINT "event_speakers_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_workflows" ADD CONSTRAINT "event_workflows_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_workflows" ADD CONSTRAINT "event_workflows_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_access_templates" ADD CONSTRAINT "folder_access_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_attachments" ADD CONSTRAINT "interaction_attachments_lead_interaction_id_lead_interactions_id_fk" FOREIGN KEY ("lead_interaction_id") REFERENCES "public"."lead_interactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_attachments" ADD CONSTRAINT "interaction_attachments_partnership_interaction_id_partnership_interactions_id_fk" FOREIGN KEY ("partnership_interaction_id") REFERENCES "public"."partnership_interactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_attachments" ADD CONSTRAINT "interaction_attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_email_jobs" ADD CONSTRAINT "invitation_email_jobs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_email_jobs" ADD CONSTRAINT "invitation_email_jobs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_partnership_type_id_partnership_types_id_fk" FOREIGN KEY ("partnership_type_id") REFERENCES "public"."partnership_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_activities" ADD CONSTRAINT "partnership_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_activities" ADD CONSTRAINT "partnership_activities_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_activities" ADD CONSTRAINT "partnership_activities_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_agreements" ADD CONSTRAINT "partnership_agreements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_agreements" ADD CONSTRAINT "partnership_agreements_agreement_type_id_agreement_types_id_fk" FOREIGN KEY ("agreement_type_id") REFERENCES "public"."agreement_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_agreements" ADD CONSTRAINT "partnership_agreements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_comments" ADD CONSTRAINT "partnership_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_comments" ADD CONSTRAINT "partnership_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_contacts" ADD CONSTRAINT "partnership_contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_contacts" ADD CONSTRAINT "partnership_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_interactions" ADD CONSTRAINT "partnership_interactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_interactions" ADD CONSTRAINT "partnership_interactions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_audit_log" ADD CONSTRAINT "permission_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_audit_log" ADD CONSTRAINT "permission_audit_log_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_audit_log" ADD CONSTRAINT "permission_audit_log_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_queue" ADD CONSTRAINT "reminder_queue_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_template_prerequisites" ADD CONSTRAINT "task_template_prerequisites_task_template_id_department_requirements_id_fk" FOREIGN KEY ("task_template_id") REFERENCES "public"."department_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_template_prerequisites" ADD CONSTRAINT "task_template_prerequisites_prerequisite_template_id_department_requirements_id_fk" FOREIGN KEY ("prerequisite_template_id") REFERENCES "public"."department_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "updates" ADD CONSTRAINT "updates_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "updates" ADD CONSTRAINT "updates_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_workflow_id_event_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."event_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_prerequisite_task_id_tasks_id_fk" FOREIGN KEY ("prerequisite_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_agreement_attachments_agreement_id" ON "agreement_attachments" USING btree ("agreement_id");--> statement-breakpoint
CREATE INDEX "idx_ai_chat_conversations_user_id" ON "ai_chat_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_chat_conversations_updated_at" ON "ai_chat_conversations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_ai_chat_messages_conversation_id" ON "ai_chat_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_ai_chat_messages_created_at" ON "ai_chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_archive_media_archived_event_id" ON "archive_media" USING btree ("archived_event_id");--> statement-breakpoint
CREATE INDEX "IDX_archive_media_display_order" ON "archive_media" USING btree ("archived_event_id","display_order");--> statement-breakpoint
CREATE INDEX "IDX_archive_media_original_event_media_id" ON "archive_media" USING btree ("original_event_media_id");--> statement-breakpoint
CREATE INDEX "IDX_archived_event_speakers_archived_event_id" ON "archived_event_speakers" USING btree ("archived_event_id");--> statement-breakpoint
CREATE INDEX "IDX_archived_event_speakers_contact_id" ON "archived_event_speakers" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "IDX_archived_events_original_event_id" ON "archived_events" USING btree ("original_event_id");--> statement-breakpoint
CREATE INDEX "IDX_archived_events_start_date" ON "archived_events" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "IDX_archived_events_category_id" ON "archived_events" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "IDX_auth_identities_user_id" ON "auth_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_auth_identities_provider_external" ON "auth_identities" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "IDX_lead_interactions_lead_id" ON "lead_interactions" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "IDX_lead_interactions_type" ON "lead_interactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "IDX_lead_interactions_date" ON "lead_interactions" USING btree ("interaction_date");--> statement-breakpoint
CREATE INDEX "IDX_task_comment_attachments_comment_id" ON "task_comment_attachments" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "IDX_task_comments_task_id" ON "task_comments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "IDX_tasks_event_department_id" ON "tasks" USING btree ("event_department_id");--> statement-breakpoint
CREATE INDEX "IDX_tasks_lead_id" ON "tasks" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "IDX_tasks_partnership_id" ON "tasks" USING btree ("partnership_id");--> statement-breakpoint
CREATE INDEX "IDX_tasks_department_id" ON "tasks" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "IDX_tasks_status" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_tasks_priority" ON "tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "IDX_contacts_organization_id" ON "contacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "IDX_contacts_position_id" ON "contacts" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "IDX_contacts_country_id" ON "contacts" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "IDX_contacts_is_eligible_speaker" ON "contacts" USING btree ("is_eligible_speaker");--> statement-breakpoint
CREATE INDEX "IDX_email_templates_type_language" ON "email_templates" USING btree ("type","language");--> statement-breakpoint
CREATE INDEX "IDX_event_access_grants_event_id" ON "event_access_grants" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "IDX_event_access_grants_user_id" ON "event_access_grants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_event_attendees_event_id" ON "event_attendees" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "IDX_event_attendees_contact_id" ON "event_attendees" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "IDX_event_custom_emails_event_id" ON "event_custom_emails" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "IDX_event_files_event_folder_id" ON "event_files" USING btree ("event_folder_id");--> statement-breakpoint
CREATE INDEX "IDX_event_files_source" ON "event_files" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "IDX_event_files_uploaded_by" ON "event_files" USING btree ("uploaded_by_user_id");--> statement-breakpoint
CREATE INDEX "IDX_event_folder_permissions_folder_id" ON "event_folder_permissions" USING btree ("event_folder_id");--> statement-breakpoint
CREATE INDEX "IDX_event_folder_permissions_user_id" ON "event_folder_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_event_folders_event_id" ON "event_folders" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "IDX_event_folders_parent_folder_id" ON "event_folders" USING btree ("parent_folder_id");--> statement-breakpoint
CREATE INDEX "IDX_event_folders_path" ON "event_folders" USING btree ("event_id","path");--> statement-breakpoint
CREATE INDEX "IDX_event_invitees_event_id" ON "event_invitees" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "IDX_event_invitees_contact_id" ON "event_invitees" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "IDX_event_invitees_rsvp" ON "event_invitees" USING btree ("rsvp");--> statement-breakpoint
CREATE INDEX "IDX_event_invitees_registered" ON "event_invitees" USING btree ("registered");--> statement-breakpoint
CREATE INDEX "IDX_event_invitees_invite_email_sent" ON "event_invitees" USING btree ("invite_email_sent");--> statement-breakpoint
CREATE INDEX "IDX_event_media_event_id" ON "event_media" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "IDX_event_media_display_order" ON "event_media" USING btree ("event_id","display_order");--> statement-breakpoint
CREATE INDEX "IDX_event_speakers_event_id" ON "event_speakers" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "IDX_event_speakers_contact_id" ON "event_speakers" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "IDX_event_workflows_event_id" ON "event_workflows" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "IDX_folder_access_templates_is_default" ON "folder_access_templates" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "IDX_interaction_attachments_lead" ON "interaction_attachments" USING btree ("lead_interaction_id");--> statement-breakpoint
CREATE INDEX "IDX_interaction_attachments_partnership" ON "interaction_attachments" USING btree ("partnership_interaction_id");--> statement-breakpoint
CREATE INDEX "IDX_interaction_attachments_uploaded_by" ON "interaction_attachments" USING btree ("uploaded_by_user_id");--> statement-breakpoint
CREATE INDEX "IDX_invitation_email_jobs_event_id" ON "invitation_email_jobs" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "IDX_invitation_email_jobs_status" ON "invitation_email_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_invitation_email_jobs_created_at" ON "invitation_email_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_leads_type" ON "leads" USING btree ("type");--> statement-breakpoint
CREATE INDEX "IDX_leads_status" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_leads_organization" ON "leads" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "IDX_leads_name" ON "leads" USING btree ("name");--> statement-breakpoint
CREATE INDEX "IDX_organizations_is_partner" ON "organizations" USING btree ("is_partner");--> statement-breakpoint
CREATE INDEX "IDX_organizations_partnership_status" ON "organizations" USING btree ("partnership_status");--> statement-breakpoint
CREATE INDEX "IDX_organizations_country_id" ON "organizations" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "IDX_organizations_last_activity" ON "organizations" USING btree ("last_activity_date");--> statement-breakpoint
CREATE INDEX "IDX_partnership_activities_org_id" ON "partnership_activities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "IDX_partnership_activities_type" ON "partnership_activities" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "IDX_partnership_activities_event_id" ON "partnership_activities" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "IDX_partnership_agreements_org_id" ON "partnership_agreements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "IDX_partnership_agreements_status" ON "partnership_agreements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_partnership_agreements_legal_status" ON "partnership_agreements" USING btree ("legal_status");--> statement-breakpoint
CREATE INDEX "IDX_partnership_comments_org_id" ON "partnership_comments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "IDX_partnership_comments_author" ON "partnership_comments" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "IDX_partnership_contacts_org_id" ON "partnership_contacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "IDX_partnership_contacts_contact_id" ON "partnership_contacts" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "IDX_partnership_interactions_org_id" ON "partnership_interactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "IDX_partnership_interactions_type" ON "partnership_interactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "IDX_partnership_interactions_date" ON "partnership_interactions" USING btree ("interaction_date");--> statement-breakpoint
CREATE INDEX "idx_permission_audit_user" ON "permission_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_permission_audit_time" ON "permission_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "IDX_prerequisite_task_template" ON "task_template_prerequisites" USING btree ("task_template_id");--> statement-breakpoint
CREATE INDEX "IDX_prerequisite_template" ON "task_template_prerequisites" USING btree ("prerequisite_template_id");--> statement-breakpoint
CREATE INDEX "IDX_updates_type_period" ON "updates" USING btree ("type","period_start");--> statement-breakpoint
CREATE INDEX "IDX_updates_department_id" ON "updates" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "idx_user_permissions_user" ON "user_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_permissions_permission" ON "user_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "IDX_whatsapp_templates_type_language" ON "whatsapp_templates" USING btree ("type","language");--> statement-breakpoint
CREATE INDEX "IDX_workflow_tasks_workflow_id" ON "workflow_tasks" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "IDX_workflow_tasks_task_id" ON "workflow_tasks" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "IDX_workflow_tasks_prerequisite" ON "workflow_tasks" USING btree ("prerequisite_task_id");