import { db } from "./db";
import { whatsappConfig, whatsappTemplates, eventDepartments, departments, type Event } from "@shared/schema";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { eq, and } from "drizzle-orm";

interface WhatsAppAttachmentPayload {
  filename: string;
  mimetype: string;
  content: string;
}

/**
 * WhatsApp Message Formatter
 * 
 * Formats messages for WhatsApp based on templates defined in the new whatsapp_config and whatsapp_templates tables.
 * Handles both English and Arabic templates with variable substitution.
 */

interface TemplateVariables {
  eventName: string;
  eventNameAr?: string;
  location: string;
  locationAr?: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  description: string;
  descriptionAr?: string;
  organizers?: string;
  organizersAr?: string;
  url?: string;
  category?: string;
  stakeholders?: string;
  stakeholdersAr?: string;
  [key: string]: string | undefined;
}

/**
 * Get WhatsApp configuration from database
 */
async function getWhatsAppConfig() {
  const [config] = await db.select().from(whatsappConfig).limit(1);
  return config;
}

/**
 * Get WhatsApp template from database
 */
async function getWhatsAppTemplate(type: string, language: 'en' | 'ar') {
  const [template] = await db
    .select()
    .from(whatsappTemplates)
    .where(
      and(
        eq(whatsappTemplates.type, type),
        eq(whatsappTemplates.language, language)
      )
    )
    .limit(1);
  return template;
}

/**
 * Replace template variables in a string
 */
function replaceVariables(template: string, variables: TemplateVariables, language: 'en' | 'ar'): string {
  let result = template;
  
  // Map variables based on language
  const varMap: Record<string, string> = {
    eventName: language === 'ar' && variables.eventNameAr ? variables.eventNameAr : variables.eventName,
    location: language === 'ar' && variables.locationAr ? variables.locationAr : variables.location,
    description: language === 'ar' && variables.descriptionAr ? variables.descriptionAr : variables.description,
    organizers: language === 'ar' && variables.organizersAr ? variables.organizersAr : (variables.organizers || ''),
    stakeholders: language === 'ar' && variables.stakeholdersAr ? variables.stakeholdersAr : (variables.stakeholders || ''),
    startDate: variables.startDate,
    endDate: variables.endDate,
    startTime: variables.startTime || '',
    endTime: variables.endTime || '',
    url: variables.url || '',
    category: variables.category || '',
  };
  
  // Replace all {{variable}} patterns
  for (const [key, value] of Object.entries(varMap)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  }
  
  // Clean up any empty lines caused by missing optional variables
  result = result.replace(/\n\n+/g, '\n\n').trim();
  
  return result;
}

/**
 * Fetch and format stakeholders assigned to an event
 */
async function getEventStakeholders(eventId: string): Promise<{ en: string; ar: string }> {
  try {
    // Fetch event departments with department details
    const eventDepartmentsList = await db
      .select({
        department: departments,
      })
      .from(eventDepartments)
      .innerJoin(departments, eq(eventDepartments.departmentId, departments.id))
      .where(eq(eventDepartments.eventId, eventId));
    
    if (eventDepartmentsList.length === 0) {
      return { en: '', ar: '' };
    }
    
    // Format department names
    const enNames = eventDepartmentsList
      .map((es) => `• ${es.department.name}`)
      .join('\n');
    
    const arNames = eventDepartmentsList
      .map((es) => `• ${es.department.nameAr || es.department.name}`)
      .join('\n');
    
    return {
      en: enNames,
      ar: arNames,
    };
  } catch (error) {
    console.error('[WhatsApp Formatter] Error fetching stakeholders:', error);
    return { en: '', ar: '' };
  }
}

/**
 * Convert Event object to template variables
 */
async function eventToVariables(event: Event, language: 'en' | 'ar'): Promise<TemplateVariables> {
  // Format dates
  let startDateStr = event.startDate;
  let endDateStr = event.endDate;
  
  try {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const dateLocale = language === 'ar' ? ar : enUS;
    const dateFormat = language === 'ar' ? 'd MMMM yyyy' : 'MMMM d, yyyy';
    
    // Format: "January 15, 2025"
    startDateStr = format(startDate, dateFormat, { locale: dateLocale });
    endDateStr = format(endDate, dateFormat, { locale: dateLocale });
    
    // If same date, just show once
    if (event.startDate === event.endDate) {
      endDateStr = startDateStr;
    }
  } catch (error) {
    // Keep original string if date parsing fails
    console.warn('[WhatsApp Formatter] Date parsing failed:', error);
  }
  
  // Build time string if available
  let timeStr = '';
  if (event.startTime) {
    timeStr = event.startTime;
    if (event.endTime) {
      timeStr += ` - ${event.endTime}`;
    }
  }
  
  // Fetch stakeholders
  const stakeholdersList = await getEventStakeholders(event.id);
  
  return {
    eventName: event.name,
    eventNameAr: event.nameAr || undefined,
    location: event.location || 'TBD',
    locationAr: event.locationAr || undefined,
    startDate: startDateStr,
    endDate: endDateStr,
    startTime: timeStr,
    endTime: event.endTime || undefined,
    description: event.description || '',
    descriptionAr: event.descriptionAr || undefined,
    organizers: event.organizers || undefined,
    organizersAr: event.organizersAr || undefined,
    url: event.url || undefined,
    category: event.category || undefined,
    stakeholders: stakeholdersList.en || undefined,
    stakeholdersAr: stakeholdersList.ar || undefined,
  };
}

