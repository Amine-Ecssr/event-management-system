/**
 * Event File Routes
 * 
 * API endpoints for event file and folder management:
 * - /api/events/:eventId/folders - Folder management
 * - /api/events/:eventId/files - File management
 * - /api/event-files/:objectKey - File download/streaming
 * - /api/folder-templates - Permission template management
 * - /api/events/:eventId/access - Access grant management
 */

import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import multer from "multer";
import { eventFileService } from "../services/eventFileService";
import { folderPermissionService, type PermissionLevel } from "../services/folderPermissionService";
import { minioService, MAX_FILE_SIZE } from "../services/minio";
import type { User } from "@shared/schema.mssql";
import { isAdminRole } from "./utils";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const router = Router();

// Configure multer for file uploads using shared MAX_FILE_SIZE
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// Middleware to ensure user is authenticated
const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// ==================== Folder Routes ====================

/**
 * GET /api/events/:eventId/folders
 * Get all folders for an event
 */
router.get("/events/:eventId/folders", isAuthenticated, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user!.id;
    
    // Check access
    const hasAccess = await folderPermissionService.checkEventAccess(userId, eventId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this event's files" });
    }
    
    const folders = await eventFileService.getEventFolders(eventId);
    res.json(folders);
  } catch (error: any) {
    console.error("[EventFiles] Failed to get folders:", error);
    res.status(500).json({ error: error.message || "Failed to get folders" });
  }
});

/**
 * POST /api/events/:eventId/folders/initialize
 * Initialize default folder structure for an event
 */
router.post("/events/:eventId/folders/initialize", isAuthenticated, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user!.id;
    
    // Only admins can initialize folders
    if (!isAdminRole(req.user!.role)) {
      return res.status(403).json({ error: "Forbidden: Only admins can initialize event folders" });
    }
    
    const folders = await eventFileService.initializeEventFolders(eventId, userId);
    res.json(folders);
  } catch (error: any) {
    console.error("[EventFiles] Failed to initialize folders:", error);
    res.status(500).json({ error: error.message || "Failed to initialize folders" });
  }
});

/**
 * POST /api/events/:eventId/folders
 * Create a new folder
 */
router.post("/events/:eventId/folders", isAuthenticated, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user!.id;
    
    // Check manage access
    const hasAccess = await folderPermissionService.checkEventAccess(userId, eventId, 'manage');
    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden: You don't have permission to create folders" });
    }
    
    const schema = z.object({
      name: z.string().min(1).max(255),
      parentFolderId: z.number().int().positive().nullable().optional(),
    });
    
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: fromError(result.error).toString() });
    }
    
    const folder = await eventFileService.createFolder(
      eventId,
      result.data.name,
      result.data.parentFolderId || null,
      userId
    );
    
    res.status(201).json(folder);
  } catch (error: any) {
    console.error("[EventFiles] Failed to create folder:", error);
    res.status(500).json({ error: error.message || "Failed to create folder" });
  }
});

/**
 * GET /api/folders/:folderId
 * Get folder details and contents
 */
router.get("/folders/:folderId", isAuthenticated, async (req, res) => {
  try {
    const folderId = parseInt(req.params.folderId);
    const userId = req.user!.id;
    
    // Check access
    const hasAccess = await folderPermissionService.checkFolderAccess(userId, folderId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this folder" });
    }
    
    const folder = await eventFileService.getFolder(folderId);
    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }
    
    const contents = await eventFileService.listFolderContents(folderId);
    
    // Get user's permission level for this folder
    const permission = await folderPermissionService.getUserFolderPermission(userId, folderId);
    
    res.json({
      folder,
      ...contents,
      permission,
    });
  } catch (error: any) {
    console.error("[EventFiles] Failed to get folder:", error);
    res.status(500).json({ error: error.message || "Failed to get folder" });
  }
});

/**
 * DELETE /api/folders/:folderId
 * Delete a folder and all its contents
 */
