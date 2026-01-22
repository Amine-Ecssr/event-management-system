/**
 * Integration Routes
 *
 * API endpoints for external integrations and background services:
 * - Scraper service (web scraping)
 * - Reminder queue management
 * - Invitation email batch processing
 * - Weekly/Monthly updates
 *
 * @module routes/integration
 */

import { Router } from "express";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { storage } from "../storage";
import { isAuthenticated, isAdminOrSuperAdmin, isSuperAdmin } from "../auth";
import { emailService } from "../email";
import { calculateReminderTime, type ReminderType } from "../reminderScheduler";
import {
  buildUpdateSections,
  formatUpdatePeriodLabel,
  formatUpdatesWhatsappMessage,
} from "../updates-formatter";
import { getWhatsappTemplate } from "../services/configService";
import { isDepartmentScopedRole } from "./utils";

const router = Router();

// ==================== Scraper Routes ====================

/**
 * Scrape Abu Dhabi events
 * @route POST /api/scraper/abu-dhabi
 * @access SuperAdmin only
 */
router.post("/api/scraper/abu-dhabi", isSuperAdmin, async (req, res) => {
  try {
    const { scraperService } = await import("../services/scraperService");
    console.log("[API] Manual Abu Dhabi scraping triggered by admin");
    const result = await scraperService.scrapeAbuDhabiEvents({
      startFromJanuary: true,
    });
    res.json(result);
  } catch (error) {
    console.error("[API] Abu Dhabi scraping failed:", error);
    res.status(500).json({ error: "Failed to scrape Abu Dhabi events" });
  }
});

/**
 * Scrape ADNEC events
 * @route POST /api/scraper/adnec
 * @access SuperAdmin only
 */
router.post("/api/scraper/adnec", isSuperAdmin, async (req, res) => {
  try {
    const { scraperService } = await import("../services/scraperService");
    console.log("[API] Manual ADNEC scraping triggered by admin");
    const result = await scraperService.scrapeAdnecEvents();
    res.json(result);
  } catch (error) {
    console.error("[API] ADNEC scraping failed:", error);
    res.status(500).json({ error: "Failed to scrape ADNEC events" });
  }
});

/**
 * Scrape all event sources
 * @route POST /api/scraper/all
 * @access SuperAdmin only
 */
router.post("/api/scraper/all", isSuperAdmin, async (req, res) => {
  try {
    const { scraperService } = await import("../services/scraperService");
    console.log("[API] Manual scraping of all sources triggered by admin");
    const result = await scraperService.scrapeAllSources({
      startFromJanuary: true,
    });
    res.json(result);
  } catch (error) {
    console.error("[API] Scraping all sources failed:", error);
    res.status(500).json({ error: "Failed to scrape events from all sources" });
  }
});

// ==================== Reminder Routes ====================

/**
 * Get all reminders with event details
 * @route GET /api/reminders
 * @access Admin/SuperAdmin only
 */
router.get("/api/reminders", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const reminders = await storage.getAllRemindersWithEvents();
    res.json(reminders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reminders" });
  }
});

/**
 * Create a new reminder
 * @route POST /api/reminders
 * @access Admin/SuperAdmin only
 */
router.post("/api/reminders", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const createReminderSchema = z.object({
      eventId: z.string(),
      reminderType: z.enum(["1_week", "1_day", "weekly", "daily", "morning_of"]),
    });

    const result = createReminderSchema.safeParse(req.body);
    if (!result.success) {
      console.error("Reminder validation error:", result.error.format());
      return res.status(400).json({
        error: fromError(result.error).toString(),
      });
    }

    const { eventId, reminderType } = result.data;

    // Validate that the event exists
    const event = await storage.getEvent(eventId);
    if (!event) {
      console.error(`[POST /api/reminders] Event ${eventId} not found`);
      return res.status(404).json({ error: "Event not found" });
    }

    // Calculate the scheduled time and ensure it is in the future
    let scheduledFor: Date;
    try {
      scheduledFor = calculateReminderTime(
        event.startDate,
        reminderType as ReminderType
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Invalid reminder schedule";
      console.warn(
        "[POST /api/reminders] Falling back to immediate scheduling:",
        errorMessage
      );
      scheduledFor = new Date();
      scheduledFor.setMinutes(scheduledFor.getMinutes() + 5);
    }

    // Create the reminder
    const reminder = await storage.enqueueReminder({
      eventId,
      reminderType,
      scheduledFor,
      status: "pending",
      attempts: 0,
    });

    res.status(201).json(reminder);
  } catch (error) {
    res.status(500).json({ error: "Failed to create reminder" });
  }
});

