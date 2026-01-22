/**
 * Routes Shared Utilities
 *
 * Common middleware, helper functions, and types shared across route modules.
 *
 * @module routes/utils
 */

import type { RequestHandler, Response } from "express";
import { storage } from "../storage";
import type { Event } from "@shared/schema";
import { deleteAgendaFile } from '../fileUpload';
import { startOfDay, startOfWeek, endOfWeek } from 'date-fns';

// ==================== Role Checks ====================

/**
 * Check if the user has a department-scoped role (department or department_admin)
 */
export const isDepartmentScopedRole = (role?: string) =>
  role === 'department' || role === 'department_admin';

/**
 * Check if the user has a department or stakeholder role
 */
export const isDepartmentOrStakeholderRole = (role?: string) =>
  isDepartmentScopedRole(role) || role === 'stakeholder';

/**
 * Check if the user has an admin role (admin or superadmin)
 */
export const isAdminRole = (role?: string) =>
  role === 'admin' || role === 'superadmin';

// ==================== Middleware ====================

/**
 * Middleware to check if user can upload/download attendees
 * Allows admin/superadmin OR authorized stakeholder with permission
 */
export const canManageAttendees: RequestHandler = async (req, res, next) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Admins and superadmins always have access
  if (user.role === 'admin' || user.role === 'superadmin') {
    return next();
  }

  // Check if stakeholder has permission
  if (isDepartmentOrStakeholderRole(user.role)) {
    try {
      const settings = await storage.getSettings();

      // Check if global stakeholder upload is enabled
      if (!settings?.allowStakeholderAttendeeUpload) {
        return res.status(403).json({ error: 'Stakeholder attendee management is disabled' });
      }

      // Check if this specific stakeholder has permission
      const account = await storage.getDepartmentAccountByUserId(user.id);
      const stakeholderId = account?.departmentId?.toString();
      if (stakeholderId && settings.stakeholderUploadPermissions) {
        const permissions = settings.stakeholderUploadPermissions as Record<string, boolean>;
        if (permissions[stakeholderId] === true) {
          return next();
        }
      }

      return res.status(403).json({ error: 'You do not have permission to manage attendees' });
    } catch (error) {
      console.error('[Auth] Error checking stakeholder permissions:', error);
      return res.status(500).json({ error: 'Failed to check permissions' });
    }
  }

  return res.status(403).json({ error: 'Insufficient permissions' });
};

// ==================== Types ====================

/**
 * Type for agenda file uploads
 */
export type AgendaFiles = {
  agendaEn?: Express.Multer.File[];
  agendaAr?: Express.Multer.File[];
  photos?: Express.Multer.File[];
};

// ==================== Helper Functions ====================

/**
 * Parse a boolean field from form data
 */
export const parseBooleanField = (value: unknown, defaultValue?: boolean) => {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value === 'true' || value === '1';
  }
  return defaultValue;
};

/**
 * Normalize an optional string field (convert empty strings to undefined)
 */
export const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== 'string') return value as string | undefined;
  return value.trim() === '' ? undefined : value;
};

/**
 * Normalize event payload for creation/update
 */
export const normalizeEventPayload = (
  eventData: any,
  agendaFiles: AgendaFiles,
  defaults?: Partial<Event>
) => {
  const agendaEnFile = agendaFiles.agendaEn?.[0];
  const agendaArFile = agendaFiles.agendaAr?.[0];

  const normalizedPayload: Record<string, any> = {
    ...eventData,
    startTime: normalizeOptionalString(eventData.startTime),
    endTime: normalizeOptionalString(eventData.endTime),
    location: normalizeOptionalString(eventData.location),
    locationAr: normalizeOptionalString(eventData.locationAr),
    organizers: normalizeOptionalString(eventData.organizers),
    organizersAr: normalizeOptionalString(eventData.organizersAr),
    url: normalizeOptionalString(eventData.url),
    categoryId: eventData.categoryId ? Number(eventData.categoryId) : undefined,
    expectedAttendance: eventData.expectedAttendance ? Number(eventData.expectedAttendance) : undefined,
    reminder1Week: parseBooleanField(eventData.reminder1Week, defaults?.reminder1Week),
    reminder1Day: parseBooleanField(eventData.reminder1Day, defaults?.reminder1Day),
    reminderWeekly: parseBooleanField(eventData.reminderWeekly, defaults?.reminderWeekly),
    reminderDaily: parseBooleanField(eventData.reminderDaily, defaults?.reminderDaily),
    reminderMorningOf: parseBooleanField(eventData.reminderMorningOf, defaults?.reminderMorningOf),
  };

  // Only include agenda fields when new files are provided to avoid clearing existing filenames
  if (agendaEnFile) {
    normalizedPayload.agendaEnFileName = agendaEnFile.originalname;
    normalizedPayload.agendaEnStoredFileName = agendaEnFile.filename;
  }
  if (agendaArFile) {
    normalizedPayload.agendaArFileName = agendaArFile.originalname;
    normalizedPayload.agendaArStoredFileName = agendaArFile.filename;
  }

  return normalizedPayload;
};

