import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import {
  settings,
  emailConfig,
  emailTemplates,
  whatsappConfig,
  whatsappTemplates,
  type EmailConfig,
  type EmailTemplate,
  type WhatsappConfig,
  type WhatsappTemplate,
  type Settings
} from "../../shared/schema.mssql";
import { z } from "zod";

/**
 * Combined configuration object representing the current settings data model.
 * It aggregates the normalized tables into a single payload consumed by the API.
 */
export interface AppConfig {
  // Core settings
  settings: Settings;
  
  // Email configuration
  emailConfig: EmailConfig | null;
  emailTemplates: Map<string, EmailTemplate>; // key: `${type}_${language}`
  
  // WhatsApp configuration
  whatsappConfig: WhatsappConfig | null;
  whatsappTemplates: Map<string, WhatsappTemplate>; // key: `${type}_${language}`
}

const defaultCoreSettings: Omit<Settings, "id"> = {
  publicCsvExport: false,
  fileUploadsEnabled: false,
  scrapedEventsEnabled: true,
  archiveEnabled: true,
  dailyReminderGlobalEnabled: false,
  dailyReminderGlobalTime: "08:00",
  allowStakeholderAttendeeUpload: false,
  stakeholderUploadPermissions: null,
};

async function ensureConfigDefaults() {
  const [coreSettings] = await db.select().from(settings).offset(1);
  if (!coreSettings) {
    await db.insert(settings).values(defaultCoreSettings).returning();
  }

  const [emailConf] = await db.select().from(emailConfig).offset(1);
  if (!emailConf) {
    await db.insert(emailConfig).values({}).returning();
  }

  const [whatsappConf] = await db.select().from(whatsappConfig).offset(1);
  if (!whatsappConf) {
    await db.insert(whatsappConfig).values({}).returning();
  }

  // Ensure default WhatsApp templates exist
  const existingTemplates = await db.select().from(whatsappTemplates);
  const templatesToInsert: Array<{ type: string; language: TemplateLanguage; template: string }> = [];

  const ensureTemplate = (type: string, language: TemplateLanguage, template: string) => {
    if (!existingTemplates.some((t: { type: string; language: string; }) => t.type === type && t.language === language)) {
      templatesToInsert.push({ type, language, template });
    }
  };

  ensureTemplate('event_created', 'en', '🎉 New Event Created!\n\n📅 {{eventName}}\n📍 {{location}}\n🕐 {{startDate}} - {{endDate}}\n\n{{description}}');
  ensureTemplate('event_created', 'ar', '🎉 تم إنشاء حدث جديد!\n\n📅 {{eventName}}\n📍 {{location}}\n🕐 {{startDate}} - {{endDate}}\n\n{{description}}');
  ensureTemplate('reminder', 'en', '⏰ Event Reminder\n\n📅 {{eventName}}\n📍 {{location}}\n🕐 {{startDate}}\n\n{{description}}');
  ensureTemplate('reminder', 'ar', '⏰ تذكير بالحدث\n\n📅 {{eventName}}\n📍 {{location}}\n🕐 {{startDate}}\n\n{{description}}');
  ensureTemplate('updates_digest', 'en', '📢 {{header}}\n\n{{updates}}');
  ensureTemplate('updates_digest', 'ar', '📢 {{header}}\n\n{{updates}}');

  if (templatesToInsert.length > 0) {
    await db.insert(whatsappTemplates).values(templatesToInsert);
    console.log('[ConfigService] Initialized default WhatsApp templates');
  }
}

/**
 * Loads all configuration from the database
 */
export async function loadAppConfig(): Promise<AppConfig> {
  await ensureConfigDefaults();

  // Load core settings
  const [coreSettings] = await db.select().from(settings).offset(1);

  // Load email configuration
  const [emailConf] = await db.select().from(emailConfig).offset(1);
  
  // Load all email templates
  const emailTemplatesList = await db.select().from(emailTemplates);
  const emailTemplatesMap = new Map<string, EmailTemplate>();
  emailTemplatesList.forEach((template: { id: number; language: string; createdAt: Date; updatedAt: Date; type: string; subject: string | null; body: string | null; greeting: string | null; footer: string | null; requirementsTitle: string | null; customRequirementsTitle: string | null; requirementItemTemplate: string | null; brandColor: string | null; textColor: string | null; bgColor: string | null; fontFamily: string | null; fontSize: string | null; requirementsBrandColor: string | null; requirementsTextColor: string | null; requirementsBgColor: string | null; requirementsFontFamily: string | null; requirementsFontSize: string | null; footerBrandColor: string | null; footerTextColor: string | null; footerBgColor: string | null; footerFontFamily: string | null; footerFontSize: string | null; isRtl: boolean; additionalConfig: string | null; }) => {
    emailTemplatesMap.set(`${template.type}_${template.language}`, template);
  });
  
  // Load WhatsApp configuration
  const [whatsappConf] = await db.select().from(whatsappConfig).offset(1);
  
  // Load all WhatsApp templates
  const whatsappTemplatesList = await db.select().from(whatsappTemplates);
  const whatsappTemplatesMap = new Map<string, WhatsappTemplate>();
  whatsappTemplatesList.forEach((template: { id: number; language: string; createdAt: Date; updatedAt: Date; type: string; template: string; }) => {
    whatsappTemplatesMap.set(`${template.type}_${template.language}`, template);
  });
  
  return {
    settings: coreSettings,
    emailConfig: emailConf || null,
    emailTemplates: emailTemplatesMap,
    whatsappConfig: whatsappConf || null,
    whatsappTemplates: whatsappTemplatesMap,
  };
}

