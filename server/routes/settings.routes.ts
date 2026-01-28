/**
 * Settings Routes
 *
 * API endpoints for application settings, email testing/preview,
 * WhatsApp testing, and sample data management.
 *
 * @module routes/settings
 */

import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated, isSuperAdmin, isAdminOrSuperAdmin } from "../auth";
import { emailService } from "../email";
import { fromError } from "zod-validation-error";
import { settingsUpdateSchema } from "../services/configService";
import { seedSampleData, resetSampleData } from "../scripts/seedSampleData";
import type { Event } from "@shared/schema.mssql";

const router = Router();

// ==================== Public Settings ====================

/**
 * GET /api/settings
 * Get public settings (only non-sensitive fields)
 */
router.get("/api/settings", async (req, res) => {
  try {
    const settings = await storage.getSettings();
    // Only return non-sensitive fields to public
    res.json({
      publicCsvExport: settings.publicCsvExport,
      archiveEnabled: settings.archiveEnabled,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// ==================== Admin Settings ====================

/**
 * GET /api/settings/admin
 * Get all settings including sensitive fields (superadmin only)
 */
router.get("/api/settings/admin", isSuperAdmin, async (req, res) => {
  try {
    const settings = await storage.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

/**
 * PATCH /api/settings
 * Update settings (superadmin only)
 */
router.patch("/api/settings", isSuperAdmin, async (req, res) => {
  try {
    const result = settingsUpdateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: fromError(result.error).toString()
      });
    }

    const settings = await storage.updateSettings(result.data);

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// ==================== Sample Data Management ====================

const sampleDataActionSchema = z.object({
  action: z.enum(["seed", "reset"]),
});

/**
 * POST /api/admin/sample-data
 * Seed or reset sample data (superadmin only)
 */
router.post("/api/admin/sample-data", isSuperAdmin, async (req, res) => {
  try {
    const { action } = sampleDataActionSchema.parse(req.body ?? {});

    if (action === "seed") {
      await seedSampleData();
      res.json({ message: "Sample data seeded" });
    } else {
      await resetSampleData();
      res.json({ message: "Sample data reset" });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: fromError(error).message });
      return;
    }

    console.error("Failed to process sample data:", error);
    res.status(500).json({ error: "Failed to process sample data" });
  }
});

// ==================== Test Email Endpoints ====================

/**
 * POST /api/settings/test-email/stakeholder
 * Send test stakeholder email (admin/superadmin only)
 */
router.post("/api/settings/test-email/stakeholder", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { recipientEmail } = req.body;
    if (!recipientEmail) {
      return res.status(400).json({ error: "recipientEmail is required" });
    }

    const settings = await storage.getSettings();
    
    if (!settings.emailEnabled) {
      return res.status(400).json({ error: "Email is not enabled in settings" });
    }

    // Create test event data
    const testEvent: Event = {
      id: "test-event-123",
      name: "Annual Technology Conference 2025",
      nameAr: null,
      description: "Major conference featuring AI and cloud computing talks with keynote speakers from industry leaders",
      descriptionAr: null,
      startDate: "2025-03-15",
      endDate: "2025-03-17",
      startTime: null,
      endTime: null,
      location: "Abu Dhabi Convention Center",
      locationAr: null,
      organizers: "IT Department, Research Division",
      organizersAr: null,
      category: "Conference",
      categoryAr: null,
      categoryId: null,
      eventType: "international",
      eventScope: "external",
      url: "https://ecssr.ae/events/tech-conference-2025",
      expectedAttendance: 500,
      agendaEnFileName: null,
      agendaEnStoredFileName: null,
      agendaArFileName: null,
      agendaArStoredFileName: null,
      externalId: null,
      isScraped: false,
      source: 'manual',
      adminModified: false,
      reminder1Week: true,
      reminder1Day: true,
      reminderWeekly: false,
      reminderDaily: false,
      reminderMorningOf: false,
      isArchived: false,
      archivedAt: null,
    };

    // Create test stakeholder with requirements
    const testStakeholder: any = {
      id: "stakeholder-1",
      name: "IT Infrastructure Department",
      emails: [],
      requirements: [],
      active: true,
    };

    const testRequirements = [
      { 
        id: "1", 
        title: "Network Setup", 
        description: "Configure high-speed WiFi for 500+ attendees across 3 conference halls" 
      },
      { 
        id: "2", 
        title: "Audio/Visual Equipment", 
        description: "Set up projectors, screens, and sound systems in main hall and breakout rooms" 
      },
      { 
        id: "3", 
        title: "Live Streaming Infrastructure", 
        description: "Ensure reliable streaming for remote participants with backup redundancy" 
      },
    ];

    const customRequirements = "Additional requirement: Provide technical support staff on-site for the duration of the event.";

    await emailService.sendStakeholderNotification(
      testEvent,
      testStakeholder,
      [recipientEmail],
      testRequirements as any, // Test data with minimal fields
      customRequirements,
      settings
    );

    res.json({ success: true, message: "Test stakeholder email sent successfully" });
  } catch (error: any) {
    console.error("Failed to send test stakeholder email:", error);
    res.status(500).json({ error: error.message || "Failed to send test email" });
  }
});

/**
 * POST /api/settings/test-email/reminder
 * Send test reminder email (admin/superadmin only)
 */
router.post("/api/settings/test-email/reminder", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { recipientEmail } = req.body;
    if (!recipientEmail) {
      return res.status(400).json({ error: "recipientEmail is required" });
    }

    const settings = await storage.getSettings();
    
    if (!settings.emailEnabled) {
      return res.status(400).json({ error: "Email is not enabled in settings" });
    }

    // Create test event data
    const testEvent: Event = {
      id: "test-event-456",
      name: "Annual Technology Conference 2025",
      nameAr: null,
      description: "Major conference featuring AI and cloud computing talks - Event starts in 7 days!",
      descriptionAr: null,
      startDate: "2025-03-15",
      endDate: "2025-03-17",
      startTime: null,
      endTime: null,
      location: "Abu Dhabi Convention Center",
      locationAr: null,
      organizers: "IT Department, Research Division",
      organizersAr: null,
      category: "Conference",
      categoryAr: null,
      categoryId: null,
      eventType: "international",
      eventScope: "external",
      url: "https://ecssr.ae/events/tech-conference-2025",
      expectedAttendance: 500,
      agendaEnFileName: null,
      agendaEnStoredFileName: null,
      agendaArFileName: null,
      agendaArStoredFileName: null,
      externalId: null,
      isScraped: false,
      source: 'manual',
      adminModified: false,
      reminder1Week: true,
      reminder1Day: true,
      reminderWeekly: false,
      reminderDaily: false,
      reminderMorningOf: false,
      isArchived: false,
      archivedAt: null,
    };

    // Use sendEventNotification for reminder test (with REMINDER: prefix)
    await emailService.sendEventNotification(
      testEvent,
      recipientEmail,
      settings,
      'REMINDER: '
    );

    res.json({ success: true, message: "Test reminder email sent successfully" });
  } catch (error: any) {
    console.error("Failed to send test reminder email:", error);
    res.status(500).json({ error: error.message || "Failed to send test email" });
  }
});

/**
 * POST /api/settings/test-email/management
 * Send test management summary email (admin/superadmin only)
 */
router.post("/api/settings/test-email/management", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { recipientEmail } = req.body;
    if (!recipientEmail) {
      return res.status(400).json({ error: "recipientEmail is required" });
    }

    const settings = await storage.getSettings();
    
    if (!settings.emailEnabled) {
      return res.status(400).json({ error: "Email is not enabled in settings" });
    }

    // Create test event data
    const testEvent: Event = {
      id: "test-event-789",
      name: "Annual Technology Conference 2025",
      nameAr: null,
      description: "Major conference featuring AI and cloud computing talks with international speakers and workshops",
      descriptionAr: null,
      startDate: "2025-03-15",
      endDate: "2025-03-17",
      startTime: null,
      endTime: null,
      location: "Abu Dhabi Convention Center",
      locationAr: null,
      organizers: "IT Department, Research Division",
      organizersAr: null,
      category: "Conference",
      categoryAr: null,
      categoryId: null,
      eventType: "international",
      eventScope: "external",
      url: "https://ecssr.ae/events/tech-conference-2025",
      expectedAttendance: 500,
      agendaEnFileName: null,
      agendaEnStoredFileName: null,
      agendaArFileName: null,
      agendaArStoredFileName: null,
      externalId: null,
      isScraped: false,
      source: 'manual',
      adminModified: false,
      reminder1Week: true,
      reminder1Day: true,
      reminderWeekly: false,
      reminderDaily: false,
      reminderMorningOf: false,
      isArchived: false,
      archivedAt: null,
    };

    // Create test stakeholder assignments
    const testAssignments = [
      {
        stakeholder: {
          id: "stakeholder-1",
          name: "IT Infrastructure Department",
          emails: ["it@ecssr.ae", "tech-support@ecssr.ae"],
          requirements: [],
          active: true,
        },
        selectedRequirements: [
          { 
            id: "1", 
            title: "Network Setup", 
            description: "Configure high-speed WiFi for 500+ attendees across 3 conference halls" 
          },
          { 
            id: "2", 
            title: "Audio/Visual Equipment", 
            description: "Set up projectors, screens, and sound systems in main hall and breakout rooms" 
          },
          { 
            id: "3", 
            title: "Live Streaming Infrastructure", 
            description: "Ensure reliable streaming for remote participants with backup redundancy" 
          },
        ],
        customRequirements: "Provide technical support staff on-site for the duration of the event",
        emails: ["it@ecssr.ae", "tech-support@ecssr.ae"],
      },
      {
        stakeholder: {
          id: "stakeholder-2",
          name: "Catering Services",
          emails: ["catering@ecssr.ae"],
          requirements: [],
          active: true,
        },
        selectedRequirements: [
          { 
            id: "4", 
            title: "Meal Planning", 
            description: "Prepare lunch and refreshments for 500 attendees (vegetarian and halal options required)" 
          },
          { 
            id: "5", 
            title: "VIP Reception", 
            description: "Arrange special dinner for keynote speakers and sponsors on Day 1" 
          },
        ],
        customRequirements: "Coordinate with dietary restrictions team for special meal requirements",
        emails: ["catering@ecssr.ae"],
      },
      {
        stakeholder: {
          id: "stakeholder-3",
          name: "Security and Access Control",
          emails: ["security@ecssr.ae"],
          requirements: [],
          active: true,
        },
        selectedRequirements: [
          { 
            id: "6", 
            title: "Badge Printing System", 
            description: "Set up registration desk with badge printing for all attendees" 
          },
          { 
            id: "7", 
            title: "Access Control", 
            description: "Manage VIP and speaker access to restricted areas" 
          },
        ],
        customRequirements: "",
        emails: ["security@ecssr.ae"],
      },
    ];

    await emailService.sendManagementSummary(testEvent, testAssignments as any, settings);

    // Also send to the test recipient email if not in the management summary recipients list
    if (settings.managementSummaryRecipients && !settings.managementSummaryRecipients.includes(recipientEmail)) {
      // Override the recipients temporarily for this test
      const testSettings = { ...settings, managementSummaryRecipients: recipientEmail };
      await emailService.sendManagementSummary(testEvent, testAssignments as any, testSettings);
    }

    res.json({ success: true, message: "Test management summary email sent successfully" });
  } catch (error: any) {
    console.error("Failed to send test management summary email:", error);
    res.status(500).json({ error: error.message || "Failed to send test email" });
  }
});

