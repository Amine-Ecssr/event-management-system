/**
 * Event Routes
 *
 * API endpoints for event CRUD operations, speaker management,
 * media (photo) management, and related functionality.
 *
 * @module routes/event
 */

import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, isAdminOrSuperAdmin, isSuperAdmin } from "../auth";
import { insertEventSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { agendaUpload, getAgendaFilePath, deleteAgendaFile } from "../fileUpload";
import { emailService } from "../email";
import { eventFileService } from "../services/eventFileService";
import { generateIcsFile } from "../icsGenerator";
import { minioService } from "../services/minio";
import { indexingService } from "../services/elasticsearch-indexing.service";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import {
  normalizeEventPayload,
  generateReminderSchedule,
  cleanupAgendaFiles,
  cleanupAgendaFilesByName,
  AgendaFiles,
  getDepartmentEmails,
} from "./utils";

const router = Router();

// ==================== Multer Configurations ====================

/**
 * Multer configuration for creating events
 * Accepts both agendas (PDF) and photos (images)
 */
const createEventUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for agendas, 5MB check done per-file
    files: 22, // Max 20 photos + 2 agendas
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "agendaEn" || file.fieldname === "agendaAr") {
      if (file.mimetype === "application/pdf") {
        cb(null, true);
      } else {
        cb(new Error("Agenda files must be PDF"));
      }
    } else if (file.fieldname === "photos") {
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (allowedMimeTypes.includes(file.mimetype)) {
        if (file.size > 5 * 1024 * 1024) {
          cb(new Error("Photos must be under 5MB"));
        } else {
          cb(null, true);
        }
      } else {
        cb(new Error("Photos must be JPEG, PNG, WebP, or GIF"));
      }
    } else {
      cb(new Error("Unexpected field: " + file.fieldname));
    }
  },
});

/**
 * Multer configuration for event photo uploads (memory storage for MinIO)
 */
const eventPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 20,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, WebP, GIF) are allowed"));
    }
  },
});

// ==================== Event CRUD Routes ====================

/**
 * Get all events (public)
 * Everyone sees all events, but filter scraped events based on settings
 */