/**
 * Clean up uploaded agenda files
 */
export const cleanupAgendaFiles = (agendaFiles: AgendaFiles) => {
  agendaFiles.agendaEn?.forEach(file => deleteAgendaFile(file.filename));
  agendaFiles.agendaAr?.forEach(file => deleteAgendaFile(file.filename));
};

/**
 * Clean up agenda files by filename
 */
export const cleanupAgendaFilesByName = (fileNames: string[]) => {
  fileNames.forEach(fileName => deleteAgendaFile(fileName));
};

/**
 * Generate reminder schedule based on event preferences
 */
export function generateReminderSchedule(event: Event): Array<{ scheduledFor: string; type: string }> {
  const reminders: Array<{ scheduledFor: string; type: string }> = [];
  const eventDate = new Date(event.startDate);
  const now = new Date(); // Current moment for comparison

  // Track timestamps already queued (to prevent duplicates)
  const queuedTimestamps = new Set<number>();

  // 1 week before (if enabled)
  if (event.reminder1Week) {
    const oneWeekBefore = new Date(eventDate);
    oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);
    oneWeekBefore.setHours(4, 0, 0, 0); // 8:00 AM GST = 4:00 AM UTC
    oneWeekBefore.setMinutes(0);
    oneWeekBefore.setSeconds(0);
    oneWeekBefore.setMilliseconds(0);
    if (oneWeekBefore.getTime() > now.getTime()) {
      reminders.push({
        scheduledFor: oneWeekBefore.toISOString(),
        type: "1_week"
      });
      queuedTimestamps.add(oneWeekBefore.getTime()); // Track this timestamp
    }
  }

  // 1 day before (if enabled)
  if (event.reminder1Day) {
    const oneDayBefore = new Date(eventDate);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    oneDayBefore.setHours(4, 0, 0, 0); // 8:00 AM GST = 4:00 AM UTC
    oneDayBefore.setMinutes(0);
    oneDayBefore.setSeconds(0);
    oneDayBefore.setMilliseconds(0);
    if (oneDayBefore.getTime() > now.getTime()) {
      reminders.push({
        scheduledFor: oneDayBefore.toISOString(),
        type: "1_day"
      });
      queuedTimestamps.add(oneDayBefore.getTime()); // Track this timestamp
    }
  }

  // Weekly reminders (every Monday at 8 AM GST until event week)
  if (event.reminderWeekly) {
    let current = new Date();
    current.setHours(4, 0, 0, 0); // 8:00 AM GST = 4:00 AM UTC
    current.setMinutes(0);
    current.setSeconds(0);
    current.setMilliseconds(0);

    const isMonday = current.getDay() === 1;
    const isFutureTime = current.getTime() > now.getTime();

    // Only keep current Monday if it's Monday AND the 8 AM time is still in the future
    if (!(isMonday && isFutureTime)) {
      // Find next Monday
      const daysUntilMonday = (1 - current.getDay() + 7) % 7 || 7;
      current.setDate(current.getDate() + daysUntilMonday);
    }

    // Calculate the exact 1-week reminder timestamp if enabled
    let oneWeekReminderTimestamp: number | null = null;
    if (event.reminder1Week) {
      const oneWeekBefore = new Date(eventDate);
      oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);
      oneWeekBefore.setHours(4, 0, 0, 0); // 8:00 AM GST
      oneWeekBefore.setMinutes(0);
      oneWeekBefore.setSeconds(0);
      oneWeekBefore.setMilliseconds(0);

      if (oneWeekBefore.getTime() > now.getTime()) {
        oneWeekReminderTimestamp = oneWeekBefore.getTime();
      }
    }

    while (current.getTime() < eventDate.getTime()) {
      // Skip only if this Monday exactly matches the 1-week reminder timestamp
      const isDuplicateWith1Week = (oneWeekReminderTimestamp !== null) &&
        (current.getTime() === oneWeekReminderTimestamp);

      if (!isDuplicateWith1Week) {
        reminders.push({
          scheduledFor: current.toISOString(),
          type: "weekly"
        });
        queuedTimestamps.add(current.getTime()); // Track this timestamp
      }
      current.setDate(current.getDate() + 7); // Next Monday
    }
  }

  // Daily reminders (every day at 8 AM GST for last 7 days before event, avoiding overlap)
  if (event.reminderDaily) {
    const sevenDaysBefore = new Date(eventDate);
    sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
    sevenDaysBefore.setHours(4, 0, 0, 0); // 8:00 AM GST = 4:00 AM UTC
    sevenDaysBefore.setMinutes(0);
    sevenDaysBefore.setSeconds(0);
    sevenDaysBefore.setMilliseconds(0);

    // Start from today at 8:00 AM if that time is still in the future, otherwise tomorrow
    let startDate = new Date(now);
    startDate.setHours(4, 0, 0, 0); // 8:00 AM GST
    startDate.setMinutes(0);
    startDate.setSeconds(0);
    startDate.setMilliseconds(0);

    // If today's 8:00 AM has already passed, move to tomorrow
    if (startDate.getTime() <= now.getTime()) {
      startDate.setDate(startDate.getDate() + 1);
    }

    // Start from the later of: 7 days before event OR today/tomorrow at 8:00 AM
    let current = new Date(Math.max(sevenDaysBefore.getTime(), startDate.getTime()));

    // Only loop up to 2 days before event (to avoid overlap with 1_day and morning_of)
    const twoDaysBefore = new Date(eventDate);
    twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);
    twoDaysBefore.setHours(4, 0, 0, 0); // 8:00 AM GST = 4:00 AM UTC
    twoDaysBefore.setMinutes(0);
    twoDaysBefore.setSeconds(0);
    twoDaysBefore.setMilliseconds(0);

    while (current.getTime() <= twoDaysBefore.getTime() && current.getTime() < eventDate.getTime()) {
      // Skip if this timestamp was already queued by another reminder type
      if (!queuedTimestamps.has(current.getTime())) {
        reminders.push({
          scheduledFor: current.toISOString(),
          type: "daily"
        });
        queuedTimestamps.add(current.getTime()); // Track this timestamp
      }
      current.setDate(current.getDate() + 1);
    }
  }

  // Morning of event
  if (event.reminderMorningOf) {
    const morningOf = new Date(eventDate);
    morningOf.setHours(4, 0, 0, 0); // 8:00 AM GST = 4:00 AM UTC
    morningOf.setMinutes(0);
    morningOf.setSeconds(0);
    morningOf.setMilliseconds(0);
    if (morningOf.getTime() > now.getTime()) {
      // Check if not already queued (unlikely but good practice)
      if (!queuedTimestamps.has(morningOf.getTime())) {
        reminders.push({
          scheduledFor: morningOf.toISOString(),
          type: "morning_of"
        });
      }
    }
  }

  return reminders;
}