/**
 * Delete a reminder
 * @route DELETE /api/reminders/:id
 * @access Admin/SuperAdmin only
 */
router.delete("/api/reminders/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid reminder ID" });
    }

    // Get the reminder to check its status
    const reminder = await storage.getReminder(id);
    if (!reminder) {
      return res.status(404).json({ error: "Reminder not found" });
    }

    // Only allow deleting pending or error reminders
    if (reminder.status === "sent") {
      return res.status(400).json({
        error: "Cannot delete sent reminders (historical record)",
      });
    }

    const deleted = await storage.deleteReminder(id);
    if (!deleted) {
      return res.status(404).json({ error: "Reminder not found" });
    }

    res.json({ message: "Reminder deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete reminder" });
  }
});

/**
 * Resend a reminder immediately
 * @route POST /api/reminders/:id/resend
 * @access SuperAdmin only
 */
router.post("/api/reminders/:id/resend", isSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid reminder ID" });
    }

    const reminder = await storage.getReminder(id);
    if (!reminder) {
      return res.status(404).json({ error: "Reminder not found" });
    }

    const scheduledFor = new Date();
    const updated = await storage.resetReminderForResend(id, scheduledFor);

    if (!updated) {
      return res.status(500).json({ error: "Failed to queue reminder for resend" });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to resend reminder" });
  }
});

// ==================== Invitation Job Routes ====================

/**
 * Get single invitation job status
 * @route GET /api/invitation-jobs/:jobId
 * @access Admin/SuperAdmin only
 */
router.get(
  "/api/invitation-jobs/:jobId",
  isAdminOrSuperAdmin,
  async (req, res) => {
    try {
      const { invitationEmailService } = await import(
        "../invitationEmailService"
      );
      const jobId = parseInt(req.params.jobId);

      const job = await invitationEmailService.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      res.json({
        ...job,
        isRunning: invitationEmailService.isJobRunning(jobId),
      });
    } catch (error) {
      console.error("[Invitation Email] Failed to fetch job:", error);
      res.status(500).json({ error: "Failed to fetch job status" });
    }
  }
);

/**
 * Cancel invitation email job
 * @route POST /api/invitation-jobs/:jobId/cancel
 * @access Admin/SuperAdmin only
 */
router.post(
  "/api/invitation-jobs/:jobId/cancel",
  isAdminOrSuperAdmin,
  async (req, res) => {
    try {
      const { invitationEmailService } = await import(
        "../invitationEmailService"
      );
      const jobId = parseInt(req.params.jobId);

      const job = await invitationEmailService.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.status !== "pending" && job.status !== "in_progress") {
        return res
          .status(400)
          .json({ error: "Only pending or in-progress jobs can be cancelled" });
      }

      await invitationEmailService.cancelJob(jobId);
      res.json({ success: true, message: "Job cancelled successfully" });
    } catch (error) {
      console.error("[Invitation Email] Failed to cancel job:", error);
      res.status(500).json({ error: "Failed to cancel job" });
    }
  }
);

// ==================== Updates Routes (Weekly/Monthly) ====================

/**
 * Get latest update
 * @route GET /api/updates/latest
 * @access All authenticated users (scoped by role)
 */