router.delete("/folders/:folderId", isAuthenticated, async (req, res) => {
  try {
    const folderId = parseInt(req.params.folderId);
    const userId = req.user!.id;
    
    // Check manage access
    const hasAccess = await folderPermissionService.checkFolderAccess(userId, folderId, 'manage');
    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden: You don't have permission to delete this folder" });
    }
    
    await eventFileService.deleteFolder(folderId);
    res.status(204).send();
  } catch (error: any) {
    console.error("[EventFiles] Failed to delete folder:", error);
    res.status(500).json({ error: error.message || "Failed to delete folder" });
  }
});

// ==================== File Routes ====================

/**
 * POST /api/folders/:folderId/files
 * Upload a file to a folder
 */
router.post("/folders/:folderId/files", isAuthenticated, upload.single("file"), async (req, res) => {
  try {
    const folderId = parseInt(req.params.folderId);
    const userId = req.user!.id;
    
    // Check upload access
    const hasAccess = await folderPermissionService.checkFolderAccess(userId, folderId, 'upload');
    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden: You don't have permission to upload files" });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }
    
    const file = await eventFileService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folderId,
      userId
    );
    
    res.status(201).json(file);
  } catch (error: any) {
    console.error("[EventFiles] Failed to upload file:", error);
    res.status(500).json({ error: error.message || "Failed to upload file" });
  }
});

/**
 * GET /api/files/:fileId
 * Get file metadata and signed URLs
 */
router.get("/files/:fileId", isAuthenticated, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);
    const userId = req.user!.id;
    
    // Check access
    const hasAccess = await folderPermissionService.checkFileAccess(userId, fileId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this file" });
    }
    
    const file = await eventFileService.getFileWithFolder(fileId);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    
    const downloadUrl = eventFileService.getSignedFileUrl(file);
    const thumbnailUrl = eventFileService.getSignedThumbnailUrl(file);
    
    res.json({
      ...file,
      downloadUrl,
      thumbnailUrl,
    });
  } catch (error: any) {
    console.error("[EventFiles] Failed to get file:", error);
    res.status(500).json({ error: error.message || "Failed to get file" });
  }
});

/**
 * GET /api/files/:fileId/download
 * Download a file directly
 */
router.get("/files/:fileId/download", isAuthenticated, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);
    const userId = req.user!.id;
    
    // Check access
    const hasAccess = await folderPermissionService.checkFileAccess(userId, fileId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this file" });
    }
    
    const file = await eventFileService.getFile(fileId);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    
    // Download file from MinIO
    const buffer = await minioService.getEventFileBuffer(file.objectKey);
    
    // Properly encode filename for Content-Disposition header
    // Support both ASCII and UTF-8 filenames
    const encodedFileName = encodeURIComponent(file.originalFileName);
    const asciiFileName = file.originalFileName.replace(/[^\x00-\x7F]/g, '_');
    
    // Set headers for download
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Length", file.fileSize);
    res.setHeader("Content-Disposition", `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`);
    
    // Stream the file
    res.send(buffer);
  } catch (error: any) {
    console.error("[EventFiles] Failed to download file:", error);
    res.status(500).json({ error: error.message || "Failed to download file" });
  }
});

/**
 * DELETE /api/files/:fileId
 * Delete a file
 */
router.delete("/files/:fileId", isAuthenticated, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);
    const userId = req.user!.id;
    
    // Check manage access
    const hasAccess = await folderPermissionService.checkFileAccess(userId, fileId, 'manage');
    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden: You don't have permission to delete this file" });
    }
    
    await eventFileService.deleteFile(fileId);
    res.status(204).send();
  } catch (error: any) {
    console.error("[EventFiles] Failed to delete file:", error);
    res.status(500).json({ error: error.message || "Failed to delete file" });
  }
});

/**
 * POST /api/files/:fileId/move
 * Move a file to a different folder
 */