/**
 * Gets a specific email template
 */
export async function getEmailTemplate(type: string, language: 'en' | 'ar' = 'en'): Promise<EmailTemplate | null> {
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(
      sql`${emailTemplates.type} = ${type} AND ${emailTemplates.language} = ${language}`
    );
  
  return template || null;
}

/**
 * Gets a specific WhatsApp template
 */
export async function getWhatsappTemplate(type: string, language: 'en' | 'ar' = 'en'): Promise<WhatsappTemplate | null> {
  const [template] = await db
    .select()
    .from(whatsappTemplates)
    .where(
      sql`${whatsappTemplates.type} = ${type} AND ${whatsappTemplates.language} = ${language}`
    );
  
  return template || null;
}

/**
 * Helper to get management summary config from additional_config JSONB
 */
export function getManagementSummaryConfig(template: EmailTemplate | null): {
  enabled: boolean;
  includeRequirements: boolean;
  recipients: string | null;
  ccList: string | null;
  stakeholderTemplate: string | null;
  stakeholderSeparator: string | null;
} {
  const additionalConfig = (template?.additionalConfig as any) || {};
  return {
    enabled: additionalConfig.enabled || false,
    includeRequirements: additionalConfig.include_requirements !== false,
    recipients: additionalConfig.recipients || null,
    ccList: additionalConfig.cc_list || null,
    stakeholderTemplate: additionalConfig.stakeholder_template || null,
    stakeholderSeparator: additionalConfig.stakeholder_separator || '',
  };
}

function getTemplateCc(template: EmailTemplate | undefined | null): string | null {
  const additionalConfig = (template?.additionalConfig as any) || {};
  return additionalConfig.cc_list || null;
}

