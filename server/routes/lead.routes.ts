/**
 * Lead Routes
 *
 * API endpoints for lead management including CRUD operations,
 * interactions, attachments, tasks, and task comments.
 *
 * @module routes/lead
 */

import { Router } from "express";
import multer from "multer";
import fs from "fs";
import { storage } from "../storage";
import { isAuthenticated, isAdminOrSuperAdmin } from "../auth";
import { type User } from "@shared/schema";
import { minioService } from "../services/minio";
import { upload, getFilePath } from "../fileUpload";
import { indexingService } from "../services/elasticsearch-indexing.service";

const router = Router();

// ==================== Multer Configuration ====================

const interactionAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: minioService.getInteractionMaxFileSize(),
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = minioService.getInteractionAllowedMimeTypes();
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type. Allowed: PDF, Word, Excel, PowerPoint, images, ZIP, and text files.`
        )
      );
    }
  },
});

// ==================== Lead CRUD Routes ====================

/**
 * GET /api/leads
 * Get all leads with optional filtering
 */
router.get("/api/leads", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { search, type, status } = req.query;
    const leads = await storage.getAllLeads({
      search: search as string,
      type: type as string,
      status: status as string,
    });
    res.json(leads);
  } catch (error: any) {
    console.error("[Leads] Failed to get leads:", error);
    res.status(500).json({ error: error.message || "Failed to get leads" });
  }
});

/**
 * GET /api/leads/:id
 * Get a single lead with details
 */
router.get("/api/leads/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const lead = await storage.getLeadWithDetails(id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    res.json(lead);
  } catch (error: any) {
    console.error("[Leads] Failed to get lead:", error);
    res.status(500).json({ error: error.message || "Failed to get lead" });
  }
});

/**
 * POST /api/leads
 * Create a new lead
 */
router.post("/api/leads", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const lead = await storage.createLead({
      ...req.body,
      createdByUserId: req.user!.id,
    });

    // Index lead to Elasticsearch (non-blocking)
    indexingService.indexLead(lead).catch(err => {
      console.warn("[ES] Failed to index new lead:", err?.message || err);
    });

    res.json(lead);
  } catch (error: any) {
    console.error("[Leads] Failed to create lead:", error);
    res.status(500).json({ error: error.message || "Failed to create lead" });
  }
});

/**
 * PUT /api/leads/:id
 * Update an existing lead
 */
router.put("/api/leads/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const lead = await storage.updateLead(id, req.body);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Re-index lead to Elasticsearch (non-blocking)
    indexingService.indexLead(lead).catch(err => {
      console.warn("[ES] Failed to re-index updated lead:", err?.message || err);
    });

    res.json(lead);
  } catch (error: any) {
    console.error("[Leads] Failed to update lead:", error);
    res.status(500).json({ error: error.message || "Failed to update lead" });
  }
});

/**
 * DELETE /api/leads/:id
 * Delete a lead
 */
router.delete("/api/leads/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteLead(id);

    // Delete lead from Elasticsearch (non-blocking)
    indexingService.deleteDocument('leads', String(id)).catch(err => {
      console.warn("[ES] Failed to delete lead from index:", err?.message || err);
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Leads] Failed to delete lead:", error);
    res.status(500).json({ error: error.message || "Failed to delete lead" });
  }
});

// ==================== Lead Interaction Routes ====================

/**
 * GET /api/leads/:id/interactions
 * Get all interactions for a lead
 */
router.get(
  "/api/leads/:id/interactions",
  isAdminOrSuperAdmin,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const interactions = await storage.getLeadInteractions(id);

      // Get usernames for created_by_user_id
      const interactionsWithUsernames = await Promise.all(
        interactions.map(async (interaction) => {
          let createdByUsername: string | null = null;
          if (interaction.createdByUserId) {
            const user = await storage.getUser(interaction.createdByUserId);
            createdByUsername = user?.username || null;
          }
          return { ...interaction, createdByUsername };
        })
      );

      res.json(interactionsWithUsernames);
    } catch (error: any) {
      console.error("[Leads] Failed to get interactions:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to get interactions" });
    }
  }
);

/**
 * POST /api/leads/:id/interactions
 * Create a new interaction for a lead
 */
router.post(
  "/api/leads/:id/interactions",
  isAdminOrSuperAdmin,
  async (req, res) => {
    try {
      const leadId = parseInt(req.params.id);

      // Convert interactionDate string to Date object if provided
      const data = {
        ...req.body,
        leadId,
        createdByUserId: req.user!.id,
        interactionDate: req.body.interactionDate
          ? new Date(req.body.interactionDate)
          : new Date(),
      };

      const interaction = await storage.createLeadInteraction(data);

      // Return with username
      const user = await storage.getUser(req.user!.id);
      res
        .status(201)
        .json({ ...interaction, createdByUsername: user?.username || null });
    } catch (error: any) {
      console.error("[Leads] Failed to create interaction:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to create interaction" });
    }
  }
);

/**
 * GET /api/lead-interactions/:id
 * Get a single interaction by ID
 */
router.get(
  "/api/lead-interactions/:id",
  isAdminOrSuperAdmin,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const interaction = await storage.getLeadInteraction(id);
      if (!interaction) {
        return res.status(404).json({ error: "Interaction not found" });
      }
      res.json(interaction);
    } catch (error: any) {
      console.error("[Leads] Failed to get interaction:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to get interaction" });
    }
  }
);

/**
 * PUT /api/lead-interactions/:id
 * Update an interaction
 */
router.put(
  "/api/lead-interactions/:id",
  isAdminOrSuperAdmin,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Convert interactionDate string to Date object if provided
      const data = {
        ...req.body,
        interactionDate: req.body.interactionDate
          ? new Date(req.body.interactionDate)
          : undefined,
      };

      const interaction = await storage.updateLeadInteraction(id, data);
      if (!interaction) {
        return res.status(404).json({ error: "Interaction not found" });
      }
      res.json(interaction);
    } catch (error: any) {
      console.error("[Leads] Failed to update interaction:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to update interaction" });
    }
  }
);

/**
 * DELETE /api/lead-interactions/:id
 * Delete an interaction
 */
router.delete(
  "/api/lead-interactions/:id",
  isAdminOrSuperAdmin,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLeadInteraction(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Leads] Failed to delete interaction:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to delete interaction" });
    }
  }
);

// ==================== Lead Interaction Attachment Routes ====================

/**
 * GET /api/leads/:leadId/interactions/:interactionId/attachments
 * Get all attachments for a lead interaction
 */
router.get(
  "/api/leads/:leadId/interactions/:interactionId/attachments",
  isAdminOrSuperAdmin,
  async (req, res) => {
    try {
      const interactionId = parseInt(req.params.interactionId);
      const attachments = await storage.getInteractionAttachments(
        interactionId,
        "lead"
      );

      // Add signed URLs for each attachment
      const attachmentsWithUrls = attachments.map((attachment) => ({
        ...attachment,
        downloadUrl: minioService.generateSignedInteractionAttachmentUrl(
          attachment.objectKey
        ),
      }));

      res.json(attachmentsWithUrls);
    } catch (error: any) {
      console.error(
        "[Interactions] Failed to get lead interaction attachments:",
        error
      );
      res
        .status(500)
        .json({ error: error.message || "Failed to get attachments" });
    }
  }
);

/**
 * POST /api/leads/:leadId/interactions/:interactionId/attachments
 * Upload attachment to a lead interaction
 */
router.post(
  "/api/leads/:leadId/interactions/:interactionId/attachments",
  isAdminOrSuperAdmin,
  interactionAttachmentUpload.single("file"),
  async (req, res) => {
    try {
      const leadId = parseInt(req.params.leadId);
      const interactionId = parseInt(req.params.interactionId);
      const file = req.file;
      const user = req.user as User | undefined;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Verify interaction exists and belongs to the lead
      const interaction = await storage.getLeadInteraction(interactionId);
      if (!interaction) {
        return res.status(404).json({ error: "Interaction not found" });
      }
      if (interaction.leadId !== leadId) {
        return res
          .status(400)
          .json({ error: "Interaction does not belong to this lead" });
      }

      // Upload to MinIO
      const uploadResult = await minioService.uploadInteractionAttachment(
        file.buffer,
        file.originalname,
        file.mimetype,
        "lead",
        leadId,
        interactionId
      );

      // Create database record
      const attachment = await storage.createInteractionAttachment({
        leadInteractionId: interactionId,
        partnershipInteractionId: null,
        objectKey: uploadResult.objectKey,
        originalFileName: file.originalname,
        fileSize: uploadResult.fileSize,
        mimeType: file.mimetype,
        uploadedByUserId: user?.id || null,
      });

      res.status(201).json({
        ...attachment,
        downloadUrl: minioService.generateSignedInteractionAttachmentUrl(
          attachment.objectKey
        ),
      });
    } catch (error: any) {
      console.error(
        "[Interactions] Failed to upload lead interaction attachment:",
        error
      );
      res
        .status(500)
        .json({ error: error.message || "Failed to upload attachment" });
    }
  }
);

// ==================== Lead Task Routes ====================

/**
 * GET /api/leads/:id/tasks
 * Get all tasks for a lead
 */
router.get("/api/leads/:id/tasks", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tasks = await storage.getContactTasks(id);
    res.json(tasks);
  } catch (error: any) {
    console.error("[Leads] Failed to get tasks:", error);
    res.status(500).json({ error: error.message || "Failed to get tasks" });
  }
});

/**
 * POST /api/leads/:id/tasks
 * Create a new task for a lead
 */
router.post("/api/leads/:id/tasks", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    const task = await storage.createContactTask({
      ...req.body,
      leadId: leadId,
      createdByUserId: req.user!.id,
    });
    res.json(task);
  } catch (error: any) {
    console.error("[Leads] Failed to create task:", error);
    res.status(500).json({ error: error.message || "Failed to create task" });
  }
});

/**
 * GET /api/lead-tasks/:id
 * Get a single lead task by ID
 */
router.get("/api/lead-tasks/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const task = await storage.getContactTaskWithDepartment(id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json(task);
  } catch (error: any) {
    console.error("[Leads] Failed to get task:", error);
    res.status(500).json({ error: error.message || "Failed to get task" });
  }
});

/**
 * PUT /api/lead-tasks/:id
 * Update a lead task
 */
router.put("/api/lead-tasks/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const task = await storage.updateContactTask(id, req.body);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json(task);
  } catch (error: any) {
    console.error("[Leads] Failed to update task:", error);
    res.status(500).json({ error: error.message || "Failed to update task" });
  }
});

/**
 * PUT /api/lead-tasks/:id/complete
 * Mark a lead task as completed
 */
router.put(
  "/api/lead-tasks/:id/complete",
  isAdminOrSuperAdmin,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.updateContactTask(id, { status: "completed" });
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error: any) {
      console.error("[Leads] Failed to complete task:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to complete task" });
    }
  }
);

/**
 * DELETE /api/lead-tasks/:id
 * Delete a lead task
 */
router.delete("/api/lead-tasks/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteContactTask(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Leads] Failed to delete task:", error);
    res.status(500).json({ error: error.message || "Failed to delete task" });
  }
});

// ==================== Lead Task Comment Routes ====================

/**
 * GET /api/lead-tasks/:id/comments
 * Get all comments for a lead task
 */
router.get("/api/lead-tasks/:id/comments", isAuthenticated, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const comments = await storage.getContactTaskComments(taskId);
    res.json(comments);
  } catch (error: any) {
    console.error("[Leads] Failed to get task comments:", error);
    res.status(500).json({ error: error.message || "Failed to get comments" });
  }
});

/**
 * POST /api/lead-tasks/:id/comments
 * Create a comment on a lead task with optional file attachment
 */
router.post(
  "/api/lead-tasks/:id/comments",
  isAuthenticated,
  upload.single("attachment"),
  async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      // Support both 'body' and 'content' field names for flexibility
      const commentBody = req.body.body || req.body.content;

      if (
        !commentBody ||
        typeof commentBody !== "string" ||
        commentBody.trim().length === 0
      ) {
        // If no text but a file was uploaded, allow it
        if (!req.file) {
          return res.status(400).json({ error: "Comment body is required" });
        }
      }

      const comment = await storage.createContactTaskComment({
        contactTaskId: taskId,
        authorUserId: req.user!.id,
        body: commentBody ? commentBody.trim() : "(file attachment)",
      });

      // If a file was uploaded, create an attachment
      if (req.file) {
        const attachment = await storage.createContactTaskCommentAttachment({
          commentId: comment.id,
          fileName: req.file.originalname,
          storedFileName: req.file.filename,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          uploadedByUserId: req.user!.id,
        });

        // Return comment with attachment
        res.status(201).json({
          ...comment,
          attachments: [attachment],
        });
      } else {
        res.status(201).json(comment);
      }
    } catch (error: any) {
      console.error("[Leads] Failed to create task comment:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to create comment" });
    }
  }
);

/**
 * DELETE /api/lead-tasks/:taskId/comments/:commentId
 * Delete a lead task comment
 */
router.delete(
  "/api/lead-tasks/:taskId/comments/:commentId",
  isAuthenticated,
  async (req, res) => {
    try {
      const commentId = parseInt(req.params.commentId);
      await storage.deleteContactTaskComment(commentId);
      res.status(204).send();
    } catch (error: any) {
      console.error("[Leads] Failed to delete task comment:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to delete comment" });
    }
  }
);

/**
 * GET /api/lead-task-comment-attachments/:id/download
 * Download a lead task comment attachment
 */
router.get(
  "/api/lead-task-comment-attachments/:id/download",
  isAuthenticated,
  async (req, res) => {
    try {
      const attachmentId = parseInt(req.params.id);
      const attachment =
        await storage.getContactTaskCommentAttachment(attachmentId);

      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      const filePath = getFilePath(attachment.storedFileName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found on disk" });
      }

      res.download(filePath, attachment.fileName);
    } catch (error: any) {
      console.error("[Leads] Failed to download attachment:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to download attachment" });
    }
  }
);

export default router;