router.post("/files/:fileId/move", isAuthenticated, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);
    const userId = req.user!.id;
    
    const schema = z.object({
      destinationFolderId: z.number().int().positive(),
    });
    
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: fromError(result.error).toString() });
    }
    
    // Check manage access on source file
    const hasSourceAccess = await folderPermissionService.checkFileAccess(userId, fileId, 'manage');
    if (!hasSourceAccess) {
      return res.status(403).json({ error: "Forbidden: You don't have permission to move this file" });
    }
    
    // Check upload access on destination folder
    const hasDestAccess = await folderPermissionService.checkFolderAccess(
      userId,
      result.data.destinationFolderId,
      'upload'
    );
    if (!hasDestAccess) {
      return res.status(403).json({ error: "Forbidden: You don't have permission to upload to the destination folder" });
    }
    
    const file = await eventFileService.moveFile(fileId, result.data.destinationFolderId);
    res.json(file);
  } catch (error: any) {
    console.error("[EventFiles] Failed to move file:", error);
    res.status(500).json({ error: error.message || "Failed to move file" });
  }
});

/**
 * POST /api/files/:fileId/copy
 * Copy a file to a different folder
 */
router.post("/files/:fileId/copy", isAuthenticated, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);
    const userId = req.user!.id;
    
    const schema = z.object({
      destinationFolderId: z.number().int().positive(),
    });
    
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: fromError(result.error).toString() });
    }
    
    // Check view access on source file (need to read it)
    const hasSourceAccess = await folderPermissionService.checkFileAccess(userId, fileId);
    if (!hasSourceAccess) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this file" });
    }
    
    // Check upload access on destination folder
    const hasDestAccess = await folderPermissionService.checkFolderAccess(
      userId,
      result.data.destinationFolderId,
      'upload'
    );
    if (!hasDestAccess) {
      return res.status(403).json({ error: "Forbidden: You don't have permission to upload to the destination folder" });
    }
    
    const file = await eventFileService.copyFile(fileId, result.data.destinationFolderId, userId);
    res.json(file);
  } catch (error: any) {
    console.error("[EventFiles] Failed to copy file:", error);
    res.status(500).json({ error: error.message || "Failed to copy file" });
  }
});

/**
 * GET /api/event-files/* 
 * Download a file (signed URL verification)
 */
router.get("/event-files/:objectKey(*)", async (req, res) => {
  try {
    const objectKey = decodeURIComponent(req.params.objectKey);
    const { expires, sig } = req.query;
    
    if (!expires || !sig) {
      return res.status(400).json({ error: "Missing expires or sig parameter" });
    }
    
    // Verify signature
    const isValid = minioService.verifySignedEventFileUrl(objectKey, expires as string, sig as string);
    if (!isValid) {
      return res.status(403).json({ error: "Invalid or expired signature" });
    }
    
    // Get file from MinIO
    const buffer = await minioService.getEventFileBuffer(objectKey);
    const metadata = await minioService.getEventFileMetadata(objectKey);
    
    // Set headers
    res.setHeader("Content-Type", metadata.contentType);
    res.setHeader("Content-Length", metadata.contentLength);
    
    // Get original filename from object key
    const filename = objectKey.split("/").pop() || "file";
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    
    res.send(buffer);
  } catch (error: any) {
    console.error("[EventFiles] Failed to download file:", error);
    res.status(500).json({ error: error.message || "Failed to download file" });
  }
});

// ==================== Permission Template Routes ====================

/**
 * GET /api/folder-templates
 * Get all permission templates
 */
router.get("/folder-templates", isAuthenticated, async (req, res) => {
  try {
    // Only admins can view templates
    if (!isAdminRole(req.user!.role)) {
      return res.status(403).json({ error: "Forbidden: Only admins can view templates" });
    }
    
    const templates = await folderPermissionService.getAllTemplates();
    res.json(templates);
  } catch (error: any) {
    console.error("[EventFiles] Failed to get templates:", error);
    res.status(500).json({ error: error.message || "Failed to get templates" });
  }
});

/**
 * POST /api/folder-templates
 * Create a new permission template
 */