export const settingsUpdateSchema = z.object({
  // Core settings
  publicCsvExport: z.boolean().optional(),
  fileUploadsEnabled: z.boolean().optional(),
  scrapedEventsEnabled: z.boolean().optional(),
  archiveEnabled: z.boolean().optional(),
  dailyReminderGlobalEnabled: z.boolean().optional(),
  dailyReminderGlobalTime: z.string().optional(),
  allowStakeholderAttendeeUpload: z.boolean().optional(),
  stakeholderUploadPermissions: z.record(z.boolean()).optional(),

  // Email configuration
  emailEnabled: z.boolean().optional(),
  emailProvider: z.enum(["resend", "smtp"]).optional(),
  emailApiKey: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().int().optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  emailFromEmail: z.string().email().optional().or(z.literal("")),
  emailFromName: z.string().optional(),
  emailRecipients: z.string().optional(),
  globalCcList: z.string().optional(),
  stakeholderCcList: z.string().optional(),
  reminderCcList: z.string().optional(),
  managementSummaryCcList: z.string().optional(),
  managementSummaryRecipients: z.string().optional(),
  managementSummaryEnabled: z.boolean().optional(),
  emailLanguage: z.enum(["en", "ar"]).optional(),

  // WhatsApp configuration
  whatsappEnabled: z.boolean().optional(),
  whatsappChatId: z.string().optional(),
  whatsappChatName: z.string().optional(),
  whatsappUpdatesChatId: z.string().optional(),
  whatsappUpdatesChatName: z.string().optional(),
  whatsappLanguage: z.enum(["en", "ar"]).optional(),

  // WhatsApp templates
  whatsappEventCreatedTemplateEn: z.string().optional(),
  whatsappEventCreatedTemplateAr: z.string().optional(),
  whatsappReminderTemplateEn: z.string().optional(),
  whatsappReminderTemplateAr: z.string().optional(),
  whatsappUpdatesTemplateEn: z.string().optional(),
  whatsappUpdatesTemplateAr: z.string().optional(),

  // Stakeholder templates
  stakeholderSubject: z.string().optional(),
  stakeholderBody: z.string().optional(),
  stakeholderGreeting: z.string().optional(),
  stakeholderFooter: z.string().optional(),
  stakeholderRequirementsTitle: z.string().optional(),
  stakeholderCustomRequirementsTitle: z.string().optional(),
  stakeholderRequirementItemTemplate: z.string().optional(),
  stakeholderBrandColor: z.string().optional(),
  stakeholderTextColor: z.string().optional(),
  stakeholderBgColor: z.string().optional(),
  stakeholderFontFamily: z.string().optional(),
  stakeholderFontSize: z.string().optional(),
  stakeholderRequirementsBrandColor: z.string().optional(),
  stakeholderRequirementsTextColor: z.string().optional(),
  stakeholderRequirementsBgColor: z.string().optional(),
  stakeholderRequirementsFontFamily: z.string().optional(),
  stakeholderRequirementsFontSize: z.string().optional(),
  stakeholderFooterBrandColor: z.string().optional(),
  stakeholderFooterTextColor: z.string().optional(),
  stakeholderFooterBgColor: z.string().optional(),
  stakeholderFooterFontFamily: z.string().optional(),
  stakeholderFooterFontSize: z.string().optional(),
  stakeholderEmailRtl: z.boolean().optional(),
  stakeholderSubjectAr: z.string().optional(),
  stakeholderBodyAr: z.string().optional(),
  stakeholderGreetingAr: z.string().optional(),
  stakeholderFooterAr: z.string().optional(),
  stakeholderRequirementsTitleAr: z.string().optional(),

  // Reminder templates
  reminderSubject: z.string().optional(),
  reminderBody: z.string().optional(),
  reminderGreeting: z.string().optional(),
  reminderFooter: z.string().optional(),
  reminderRequirementsTitle: z.string().optional(),
  reminderRequirementItemTemplate: z.string().optional(),
  reminderBrandColor: z.string().optional(),
  reminderTextColor: z.string().optional(),
  reminderBgColor: z.string().optional(),
  reminderFontFamily: z.string().optional(),
  reminderFontSize: z.string().optional(),
  reminderRequirementsBrandColor: z.string().optional(),
  reminderRequirementsTextColor: z.string().optional(),
  reminderRequirementsBgColor: z.string().optional(),
  reminderRequirementsFontFamily: z.string().optional(),
  reminderRequirementsFontSize: z.string().optional(),
  reminderFooterBrandColor: z.string().optional(),
  reminderFooterTextColor: z.string().optional(),
  reminderFooterBgColor: z.string().optional(),
  reminderFooterFontFamily: z.string().optional(),
  reminderFooterFontSize: z.string().optional(),
  reminderEmailRtl: z.boolean().optional(),
  reminderSubjectAr: z.string().optional(),
  reminderBodyAr: z.string().optional(),
  reminderGreetingAr: z.string().optional(),
  reminderFooterAr: z.string().optional(),
  reminderRequirementsTitleAr: z.string().optional(),

  // Management summary templates
  managementSummarySubjectTemplate: z.string().optional(),
  managementSummaryBody: z.string().optional(),
  managementSummaryGreeting: z.string().optional(),
  managementSummaryFooter: z.string().optional(),
  managementSummaryRequirementsTitle: z.string().optional(),
  managementSummaryRequirementItemTemplate: z.string().optional(),
  managementSummaryStakeholderTemplate: z.string().optional(),
  managementSummaryStakeholderSeparator: z.string().optional(),
  managementSummaryBrandColor: z.string().optional(),
  managementSummaryTextColor: z.string().optional(),
  managementSummaryBgColor: z.string().optional(),
  managementSummaryFontFamily: z.string().optional(),
  managementSummaryFontSize: z.string().optional(),
  managementSummaryRequirementsBrandColor: z.string().optional(),
  managementSummaryRequirementsTextColor: z.string().optional(),
  managementSummaryRequirementsBgColor: z.string().optional(),
  managementSummaryRequirementsFontFamily: z.string().optional(),
  managementSummaryRequirementsFontSize: z.string().optional(),
  managementSummaryFooterBrandColor: z.string().optional(),
  managementSummaryFooterTextColor: z.string().optional(),
  managementSummaryFooterBgColor: z.string().optional(),
  managementSummaryFooterFontFamily: z.string().optional(),
  managementSummaryFooterFontSize: z.string().optional(),
  managementSummaryEmailRtl: z.boolean().optional(),
  managementSummarySubjectAr: z.string().optional(),
  managementSummaryBodyAr: z.string().optional(),
  managementSummaryGreetingAr: z.string().optional(),
  managementSummaryFooterAr: z.string().optional(),
  managementSummaryRequirementsTitleAr: z.string().optional(),

  // Task completion templates
  taskCompletionSubject: z.string().optional(),
  taskCompletionBody: z.string().optional(),
  taskCompletionFooter: z.string().optional(),
  taskCompletionBrandColor: z.string().optional(),
  taskCompletionTextColor: z.string().optional(),
  taskCompletionBgColor: z.string().optional(),
  taskCompletionFontFamily: z.string().optional(),
  taskCompletionFontSize: z.string().optional(),
  taskCompletionFooterBrandColor: z.string().optional(),
  taskCompletionFooterTextColor: z.string().optional(),
  taskCompletionFooterBgColor: z.string().optional(),
  taskCompletionFooterFontFamily: z.string().optional(),
  taskCompletionFooterFontSize: z.string().optional(),
  taskCompletionEmailRtl: z.boolean().optional(),
  taskCompletionSubjectAr: z.string().optional(),
  taskCompletionBodyAr: z.string().optional(),
  taskCompletionFooterAr: z.string().optional(),

  // Updates templates
  updatesEmailTemplate: z.string().optional(),
  updatesEmailTemplateAr: z.string().optional(),
  updatesBrandColor: z.string().optional(),
  updatesTextColor: z.string().optional(),
  updatesBgColor: z.string().optional(),
  updatesFontFamily: z.string().optional(),
  updatesFontSize: z.string().optional(),
});

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

/**
 * AppSettings represents the full aggregated settings object returned by the API.
 * This combines core settings with email, whatsapp configs and templates.
 * For dynamic property access (like settings[key]), cast to Record<string, unknown> when needed.
 */
export interface AppSettings extends Settings {
  // Email config
  emailEnabled?: boolean;
  emailProvider?: string;
  emailApiKey?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  emailFromEmail?: string | null;
  emailFromName?: string | null;
  emailRecipients?: string | null;
  globalCcList?: string | null;
  stakeholderCcList?: string | null;
  reminderCcList?: string | null;
  emailLanguage?: string;

  // Management summary
  managementSummaryEnabled?: boolean;
  managementSummaryIncludeRequirements?: boolean;
  managementSummaryRecipients?: string | null;
  managementSummaryCcList?: string | null;
  managementSummaryStakeholderTemplate?: string | null;
  managementSummaryStakeholderSeparator?: string | null;

  // WhatsApp config
  whatsappEnabled?: boolean;
  whatsappChatId?: string | null;
  whatsappChatName?: string | null;
  whatsappUpdatesChatId?: string | null;
  whatsappUpdatesChatName?: string | null;
  whatsappLanguage?: string;

