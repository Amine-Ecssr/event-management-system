import { sql } from "drizzle-orm";
import { mssqlTable, text, varchar, nvarchar, date, int, datetime2, index, bit, unique } from "drizzle-orm/mssql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
// NOTE: `serial()` columns were converted to `int()` for MSSQL. If you want auto-increment behavior, we will add IDENTITY in a later phase (or via custom migration).
export const users = mssqlTable("users", {
  id: int("id").primaryKey().identity(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 500 }), // Nullable for Keycloak-only users
  role: varchar("role", { length: 500 }).notNull().default('admin'), // 'superadmin', 'admin', 'department', 'department_admin', 'event_lead', or 'staff'
  keycloakId: nvarchar("keycloak_id", { length: 255 }), // Keycloak user ID (sub claim)
  email: varchar("email", { length: 500 }), // Email from Keycloak
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
});

export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  role: z.enum(['superadmin', 'admin', 'department', 'department_admin', 'event_lead', 'staff', 'viewer']).default('admin'),
  keycloakId: z.string().optional(),
  email: z.string().email().optional(),
}).omit({
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Auth identities table for LDAP and other authentication providers
export const authIdentities = mssqlTable(
  "auth_identities",
  {
    id: int("id").primaryKey().identity(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: 'no action' }),
    provider: varchar("provider", { length: 500 }).notNull(), // 'local', 'ldap', future providers
    externalId: varchar("external", { length: 500 }), // For LDAP: user DN or other external identifier
    metadata: nvarchar("metadata", { length: "max" }), // Provider-specific data
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
    updatedAt: datetime2("updated_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    index("IDX_auth_identities_user_id").on(table.userId),
    index("IDX_auth_identities_provider_external").on(table.provider, table.externalId),
  ],
);

export const insertAuthIdentitySchema = createInsertSchema(authIdentities).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertAuthIdentity = z.infer<typeof insertAuthIdentitySchema>;
export type AuthIdentity = typeof authIdentities.$inferSelect;

// Sessions table for session storage
export const sessions = mssqlTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: nvarchar("sess", { length: "max" }),
    expire: datetime2("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Categories table for bilingual category management
export const categories = mssqlTable("categories", {
  id: int("id").primaryKey().identity(),
  nameEn: nvarchar("name_en", { length: 255 }).notNull().unique(),
  nameAr: varchar("name_ar", { length: 255 }),
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
});

export const insertCategorySchema = createInsertSchema(categories, {
  nameEn: z.string().min(1, "Category name (English) is required"),
  nameAr: z.string().optional(),
}).omit({
  createdAt: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Events table
export const events = mssqlTable("events", {
  id: varchar("id", { length: 50 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 500 }).notNull(),
  nameAr: varchar("name_ar", { length: 500 }), // Arabic name (nullable for backward compatibility)
  description: varchar("description", { length: 500 }), // Optional description
  descriptionAr: varchar("description_ar", { length: 500 }), // Arabic description (nullable)
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  startTime: varchar("start_time", { length: 5 }), // Optional time in HH:MM format (24-hour)
  endTime: varchar("end_time", { length: 5 }), // Optional time in HH:MM format (24-hour)
  location: varchar("location", { length: 500 }), // Optional location
  locationAr: nvarchar("location_ar", { length: 500 }), // Arabic location (nullable)
  organizers: varchar("organizers", { length: 500 }),
  organizersAr: varchar("organizers_ar", { length: 500 }), // Arabic organizers (nullable)
  url: varchar("url", { length: 500 }),
  category: varchar("category", { length: 500 }), // Keep for backward compatibility, will migrate to categoryId
  categoryAr: nvarchar("category_ar", { length: 500 }), // Keep temporarily for migration
  categoryId: int("category_id").references(() => categories.id), // New FK to categories table
  eventType: varchar("event_type", { length: 500 }).notNull().default('local'), // 'local' or 'international'
  eventScope: varchar("event_scope", { length: 500 }).notNull().default('external'), // 'internal' or 'external'
  expectedAttendance: int("expected_attendance"), // Hidden field - only for admins, sent to WhatsApp

  // Event agendas (PDF attachments)
  agendaEnFileName: varchar("agenda_en_file_name", { length: 500 }),
  agendaEnStoredFileName: varchar("agenda_en_stored_file_name", { length: 500 }),
  agendaArFileName: varchar("agenda_ar_file_name", { length: 500 }),
  agendaArStoredFileName: varchar("agenda_ar_stored_file_name", { length: 500 }),

  // Scraping and source tracking
  isScraped: bit("is_scraped").default(false).notNull(), // Indicates if event was automatically scraped
  source: varchar("source", { length: 500 }).default('manual').notNull(), // Source: 'manual', 'abu-dhabi-media-office', etc.
  externalId: varchar("external_id", { length: 500 }), // Original URL or ID from source for deduplication
  adminModified: bit("admin_modified").default(false).notNull(), // Tracks if admin edited/deleted to prevent overwriting
  
  // Reminder preferences
  reminder1Week: bit("reminder_1_week").default(true).notNull(),  // 1 week before
  reminder1Day: bit("reminder_1_day").default(true).notNull(),    // 1 day before
  reminderWeekly: bit("reminder_weekly").default(false).notNull(), // Every Monday until event
  reminderDaily: bit("reminder_daily").default(false).notNull(),  // Daily for last 7 days
  reminderMorningOf: bit("reminder_morning_of").default(false).notNull(), // Morning of event
  
  // Archive fields
  isArchived: bit("is_archived").default(false).notNull(), // Indicates if event has been archived
  archivedAt: datetime2("archived_at"), // When the event was archived
});

// Reminder queue table for tracking scheduled reminders
export const reminderQueue = mssqlTable("reminder_queue", {
  id: int("id").primaryKey().identity(),
  eventId: varchar("event_id", { length: 50 }).notNull().references(() => events.id, { onDelete: 'no action' }),
  reminderType: varchar("reminder_type", { 
    enum: ["1_week", "1_day", "weekly", "daily", "morning_of"] 
  }).notNull(), // Type of reminder
  scheduledFor: datetime2("scheduled_for").notNull(), // When to send the reminder
  status: varchar("status", { length: 500 }).notNull().default('pending'), // 'pending', 'sent', 'error', 'expired'
  sentAt: datetime2("sent_at"),
  attempts: int("attempts").notNull().default(0),
  lastAttempt: datetime2("last_attempt"),
  errorMessage: varchar("error_message", { length: 500 }),
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
}, (table) => [
  // Unique constraint: prevent duplicate reminders for same event/time/type
  unique("unique_reminder").on(table.eventId, table.scheduledFor, table.reminderType),
]);

export const insertEventSchema = createInsertSchema(events, {
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Start time must be in HH:MM format (00:00 to 23:59)").optional().nullable().or(z.literal('')),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "End time must be in HH:MM format (00:00 to 23:59)").optional().nullable().or(z.literal('')),
  agendaEnFileName: z.string().optional().nullable(),
  agendaEnStoredFileName: z.string().optional().nullable(),
  agendaArFileName: z.string().optional().nullable(),
  agendaArStoredFileName: z.string().optional().nullable(),
}).omit({
  id: true,
}).refine(
  (data) => {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    return endDate >= startDate;
  },
  {
    message: "End date must be on or after start date",
    path: ["endDate"],
  }
).refine(
  (data) => {
    // If dates are the same and both times are provided, validate end time > start time
    if (data.startDate === data.endDate && data.startTime && data.endTime && data.startTime.trim() && data.endTime.trim()) {
      return data.endTime > data.startTime;
    }
    return true;
  },
  {
    message: "End time must be after start time for same-day events",
    path: ["endTime"],
  }
);

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

export const insertReminderQueueSchema = createInsertSchema(reminderQueue).omit({
  createdAt: true,
});

export type InsertReminderQueue = z.infer<typeof insertReminderQueueSchema>;
export type ReminderQueue = typeof reminderQueue.$inferSelect;

// Archived Events table for الحصاد (Harvest) feature
export const archivedEvents = mssqlTable("archived_events", {
  id: int("id").primaryKey().identity(),
  
  // Core event fields (copied from original event or entered directly)
  name: varchar("name", { length: 500 }).notNull(),
  nameAr: varchar("name_ar", { length: 500 }),
  description: varchar("description", { length: 500 }),
  descriptionAr: nvarchar("description_ar", { length: 500 }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  startTime: varchar("start_time", { length: 5 }),
  endTime: varchar("end_time", { length: 5 }),
  location: varchar("location", { length: 500 }),
  locationAr: nvarchar("location_ar", { length: 500 }),
  organizers: varchar("organizers", { length: 500 }),
  organizersAr: nvarchar("organizers_ar", { length: 500 }),
  url: varchar("url", { length: 500 }),
  category: varchar("category", { length: 500 }),
  categoryAr: nvarchar("category_ar", { length: 500 }),
  categoryId: int("category_id").references(() => categories.id),
  eventType: varchar("event_type", { length: 500 }).notNull().default('local'), // 'local' or 'international'
  eventScope: varchar("event_scope", { length: 500 }).notNull().default('external'), // 'internal' or 'external'

  // Reference to original event (nullable for directly created archive entries)
  originalEventId: varchar("original_event_id", { length: 50 }).references(() => events.id, { onDelete: 'set null' }),
  
  // Archive-specific metadata
  actualAttendees: int("actual_attendees"), // Actual number of attendees (vs. expected)
  highlights: varchar("highlights", { length: 500 }), // Event highlights (English)
  highlightsAr: nvarchar("highlights_ar", { length: 500 }), // Event highlights (Arabic)
  impact: varchar("impact", { length: 500 }), // Impact/outcomes (English)
  impactAr: nvarchar("impact_ar", { length: 500 }), // Impact/outcomes (Arabic)
  keyTakeaways: varchar("key_takeaways", { length: 500 }), // Key takeaways (English)
  keyTakeawaysAr: nvarchar("key_takeaways_ar", { length: 500 }), // Key takeaways (Arabic)
  
  // Media storage (MinIO keys)
  photoKeys: nvarchar("photo_keys", { length: "max" }), // Array of MinIO object keys for photos
  thumbnailKeys: nvarchar("thumbnail_keys", { length: "max" }), // Array of MinIO keys for thumbnails
  youtubeVideoIds: nvarchar("youtube_video_ids", { length: "max" }), // Array of YouTube video IDs (max 5)
  
  // Metadata
  archivedByUserId: int("archived_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  createdDirectly: bit("created_directly").notNull().default(false), // True if created without original event
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
  updatedAt: datetime2("updated_at").notNull().default(sql`SYSDATETIME()`),
}, (table) => [
  index("IDX_archived_events_original_event_id").on(table.originalEventId),
  index("IDX_archived_events_start_date").on(table.startDate),
  index("IDX_archived_events_category_id").on(table.categoryId),
]);

export const insertArchivedEventSchema = createInsertSchema(archivedEvents).omit({
  createdAt: true,
  updatedAt: true,
});

export const updateArchivedEventSchema = z.object({
  name: z.string().min(1).optional(),
  nameAr: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  descriptionAr: z.string().optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  locationAr: z.string().optional().nullable(),
  organizers: z.string().optional().nullable(),
  organizersAr: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  categoryAr: z.string().optional().nullable(),
  categoryId: z.number().optional().nullable(),
  eventType: z.enum(['local', 'international']).optional(),
  eventScope: z.enum(['internal', 'external']).optional(),
  actualAttendees: z.number().int().positive().optional().nullable(),
  highlights: z.string().optional().nullable(),
  highlightsAr: z.string().optional().nullable(),
  impact: z.string().optional().nullable(),
  impactAr: z.string().optional().nullable(),
  keyTakeaways: z.string().optional().nullable(),
  keyTakeawaysAr: z.string().optional().nullable(),
  photoKeys: z.array(z.string()).max(20).optional().nullable(),
  thumbnailKeys: z.array(z.string()).max(20).optional().nullable(),
  youtubeVideoIds: z.array(z.string()).max(5).optional().nullable(),
});

export type InsertArchivedEvent = z.infer<typeof insertArchivedEventSchema>;
export type UpdateArchivedEvent = z.infer<typeof updateArchivedEventSchema>;
export type ArchivedEvent = typeof archivedEvents.$inferSelect;

// Archive Media table for detailed file metadata
export const archiveMedia = mssqlTable("archive_media", {
  id: int("id").primaryKey().identity(),
  archivedEventId: int("archived_event_id").notNull().references(() => archivedEvents.id, { onDelete: 'no action' }),
  
  // MinIO storage info
  objectKey: varchar("object_key", { length: 255 }).notNull().unique(), // MinIO object key
  thumbnailKey: nvarchar("thumbnail_key", { length: 255 }), // Thumbnail MinIO key

  // File metadata
  originalFileName: nvarchar("original_file_name", { length: 255 }).notNull(),
  mimeType: nvarchar("mime_type", { length: 255 }).notNull(),
  fileSize: int("file_size").notNull(), // Size in bytes (max 5MB = 5242880)
  width: int("width"), // Image width in pixels
  height: int("height"), // Image height in pixels
  
  // Display info
  caption: varchar("caption", { length: 500 }),
  captionAr: nvarchar("caption_ar", { length: 500 }),
  displayOrder: int("display_order").notNull().default(0),
  
  // Reference to original event media (for tracking when archived)
  originalEventMediaId: int("original_event_media_id").references(() => eventMedia.id, { onDelete: 'set null' }),
  
  // Metadata
  uploadedByUserId: int("uploaded_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  uploadedAt: datetime2("uploaded_at").notNull().default(sql`SYSDATETIME()`),
}, (table) => [
  index("IDX_archive_media_archived_event_id").on(table.archivedEventId),
  index("IDX_archive_media_display_order").on(table.archivedEventId, table.displayOrder),
  index("IDX_archive_media_original_event_media_id").on(table.originalEventMediaId),
]);

export const insertArchiveMediaSchema = createInsertSchema(archiveMedia).omit({
  uploadedAt: true,
});

export type InsertArchiveMedia = z.infer<typeof insertArchiveMediaSchema>;
export type ArchiveMedia = typeof archiveMedia.$inferSelect;

// Event Media table for event images (shared with archive when event is archived)
export const eventMedia = mssqlTable("event_media", {
  id: int("id").primaryKey().identity(),
  eventId: varchar("event_id", { length: 50 }).notNull().references(() => events.id, { onDelete: 'no action' }),
  
  // MinIO storage info
  objectKey: varchar("object_key", { length: 255 }).notNull().unique(), // MinIO object key
  thumbnailKey: nvarchar("thumbnail_key", { length: 255 }), // Thumbnail MinIO key

  // File metadata
  originalFileName: nvarchar("original_file_name", { length: 255 }).notNull(),
  mimeType: nvarchar("mime_type", { length: 255 }).notNull(),
  fileSize: int("file_size").notNull(), // Size in bytes (max 5MB = 5242880)
  width: int("width"), // Image width in pixels
  height: int("height"), // Image height in pixels
  
  // Display info
  caption: varchar("caption", { length: 500 }),
  captionAr: nvarchar("caption_ar", { length: 500 }),
  displayOrder: int("display_order").notNull().default(0),
  
  // Metadata
  uploadedByUserId: int("uploaded_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  uploadedAt: datetime2("uploaded_at").notNull().default(sql`SYSDATETIME()`),
}, (table) => [
  index("IDX_event_media_event_id").on(table.eventId),
  index("IDX_event_media_display_order").on(table.eventId, table.displayOrder),
]);

export const insertEventMediaSchema = createInsertSchema(eventMedia).omit({
  uploadedAt: true,
});

export type InsertEventMedia = z.infer<typeof insertEventMediaSchema>;
export type EventMedia = typeof eventMedia.$inferSelect;

// Core system settings table - simplified to only contain core application settings
export const settings = mssqlTable("settings", {
  id: int("id").primaryKey().identity().identity(),
  publicCsvExport: bit("public_csv_export").notNull().default(false),
  fileUploadsEnabled: bit("file_uploads_enabled").notNull().default(false),
  scrapedEventsEnabled: bit("scraped_events_enabled").notNull().default(true),
  archiveEnabled: bit("archive_enabled").notNull().default(true),
  dailyReminderGlobalEnabled: bit("daily_reminder_global_enabled").notNull().default(false),
  dailyReminderGlobalTime: varchar("daily_reminder_global_time", { length: 50 }).default('08:00'),
  allowStakeholderAttendeeUpload: bit("allow_stakeholder_attendee_upload").notNull().default(false),
  stakeholderUploadPermissions: nvarchar("stakeholder_upload_permissions", { length: "max" }),
});

export const updateSettingsSchema = z.object({
  publicCsvExport: z.boolean().optional(),
  fileUploadsEnabled: z.boolean().optional(),
  scrapedEventsEnabled: z.boolean().optional(),
  archiveEnabled: z.boolean().optional(),
  dailyReminderGlobalEnabled: z.boolean().optional(),
  dailyReminderGlobalTime: z.string().optional(),
  allowStakeholderAttendeeUpload: z.boolean().optional(),
  stakeholderUploadPermissions: z.record(z.boolean()).optional(),
});

export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// Email configuration table - manages email provider and connection settings
export const emailConfig = mssqlTable("email_config", {
  id: int("id").primaryKey().identity(),
  enabled: bit("enabled").notNull().default(false),
  provider: varchar("provider", { length: 50 }).notNull().default('resend'), // 'resend' or 'smtp'
  apiKey: varchar("api_key", { length: 500 }),
  smtpHost: varchar("smtp_host", { length: 500 }),
  smtpPort: int("smtp_port"),
  smtpSecure: bit("smtp_secure").default(true),
  smtpUser: varchar("smtp_user", { length: 500 }),
  smtpPassword: varchar("smtp_password", { length: 500 }),
  fromEmail: varchar("from_email", { length: 500 }),
  fromName: varchar("from_name", { length: 500 }),
  defaultRecipients: varchar("default_recipients", { length: 500 }), // Comma-separated
  globalCcList: varchar("global_cc_list", { length: 500 }), // Applied to ALL emails
  language: varchar("language", { length: 50 }).notNull().default('en'), // 'en' or 'ar'
  invitationFromEmail: varchar("invitation_from_email", { length: 500 }), // Dedicated sender email for invitations
  invitationFromName: varchar("invitation_from_name", { length: 500 }), // Dedicated sender name for invitations
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
  updatedAt: datetime2("updated_at").notNull().default(sql`SYSDATETIME()`),
});

export const updateEmailConfigSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(['resend', 'smtp']).optional(),
  apiKey: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().positive().optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  fromEmail: z.string().email().optional().or(z.literal('')),
  fromName: z.string().optional(),
  defaultRecipients: z.string().optional(),
  globalCcList: z.string().optional(),
  language: z.enum(['en', 'ar']).optional(),
  invitationFromEmail: z.string().email().optional().or(z.literal('')),
  invitationFromName: z.string().optional(),
});

export type UpdateEmailConfig = z.infer<typeof updateEmailConfigSchema>;
export type EmailConfig = typeof emailConfig.$inferSelect;

// Email templates table - stores templates for different email types and languages
export const emailTemplates = mssqlTable("email_templates", {
  id: int("id").primaryKey().identity(),
  type: varchar("type", { length: 500 }).notNull(), // 'stakeholder', 'reminder', 'management_summary', 'task_completion', 'updates'
  language: varchar("language", { length: 50 }).notNull().default('en'), // 'en' or 'ar'
  subject: varchar("subject", { length: 500 }),
  body: varchar("body", { length: 500 }),
  greeting: varchar("greeting", { length: 500 }),
  footer: varchar("footer", { length: 500 }),
  requirementsTitle: varchar("requirements_title", { length: 500 }),
  customRequirementsTitle: varchar("custom_requirements_title", { length: 500 }),
  requirementItemTemplate: varchar("requirement_item_template", { length: 500 }),
  brandColor: varchar("brand_color", { length: 50 }).default('#BC9F6D'),
  textColor: varchar("text_color", { length: 50 }).default('#333333'),
  bgColor: varchar("bg_color", { length: 50 }).default('#FFFFFF'),
  fontFamily: varchar("font_family", { length: 500 }).default('Arial, sans-serif'),
  fontSize: varchar("font_size", { length: 50 }).default('16px'),
  requirementsBrandColor: varchar("requirements_brand_color", { length: 50 }).default('#BC9F6D'),
  requirementsTextColor: varchar("requirements_text_color", { length: 50 }).default('#333333'),
  requirementsBgColor: varchar("requirements_bg_color", { length: 50 }).default('#F5F5F5'),
  requirementsFontFamily: varchar("requirements_font_family", { length: 500 }).default('Arial, sans-serif'),
  requirementsFontSize: varchar("requirements_font_size", { length: 50 }).default('16px'),
  footerBrandColor: varchar("footer_brand_color", { length: 50 }).default('#BC9F6D'),
  footerTextColor: varchar("footer_text_color", { length: 50 }).default('#666666'),
  footerBgColor: varchar("footer_bg_color", { length: 50 }).default('#FFFFFF'),
  footerFontFamily: varchar("footer_font_family", { length: 500 }).default('Arial, sans-serif'),
  footerFontSize: varchar("footer_font_size", { length: 50 }).default('14px'),
  isRtl: bit("is_rtl").notNull().default(false),
  additionalConfig: nvarchar("additional_config", { length: "max" }), // For template-specific settings (e.g., management summary config)
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
  updatedAt: datetime2("updated_at").notNull().default(sql`SYSDATETIME()`),
}, (table) => [
  unique("unique_email_template").on(table.type, table.language),
  index("IDX_email_templates_type_language").on(table.type, table.language),
]);

export const updateEmailTemplateSchema = z.object({
  type: z.enum(['stakeholder', 'reminder', 'management_summary', 'task_completion', 'updates', 'invitation']).optional(),
  language: z.enum(['en', 'ar']).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  greeting: z.string().optional(),
  footer: z.string().optional(),
  requirementsTitle: z.string().optional(),
  customRequirementsTitle: z.string().optional(),
  requirementItemTemplate: z.string().optional(),
  brandColor: z.string().optional(),
  textColor: z.string().optional(),
  bgColor: z.string().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.string().optional(),
  requirementsBrandColor: z.string().optional(),
  requirementsTextColor: z.string().optional(),
  requirementsBgColor: z.string().optional(),
  requirementsFontFamily: z.string().optional(),
  requirementsFontSize: z.string().optional(),
  footerBrandColor: z.string().optional(),
  footerTextColor: z.string().optional(),
  footerBgColor: z.string().optional(),
  footerFontFamily: z.string().optional(),
  footerFontSize: z.string().optional(),
  isRtl: z.boolean().optional(),
  additionalConfig: z.record(z.any()).optional(),
});

export type UpdateEmailTemplate = z.infer<typeof updateEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

// Event custom emails table - stores custom invitation emails per event
export const eventCustomEmails = mssqlTable("event_custom_emails", {
  id: int("id").primaryKey().identity(),
  eventId: varchar("event_id", { length: 50 }).notNull().references(() => events.id, { onDelete: 'no action' }),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: varchar("body", { length: 500 }).notNull(),
  isActive: bit("is_active").notNull().default(true),
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
  updatedAt: datetime2("updated_at").notNull().default(sql`SYSDATETIME()`),
  createdByUserId: int("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
}, (table) => [
  index("IDX_event_custom_emails_event_id").on(table.eventId),
]);

export const insertEventCustomEmailSchema = createInsertSchema(eventCustomEmails, {
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
}).omit({
  
  createdAt: true,
  updatedAt: true,
});

export const updateEventCustomEmailSchema = z.object({
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export type InsertEventCustomEmail = z.infer<typeof insertEventCustomEmailSchema>;
export type UpdateEventCustomEmail = z.infer<typeof updateEventCustomEmailSchema>;
export type EventCustomEmail = typeof eventCustomEmails.$inferSelect;

// Invitation email jobs table - tracks bulk email sending jobs
export const invitationEmailJobs = mssqlTable("invitation_email_jobs", {
  id: int("id").primaryKey().identity(),
  eventId: varchar("event_id", { length: 50 }).notNull().references(() => events.id, { onDelete: 'no action' }),
  status: varchar("status", { length: 500 }).notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'failed', 'cancelled'
  totalRecipients: int("total_recipients").notNull().default(0),
  emailsSent: int("emails_sent").notNull().default(0),
  emailsFailed: int("emails_failed").notNull().default(0),
  waitTimeSeconds: int("wait_time_seconds").notNull().default(2),
  useCustomEmail: bit("use_custom_email").notNull().default(false),
  startedAt: datetime2("started_at"),
  completedAt: datetime2("completed_at"),
  errorMessage: varchar("error_message", { length: 500 }),
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
  createdByUserId: int("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
}, (table) => [
  index("IDX_invitation_email_jobs_event_id").on(table.eventId),
  index("IDX_invitation_email_jobs_status").on(table.status),
  index("IDX_invitation_email_jobs_created_at").on(table.createdAt),
]);

export const insertInvitationEmailJobSchema = createInsertSchema(invitationEmailJobs, {
  waitTimeSeconds: z.number().int().min(1).max(60).default(2),
  useCustomEmail: z.boolean().default(false),
}).omit({
  
  createdAt: true,
});

export const updateInvitationEmailJobSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled']).optional(),
  totalRecipients: z.number().int().optional(),
  emailsSent: z.number().int().optional(),
  emailsFailed: z.number().int().optional(),
  startedAt: z.date().optional().nullable(),
  completedAt: z.date().optional().nullable(),
  errorMessage: z.string().optional().nullable(),
});

export type InsertInvitationEmailJob = z.infer<typeof insertInvitationEmailJobSchema>;
export type UpdateInvitationEmailJob = z.infer<typeof updateInvitationEmailJobSchema>;
export type InvitationEmailJob = typeof invitationEmailJobs.$inferSelect;

// WhatsApp configuration table - manages WhatsApp connection settings
export const whatsappConfig = mssqlTable("whatsapp_config", {
  id: int("id").primaryKey().identity(),
  enabled: bit("enabled").notNull().default(false),
  chatId: varchar("chat_id", { length: 500 }),
  chatName: varchar("chat_name", { length: 500 }),
  updatesChatId: varchar("updates_chat_id", { length: 500 }),
  updatesChatName: varchar("updates_chat_name", { length: 500 }),
  language: varchar("language", { length: 50 }).notNull().default('en'), // 'en' or 'ar'
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
  updatedAt: datetime2("updated_at").notNull().default(sql`SYSDATETIME()`),
});

export const updateWhatsappConfigSchema = z.object({
  enabled: z.boolean().optional(),
  chatId: z.string().optional(),
  chatName: z.string().optional(),
  updatesChatId: z.string().optional(),
  updatesChatName: z.string().optional(),
  language: z.enum(['en', 'ar']).optional(),
});

export type UpdateWhatsappConfig = z.infer<typeof updateWhatsappConfigSchema>;
export type WhatsappConfig = typeof whatsappConfig.$inferSelect;

// WhatsApp templates table - stores message templates for different WhatsApp message types
export const whatsappTemplates = mssqlTable("whatsapp_templates", {
  id: int("id").primaryKey().identity(),
  type: varchar("type", { length: 500 }).notNull(), // 'event_created', 'reminder'
  language: varchar("language", { length: 50 }).notNull().default('en'), // 'en' or 'ar'
  template: varchar("template", { length: 500 }).notNull(),
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
  updatedAt: datetime2("updated_at").notNull().default(sql`SYSDATETIME()`),
}, (table) => [
  unique("unique_whatsapp_template").on(table.type, table.language),
  index("IDX_whatsapp_templates_type_language").on(table.type, table.language),
]);

export const updateWhatsappTemplateSchema = z.object({
  type: z.enum(['event_created', 'reminder', 'updates_digest']).optional(),
  language: z.enum(['en', 'ar']).optional(),
  template: z.string().optional(),
});

export type UpdateWhatsappTemplate = z.infer<typeof updateWhatsappTemplateSchema>;
export type WhatsappTemplate = typeof whatsappTemplates.$inferSelect;

// Departments table (formerly stakeholders) for managing notification recipients
// NOTE: keycloakGroupId stores the technical Keycloak group name (e.g., "dept_1", "it-department")
// while name/nameAr store the user-friendly display names in English and Arabic.
// This allows Keycloak to use technical group names while the app displays proper names.
export const departments = mssqlTable("departments", {
  id: int("id").primaryKey().identity(),
  name: nvarchar("name", { length: 255 }).notNull().unique(), // English display name (e.g., "IT Department")
  nameAr: nvarchar("name_ar", { length: 255 }), // Arabic display name (e.g., "قسم تقنية المعلومات")
  keycloakGroupId: nvarchar("keycloak_group_id", { length: 255 }).unique(), // Keycloak group ID/path (e.g., "dept_1", "/departments/it")
  active: bit("active").notNull().default(true),
  ccList: nvarchar("cc_list", { length: 255 }), // Department-specific CC list (comma-separated emails)
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  
  createdAt: true,
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  nameAr: z.string().optional(),
  keycloakGroupId: z.string().optional(),
  active: z.boolean().optional(),
  ccList: z.string().optional(),
});

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type UpdateDepartment = z.infer<typeof updateDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

// Department emails table (multiple emails per department)
export const departmentEmails = mssqlTable("department_emails", {
  id: int("id").primaryKey().identity(),
  departmentId: int("department_id").notNull().references(() => departments.id, { onDelete: 'no action' }),
  email: varchar("email", { length: 500 }).notNull(),
  label: varchar("label", { length: 500 }), // Optional label like "Primary", "Secondary", "Manager"
  isPrimary: bit("is_primary").notNull().default(false),
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
});

export const insertDepartmentEmailSchema = createInsertSchema(departmentEmails, {
  email: z.string().email("Invalid email address"),
}).omit({
  
  createdAt: true,
});

export type InsertDepartmentEmail = z.infer<typeof insertDepartmentEmailSchema>;
export type DepartmentEmail = typeof departmentEmails.$inferSelect;

// Department accounts table (links departments to user accounts)
// Multiple accounts can share the same department (for department sharing)
export const departmentAccounts = mssqlTable("department_accounts", {
  id: int("id").primaryKey().identity(),
  userId: int("user_id").notNull().unique().references(() => users.id, { onDelete: 'no action' }),
  departmentId: int("department_id").notNull().references(() => departments.id, { onDelete: 'no action' }),
  primaryEmailId: int("primary_email_id").notNull().references(() => departmentEmails.id, { onDelete: "no action" }),
  lastLoginAt: datetime2("last_login_at"),
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
});

export const insertDepartmentAccountSchema = createInsertSchema(departmentAccounts).omit({createdAt: true});

export type InsertDepartmentAccount = z.infer<typeof insertDepartmentAccountSchema>;
export type DepartmentAccount = typeof departmentAccounts.$inferSelect;

// Department requirement templates
export const departmentRequirements = mssqlTable("department_requirements", {
  id: int("id").primaryKey().identity(),
  departmentId: int("department_id").notNull().references(() => departments.id, { onDelete: 'no action' }),
  title: varchar("title", { length: 500 }).notNull(),
  titleAr: varchar("title_ar", { length: 500 }), // Arabic title (nullable for backward compatibility)
  description: varchar("description", { length: 500 }).notNull(),
  descriptionAr: nvarchar("description_ar", { length: 500 }), // Arabic description (nullable)
  isDefault: bit("is_default").notNull().default(false), // Auto-select by default
  notificationEmails: nvarchar("notification_emails", { length: "max" }), // Emails to notify when tasks are completed
  dueDateBasis: varchar("due_date_basis", { length: 50 }).notNull().default('event_end'), // 'event_start' or 'event_end' - determines default due date
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
});

export const insertDepartmentRequirementSchema = createInsertSchema(departmentRequirements).omit({
  createdAt: true,
});

export type InsertDepartmentRequirement = z.infer<typeof insertDepartmentRequirementSchema>;
export type DepartmentRequirement = typeof departmentRequirements.$inferSelect;

// Event-department junction table with custom requirements
export const eventDepartments = mssqlTable("event_departments", {
  id: int("id").primaryKey().identity(),
  eventId: varchar("event_id", { length: 50 }).notNull().references(() => events.id, { onDelete: 'no action' }),
  departmentId: int("department_id").notNull().references(() => departments.id, { onDelete: 'no action' }),
  selectedRequirementIds: nvarchar("selected_requirement_ids", { length: "max" }), // Array of requirement IDs
  customRequirements: varchar("custom_requirements", { length: 500 }), // Additional custom text
  notifyOnCreate: bit("notify_on_create").notNull().default(true),
  notifyOnUpdate: bit("notify_on_update").notNull().default(false),
  dailyReminderEnabled: bit("daily_reminder_enabled").notNull().default(false),
  dailyReminderTime: varchar("daily_reminder_time", { length: 50 }).default('08:00'), // Time in HH:MM format (GST)
  lastReminderSentAt: datetime2("last_reminder_sent_at"),
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
});

export const insertEventDepartmentSchema = createInsertSchema(eventDepartments).omit({
  createdAt: true,
});

export type InsertEventDepartment = z.infer<typeof insertEventDepartmentSchema>;
export type EventDepartment = typeof eventDepartments.$inferSelect;

// Task Template Prerequisites - Links task templates to their prerequisites
// Enables workflow dependencies where one task must complete before another can start
export const taskTemplatePrerequisites = mssqlTable(
  "task_template_prerequisites",
  {
    id: int("id").primaryKey().identity(),
    taskTemplateId: int("task_template_id").notNull().references(() => departmentRequirements.id, { onDelete: 'no action' }),
    prerequisiteTemplateId: int("prerequisite_template_id").notNull().references(() => departmentRequirements.id, { onDelete: 'no action' }),
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    unique("unique_task_prerequisite").on(table.taskTemplateId, table.prerequisiteTemplateId),
    index("IDX_prerequisite_task_template").on(table.taskTemplateId),
    index("IDX_prerequisite_template").on(table.prerequisiteTemplateId),
  ],
);

export const insertTaskTemplatePrerequisiteSchema = createInsertSchema(taskTemplatePrerequisites).omit({
  createdAt: true,
});

export type InsertTaskTemplatePrerequisite = z.infer<typeof insertTaskTemplatePrerequisiteSchema>;
export type TaskTemplatePrerequisite = typeof taskTemplatePrerequisites.$inferSelect;

// Tasks table for event-department assignments
// Status includes 'waiting' for tasks blocked by unfinished prerequisites
export const tasks = mssqlTable(
  "tasks",
  {
    id: int("id").primaryKey().identity(),
    // For event-based tasks (mutually exclusive with leadId and partnershipId)
    eventDepartmentId: int("event_department_id").references(() => eventDepartments.id, { onDelete: 'no action' }),
    // For lead tasks (mutually exclusive with eventDepartmentId and partnershipId)
    leadId: int("lead_id").references(() => leads.id, { onDelete: 'no action' }),
    // For partnership tasks (mutually exclusive with eventDepartmentId and leadId)
    partnershipId: int("partnership_id").references(() => organizations.id, { onDelete: 'no action' }),
    // Direct department assignment (used for lead/partnership tasks instead of through event_departments)
    departmentId: int("department_id").references(() => departments.id, { onDelete: 'set null' }),

    title: varchar("title", { length: 500 }).notNull(),
    titleAr: varchar("title_ar", { length: 500 }), // Arabic title (nullable for backward compatibility)
    description: varchar("description", { length: 500 }).notNull(),
    descriptionAr: nvarchar("description_ar", { length: 500 }), // Arabic description (nullable)
    status: varchar("status", { length: 500 }).notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'cancelled', 'waiting'
    priority: varchar("priority", { length: 50 }).notNull().default('medium'), // 'high', 'medium', 'low'
    dueDate: date("due_date"),
    createdByUserId: int("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
    updatedAt: datetime2("updated_at").notNull().default(sql`SYSDATETIME()`),
    completedAt: datetime2("completed_at"),
    notificationEmails: nvarchar("notification_emails", { length: "max" }), // Emails to notify when task is marked as completed
  },
  (table) => [
    index("IDX_tasks_event_department_id").on(table.eventDepartmentId),
    index("IDX_tasks_lead_id").on(table.leadId),
    index("IDX_tasks_partnership_id").on(table.partnershipId),
    index("IDX_tasks_department_id").on(table.departmentId),
    index("IDX_tasks_status").on(table.status),
    index("IDX_tasks_priority").on(table.priority),
  ],
);

export const insertTaskSchema = createInsertSchema(tasks, {
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled', 'waiting']).default('pending'),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  notificationEmails: z.array(z.string().email()).optional(),
  eventDepartmentId: z.number().optional(),
  leadId: z.number().optional(),
  partnershipId: z.number().optional(),
  departmentId: z.number().optional(),
}).omit({
  createdAt: true,
  updatedAt: true,
}).refine(
  (data) => {
    const hasEvent = !!data.eventDepartmentId;
    const hasLead = !!data.leadId;
    const hasPartnership = !!data.partnershipId;
    // Exactly one of them must be set
    const count = [hasEvent, hasLead, hasPartnership].filter(Boolean).length;
    return count === 1;
  },
  { message: "Task must belong to exactly one of: event, lead, or partnership" }
);

export const updateTaskSchema = z.object({
  title: z.string().optional(),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled', 'waiting']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  dueDate: z.string().optional(),
  completedAt: z.date().optional(),
  notificationEmails: z.array(z.string().email()).optional(),
  departmentId: z.number().optional(),
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Task comments table
export const taskComments = mssqlTable(
  "task_comments",
  {
    id: int("id").primaryKey().identity(),
    taskId: int("task_id").notNull().references(() => tasks.id, { onDelete: 'no action' }),
    authorUserId: int("author_user_id").references(() => users.id, { onDelete: 'set null' }), // nullable for system comments
    body: varchar("body", { length: 500 }).notNull(),
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    index("IDX_task_comments_task_id").on(table.taskId),
  ],
);

export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({
  createdAt: true,
});

export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type TaskComment = typeof taskComments.$inferSelect;

// Task comment attachments table
export const taskCommentAttachments = mssqlTable(
  "task_comment_attachments",
  {
    id: int("id").primaryKey().identity(),
    commentId: int("comment_id").notNull().references(() => taskComments.id, { onDelete: 'no action' }),
    fileName: varchar("file_name", { length: 500 }).notNull(), // Original filename
    storedFileName: varchar("stored_file_name", { length: 500 }).notNull(), // Unique filename on disk
    fileSize: int("file_size").notNull(), // Size in bytes
    mimeType: varchar("mime_type", { length: 500 }).notNull(), // image/png, application/pdf, etc.
    uploadedAt: datetime2("uploaded_at").notNull().default(sql`SYSDATETIME()`),
    uploadedByUserId: int("uploaded_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index("IDX_task_comment_attachments_comment_id").on(table.commentId),
  ],
);

export const insertTaskCommentAttachmentSchema = createInsertSchema(taskCommentAttachments).omit({
  uploadedAt: true,
});

export type InsertTaskCommentAttachment = z.infer<typeof insertTaskCommentAttachmentSchema>;
export type TaskCommentAttachment = typeof taskCommentAttachments.$inferSelect;

// ==================== Task Workflow Feature ====================

// Event Workflows - Groups related tasks within an event that share dependencies
export const eventWorkflows = mssqlTable(
  "event_workflows",
  {
    id: int("id").primaryKey().identity(),
    eventId: varchar("event_id", { length: 50 }).notNull().references(() => events.id, { onDelete: 'no action' }),
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
    createdByUserId: int("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index("IDX_event_workflows_event_id").on(table.eventId),
  ],
);

export const insertEventWorkflowSchema = createInsertSchema(eventWorkflows).omit({
  createdAt: true,
});

export type InsertEventWorkflow = z.infer<typeof insertEventWorkflowSchema>;
export type EventWorkflow = typeof eventWorkflows.$inferSelect;

// Workflow Tasks - Junction table linking tasks to workflows with prerequisite tracking
export const workflowTasks = mssqlTable(
  "workflow_tasks",
  {
    id: int("id").primaryKey().identity(),
    workflowId: int("workflow_id").notNull().references(() => eventWorkflows.id, { onDelete: 'no action' }),
    taskId: int("task_id").notNull().references(() => tasks.id, { onDelete: 'no action' }),
    prerequisiteTaskId: int("prerequisite_task_id").references(() => tasks.id, { onDelete: 'set null' }),
    orderIndex: int("order_index").notNull().default(0),
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    unique("unique_workflow_task").on(table.workflowId, table.taskId),
    index("IDX_workflow_tasks_workflow_id").on(table.workflowId),
    index("IDX_workflow_tasks_task_id").on(table.taskId),
    index("IDX_workflow_tasks_prerequisite").on(table.prerequisiteTaskId),
  ],
);

export const insertWorkflowTaskSchema = createInsertSchema(workflowTasks).omit({
  createdAt: true,
});

export type InsertWorkflowTask = z.infer<typeof insertWorkflowTaskSchema>;
export type WorkflowTask = typeof workflowTasks.$inferSelect;

// ==================== Contacts & Speakers Feature ====================

// Organizations table - editable dropdown values for organizations
// Extended with partnership fields for ORM (Organization Relationship Management)
export const organizations = mssqlTable("organizations", {
  id: int("id").primaryKey().identity(),
  nameEn: nvarchar("name_en", { length: 255 }).notNull().unique(),
  nameAr: nvarchar("name_ar", { length: 255 }),
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
  
  // Partnership fields
  isPartner: bit("is_partner").notNull().default(false),
  partnershipStatus: varchar("partnership_status", { length: 500 }), // 'active', 'pending', 'suspended', 'terminated'
  partnershipTypeId: int("partnership_type_id").references(() => partnershipTypes.id, { onDelete: 'set null' }),
  partnershipStartDate: date("partnership_start_date"),
  partnershipEndDate: date("partnership_end_date"), // null = indefinite
  agreementSignedBy: varchar("agreement_signed_by", { length: 500 }), // Name of person who signed from partner side
  agreementSignedByUs: varchar("agreement_signed_by_us", { length: 500 }), // Our representative who signed
  partnershipNotes: varchar("partnership_notes", { length: 500 }),
  logoKey: varchar("logo_key", { length: 500 }), // MinIO object key for partner logo
  website: varchar("website", { length: 500 }),
  primaryContactId: int("primary_contact_id"), // Will reference contacts.id (defined after contacts table)
  countryId: int("country_id").references(() => countries.id, { onDelete: 'set null' }),
  
  // Partnership Inactivity Monitoring fields
  inactivityThresholdMonths: int("inactivity_threshold_months").default(6), // Configurable per-partnership threshold
  lastActivityDate: datetime2("last_activity_date"), // Automatically updated when activities are added
  notifyOnInactivity: bit("notify_on_inactivity").default(true), // Enable/disable inactivity notifications
  lastInactivityNotificationSent: datetime2("last_inactivity_notification_sent"), // Track last notification to avoid spam
}, (table) => [
  index("IDX_organizations_is_partner").on(table.isPartner),
  index("IDX_organizations_partnership_status").on(table.partnershipStatus),
  index("IDX_organizations_country_id").on(table.countryId),
  index("IDX_organizations_last_activity").on(table.lastActivityDate),
]);

export const insertOrganizationSchema = createInsertSchema(organizations, {
  nameEn: z.string().min(1, "Organization name (English) is required"),
  nameAr: z.string().optional(),
  isPartner: z.boolean().default(false),
  partnershipStatus: z.enum(['active', 'pending', 'suspended', 'terminated']).optional().nullable(),
  partnershipTypeId: z.number().int().positive().optional().nullable(),
  partnershipStartDate: z.string().optional().nullable(),
  partnershipEndDate: z.string().optional().nullable(),
  agreementSignedBy: z.string().optional().nullable(),
  agreementSignedByUs: z.string().optional().nullable(),
  partnershipNotes: z.string().optional().nullable(),
  logoKey: z.string().optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal('')),
  primaryContactId: z.number().int().positive().optional().nullable(),
  countryId: z.number().int().positive().optional().nullable(),
  // Inactivity monitoring fields
  inactivityThresholdMonths: z.number().int().min(1).max(24).optional().nullable(),
  notifyOnInactivity: z.boolean().optional(),
}).omit({
  createdAt: true,
  lastActivityDate: true,
  lastInactivityNotificationSent: true,
});

export const updateOrganizationSchema = z.object({
  nameEn: z.string().min(1).optional(),
  nameAr: z.string().optional().nullable(),
  isPartner: z.boolean().optional(),
  partnershipStatus: z.enum(['active', 'pending', 'suspended', 'terminated']).optional().nullable(),
  partnershipTypeId: z.number().int().positive().optional().nullable(),
  partnershipStartDate: z.string().optional().nullable(),
  partnershipEndDate: z.string().optional().nullable(),
  agreementSignedBy: z.string().optional().nullable(),
  agreementSignedByUs: z.string().optional().nullable(),
  partnershipNotes: z.string().optional().nullable(),
  logoKey: z.string().optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal('')),
  primaryContactId: z.number().int().positive().optional().nullable(),
  countryId: z.number().int().positive().optional().nullable(),
  // Inactivity monitoring fields
  inactivityThresholdMonths: z.number().int().min(1).max(24).optional().nullable(),
  notifyOnInactivity: z.boolean().optional(),
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

// Positions table - editable dropdown values for job positions
export const positions = mssqlTable("positions", {
  id: int("id").primaryKey().identity(),
  nameEn: nvarchar("name_en", { length: 255 }).notNull().unique(),
  nameAr: nvarchar("name_ar", { length: 255 }),
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
});

export const insertPositionSchema = createInsertSchema(positions, {
  nameEn: z.string().min(1, "Position name (English) is required"),
  nameAr: z.string().optional(),
}).omit({
  createdAt: true,
});

export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positions.$inferSelect;

// Partnership Types table - editable dropdown values for partnership types
export const partnershipTypes = mssqlTable("partnership_types", {
  id: int("id").primaryKey().identity(),
  nameEn: nvarchar("name_en", { length: 255 }).notNull().unique(),
  nameAr: nvarchar("name_ar", { length: 255 }),
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
});

export const insertPartnershipTypeSchema = createInsertSchema(partnershipTypes, {
  nameEn: z.string().min(1, "Partnership type name (English) is required"),
  nameAr: z.string().optional(),
}).omit({
  createdAt: true,
});

export type InsertPartnershipType = z.infer<typeof insertPartnershipTypeSchema>;
export type PartnershipType = typeof partnershipTypes.$inferSelect;

// Agreement types table - configurable dropdown for partnership agreement types
export const agreementTypes = mssqlTable("agreement_types", {
  id: int("id").primaryKey().identity(),
  nameEn: nvarchar("name_en", { length: 255 }).notNull().unique(),
  nameAr: nvarchar("name_ar", { length: 255 }),
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
});

export const insertAgreementTypeSchema = createInsertSchema(agreementTypes, {
  nameEn: z.string().min(1, "Agreement type name (English) is required"),
  nameAr: z.string().optional(),
}).omit({
  createdAt: true,
});

export type InsertAgreementType = z.infer<typeof insertAgreementTypeSchema>;
export type AgreementType = typeof agreementTypes.$inferSelect;

// Countries table - ISO 3166-1 countries (pre-populated, NOT user-editable)
export const countries = mssqlTable("countries", {
  id: int("id").primaryKey().identity(),
  code: varchar("code", { length: 2 }).notNull().unique(), // ISO 3166-1 alpha-2
  nameEn: varchar("description", { length: 500 }).notNull(),
  nameAr: nvarchar("name_ar", { length: 500 }).notNull(),
});

export type Country = typeof countries.$inferSelect;

// Contacts table - searchable database of people
export const contacts = mssqlTable("contacts", {
  id: int("id").primaryKey().identity(),
  nameEn: varchar("name", { length: 500 }).notNull(),
  nameAr: nvarchar("name_ar", { length: 500 }),
  title: varchar("title", { length: 500 }), // Honorific title like Dr., Prof., HE, etc.
  titleAr: nvarchar("title_ar", { length: 500 }),
  organizationId: int("organization_id").references(() => organizations.id, { onDelete: 'set null' }),
  positionId: int("position_id").references(() => positions.id, { onDelete: 'set null' }),
  countryId: int("country_id").references(() => countries.id, { onDelete: 'set null' }),
  phone: varchar("phone", { length: 500 }),
  email: varchar("email", { length: 500 }),
  profilePictureKey: varchar("profile_picture_key", { length: 500 }), // MinIO object key for profile picture
  profilePictureThumbnailKey: varchar("profile_picture_thumbnail_key", { length: 500 }), // MinIO key for thumbnail
  isEligibleSpeaker: bit("is_eligible_speaker").notNull().default(false),
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
  updatedAt: datetime2("updated_at").notNull().default(sql`SYSDATETIME()`),
}, (table) => [
  index("IDX_contacts_organization_id").on(table.organizationId),
  index("IDX_contacts_position_id").on(table.positionId),
  index("IDX_contacts_country_id").on(table.countryId),
  index("IDX_contacts_is_eligible_speaker").on(table.isEligibleSpeaker),
]);

export const insertContactSchema = createInsertSchema(contacts, {
  nameEn: z.string().min(1, "Name (English) is required"),
  nameAr: z.string().optional(),
  title: z.string().optional(),
  titleAr: z.string().optional(),
  organizationId: z.number().int().positive().optional().nullable(),
  positionId: z.number().int().positive().optional().nullable(),
  countryId: z.number().int().positive().optional().nullable(),
  phone: z.string().optional(),
  email: z.string().email().optional().nullable(),
  profilePictureKey: z.string().optional(),
  profilePictureThumbnailKey: z.string().optional(),
  isEligibleSpeaker: z.boolean().default(false),
}).omit({
  createdAt: true,
  updatedAt: true,
});

export const updateContactSchema = z.object({
  nameEn: z.string().min(1).optional(),
  nameAr: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  titleAr: z.string().nullable().optional(),
  organizationId: z.number().int().positive().nullable().optional(),
  positionId: z.number().int().positive().nullable().optional(),
  countryId: z.number().int().positive().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  profilePictureKey: z.string().nullable().optional(),
  profilePictureThumbnailKey: z.string().nullable().optional(),
  isEligibleSpeaker: z.boolean().optional(),
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type UpdateContact = z.infer<typeof updateContactSchema>;
export type Contact = typeof contacts.$inferSelect;

// Event Speakers junction table - links eligible contacts to events
export const eventSpeakers = mssqlTable("event_speakers", {
  id: int("id").primaryKey().identity(),
  eventId: varchar("event_id", { length: 50 }).notNull().references(() => events.id, { onDelete: 'no action' }),
  contactId: int("contact_id").notNull().references(() => contacts.id, { onDelete: 'no action' }),
  role: varchar("role", { length: 500 }), // "Keynote", "Panelist", "Moderator", "Speaker", etc.
  roleAr: nvarchar("role_ar", { length: 500 }),
  displayOrder: int("display_order").default(0),
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
}, (table) => [
  index("IDX_event_speakers_event_id").on(table.eventId),
  index("IDX_event_speakers_contact_id").on(table.contactId),
  unique("unique_event_speaker").on(table.eventId, table.contactId),
]);

export const insertEventSpeakerSchema = createInsertSchema(eventSpeakers, {
  role: z.string().optional(),
  roleAr: z.string().optional(),
  displayOrder: z.number().int().default(0),
}).omit({
  
  createdAt: true,
});

export const updateEventSpeakerSchema = z.object({
  role: z.string().optional().nullable(),
  roleAr: z.string().optional().nullable(),
  displayOrder: z.number().int().optional(),
});

export type InsertEventSpeaker = z.infer<typeof insertEventSpeakerSchema>;
export type UpdateEventSpeaker = z.infer<typeof updateEventSpeakerSchema>;
export type EventSpeaker = typeof eventSpeakers.$inferSelect;

// Archived Event Speakers junction table - links contacts to archived events
export const archivedEventSpeakers = mssqlTable("archived_event_speakers", {
  id: int("id").primaryKey().identity(),
  archivedEventId: int("archived_event_id").notNull().references(() => archivedEvents.id, { onDelete: 'no action' }),
  contactId: int("contact_id").references(() => contacts.id, { onDelete: 'set null' }),
  role: varchar("role", { length: 500 }),
  roleAr: nvarchar("role_ar", { length: 500 }),
  displayOrder: int("display_order").default(0),
  // Snapshot data in case contact is deleted later
  speakerNameEn: varchar("speaker_name_en", { length: 500 }),
  speakerNameAr: nvarchar("speaker_name_ar", { length: 500 }),
  speakerTitle: varchar("speaker_title", { length: 500 }),
  speakerTitleAr: nvarchar("speaker_title_ar", { length: 500 }),
  speakerPosition: varchar("speaker_position", { length: 500 }),
  speakerPositionAr: nvarchar("speaker_position_ar", { length: 500 }),
  speakerOrganization: varchar("speaker_organization", { length: 500 }),
  speakerOrganizationAr: nvarchar("speaker_organization_ar", { length: 500 }),
  speakerProfilePictureKey: varchar("speaker_profile_picture_key", { length: 500 }),
  speakerProfilePictureThumbnailKey: varchar("speaker_profile_picture_thumbnail_key", { length: 500 }),
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
}, (table) => [
  index("IDX_archived_event_speakers_archived_event_id").on(table.archivedEventId),
  index("IDX_archived_event_speakers_contact_id").on(table.contactId),
]);

export const insertArchivedEventSpeakerSchema = createInsertSchema(archivedEventSpeakers, {
  role: z.string().optional(),
  roleAr: z.string().optional(),
  displayOrder: z.number().int().default(0),
  speakerNameEn: z.string().optional(),
  speakerNameAr: z.string().optional(),
  speakerTitle: z.string().optional(),
  speakerTitleAr: z.string().optional(),
  speakerPosition: z.string().optional(),
  speakerPositionAr: z.string().optional(),
  speakerOrganization: z.string().optional(),
  speakerOrganizationAr: z.string().optional(),
  speakerProfilePictureKey: z.string().optional(),
  speakerProfilePictureThumbnailKey: z.string().optional(),
}).omit({
  createdAt: true,
});

export type InsertArchivedEventSpeaker = z.infer<typeof insertArchivedEventSpeakerSchema>;
export type ArchivedEventSpeaker = typeof archivedEventSpeakers.$inferSelect;

// Event Attendees junction table - links events to contacts who attended
// PRIVACY NOTE: This data is NOT transferred to archived events
// Only the count is stored in archived_events.actualAttendees
export const eventAttendees = mssqlTable("event_attendees", {
  id: int("id").primaryKey().identity(),
  eventId: varchar("event_id", { length: 50 }).notNull().references(() => events.id, { onDelete: 'no action' }),
  contactId: int("contact_id").notNull().references(() => contacts.id, { onDelete: 'no action' }),
  attendedAt: datetime2("attended_at").notNull().default(sql`SYSDATETIME()`), // When attendance was recorded
  notes: varchar("notes", { length: 500 }), // Optional notes about attendance
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
}, (table) => [
  index("IDX_event_attendees_event_id").on(table.eventId),
  index("IDX_event_attendees_contact_id").on(table.contactId),
  unique("unique_event_attendee").on(table.eventId, table.contactId), // Prevent duplicate attendance records
]);

export const insertEventAttendeeSchema = createInsertSchema(eventAttendees, {
  notes: z.string().optional().nullable(),
}).omit({
  createdAt: true,
});

export type InsertEventAttendee = z.infer<typeof insertEventAttendeeSchema>;
export type EventAttendee = typeof eventAttendees.$inferSelect;

// Event Invitees junction table - links events to contacts who were invited
// Used for tracking conversion rates and RSVP status in engagement analytics
export const eventInvitees = mssqlTable("event_invitees", {
  id: int("id").primaryKey().identity(),
  eventId: varchar("event_id", { length: 50 }).notNull().references(() => events.id, { onDelete: 'no action' }),
  contactId: int("contact_id").notNull().references(() => contacts.id, { onDelete: 'no action' }),
  rsvp: bit("rsvp").notNull().default(false), // Whether invitee has confirmed attendance
  registered: bit("registered").notNull().default(false), // Whether invitee has registered online
  inviteEmailSent: bit("invite_email_sent").notNull().default(false), // Whether invitation email was sent
  invitedAt: datetime2("invited_at").notNull().default(sql`SYSDATETIME()`), // When invitation was sent
  rsvpAt: datetime2("rsvp_at"), // When RSVP was confirmed/updated
  registeredAt: datetime2("registered_at"), // When registration was completed
  inviteEmailSentAt: datetime2("invite_email_sent_at"), // When invitation email was sent
  notes: varchar("notes", { length: 500 }), // Optional notes about invitation
  createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
}, (table) => [
  index("IDX_event_invitees_event_id").on(table.eventId),
  index("IDX_event_invitees_contact_id").on(table.contactId),
  index("IDX_event_invitees_rsvp").on(table.rsvp),
  index("IDX_event_invitees_registered").on(table.registered),
  index("IDX_event_invitees_invite_email_sent").on(table.inviteEmailSent),
  unique("unique_event_invitee").on(table.eventId, table.contactId), // Prevent duplicate invitation records
]);

export const insertEventInviteeSchema = createInsertSchema(eventInvitees, {
  rsvp: z.boolean().default(false),
  registered: z.boolean().default(false),
  inviteEmailSent: z.boolean().default(false),
  notes: z.string().optional().nullable(),
}).omit({
  createdAt: true,
});

export const updateEventInviteeSchema = z.object({
  rsvp: z.boolean().optional(),
  rsvpAt: z.date().optional().nullable(),
  registered: z.boolean().optional(),
  registeredAt: z.date().optional().nullable(),
  inviteEmailSent: z.boolean().optional(),
  inviteEmailSentAt: z.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type InsertEventInvitee = z.infer<typeof insertEventInviteeSchema>;
export type UpdateEventInvitee = z.infer<typeof updateEventInviteeSchema>;
export type EventInvitee = typeof eventInvitees.$inferSelect;

// Updates table for weekly and monthly admin/department updates
export const updates = mssqlTable(
  "updates",
  {
    id: int("id").primaryKey().identity(),
    type: varchar("type", { length: 500 }).notNull(), // 'weekly' or 'monthly'
    periodStart: date("period_start").notNull(), // ISO week start Monday or first day of month
    content: varchar("content", { length: 500 }).notNull().default(''),
    departmentId: int("department_id").references(() => departments.id, { onDelete: 'no action' }), // Null for global/admin updates
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
    updatedAt: datetime2("updated_at").notNull().default(sql`SYSDATETIME()`),
    updatedByUserId: int("updated_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    // Unique constraint: only one update per period per type per department (null for global)
    unique("unique_update_period").on(table.type, table.periodStart, table.departmentId),
    // Index for fast latest queries
    index("IDX_updates_type_period").on(table.type, table.periodStart),
    index("IDX_updates_department_id").on(table.departmentId),
  ],
);

export const insertUpdateSchema = createInsertSchema(updates, {
  type: z.enum(['weekly', 'monthly']),
  content: z.string(),
}).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertUpdate = z.infer<typeof insertUpdateSchema>;
export type Update = typeof updates.$inferSelect;

// ==================== Event File Storage Feature ====================

// Event folders table - Virtual folder metadata for event files
export const eventFolders = mssqlTable(
  "event_folders",
  {
    id: int("id").primaryKey().identity(),
    eventId: varchar("event_id", { length: 50 }).notNull().references(() => events.id, { onDelete: 'no action' }),
    name: varchar("name", { length: 255 }).notNull(),
    parentFolderId: int("parent_folder_id"), // Self-referencing FK added via alter
    path: varchar("path", { length: 1000 }).notNull(), // Full path e.g., /Documents/Agendas
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
    createdByUserId: int("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index("IDX_event_folders_event_id").on(table.eventId),
    index("IDX_event_folders_parent_folder_id").on(table.parentFolderId),
    index("IDX_event_folders_path").on(table.eventId, table.path),
  ],
);

export const insertEventFolderSchema = createInsertSchema(eventFolders).omit({
  createdAt: true,
});

export type InsertEventFolder = z.infer<typeof insertEventFolderSchema>;
export type EventFolder = typeof eventFolders.$inferSelect;

// Event files table - File metadata with source tracking
export const eventFiles = mssqlTable(
  "event_files",
  {
    id: int("id").primaryKey().identity(),
    eventFolderId: int("event_folder_id").notNull().references(() => eventFolders.id, { onDelete: 'no action' }),
    objectKey: varchar("object_key", { length: 500 }).notNull().unique(), // MinIO object key
    thumbnailKey: varchar("thumbnail_key", { length: 500 }), // Thumbnail MinIO key (nullable)
    originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    fileSize: int("file_size").notNull(), // Size in bytes
    sourceType: varchar("source_type", { length: 50 }).notNull().default('upload'), // 'upload', 'task_comment', 'agenda'
    sourceId: int("source_id"), // Source record ID (nullable) - e.g., task comment ID
    uploadedByUserId: int("uploaded_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: datetime2("uploaded_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    index("IDX_event_files_event_folder_id").on(table.eventFolderId),
    index("IDX_event_files_source").on(table.sourceType, table.sourceId),
    index("IDX_event_files_uploaded_by").on(table.uploadedByUserId),
  ],
);

export const insertEventFileSchema = createInsertSchema(eventFiles).omit({
  uploadedAt: true,
});

export type InsertEventFile = z.infer<typeof insertEventFileSchema>;
export type EventFile = typeof eventFiles.$inferSelect;

// Folder access templates - Reusable permission templates
export const folderAccessTemplates = mssqlTable(
  "folder_access_templates",
  {
    id: int("id").primaryKey().identity(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: varchar("description", { length: 500 }),
    permissions: nvarchar("permissions", { length: "max" }), // JSON with permission configuration
    isDefault: bit("is_default").notNull().default(false),
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
    createdByUserId: int("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index("IDX_folder_access_templates_is_default").on(table.isDefault),
  ],
);

export const insertFolderAccessTemplateSchema = createInsertSchema(folderAccessTemplates).omit({
  createdAt: true,
});

export const updateFolderAccessTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  permissions: z.record(z.any()).optional(),
  isDefault: z.boolean().optional(),
});

export type InsertFolderAccessTemplate = z.infer<typeof insertFolderAccessTemplateSchema>;
export type UpdateFolderAccessTemplate = z.infer<typeof updateFolderAccessTemplateSchema>;
export type FolderAccessTemplate = typeof folderAccessTemplates.$inferSelect;

// Event folder permissions - Folder-level access control
export const eventFolderPermissions = mssqlTable(
  "event_folder_permissions",
  {
    id: int("id").primaryKey().identity(),
    eventFolderId: int("event_folder_id").notNull().references(() => eventFolders.id, { onDelete: 'no action' }),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: 'no action' }),
    permissionLevel: varchar("permission_level", { length: 20 }).notNull(), // 'view', 'upload', 'manage'
    grantedByUserId: int("granted_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    grantedAt: datetime2("granted_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    index("IDX_event_folder_permissions_folder_id").on(table.eventFolderId),
    index("IDX_event_folder_permissions_user_id").on(table.userId),
    unique("unique_folder_user_permission").on(table.eventFolderId, table.userId),
  ],
);

export const insertEventFolderPermissionSchema = createInsertSchema(eventFolderPermissions).omit({
  grantedAt: true,
});

export type InsertEventFolderPermission = z.infer<typeof insertEventFolderPermissionSchema>;
export type EventFolderPermission = typeof eventFolderPermissions.$inferSelect;

// Event access grants - Event-wide access grants
export const eventAccessGrants = mssqlTable(
  "event_access_grants",
  {
    id: int("id").primaryKey().identity(),
    eventId: varchar("event_id", { length: 50 }).notNull().references(() => events.id, { onDelete: 'no action' }),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: 'no action' }),
    templateId: int("template_id").references(() => folderAccessTemplates.id, { onDelete: 'set null' }),
    permissionLevel: varchar("permission_level", { length: 20 }).notNull().default('view'), // 'view', 'upload', 'manage'
    grantedByUserId: int("granted_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    grantedAt: datetime2("granted_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    index("IDX_event_access_grants_event_id").on(table.eventId),
    index("IDX_event_access_grants_user_id").on(table.userId),
    unique("unique_event_user_access").on(table.eventId, table.userId),
  ],
);

export const insertEventAccessGrantSchema = createInsertSchema(eventAccessGrants).omit({
  grantedAt: true,
});

export type InsertEventAccessGrant = z.infer<typeof insertEventAccessGrantSchema>;
export type EventAccessGrant = typeof eventAccessGrants.$inferSelect;

// ==================== Partnership Management Feature ====================

// Partnership Agreements table - stores agreement documents and history
export const partnershipAgreements = mssqlTable(
  "partnership_agreements",
  {
    id: int("id").primaryKey().identity(),
    organizationId: int("organization_id").notNull().references(() => organizations.id, { onDelete: 'no action' }),
    
    // Agreement details
    title: varchar("title", { length: 500 }).notNull(),
    titleAr: varchar("title_ar", { length: 500 }),
    description: varchar("description", { length: 500 }),
    descriptionAr: varchar("description_ar", { length: 500 }),
    agreementTypeId: int("agreement_type_id").references(() => agreementTypes.id, { onDelete: 'set null' }),
    
    // Dates
    signedDate: date("signed_date"),
    effectiveDate: date("effective_date"),
    expiryDate: date("expiry_date"), // null = no expiry
    
    // Signatories
    partnerSignatory: varchar("partner_signatory", { length: 500 }),
    partnerSignatoryTitle: varchar("partner_signatory_title", { length: 500 }),
    ourSignatory: varchar("our_signatory", { length: 500 }),
    ourSignatoryTitle: varchar("our_signatory_title", { length: 500 }),

    // Document storage (MinIO)
    documentKey: varchar("document_key", { length: 500 }),
    documentFileName: varchar("document_file_name", { length: 500 }),

    // Status
    status: varchar("status", { length: 500 }).notNull().default('draft'), // 'draft', 'pending_approval', 'active', 'expired', 'terminated'
    legalStatus: varchar("legal_status", { length: 500 }), // 'binding' | 'non-binding'

    // Languages
    languages: nvarchar("languages", { length: "max" }), // ['en', 'ar', 'fr', ...]
    
    // Termination clause (bilingual)
    terminationClause: varchar("termination_clause", { length: 500 }),
    terminationClauseAr: varchar("termination_clause_ar", { length: 500 }),
    
    // Metadata
    createdByUserId: int("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
    updatedAt: datetime2("updated_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    index("IDX_partnership_agreements_org_id").on(table.organizationId),
    index("IDX_partnership_agreements_status").on(table.status),
    index("IDX_partnership_agreements_legal_status").on(table.legalStatus),
  ],
);

export const insertPartnershipAgreementSchema = createInsertSchema(partnershipAgreements, {
  title: z.string().min(1, "Agreement title is required"),
  titleAr: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  descriptionAr: z.string().optional().nullable(),
  agreementTypeId: z.number().optional().nullable(),
  signedDate: z.string().optional().nullable(),
  effectiveDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  partnerSignatory: z.string().optional().nullable(),
  partnerSignatoryTitle: z.string().optional().nullable(),
  ourSignatory: z.string().optional().nullable(),
  ourSignatoryTitle: z.string().optional().nullable(),
  documentKey: z.string().optional().nullable(),
  documentFileName: z.string().optional().nullable(),
  status: z.enum(['draft', 'pending_approval', 'active', 'expired', 'terminated']).default('draft'),
  legalStatus: z.enum(['binding', 'non-binding']).optional().nullable(),
  languages: z.array(z.string()).optional().nullable(),
  terminationClause: z.string().optional().nullable(),
  terminationClauseAr: z.string().optional().nullable(),
}).omit({
  createdAt: true,
  updatedAt: true,
});

export const updatePartnershipAgreementSchema = z.object({
  title: z.string().min(1).optional(),
  titleAr: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  descriptionAr: z.string().optional().nullable(),
  agreementTypeId: z.number().optional().nullable(),
  signedDate: z.string().optional().nullable(),
  effectiveDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  partnerSignatory: z.string().optional().nullable(),
  partnerSignatoryTitle: z.string().optional().nullable(),
  ourSignatory: z.string().optional().nullable(),
  ourSignatoryTitle: z.string().optional().nullable(),
  documentKey: z.string().optional().nullable(),
  documentFileName: z.string().optional().nullable(),
  status: z.enum(['draft', 'pending_approval', 'active', 'expired', 'terminated']).optional(),
  legalStatus: z.enum(['binding', 'non-binding']).optional().nullable(),
  languages: z.array(z.string()).optional().nullable(),
  terminationClause: z.string().optional().nullable(),
  terminationClauseAr: z.string().optional().nullable(),
});

export type InsertPartnershipAgreement = z.infer<typeof insertPartnershipAgreementSchema>;
export type UpdatePartnershipAgreement = z.infer<typeof updatePartnershipAgreementSchema>;
export type PartnershipAgreement = typeof partnershipAgreements.$inferSelect;

// Agreement Attachments table - store multiple file attachments per agreement
export const agreementAttachments = mssqlTable(
  "agreement_attachments",
  {
    id: int("id").primaryKey().identity(),
    agreementId: int("agreement_id").notNull().references(() => partnershipAgreements.id, { onDelete: 'no action' }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
    objectKey: varchar("object_key", { length: 255 }).notNull().unique(), // MinIO object key
    fileSize: int("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    uploadedByUserId: int("uploaded_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: datetime2("uploaded_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    index("IDX_agreement_attachments_agreement_id").on(table.agreementId),
  ],
);

export const insertAgreementAttachmentSchema = createInsertSchema(agreementAttachments, {
  agreementId: z.number().int().positive(),
  fileName: z.string().min(1).max(255),
  originalFileName: z.string().min(1).max(255),
  objectKey: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1).max(100),
  uploadedByUserId: z.number().int().positive().optional().nullable(),
}).omit({
  uploadedAt: true,
});

export type InsertAgreementAttachment = z.infer<typeof insertAgreementAttachmentSchema>;
export type AgreementAttachment = typeof agreementAttachments.$inferSelect;

// Partnership Activities table - track activities and interactions
export const partnershipActivities = mssqlTable(
  "partnership_activities",
  {
    id: int("id").primaryKey().identity(),
    organizationId: int("organization_id").notNull().references(() => organizations.id, { onDelete: 'no action' }),
    
    // Activity details
    title: varchar("title", { length: 500 }).notNull(),
    titleAr: varchar("title_ar", { length: 500 }),
    description: varchar("description", { length: 500 }),
    descriptionAr: varchar("description_ar", { length: 500 }),
    activityType: varchar("activity_type", { length: 500 }).notNull(), // 'joint_event', 'sponsorship', 'collaboration', 'training', 'exchange', 'meeting', 'other'
    
    // Date and timing
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    
    // Linked event (optional)
    eventId: varchar("event_id", { length: 50 }).references(() => events.id, { onDelete: 'set null' }),
    
    // Outcome and impact
    outcome: varchar("outcome", { length: 500 }),
    outcomeAr: varchar("outcome_ar", { length: 500 }),
    impactScore: int("impact_score"), // 1-5 scale
    
    // Metadata
    createdByUserId: int("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
    updatedAt: datetime2("updated_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    index("IDX_partnership_activities_org_id").on(table.organizationId),
    index("IDX_partnership_activities_type").on(table.activityType),
    index("IDX_partnership_activities_event_id").on(table.eventId),
  ],
);

export const insertPartnershipActivitySchema = createInsertSchema(partnershipActivities, {
  title: z.string().min(1, "Activity title is required"),
  titleAr: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  descriptionAr: z.string().optional().nullable(),
  activityType: z.enum(['joint_event', 'sponsorship', 'collaboration', 'training', 'exchange', 'meeting', 'other']),
  startDate: z.string(),
  endDate: z.string().optional().nullable(),
  eventId: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  outcomeAr: z.string().optional().nullable(),
  impactScore: z.number().int().min(1).max(5).optional().nullable(),
}).omit({
  createdAt: true,
  updatedAt: true,
});

export const updatePartnershipActivitySchema = z.object({
  title: z.string().min(1).optional(),
  titleAr: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  descriptionAr: z.string().optional().nullable(),
  activityType: z.enum(['joint_event', 'sponsorship', 'collaboration', 'training', 'exchange', 'meeting', 'other']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  eventId: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  outcomeAr: z.string().optional().nullable(),
  impactScore: z.number().int().min(1).max(5).optional().nullable(),
});

export type InsertPartnershipActivity = z.infer<typeof insertPartnershipActivitySchema>;
export type UpdatePartnershipActivity = z.infer<typeof updatePartnershipActivitySchema>;
export type PartnershipActivity = typeof partnershipActivities.$inferSelect;

// Partnership Contacts junction table - link contacts to partnerships with roles
export const partnershipContacts = mssqlTable(
  "partnership_contacts",
  {
    id: int("id").primaryKey().identity(),
    organizationId: int("organization_id").notNull().references(() => organizations.id, { onDelete: 'no action' }),
    contactId: int("contact_id").notNull().references(() => contacts.id, { onDelete: 'no action' }),
    role: varchar("role", { length: 500 }), // 'primary', 'liaison', 'technical', 'executive', 'other'
    roleAr: varchar("role_ar", { length: 500 }),
    isPrimary: bit("is_primary").notNull().default(false),
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    unique("unique_partnership_contact").on(table.organizationId, table.contactId),
    index("IDX_partnership_contacts_org_id").on(table.organizationId),
    index("IDX_partnership_contacts_contact_id").on(table.contactId),
  ],
);

export const insertPartnershipContactSchema = createInsertSchema(partnershipContacts, {
  role: z.enum(['primary', 'liaison', 'technical', 'executive', 'other']).optional().nullable(),
  roleAr: z.string().optional().nullable(),
  isPrimary: z.boolean().default(false),
}).omit({
  createdAt: true,
});

export const updatePartnershipContactSchema = z.object({
  role: z.enum(['primary', 'liaison', 'technical', 'executive', 'other']).optional().nullable(),
  roleAr: z.string().optional().nullable(),
  isPrimary: z.boolean().optional(),
});

export type InsertPartnershipContact = z.infer<typeof insertPartnershipContactSchema>;
export type UpdatePartnershipContact = z.infer<typeof updatePartnershipContactSchema>;
export type PartnershipContact = typeof partnershipContacts.$inferSelect;

// Partnership Comments - team notes and discussions about partnerships
export const partnershipComments = mssqlTable(
  "partnership_comments",
  {
    id: int("id").primaryKey().identity(),
    organizationId: int("organization_id").notNull().references(() => organizations.id, { onDelete: 'no action' }),
    body: varchar("body", { length: 500 }).notNull(),
    bodyAr: varchar("body_ar", { length: 500 }),
    authorUserId: int("author_user_id").references(() => users.id, { onDelete: 'set null' }),
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
    updatedAt: datetime2("updated_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    index("IDX_partnership_comments_org_id").on(table.organizationId),
    index("IDX_partnership_comments_author").on(table.authorUserId),
  ],
);

export const insertPartnershipCommentSchema = createInsertSchema(partnershipComments, {
  body: z.string().min(1, "Comment body is required"),
  bodyAr: z.string().optional().nullable(),
}).omit({
  createdAt: true,
  updatedAt: true,
});

export const updatePartnershipCommentSchema = z.object({
  body: z.string().min(1).optional(),
  bodyAr: z.string().optional().nullable(),
});

export type InsertPartnershipComment = z.infer<typeof insertPartnershipCommentSchema>;
export type UpdatePartnershipComment = z.infer<typeof updatePartnershipCommentSchema>;
export type PartnershipComment = typeof partnershipComments.$inferSelect;

// ==================== Lead Management System ====================
// For tracking leads and their interactions

// Leads table - external contacts/leads for partnerships
export const leads = mssqlTable(
  "leads",
  {
    id: int("id").primaryKey().identity(),
    
    // Contact information
    name: varchar("name", { length: 500 }).notNull(),
    nameAr: varchar("name_ar", { length: 500 }),
    email: varchar("email", { length: 500 }),
    phone: varchar("phone", { length: 500 }),

    // Classification
    type: varchar("type", { length: 500 }).notNull().default('lead'), // 'lead', 'partner', 'customer', 'vendor', 'other'
    status: varchar("status", { length: 500 }).notNull().default('active'), // 'active', 'in_progress', 'inactive'
    
    // Optional link to organization
    organizationId: int("organization_id").references(() => organizations.id, { onDelete: 'set null' }),
    organizationName: varchar("organization_name", { length: 500 }),
    
    // Notes
    notes: varchar("notes", { length: 500 }),
    notesAr: nvarchar("notes_ar", { length: 500 }),
    // Metadata
    createdByUserId: int("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
    updatedAt: datetime2("updated_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    index("IDX_leads_type").on(table.type),
    index("IDX_leads_status").on(table.status),
    index("IDX_leads_organization").on(table.organizationId),
    index("IDX_leads_name").on(table.name),
  ],
);

export const insertLeadSchema = createInsertSchema(leads, {
  name: z.string().min(1, "Name is required"),
  nameAr: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  type: z.enum(['lead', 'partner', 'customer', 'vendor', 'other']).default('lead'),
  status: z.enum(['active', 'in_progress', 'inactive']).default('active'),
  organizationName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  notesAr: z.string().optional().nullable(),
}).omit({
  createdAt: true,
  updatedAt: true,
});

export const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  nameAr: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  type: z.enum(['lead', 'partner', 'customer', 'vendor', 'other']).optional(),
  status: z.enum(['active', 'in_progress', 'inactive']).optional(),
  organizationId: z.number().int().positive().optional().nullable(),
  organizationName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  notesAr: z.string().optional().nullable(),
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type UpdateLead = z.infer<typeof updateLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// Backward compatibility exports
export const workflowContacts = leads;
export const insertWorkflowContactSchema = insertLeadSchema;
export const updateWorkflowContactSchema = updateLeadSchema;
export type InsertWorkflowContact = InsertLead;
export type UpdateWorkflowContact = UpdateLead;
export type WorkflowContact = Lead;

// Lead Interactions table - timeline of interactions with a lead
export const leadInteractions = mssqlTable(
  "lead_interactions",
  {
    id: int("id").primaryKey().identity(),
    leadId: int("lead_id").notNull().references(() => leads.id, { onDelete: 'no action' }),
    
    // Interaction type
    type: varchar("type", { length: 500 }).notNull(), // 'email', 'phone_call', 'meeting', 'other'
    
    // Content
    description: varchar("description", { length: 500 }).notNull(),
    descriptionAr: nvarchar("description_ar", { length: 500 }),
    
    // Outcome (optional - what resulted from this interaction)
    outcome: varchar("outcome", { length: 500 }),
    outcomeAr: nvarchar("outcome_ar", { length: 500 }),

    // Date/time of interaction
    interactionDate: datetime2("interaction_date").notNull().default(sql`SYSDATETIME()`),
    
    // Metadata
    createdByUserId: int("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    index("IDX_lead_interactions_lead_id").on(table.leadId),
    index("IDX_lead_interactions_type").on(table.type),
    index("IDX_lead_interactions_date").on(table.interactionDate),
  ],
);

export const insertLeadInteractionSchema = createInsertSchema(leadInteractions, {
  type: z.enum(['email', 'phone_call', 'meeting', 'other']),
  description: z.string().min(1, "Description is required"),
  descriptionAr: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  outcomeAr: z.string().optional().nullable(),
  interactionDate: z.date().optional(),
}).omit({
  createdAt: true,
});

export const updateLeadInteractionSchema = z.object({
  type: z.enum(['email', 'phone_call', 'meeting', 'other']).optional(),
  description: z.string().min(1).optional(),
  descriptionAr: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  outcomeAr: z.string().optional().nullable(),
  interactionDate: z.date().optional(),
});

export type InsertLeadInteraction = z.infer<typeof insertLeadInteractionSchema>;
export type UpdateLeadInteraction = z.infer<typeof updateLeadInteractionSchema>;
export type LeadInteraction = typeof leadInteractions.$inferSelect;

// Backward compatibility exports
export const contactInteractions = leadInteractions;
export const insertContactInteractionSchema = insertLeadInteractionSchema;
export const updateContactInteractionSchema = updateLeadInteractionSchema;
export type InsertContactInteraction = InsertLeadInteraction;
export type UpdateContactInteraction = UpdateLeadInteraction;
export type ContactInteraction = LeadInteraction;

// Partnership Interactions table - timeline of interactions with a partnership
export const partnershipInteractions = mssqlTable(
  "partnership_interactions",
  {
    id: int("id").primaryKey().identity(),
    organizationId: int("organization_id").notNull().references(() => organizations.id, { onDelete: 'no action' }),
    
    // Interaction type: email, phone_call, meeting, document_sent, proposal_submitted, review_session, other
    type: varchar("type", { length: 500 }).notNull(),
    
    // Content
    description: varchar("description", { length: 500 }).notNull(),
    descriptionAr: nvarchar("description_ar", { length: 500 }),
    
    // Outcome (optional - what resulted from this interaction)
    outcome: varchar("outcome", { length: 500 }),
    outcomeAr: nvarchar("outcome_ar", { length: 500 }),
    
    // Date/time of interaction
    interactionDate: datetime2("interaction_date").notNull().default(sql`SYSDATETIME()`),
    
    // Metadata
    createdByUserId: int("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    index("IDX_partnership_interactions_org_id").on(table.organizationId),
    index("IDX_partnership_interactions_type").on(table.type),
    index("IDX_partnership_interactions_date").on(table.interactionDate),
  ],
);

export const insertPartnershipInteractionSchema = createInsertSchema(partnershipInteractions, {
  type: z.enum(['email', 'phone_call', 'meeting', 'document_sent', 'proposal_submitted', 'review_session', 'other']),
  description: z.string().min(1, "Description is required"),
  descriptionAr: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  outcomeAr: z.string().optional().nullable(),
  interactionDate: z.date().optional(),
}).omit({
  createdAt: true,
});

export const updatePartnershipInteractionSchema = z.object({
  type: z.enum(['email', 'phone_call', 'meeting', 'document_sent', 'proposal_submitted', 'review_session', 'other']).optional(),
  description: z.string().min(1).optional(),
  descriptionAr: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  outcomeAr: z.string().optional().nullable(),
  interactionDate: z.date().optional(),
});

export type InsertPartnershipInteraction = z.infer<typeof insertPartnershipInteractionSchema>;
export type UpdatePartnershipInteraction = z.infer<typeof updatePartnershipInteractionSchema>;
export type PartnershipInteraction = typeof partnershipInteractions.$inferSelect;

// ==================== Interaction Attachments ====================
// Shared attachments table for both lead and partnership interactions
export const interactionAttachments = mssqlTable(
  "interaction_attachments",
  {
    id: int("id").primaryKey().identity(),
    leadInteractionId: int("lead_interaction_id").references(() => leadInteractions.id, { onDelete: 'no action' }),
    partnershipInteractionId: int("partnership_interaction_id").references(() => partnershipInteractions.id, { onDelete: 'no action' }),
    
    // File metadata
    objectKey: varchar("object_key", { length: 255 }).notNull().unique(),
    originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
    fileSize: int("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    
    // Metadata
    uploadedByUserId: int("uploaded_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: datetime2("uploaded_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    index("IDX_interaction_attachments_lead").on(table.leadInteractionId),
    index("IDX_interaction_attachments_partnership").on(table.partnershipInteractionId),
    index("IDX_interaction_attachments_uploaded_by").on(table.uploadedByUserId),
  ]
);

export const insertInteractionAttachmentSchema = createInsertSchema(interactionAttachments, {
  originalFileName: z.string().min(1, "File name is required"),
  fileSize: z.number().positive("File size must be positive"),
  mimeType: z.string().min(1, "MIME type is required"),
}).omit({
  uploadedAt: true,
});

export type InsertInteractionAttachment = z.infer<typeof insertInteractionAttachmentSchema>;
export type InteractionAttachment = typeof interactionAttachments.$inferSelect;

// ==================== AI Chat History Tables ====================
// For storing conversation history per user

export const aiChatConversations = mssqlTable(
  "ai_chat_conversations",
  {
    id: varchar("id", { length: 500 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: 'no action' }),
    title: varchar("title", { length: 500 }),
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
    updatedAt: datetime2("updated_at").notNull().default(sql`SYSDATETIME()`),
    isArchived: bit("is_archived").default(false),
  },
  (table) => [
    index("idx_ai_chat_conversations_user_id").on(table.userId),
    index("idx_ai_chat_conversations_updated_at").on(table.updatedAt),
  ]
);

export const insertAiChatConversationSchema = createInsertSchema(aiChatConversations, {
  title: z.string().max(255).optional(),
}).omit({
  
  createdAt: true,
  updatedAt: true,
});

export type InsertAiChatConversation = z.infer<typeof insertAiChatConversationSchema>;
export type AiChatConversation = typeof aiChatConversations.$inferSelect;

export const aiChatMessages = mssqlTable(
  "ai_chat_messages",
  {
    id: int("id").primaryKey().identity(),
    conversationId: varchar("conversation_id", { length: 500 }).notNull().references(() => aiChatConversations.id, { onDelete: 'no action' }),
    role: varchar("role", { length: 500 }).notNull(), // 'user' or 'assistant'
    content: varchar("content", { length: 500 }).notNull(),
    sources: nvarchar("sources", { length: "max" }), // AiSource[] for assistant messages
    metadata: nvarchar("metadata", { length: "max" }), // model, processing time, etc.
    createdAt: datetime2("created_at").notNull().default(sql`SYSDATETIME()`),
  },
  (table) => [
    index("idx_ai_chat_messages_conversation_id").on(table.conversationId),
    index("idx_ai_chat_messages_created_at").on(table.createdAt),
  ]
);

export const insertAiChatMessageSchema = createInsertSchema(aiChatMessages, {
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
  sources: z.array(z.object({
    id: z.string(),
    entityType: z.string(),
    title: z.string(),
    snippet: z.string().optional(),
    score: z.number().optional(),
  })).optional(),
  metadata: z.record(z.unknown()).optional(),
}).omit({
  createdAt: true,
});

export type InsertAiChatMessage = z.infer<typeof insertAiChatMessageSchema>;
export type AiChatMessage = typeof aiChatMessages.$inferSelect;

// ==================== Backward Compatibility Exports ====================
// Export unified task schemas with old contact task names for backward compatibility
// Contact tasks now use the unified tasks table with contact_id set instead of event_department_id

export const contactTasks = tasks;
export const contactTaskComments = taskComments;
export const contactTaskCommentAttachments = taskCommentAttachments;

export const insertContactTaskSchema = insertTaskSchema;
export const updateContactTaskSchema = updateTaskSchema;
export const insertContactTaskCommentSchema = insertTaskCommentSchema;
export const insertContactTaskCommentAttachmentSchema = insertTaskCommentAttachmentSchema;

export type ContactTask = Task;
export type InsertContactTask = InsertTask;
export type UpdateContactTask = UpdateTask;
export type ContactTaskComment = TaskComment;
export type InsertContactTaskComment = InsertTaskComment;
export type ContactTaskCommentAttachment = TaskCommentAttachment;
export type InsertContactTaskCommentAttachment = InsertTaskCommentAttachment;

// ==================== Stakeholder Backward Compatibility Exports ====================
// Export renamed schemas with old names for backward compatibility
// This allows existing code to continue using "Stakeholder" terminology

export const stakeholders = departments;
export const stakeholderEmails = departmentEmails;
export const stakeholderRequirements = departmentRequirements;
export const stakeholderAccounts = departmentAccounts;
export const eventStakeholders = eventDepartments;

export const insertStakeholderSchema = insertDepartmentSchema;
export const updateStakeholderSchema = updateDepartmentSchema;
export const insertStakeholderEmailSchema = insertDepartmentEmailSchema;
export const insertStakeholderRequirementSchema = insertDepartmentRequirementSchema;
export const insertStakeholderAccountSchema = insertDepartmentAccountSchema;
export const insertEventStakeholderSchema = insertEventDepartmentSchema;

export type Stakeholder = Department;
export type InsertStakeholder = InsertDepartment;
export type UpdateStakeholder = UpdateDepartment;
export type StakeholderEmail = DepartmentEmail;
export type InsertStakeholderEmail = InsertDepartmentEmail;
export type StakeholderRequirement = DepartmentRequirement;
export type InsertStakeholderRequirement = InsertDepartmentRequirement;
export type StakeholderAccount = DepartmentAccount;
export type InsertStakeholderAccount = InsertDepartmentAccount;
export type EventStakeholder = EventDepartment;
export type InsertEventStakeholder = InsertEventDepartment;