router.get("/api/events", async (req, res) => {
  try {
    // Get settings to check if scraped events should be shown
    const settings = await storage.getSettings();

    // Get all events
    let events = await storage.getAllEvents();

    // Filter out scraped events if the setting is disabled
    if (!settings.scrapedEventsEnabled) {
      events = events.filter((event) => !event.isScraped);
    }

    // Add media with signed URLs for each event
    const eventsWithMedia = await Promise.all(
      events.map(async (event) => {
        const media = await storage.getEventMedia(event.id);
        const mediaWithUrls = media.map((m) => ({
          ...m,
          imageUrl: minioService.generateSignedMediaUrl(m.objectKey, 3600),
          thumbnailUrl: m.thumbnailKey
            ? minioService.generateSignedMediaUrl(m.thumbnailKey, 3600)
            : minioService.generateSignedMediaUrl(m.objectKey, 3600),
        }));

        const thumbnailUrl = mediaWithUrls[0]?.thumbnailUrl || undefined;

        return { ...event, media: mediaWithUrls, thumbnailUrl };
      })
    );

    res.json(eventsWithMedia);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

/**
 * Get single event (public)
 * Everyone can view any event
 */
router.get("/api/events/:id", async (req, res) => {
  try {
    const event = await storage.getEvent(req.params.id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Add media with signed URLs
    const media = await storage.getEventMedia(event.id);
    const mediaWithUrls = media.map((m) => ({
      ...m,
      imageUrl: minioService.generateSignedMediaUrl(m.objectKey, 3600),
      thumbnailUrl: m.thumbnailKey
        ? minioService.generateSignedMediaUrl(m.thumbnailKey, 3600)
        : minioService.generateSignedMediaUrl(m.objectKey, 3600),
    }));

    const thumbnailUrl = mediaWithUrls[0]?.thumbnailUrl || undefined;

    // All users (public, stakeholders, admins) can view any event
    res.json({ ...event, media: mediaWithUrls, thumbnailUrl });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

/**
 * Export an event as an ICS calendar file
 */
router.get("/api/events/:id/ics", async (req, res) => {
  try {
    const event = await storage.getEvent(req.params.id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const { content, filename } = generateIcsFile(event);

    res.setHeader("Content-Type", "text/calendar");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    res.status(500).json({ error: "Failed to export event" });
  }
});

/**
 * Download agenda PDFs (public)
 */
router.get("/api/events/:id/agenda/:lang", async (req, res) => {
  try {
    const { id, lang } = req.params;
    if (lang !== "en" && lang !== "ar") {
      return res.status(400).json({ error: "Invalid agenda language" });
    }

    const event = await storage.getEvent(id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const storedFileName = lang === "en" ? event.agendaEnStoredFileName : event.agendaArStoredFileName;
    const originalFileName = lang === "en" ? event.agendaEnFileName : event.agendaArFileName;

    if (!storedFileName) {
      return res.status(404).json({ error: "Agenda not found for this language" });
    }

    const filePath = getAgendaFilePath(storedFileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Agenda file not found on disk" });
    }

    res.download(filePath, originalFileName || `agenda-${lang}.pdf`);
  } catch (error) {
    console.error("Agenda download error:", error);
    res.status(500).json({ error: "Failed to download agenda" });
  }
});

/**
 * Create event (admin/superadmin only)
 * Handles stakeholder assignments, speaker assignments, photo uploads,
 * workflow creation, reminder scheduling, WhatsApp notifications, and email notifications
 */
router.post(
  "/api/events",
  isAdminOrSuperAdmin,
  createEventUpload.fields([
    { name: "agendaEn", maxCount: 1 },
    { name: "agendaAr", maxCount: 1 },
    { name: "photos", maxCount: 20 },
  ]),
  async (req, res) => {
    const uploadedFiles = (req.files as Record<string, Express.Multer.File[]>) || {};
    const agendaFilesToCleanup: string[] = [];

    try {
      // Save agenda PDFs to disk (they need to persist)
      const agendaFiles: AgendaFiles = {};

      if (uploadedFiles.agendaEn?.[0]) {
        const agendaEn = uploadedFiles.agendaEn[0];
        const fileName = `${randomUUID()}${path.extname(agendaEn.originalname)}`;
        const filePath = getAgendaFilePath(fileName);
        fs.writeFileSync(filePath, agendaEn.buffer);
        agendaFilesToCleanup.push(fileName);
        agendaFiles.agendaEn = [
          {
            ...agendaEn,
            filename: fileName,
            path: filePath,
          } as Express.Multer.File,
        ];
      }

      if (uploadedFiles.agendaAr?.[0]) {
        const agendaAr = uploadedFiles.agendaAr[0];
        const fileName = `${randomUUID()}${path.extname(agendaAr.originalname)}`;
        const filePath = getAgendaFilePath(fileName);
        fs.writeFileSync(filePath, agendaAr.buffer);
        agendaFilesToCleanup.push(fileName);
        agendaFiles.agendaAr = [
          {
            ...agendaAr,
            filename: fileName,
            path: filePath,
          } as Express.Multer.File,
        ];
      }

      const photoFiles = uploadedFiles.photos || [];
      const { stakeholders: stakeholdersRaw, speakers: speakersRaw, ...eventData } = req.body;

      let stakeholdersData = stakeholdersRaw as any;
      if (typeof stakeholdersRaw === "string" && stakeholdersRaw.trim()) {
        try {
          stakeholdersData = JSON.parse(stakeholdersRaw);
        } catch (parseError) {
          cleanupAgendaFiles(agendaFiles);
          return res.status(400).json({ error: "Invalid stakeholders payload" });
        }
      }

      // Parse speakers data
      let speakersData = speakersRaw as any;
      if (typeof speakersRaw === "string" && speakersRaw.trim()) {
        try {
          speakersData = JSON.parse(speakersRaw);
        } catch (parseError) {
          cleanupAgendaFiles(agendaFiles);
          return res.status(400).json({ error: "Invalid speakers payload" });
        }
      }

      const normalizedEventData = normalizeEventPayload(eventData, agendaFiles, {
        reminder1Week: true,
        reminder1Day: true,
        reminderWeekly: false,
        reminderDaily: false,
        reminderMorningOf: false,
      });

      console.log("[POST /api/events] Received stakeholder data:", {
        hasStakeholders: !!stakeholdersData,
        isArray: Array.isArray(stakeholdersData),
        length: stakeholdersData?.length || 0,
        data: stakeholdersData,
      });

      const result = insertEventSchema.safeParse(normalizedEventData);
      if (!result.success) {
        cleanupAgendaFilesByName(agendaFilesToCleanup);
        return res.status(400).json({
          error: fromError(result.error).toString(),
        });
      }

      const event = await storage.createEvent(result.data);

      // Upload photos to MinIO if provided
      if (photoFiles && photoFiles.length > 0) {
        console.log(`[POST /api/events] Uploading ${photoFiles.length} photos for event ${event.id}`);
        try {
          for (let i = 0; i < photoFiles.length; i++) {
            const file = photoFiles[i];
            const uploadResult = await minioService.uploadImage(file.buffer, file.originalname, file.mimetype);

            await storage.createEventMedia({
              eventId: event.id,
              objectKey: uploadResult.objectKey,
              thumbnailKey: uploadResult.thumbnailKey,
              originalFileName: uploadResult.originalFileName,
              mimeType: uploadResult.mimeType,
              fileSize: uploadResult.fileSize,
              width: uploadResult.width,
              height: uploadResult.height,
              displayOrder: i,
              uploadedByUserId: req.user!.id,
            });
          }
          console.log(`[POST /api/events] Successfully uploaded ${photoFiles.length} photos`);
        } catch (photoError) {
          console.error("[POST /api/events] Failed to upload photos:", photoError);
          // Don't fail the event creation, just log the error
        }
      }

      // Initialize default folder structure for the event (best-effort)
      try {
        await eventFileService.initializeEventFolders(event.id, req.user?.id);
        console.log(`[POST /api/events] Initialized file folders for event ${event.id}`);
      } catch (folderError) {
        // Log but don't fail - folder initialization can be done later
        console.warn(`[POST /api/events] Failed to initialize folders for event ${event.id}:`, folderError);
      }

      // Handle speaker assignments
      if (speakersData && Array.isArray(speakersData) && speakersData.length > 0) {
        console.log("[POST /api/events] Processing speaker assignments...");
        try {
          for (const speakerData of speakersData) {
            await storage.addEventSpeaker({
              eventId: event.id,
              contactId: speakerData.contactId,
              role: speakerData.role || null,
              roleAr: speakerData.roleAr || null,
              displayOrder: speakerData.displayOrder || 0,
            });
          }
          console.log(`[POST /api/events] Added ${speakersData.length} speakers to event ${event.id}`);
        } catch (speakerError) {
          console.error("[POST /api/events] Failed to add speakers:", speakerError);
        }
      }

      // Handle stakeholder assignments and notifications
      if (stakeholdersData && Array.isArray(stakeholdersData) && stakeholdersData.length > 0) {
        console.log("[POST /api/events] Processing stakeholder assignments...");
        try {
          const settings = await storage.getSettings();
          const managementSummaryAssignments: Array<{
            stakeholder: any;
            selectedRequirements: any[];
            customRequirements: string;
            emails: string[];
          }> = [];

          for (const stakeholderAssignment of stakeholdersData) {
            // Support both departmentId and stakeholderId for backwards compatibility
            const departmentId = stakeholderAssignment.departmentId || stakeholderAssignment.stakeholderId;
            const { selectedRequirementIds, customRequirements, notifyOnCreate } = stakeholderAssignment;

            console.log(`[POST /api/events] Creating event_department for department ${departmentId}`);

            // Save department assignment to database
            const eventDepartment = await storage.createEventDepartment({
              eventId: event.id,
              departmentId,
              selectedRequirementIds: selectedRequirementIds || [],
              customRequirements: customRequirements || "",
              notifyOnCreate: notifyOnCreate !== undefined ? notifyOnCreate : true,
              notifyOnUpdate: stakeholderAssignment.notifyOnUpdate !== undefined ? stakeholderAssignment.notifyOnUpdate : false,
            });

            // Fetch department details for both notifications AND management summary
            const stakeholder = await storage.getDepartment(departmentId);
            if (stakeholder) {
              const selectedReqs = stakeholder.requirements.filter((r: any) => selectedRequirementIds?.includes(r.id));
              // Get all email addresses (department emails + Keycloak-synced users)
              const emailAddresses = await getDepartmentEmails(departmentId);

              // Auto-create tasks from selected requirements using workflow service
              // This handles prerequisites and creates workflow entries
              if (selectedRequirementIds && selectedRequirementIds.length > 0) {
                try {
                  const { workflowService } = await import("../services/workflowService");
                  await workflowService.createTasksWithWorkflows(event.id, eventDepartment.id, selectedRequirementIds, req.user!.id);
                } catch (taskError) {
                  console.error(`Failed to create tasks from requirements for department ${departmentId}:`, taskError);
                }
              }

              // Auto-create task for custom requirements if provided
              if (customRequirements && customRequirements.trim()) {
                try {
                  await storage.createTask({
                    eventDepartmentId: eventDepartment.id,
                    title: "Custom Requirements",
                    description: customRequirements,
                    status: "pending",
                    priority: "medium",
                    createdByUserId: req.user!.id,
                    dueDate: null,
                  });
                } catch (taskError) {
                  console.error(`Failed to create custom requirements task for department ${departmentId}:`, taskError);
                }
              }

              // ALWAYS collect for management summary (comprehensive overview of ALL assignments)
              managementSummaryAssignments.push({
                stakeholder,
                selectedRequirements: selectedReqs,
                customRequirements: customRequirements || "",
                emails: emailAddresses,
              });

              // Send individual stakeholder notification if enabled and appropriate
              if (settings.emailEnabled && notifyOnCreate !== false && stakeholder.active && emailAddresses.length > 0) {
                try {
                  await emailService.sendStakeholderNotification(
                    event,
                    stakeholder,
                    emailAddresses,
                    selectedReqs,
                    customRequirements || "",
                    settings
                  );
                } catch (emailError) {
                  console.error(`Failed to send stakeholder notification to ${departmentId}:`, emailError);
                }
              }
            }
          }

          // Send management summary email if enabled and configured (includes ALL assignments)
          if (
            settings.emailEnabled &&
            settings.managementSummaryEnabled &&
            settings.managementSummaryRecipients &&
            managementSummaryAssignments.length > 0
          ) {
            try {
              await emailService.sendManagementSummary(event, managementSummaryAssignments, settings);
            } catch (managementError) {
              console.error("Failed to send management summary:", managementError);
            }
          } else if (managementSummaryAssignments.length > 0 && !settings.managementSummaryEnabled) {
            console.log("Management summary skipped: feature disabled in settings");
          } else if (managementSummaryAssignments.length > 0 && !settings.managementSummaryRecipients) {
            console.log("Management summary skipped: no recipients configured");
          }

          // Create workflows after all stakeholder tasks have been processed
          // This ensures prerequisite tasks exist before workflows are created
          try {
            const { workflowService } = await import("../services/workflowService");
            const workflows = await workflowService.createWorkflowsForEvent(event.id, req.user!.id);
            if (workflows.length > 0) {
              console.log(`[POST /api/events] Created ${workflows.length} workflows for event ${event.id}`);
            }
          } catch (workflowError) {
            console.error("Failed to create workflows for event:", workflowError);
          }
        } catch (stakeholderError) {
          console.error("Failed to process stakeholder assignments:", stakeholderError);
        }
      }

      // Send WhatsApp notification if enabled (separate from stakeholder processing)
      try {
        const settings = await storage.getSettings();
        if (settings.whatsappEnabled) {
          const { sendEventCreatedNotification } = await import("../whatsappFormatter");
          await sendEventCreatedNotification(event, settings.whatsappChatName || undefined);
          console.log("[WhatsApp] Event created notification sent successfully");
        }
      } catch (whatsappError) {
        console.error("[WhatsApp] Failed to send event notification:", whatsappError);
      }

      // Schedule reminders based on event preferences
      try {
        const reminderSchedule = generateReminderSchedule(event);
        for (const reminder of reminderSchedule) {
          await storage.enqueueReminder({
            eventId: event.id,
            reminderType: reminder.type as any,
            scheduledFor: new Date(reminder.scheduledFor),
            status: "pending",
            sentAt: null as any,
            attempts: 0,
            lastAttempt: null as any,
            errorMessage: null as any,
          });
        }
        console.log(`[POST /api/events] Scheduled ${reminderSchedule.length} reminders for event ${event.id}`);
      } catch (reminderError) {
        console.error("Failed to schedule reminders:", reminderError);
      }

      // Index event to Elasticsearch (non-blocking)
      const mediaCount = uploadedFiles.photos?.length || 0;
      indexingService.indexEvent(event, { mediaCount }).catch(err => {
        console.warn("[ES] Failed to index new event:", err?.message || err);
      });

      res.status(201).json(event);
    } catch (error) {
      cleanupAgendaFilesByName(agendaFilesToCleanup);
      res.status(500).json({ error: "Failed to create event" });
    }
  }
);

/**
 * Update event (admin/superadmin only)
 * Handles stakeholder assignments, speaker assignments,
 * workflow creation, reminder scheduling, and email notifications
 */
router.patch(
  "/api/events/:id",
  isAdminOrSuperAdmin,
  agendaUpload.fields([
    { name: "agendaEn", maxCount: 1 },
    { name: "agendaAr", maxCount: 1 },
  ]),
  async (req, res) => {
    const agendaFiles = (req.files as AgendaFiles) || {};
    try {
      const { stakeholders: stakeholdersRaw, speakers: speakersRaw, ...eventData } = req.body;

      let stakeholdersData = stakeholdersRaw as any;
      if (typeof stakeholdersRaw === "string" && stakeholdersRaw.trim()) {
        try {
          stakeholdersData = JSON.parse(stakeholdersRaw);
        } catch (parseError) {
          cleanupAgendaFiles(agendaFiles);
          return res.status(400).json({ error: "Invalid stakeholders payload" });
        }
      }

      // Parse speakers data
      let speakersData = speakersRaw as any;
      if (typeof speakersRaw === "string" && speakersRaw.trim()) {
        try {
          speakersData = JSON.parse(speakersRaw);
        } catch (parseError) {
          cleanupAgendaFiles(agendaFiles);
          return res.status(400).json({ error: "Invalid speakers payload" });
        }
      }

      // Fetch existing event to validate merged result
      const existingEvent = await storage.getEvent(req.params.id);
      if (!existingEvent) {
        cleanupAgendaFiles(agendaFiles);
        return res.status(404).json({ error: "Event not found" });
      }

      const normalizedEventData = normalizeEventPayload(eventData, agendaFiles, existingEvent);

      // Merge update with existing event for validation
      const mergedData = {
        ...existingEvent,
        ...normalizedEventData,
        // Convert null to undefined for optional time fields to pass validation
        startTime:
          (normalizedEventData.startTime !== undefined ? normalizedEventData.startTime : existingEvent.startTime) || undefined,
        endTime: (normalizedEventData.endTime !== undefined ? normalizedEventData.endTime : existingEvent.endTime) || undefined,
      };

      // Validate the merged result using full schema
      const result = insertEventSchema.safeParse(mergedData);
      if (!result.success) {
        console.error("[PATCH /api/events/:id] Validation error:", JSON.stringify(result.error, null, 2));
        console.error("[PATCH /api/events/:id] Merged data:", JSON.stringify(mergedData, null, 2));
        cleanupAgendaFiles(agendaFiles);
        return res.status(400).json({
          error: fromError(result.error).toString(),
        });
      }

      // Only update with the fields that were actually provided
      const event = await storage.updateEvent(req.params.id, normalizedEventData);
      if (!event) {
        cleanupAgendaFiles(agendaFiles);
        return res.status(404).json({ error: "Event not found" });
      }

      // Clean up replaced agenda files
      if (agendaFiles.agendaEn?.[0] && existingEvent.agendaEnStoredFileName) {
        deleteAgendaFile(existingEvent.agendaEnStoredFileName);
      }
      if (agendaFiles.agendaAr?.[0] && existingEvent.agendaArStoredFileName) {
        deleteAgendaFile(existingEvent.agendaArStoredFileName);
      }

      // Handle speaker assignments (if speaker data is provided)
      if (speakersData !== undefined) {
        try {
          // Delete existing speakers for this event
          await storage.deleteEventSpeakers(event.id);

          // Add new speakers
          if (Array.isArray(speakersData) && speakersData.length > 0) {
            for (const speakerData of speakersData) {
              await storage.addEventSpeaker({
                eventId: event.id,
                contactId: speakerData.contactId,
                role: speakerData.role || null,
                roleAr: speakerData.roleAr || null,
                displayOrder: speakerData.displayOrder || 0,
              });
            }
            console.log(`[PATCH /api/events/:id] Updated ${speakersData.length} speakers for event ${event.id}`);
          }
        } catch (speakerError) {
          console.error("[PATCH /api/events/:id] Failed to update speakers:", speakerError);
        }
      }

      // Handle stakeholder assignments and notifications (if stakeholder data is provided)
      if (stakeholdersData !== undefined) {
        try {
          await storage.deleteEventDepartments(event.id);

          if (Array.isArray(stakeholdersData) && stakeholdersData.length > 0) {
            const settings = await storage.getSettings();
            const managementSummaryAssignments: Array<{
              stakeholder: any;
              selectedRequirements: any[];
              customRequirements: string;
              emails: string[];
            }> = [];

            for (const stakeholderAssignment of stakeholdersData) {
              // Support both departmentId and stakeholderId for backwards compatibility
              const departmentId = stakeholderAssignment.departmentId || stakeholderAssignment.stakeholderId;
              const { selectedRequirementIds, customRequirements, notifyOnUpdate } = stakeholderAssignment;

              // Save stakeholder assignment to database
              const eventDepartment = await storage.createEventDepartment({
                eventId: event.id,
                departmentId,
                selectedRequirementIds: selectedRequirementIds || [],
                customRequirements: customRequirements || "",
                notifyOnCreate: stakeholderAssignment.notifyOnCreate !== undefined ? stakeholderAssignment.notifyOnCreate : true,
                notifyOnUpdate: notifyOnUpdate !== undefined ? notifyOnUpdate : false,
              });

              // Fetch stakeholder details for both notifications AND management summary
              const stakeholder = await storage.getDepartment(departmentId);
              if (stakeholder) {
                const selectedReqs = stakeholder.requirements.filter((r: any) => selectedRequirementIds?.includes(r.id));
                // Get all email addresses (department emails + Keycloak-synced users)
                const emailAddresses = await getDepartmentEmails(departmentId);

                // Auto-create tasks from selected requirements using workflow service
                // This handles prerequisites and creates workflow entries
                if (selectedRequirementIds && selectedRequirementIds.length > 0) {
                  try {
                    const { workflowService } = await import("../services/workflowService");
                    await workflowService.createTasksWithWorkflows(event.id, eventDepartment.id, selectedRequirementIds, req.user!.id);
                  } catch (taskError) {
                    console.error(`Failed to create tasks from requirements for department ${departmentId}:`, taskError);
                  }
                }

                // Auto-create task for custom requirements if provided
                if (customRequirements && customRequirements.trim()) {
                  try {
                    await storage.createTask({
                      eventDepartmentId: eventDepartment.id,
                      title: "Custom Requirements",
                      description: customRequirements,
                      status: "pending",
                      priority: "medium",
                      createdByUserId: req.user!.id,
                      dueDate: null,
                    });
                  } catch (taskError) {
                    console.error(`Failed to create custom requirements task for department ${departmentId}:`, taskError);
                  }
                }

                // ALWAYS collect for management summary (comprehensive overview of ALL assignments)
                managementSummaryAssignments.push({
                  stakeholder,
                  selectedRequirements: selectedReqs,
                  customRequirements: customRequirements || "",
                  emails: emailAddresses,
                });

                // Send individual stakeholder notification if enabled and appropriate
                if (settings.emailEnabled && notifyOnUpdate && stakeholder.active && emailAddresses.length > 0) {
                  try {
                    await emailService.sendStakeholderNotification(
                      event,
                      stakeholder,
                      emailAddresses,
                      selectedReqs,
                      customRequirements || "",
                      settings
                    );
                  } catch (emailError) {
                    console.error(`Failed to send stakeholder notification to ${departmentId}:`, emailError);
                  }
                }
              }
            }

            // Send management summary email if enabled and configured (includes ALL assignments)
            if (
              settings.emailEnabled &&
              settings.managementSummaryEnabled &&
              settings.managementSummaryRecipients &&
              managementSummaryAssignments.length > 0
            ) {
              try {
                await emailService.sendManagementSummary(event, managementSummaryAssignments, settings);
              } catch (managementError) {
                console.error("Failed to send management summary:", managementError);
              }
            } else if (managementSummaryAssignments.length > 0 && !settings.managementSummaryEnabled) {
              console.log("Management summary skipped: feature disabled in settings");
            } else if (managementSummaryAssignments.length > 0 && !settings.managementSummaryRecipients) {
              console.log("Management summary skipped: no recipients configured");
            }

            // Create workflows after all stakeholder tasks have been processed
            // This ensures prerequisite tasks exist before workflows are created
            try {
              const { workflowService } = await import("../services/workflowService");
              const workflows = await workflowService.createWorkflowsForEvent(event.id, req.user!.id);
              if (workflows.length > 0) {
                console.log(`[PUT /api/events] Created ${workflows.length} workflows for event ${event.id}`);
              }
            } catch (workflowError) {
              console.error("Failed to create workflows for event:", workflowError);
            }
          }
        } catch (stakeholderError) {
          console.error("Failed to process stakeholder assignments:", stakeholderError);
        }
      }

      // Delete all pending reminders for this event and reschedule based on new preferences
      try {
        await storage.deleteRemindersForEvent(event.id);

        const reminderSchedule = generateReminderSchedule(event);
        for (const reminder of reminderSchedule) {
          await storage.enqueueReminder({
            eventId: event.id,
            reminderType: reminder.type as any,
            scheduledFor: new Date(reminder.scheduledFor),
            status: "pending",
            sentAt: null as any,
            attempts: 0,
            lastAttempt: null as any,
            errorMessage: null as any,
          });
        }
        console.log(`[PATCH /api/events/:id] Rescheduled ${reminderSchedule.length} reminders for event ${event.id}`);
      } catch (reminderError) {
        console.error("Failed to reschedule reminders:", reminderError);
      }

      // Re-index event to Elasticsearch (non-blocking)
      indexingService.indexEvent(event).catch(err => {
        console.warn("[ES] Failed to re-index updated event:", err?.message || err);
      });

      res.json(event);
    } catch (error) {
      cleanupAgendaFiles(agendaFiles);
      res.status(500).json({ error: "Failed to update event" });
    }
  }
);

/**
 * Delete event (admin/superadmin only)
 */
router.delete("/api/events/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const event = await storage.getEvent(req.params.id);
    const deleted = await storage.deleteEvent(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (event) {
      if (event.agendaEnStoredFileName) {
        deleteAgendaFile(event.agendaEnStoredFileName);
      }
      if (event.agendaArStoredFileName) {
        deleteAgendaFile(event.agendaArStoredFileName);
      }
    }

    // Delete event from Elasticsearch (non-blocking)
    indexingService.deleteDocument('events', req.params.id).catch(err => {
      console.warn("[ES] Failed to delete event from index:", err?.message || err);
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete event" });
  }
});

/**
 * Delete all events (superadmin only)
 */
router.delete("/api/events", isSuperAdmin, async (req, res) => {
  try {
    await storage.deleteAllEvents();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete all events" });
  }
});

// ==================== Event Speakers Routes ====================

/**
 * Get speakers for an event
 */
router.get("/api/events/:eventId/speakers", async (req, res) => {
  try {
    const { eventId } = req.params;
    const speakers = await storage.getEventSpeakers(eventId);
    res.json(speakers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch event speakers" });
  }
});

/**
 * Add speaker to event
 */
router.post("/api/events/:eventId/speakers", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { contactId, role, roleAr, displayOrder } = req.body;

    if (!contactId) {
      return res.status(400).json({ error: "contactId is required" });
    }

    // Verify contact exists and is eligible speaker
    const contact = await storage.getContact(contactId);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }
    if (!contact.isEligibleSpeaker) {
      return res.status(400).json({ error: "Contact is not marked as an eligible speaker" });
    }

    const speaker = await storage.addEventSpeaker({
      eventId,
      contactId,
      role,
      roleAr,
      displayOrder: displayOrder || 0,
    });
    res.status(201).json(speaker);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(400).json({ error: "This speaker is already added to the event" });
    }
    res.status(500).json({ error: "Failed to add speaker to event" });
  }
});

/**
 * Update speaker role/order
 */
router.put("/api/events/:eventId/speakers/:speakerId", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const speakerId = parseInt(req.params.speakerId);
    const { role, roleAr, displayOrder } = req.body;

    const speaker = await storage.updateEventSpeaker(speakerId, { role, roleAr, displayOrder });
    if (!speaker) {
      return res.status(404).json({ error: "Speaker not found" });
    }
    res.json(speaker);
  } catch (error) {
    res.status(500).json({ error: "Failed to update speaker" });
  }
});

/**
 * Remove speaker from event
 */
router.delete("/api/events/:eventId/speakers/:speakerId", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const speakerId = parseInt(req.params.speakerId);
    const deleted = await storage.removeEventSpeaker(speakerId);
    if (!deleted) {
      return res.status(404).json({ error: "Speaker not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to remove speaker from event" });
  }
});

// ==================== Event Media Routes ====================

/**
 * Get media for an event
 */
router.get("/api/events/:eventId/media", async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const media = await storage.getEventMedia(eventId);

    // Generate signed URLs for each media item
    const mediaWithUrls = media.map((m) => ({
      ...m,
      imageUrl: minioService.generateSignedMediaUrl(m.objectKey, 3600),
      thumbnailUrl: m.thumbnailKey
        ? minioService.generateSignedMediaUrl(m.thumbnailKey, 3600)
        : minioService.generateSignedMediaUrl(m.objectKey, 3600),
    }));

    res.json(mediaWithUrls);
  } catch (error) {
    console.error("[Event Media] Failed to get media:", error);
    res.status(500).json({ error: "Failed to get event media" });
  }
});

/**
 * Upload photos to event
 */
router.post("/api/events/:eventId/media", isAdminOrSuperAdmin, eventPhotoUpload.array("photos", 20), async (req, res) => {
  try {
    const eventId = req.params.eventId;

    // Verify event exists
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Check current photo count
    const existingMedia = await storage.getEventMedia(eventId);
    const files = req.files as Express.Multer.File[];

    if (existingMedia.length + files.length > 20) {
      return res.status(400).json({
        error: `Maximum 20 photos allowed. Currently have ${existingMedia.length}, trying to add ${files.length}.`,
      });
    }

    // Upload each file to MinIO and create media records
    const uploadedMedia = [];
    const nextDisplayOrder = existingMedia.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Upload to MinIO
        const uploadResult = await minioService.uploadImage(file.buffer, file.originalname, file.mimetype);

        // Create media record
        const media = await storage.createEventMedia({
          eventId: eventId,
          objectKey: uploadResult.objectKey,
          thumbnailKey: uploadResult.thumbnailKey,
          originalFileName: uploadResult.originalFileName,
          mimeType: uploadResult.mimeType,
          fileSize: uploadResult.fileSize,
          width: uploadResult.width,
          height: uploadResult.height,
          displayOrder: nextDisplayOrder + i,
          uploadedByUserId: req.user!.id,
        });

        // Generate signed proxy URLs for the response
        const imageUrl = minioService.generateSignedMediaUrl(media.objectKey, 3600);
        const thumbnailUrl = media.thumbnailKey ? minioService.generateSignedMediaUrl(media.thumbnailKey, 3600) : imageUrl;
        uploadedMedia.push({ ...media, imageUrl, thumbnailUrl });
      } catch (error: any) {
        console.error(`[Event Media] Failed to upload photo ${file.originalname}:`, error);
        // Continue with other files
      }
    }

    res.status(201).json({
      uploaded: uploadedMedia.length,
      total: existingMedia.length + uploadedMedia.length,
      media: uploadedMedia,
    });
  } catch (error) {
    console.error("[Event Media] Failed to upload photos:", error);
    res.status(500).json({ error: "Failed to upload photos" });
  }
});