  // WhatsApp templates
  whatsappEventCreatedTemplateEn?: string;
  whatsappEventCreatedTemplateAr?: string;
  whatsappReminderTemplateEn?: string;
  whatsappReminderTemplateAr?: string;
  whatsappUpdatesTemplateEn?: string;
  whatsappUpdatesTemplateAr?: string;

  // Email templates - allow any string key for dynamic template properties
  [key: string]: unknown;
}

/**
 * Builds the aggregated settings payload returned by the API.
 */
export async function buildSettingsPayload(): Promise<AppSettings> {
  const config = await loadAppConfig();
  const { settings: coreSettings, emailConfig: emailConf, emailTemplates: emailTempl, whatsappConfig: whatsappConf, whatsappTemplates: whatsappTempl } = config;

  const mergedCoreSettings: Settings = coreSettings || ({
    id: 0,
    ...defaultCoreSettings,
  } as Settings);
  
  // Get specific templates
  const stakeholderEn = emailTempl.get('stakeholder_en');
  const stakeholderAr = emailTempl.get('stakeholder_ar');
  const reminderEn = emailTempl.get('reminder_en');
  const reminderAr = emailTempl.get('reminder_ar');
  const managementEn = emailTempl.get('management_summary_en');
  const managementAr = emailTempl.get('management_summary_ar');
  const taskCompletionEn = emailTempl.get('task_completion_en');
  const taskCompletionAr = emailTempl.get('task_completion_ar');
  const updatesEn = emailTempl.get('updates_en');
  const updatesAr = emailTempl.get('updates_ar');
  
  const whatsappEventCreatedEn = whatsappTempl.get('event_created_en');
  const whatsappEventCreatedAr = whatsappTempl.get('event_created_ar');
  const whatsappReminderEn = whatsappTempl.get('reminder_en');
  const whatsappReminderAr = whatsappTempl.get('reminder_ar');
  const whatsappUpdatesEn = whatsappTempl.get('updates_digest_en');
  const whatsappUpdatesAr = whatsappTempl.get('updates_digest_ar');
  
  const managementConfig = getManagementSummaryConfig(managementEn || null);
  const stakeholderCcList = getTemplateCc(stakeholderEn);
  const reminderCcList = getTemplateCc(reminderEn);
  
  // Build aggregated settings object
  return {
    ...mergedCoreSettings,
    
    // Email config
    emailEnabled: emailConf?.enabled || false,
    emailProvider: emailConf?.provider || 'resend',
    emailApiKey: emailConf?.apiKey || null,
    smtpHost: emailConf?.smtpHost || null,
    smtpPort: emailConf?.smtpPort || null,
    smtpSecure: emailConf?.smtpSecure !== false,
    smtpUser: emailConf?.smtpUser || null,
    smtpPassword: emailConf?.smtpPassword || null,
    emailFromEmail: emailConf?.fromEmail || null,
    emailFromName: emailConf?.fromName || null,
    emailRecipients: emailConf?.defaultRecipients || null,
    globalCcList: emailConf?.globalCcList || null,
    stakeholderCcList,
    reminderCcList,
    emailLanguage: emailConf?.language || 'en',
    
    // Management summary config
    managementSummaryEnabled: managementConfig.enabled,
    managementSummaryIncludeRequirements: managementConfig.includeRequirements,
    managementSummaryRecipients: managementConfig.recipients,
    managementSummaryCcList: managementConfig.ccList,
    
    // WhatsApp config
    whatsappEnabled: whatsappConf?.enabled || false,
    whatsappChatId: whatsappConf?.chatId || null,
    whatsappChatName: whatsappConf?.chatName || null,
    whatsappUpdatesChatId: whatsappConf?.updatesChatId || null,
    whatsappUpdatesChatName: whatsappConf?.updatesChatName || null,
    whatsappLanguage: whatsappConf?.language || 'en',
    
    // WhatsApp templates
    whatsappEventCreatedTemplateEn: whatsappEventCreatedEn?.template || '',
    whatsappEventCreatedTemplateAr: whatsappEventCreatedAr?.template || '',
    whatsappReminderTemplateEn: whatsappReminderEn?.template || '',
    whatsappReminderTemplateAr: whatsappReminderAr?.template || '',
    whatsappUpdatesTemplateEn: whatsappUpdatesEn?.template || '',
    whatsappUpdatesTemplateAr: whatsappUpdatesAr?.template || '',
    
    // Stakeholder email templates
    stakeholderSubject: stakeholderEn?.subject || '',
    stakeholderBody: stakeholderEn?.body || '',
    stakeholderGreeting: stakeholderEn?.greeting || '',
    stakeholderFooter: stakeholderEn?.footer || '',
    stakeholderRequirementsTitle: stakeholderEn?.requirementsTitle || '',
    stakeholderCustomRequirementsTitle: stakeholderEn?.customRequirementsTitle || '',
    stakeholderRequirementItemTemplate: stakeholderEn?.requirementItemTemplate || '',
    stakeholderBrandColor: stakeholderEn?.brandColor || '#BC9F6D',
    stakeholderTextColor: stakeholderEn?.textColor || '#333333',
    stakeholderBgColor: stakeholderEn?.bgColor || '#FFFFFF',
    stakeholderFontFamily: stakeholderEn?.fontFamily || 'Arial, sans-serif',
    stakeholderFontSize: stakeholderEn?.fontSize || '16px',
    stakeholderRequirementsBrandColor: stakeholderEn?.requirementsBrandColor || '#BC9F6D',
    stakeholderRequirementsTextColor: stakeholderEn?.requirementsTextColor || '#333333',
    stakeholderRequirementsBgColor: stakeholderEn?.requirementsBgColor || '#F5F5F5',
    stakeholderRequirementsFontFamily: stakeholderEn?.requirementsFontFamily || 'Arial, sans-serif',
    stakeholderRequirementsFontSize: stakeholderEn?.requirementsFontSize || '16px',
    stakeholderFooterBrandColor: stakeholderEn?.footerBrandColor || '#BC9F6D',
    stakeholderFooterTextColor: stakeholderEn?.footerTextColor || '#666666',
    stakeholderFooterBgColor: stakeholderEn?.footerBgColor || '#FFFFFF',
    stakeholderFooterFontFamily: stakeholderEn?.footerFontFamily || 'Arial, sans-serif',
    stakeholderFooterFontSize: stakeholderEn?.footerFontSize || '14px',
    stakeholderEmailRtl: stakeholderEn?.isRtl || false,
    
    // Stakeholder email templates (Arabic)
    stakeholderSubjectAr: stakeholderAr?.subject || '',
    stakeholderBodyAr: stakeholderAr?.body || '',
    stakeholderGreetingAr: stakeholderAr?.greeting || '',
    stakeholderFooterAr: stakeholderAr?.footer || '',
    stakeholderRequirementsTitleAr: stakeholderAr?.requirementsTitle || '',
    
    // Reminder email templates
    reminderSubject: reminderEn?.subject || '',
    reminderBody: reminderEn?.body || '',
    reminderGreeting: reminderEn?.greeting || '',
    reminderFooter: reminderEn?.footer || '',
    reminderRequirementsTitle: reminderEn?.requirementsTitle || '',
    reminderRequirementItemTemplate: reminderEn?.requirementItemTemplate || '',
    reminderBrandColor: reminderEn?.brandColor || '#BC9F6D',
    reminderTextColor: reminderEn?.textColor || '#333333',
    reminderBgColor: reminderEn?.bgColor || '#FFFFFF',
    reminderFontFamily: reminderEn?.fontFamily || 'Arial, sans-serif',
    reminderFontSize: reminderEn?.fontSize || '16px',
    reminderRequirementsBrandColor: reminderEn?.requirementsBrandColor || '#BC9F6D',
    reminderRequirementsTextColor: reminderEn?.requirementsTextColor || '#333333',
    reminderRequirementsBgColor: reminderEn?.requirementsBgColor || '#F5F5F5',
    reminderRequirementsFontFamily: reminderEn?.requirementsFontFamily || 'Arial, sans-serif',
    reminderRequirementsFontSize: reminderEn?.requirementsFontSize || '16px',
    reminderFooterBrandColor: reminderEn?.footerBrandColor || '#BC9F6D',
    reminderFooterTextColor: reminderEn?.footerTextColor || '#666666',
    reminderFooterBgColor: reminderEn?.footerBgColor || '#FFFFFF',
    reminderFooterFontFamily: reminderEn?.footerFontFamily || 'Arial, sans-serif',
    reminderFooterFontSize: reminderEn?.footerFontSize || '14px',
    reminderEmailRtl: reminderEn?.isRtl || false,
    
    // Reminder email templates (Arabic)
    reminderSubjectAr: reminderAr?.subject || '',
    reminderBodyAr: reminderAr?.body || '',
    reminderGreetingAr: reminderAr?.greeting || '',
    reminderFooterAr: reminderAr?.footer || '',
    reminderRequirementsTitleAr: reminderAr?.requirementsTitle || '',
    
    // Management summary templates
    managementSummarySubjectTemplate: managementEn?.subject || '',
    managementSummaryBody: managementEn?.body || '',
    managementSummaryGreeting: managementEn?.greeting || '',
    managementSummaryFooter: managementEn?.footer || '',
    managementSummaryRequirementsTitle: managementEn?.requirementsTitle || '',
    managementSummaryRequirementItemTemplate: managementEn?.requirementItemTemplate || '',
    managementSummaryStakeholderTemplate: managementConfig.stakeholderTemplate,
    managementSummaryStakeholderSeparator: managementConfig.stakeholderSeparator,
    managementSummaryBrandColor: managementEn?.brandColor || '#BC9F6D',
    managementSummaryTextColor: managementEn?.textColor || '#333333',
    managementSummaryBgColor: managementEn?.bgColor || '#FFFFFF',
    managementSummaryFontFamily: managementEn?.fontFamily || 'Arial, sans-serif',
    managementSummaryFontSize: managementEn?.fontSize || '16px',
    managementSummaryRequirementsBrandColor: managementEn?.requirementsBrandColor || '#BC9F6D',
    managementSummaryRequirementsTextColor: managementEn?.requirementsTextColor || '#333333',
    managementSummaryRequirementsBgColor: managementEn?.requirementsBgColor || '#F5F5F5',
    managementSummaryRequirementsFontFamily: managementEn?.requirementsFontFamily || 'Arial, sans-serif',
    managementSummaryRequirementsFontSize: managementEn?.requirementsFontSize || '16px',
    managementSummaryFooterBrandColor: managementEn?.footerBrandColor || '#BC9F6D',
    managementSummaryFooterTextColor: managementEn?.footerTextColor || '#666666',
    managementSummaryFooterBgColor: managementEn?.footerBgColor || '#FFFFFF',
    managementSummaryFooterFontFamily: managementEn?.footerFontFamily || 'Arial, sans-serif',
    managementSummaryFooterFontSize: managementEn?.footerFontSize || '14px',
    managementSummaryEmailRtl: managementEn?.isRtl || false,
    
    // Management summary templates (Arabic)
    managementSummarySubjectAr: managementAr?.subject || '',
    managementSummaryBodyAr: managementAr?.body || '',
    managementSummaryGreetingAr: managementAr?.greeting || '',
    managementSummaryFooterAr: managementAr?.footer || '',
    managementSummaryRequirementsTitleAr: managementAr?.requirementsTitle || '',
    
    // Task completion templates
    taskCompletionSubject: taskCompletionEn?.subject || '',
    taskCompletionBody: taskCompletionEn?.body || '',
    taskCompletionFooter: taskCompletionEn?.footer || '',
    taskCompletionBrandColor: taskCompletionEn?.brandColor || '#BC9F6D',
    taskCompletionTextColor: taskCompletionEn?.textColor || '#333333',
    taskCompletionBgColor: taskCompletionEn?.bgColor || '#FFFFFF',
    taskCompletionFontFamily: taskCompletionEn?.fontFamily || 'Arial, sans-serif',
    taskCompletionFontSize: taskCompletionEn?.fontSize || '16px',
    taskCompletionFooterBrandColor: taskCompletionEn?.footerBrandColor || '#BC9F6D',
    taskCompletionFooterTextColor: taskCompletionEn?.footerTextColor || '#666666',
    taskCompletionFooterBgColor: taskCompletionEn?.footerBgColor || '#FFFFFF',
    taskCompletionFooterFontFamily: taskCompletionEn?.footerFontFamily || 'Arial, sans-serif',
    taskCompletionFooterFontSize: taskCompletionEn?.footerFontSize || '14px',
    taskCompletionEmailRtl: taskCompletionEn?.isRtl || false,
    
    // Task completion templates (Arabic)
    taskCompletionSubjectAr: taskCompletionAr?.subject || '',
    taskCompletionBodyAr: taskCompletionAr?.body || '',
    taskCompletionFooterAr: taskCompletionAr?.footer || '',
    
    // Updates templates
    updatesEmailTemplate: updatesEn?.body || '',
    updatesEmailTemplateAr: updatesAr?.body || '',
    updatesBrandColor: updatesEn?.brandColor || '#BC9F6D',
    updatesTextColor: updatesEn?.textColor || '#333333',
    updatesBgColor: updatesEn?.bgColor || '#FFFFFF',
    updatesFontFamily: updatesEn?.fontFamily || 'Arial, sans-serif',
    updatesFontSize: updatesEn?.fontSize || '16px',
  };
}