router.post("/folder-templates", isAuthenticated, async (req, res) => {
  try {
    // Only admins can create templates
    if (!isAdminRole(req.user!.role)) {
      return res.status(403).json({ error: "Forbidden: Only admins can create templates" });
    }
    
    const schema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      permissions: z.record(z.any()),
      isDefault: z.boolean().optional(),
    });
    
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: fromError(result.error).toString() });
    }
    
    const template = await folderPermissionService.createTemplate({
      ...result.data,
      createdByUserId: req.user!.id,
    });
    
    res.status(201).json(template);
  } catch (error: any) {
    console.error("[EventFiles] Failed to create template:", error);
    res.status(500).json({ error: error.message || "Failed to create template" });
  }
});

/**
 * PUT /api/folder-templates/:id
 * Update a permission template
 */
router.put("/folder-templates/:id", isAuthenticated, async (req, res) => {
  try {
    // Only admins can update templates
    if (!isAdminRole(req.user!.role)) {
      return res.status(403).json({ error: "Forbidden: Only admins can update templates" });
    }
    
    const id = parseInt(req.params.id);
    
    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional().nullable(),
      permissions: z.record(z.any()).optional(),
      isDefault: z.boolean().optional(),
    });
    
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: fromError(result.error).toString() });
    }
    
    const template = await folderPermissionService.updateTemplate(id, result.data);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    
    res.json(template);
  } catch (error: any) {
    console.error("[EventFiles] Failed to update template:", error);
    res.status(500).json({ error: error.message || "Failed to update template" });
  }
});

/**
 * DELETE /api/folder-templates/:id
 * Delete a permission template
 */
router.delete("/folder-templates/:id", isAuthenticated, async (req, res) => {
  try {
    // Only admins can delete templates
    if (!isAdminRole(req.user!.role)) {
      return res.status(403).json({ error: "Forbidden: Only admins can delete templates" });
    }
    
    const id = parseInt(req.params.id);
    const deleted = await folderPermissionService.deleteTemplate(id);
    
    if (!deleted) {
      return res.status(404).json({ error: "Template not found" });
    }
    
    res.status(204).send();
  } catch (error: any) {
    console.error("[EventFiles] Failed to delete template:", error);
    res.status(500).json({ error: error.message || "Failed to delete template" });
  }
});

// ==================== Event Access Grant Routes ====================

/**
 * GET /api/events/:eventId/access
 * Get all users with access to an event
 */
router.get("/events/:eventId/access", isAuthenticated, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Only admins can view access grants
    if (!isAdminRole(req.user!.role)) {
      return res.status(403).json({ error: "Forbidden: Only admins can view access grants" });
    }
    
    const grants = await folderPermissionService.getEventAccessUsers(eventId);
    res.json(grants);
  } catch (error: any) {
    console.error("[EventFiles] Failed to get access grants:", error);
    res.status(500).json({ error: error.message || "Failed to get access grants" });
  }
});

/**
 * POST /api/events/:eventId/access
 * Grant event-wide file access to a user
 */
router.post("/events/:eventId/access", isAuthenticated, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Only admins can grant access
    if (!isAdminRole(req.user!.role)) {
      return res.status(403).json({ error: "Forbidden: Only admins can grant access" });
    }
    
    const schema = z.object({
      userId: z.number().int().positive(),
      permissionLevel: z.enum(['view', 'upload', 'manage']),
      templateId: z.number().int().positive().optional(),
    });
    
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: fromError(result.error).toString() });
    }
    
    const grant = await folderPermissionService.grantEventAccess(
      eventId,
      result.data.userId,
      result.data.permissionLevel,
      req.user!.id,
      result.data.templateId
    );
    
    res.status(201).json(grant);
  } catch (error: any) {
    console.error("[EventFiles] Failed to grant access:", error);
    res.status(500).json({ error: error.message || "Failed to grant access" });
  }
});

/**
 * DELETE /api/events/:eventId/access/:userId
 * Revoke event-wide file access from a user
 */
