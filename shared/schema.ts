import { sql } from "drizzle-orm";
import { pgTable, text, varchar, date, serial, timestamp, jsonb, index, boolean, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: text("password"), // Nullable for Keycloak-only users
  role: text("role").notNull().default('admin'), // 'superadmin', 'admin', 'department', 'department_admin', 'events_lead', 'division_head', 'employee', 'viewer'
  keycloakId: text("keycloak_id").unique(), // Keycloak user ID (sub claim)
  email: text("email"), // Email from Keycloak
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  role: z.enum(['superadmin', 'admin', 'department', 'department_admin', 'events_lead', 'division_head', 'employee', 'viewer']).default('admin'),
  keycloakId: z.string().optional(),
  email: z.string().email().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Auth identities table for LDAP and other authentication providers
export const authIdentities = pgTable(
  "auth_identities",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
    provider: text("provider").notNull(), // 'local', 'ldap', future providers
    externalId: text("external_id"), // For LDAP: user DN or other external identifier
    metadata: jsonb("metadata"), // Provider-specific data
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("IDX_auth_identities_user_id").on(table.userId),
    index("IDX_auth_identities_provider_external").on(table.provider, table.externalId),
  ],
);

export const insertAuthIdentitySchema = createInsertSchema(authIdentities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAuthIdentity = z.infer<typeof insertAuthIdentitySchema>;
export type AuthIdentity = typeof authIdentities.$inferSelect;

// Sessions table for session storage
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Categories table for bilingual category management
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  nameEn: text("name_en").notNull().unique(),
  nameAr: text("name_ar"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categories, {
  nameEn: z.string().min(1, "Category name (English) is required"),
  nameAr: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Events table
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nameAr: text("name_ar"), // Arabic name (nullable for backward compatibility)
  description: text("description"), // Optional description
  descriptionAr: text("description_ar"), // Arabic description (nullable)
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  startTime: varchar("start_time", { length: 5 }), // Optional time in HH:MM format (24-hour)
  endTime: varchar("end_time", { length: 5 }), // Optional time in HH:MM format (24-hour)
  location: text("location"), // Optional location
  locationAr: text("location_ar"), // Arabic location (nullable)
  organizers: text("organizers"),
  organizersAr: text("organizers_ar"), // Arabic organizers (nullable)
  url: text("url"),
  category: text("category"), // Keep for backward compatibility, will migrate to categoryId
  categoryAr: text("category_ar"), // Keep temporarily for migration
  categoryId: integer("category_id").references(() => categories.id), // New FK to categories table
  eventType: text("event_type").notNull().default('local'), // 'local' or 'international'
  eventScope: text("event_scope").notNull().default('external'), // 'internal' or 'external'
  expectedAttendance: integer("expected_attendance"), // Hidden field - only for admins, sent to WhatsApp

  // Event agendas (PDF attachments)
  agendaEnFileName: text("agenda_en_file_name"),
  agendaEnStoredFileName: text("agenda_en_stored_file_name"),
  agendaArFileName: text("agenda_ar_file_name"),
  agendaArStoredFileName: text("agenda_ar_stored_file_name"),
  
  // Scraping and source tracking
  isScraped: boolean("is_scraped").default(false).notNull(), // Indicates if event was automatically scraped
  source: text("source").default('manual').notNull(), // Source: 'manual', 'abu-dhabi-media-office', etc.
  externalId: text("external_id"), // Original URL or ID from source for deduplication
  adminModified: boolean("admin_modified").default(false).notNull(), // Tracks if admin edited/deleted to prevent overwriting
  
  // Reminder preferences
  reminder1Week: boolean("reminder_1_week").default(true).notNull(),  // 1 week before
  reminder1Day: boolean("reminder_1_day").default(true).notNull(),    // 1 day before
  reminderWeekly: boolean("reminder_weekly").default(false).notNull(), // Every Monday until event
  reminderDaily: boolean("reminder_daily").default(false).notNull(),  // Daily for last 7 days
  reminderMorningOf: boolean("reminder_morning_of").default(false).notNull(), // Morning of event
  
  // Archive fields
  isArchived: boolean("is_archived").default(false).notNull(), // Indicates if event has been archived
  archivedAt: timestamp("archived_at"), // When the event was archived
});

// Reminder queue table for tracking scheduled reminders
export const reminderQueue = pgTable("reminder_queue", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  reminderType: varchar("reminder_type", { 
    enum: ["1_week", "1_day", "weekly", "daily", "morning_of"] 
  }).notNull(), // Type of reminder
  scheduledFor: timestamp("scheduled_for").notNull(), // When to send the reminder
  status: text("status").notNull().default('pending'), // 'pending', 'sent', 'error', 'expired'
  sentAt: timestamp("sent_at"),
  attempts: integer("attempts").notNull().default(0),
  lastAttempt: timestamp("last_attempt"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
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
  id: true,
  createdAt: true,
});

export type InsertReminderQueue = z.infer<typeof insertReminderQueueSchema>;
export type ReminderQueue = typeof reminderQueue.$inferSelect;

// Archived Events table for الحصاد (Harvest) feature
export const archivedEvents = pgTable("archived_events", {
  id: serial("id").primaryKey(),
  
  // Core event fields (copied from original event or entered directly)
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  startTime: varchar("start_time", { length: 5 }),
  endTime: varchar("end_time", { length: 5 }),
  location: text("location"),
  locationAr: text("location_ar"),
  organizers: text("organizers"),
  organizersAr: text("organizers_ar"),
  url: text("url"),
  category: text("category"),
  categoryAr: text("category_ar"),
  categoryId: integer("category_id").references(() => categories.id),
  eventType: text("event_type").notNull().default('local'), // 'local' or 'international'
  eventScope: text("event_scope").notNull().default('external'), // 'internal' or 'external'
  
  // Reference to original event (nullable for directly created archive entries)
  originalEventId: varchar("original_event_id").references(() => events.id, { onDelete: 'set null' }),
  
  // Archive-specific metadata
  actualAttendees: integer("actual_attendees"), // Actual number of attendees (vs. expected)
  highlights: text("highlights"), // Event highlights (English)
  highlightsAr: text("highlights_ar"), // Event highlights (Arabic)
  impact: text("impact"), // Impact/outcomes (English)
  impactAr: text("impact_ar"), // Impact/outcomes (Arabic)
  keyTakeaways: text("key_takeaways"), // Key takeaways (English)
  keyTakeawaysAr: text("key_takeaways_ar"), // Key takeaways (Arabic)
  
  // Media storage (MinIO keys)
  photoKeys: text("photo_keys").array(), // Array of MinIO object keys for photos
  thumbnailKeys: text("thumbnail_keys").array(), // Array of MinIO keys for thumbnails
  youtubeVideoIds: text("youtube_video_ids").array(), // Array of YouTube video IDs (max 5)
  
  // Metadata
  archivedByUserId: integer("archived_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  createdDirectly: boolean("created_directly").notNull().default(false), // True if created without original event
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_archived_events_original_event_id").on(table.originalEventId),
  index("IDX_archived_events_start_date").on(table.startDate),
  index("IDX_archived_events_category_id").on(table.categoryId),
]);

export const insertArchivedEventSchema = createInsertSchema(archivedEvents).omit({
  id: true,
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
export const archiveMedia = pgTable("archive_media", {
  id: serial("id").primaryKey(),
  archivedEventId: integer("archived_event_id").notNull().references(() => archivedEvents.id, { onDelete: 'cascade' }),
  
  // MinIO storage info
  objectKey: text("object_key").notNull().unique(), // MinIO object key
  thumbnailKey: text("thumbnail_key"), // Thumbnail MinIO key
  
  // File metadata
  originalFileName: text("original_file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(), // Size in bytes (max 5MB = 5242880)
  width: integer("width"), // Image width in pixels
  height: integer("height"), // Image height in pixels
  
  // Display info
  caption: text("caption"),
  captionAr: text("caption_ar"),
  displayOrder: integer("display_order").notNull().default(0),
  
  // Reference to original event media (for tracking when archived)
  originalEventMediaId: integer("original_event_media_id").references(() => eventMedia.id, { onDelete: 'set null' }),
  
  // Metadata
  uploadedByUserId: integer("uploaded_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => [
  index("IDX_archive_media_archived_event_id").on(table.archivedEventId),
  index("IDX_archive_media_display_order").on(table.archivedEventId, table.displayOrder),
  index("IDX_archive_media_original_event_media_id").on(table.originalEventMediaId),
]);

export const insertArchiveMediaSchema = createInsertSchema(archiveMedia).omit({
  id: true,
  uploadedAt: true,
});

export type InsertArchiveMedia = z.infer<typeof insertArchiveMediaSchema>;
export type ArchiveMedia = typeof archiveMedia.$inferSelect;

// Event Media table for event images (shared with archive when event is archived)
export const eventMedia = pgTable("event_media", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  
  // MinIO storage info
  objectKey: text("object_key").notNull().unique(), // MinIO object key
  thumbnailKey: text("thumbnail_key"), // Thumbnail MinIO key
  
  // File metadata
  originalFileName: text("original_file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(), // Size in bytes (max 5MB = 5242880)
  width: integer("width"), // Image width in pixels
  height: integer("height"), // Image height in pixels
  
  // Display info
  caption: text("caption"),
  captionAr: text("caption_ar"),
  displayOrder: integer("display_order").notNull().default(0),
  
  // Metadata
  uploadedByUserId: integer("uploaded_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => [
  index("IDX_event_media_event_id").on(table.eventId),
  index("IDX_event_media_display_order").on(table.eventId, table.displayOrder),
]);

export const insertEventMediaSchema = createInsertSchema(eventMedia).omit({
  id: true,
  uploadedAt: true,
});

export type InsertEventMedia = z.infer<typeof insertEventMediaSchema>;
export type EventMedia = typeof eventMedia.$inferSelect;

// Core system settings table - simplified to only contain core application settings
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  publicCsvExport: boolean("public_csv_export").notNull().default(false),
  fileUploadsEnabled: boolean("file_uploads_enabled").notNull().default(false),
  scrapedEventsEnabled: boolean("scraped_events_enabled").notNull().default(true),
  archiveEnabled: boolean("archive_enabled").notNull().default(true),
  dailyReminderGlobalEnabled: boolean("daily_reminder_global_enabled").notNull().default(false),
  dailyReminderGlobalTime: text("daily_reminder_global_time").default('08:00'),
  allowStakeholderAttendeeUpload: boolean("allow_stakeholder_attendee_upload").notNull().default(false),
  stakeholderUploadPermissions: jsonb("stakeholder_upload_permissions"),
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
export const emailConfig = pgTable("email_config", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  provider: text("provider").notNull().default('resend'), // 'resend' or 'smtp'
  apiKey: text("api_key"),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpSecure: boolean("smtp_secure").default(true),
  smtpUser: text("smtp_user"),
  smtpPassword: text("smtp_password"),
  fromEmail: text("from_email"),
  fromName: text("from_name"),
  defaultRecipients: text("default_recipients"), // Comma-separated
  globalCcList: text("global_cc_list"), // Applied to ALL emails
  language: text("language").notNull().default('en'), // 'en' or 'ar'
  invitationFromEmail: text("invitation_from_email"), // Dedicated sender email for invitations
  invitationFromName: text("invitation_from_name"), // Dedicated sender name for invitations
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'stakeholder', 'reminder', 'management_summary', 'task_completion', 'updates'
  language: text("language").notNull().default('en'), // 'en' or 'ar'
  subject: text("subject"),
  body: text("body"),
  greeting: text("greeting"),
  footer: text("footer"),
  requirementsTitle: text("requirements_title"),
  customRequirementsTitle: text("custom_requirements_title"),
  requirementItemTemplate: text("requirement_item_template"),
  brandColor: text("brand_color").default('#BC9F6D'),
  textColor: text("text_color").default('#333333'),
  bgColor: text("bg_color").default('#FFFFFF'),
  fontFamily: text("font_family").default('Arial, sans-serif'),
  fontSize: text("font_size").default('16px'),
  requirementsBrandColor: text("requirements_brand_color").default('#BC9F6D'),
  requirementsTextColor: text("requirements_text_color").default('#333333'),
  requirementsBgColor: text("requirements_bg_color").default('#F5F5F5'),
  requirementsFontFamily: text("requirements_font_family").default('Arial, sans-serif'),
  requirementsFontSize: text("requirements_font_size").default('16px'),
  footerBrandColor: text("footer_brand_color").default('#BC9F6D'),
  footerTextColor: text("footer_text_color").default('#666666'),
  footerBgColor: text("footer_bg_color").default('#FFFFFF'),
  footerFontFamily: text("footer_font_family").default('Arial, sans-serif'),
  footerFontSize: text("footer_font_size").default('14px'),
  isRtl: boolean("is_rtl").notNull().default(false),
  additionalConfig: jsonb("additional_config"), // For template-specific settings (e.g., management summary config)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
export const eventCustomEmails = pgTable("event_custom_emails", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
}, (table) => [
  index("IDX_event_custom_emails_event_id").on(table.eventId),
]);

export const insertEventCustomEmailSchema = createInsertSchema(eventCustomEmails, {
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
}).omit({
  id: true,
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
export const invitationEmailJobs = pgTable("invitation_email_jobs", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'failed', 'cancelled'
  totalRecipients: integer("total_recipients").notNull().default(0),
  emailsSent: integer("emails_sent").notNull().default(0),
  emailsFailed: integer("emails_failed").notNull().default(0),
  waitTimeSeconds: integer("wait_time_seconds").notNull().default(2),
  useCustomEmail: boolean("use_custom_email").notNull().default(false),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
}, (table) => [
  index("IDX_invitation_email_jobs_event_id").on(table.eventId),
  index("IDX_invitation_email_jobs_status").on(table.status),
  index("IDX_invitation_email_jobs_created_at").on(table.createdAt),
]);

export const insertInvitationEmailJobSchema = createInsertSchema(invitationEmailJobs, {
  waitTimeSeconds: z.number().int().min(1).max(60).default(2),
  useCustomEmail: z.boolean().default(false),
}).omit({
  id: true,
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
export const whatsappConfig = pgTable("whatsapp_config", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  chatId: text("chat_id"),
  chatName: text("chat_name"),
  updatesChatId: text("updates_chat_id"),
  updatesChatName: text("updates_chat_name"),
  language: text("language").notNull().default('en'), // 'en' or 'ar'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
export const whatsappTemplates = pgTable("whatsapp_templates", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'event_created', 'reminder'
  language: text("language").notNull().default('en'), // 'en' or 'ar'
  template: text("template").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // English display name (e.g., "IT Department")
  nameAr: text("name_ar"), // Arabic display name (e.g., "قسم تقنية المعلومات")
  keycloakGroupId: text("keycloak_group_id").unique(), // Keycloak group ID/path (e.g., "dept_1", "/departments/it")
  active: boolean("active").notNull().default(true),
  ccList: text("cc_list"), // Department-specific CC list (comma-separated emails)
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
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
export const departmentEmails = pgTable("department_emails", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull().references(() => departments.id, { onDelete: 'cascade' }),
  email: text("email").notNull(),
  label: text("label"), // Optional label like "Primary", "Secondary", "Manager"
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDepartmentEmailSchema = createInsertSchema(departmentEmails, {
  email: z.string().email("Invalid email address"),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertDepartmentEmail = z.infer<typeof insertDepartmentEmailSchema>;
export type DepartmentEmail = typeof departmentEmails.$inferSelect;

// Department accounts table (links departments to user accounts)
// Multiple accounts can share the same department (for department sharing)
export const departmentAccounts = pgTable("department_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  departmentId: integer("department_id").notNull().references(() => departments.id, { onDelete: 'cascade' }),
  primaryEmailId: integer("primary_email_id").notNull().references(() => departmentEmails.id, { onDelete: 'restrict' }),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDepartmentAccountSchema = createInsertSchema(departmentAccounts).omit({
  id: true,
  createdAt: true,
});

export type InsertDepartmentAccount = z.infer<typeof insertDepartmentAccountSchema>;
export type DepartmentAccount = typeof departmentAccounts.$inferSelect;

// Department requirement templates
export const departmentRequirements = pgTable("department_requirements", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull().references(() => departments.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  titleAr: text("title_ar"), // Arabic title (nullable for backward compatibility)
  description: text("description"),
  descriptionAr: text("description_ar"), // Arabic description (nullable)
  isDefault: boolean("is_default").notNull().default(false), // Auto-select by default
  notificationEmails: text("notification_emails").array(), // Emails to notify when tasks are completed
  dueDateBasis: text("due_date_basis").notNull().default('event_end'), // 'event_start' or 'event_end' - determines default due date
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDepartmentRequirementSchema = createInsertSchema(departmentRequirements).omit({
  id: true,
  createdAt: true,
});

export type InsertDepartmentRequirement = z.infer<typeof insertDepartmentRequirementSchema>;
export type DepartmentRequirement = typeof departmentRequirements.$inferSelect;

// Event-department junction table with custom requirements
export const eventDepartments = pgTable("event_departments", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  departmentId: integer("department_id").notNull().references(() => departments.id, { onDelete: 'cascade' }),
  selectedRequirementIds: text("selected_requirement_ids").array(), // Array of requirement IDs
  customRequirements: text("custom_requirements"), // Additional custom text
  notifyOnCreate: boolean("notify_on_create").notNull().default(true),
  notifyOnUpdate: boolean("notify_on_update").notNull().default(false),
  dailyReminderEnabled: boolean("daily_reminder_enabled").notNull().default(false),
  dailyReminderTime: text("daily_reminder_time").default('08:00'), // Time in HH:MM format (GST)
  lastReminderSentAt: timestamp("last_reminder_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEventDepartmentSchema = createInsertSchema(eventDepartments).omit({
  id: true,
  createdAt: true,
});

export type InsertEventDepartment = z.infer<typeof insertEventDepartmentSchema>;
export type EventDepartment = typeof eventDepartments.$inferSelect;

// Task Template Prerequisites - Links task templates to their prerequisites
// Enables workflow dependencies where one task must complete before another can start
export const taskTemplatePrerequisites = pgTable(
  "task_template_prerequisites",
  {
    id: serial("id").primaryKey(),
    taskTemplateId: integer("task_template_id").notNull().references(() => departmentRequirements.id, { onDelete: 'cascade' }),
    prerequisiteTemplateId: integer("prerequisite_template_id").notNull().references(() => departmentRequirements.id, { onDelete: 'cascade' }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("unique_task_prerequisite").on(table.taskTemplateId, table.prerequisiteTemplateId),
    index("IDX_prerequisite_task_template").on(table.taskTemplateId),
    index("IDX_prerequisite_template").on(table.prerequisiteTemplateId),
  ],
);

export const insertTaskTemplatePrerequisiteSchema = createInsertSchema(taskTemplatePrerequisites).omit({
  id: true,
  createdAt: true,
});

export type InsertTaskTemplatePrerequisite = z.infer<typeof insertTaskTemplatePrerequisiteSchema>;
export type TaskTemplatePrerequisite = typeof taskTemplatePrerequisites.$inferSelect;

// Tasks table for event-department assignments
// Status includes 'waiting' for tasks blocked by unfinished prerequisites
export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    // For event-based tasks (mutually exclusive with leadId and partnershipId)
    eventDepartmentId: integer("event_department_id").references(() => eventDepartments.id, { onDelete: 'cascade' }),
    // For lead tasks (mutually exclusive with eventDepartmentId and partnershipId)
    leadId: integer("lead_id").references(() => leads.id, { onDelete: 'cascade' }),
    // For partnership tasks (mutually exclusive with eventDepartmentId and leadId)
    partnershipId: integer("partnership_id").references(() => organizations.id, { onDelete: 'cascade' }),
    // Direct department assignment (used for lead/partnership tasks instead of through event_departments)
    departmentId: integer("department_id").references(() => departments.id, { onDelete: 'set null' }),
    
    title: text("title").notNull(),
    titleAr: text("title_ar"), // Arabic title (nullable for backward compatibility)
    description: text("description"),
    descriptionAr: text("description_ar"), // Arabic description (nullable)
    status: text("status").notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'cancelled', 'waiting'
    priority: text("priority").notNull().default('medium'), // 'high', 'medium', 'low'
    dueDate: date("due_date"),
    createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    completedAt: timestamp("completed_at"),
    notificationEmails: text("notification_emails").array(), // Emails to notify when task is marked as completed
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
  id: true,
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
export const taskComments = pgTable(
  "task_comments",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    authorUserId: integer("author_user_id").references(() => users.id, { onDelete: 'set null' }), // nullable for system comments
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_task_comments_task_id").on(table.taskId),
  ],
);

export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({
  id: true,
  createdAt: true,
});

export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type TaskComment = typeof taskComments.$inferSelect;

// Task comment attachments table
export const taskCommentAttachments = pgTable(
  "task_comment_attachments",
  {
    id: serial("id").primaryKey(),
    commentId: integer("comment_id").notNull().references(() => taskComments.id, { onDelete: 'cascade' }),
    fileName: text("file_name").notNull(), // Original filename
    storedFileName: text("stored_file_name").notNull(), // Unique filename on disk
    fileSize: integer("file_size").notNull(), // Size in bytes
    mimeType: text("mime_type").notNull(), // image/png, application/pdf, etc.
    uploadedAt: timestamp("uploaded_at").defaultNow(),
    uploadedByUserId: integer("uploaded_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index("IDX_task_comment_attachments_comment_id").on(table.commentId),
  ],
);

export const insertTaskCommentAttachmentSchema = createInsertSchema(taskCommentAttachments).omit({
  id: true,
  uploadedAt: true,
});

export type InsertTaskCommentAttachment = z.infer<typeof insertTaskCommentAttachmentSchema>;
export type TaskCommentAttachment = typeof taskCommentAttachments.$inferSelect;

// ==================== Task Workflow Feature ====================

// Event Workflows - Groups related tasks within an event that share dependencies
export const eventWorkflows = pgTable(
  "event_workflows",
  {
    id: serial("id").primaryKey(),
    eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
    createdAt: timestamp("created_at").defaultNow(),
    createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index("IDX_event_workflows_event_id").on(table.eventId),
  ],
);

export const insertEventWorkflowSchema = createInsertSchema(eventWorkflows).omit({
  id: true,
  createdAt: true,
});

export type InsertEventWorkflow = z.infer<typeof insertEventWorkflowSchema>;
export type EventWorkflow = typeof eventWorkflows.$inferSelect;

// Workflow Tasks - Junction table linking tasks to workflows with prerequisite tracking
export const workflowTasks = pgTable(
  "workflow_tasks",
  {
    id: serial("id").primaryKey(),
    workflowId: integer("workflow_id").notNull().references(() => eventWorkflows.id, { onDelete: 'cascade' }),
    taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    prerequisiteTaskId: integer("prerequisite_task_id").references(() => tasks.id, { onDelete: 'set null' }),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("unique_workflow_task").on(table.workflowId, table.taskId),
    index("IDX_workflow_tasks_workflow_id").on(table.workflowId),
    index("IDX_workflow_tasks_task_id").on(table.taskId),
    index("IDX_workflow_tasks_prerequisite").on(table.prerequisiteTaskId),
  ],
);

export const insertWorkflowTaskSchema = createInsertSchema(workflowTasks).omit({
  id: true,
  createdAt: true,
});

export type InsertWorkflowTask = z.infer<typeof insertWorkflowTaskSchema>;
export type WorkflowTask = typeof workflowTasks.$inferSelect;

// ==================== Contacts & Speakers Feature ====================

// Organizations table - editable dropdown values for organizations
// Extended with partnership fields for ORM (Organization Relationship Management)
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  nameEn: text("name_en").notNull().unique(),
  nameAr: text("name_ar"),
  createdAt: timestamp("created_at").defaultNow(),
  
  // Partnership fields
  isPartner: boolean("is_partner").notNull().default(false),
  partnershipStatus: text("partnership_status"), // 'active', 'pending', 'suspended', 'terminated'
  partnershipTypeId: integer("partnership_type_id").references(() => partnershipTypes.id, { onDelete: 'set null' }),
  partnershipStartDate: date("partnership_start_date"),
  partnershipEndDate: date("partnership_end_date"), // null = indefinite
  agreementSignedBy: text("agreement_signed_by"), // Name of person who signed from partner side
  agreementSignedByUs: text("agreement_signed_by_us"), // Our representative who signed
  partnershipNotes: text("partnership_notes"),
  logoKey: text("logo_key"), // MinIO object key for partner logo
  website: text("website"),
  primaryContactId: integer("primary_contact_id"), // Will reference contacts.id (defined after contacts table)
  countryId: integer("country_id").references(() => countries.id, { onDelete: 'set null' }),
  
  // Partnership Inactivity Monitoring fields
  inactivityThresholdMonths: integer("inactivity_threshold_months").default(6), // Configurable per-partnership threshold
  lastActivityDate: timestamp("last_activity_date"), // Automatically updated when activities are added
  notifyOnInactivity: boolean("notify_on_inactivity").default(true), // Enable/disable inactivity notifications
  lastInactivityNotificationSent: timestamp("last_inactivity_notification_sent"), // Track last notification to avoid spam
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
  id: true,
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
export const positions = pgTable("positions", {
  id: serial("id").primaryKey(),
  nameEn: text("name_en").notNull().unique(),
  nameAr: text("name_ar"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPositionSchema = createInsertSchema(positions, {
  nameEn: z.string().min(1, "Position name (English) is required"),
  nameAr: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positions.$inferSelect;

// Partnership Types table - editable dropdown values for partnership types
export const partnershipTypes = pgTable("partnership_types", {
  id: serial("id").primaryKey(),
  nameEn: text("name_en").notNull().unique(),
  nameAr: text("name_ar"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPartnershipTypeSchema = createInsertSchema(partnershipTypes, {
  nameEn: z.string().min(1, "Partnership type name (English) is required"),
  nameAr: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertPartnershipType = z.infer<typeof insertPartnershipTypeSchema>;
export type PartnershipType = typeof partnershipTypes.$inferSelect;

// Agreement types table - configurable dropdown for partnership agreement types
export const agreementTypes = pgTable("agreement_types", {
  id: serial("id").primaryKey(),
  nameEn: text("name_en").notNull().unique(),
  nameAr: text("name_ar"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAgreementTypeSchema = createInsertSchema(agreementTypes, {
  nameEn: z.string().min(1, "Agreement type name (English) is required"),
  nameAr: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertAgreementType = z.infer<typeof insertAgreementTypeSchema>;
export type AgreementType = typeof agreementTypes.$inferSelect;

// Countries table - ISO 3166-1 countries (pre-populated, NOT user-editable)
export const countries = pgTable("countries", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 2 }).notNull().unique(), // ISO 3166-1 alpha-2
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar"),
});

export type Country = typeof countries.$inferSelect;

// Contacts table - searchable database of people
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar"),
  title: text("title"), // Honorific title like Dr., Prof., HE, etc.
  titleAr: text("title_ar"),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'set null' }),
  positionId: integer("position_id").references(() => positions.id, { onDelete: 'set null' }),
  countryId: integer("country_id").references(() => countries.id, { onDelete: 'set null' }),
  phone: text("phone"),
  email: text("email"),
  profilePictureKey: text("profile_picture_key"), // MinIO object key for profile picture
  profilePictureThumbnailKey: text("profile_picture_thumbnail_key"), // MinIO key for thumbnail
  isEligibleSpeaker: boolean("is_eligible_speaker").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  id: true,
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
export const eventSpeakers = pgTable("event_speakers", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  role: text("role"), // "Keynote", "Panelist", "Moderator", "Speaker", etc.
  roleAr: text("role_ar"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
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
  id: true,
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
export const archivedEventSpeakers = pgTable("archived_event_speakers", {
  id: serial("id").primaryKey(),
  archivedEventId: integer("archived_event_id").notNull().references(() => archivedEvents.id, { onDelete: 'cascade' }),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: 'set null' }),
  role: text("role"),
  roleAr: text("role_ar"),
  displayOrder: integer("display_order").default(0),
  // Snapshot data in case contact is deleted later
  speakerNameEn: text("speaker_name_en"),
  speakerNameAr: text("speaker_name_ar"),
  speakerTitle: text("speaker_title"),
  speakerTitleAr: text("speaker_title_ar"),
  speakerPosition: text("speaker_position"),
  speakerPositionAr: text("speaker_position_ar"),
  speakerOrganization: text("speaker_organization"),
  speakerOrganizationAr: text("speaker_organization_ar"),
  speakerProfilePictureKey: text("speaker_profile_picture_key"),
  speakerProfilePictureThumbnailKey: text("speaker_profile_picture_thumbnail_key"),
  createdAt: timestamp("created_at").defaultNow(),
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
  id: true,
  createdAt: true,
});

export type InsertArchivedEventSpeaker = z.infer<typeof insertArchivedEventSpeakerSchema>;
export type ArchivedEventSpeaker = typeof archivedEventSpeakers.$inferSelect;

// Event Attendees junction table - links events to contacts who attended
// PRIVACY NOTE: This data is NOT transferred to archived events
// Only the count is stored in archived_events.actualAttendees
export const eventAttendees = pgTable("event_attendees", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  attendedAt: timestamp("attended_at").defaultNow(), // When attendance was recorded
  notes: text("notes"), // Optional notes about attendance
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_event_attendees_event_id").on(table.eventId),
  index("IDX_event_attendees_contact_id").on(table.contactId),
  unique("unique_event_attendee").on(table.eventId, table.contactId), // Prevent duplicate attendance records
]);

export const insertEventAttendeeSchema = createInsertSchema(eventAttendees, {
  notes: z.string().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertEventAttendee = z.infer<typeof insertEventAttendeeSchema>;
export type EventAttendee = typeof eventAttendees.$inferSelect;

// Event Invitees junction table - links events to contacts who were invited
// Used for tracking conversion rates and RSVP status in engagement analytics
export const eventInvitees = pgTable("event_invitees", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  rsvp: boolean("rsvp").notNull().default(false), // Whether invitee has confirmed attendance
  registered: boolean("registered").notNull().default(false), // Whether invitee has registered online
  inviteEmailSent: boolean("invite_email_sent").notNull().default(false), // Whether invitation email was sent
  invitedAt: timestamp("invited_at").defaultNow(), // When invitation was sent
  rsvpAt: timestamp("rsvp_at"), // When RSVP was confirmed/updated
  registeredAt: timestamp("registered_at"), // When registration was completed
  inviteEmailSentAt: timestamp("invite_email_sent_at"), // When invitation email was sent
  notes: text("notes"), // Optional notes about invitation
  createdAt: timestamp("created_at").defaultNow(),
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
  id: true,
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
export const updates = pgTable(
  "updates",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(), // 'weekly' or 'monthly'
    periodStart: date("period_start").notNull(), // ISO week start Monday or first day of month
    content: text("content").notNull().default(''),
    departmentId: integer("department_id").references(() => departments.id, { onDelete: 'cascade' }), // Null for global/admin updates
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    updatedByUserId: integer("updated_by_user_id").references(() => users.id, { onDelete: 'set null' }),
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
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUpdate = z.infer<typeof insertUpdateSchema>;
export type Update = typeof updates.$inferSelect;

// ==================== Event File Storage Feature ====================

// Event folders table - Virtual folder metadata for event files
export const eventFolders = pgTable(
  "event_folders",
  {
    id: serial("id").primaryKey(),
    eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
    name: varchar("name", { length: 255 }).notNull(),
    parentFolderId: integer("parent_folder_id"), // Self-referencing FK added via alter
    path: varchar("path", { length: 1000 }).notNull(), // Full path e.g., /Documents/Agendas
    createdAt: timestamp("created_at").defaultNow(),
    createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index("IDX_event_folders_event_id").on(table.eventId),
    index("IDX_event_folders_parent_folder_id").on(table.parentFolderId),
    index("IDX_event_folders_path").on(table.eventId, table.path),
  ],
);

export const insertEventFolderSchema = createInsertSchema(eventFolders).omit({
  id: true,
  createdAt: true,
});

export type InsertEventFolder = z.infer<typeof insertEventFolderSchema>;
export type EventFolder = typeof eventFolders.$inferSelect;

// Event files table - File metadata with source tracking
export const eventFiles = pgTable(
  "event_files",
  {
    id: serial("id").primaryKey(),
    eventFolderId: integer("event_folder_id").notNull().references(() => eventFolders.id, { onDelete: 'cascade' }),
    objectKey: varchar("object_key", { length: 500 }).notNull().unique(), // MinIO object key
    thumbnailKey: varchar("thumbnail_key", { length: 500 }), // Thumbnail MinIO key (nullable)
    originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    fileSize: integer("file_size").notNull(), // Size in bytes
    sourceType: varchar("source_type", { length: 50 }).notNull().default('upload'), // 'upload', 'task_comment', 'agenda'
    sourceId: integer("source_id"), // Source record ID (nullable) - e.g., task comment ID
    uploadedByUserId: integer("uploaded_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: timestamp("uploaded_at").defaultNow(),
  },
  (table) => [
    index("IDX_event_files_event_folder_id").on(table.eventFolderId),
    index("IDX_event_files_source").on(table.sourceType, table.sourceId),
    index("IDX_event_files_uploaded_by").on(table.uploadedByUserId),
  ],
);

export const insertEventFileSchema = createInsertSchema(eventFiles).omit({
  id: true,
  uploadedAt: true,
});

export type InsertEventFile = z.infer<typeof insertEventFileSchema>;
export type EventFile = typeof eventFiles.$inferSelect;

// Folder access templates - Reusable permission templates
export const folderAccessTemplates = pgTable(
  "folder_access_templates",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: text("description"),
    permissions: jsonb("permissions").notNull(), // JSON with permission configuration
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index("IDX_folder_access_templates_is_default").on(table.isDefault),
  ],
);

export const insertFolderAccessTemplateSchema = createInsertSchema(folderAccessTemplates).omit({
  id: true,
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
export const eventFolderPermissions = pgTable(
  "event_folder_permissions",
  {
    id: serial("id").primaryKey(),
    eventFolderId: integer("event_folder_id").notNull().references(() => eventFolders.id, { onDelete: 'cascade' }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
    permissionLevel: varchar("permission_level", { length: 20 }).notNull(), // 'view', 'upload', 'manage'
    grantedByUserId: integer("granted_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    grantedAt: timestamp("granted_at").defaultNow(),
  },
  (table) => [
    index("IDX_event_folder_permissions_folder_id").on(table.eventFolderId),
    index("IDX_event_folder_permissions_user_id").on(table.userId),
    unique("unique_folder_user_permission").on(table.eventFolderId, table.userId),
  ],
);

export const insertEventFolderPermissionSchema = createInsertSchema(eventFolderPermissions).omit({
  id: true,
  grantedAt: true,
});

export type InsertEventFolderPermission = z.infer<typeof insertEventFolderPermissionSchema>;
export type EventFolderPermission = typeof eventFolderPermissions.$inferSelect;

// Event access grants - Event-wide access grants
export const eventAccessGrants = pgTable(
  "event_access_grants",
  {
    id: serial("id").primaryKey(),
    eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
    templateId: integer("template_id").references(() => folderAccessTemplates.id, { onDelete: 'set null' }),
    permissionLevel: varchar("permission_level", { length: 20 }).notNull().default('view'), // 'view', 'upload', 'manage'
    grantedByUserId: integer("granted_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    grantedAt: timestamp("granted_at").defaultNow(),
  },
  (table) => [
    index("IDX_event_access_grants_event_id").on(table.eventId),
    index("IDX_event_access_grants_user_id").on(table.userId),
    unique("unique_event_user_access").on(table.eventId, table.userId),
  ],
);

export const insertEventAccessGrantSchema = createInsertSchema(eventAccessGrants).omit({
  id: true,
  grantedAt: true,
});

export type InsertEventAccessGrant = z.infer<typeof insertEventAccessGrantSchema>;
export type EventAccessGrant = typeof eventAccessGrants.$inferSelect;

// ==================== Partnership Management Feature ====================

// Partnership Agreements table - stores agreement documents and history
export const partnershipAgreements = pgTable(
  "partnership_agreements",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    
    // Agreement details
    title: text("title").notNull(),
    titleAr: text("title_ar"),
    description: text("description"),
    descriptionAr: text("description_ar"),
    agreementTypeId: integer("agreement_type_id").references(() => agreementTypes.id, { onDelete: 'set null' }),
    
    // Dates
    signedDate: date("signed_date"),
    effectiveDate: date("effective_date"),
    expiryDate: date("expiry_date"), // null = no expiry
    
    // Signatories
    partnerSignatory: text("partner_signatory"),
    partnerSignatoryTitle: text("partner_signatory_title"),
    ourSignatory: text("our_signatory"),
    ourSignatoryTitle: text("our_signatory_title"),
    
    // Document storage (MinIO)
    documentKey: text("document_key"),
    documentFileName: text("document_file_name"),
    
    // Status
    status: text("status").notNull().default('draft'), // 'draft', 'pending_approval', 'active', 'expired', 'terminated'
    legalStatus: text("legal_status"), // 'binding' | 'non-binding'
    
    // Languages
    languages: text("languages").array(), // ['en', 'ar', 'fr', ...]
    
    // Termination clause (bilingual)
    terminationClause: text("termination_clause"),
    terminationClauseAr: text("termination_clause_ar"),
    
    // Metadata
    createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
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
  id: true,
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
export const agreementAttachments = pgTable(
  "agreement_attachments",
  {
    id: serial("id").primaryKey(),
    agreementId: integer("agreement_id").notNull().references(() => partnershipAgreements.id, { onDelete: 'cascade' }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
    objectKey: text("object_key").notNull().unique(),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    uploadedByUserId: integer("uploaded_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: timestamp("uploaded_at").defaultNow(),
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
  id: true,
  uploadedAt: true,
});

export type InsertAgreementAttachment = z.infer<typeof insertAgreementAttachmentSchema>;
export type AgreementAttachment = typeof agreementAttachments.$inferSelect;

// Partnership Activities table - track activities and interactions
export const partnershipActivities = pgTable(
  "partnership_activities",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    
    // Activity details
    title: text("title").notNull(),
    titleAr: text("title_ar"),
    description: text("description"),
    descriptionAr: text("description_ar"),
    activityType: text("activity_type").notNull(), // 'joint_event', 'sponsorship', 'collaboration', 'training', 'exchange', 'meeting', 'other'
    
    // Date and timing
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    
    // Linked event (optional)
    eventId: varchar("event_id").references(() => events.id, { onDelete: 'set null' }),
    
    // Outcome and impact
    outcome: text("outcome"),
    outcomeAr: text("outcome_ar"),
    impactScore: integer("impact_score"), // 1-5 scale
    
    // Metadata
    createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
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
  id: true,
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
export const partnershipContacts = pgTable(
  "partnership_contacts",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    role: text("role"), // 'primary', 'liaison', 'technical', 'executive', 'other'
    roleAr: text("role_ar"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
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
  id: true,
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
export const partnershipComments = pgTable(
  "partnership_comments",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    body: text("body").notNull(),
    bodyAr: text("body_ar"),
    authorUserId: integer("author_user_id").references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
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
  id: true,
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
export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    
    // Contact information
    name: text("name").notNull(),
    nameAr: text("name_ar"),
    email: text("email"),
    phone: text("phone"),
    
    // Classification
    type: text("type").notNull().default('lead'), // 'lead', 'partner', 'customer', 'vendor', 'other'
    status: text("status").notNull().default('active'), // 'active', 'in_progress', 'inactive'
    
    // Optional link to organization
    organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'set null' }),
    organizationName: text("organization_name"),
    
    // Notes
    notes: text("notes"),
    notesAr: text("notes_ar"),
    
    // Metadata
    createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
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
  id: true,
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
export const leadInteractions = pgTable(
  "lead_interactions",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").notNull().references(() => leads.id, { onDelete: 'cascade' }),
    
    // Interaction type
    type: text("type").notNull(), // 'email', 'phone_call', 'meeting', 'other'
    
    // Content
    description: text("description").notNull(),
    descriptionAr: text("description_ar"),
    
    // Outcome (optional - what resulted from this interaction)
    outcome: text("outcome"),
    outcomeAr: text("outcome_ar"),
    
    // Date/time of interaction
    interactionDate: timestamp("interaction_date").notNull().defaultNow(),
    
    // Metadata
    createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp("created_at").defaultNow(),
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
  id: true,
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
export const partnershipInteractions = pgTable(
  "partnership_interactions",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    
    // Interaction type: email, phone_call, meeting, document_sent, proposal_submitted, review_session, other
    type: text("type").notNull(),
    
    // Content
    description: text("description").notNull(),
    descriptionAr: text("description_ar"),
    
    // Outcome (optional - what resulted from this interaction)
    outcome: text("outcome"),
    outcomeAr: text("outcome_ar"),
    
    // Date/time of interaction
    interactionDate: timestamp("interaction_date").notNull().defaultNow(),
    
    // Metadata
    createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp("created_at").defaultNow(),
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
  id: true,
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
export const interactionAttachments = pgTable(
  "interaction_attachments",
  {
    id: serial("id").primaryKey(),
    leadInteractionId: integer("lead_interaction_id").references(() => leadInteractions.id, { onDelete: 'cascade' }),
    partnershipInteractionId: integer("partnership_interaction_id").references(() => partnershipInteractions.id, { onDelete: 'cascade' }),
    
    // File metadata
    objectKey: text("object_key").notNull().unique(),
    originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    
    // Metadata
    uploadedByUserId: integer("uploaded_by_user_id").references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: timestamp("uploaded_at").defaultNow(),
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
  id: true,
  uploadedAt: true,
});

export type InsertInteractionAttachment = z.infer<typeof insertInteractionAttachmentSchema>;
export type InteractionAttachment = typeof interactionAttachments.$inferSelect;

// ==================== AI Chat History Tables ====================
// For storing conversation history per user

export const aiChatConversations = pgTable(
  "ai_chat_conversations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: varchar("title", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    isArchived: boolean("is_archived").default(false),
  },
  (table) => [
    index("idx_ai_chat_conversations_user_id").on(table.userId),
    index("idx_ai_chat_conversations_updated_at").on(table.updatedAt),
  ]
);

export const insertAiChatConversationSchema = createInsertSchema(aiChatConversations, {
  title: z.string().max(255).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiChatConversation = z.infer<typeof insertAiChatConversationSchema>;
export type AiChatConversation = typeof aiChatConversations.$inferSelect;

export const aiChatMessages = pgTable(
  "ai_chat_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: text("conversation_id").notNull().references(() => aiChatConversations.id, { onDelete: 'cascade' }),
    role: text("role").notNull(), // 'user' or 'assistant'
    content: text("content").notNull(),
    sources: jsonb("sources"), // AiSource[] for assistant messages
    metadata: jsonb("metadata"), // model, processing time, etc.
    createdAt: timestamp("created_at").defaultNow(),
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
  id: true,
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