// ==================== Email Preview Endpoints ====================

/**
 * GET /api/settings/preview-email/stakeholder
 * Generate stakeholder email preview (superadmin only)
 */
router.get("/api/settings/preview-email/stakeholder", isSuperAdmin, async (req, res) => {
  try {
    const settings = await storage.getSettings();
    const { subject, html } = emailService.generateStakeholderPreview(settings);
    
    res.json({ subject, html });
  } catch (error: any) {
    console.error("Failed to generate stakeholder email preview:", error);
    res.status(500).json({ error: error.message || "Failed to generate preview" });
  }
});

/**
 * GET /api/settings/preview-email/reminder
 * Generate reminder email preview (superadmin only)
 */
router.get("/api/settings/preview-email/reminder", isSuperAdmin, async (req, res) => {
  try {
    const settings = await storage.getSettings();
    const { subject, html } = emailService.generateReminderPreview(settings);
    
    res.json({ subject, html });
  } catch (error: any) {
    console.error("Failed to generate reminder email preview:", error);
    res.status(500).json({ error: error.message || "Failed to generate preview" });
  }
});

/**
 * GET /api/settings/preview-email/management
 * Generate management summary email preview (superadmin only)
 */
router.get("/api/settings/preview-email/management", isSuperAdmin, async (req, res) => {
  try {
    const settings = await storage.getSettings();
    const { subject, html } = emailService.generateManagementPreview(settings);
    
    res.json({ subject, html });
  } catch (error: any) {
    console.error("Failed to generate management email preview:", error);
    res.status(500).json({ error: error.message || "Failed to generate preview" });
  }
});