type TemplateLanguage = 'en' | 'ar';

async function upsertEmailTemplate(
  type: string,
  language: TemplateLanguage,
  values: Partial<EmailTemplate>,
  additionalConfig?: Record<string, any>
) {
  const current = await getEmailTemplate(type, language);
  const updatePayload: Partial<EmailTemplate> = {};

  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) {
      (updatePayload as any)[key] = value;
    }
  });

  if (additionalConfig && Object.keys(additionalConfig).length > 0) {
    updatePayload.additionalConfig = {
      ...((current?.additionalConfig as any) || {}),
      ...additionalConfig,
    } as any;
  }

  if (Object.keys(updatePayload).length === 0 && current) {
    return current;
  }

  // Construct insert values with required fields
  const insertValues = {
    type,
    language,
    ...current,
    ...updatePayload,
  };

  const [template] = await db
    .insert(emailTemplates)
    .values(insertValues as typeof emailTemplates.$inferInsert)
    .onConflictDoUpdate({
      target: [emailTemplates.type, emailTemplates.language],
      set: updatePayload,
    })
    .returning();

  return template;
}

async function upsertWhatsappTemplate(type: string, language: TemplateLanguage, template?: string | null) {
  if (template === undefined || template === null) return;

  await db
    .insert(whatsappTemplates)
    .values({ type, language, template })
    .onConflictDoUpdate({ target: [whatsappTemplates.type, whatsappTemplates.language], set: { template } });
}