/**
 * Format an event created notification message
 */
export async function formatEventCreatedMessage(event: Event): Promise<{ message: string; language: 'en' | 'ar' }> {
  const config = await getWhatsAppConfig();
  
  if (!config) {
    throw new Error('WhatsApp configuration not found');
  }
  
  const language = (config.language as 'en' | 'ar') || 'en';
  const template = await getWhatsAppTemplate('event_created', language);
  
  if (!template || !template.template) {
    throw new Error(`WhatsApp event created template not found for language: ${language}`);
  }
  
  const variables = await eventToVariables(event, language);
  const message = replaceVariables(template.template, variables, language);
  
  return { message, language };
}

/**
 * Format an event reminder message
 */
export async function formatEventReminderMessage(event: Event): Promise<{ message: string; language: 'en' | 'ar' }> {
  const config = await getWhatsAppConfig();
  
  if (!config) {
    throw new Error('WhatsApp configuration not found');
  }
  
  const language = (config.language as 'en' | 'ar') || 'en';
  const template = await getWhatsAppTemplate('reminder', language);
  
  if (!template || !template.template) {
    throw new Error(`WhatsApp reminder template not found for language: ${language}`);
  }
  
  const variables = await eventToVariables(event, language);
  const message = replaceVariables(template.template, variables, language);
  
  return { message, language };
}

/**
 * Generate a test WhatsApp message using the current event-created template
 */
export async function formatTestWhatsAppMessage(): Promise<{ message: string; language: 'en' | 'ar' }> {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const formatDate = (date: Date) => {
    return date.toISOString().slice(0, 10);
  };

  const sampleEvent: Event = {
    id: 'test-event-preview',
    name: 'ECSSR Sample Event',
    nameAr: 'فعالية تجريبية',
    description: 'This is a preview generated to validate your WhatsApp template configuration.',
    descriptionAr: 'هذه رسالة تجريبية للتأكد من إعداد قالب الواتساب.',
    startDate: formatDate(today),
    endDate: formatDate(tomorrow),
    startTime: '09:00',
    endTime: '11:00',
    location: 'ECSSR Conference Hall',
    locationAr: 'قاعة مؤتمرات مركز الإمارات',
    organizers: 'ECSSR Events Team',
    organizersAr: 'فريق فعاليات مركز الإمارات',
    url: 'https://ecssr.ae/events/sample',
    category: 'Internal',
    categoryAr: 'داخلي',
    categoryId: null,
    eventType: 'internal',
    eventScope: 'internal',
    expectedAttendance: 25,
    isScraped: false,
    source: 'manual',
    externalId: null,
    adminModified: false,
    reminder1Week: true,
    reminder1Day: true,
    reminderWeekly: false,
    reminderDaily: false,
    reminderMorningOf: false,
    isArchived: false,
    archivedAt: null,
    agendaEnFileName: null,
    agendaEnStoredFileName: null,
    agendaArFileName: null,
    agendaArStoredFileName: null,
  };

  try {
    return await formatEventCreatedMessage(sampleEvent);
  } catch (error) {
    console.warn('[WhatsApp Formatter] Falling back to default test message:', error);
    const config = await getWhatsAppConfig();
    const language = (config?.language as 'en' | 'ar') || 'en';
    const fallback = language === 'ar'
      ? '🔔 رسالة اختبار من نظام فعاليات المركز'
      : '🔔 Test notification from ECSSR Events Calendar';
    return { message: fallback, language };
  }
}

/**
 * Send a formatted message via WhatsApp service
 */
export async function sendWhatsAppMessage(
  message: string,
  groupName?: string,
  attachment?: WhatsAppAttachmentPayload,
): Promise<void> {
  const config = await getWhatsAppConfig();
  
  if (!config || !config.enabled) {
    console.log('[WhatsApp] WhatsApp notifications are disabled');
    return;
  }
  
  const whatsappServiceUrl = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3001';
  const authPhrase = process.env.WHATSAPP_AUTH_PHRASE || '';
  
  if (!authPhrase) {
    throw new Error('WHATSAPP_AUTH_PHRASE environment variable not set');
  }
  
  // Use provided group name or fall back to config
  const targetGroup = groupName || config.chatName || undefined;
  
  try {
    const response = await fetch(`${whatsappServiceUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        groupName: targetGroup,
        authPhrase,
        attachment,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp service error: ${error.error || response.statusText}`);
    }
    
    const result = await response.json();
    console.log('[WhatsApp] Message sent successfully:', result);
  } catch (error) {
    console.error('[WhatsApp] Failed to send message:', error);
    throw error;
  }
}

/**
 * Send event created notification
 */
export async function sendEventCreatedNotification(event: Event, groupName?: string): Promise<void> {
  const { message } = await formatEventCreatedMessage(event);
  await sendWhatsAppMessage(message, groupName);
}

/**
 * Send event reminder notification
 */
export async function sendEventReminderNotification(event: Event, groupName?: string): Promise<void> {
  const { message } = await formatEventReminderMessage(event);
  await sendWhatsAppMessage(message, groupName);
}