/**
 * GET /api/settings/preview-email/taskCompletion
 * Generate task completion email preview (superadmin only)
 */
router.get("/api/settings/preview-email/taskCompletion", isSuperAdmin, async (req, res) => {
  try {
    const settings = await storage.getSettings();
    const { subject, html } = emailService.generateTaskCompletionPreview(settings);
    
    res.json({ subject, html });
  } catch (error: any) {
    console.error("Failed to generate task completion email preview:", error);
    res.status(500).json({ error: error.message || "Failed to generate preview" });
  }
});

/**
 * GET /api/settings/preview-email/updates
 * Preview updates email template (superadmin only)
 */
router.get("/api/settings/preview-email/updates", isSuperAdmin, async (req, res) => {
  try {
    const settings = await storage.getSettings();
    const { subject, html } = emailService.generateUpdatesPreview(settings);
    
    res.json({ subject, html });
  } catch (error: any) {
    console.error("Failed to generate updates email preview:", error);
    res.status(500).json({ error: error.message || "Failed to generate preview" });
  }
});

/**
 * GET /api/settings/preview-email/invitation
 * Preview invitation email template (superadmin only)
 */
router.get("/api/settings/preview-email/invitation", isSuperAdmin, async (req, res) => {
  try {
    const settings = await storage.getSettings();
    const { subject, html } = emailService.generateInvitationPreview(settings);
    
    res.json({ subject, html });
  } catch (error: any) {
    console.error("Failed to generate invitation email preview:", error);
    res.status(500).json({ error: error.message || "Failed to generate preview" });
  }
});