export async function updateSettingsPayload(updates: SettingsUpdate): Promise<AppSettings> {
  await ensureConfigDefaults();

  // Update core settings
  const coreUpdates: Partial<Settings> = {};
  ([
    'publicCsvExport',
    'fileUploadsEnabled',
    'scrapedEventsEnabled',
    'archiveEnabled',
    'dailyReminderGlobalEnabled',
    'dailyReminderGlobalTime',
    'allowStakeholderAttendeeUpload',
    'stakeholderUploadPermissions'
  ] as const)
    .forEach((key) => {
      if (updates[key] !== undefined) {
        (coreUpdates as any)[key] = updates[key];
      }
    });

  if (Object.keys(coreUpdates).length > 0) {
    const [current] = await db.select().from(settings).offset(1);
    if (current) {
      await db.update(settings).set(coreUpdates).where(eq(settings.id, current.id));
    }
  }

  // Update email configuration
  const emailUpdates: Partial<EmailConfig> = {};
  const emailUpdateKeys: Array<keyof SettingsUpdate> = [
    'emailEnabled',
    'emailProvider',
    'emailApiKey',
    'smtpHost',
    'smtpPort',
    'smtpSecure',
    'smtpUser',
    'smtpPassword',
    'emailFromEmail',
    'emailFromName',
    'emailRecipients',
    'globalCcList',
    'emailLanguage',
  ];

  emailUpdateKeys.forEach((key) => {
    const value = updates[key];
    if (value !== undefined) {
      const targetKey =
        key === 'emailEnabled' ? 'enabled'
        : key === 'emailProvider' ? 'provider'
        : key === 'emailApiKey' ? 'apiKey'
        : key === 'smtpHost' ? 'smtpHost'
        : key === 'smtpPort' ? 'smtpPort'
        : key === 'smtpSecure' ? 'smtpSecure'
        : key === 'smtpUser' ? 'smtpUser'
        : key === 'smtpPassword' ? 'smtpPassword'
        : key === 'emailFromEmail' ? 'fromEmail'
        : key === 'emailFromName' ? 'fromName'
        : key === 'emailRecipients' ? 'defaultRecipients'
        : key === 'globalCcList' ? 'globalCcList'
        : 'language';

      (emailUpdates as any)[targetKey] = value;
    }
  });

  if (Object.keys(emailUpdates).length > 0) {
    const [currentEmailConfig] = await db.select().from(emailConfig).offset(1);
    if (currentEmailConfig) {
      await db.update(emailConfig).set(emailUpdates).where(eq(emailConfig.id, currentEmailConfig.id));
    }
  }

  // Update WhatsApp configuration
  const whatsappUpdates: Partial<WhatsappConfig> = {};
  const whatsappMap = {
    whatsappEnabled: 'enabled',
    whatsappChatId: 'chatId',
    whatsappChatName: 'chatName',
    whatsappUpdatesChatId: 'updatesChatId',
    whatsappUpdatesChatName: 'updatesChatName',
    whatsappLanguage: 'language',
  } as const;

  (Object.keys(whatsappMap) as Array<keyof typeof whatsappMap>).forEach((key) => {
    const value = updates[key];
    if (value !== undefined) {
      const whatsappKey = whatsappMap[key];
      (whatsappUpdates as any)[whatsappKey] = value;
    }
  });

  if (Object.keys(whatsappUpdates).length > 0) {
    const [currentWhatsappConfig] = await db.select().from(whatsappConfig).offset(1);
    if (currentWhatsappConfig) {
      await db.update(whatsappConfig).set(whatsappUpdates).where(eq(whatsappConfig.id, currentWhatsappConfig.id));
    } else {
      await db.insert(whatsappConfig).values({
        enabled: whatsappUpdates.enabled ?? false,
        language: whatsappUpdates.language || 'en',
        ...whatsappUpdates,
      }).returning();
    }
  }

  // Email templates
  await upsertEmailTemplate('stakeholder', 'en', {
    subject: updates.stakeholderSubject,
    body: updates.stakeholderBody,
    greeting: updates.stakeholderGreeting,
    footer: updates.stakeholderFooter,
    requirementsTitle: updates.stakeholderRequirementsTitle,
    customRequirementsTitle: updates.stakeholderCustomRequirementsTitle,
    requirementItemTemplate: updates.stakeholderRequirementItemTemplate,
    brandColor: updates.stakeholderBrandColor,
    textColor: updates.stakeholderTextColor,
    bgColor: updates.stakeholderBgColor,
    fontFamily: updates.stakeholderFontFamily,
    fontSize: updates.stakeholderFontSize,
    requirementsBrandColor: updates.stakeholderRequirementsBrandColor,
    requirementsTextColor: updates.stakeholderRequirementsTextColor,
    requirementsBgColor: updates.stakeholderRequirementsBgColor,
    requirementsFontFamily: updates.stakeholderRequirementsFontFamily,
    requirementsFontSize: updates.stakeholderRequirementsFontSize,
    footerBrandColor: updates.stakeholderFooterBrandColor,
    footerTextColor: updates.stakeholderFooterTextColor,
    footerBgColor: updates.stakeholderFooterBgColor,
    footerFontFamily: updates.stakeholderFooterFontFamily,
    footerFontSize: updates.stakeholderFooterFontSize,
    isRtl: updates.stakeholderEmailRtl,
  }, updates.stakeholderCcList ? { cc_list: updates.stakeholderCcList } : undefined);

  await upsertEmailTemplate('stakeholder', 'ar', {
    subject: updates.stakeholderSubjectAr,
    body: updates.stakeholderBodyAr,
    greeting: updates.stakeholderGreetingAr,
    footer: updates.stakeholderFooterAr,
    requirementsTitle: updates.stakeholderRequirementsTitleAr,
    isRtl: updates.stakeholderEmailRtl,
  });

  await upsertEmailTemplate('reminder', 'en', {
    subject: updates.reminderSubject,
    body: updates.reminderBody,
    greeting: updates.reminderGreeting,
    footer: updates.reminderFooter,
    requirementsTitle: updates.reminderRequirementsTitle,
    requirementItemTemplate: updates.reminderRequirementItemTemplate,
    brandColor: updates.reminderBrandColor,
    textColor: updates.reminderTextColor,
    bgColor: updates.reminderBgColor,
    fontFamily: updates.reminderFontFamily,
    fontSize: updates.reminderFontSize,
    requirementsBrandColor: updates.reminderRequirementsBrandColor,
    requirementsTextColor: updates.reminderRequirementsTextColor,
    requirementsBgColor: updates.reminderRequirementsBgColor,
    requirementsFontFamily: updates.reminderRequirementsFontFamily,
    requirementsFontSize: updates.reminderRequirementsFontSize,
    footerBrandColor: updates.reminderFooterBrandColor,
    footerTextColor: updates.reminderFooterTextColor,
    footerBgColor: updates.reminderFooterBgColor,
    footerFontFamily: updates.reminderFooterFontFamily,
    footerFontSize: updates.reminderFooterFontSize,
    isRtl: updates.reminderEmailRtl,
  }, updates.reminderCcList ? { cc_list: updates.reminderCcList } : undefined);

  await upsertEmailTemplate('reminder', 'ar', {
    subject: updates.reminderSubjectAr,
    body: updates.reminderBodyAr,
    greeting: updates.reminderGreetingAr,
    footer: updates.reminderFooterAr,
    requirementsTitle: updates.reminderRequirementsTitleAr,
    isRtl: updates.reminderEmailRtl,
  });

  await upsertEmailTemplate('management_summary', 'en', {
    subject: updates.managementSummarySubjectTemplate,
    body: updates.managementSummaryBody,
    greeting: updates.managementSummaryGreeting,
    footer: updates.managementSummaryFooter,
    requirementsTitle: updates.managementSummaryRequirementsTitle,
    requirementItemTemplate: updates.managementSummaryRequirementItemTemplate,
    brandColor: updates.managementSummaryBrandColor,
    textColor: updates.managementSummaryTextColor,
    bgColor: updates.managementSummaryBgColor,
    fontFamily: updates.managementSummaryFontFamily,
    fontSize: updates.managementSummaryFontSize,
    requirementsBrandColor: updates.managementSummaryRequirementsBrandColor,
    requirementsTextColor: updates.managementSummaryRequirementsTextColor,
    requirementsBgColor: updates.managementSummaryRequirementsBgColor,
    requirementsFontFamily: updates.managementSummaryRequirementsFontFamily,
    requirementsFontSize: updates.managementSummaryRequirementsFontSize,
    footerBrandColor: updates.managementSummaryFooterBrandColor,
    footerTextColor: updates.managementSummaryFooterTextColor,
    footerBgColor: updates.managementSummaryFooterBgColor,
    footerFontFamily: updates.managementSummaryFooterFontFamily,
    footerFontSize: updates.managementSummaryFooterFontSize,
    isRtl: updates.managementSummaryEmailRtl,
  }, {
    ...(updates.managementSummaryRecipients !== undefined ? { recipients: updates.managementSummaryRecipients } : {}),
    ...(updates.managementSummaryCcList !== undefined ? { cc_list: updates.managementSummaryCcList } : {}),
    ...(updates.managementSummaryStakeholderTemplate !== undefined ? { stakeholder_template: updates.managementSummaryStakeholderTemplate } : {}),
    ...(updates.managementSummaryStakeholderSeparator !== undefined ? { stakeholder_separator: updates.managementSummaryStakeholderSeparator } : {}),
    ...(updates.managementSummaryEnabled !== undefined ? { enabled: updates.managementSummaryEnabled } : {}),
  });

  await upsertEmailTemplate('management_summary', 'ar', {
    subject: updates.managementSummarySubjectAr,
    body: updates.managementSummaryBodyAr,
    greeting: updates.managementSummaryGreetingAr,
    footer: updates.managementSummaryFooterAr,
    requirementsTitle: updates.managementSummaryRequirementsTitleAr,
    isRtl: updates.managementSummaryEmailRtl,
  });

  await upsertEmailTemplate('task_completion', 'en', {
    subject: updates.taskCompletionSubject,
    body: updates.taskCompletionBody,
    footer: updates.taskCompletionFooter,
    brandColor: updates.taskCompletionBrandColor,
    textColor: updates.taskCompletionTextColor,
    bgColor: updates.taskCompletionBgColor,
    fontFamily: updates.taskCompletionFontFamily,
    fontSize: updates.taskCompletionFontSize,
    footerBrandColor: updates.taskCompletionFooterBrandColor,
    footerTextColor: updates.taskCompletionFooterTextColor,
    footerBgColor: updates.taskCompletionFooterBgColor,
    footerFontFamily: updates.taskCompletionFooterFontFamily,
    footerFontSize: updates.taskCompletionFooterFontSize,
    isRtl: updates.taskCompletionEmailRtl,
  });

  await upsertEmailTemplate('task_completion', 'ar', {
    subject: updates.taskCompletionSubjectAr,
    body: updates.taskCompletionBodyAr,
    footer: updates.taskCompletionFooterAr,
    isRtl: updates.taskCompletionEmailRtl,
  });

  await upsertEmailTemplate('updates', 'en', {
    body: updates.updatesEmailTemplate,
    brandColor: updates.updatesBrandColor,
    textColor: updates.updatesTextColor,
    bgColor: updates.updatesBgColor,
    fontFamily: updates.updatesFontFamily,
    fontSize: updates.updatesFontSize,
  });

  await upsertEmailTemplate('updates', 'ar', {
    body: updates.updatesEmailTemplateAr,
    brandColor: updates.updatesBrandColor,
    textColor: updates.updatesTextColor,
    bgColor: updates.updatesBgColor,
    fontFamily: updates.updatesFontFamily,
    fontSize: updates.updatesFontSize,
  });

  // WhatsApp templates
  await upsertWhatsappTemplate('event_created', 'en', updates.whatsappEventCreatedTemplateEn);
  await upsertWhatsappTemplate('event_created', 'ar', updates.whatsappEventCreatedTemplateAr);
  await upsertWhatsappTemplate('reminder', 'en', updates.whatsappReminderTemplateEn);
  await upsertWhatsappTemplate('reminder', 'ar', updates.whatsappReminderTemplateAr);
  await upsertWhatsappTemplate('updates_digest', 'en', updates.whatsappUpdatesTemplateEn);
  await upsertWhatsappTemplate('updates_digest', 'ar', updates.whatsappUpdatesTemplateAr);

  return buildSettingsPayload();
}