/**
 * Delete a photo from event
 */
router.delete("/api/events/:eventId/media/:mediaId", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const mediaId = parseInt(req.params.mediaId);

    if (isNaN(mediaId)) {
      return res.status(400).json({ error: "Invalid media ID" });
    }

    // Get media to delete
    const allMedia = await storage.getEventMedia(eventId);
    const media = allMedia.find((m) => m.id === mediaId);

    if (!media) {
      return res.status(404).json({ error: "Media not found" });
    }

    // Delete from MinIO
    try {
      await minioService.deleteImage(media.objectKey, media.thumbnailKey || undefined);
    } catch (error) {
      console.error(`[Event Media] Failed to delete from MinIO:`, error);
    }

    // Delete from database
    await storage.deleteEventMedia(mediaId);

    res.status(204).send();
  } catch (error) {
    console.error("[Event Media] Failed to delete photo:", error);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

/**
 * Reorder photos
 */
router.post("/api/events/:eventId/media/reorder", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const { mediaIds } = req.body;

    if (!Array.isArray(mediaIds)) {
      return res.status(400).json({ error: "mediaIds must be an array" });
    }

    await storage.reorderEventMedia(eventId, mediaIds);

    res.json({ success: true });
  } catch (error) {
    console.error("[Event Media] Failed to reorder photos:", error);
    res.status(500).json({ error: "Failed to reorder photos" });
  }
});

export default router;