router.get("/api/updates/latest", isAuthenticated, async (req, res) => {
  try {
    const { type } = req.query;
    if (!type || (type !== "weekly" && type !== "monthly")) {
      return res.status(400).json({ error: "Invalid type parameter" });
    }

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // If department user, get their department's update
    if (isDepartmentScopedRole(req.user.role)) {
      const account = await storage.getDepartmentAccountByUserId(req.user.id);
      if (!account) {
        return res.status(404).json({ error: "Department account not found" });
      }
      const update = await storage.getLatestUpdateForDepartment(
        type as "weekly" | "monthly",
        account.departmentId
      );
      return res.json(update || null);
    }

    // Admin/superadmin get global updates (departmentId = null)
    const update = await storage.getLatestUpdate(type as "weekly" | "monthly");
    res.json(update || null);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch latest update" });
  }
});

/**
 * Get all updates of a type
 * @route GET /api/updates
 * @access All authenticated users (scoped by role)
 */
router.get("/api/updates", isAuthenticated, async (req, res) => {
  try {
    const { type } = req.query;
    if (!type || (type !== "weekly" && type !== "monthly")) {
      return res.status(400).json({ error: "Invalid type parameter" });
    }

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(
      `[GET /api/updates] User: ${req.user.username}, Role: ${req.user.role}, Type: ${type}`
    );

    // If department user, get their department's updates only
    if (isDepartmentScopedRole(req.user.role)) {
      const account = await storage.getDepartmentAccountByUserId(req.user.id);
      if (!account) {
        return res.status(404).json({ error: "Department account not found" });
      }
      console.log(
        `[GET /api/updates] Department user - fetching updates for departmentId: ${account.departmentId}`
      );
      const updates = await storage.getAllUpdatesForDepartment(
        type as "weekly" | "monthly",
        account.departmentId
      );
      return res.json(updates);
    }

    // Admin/superadmin get all global updates (departmentId = null)
    console.log(`[GET /api/updates] Admin/superadmin - fetching global updates`);
    const allUpdates = await storage.getAllUpdates(type as "weekly" | "monthly");
    res.json(allUpdates);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch updates" });
  }
});

/**
 * Get all department updates for a specific period
 * @route GET /api/updates/all-departments/:type/:periodStart
 * @access SuperAdmin only
 */
router.get(
  "/api/updates/all-departments/:type/:periodStart",
  isSuperAdmin,
  async (req, res) => {
    try {
      const { type, periodStart } = req.params;
      console.log(
        `[GET /api/updates/all-departments/${type}/${periodStart}] Request received`
      );

      if (type !== "weekly" && type !== "monthly") {
        return res.status(400).json({ error: "Invalid type" });
      }

      const updates = await storage.getUpdatesForPeriodWithDepartments(
        type as "weekly" | "monthly",
        periodStart
      );
      console.log(
        `[GET /api/updates/all-departments/${type}/${periodStart}] Found ${updates.length} updates`
      );
      res.json(updates);
    } catch (error) {
      console.error("[Updates] Failed to fetch all department updates:", error);
      res.status(500).json({ error: "Failed to fetch updates" });
    }
  }
);

/**
 * Get specific update by type and period
 * @route GET /api/updates/:type/:periodStart
 * @access All authenticated users
 */