router.delete("/events/:eventId/access/:userId", isAuthenticated, async (req, res) => {
  try {
    const { eventId, userId } = req.params;
    
    // Only admins can revoke access
    if (!isAdminRole(req.user!.role)) {
      return res.status(403).json({ error: "Forbidden: Only admins can revoke access" });
    }
    
    const revoked = await folderPermissionService.revokeEventAccess(eventId, parseInt(userId));
    
    if (!revoked) {
      return res.status(404).json({ error: "Access grant not found" });
    }
    
    res.status(204).send();
  } catch (error: any) {
    console.error("[EventFiles] Failed to revoke access:", error);
    res.status(500).json({ error: error.message || "Failed to revoke access" });
  }
});

// ==================== Folder Permission Routes ====================

/**
 * GET /api/folders/:folderId/access
 * Get all users with access to a folder
 */
router.get("/folders/:folderId/access", isAuthenticated, async (req, res) => {
  try {
    const folderId = parseInt(req.params.folderId);
    
    // Only admins can view access
    if (!isAdminRole(req.user!.role)) {
      return res.status(403).json({ error: "Forbidden: Only admins can view folder access" });
    }
    
    const permissions = await folderPermissionService.getFolderAccessUsers(folderId);
    res.json(permissions);
  } catch (error: any) {
    console.error("[EventFiles] Failed to get folder access:", error);
    res.status(500).json({ error: error.message || "Failed to get folder access" });
  }
});

/**
 * POST /api/folders/:folderId/access
 * Grant folder-level permission to a user
 */
router.post("/folders/:folderId/access", isAuthenticated, async (req, res) => {
  try {
    const folderId = parseInt(req.params.folderId);
    
    // Only admins can grant folder access
    if (!isAdminRole(req.user!.role)) {
      return res.status(403).json({ error: "Forbidden: Only admins can grant folder access" });
    }
    
    const schema = z.object({
      userId: z.number().int().positive(),
      permissionLevel: z.enum(['view', 'upload', 'manage']),
    });
    
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: fromError(result.error).toString() });
    }
    
    const permission = await folderPermissionService.grantFolderAccess(
      folderId,
      result.data.userId,
      result.data.permissionLevel,
      req.user!.id
    );
    
    res.status(201).json(permission);
  } catch (error: any) {
    console.error("[EventFiles] Failed to grant folder access:", error);
    res.status(500).json({ error: error.message || "Failed to grant folder access" });
  }
});

/**
 * DELETE /api/folders/:folderId/access/:userId
 * Revoke folder-level permission from a user
 */
router.delete("/folders/:folderId/access/:userId", isAuthenticated, async (req, res) => {
  try {
    const folderId = parseInt(req.params.folderId);
    const userId = parseInt(req.params.userId);
    
    // Only admins can revoke folder access
    if (!isAdminRole(req.user!.role)) {
      return res.status(403).json({ error: "Forbidden: Only admins can revoke folder access" });
    }
    
    const revoked = await folderPermissionService.revokeFolderAccess(folderId, userId);
    
    if (!revoked) {
      return res.status(404).json({ error: "Folder permission not found" });
    }
    
    res.status(204).send();
  } catch (error: any) {
    console.error("[EventFiles] Failed to revoke folder access:", error);
    res.status(500).json({ error: error.message || "Failed to revoke folder access" });
  }
});

/**
 * GET /api/user/accessible-events
 * Get all events the current user has file access to
 */
router.get("/user/accessible-events", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const eventIds = await folderPermissionService.getUserAccessibleEvents(userId);
    res.json({ eventIds });
  } catch (error: any) {
    console.error("[EventFiles] Failed to get accessible events:", error);
    res.status(500).json({ error: error.message || "Failed to get accessible events" });
  }
});

/**
 * GET /api/admin/all-event-files
 * Get all event files across all events (superadmin only)
 */
router.get("/admin/all-event-files", isAuthenticated, async (req, res) => {
  try {
    // Only superadmins can view all event files
    if (req.user!.role !== 'superadmin') {
      return res.status(403).json({ error: "Forbidden: Only superadmins can view all event files" });
    }
    
    const files = await eventFileService.getAllEventFiles();
    res.json(files);
  } catch (error: any) {
    console.error("[EventFiles] Failed to get all event files:", error);
    res.status(500).json({ error: error.message || "Failed to get all event files" });
  }
});

export default router;