// ==================== WhatsApp Endpoints ====================

/**
 * GET /api/whatsapp/status
 * Check WhatsApp authentication status (superadmin only)
 */
router.get("/api/whatsapp/status", isSuperAdmin, async (req, res) => {
  try {
    const { whatsappService } = await import('../whatsapp-client');
    const status = await whatsappService.getStatus();
    
    // Return Baileys format: { connected, qrCode?, phoneNumber? }
    res.json({
      authenticated: status.connected,
      connected: status.connected,
      qrCode: status.qrCode,
      phoneNumber: status.phoneNumber
    });
  } catch (error) {
    console.error('[API] Failed to check WhatsApp status:', error);
    res.status(500).json({ error: "Failed to check WhatsApp status" });
  }
});

/**
 * GET /api/whatsapp/groups
 * Get WhatsApp groups (admin/superadmin only)
 */
router.get("/api/whatsapp/groups", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { whatsappService } = await import('../whatsapp-client');
    const groupsData = await whatsappService.getGroups();
    
    res.json(groupsData);
  } catch (error: any) {
    console.error('[API] Failed to get groups:', error);
    res.status(500).json({ error: error.message || "Failed to get WhatsApp groups" });
  }
});

/**
 * POST /api/whatsapp/logout
 * Logout from WhatsApp (superadmin only)
 */
router.post("/api/whatsapp/logout", isSuperAdmin, async (req, res) => {
  try {
    const { whatsappService } = await import('../whatsapp-client');
    await whatsappService.logout();
    
    res.json({ success: true, message: "WhatsApp credentials cleared successfully" });
  } catch (error: any) {
    console.error('[API] Failed to logout:', error);
    res.status(500).json({ error: error.message || "Failed to logout from WhatsApp" });
  }
});

/**
 * GET /api/whatsapp/chats
 * List available WhatsApp groups/chats (superadmin only)
 */
router.get("/api/whatsapp/chats", isSuperAdmin, async (req, res) => {
  try {
    const { whatsappService } = await import('../whatsapp-client');
    const groupsData = await whatsappService.getGroups();
    
    // Return in expected format
    const chats = groupsData.groups.map((g: any) => ({
      id: g.name, // Use name as ID for sending
      name: g.name,
      isGroup: true
    }));
    
    res.json(chats);
  } catch (error: any) {
    console.error('[API] Failed to list chats:', error);
    res.status(500).json({ error: error.message || "Failed to list WhatsApp chats" });
  }
});

/**
 * POST /api/whatsapp/test
 * Send test WhatsApp notification (superadmin only)
 */
router.post("/api/whatsapp/test", isSuperAdmin, async (req, res) => {
  try {
    console.log('[WhatsApp Test] Testing notification...');
    
    const { whatsappService } = await import('../whatsapp-client');
    
    // Check if WhatsApp is authenticated
    const status = await whatsappService.getStatus();
    if (!status.connected) {
      console.log('[WhatsApp Test] ✗ Not authenticated');
      return res.status(400).json({ error: "WhatsApp is not connected. Please scan QR code first." });
    }

    const settings = await storage.getSettings();
    const groupId = settings.whatsappChatId?.trim() || undefined;
    const groupName = settings.whatsappChatName?.trim() || undefined;

    if (!groupId && !groupName) {
      console.log('[WhatsApp Test] ✗ No group configured');
      return res.status(400).json({ error: "No WhatsApp group selected. Please select a group first." });
    }

    if (!settings.whatsappEnabled) {
      console.log('[WhatsApp Test] ⚠️ WhatsApp notifications disabled, sending test anyway');
    }

    const { formatTestWhatsAppMessage } = await import('../whatsappFormatter');
    const { message: testMessage } = await formatTestWhatsAppMessage();

    console.log('[WhatsApp Test] Sending test message to group:', groupId || groupName);
    await whatsappService.sendMessage({
      message: testMessage,
      groupId,
      groupName,
    });
    
    console.log('[WhatsApp Test] ✓ Test notification sent successfully');
    res.json({ success: true, message: "Test notification sent successfully" });
  } catch (error: any) {
    console.error('[WhatsApp Test] ✗ Failed to send test notification:', error);
    res.status(500).json({ error: error.message || "Failed to send test notification" });
  }
});

export default router;