/**
 * Resolve date range for updates (day or week)
 */
export function resolveRange(referenceDate?: string, range: 'day' | 'week' = 'day') {
  const refDate = referenceDate ? new Date(`${referenceDate}T00:00:00.000Z`) : new Date();
  const start = startOfDay(refDate);
  if (range === 'day') {
    return { start, end: start };
  }

  const weekStart = startOfWeek(start, { weekStartsOn: 1 });
  return { start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) };
}

/**
 * Get all email addresses for a department
 * Combines:
 * 1. Department emails from department_emails table
 * 2. User emails from Keycloak-synced users in department_accounts table
 */
export async function getDepartmentEmails(departmentId: number): Promise<string[]> {
  const department = await storage.getDepartment(departmentId);
  if (!department) {
    return [];
  }

  const emailSet = new Set<string>();

  // Add emails from department_emails table
  department.emails.forEach(e => {
    if (e.email) emailSet.add(e.email);
  });

  // Add emails from Keycloak-synced users
  const users = await storage.getUsersByDepartmentName(department.name);
  users.forEach(user => {
    if (user.email) emailSet.add(user.email);
  });

  return Array.from(emailSet);
}

/**
 * Helper to ensure archive feature is enabled
 */
export async function ensureArchiveEnabled(res: Response): Promise<boolean> {
  const settings = await storage.getSettings();
  if (!settings.archiveEnabled) {
    res.status(403).json({ error: "Archive feature is disabled" });
    return false;
  }
  return true;
}
