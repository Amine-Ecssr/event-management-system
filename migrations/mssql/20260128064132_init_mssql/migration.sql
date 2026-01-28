CREATE TABLE [agreement_attachments] (
	[id] int IDENTITY(1, 1),
	[agreement_id] int NOT NULL,
	[file_name] varchar(255) NOT NULL,
	[original_file_name] varchar(255) NOT NULL,
	[object_key] varchar(255) NOT NULL,
	[file_size] int NOT NULL,
	[mime_type] varchar(100) NOT NULL,
	[uploaded_by_user_id] int,
	[uploaded_at] datetime2 NOT NULL CONSTRAINT [agreement_attachments_uploaded_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [agreement_attachments_pkey] PRIMARY KEY([id]),
	CONSTRAINT [agreement_attachments_object_key_key] UNIQUE([object_key])
);
--> statement-breakpoint
CREATE TABLE [agreement_types] (
	[id] int IDENTITY(1, 1),
	[name_en] nvarchar(255) NOT NULL,
	[name_ar] nvarchar(255),
	[created_at] datetime2 NOT NULL CONSTRAINT [agreement_types_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [agreement_types_pkey] PRIMARY KEY([id]),
	CONSTRAINT [agreement_types_name_en_key] UNIQUE([name_en])
);
--> statement-breakpoint
CREATE TABLE [ai_chat_conversations] (
	[id] varchar(500),
	[user_id] int NOT NULL,
	[title] varchar(500),
	[created_at] datetime2 NOT NULL CONSTRAINT [ai_chat_conversations_created_at_default] DEFAULT (SYSDATETIME()),
	[updated_at] datetime2 NOT NULL CONSTRAINT [ai_chat_conversations_updated_at_default] DEFAULT (SYSDATETIME()),
	[is_archived] bit CONSTRAINT [ai_chat_conversations_is_archived_default] DEFAULT ((0)),
	CONSTRAINT [ai_chat_conversations_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [ai_chat_messages] (
	[id] int IDENTITY(1, 1),
	[conversation_id] varchar(500) NOT NULL,
	[role] varchar(500) NOT NULL,
	[content] varchar(500) NOT NULL,
	[sources] nvarchar(max),
	[metadata] nvarchar(max),
	[created_at] datetime2 NOT NULL CONSTRAINT [ai_chat_messages_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [ai_chat_messages_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [archive_media] (
	[id] int IDENTITY(1, 1),
	[archived_event_id] int NOT NULL,
	[object_key] varchar(255) NOT NULL,
	[thumbnail_key] nvarchar(255),
	[original_file_name] nvarchar(255) NOT NULL,
	[mime_type] nvarchar(255) NOT NULL,
	[file_size] int NOT NULL,
	[width] int,
	[height] int,
	[caption] varchar(500),
	[caption_ar] nvarchar(500),
	[display_order] int NOT NULL CONSTRAINT [archive_media_display_order_default] DEFAULT ((0)),
	[original_event_media_id] int,
	[uploaded_by_user_id] int,
	[uploaded_at] datetime2 NOT NULL CONSTRAINT [archive_media_uploaded_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [archive_media_pkey] PRIMARY KEY([id]),
	CONSTRAINT [archive_media_object_key_key] UNIQUE([object_key])
);
--> statement-breakpoint
CREATE TABLE [archived_event_speakers] (
	[id] int IDENTITY(1, 1),
	[archived_event_id] int NOT NULL,
	[contact_id] int,
	[role] varchar(500),
	[role_ar] nvarchar(500),
	[display_order] int CONSTRAINT [archived_event_speakers_display_order_default] DEFAULT ((0)),
	[speaker_name_en] varchar(500),
	[speaker_name_ar] nvarchar(500),
	[speaker_title] varchar(500),
	[speaker_title_ar] nvarchar(500),
	[speaker_position] varchar(500),
	[speaker_position_ar] nvarchar(500),
	[speaker_organization] varchar(500),
	[speaker_organization_ar] nvarchar(500),
	[speaker_profile_picture_key] varchar(500),
	[speaker_profile_picture_thumbnail_key] varchar(500),
	[created_at] datetime2 NOT NULL CONSTRAINT [archived_event_speakers_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [archived_event_speakers_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [archived_events] (
	[id] int IDENTITY(1, 1),
	[name] varchar(500) NOT NULL,
	[name_ar] varchar(500),
	[description] varchar(500),
	[description_ar] nvarchar(500),
	[start_date] date NOT NULL,
	[end_date] date NOT NULL,
	[start_time] varchar(5),
	[end_time] varchar(5),
	[location] varchar(500),
	[location_ar] nvarchar(500),
	[organizers] varchar(500),
	[organizers_ar] nvarchar(500),
	[url] varchar(500),
	[category] varchar(500),
	[category_ar] nvarchar(500),
	[category_id] int,
	[event_type] varchar(500) NOT NULL CONSTRAINT [archived_events_event_type_default] DEFAULT ('local'),
	[event_scope] varchar(500) NOT NULL CONSTRAINT [archived_events_event_scope_default] DEFAULT ('external'),
	[original_event_id] varchar(50),
	[actual_attendees] int,
	[highlights] varchar(500),
	[highlights_ar] nvarchar(500),
	[impact] varchar(500),
	[impact_ar] nvarchar(500),
	[key_takeaways] varchar(500),
	[key_takeaways_ar] nvarchar(500),
	[photo_keys] nvarchar(max),
	[thumbnail_keys] nvarchar(max),
	[youtube_video_ids] nvarchar(max),
	[archived_by_user_id] int,
	[created_directly] bit NOT NULL CONSTRAINT [archived_events_created_directly_default] DEFAULT ((0)),
	[created_at] datetime2 NOT NULL CONSTRAINT [archived_events_created_at_default] DEFAULT (SYSDATETIME()),
	[updated_at] datetime2 NOT NULL CONSTRAINT [archived_events_updated_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [archived_events_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [auth_identities] (
	[id] int IDENTITY(1, 1),
	[user_id] int NOT NULL,
	[provider] varchar(500) NOT NULL,
	[external] varchar(500),
	[metadata] nvarchar(max),
	[created_at] datetime2 NOT NULL CONSTRAINT [auth_identities_created_at_default] DEFAULT (SYSDATETIME()),
	[updated_at] datetime2 NOT NULL CONSTRAINT [auth_identities_updated_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [auth_identities_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [categories] (
	[id] int IDENTITY(1, 1),
	[name_en] nvarchar(255) NOT NULL,
	[name_ar] varchar(255),
	[created_at] datetime2 NOT NULL CONSTRAINT [categories_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [categories_pkey] PRIMARY KEY([id]),
	CONSTRAINT [categories_name_en_key] UNIQUE([name_en])
);
--> statement-breakpoint
CREATE TABLE [contacts] (
	[id] int IDENTITY(1, 1),
	[name] varchar(500) NOT NULL,
	[name_ar] nvarchar(500),
	[title] varchar(500),
	[title_ar] nvarchar(500),
	[organization_id] int,
	[position_id] int,
	[country_id] int,
	[phone] varchar(500),
	[email] varchar(500),
	[profile_picture_key] varchar(500),
	[profile_picture_thumbnail_key] varchar(500),
	[is_eligible_speaker] bit NOT NULL CONSTRAINT [contacts_is_eligible_speaker_default] DEFAULT ((0)),
	[created_at] datetime2 NOT NULL CONSTRAINT [contacts_created_at_default] DEFAULT (SYSDATETIME()),
	[updated_at] datetime2 NOT NULL CONSTRAINT [contacts_updated_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [contacts_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [countries] (
	[id] int IDENTITY(1, 1),
	[code] varchar(2) NOT NULL,
	[description] varchar(500) NOT NULL,
	[name_ar] nvarchar(500) NOT NULL,
	CONSTRAINT [countries_pkey] PRIMARY KEY([id]),
	CONSTRAINT [countries_code_key] UNIQUE([code])
);
--> statement-breakpoint
CREATE TABLE [department_accounts] (
	[id] int IDENTITY(1, 1),
	[user_id] int NOT NULL,
	[department_id] int NOT NULL,
	[primary_email_id] int NOT NULL,
	[last_login_at] datetime2,
	[created_at] datetime2 NOT NULL CONSTRAINT [department_accounts_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [department_accounts_pkey] PRIMARY KEY([id]),
	CONSTRAINT [department_accounts_user_id_key] UNIQUE([user_id])
);
--> statement-breakpoint
CREATE TABLE [department_emails] (
	[id] int IDENTITY(1, 1),
	[department_id] int NOT NULL,
	[email] varchar(500) NOT NULL,
	[label] varchar(500),
	[is_primary] bit NOT NULL CONSTRAINT [department_emails_is_primary_default] DEFAULT ((0)),
	[created_at] datetime2 NOT NULL CONSTRAINT [department_emails_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [department_emails_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [department_requirements] (
	[id] int IDENTITY(1, 1),
	[department_id] int NOT NULL,
	[title] varchar(500) NOT NULL,
	[title_ar] varchar(500),
	[description] varchar(500) NOT NULL,
	[description_ar] nvarchar(500),
	[is_default] bit NOT NULL CONSTRAINT [department_requirements_is_default_default] DEFAULT ((0)),
	[notification_emails] nvarchar(max),
	[due_date_basis] varchar(50) NOT NULL CONSTRAINT [department_requirements_due_date_basis_default] DEFAULT ('event_end'),
	[created_at] datetime2 NOT NULL CONSTRAINT [department_requirements_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [department_requirements_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [departments] (
	[id] int IDENTITY(1, 1),
	[name] nvarchar(255) NOT NULL,
	[name_ar] nvarchar(255),
	[keycloak_group_id] nvarchar(255),
	[active] bit NOT NULL CONSTRAINT [departments_active_default] DEFAULT ((1)),
	[cc_list] nvarchar(255),
	[created_at] datetime2 NOT NULL CONSTRAINT [departments_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [departments_pkey] PRIMARY KEY([id]),
	CONSTRAINT [departments_name_key] UNIQUE([name]),
	CONSTRAINT [departments_keycloak_group_id_key] UNIQUE([keycloak_group_id])
);
--> statement-breakpoint
CREATE TABLE [email_config] (
	[id] int IDENTITY(1, 1),
	[enabled] bit NOT NULL CONSTRAINT [email_config_enabled_default] DEFAULT ((0)),
	[provider] varchar(50) NOT NULL CONSTRAINT [email_config_provider_default] DEFAULT ('resend'),
	[api_key] varchar(500),
	[smtp_host] varchar(500),
	[smtp_port] int,
	[smtp_secure] bit CONSTRAINT [email_config_smtp_secure_default] DEFAULT ((1)),
	[smtp_user] varchar(500),
	[smtp_password] varchar(500),
	[from_email] varchar(500),
	[from_name] varchar(500),
	[default_recipients] varchar(500),
	[global_cc_list] varchar(500),
	[language] varchar(50) NOT NULL CONSTRAINT [email_config_language_default] DEFAULT ('en'),
	[invitation_from_email] varchar(500),
	[invitation_from_name] varchar(500),
	[created_at] datetime2 NOT NULL CONSTRAINT [email_config_created_at_default] DEFAULT (SYSDATETIME()),
	[updated_at] datetime2 NOT NULL CONSTRAINT [email_config_updated_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [email_config_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [email_templates] (
	[id] int IDENTITY(1, 1),
	[type] varchar(500) NOT NULL,
	[language] varchar(50) NOT NULL CONSTRAINT [email_templates_language_default] DEFAULT ('en'),
	[subject] varchar(500),
	[body] varchar(500),
	[greeting] varchar(500),
	[footer] varchar(500),
	[requirements_title] varchar(500),
	[custom_requirements_title] varchar(500),
	[requirement_item_template] varchar(500),
	[brand_color] varchar(50) CONSTRAINT [email_templates_brand_color_default] DEFAULT ('#BC9F6D'),
	[text_color] varchar(50) CONSTRAINT [email_templates_text_color_default] DEFAULT ('#333333'),
	[bg_color] varchar(50) CONSTRAINT [email_templates_bg_color_default] DEFAULT ('#FFFFFF'),
	[font_family] varchar(500) CONSTRAINT [email_templates_font_family_default] DEFAULT ('Arial, sans-serif'),
	[font_size] varchar(50) CONSTRAINT [email_templates_font_size_default] DEFAULT ('16px'),
	[requirements_brand_color] varchar(50) CONSTRAINT [email_templates_requirements_brand_color_default] DEFAULT ('#BC9F6D'),
	[requirements_text_color] varchar(50) CONSTRAINT [email_templates_requirements_text_color_default] DEFAULT ('#333333'),
	[requirements_bg_color] varchar(50) CONSTRAINT [email_templates_requirements_bg_color_default] DEFAULT ('#F5F5F5'),
	[requirements_font_family] varchar(500) CONSTRAINT [email_templates_requirements_font_family_default] DEFAULT ('Arial, sans-serif'),
	[requirements_font_size] varchar(50) CONSTRAINT [email_templates_requirements_font_size_default] DEFAULT ('16px'),
	[footer_brand_color] varchar(50) CONSTRAINT [email_templates_footer_brand_color_default] DEFAULT ('#BC9F6D'),
	[footer_text_color] varchar(50) CONSTRAINT [email_templates_footer_text_color_default] DEFAULT ('#666666'),
	[footer_bg_color] varchar(50) CONSTRAINT [email_templates_footer_bg_color_default] DEFAULT ('#FFFFFF'),
	[footer_font_family] varchar(500) CONSTRAINT [email_templates_footer_font_family_default] DEFAULT ('Arial, sans-serif'),
	[footer_font_size] varchar(50) CONSTRAINT [email_templates_footer_font_size_default] DEFAULT ('14px'),
	[is_rtl] bit NOT NULL CONSTRAINT [email_templates_is_rtl_default] DEFAULT ((0)),
	[additional_config] nvarchar(max),
	[created_at] datetime2 NOT NULL CONSTRAINT [email_templates_created_at_default] DEFAULT (SYSDATETIME()),
	[updated_at] datetime2 NOT NULL CONSTRAINT [email_templates_updated_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [email_templates_pkey] PRIMARY KEY([id]),
	CONSTRAINT [unique_email_template] UNIQUE([type],[language])
);
--> statement-breakpoint
CREATE TABLE [event_access_grants] (
	[id] int IDENTITY(1, 1),
	[event_id] varchar(50) NOT NULL,
	[user_id] int NOT NULL,
	[template_id] int,
	[permission_level] varchar(20) NOT NULL CONSTRAINT [event_access_grants_permission_level_default] DEFAULT ('view'),
	[granted_by_user_id] int,
	[granted_at] datetime2 NOT NULL CONSTRAINT [event_access_grants_granted_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [event_access_grants_pkey] PRIMARY KEY([id]),
	CONSTRAINT [unique_event_user_access] UNIQUE([event_id],[user_id])
);
--> statement-breakpoint
CREATE TABLE [event_attendees] (
	[id] int IDENTITY(1, 1),
	[event_id] varchar(50) NOT NULL,
	[contact_id] int NOT NULL,
	[attended_at] datetime2 NOT NULL CONSTRAINT [event_attendees_attended_at_default] DEFAULT (SYSDATETIME()),
	[notes] varchar(500),
	[created_at] datetime2 NOT NULL CONSTRAINT [event_attendees_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [event_attendees_pkey] PRIMARY KEY([id]),
	CONSTRAINT [unique_event_attendee] UNIQUE([event_id],[contact_id])
);
--> statement-breakpoint
CREATE TABLE [event_custom_emails] (
	[id] int IDENTITY(1, 1),
	[event_id] varchar(50) NOT NULL,
	[subject] varchar(500) NOT NULL,
	[body] varchar(500) NOT NULL,
	[is_active] bit NOT NULL CONSTRAINT [event_custom_emails_is_active_default] DEFAULT ((1)),
	[created_at] datetime2 NOT NULL CONSTRAINT [event_custom_emails_created_at_default] DEFAULT (SYSDATETIME()),
	[updated_at] datetime2 NOT NULL CONSTRAINT [event_custom_emails_updated_at_default] DEFAULT (SYSDATETIME()),
	[created_by_user_id] int,
	CONSTRAINT [event_custom_emails_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [event_departments] (
	[id] int IDENTITY(1, 1),
	[event_id] varchar(50) NOT NULL,
	[department_id] int NOT NULL,
	[selected_requirement_ids] nvarchar(max),
	[custom_requirements] varchar(500),
	[notify_on_create] bit NOT NULL CONSTRAINT [event_departments_notify_on_create_default] DEFAULT ((1)),
	[notify_on_update] bit NOT NULL CONSTRAINT [event_departments_notify_on_update_default] DEFAULT ((0)),
	[daily_reminder_enabled] bit NOT NULL CONSTRAINT [event_departments_daily_reminder_enabled_default] DEFAULT ((0)),
	[daily_reminder_time] varchar(50) CONSTRAINT [event_departments_daily_reminder_time_default] DEFAULT ('08:00'),
	[last_reminder_sent_at] datetime2,
	[created_at] datetime2 NOT NULL CONSTRAINT [event_departments_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [event_departments_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [event_files] (
	[id] int IDENTITY(1, 1),
	[event_folder_id] int NOT NULL,
	[object_key] varchar(500) NOT NULL,
	[thumbnail_key] varchar(500),
	[original_file_name] varchar(255) NOT NULL,
	[mime_type] varchar(100) NOT NULL,
	[file_size] int NOT NULL,
	[source_type] varchar(50) NOT NULL CONSTRAINT [event_files_source_type_default] DEFAULT ('upload'),
	[source_id] int,
	[uploaded_by_user_id] int,
	[uploaded_at] datetime2 NOT NULL CONSTRAINT [event_files_uploaded_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [event_files_pkey] PRIMARY KEY([id]),
	CONSTRAINT [event_files_object_key_key] UNIQUE([object_key])
);
--> statement-breakpoint
CREATE TABLE [event_folder_permissions] (
	[id] int IDENTITY(1, 1),
	[event_folder_id] int NOT NULL,
	[user_id] int NOT NULL,
	[permission_level] varchar(20) NOT NULL,
	[granted_by_user_id] int,
	[granted_at] datetime2 NOT NULL CONSTRAINT [event_folder_permissions_granted_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [event_folder_permissions_pkey] PRIMARY KEY([id]),
	CONSTRAINT [unique_folder_user_permission] UNIQUE([event_folder_id],[user_id])
);
--> statement-breakpoint
CREATE TABLE [event_folders] (
	[id] int IDENTITY(1, 1),
	[event_id] varchar(50) NOT NULL,
	[name] varchar(255) NOT NULL,
	[parent_folder_id] int,
	[path] varchar(1000) NOT NULL,
	[created_at] datetime2 NOT NULL CONSTRAINT [event_folders_created_at_default] DEFAULT (SYSDATETIME()),
	[created_by_user_id] int,
	CONSTRAINT [event_folders_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [event_invitees] (
	[id] int IDENTITY(1, 1),
	[event_id] varchar(50) NOT NULL,
	[contact_id] int NOT NULL,
	[rsvp] bit NOT NULL CONSTRAINT [event_invitees_rsvp_default] DEFAULT ((0)),
	[registered] bit NOT NULL CONSTRAINT [event_invitees_registered_default] DEFAULT ((0)),
	[invite_email_sent] bit NOT NULL CONSTRAINT [event_invitees_invite_email_sent_default] DEFAULT ((0)),
	[invited_at] datetime2 NOT NULL CONSTRAINT [event_invitees_invited_at_default] DEFAULT (SYSDATETIME()),
	[rsvp_at] datetime2,
	[registered_at] datetime2,
	[invite_email_sent_at] datetime2,
	[notes] varchar(500),
	[created_at] datetime2 NOT NULL CONSTRAINT [event_invitees_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [event_invitees_pkey] PRIMARY KEY([id]),
	CONSTRAINT [unique_event_invitee] UNIQUE([event_id],[contact_id])
);
--> statement-breakpoint
CREATE TABLE [event_media] (
	[id] int IDENTITY(1, 1),
	[event_id] varchar(50) NOT NULL,
	[object_key] varchar(255) NOT NULL,
	[thumbnail_key] nvarchar(255),
	[original_file_name] nvarchar(255) NOT NULL,
	[mime_type] nvarchar(255) NOT NULL,
	[file_size] int NOT NULL,
	[width] int,
	[height] int,
	[caption] varchar(500),
	[caption_ar] nvarchar(500),
	[display_order] int NOT NULL CONSTRAINT [event_media_display_order_default] DEFAULT ((0)),
	[uploaded_by_user_id] int,
	[uploaded_at] datetime2 NOT NULL CONSTRAINT [event_media_uploaded_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [event_media_pkey] PRIMARY KEY([id]),
	CONSTRAINT [event_media_object_key_key] UNIQUE([object_key])
);
--> statement-breakpoint
CREATE TABLE [event_speakers] (
	[id] int IDENTITY(1, 1),
	[event_id] varchar(50) NOT NULL,
	[contact_id] int NOT NULL,
	[role] varchar(500),
	[role_ar] nvarchar(500),
	[display_order] int CONSTRAINT [event_speakers_display_order_default] DEFAULT ((0)),
	[created_at] datetime2 NOT NULL CONSTRAINT [event_speakers_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [event_speakers_pkey] PRIMARY KEY([id]),
	CONSTRAINT [unique_event_speaker] UNIQUE([event_id],[contact_id])
);
--> statement-breakpoint
CREATE TABLE [event_workflows] (
	[id] int IDENTITY(1, 1),
	[event_id] varchar(50) NOT NULL,
	[created_at] datetime2 NOT NULL CONSTRAINT [event_workflows_created_at_default] DEFAULT (SYSDATETIME()),
	[created_by_user_id] int,
	CONSTRAINT [event_workflows_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [events] (
	[id] varchar(50),
	[name] varchar(500) NOT NULL,
	[name_ar] varchar(500),
	[description] varchar(500),
	[description_ar] varchar(500),
	[start_date] date NOT NULL,
	[end_date] date NOT NULL,
	[start_time] varchar(5),
	[end_time] varchar(5),
	[location] varchar(500),
	[location_ar] nvarchar(500),
	[organizers] varchar(500),
	[organizers_ar] varchar(500),
	[url] varchar(500),
	[category] varchar(500),
	[category_ar] nvarchar(500),
	[category_id] int,
	[event_type] varchar(500) NOT NULL CONSTRAINT [events_event_type_default] DEFAULT ('local'),
	[event_scope] varchar(500) NOT NULL CONSTRAINT [events_event_scope_default] DEFAULT ('external'),
	[expected_attendance] int,
	[agenda_en_file_name] varchar(500),
	[agenda_en_stored_file_name] varchar(500),
	[agenda_ar_file_name] varchar(500),
	[agenda_ar_stored_file_name] varchar(500),
	[is_scraped] bit NOT NULL CONSTRAINT [events_is_scraped_default] DEFAULT ((0)),
	[source] varchar(500) NOT NULL CONSTRAINT [events_source_default] DEFAULT ('manual'),
	[external_id] varchar(500),
	[admin_modified] bit NOT NULL CONSTRAINT [events_admin_modified_default] DEFAULT ((0)),
	[reminder_1_week] bit NOT NULL CONSTRAINT [events_reminder_1_week_default] DEFAULT ((1)),
	[reminder_1_day] bit NOT NULL CONSTRAINT [events_reminder_1_day_default] DEFAULT ((1)),
	[reminder_weekly] bit NOT NULL CONSTRAINT [events_reminder_weekly_default] DEFAULT ((0)),
	[reminder_daily] bit NOT NULL CONSTRAINT [events_reminder_daily_default] DEFAULT ((0)),
	[reminder_morning_of] bit NOT NULL CONSTRAINT [events_reminder_morning_of_default] DEFAULT ((0)),
	[is_archived] bit NOT NULL CONSTRAINT [events_is_archived_default] DEFAULT ((0)),
	[archived_at] datetime2,
	CONSTRAINT [events_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [folder_access_templates] (
	[id] int IDENTITY(1, 1),
	[name] varchar(100) NOT NULL,
	[description] varchar(500),
	[permissions] nvarchar(max),
	[is_default] bit NOT NULL CONSTRAINT [folder_access_templates_is_default_default] DEFAULT ((0)),
	[created_at] datetime2 NOT NULL CONSTRAINT [folder_access_templates_created_at_default] DEFAULT (SYSDATETIME()),
	[created_by_user_id] int,
	CONSTRAINT [folder_access_templates_pkey] PRIMARY KEY([id]),
	CONSTRAINT [folder_access_templates_name_key] UNIQUE([name])
);
--> statement-breakpoint
CREATE TABLE [interaction_attachments] (
	[id] int IDENTITY(1, 1),
	[lead_interaction_id] int,
	[partnership_interaction_id] int,
	[object_key] varchar(255) NOT NULL,
	[original_file_name] varchar(255) NOT NULL,
	[file_size] int NOT NULL,
	[mime_type] varchar(100) NOT NULL,
	[uploaded_by_user_id] int,
	[uploaded_at] datetime2 NOT NULL CONSTRAINT [interaction_attachments_uploaded_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [interaction_attachments_pkey] PRIMARY KEY([id]),
	CONSTRAINT [interaction_attachments_object_key_key] UNIQUE([object_key])
);
--> statement-breakpoint
CREATE TABLE [invitation_email_jobs] (
	[id] int IDENTITY(1, 1),
	[event_id] varchar(50) NOT NULL,
	[status] varchar(500) NOT NULL CONSTRAINT [invitation_email_jobs_status_default] DEFAULT ('pending'),
	[total_recipients] int NOT NULL CONSTRAINT [invitation_email_jobs_total_recipients_default] DEFAULT ((0)),
	[emails_sent] int NOT NULL CONSTRAINT [invitation_email_jobs_emails_sent_default] DEFAULT ((0)),
	[emails_failed] int NOT NULL CONSTRAINT [invitation_email_jobs_emails_failed_default] DEFAULT ((0)),
	[wait_time_seconds] int NOT NULL CONSTRAINT [invitation_email_jobs_wait_time_seconds_default] DEFAULT ((2)),
	[use_custom_email] bit NOT NULL CONSTRAINT [invitation_email_jobs_use_custom_email_default] DEFAULT ((0)),
	[started_at] datetime2,
	[completed_at] datetime2,
	[error_message] varchar(500),
	[created_at] datetime2 NOT NULL CONSTRAINT [invitation_email_jobs_created_at_default] DEFAULT (SYSDATETIME()),
	[created_by_user_id] int,
	CONSTRAINT [invitation_email_jobs_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [lead_interactions] (
	[id] int IDENTITY(1, 1),
	[lead_id] int NOT NULL,
	[type] varchar(500) NOT NULL,
	[description] varchar(500) NOT NULL,
	[description_ar] nvarchar(500),
	[outcome] varchar(500),
	[outcome_ar] nvarchar(500),
	[interaction_date] datetime2 NOT NULL CONSTRAINT [lead_interactions_interaction_date_default] DEFAULT (SYSDATETIME()),
	[created_by_user_id] int,
	[created_at] datetime2 NOT NULL CONSTRAINT [lead_interactions_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [lead_interactions_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [leads] (
	[id] int IDENTITY(1, 1),
	[name] varchar(500) NOT NULL,
	[name_ar] varchar(500),
	[email] varchar(500),
	[phone] varchar(500),
	[type] varchar(500) NOT NULL CONSTRAINT [leads_type_default] DEFAULT ('lead'),
	[status] varchar(500) NOT NULL CONSTRAINT [leads_status_default] DEFAULT ('active'),
	[organization_id] int,
	[organization_name] varchar(500),
	[notes] varchar(500),
	[notes_ar] nvarchar(500),
	[created_by_user_id] int,
	[created_at] datetime2 NOT NULL CONSTRAINT [leads_created_at_default] DEFAULT (SYSDATETIME()),
	[updated_at] datetime2 NOT NULL CONSTRAINT [leads_updated_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [leads_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [organizations] (
	[id] int IDENTITY(1, 1),
	[name_en] nvarchar(255) NOT NULL,
	[name_ar] nvarchar(255),
	[created_at] datetime2 NOT NULL CONSTRAINT [organizations_created_at_default] DEFAULT (SYSDATETIME()),
	[is_partner] bit NOT NULL CONSTRAINT [organizations_is_partner_default] DEFAULT ((0)),
	[partnership_status] varchar(500),
	[partnership_type_id] int,
	[partnership_start_date] date,
	[partnership_end_date] date,
	[agreement_signed_by] varchar(500),
	[agreement_signed_by_us] varchar(500),
	[partnership_notes] varchar(500),
	[logo_key] varchar(500),
	[website] varchar(500),
	[primary_contact_id] int,
	[country_id] int,
	[inactivity_threshold_months] int CONSTRAINT [organizations_inactivity_threshold_months_default] DEFAULT ((6)),
	[last_activity_date] datetime2,
	[notify_on_inactivity] bit CONSTRAINT [organizations_notify_on_inactivity_default] DEFAULT ((1)),
	[last_inactivity_notification_sent] datetime2,
	CONSTRAINT [organizations_pkey] PRIMARY KEY([id]),
	CONSTRAINT [organizations_name_en_key] UNIQUE([name_en])
);
--> statement-breakpoint
CREATE TABLE [partnership_activities] (
	[id] int IDENTITY(1, 1),
	[organization_id] int NOT NULL,
	[title] varchar(500) NOT NULL,
	[title_ar] varchar(500),
	[description] varchar(500),
	[description_ar] varchar(500),
	[activity_type] varchar(500) NOT NULL,
	[start_date] date NOT NULL,
	[end_date] date,
	[event_id] varchar(50),
	[outcome] varchar(500),
	[outcome_ar] varchar(500),
	[impact_score] int,
	[created_by_user_id] int,
	[created_at] datetime2 NOT NULL CONSTRAINT [partnership_activities_created_at_default] DEFAULT (SYSDATETIME()),
	[updated_at] datetime2 NOT NULL CONSTRAINT [partnership_activities_updated_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [partnership_activities_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [partnership_agreements] (
	[id] int IDENTITY(1, 1),
	[organization_id] int NOT NULL,
	[title] varchar(500) NOT NULL,
	[title_ar] varchar(500),
	[description] varchar(500),
	[description_ar] varchar(500),
	[agreement_type_id] int,
	[signed_date] date,
	[effective_date] date,
	[expiry_date] date,
	[partner_signatory] varchar(500),
	[partner_signatory_title] varchar(500),
	[our_signatory] varchar(500),
	[our_signatory_title] varchar(500),
	[document_key] varchar(500),
	[document_file_name] varchar(500),
	[status] varchar(500) NOT NULL CONSTRAINT [partnership_agreements_status_default] DEFAULT ('draft'),
	[legal_status] varchar(500),
	[languages] nvarchar(max),
	[termination_clause] varchar(500),
	[termination_clause_ar] varchar(500),
	[created_by_user_id] int,
	[created_at] datetime2 NOT NULL CONSTRAINT [partnership_agreements_created_at_default] DEFAULT (SYSDATETIME()),
	[updated_at] datetime2 NOT NULL CONSTRAINT [partnership_agreements_updated_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [partnership_agreements_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [partnership_comments] (
	[id] int IDENTITY(1, 1),
	[organization_id] int NOT NULL,
	[body] varchar(500) NOT NULL,
	[body_ar] varchar(500),
	[author_user_id] int,
	[created_at] datetime2 NOT NULL CONSTRAINT [partnership_comments_created_at_default] DEFAULT (SYSDATETIME()),
	[updated_at] datetime2 NOT NULL CONSTRAINT [partnership_comments_updated_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [partnership_comments_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [partnership_contacts] (
	[id] int IDENTITY(1, 1),
	[organization_id] int NOT NULL,
	[contact_id] int NOT NULL,
	[role] varchar(500),
	[role_ar] varchar(500),
	[is_primary] bit NOT NULL CONSTRAINT [partnership_contacts_is_primary_default] DEFAULT ((0)),
	[created_at] datetime2 NOT NULL CONSTRAINT [partnership_contacts_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [partnership_contacts_pkey] PRIMARY KEY([id]),
	CONSTRAINT [unique_partnership_contact] UNIQUE([organization_id],[contact_id])
);
--> statement-breakpoint
CREATE TABLE [partnership_interactions] (
	[id] int IDENTITY(1, 1),
	[organization_id] int NOT NULL,
	[type] varchar(500) NOT NULL,
	[description] varchar(500) NOT NULL,
	[description_ar] nvarchar(500),
	[outcome] varchar(500),
	[outcome_ar] nvarchar(500),
	[interaction_date] datetime2 NOT NULL CONSTRAINT [partnership_interactions_interaction_date_default] DEFAULT (SYSDATETIME()),
	[created_by_user_id] int,
	[created_at] datetime2 NOT NULL CONSTRAINT [partnership_interactions_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [partnership_interactions_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [partnership_types] (
	[id] int IDENTITY(1, 1),
	[name_en] nvarchar(255) NOT NULL,
	[name_ar] nvarchar(255),
	[created_at] datetime2 NOT NULL CONSTRAINT [partnership_types_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [partnership_types_pkey] PRIMARY KEY([id]),
	CONSTRAINT [partnership_types_name_en_key] UNIQUE([name_en])
);
--> statement-breakpoint
CREATE TABLE [positions] (
	[id] int IDENTITY(1, 1),
	[name_en] nvarchar(255) NOT NULL,
	[name_ar] nvarchar(255),
	[created_at] datetime2 NOT NULL CONSTRAINT [positions_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [positions_pkey] PRIMARY KEY([id]),
	CONSTRAINT [positions_name_en_key] UNIQUE([name_en])
);
--> statement-breakpoint
CREATE TABLE [reminder_queue] (
	[id] int IDENTITY(1, 1),
	[event_id] varchar(50) NOT NULL,
	[reminder_type] varchar NOT NULL,
	[scheduled_for] datetime2 NOT NULL,
	[status] varchar(500) NOT NULL CONSTRAINT [reminder_queue_status_default] DEFAULT ('pending'),
	[sent_at] datetime2,
	[attempts] int NOT NULL CONSTRAINT [reminder_queue_attempts_default] DEFAULT ((0)),
	[last_attempt] datetime2,
	[error_message] varchar(500),
	[created_at] datetime2 NOT NULL CONSTRAINT [reminder_queue_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [reminder_queue_pkey] PRIMARY KEY([id]),
	CONSTRAINT [unique_reminder] UNIQUE([event_id],[scheduled_for],[reminder_type])
);
--> statement-breakpoint
CREATE TABLE [sessions] (
	[sid] varchar,
	[sess] nvarchar(max),
	[expire] datetime2 NOT NULL,
	CONSTRAINT [sessions_pkey] PRIMARY KEY([sid])
);
--> statement-breakpoint
CREATE TABLE [settings] (
	[id] int IDENTITY(1, 1),
	[public_csv_export] bit NOT NULL CONSTRAINT [settings_public_csv_export_default] DEFAULT ((0)),
	[file_uploads_enabled] bit NOT NULL CONSTRAINT [settings_file_uploads_enabled_default] DEFAULT ((0)),
	[scraped_events_enabled] bit NOT NULL CONSTRAINT [settings_scraped_events_enabled_default] DEFAULT ((1)),
	[archive_enabled] bit NOT NULL CONSTRAINT [settings_archive_enabled_default] DEFAULT ((1)),
	[daily_reminder_global_enabled] bit NOT NULL CONSTRAINT [settings_daily_reminder_global_enabled_default] DEFAULT ((0)),
	[daily_reminder_global_time] varchar(50) CONSTRAINT [settings_daily_reminder_global_time_default] DEFAULT ('08:00'),
	[allow_stakeholder_attendee_upload] bit NOT NULL CONSTRAINT [settings_allow_stakeholder_attendee_upload_default] DEFAULT ((0)),
	[stakeholder_upload_permissions] nvarchar(max),
	CONSTRAINT [settings_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [task_comment_attachments] (
	[id] int IDENTITY(1, 1),
	[comment_id] int NOT NULL,
	[file_name] varchar(500) NOT NULL,
	[stored_file_name] varchar(500) NOT NULL,
	[file_size] int NOT NULL,
	[mime_type] varchar(500) NOT NULL,
	[uploaded_at] datetime2 NOT NULL CONSTRAINT [task_comment_attachments_uploaded_at_default] DEFAULT (SYSDATETIME()),
	[uploaded_by_user_id] int,
	CONSTRAINT [task_comment_attachments_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [task_comments] (
	[id] int IDENTITY(1, 1),
	[task_id] int NOT NULL,
	[author_user_id] int,
	[body] varchar(500) NOT NULL,
	[created_at] datetime2 NOT NULL CONSTRAINT [task_comments_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [task_comments_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [task_template_prerequisites] (
	[id] int IDENTITY(1, 1),
	[task_template_id] int NOT NULL,
	[prerequisite_template_id] int NOT NULL,
	[created_at] datetime2 NOT NULL CONSTRAINT [task_template_prerequisites_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [task_template_prerequisites_pkey] PRIMARY KEY([id]),
	CONSTRAINT [unique_task_prerequisite] UNIQUE([task_template_id],[prerequisite_template_id])
);
--> statement-breakpoint
CREATE TABLE [tasks] (
	[id] int IDENTITY(1, 1),
	[event_department_id] int,
	[lead_id] int,
	[partnership_id] int,
	[department_id] int,
	[title] varchar(500) NOT NULL,
	[title_ar] varchar(500),
	[description] varchar(500) NOT NULL,
	[description_ar] nvarchar(500),
	[status] varchar(500) NOT NULL CONSTRAINT [tasks_status_default] DEFAULT ('pending'),
	[priority] varchar(50) NOT NULL CONSTRAINT [tasks_priority_default] DEFAULT ('medium'),
	[due_date] date,
	[created_by_user_id] int,
	[created_at] datetime2 NOT NULL CONSTRAINT [tasks_created_at_default] DEFAULT (SYSDATETIME()),
	[updated_at] datetime2 NOT NULL CONSTRAINT [tasks_updated_at_default] DEFAULT (SYSDATETIME()),
	[completed_at] datetime2,
	[notification_emails] nvarchar(max),
	CONSTRAINT [tasks_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [updates] (
	[id] int IDENTITY(1, 1),
	[type] varchar(500) NOT NULL,
	[period_start] date NOT NULL,
	[content] varchar(500) NOT NULL CONSTRAINT [updates_content_default] DEFAULT (''),
	[department_id] int,
	[created_at] datetime2 NOT NULL CONSTRAINT [updates_created_at_default] DEFAULT (SYSDATETIME()),
	[updated_at] datetime2 NOT NULL CONSTRAINT [updates_updated_at_default] DEFAULT (SYSDATETIME()),
	[updated_by_user_id] int,
	CONSTRAINT [updates_pkey] PRIMARY KEY([id]),
	CONSTRAINT [unique_update_period] UNIQUE([type],[period_start],[department_id])
);
--> statement-breakpoint
CREATE TABLE [users] (
	[id] int IDENTITY(1, 1),
	[username] varchar(255) NOT NULL,
	[password] varchar(500),
	[role] varchar(500) NOT NULL CONSTRAINT [users_role_default] DEFAULT ('admin'),
	[keycloak_id] nvarchar(255),
	[email] varchar(500),
	[created_at] datetime2 NOT NULL CONSTRAINT [users_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [users_pkey] PRIMARY KEY([id]),
	CONSTRAINT [users_username_key] UNIQUE([username])
);
--> statement-breakpoint
CREATE TABLE [whatsapp_config] (
	[id] int IDENTITY(1, 1),
	[enabled] bit NOT NULL CONSTRAINT [whatsapp_config_enabled_default] DEFAULT ((0)),
	[chat_id] varchar(500),
	[chat_name] varchar(500),
	[updates_chat_id] varchar(500),
	[updates_chat_name] varchar(500),
	[language] varchar(50) NOT NULL CONSTRAINT [whatsapp_config_language_default] DEFAULT ('en'),
	[created_at] datetime2 NOT NULL CONSTRAINT [whatsapp_config_created_at_default] DEFAULT (SYSDATETIME()),
	[updated_at] datetime2 NOT NULL CONSTRAINT [whatsapp_config_updated_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [whatsapp_config_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [whatsapp_templates] (
	[id] int IDENTITY(1, 1),
	[type] varchar(500) NOT NULL,
	[language] varchar(50) NOT NULL CONSTRAINT [whatsapp_templates_language_default] DEFAULT ('en'),
	[template] varchar(500) NOT NULL,
	[created_at] datetime2 NOT NULL CONSTRAINT [whatsapp_templates_created_at_default] DEFAULT (SYSDATETIME()),
	[updated_at] datetime2 NOT NULL CONSTRAINT [whatsapp_templates_updated_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [whatsapp_templates_pkey] PRIMARY KEY([id]),
	CONSTRAINT [unique_whatsapp_template] UNIQUE([type],[language])
);
--> statement-breakpoint
CREATE TABLE [workflow_tasks] (
	[id] int IDENTITY(1, 1),
	[workflow_id] int NOT NULL,
	[task_id] int NOT NULL,
	[prerequisite_task_id] int,
	[order_index] int NOT NULL CONSTRAINT [workflow_tasks_order_index_default] DEFAULT ((0)),
	[created_at] datetime2 NOT NULL CONSTRAINT [workflow_tasks_created_at_default] DEFAULT (SYSDATETIME()),
	CONSTRAINT [workflow_tasks_pkey] PRIMARY KEY([id]),
	CONSTRAINT [unique_workflow_task] UNIQUE([workflow_id],[task_id])
);
--> statement-breakpoint
ALTER TABLE [agreement_attachments] ADD CONSTRAINT [agreement_attachments_agreement_id_partnership_agreements_id_fk] FOREIGN KEY ([agreement_id]) REFERENCES [partnership_agreements]([id]);--> statement-breakpoint
ALTER TABLE [agreement_attachments] ADD CONSTRAINT [agreement_attachments_uploaded_by_user_id_users_id_fk] FOREIGN KEY ([uploaded_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [ai_chat_conversations] ADD CONSTRAINT [ai_chat_conversations_user_id_users_id_fk] FOREIGN KEY ([user_id]) REFERENCES [users]([id]);--> statement-breakpoint
ALTER TABLE [ai_chat_messages] ADD CONSTRAINT [ai_chat_messages_conversation_id_ai_chat_conversations_id_fk] FOREIGN KEY ([conversation_id]) REFERENCES [ai_chat_conversations]([id]);--> statement-breakpoint
ALTER TABLE [archive_media] ADD CONSTRAINT [archive_media_archived_event_id_archived_events_id_fk] FOREIGN KEY ([archived_event_id]) REFERENCES [archived_events]([id]);--> statement-breakpoint
ALTER TABLE [archive_media] ADD CONSTRAINT [archive_media_original_event_media_id_event_media_id_fk] FOREIGN KEY ([original_event_media_id]) REFERENCES [event_media]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [archive_media] ADD CONSTRAINT [archive_media_uploaded_by_user_id_users_id_fk] FOREIGN KEY ([uploaded_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [archived_event_speakers] ADD CONSTRAINT [archived_event_speakers_archived_event_id_archived_events_id_fk] FOREIGN KEY ([archived_event_id]) REFERENCES [archived_events]([id]);--> statement-breakpoint
ALTER TABLE [archived_event_speakers] ADD CONSTRAINT [archived_event_speakers_contact_id_contacts_id_fk] FOREIGN KEY ([contact_id]) REFERENCES [contacts]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [archived_events] ADD CONSTRAINT [archived_events_category_id_categories_id_fk] FOREIGN KEY ([category_id]) REFERENCES [categories]([id]);--> statement-breakpoint
ALTER TABLE [archived_events] ADD CONSTRAINT [archived_events_original_event_id_events_id_fk] FOREIGN KEY ([original_event_id]) REFERENCES [events]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [archived_events] ADD CONSTRAINT [archived_events_archived_by_user_id_users_id_fk] FOREIGN KEY ([archived_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [auth_identities] ADD CONSTRAINT [auth_identities_user_id_users_id_fk] FOREIGN KEY ([user_id]) REFERENCES [users]([id]);--> statement-breakpoint
ALTER TABLE [contacts] ADD CONSTRAINT [contacts_organization_id_organizations_id_fk] FOREIGN KEY ([organization_id]) REFERENCES [organizations]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [contacts] ADD CONSTRAINT [contacts_position_id_positions_id_fk] FOREIGN KEY ([position_id]) REFERENCES [positions]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [contacts] ADD CONSTRAINT [contacts_country_id_countries_id_fk] FOREIGN KEY ([country_id]) REFERENCES [countries]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [department_accounts] ADD CONSTRAINT [department_accounts_user_id_users_id_fk] FOREIGN KEY ([user_id]) REFERENCES [users]([id]);--> statement-breakpoint
ALTER TABLE [department_accounts] ADD CONSTRAINT [department_accounts_department_id_departments_id_fk] FOREIGN KEY ([department_id]) REFERENCES [departments]([id]);--> statement-breakpoint
ALTER TABLE [department_accounts] ADD CONSTRAINT [department_accounts_primary_email_id_department_emails_id_fk] FOREIGN KEY ([primary_email_id]) REFERENCES [department_emails]([id]);--> statement-breakpoint
ALTER TABLE [department_emails] ADD CONSTRAINT [department_emails_department_id_departments_id_fk] FOREIGN KEY ([department_id]) REFERENCES [departments]([id]);--> statement-breakpoint
ALTER TABLE [department_requirements] ADD CONSTRAINT [department_requirements_department_id_departments_id_fk] FOREIGN KEY ([department_id]) REFERENCES [departments]([id]);--> statement-breakpoint
ALTER TABLE [event_access_grants] ADD CONSTRAINT [event_access_grants_event_id_events_id_fk] FOREIGN KEY ([event_id]) REFERENCES [events]([id]);--> statement-breakpoint
ALTER TABLE [event_access_grants] ADD CONSTRAINT [event_access_grants_user_id_users_id_fk] FOREIGN KEY ([user_id]) REFERENCES [users]([id]);--> statement-breakpoint
ALTER TABLE [event_access_grants] ADD CONSTRAINT [event_access_grants_template_id_folder_access_templates_id_fk] FOREIGN KEY ([template_id]) REFERENCES [folder_access_templates]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [event_access_grants] ADD CONSTRAINT [event_access_grants_granted_by_user_id_users_id_fk] FOREIGN KEY ([granted_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [event_attendees] ADD CONSTRAINT [event_attendees_event_id_events_id_fk] FOREIGN KEY ([event_id]) REFERENCES [events]([id]);--> statement-breakpoint
ALTER TABLE [event_attendees] ADD CONSTRAINT [event_attendees_contact_id_contacts_id_fk] FOREIGN KEY ([contact_id]) REFERENCES [contacts]([id]);--> statement-breakpoint
ALTER TABLE [event_custom_emails] ADD CONSTRAINT [event_custom_emails_event_id_events_id_fk] FOREIGN KEY ([event_id]) REFERENCES [events]([id]);--> statement-breakpoint
ALTER TABLE [event_custom_emails] ADD CONSTRAINT [event_custom_emails_created_by_user_id_users_id_fk] FOREIGN KEY ([created_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [event_departments] ADD CONSTRAINT [event_departments_event_id_events_id_fk] FOREIGN KEY ([event_id]) REFERENCES [events]([id]);--> statement-breakpoint
ALTER TABLE [event_departments] ADD CONSTRAINT [event_departments_department_id_departments_id_fk] FOREIGN KEY ([department_id]) REFERENCES [departments]([id]);--> statement-breakpoint
ALTER TABLE [event_files] ADD CONSTRAINT [event_files_event_folder_id_event_folders_id_fk] FOREIGN KEY ([event_folder_id]) REFERENCES [event_folders]([id]);--> statement-breakpoint
ALTER TABLE [event_files] ADD CONSTRAINT [event_files_uploaded_by_user_id_users_id_fk] FOREIGN KEY ([uploaded_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [event_folder_permissions] ADD CONSTRAINT [event_folder_permissions_event_folder_id_event_folders_id_fk] FOREIGN KEY ([event_folder_id]) REFERENCES [event_folders]([id]);--> statement-breakpoint
ALTER TABLE [event_folder_permissions] ADD CONSTRAINT [event_folder_permissions_user_id_users_id_fk] FOREIGN KEY ([user_id]) REFERENCES [users]([id]);--> statement-breakpoint
ALTER TABLE [event_folder_permissions] ADD CONSTRAINT [event_folder_permissions_granted_by_user_id_users_id_fk] FOREIGN KEY ([granted_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [event_folders] ADD CONSTRAINT [event_folders_event_id_events_id_fk] FOREIGN KEY ([event_id]) REFERENCES [events]([id]);--> statement-breakpoint
ALTER TABLE [event_folders] ADD CONSTRAINT [event_folders_created_by_user_id_users_id_fk] FOREIGN KEY ([created_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [event_invitees] ADD CONSTRAINT [event_invitees_event_id_events_id_fk] FOREIGN KEY ([event_id]) REFERENCES [events]([id]);--> statement-breakpoint
ALTER TABLE [event_invitees] ADD CONSTRAINT [event_invitees_contact_id_contacts_id_fk] FOREIGN KEY ([contact_id]) REFERENCES [contacts]([id]);--> statement-breakpoint
ALTER TABLE [event_media] ADD CONSTRAINT [event_media_event_id_events_id_fk] FOREIGN KEY ([event_id]) REFERENCES [events]([id]);--> statement-breakpoint
ALTER TABLE [event_media] ADD CONSTRAINT [event_media_uploaded_by_user_id_users_id_fk] FOREIGN KEY ([uploaded_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [event_speakers] ADD CONSTRAINT [event_speakers_event_id_events_id_fk] FOREIGN KEY ([event_id]) REFERENCES [events]([id]);--> statement-breakpoint
ALTER TABLE [event_speakers] ADD CONSTRAINT [event_speakers_contact_id_contacts_id_fk] FOREIGN KEY ([contact_id]) REFERENCES [contacts]([id]);--> statement-breakpoint
ALTER TABLE [event_workflows] ADD CONSTRAINT [event_workflows_event_id_events_id_fk] FOREIGN KEY ([event_id]) REFERENCES [events]([id]);--> statement-breakpoint
ALTER TABLE [event_workflows] ADD CONSTRAINT [event_workflows_created_by_user_id_users_id_fk] FOREIGN KEY ([created_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [events] ADD CONSTRAINT [events_category_id_categories_id_fk] FOREIGN KEY ([category_id]) REFERENCES [categories]([id]);--> statement-breakpoint
ALTER TABLE [folder_access_templates] ADD CONSTRAINT [folder_access_templates_created_by_user_id_users_id_fk] FOREIGN KEY ([created_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [interaction_attachments] ADD CONSTRAINT [interaction_attachments_lead_interaction_id_lead_interactions_id_fk] FOREIGN KEY ([lead_interaction_id]) REFERENCES [lead_interactions]([id]);--> statement-breakpoint
ALTER TABLE [interaction_attachments] ADD CONSTRAINT [interaction_attachments_partnership_interaction_id_partnership_interactions_id_fk] FOREIGN KEY ([partnership_interaction_id]) REFERENCES [partnership_interactions]([id]);--> statement-breakpoint
ALTER TABLE [interaction_attachments] ADD CONSTRAINT [interaction_attachments_uploaded_by_user_id_users_id_fk] FOREIGN KEY ([uploaded_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [invitation_email_jobs] ADD CONSTRAINT [invitation_email_jobs_event_id_events_id_fk] FOREIGN KEY ([event_id]) REFERENCES [events]([id]);--> statement-breakpoint
ALTER TABLE [invitation_email_jobs] ADD CONSTRAINT [invitation_email_jobs_created_by_user_id_users_id_fk] FOREIGN KEY ([created_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [lead_interactions] ADD CONSTRAINT [lead_interactions_lead_id_leads_id_fk] FOREIGN KEY ([lead_id]) REFERENCES [leads]([id]);--> statement-breakpoint
ALTER TABLE [lead_interactions] ADD CONSTRAINT [lead_interactions_created_by_user_id_users_id_fk] FOREIGN KEY ([created_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [leads] ADD CONSTRAINT [leads_organization_id_organizations_id_fk] FOREIGN KEY ([organization_id]) REFERENCES [organizations]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [leads] ADD CONSTRAINT [leads_created_by_user_id_users_id_fk] FOREIGN KEY ([created_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [organizations] ADD CONSTRAINT [organizations_partnership_type_id_partnership_types_id_fk] FOREIGN KEY ([partnership_type_id]) REFERENCES [partnership_types]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [organizations] ADD CONSTRAINT [organizations_country_id_countries_id_fk] FOREIGN KEY ([country_id]) REFERENCES [countries]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [partnership_activities] ADD CONSTRAINT [partnership_activities_organization_id_organizations_id_fk] FOREIGN KEY ([organization_id]) REFERENCES [organizations]([id]);--> statement-breakpoint
ALTER TABLE [partnership_activities] ADD CONSTRAINT [partnership_activities_event_id_events_id_fk] FOREIGN KEY ([event_id]) REFERENCES [events]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [partnership_activities] ADD CONSTRAINT [partnership_activities_created_by_user_id_users_id_fk] FOREIGN KEY ([created_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [partnership_agreements] ADD CONSTRAINT [partnership_agreements_organization_id_organizations_id_fk] FOREIGN KEY ([organization_id]) REFERENCES [organizations]([id]);--> statement-breakpoint
ALTER TABLE [partnership_agreements] ADD CONSTRAINT [partnership_agreements_agreement_type_id_agreement_types_id_fk] FOREIGN KEY ([agreement_type_id]) REFERENCES [agreement_types]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [partnership_agreements] ADD CONSTRAINT [partnership_agreements_created_by_user_id_users_id_fk] FOREIGN KEY ([created_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [partnership_comments] ADD CONSTRAINT [partnership_comments_organization_id_organizations_id_fk] FOREIGN KEY ([organization_id]) REFERENCES [organizations]([id]);--> statement-breakpoint
ALTER TABLE [partnership_comments] ADD CONSTRAINT [partnership_comments_author_user_id_users_id_fk] FOREIGN KEY ([author_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [partnership_contacts] ADD CONSTRAINT [partnership_contacts_organization_id_organizations_id_fk] FOREIGN KEY ([organization_id]) REFERENCES [organizations]([id]);--> statement-breakpoint
ALTER TABLE [partnership_contacts] ADD CONSTRAINT [partnership_contacts_contact_id_contacts_id_fk] FOREIGN KEY ([contact_id]) REFERENCES [contacts]([id]);--> statement-breakpoint
ALTER TABLE [partnership_interactions] ADD CONSTRAINT [partnership_interactions_organization_id_organizations_id_fk] FOREIGN KEY ([organization_id]) REFERENCES [organizations]([id]);--> statement-breakpoint
ALTER TABLE [partnership_interactions] ADD CONSTRAINT [partnership_interactions_created_by_user_id_users_id_fk] FOREIGN KEY ([created_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [reminder_queue] ADD CONSTRAINT [reminder_queue_event_id_events_id_fk] FOREIGN KEY ([event_id]) REFERENCES [events]([id]);--> statement-breakpoint
ALTER TABLE [task_comment_attachments] ADD CONSTRAINT [task_comment_attachments_comment_id_task_comments_id_fk] FOREIGN KEY ([comment_id]) REFERENCES [task_comments]([id]);--> statement-breakpoint
ALTER TABLE [task_comment_attachments] ADD CONSTRAINT [task_comment_attachments_uploaded_by_user_id_users_id_fk] FOREIGN KEY ([uploaded_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [task_comments] ADD CONSTRAINT [task_comments_task_id_tasks_id_fk] FOREIGN KEY ([task_id]) REFERENCES [tasks]([id]);--> statement-breakpoint
ALTER TABLE [task_comments] ADD CONSTRAINT [task_comments_author_user_id_users_id_fk] FOREIGN KEY ([author_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [task_template_prerequisites] ADD CONSTRAINT [task_template_prerequisites_task_template_id_department_requirements_id_fk] FOREIGN KEY ([task_template_id]) REFERENCES [department_requirements]([id]);--> statement-breakpoint
ALTER TABLE [task_template_prerequisites] ADD CONSTRAINT [task_template_prerequisites_prerequisite_template_id_department_requirements_id_fk] FOREIGN KEY ([prerequisite_template_id]) REFERENCES [department_requirements]([id]);--> statement-breakpoint
ALTER TABLE [tasks] ADD CONSTRAINT [tasks_event_department_id_event_departments_id_fk] FOREIGN KEY ([event_department_id]) REFERENCES [event_departments]([id]);--> statement-breakpoint
ALTER TABLE [tasks] ADD CONSTRAINT [tasks_lead_id_leads_id_fk] FOREIGN KEY ([lead_id]) REFERENCES [leads]([id]);--> statement-breakpoint
ALTER TABLE [tasks] ADD CONSTRAINT [tasks_partnership_id_organizations_id_fk] FOREIGN KEY ([partnership_id]) REFERENCES [organizations]([id]);--> statement-breakpoint
ALTER TABLE [tasks] ADD CONSTRAINT [tasks_department_id_departments_id_fk] FOREIGN KEY ([department_id]) REFERENCES [departments]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [tasks] ADD CONSTRAINT [tasks_created_by_user_id_users_id_fk] FOREIGN KEY ([created_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [updates] ADD CONSTRAINT [updates_department_id_departments_id_fk] FOREIGN KEY ([department_id]) REFERENCES [departments]([id]);--> statement-breakpoint
ALTER TABLE [updates] ADD CONSTRAINT [updates_updated_by_user_id_users_id_fk] FOREIGN KEY ([updated_by_user_id]) REFERENCES [users]([id]) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE [workflow_tasks] ADD CONSTRAINT [workflow_tasks_workflow_id_event_workflows_id_fk] FOREIGN KEY ([workflow_id]) REFERENCES [event_workflows]([id]);--> statement-breakpoint
ALTER TABLE [workflow_tasks] ADD CONSTRAINT [workflow_tasks_task_id_tasks_id_fk] FOREIGN KEY ([task_id]) REFERENCES [tasks]([id]);--> statement-breakpoint
ALTER TABLE [workflow_tasks] ADD CONSTRAINT [workflow_tasks_prerequisite_task_id_tasks_id_fk] FOREIGN KEY ([prerequisite_task_id]) REFERENCES [tasks]([id]) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX [IDX_agreement_attachments_agreement_id] ON [agreement_attachments] ([agreement_id]);--> statement-breakpoint
CREATE INDEX [idx_ai_chat_conversations_user_id] ON [ai_chat_conversations] ([user_id]);--> statement-breakpoint
CREATE INDEX [idx_ai_chat_conversations_updated_at] ON [ai_chat_conversations] ([updated_at]);--> statement-breakpoint
CREATE INDEX [idx_ai_chat_messages_conversation_id] ON [ai_chat_messages] ([conversation_id]);--> statement-breakpoint
CREATE INDEX [idx_ai_chat_messages_created_at] ON [ai_chat_messages] ([created_at]);--> statement-breakpoint
CREATE INDEX [IDX_archive_media_archived_event_id] ON [archive_media] ([archived_event_id]);--> statement-breakpoint
CREATE INDEX [IDX_archive_media_display_order] ON [archive_media] ([archived_event_id],[display_order]);--> statement-breakpoint
CREATE INDEX [IDX_archive_media_original_event_media_id] ON [archive_media] ([original_event_media_id]);--> statement-breakpoint
CREATE INDEX [IDX_archived_event_speakers_archived_event_id] ON [archived_event_speakers] ([archived_event_id]);--> statement-breakpoint
CREATE INDEX [IDX_archived_event_speakers_contact_id] ON [archived_event_speakers] ([contact_id]);--> statement-breakpoint
CREATE INDEX [IDX_archived_events_original_event_id] ON [archived_events] ([original_event_id]);--> statement-breakpoint
CREATE INDEX [IDX_archived_events_start_date] ON [archived_events] ([start_date]);--> statement-breakpoint
CREATE INDEX [IDX_archived_events_category_id] ON [archived_events] ([category_id]);--> statement-breakpoint
CREATE INDEX [IDX_auth_identities_user_id] ON [auth_identities] ([user_id]);--> statement-breakpoint
CREATE INDEX [IDX_auth_identities_provider_external] ON [auth_identities] ([provider],[external]);--> statement-breakpoint
CREATE INDEX [IDX_contacts_organization_id] ON [contacts] ([organization_id]);--> statement-breakpoint
CREATE INDEX [IDX_contacts_position_id] ON [contacts] ([position_id]);--> statement-breakpoint
CREATE INDEX [IDX_contacts_country_id] ON [contacts] ([country_id]);--> statement-breakpoint
CREATE INDEX [IDX_contacts_is_eligible_speaker] ON [contacts] ([is_eligible_speaker]);--> statement-breakpoint
CREATE INDEX [IDX_email_templates_type_language] ON [email_templates] ([type],[language]);--> statement-breakpoint
CREATE INDEX [IDX_event_access_grants_event_id] ON [event_access_grants] ([event_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_access_grants_user_id] ON [event_access_grants] ([user_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_attendees_event_id] ON [event_attendees] ([event_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_attendees_contact_id] ON [event_attendees] ([contact_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_custom_emails_event_id] ON [event_custom_emails] ([event_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_files_event_folder_id] ON [event_files] ([event_folder_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_files_source] ON [event_files] ([source_type],[source_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_files_uploaded_by] ON [event_files] ([uploaded_by_user_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_folder_permissions_folder_id] ON [event_folder_permissions] ([event_folder_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_folder_permissions_user_id] ON [event_folder_permissions] ([user_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_folders_event_id] ON [event_folders] ([event_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_folders_parent_folder_id] ON [event_folders] ([parent_folder_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_folders_path] ON [event_folders] ([event_id],[path]);--> statement-breakpoint
CREATE INDEX [IDX_event_invitees_event_id] ON [event_invitees] ([event_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_invitees_contact_id] ON [event_invitees] ([contact_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_invitees_rsvp] ON [event_invitees] ([rsvp]);--> statement-breakpoint
CREATE INDEX [IDX_event_invitees_registered] ON [event_invitees] ([registered]);--> statement-breakpoint
CREATE INDEX [IDX_event_invitees_invite_email_sent] ON [event_invitees] ([invite_email_sent]);--> statement-breakpoint
CREATE INDEX [IDX_event_media_event_id] ON [event_media] ([event_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_media_display_order] ON [event_media] ([event_id],[display_order]);--> statement-breakpoint
CREATE INDEX [IDX_event_speakers_event_id] ON [event_speakers] ([event_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_speakers_contact_id] ON [event_speakers] ([contact_id]);--> statement-breakpoint
CREATE INDEX [IDX_event_workflows_event_id] ON [event_workflows] ([event_id]);--> statement-breakpoint
CREATE INDEX [IDX_folder_access_templates_is_default] ON [folder_access_templates] ([is_default]);--> statement-breakpoint
CREATE INDEX [IDX_interaction_attachments_lead] ON [interaction_attachments] ([lead_interaction_id]);--> statement-breakpoint
CREATE INDEX [IDX_interaction_attachments_partnership] ON [interaction_attachments] ([partnership_interaction_id]);--> statement-breakpoint
CREATE INDEX [IDX_interaction_attachments_uploaded_by] ON [interaction_attachments] ([uploaded_by_user_id]);--> statement-breakpoint
CREATE INDEX [IDX_invitation_email_jobs_event_id] ON [invitation_email_jobs] ([event_id]);--> statement-breakpoint
CREATE INDEX [IDX_invitation_email_jobs_status] ON [invitation_email_jobs] ([status]);--> statement-breakpoint
CREATE INDEX [IDX_invitation_email_jobs_created_at] ON [invitation_email_jobs] ([created_at]);--> statement-breakpoint
CREATE INDEX [IDX_lead_interactions_lead_id] ON [lead_interactions] ([lead_id]);--> statement-breakpoint
CREATE INDEX [IDX_lead_interactions_type] ON [lead_interactions] ([type]);--> statement-breakpoint
CREATE INDEX [IDX_lead_interactions_date] ON [lead_interactions] ([interaction_date]);--> statement-breakpoint
CREATE INDEX [IDX_leads_type] ON [leads] ([type]);--> statement-breakpoint
CREATE INDEX [IDX_leads_status] ON [leads] ([status]);--> statement-breakpoint
CREATE INDEX [IDX_leads_organization] ON [leads] ([organization_id]);--> statement-breakpoint
CREATE INDEX [IDX_leads_name] ON [leads] ([name]);--> statement-breakpoint
CREATE INDEX [IDX_organizations_is_partner] ON [organizations] ([is_partner]);--> statement-breakpoint
CREATE INDEX [IDX_organizations_partnership_status] ON [organizations] ([partnership_status]);--> statement-breakpoint
CREATE INDEX [IDX_organizations_country_id] ON [organizations] ([country_id]);--> statement-breakpoint
CREATE INDEX [IDX_organizations_last_activity] ON [organizations] ([last_activity_date]);--> statement-breakpoint
CREATE INDEX [IDX_partnership_activities_org_id] ON [partnership_activities] ([organization_id]);--> statement-breakpoint
CREATE INDEX [IDX_partnership_activities_type] ON [partnership_activities] ([activity_type]);--> statement-breakpoint
CREATE INDEX [IDX_partnership_activities_event_id] ON [partnership_activities] ([event_id]);--> statement-breakpoint
CREATE INDEX [IDX_partnership_agreements_org_id] ON [partnership_agreements] ([organization_id]);--> statement-breakpoint
CREATE INDEX [IDX_partnership_agreements_status] ON [partnership_agreements] ([status]);--> statement-breakpoint
CREATE INDEX [IDX_partnership_agreements_legal_status] ON [partnership_agreements] ([legal_status]);--> statement-breakpoint
CREATE INDEX [IDX_partnership_comments_org_id] ON [partnership_comments] ([organization_id]);--> statement-breakpoint
CREATE INDEX [IDX_partnership_comments_author] ON [partnership_comments] ([author_user_id]);--> statement-breakpoint
CREATE INDEX [IDX_partnership_contacts_org_id] ON [partnership_contacts] ([organization_id]);--> statement-breakpoint
CREATE INDEX [IDX_partnership_contacts_contact_id] ON [partnership_contacts] ([contact_id]);--> statement-breakpoint
CREATE INDEX [IDX_partnership_interactions_org_id] ON [partnership_interactions] ([organization_id]);--> statement-breakpoint
CREATE INDEX [IDX_partnership_interactions_type] ON [partnership_interactions] ([type]);--> statement-breakpoint
CREATE INDEX [IDX_partnership_interactions_date] ON [partnership_interactions] ([interaction_date]);--> statement-breakpoint
CREATE INDEX [IDX_session_expire] ON [sessions] ([expire]);--> statement-breakpoint
CREATE INDEX [IDX_task_comment_attachments_comment_id] ON [task_comment_attachments] ([comment_id]);--> statement-breakpoint
CREATE INDEX [IDX_task_comments_task_id] ON [task_comments] ([task_id]);--> statement-breakpoint
CREATE INDEX [IDX_prerequisite_task_template] ON [task_template_prerequisites] ([task_template_id]);--> statement-breakpoint
CREATE INDEX [IDX_prerequisite_template] ON [task_template_prerequisites] ([prerequisite_template_id]);--> statement-breakpoint
CREATE INDEX [IDX_tasks_event_department_id] ON [tasks] ([event_department_id]);--> statement-breakpoint
CREATE INDEX [IDX_tasks_lead_id] ON [tasks] ([lead_id]);--> statement-breakpoint
CREATE INDEX [IDX_tasks_partnership_id] ON [tasks] ([partnership_id]);--> statement-breakpoint
CREATE INDEX [IDX_tasks_department_id] ON [tasks] ([department_id]);--> statement-breakpoint
CREATE INDEX [IDX_tasks_status] ON [tasks] ([status]);--> statement-breakpoint
CREATE INDEX [IDX_tasks_priority] ON [tasks] ([priority]);--> statement-breakpoint
CREATE INDEX [IDX_updates_type_period] ON [updates] ([type],[period_start]);--> statement-breakpoint
CREATE INDEX [IDX_updates_department_id] ON [updates] ([department_id]);--> statement-breakpoint
CREATE INDEX [IDX_whatsapp_templates_type_language] ON [whatsapp_templates] ([type],[language]);--> statement-breakpoint
CREATE INDEX [IDX_workflow_tasks_workflow_id] ON [workflow_tasks] ([workflow_id]);--> statement-breakpoint
CREATE INDEX [IDX_workflow_tasks_task_id] ON [workflow_tasks] ([task_id]);--> statement-breakpoint
CREATE INDEX [IDX_workflow_tasks_prerequisite] ON [workflow_tasks] ([prerequisite_task_id]);