router.get(
  "/api/updates/:type/:periodStart",
  isAuthenticated,
  async (req, res) => {
    try {
      const { type, periodStart } = req.params;
      if (type !== "weekly" && type !== "monthly") {
        return res.status(400).json({ error: "Invalid type" });
      }

      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log(
        `[GET /api/updates/${type}/${periodStart}] User: ${req.user.username}, Role: ${req.user.role}`
      );

      // Department users get their department-specific update
      if (isDepartmentScopedRole(req.user.role)) {
        const account = await storage.getDepartmentAccountByUserId(req.user.id);
        if (!account) {
          return res.status(404).json({ error: "Department account not found" });
        }
        console.log(
          `[GET /api/updates/${type}/${periodStart}] Department user - fetching update for departmentId: ${account.departmentId}`
        );
        const update = await storage.getUpdateForDepartment(
          type as "weekly" | "monthly",
          periodStart,
          account.departmentId
        );
        return res.json(update || null);
      }

      // Admin/superadmin get global update (departmentId = null)
      console.log(
        `[GET /api/updates/${type}/${periodStart}] Admin/superadmin - fetching global update`
      );
      const update = await storage.getUpdate(
        type as "weekly" | "monthly",
        periodStart
      );
      res.json(update || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch update" });
    }
  }
);

/**
 * Create or update an update
 * @route POST /api/updates
 * @access All authenticated users
 */
router.post("/api/updates", isAuthenticated, async (req, res) => {
  try {
    const { insertUpdateSchema } = await import("@shared/schema");

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(
      `[POST /api/updates] User: ${req.user.username}, Role: ${req.user.role}`
    );

    let departmentId: number | null = null;

    // Department users automatically get their departmentId set
    if (isDepartmentScopedRole(req.user.role)) {
      const account = await storage.getDepartmentAccountByUserId(req.user.id);
      if (!account) {
        return res.status(404).json({ error: "Department account not found" });
      }
      departmentId = account.departmentId;
      console.log(
        `[POST /api/updates] Department user - saving update for departmentId: ${departmentId}`
      );
    }
    // Admin/superadmin can optionally specify departmentId or create global updates (null)
    else if (req.user.role === "admin" || req.user.role === "superadmin") {
      departmentId = req.body.departmentId || null;
      console.log(
        `[POST /api/updates] Admin/superadmin - saving ${
          departmentId ? `department-specific (${departmentId})` : "global"
        } update`
      );
    }

    const data = {
      ...req.body,
      departmentId,
      updatedByUserId: req.user?.id,
    };

    const result = insertUpdateSchema.safeParse(data);
    if (!result.success) {
      return res.status(400).json({
        error: fromError(result.error).toString(),
      });
    }

    const update = await storage.createOrUpdateUpdate(result.data);
    res.json(update);
  } catch (error) {
    res.status(500).json({ error: "Failed to save update" });
  }
});

/**
 * Compile and send updates for a selected period to email and WhatsApp
 * @route POST /api/updates/send
 * @access Admin/SuperAdmin only
 */
router.post("/api/updates/send", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const sendUpdatesSchema = z.object({
      type: z.enum(["weekly", "monthly"]),
      periodStart: z.string(),
      email: z.string().email(),
      language: z.enum(["en", "ar"]).optional(),
      templateHtml: z.string().optional(),
      whatsappGroupId: z.string().optional(),
      whatsappGroupName: z.string().optional(),
    });

    const parsed = sendUpdatesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: fromError(parsed.error).toString() });
    }

    const {
      type,
      periodStart,
      email,
      language: requestedLanguage,
      templateHtml,
      whatsappGroupId,
      whatsappGroupName,
    } = parsed.data;

    const settings = await storage.getSettings();
    const updates = await storage.getUpdatesForPeriodWithDepartments(
      type,
      periodStart
    );
    const language = (requestedLanguage ||
      settings.whatsappLanguage ||
      "en") as "en" | "ar";
    const { sections, usedFallback } = buildUpdateSections(updates, language);

    if (sections.length === 0) {
      return res
        .status(404)
        .json({ error: "No updates found for the selected period" });
    }

    const periodLabel = formatUpdatePeriodLabel(type, periodStart, language);

    const responsePayload: any = { periodLabel };

    // Send email digest
    try {
      await emailService.sendUpdatesDigest({
        type,
        periodStart,
        toEmail: email,
        settings,
        sections,
        language,
        customHtml: templateHtml,
        usedFallback,
      });
      responsePayload.email = {
        success: true,
        message: "Email sent successfully",
      };
    } catch (error: any) {
      responsePayload.email = {
        success: false,
        message: error?.message || "Failed to send email",
      };
    }

    // Send WhatsApp digest
    let whatsappResult = { success: false, message: "" };
    const targetGroupId =
      whatsappGroupId || settings.whatsappUpdatesChatId || undefined;
    const targetGroupName =
      whatsappGroupName || settings.whatsappUpdatesChatName || undefined;

    if (!settings.whatsappEnabled) {
      whatsappResult = {
        success: false,
        message: "WhatsApp notifications are disabled",
      };
    } else if (!targetGroupId && !targetGroupName) {
      whatsappResult = {
        success: false,
        message: "No WhatsApp group configured for updates",
      };
    } else {
      try {
        const { whatsappService } = await import("../whatsapp-client");
        const whatsappTemplateRecord = await getWhatsappTemplate(
          "updates_digest",
          language
        );
        const whatsappTemplate =
          whatsappTemplateRecord?.template?.trim() ||
          (language === "ar"
            ? settings.whatsappUpdatesTemplateAr
            : settings.whatsappUpdatesTemplateEn);
        const message = formatUpdatesWhatsappMessage({
          type,
          periodLabel,
          sections,
          language,
          template: whatsappTemplate,
        });
        const response = await whatsappService.sendMessage({
          message,
          groupId: targetGroupId,
          groupName: targetGroupName,
        });
        whatsappResult = { success: response.success, message: response.message };
      } catch (error: any) {
        whatsappResult = {
          success: false,
          message: error?.message || "Failed to send WhatsApp message",
        };
      }
    }

    responsePayload.whatsapp = whatsappResult;

    const emailSuccess = responsePayload.email?.success ?? false;
    const whatsappSuccess = whatsappResult.success;
    const success = emailSuccess || whatsappSuccess;
    const partialSuccess = success && !(emailSuccess && whatsappSuccess);
    const status = success ? (partialSuccess ? 207 : 200) : 500;

    res.status(status).json({ success, partialSuccess, ...responsePayload });
  } catch (error) {
    console.error("Failed to send updates digest:", error);
    res.status(500).json({ error: "Failed to send updates" });
  }
});

/**
 * Send current period update to department primary email
 * @route POST /api/updates/:type/:periodStart/send-primary
 * @access Department admins only
 */
router.post(
  "/api/updates/:type/:periodStart/send-primary",
  isAuthenticated,
  async (req, res) => {
    try {
      const { type, periodStart } = req.params;
      if (type !== "weekly" && type !== "monthly") {
        return res.status(400).json({ error: "Invalid type" });
      }

      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (req.user.role !== "department_admin") {
        return res.status(403).json({
          error: "Only department admins can send updates to the primary email",
        });
      }

      const account = await storage.getDepartmentAccountByUserId(req.user.id);
      if (!account) {
        return res.status(404).json({ error: "Department account not found" });
      }

      const department = await storage.getDepartment(account.departmentId);
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }

      const primaryEmailRecord =
        department.emails.find((e) => e.id === account.primaryEmailId) ||
        department.emails.find((e) => e.isPrimary) ||
        department.emails[0];

      if (!primaryEmailRecord?.email) {
        return res.status(400).json({
          error: "Primary email is not configured for this department",
        });
      }

      const update = await storage.getUpdateForDepartment(
        type as "weekly" | "monthly",
        periodStart,
        account.departmentId
      );
      if (!update) {
        return res.status(404).json({ error: "No update found for this period" });
      }

      const settings = await storage.getSettings();
      const language = (req.body.language || "en") as "en" | "ar";

      await emailService.sendDepartmentUpdateEmail({
        update,
        departmentName: department.name,
        toEmail: primaryEmailRecord.email,
        type: type as "weekly" | "monthly",
        periodStart,
        settings,
        language,
      });

      res.json({ message: "Update sent to primary email" });
    } catch (error) {
      console.error("[Updates] Failed to send update to primary email:", error);
      res.status(500).json({ error: "Failed to send update email" });
    }
  }
);

export default router;
