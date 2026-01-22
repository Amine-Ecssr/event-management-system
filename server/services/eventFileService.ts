/**
 * Event File Service
 * 
 * Handles all event file and folder operations including:
 * - Folder initialization and management
 * - File upload/download/delete
 * - File copy/move operations
 * - Integration with MinIO storage
 */

import { db } from "../db";
import { 
  eventFolders, 
  eventFiles, 
  events,
  type InsertEventFolder, 
  type InsertEventFile,
  type EventFolder,
  type EventFile,
} from "@shared/schema";
import { eq, and, sql, inArray, isNull } from "drizzle-orm";
import { 
  minioService,
  type FileUploadResult,
  type FolderContentItem,
} from "./minio";

// Default folder structure for events
const DEFAULT_FOLDERS = ['Documents', 'Task Attachments', 'Meeting Notes', 'Media'];

// Subfolder structure for task attachments
const TASK_ATTACHMENTS_FOLDER = 'Task Attachments';

/**
 * Initialize default folder structure for a new event
 * Creates database records and MinIO folder markers
 */
export async function initializeEventFolders(eventId: string, userId?: number): Promise<EventFolder[]> {
  // Check if event exists
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) {
    throw new Error(`Event ${eventId} not found`);
  }
  
  // Check if folders already exist
  const existingFolders = await db
    .select()
    .from(eventFolders)
    .where(eq(eventFolders.eventId, eventId));
  
  if (existingFolders.length > 0) {
    console.log(`[EventFileService] Event ${eventId} already has folders initialized`);
    return existingFolders;
  }
  
  // Initialize MinIO folders
  await minioService.initializeEventFolders(eventId);
  
  // Create database records for default folders
  const createdFolders: EventFolder[] = [];
  
  for (const folderName of DEFAULT_FOLDERS) {
    const folderData: InsertEventFolder = {
      eventId,
      name: folderName,
      parentFolderId: null,
      path: `/${folderName}`,
      createdByUserId: userId,
    };
    
    const [folder] = await db
      .insert(eventFolders)
      .values(folderData)
      .returning();
    
    createdFolders.push(folder);
  }
  
  console.log(`[EventFileService] Initialized ${createdFolders.length} folders for event ${eventId}`);
  return createdFolders;
}

/**
 * Get all folders for an event
 */
export async function getEventFolders(eventId: string): Promise<EventFolder[]> {
  return await db
    .select()
    .from(eventFolders)
    .where(eq(eventFolders.eventId, eventId));
}

/**
 * Get folder by ID
 */
export async function getFolder(folderId: number): Promise<EventFolder | undefined> {
  const [folder] = await db
    .select()
    .from(eventFolders)
    .where(eq(eventFolders.id, folderId));
  return folder;
}

/**
 * Get folder by path for an event
 */
export async function getFolderByPath(eventId: string, path: string): Promise<EventFolder | undefined> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const [folder] = await db
    .select()
    .from(eventFolders)
    .where(and(
      eq(eventFolders.eventId, eventId),
      eq(eventFolders.path, normalizedPath)
    ));
  return folder;
}

/**
 * Get root folders for an event (folders with no parent)
 */
export async function getRootFolders(eventId: string): Promise<EventFolder[]> {
  return await db
    .select()
    .from(eventFolders)
    .where(and(
      eq(eventFolders.eventId, eventId),
      isNull(eventFolders.parentFolderId)
    ));
}

/**
 * Get child folders of a parent folder
 */
export async function getChildFolders(parentFolderId: number): Promise<EventFolder[]> {
  return await db
    .select()
    .from(eventFolders)
    .where(eq(eventFolders.parentFolderId, parentFolderId));
}

/**
 * Create a new folder
 */
export async function createFolder(
  eventId: string,
  name: string,
  parentFolderId: number | null,
  userId?: number
): Promise<EventFolder> {
  // Validate parent folder if provided
  let parentPath = '';
  if (parentFolderId) {
    const parentFolder = await getFolder(parentFolderId);
    if (!parentFolder) {
      throw new Error(`Parent folder ${parentFolderId} not found`);
    }
    if (parentFolder.eventId !== eventId) {
      throw new Error(`Parent folder does not belong to event ${eventId}`);
    }
    parentPath = parentFolder.path;
  }
  
  const folderPath = `${parentPath}/${name}`;
  
  // Check if folder already exists
  const existing = await getFolderByPath(eventId, folderPath);
  if (existing) {
    throw new Error(`Folder already exists at path: ${folderPath}`);
  }
  
  // Create MinIO folder marker
  await minioService.createFolder(eventId, folderPath.substring(1)); // Remove leading slash for MinIO
  
  // Create database record
  const [folder] = await db
    .insert(eventFolders)
    .values({
      eventId,
      name,
      parentFolderId,
      path: folderPath,
      createdByUserId: userId,
    })
    .returning();
  
  console.log(`[EventFileService] Created folder: ${folderPath} for event ${eventId}`);
  return folder;
}

/**
 * Delete a folder and all its contents
 */
export async function deleteFolder(folderId: number): Promise<void> {
  const folder = await getFolder(folderId);
  if (!folder) {
    throw new Error(`Folder ${folderId} not found`);
  }
  
  // Get all child folders recursively
  const allFolderIds = await getAllChildFolderIds(folderId);
  allFolderIds.push(folderId);
  
  // Delete files from MinIO
  const files = await db
    .select()
    .from(eventFiles)
    .where(inArray(eventFiles.eventFolderId, allFolderIds));
  
  for (const file of files) {
    await minioService.deleteEventFile(file.objectKey, file.thumbnailKey || undefined);
  }
  
  // Delete MinIO folder
  await minioService.deleteFolderRecursive(folder.eventId, folder.path.substring(1));
  
  // Delete database records (cascade will handle files and child folders)
  await db.delete(eventFolders).where(eq(eventFolders.id, folderId));
  
  console.log(`[EventFileService] Deleted folder ${folderId} and all contents`);
}

/**
 * Get all child folder IDs recursively
 */
async function getAllChildFolderIds(parentFolderId: number): Promise<number[]> {
  const children = await getChildFolders(parentFolderId);
  const childIds = children.map(f => f.id);
  
  for (const child of children) {
    const grandChildIds = await getAllChildFolderIds(child.id);
    childIds.push(...grandChildIds);
  }
  
  return childIds;
}

/**
 * List contents of a folder (files and subfolders)
 */
export async function listFolderContents(folderId: number): Promise<{
  folders: EventFolder[];
  files: EventFile[];
}> {
  const folder = await getFolder(folderId);
  if (!folder) {
    throw new Error(`Folder ${folderId} not found`);
  }
  
  const folders = await getChildFolders(folderId);
  const files = await db
    .select()
    .from(eventFiles)
    .where(eq(eventFiles.eventFolderId, folderId));
  
  return { folders, files };
}

/**
 * Upload a file to a folder
 */
export async function uploadFile(
  buffer: Buffer,
  originalFileName: string,
  mimeType: string,
  folderId: number,
  userId?: number,
  sourceType: 'upload' | 'task_comment' | 'agenda' = 'upload',
  sourceId?: number
): Promise<EventFile> {
  const folder = await getFolder(folderId);
  if (!folder) {
    throw new Error(`Folder ${folderId} not found`);
  }
  
  // Upload to MinIO
  const minioPath = folder.path.substring(1); // Remove leading slash
  const uploadResult = await minioService.uploadEventFile(
    buffer,
    originalFileName,
    mimeType,
    folder.eventId,
    minioPath
  );
  
  // Create database record
  const [file] = await db
    .insert(eventFiles)
    .values({
      eventFolderId: folderId,
      objectKey: uploadResult.objectKey,
      thumbnailKey: uploadResult.thumbnailKey,
      originalFileName: uploadResult.originalFileName,
      mimeType: uploadResult.mimeType,
      fileSize: uploadResult.fileSize,
      sourceType,
      sourceId,
      uploadedByUserId: userId,
    })
    .returning();
  
  console.log(`[EventFileService] Uploaded file: ${originalFileName} to folder ${folderId}`);
  return file;
}

/**
 * Upload a file from a task comment
 * Automatically places it in the Task Attachments/{taskTitle} folder
 */
export async function uploadTaskCommentFile(
  buffer: Buffer,
  originalFileName: string,
  mimeType: string,
  eventId: string,
  taskTitle: string,
  commentId: number,
  userId?: number
): Promise<EventFile> {
  // Get or create Task Attachments folder
  let taskAttachmentsFolder = await getFolderByPath(eventId, `/${TASK_ATTACHMENTS_FOLDER}`);
  if (!taskAttachmentsFolder) {
    // Initialize folders if not exists
    await initializeEventFolders(eventId, userId);
    taskAttachmentsFolder = await getFolderByPath(eventId, `/${TASK_ATTACHMENTS_FOLDER}`);
  }
  
  if (!taskAttachmentsFolder) {
    throw new Error(`Task Attachments folder not found for event ${eventId}`);
  }
  
  // Sanitize task title for folder name
  const sanitizedTaskTitle = taskTitle.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
  
  // Get or create task-specific subfolder
  const taskFolderPath = `/${TASK_ATTACHMENTS_FOLDER}/${sanitizedTaskTitle}`;
  let taskFolder = await getFolderByPath(eventId, taskFolderPath);
  
  if (!taskFolder) {
    taskFolder = await createFolder(
      eventId,
      sanitizedTaskTitle,
      taskAttachmentsFolder.id,
      userId
    );
  }
  
  // Upload file to the task folder
  return await uploadFile(
    buffer,
    originalFileName,
    mimeType,
    taskFolder.id,
    userId,
    'task_comment',
    commentId
  );
}

/**
 * Get file by ID
 */
export async function getFile(fileId: number): Promise<EventFile | undefined> {
  const [file] = await db
    .select()
    .from(eventFiles)
    .where(eq(eventFiles.id, fileId));
  return file;
}

/**
 * Get file with folder info
 */
export async function getFileWithFolder(fileId: number): Promise<(EventFile & { folder: EventFolder }) | undefined> {
  const result = await db
    .select()
    .from(eventFiles)
    .innerJoin(eventFolders, eq(eventFiles.eventFolderId, eventFolders.id))
    .where(eq(eventFiles.id, fileId))
    .limit(1);
  
  if (result.length === 0) return undefined;
  
  return {
    ...result[0].event_files,
    folder: result[0].event_folders,
  };
}

/**
 * Download a file
 */
export async function downloadFile(fileId: number): Promise<{ buffer: Buffer; file: EventFile }> {
  const file = await getFile(fileId);
  if (!file) {
    throw new Error(`File ${fileId} not found`);
  }
  
  const buffer = await minioService.getEventFileBuffer(file.objectKey);
  return { buffer, file };
}

/**
 * Delete a file
 */
export async function deleteFile(fileId: number): Promise<void> {
  const file = await getFile(fileId);
  if (!file) {
    throw new Error(`File ${fileId} not found`);
  }
  
  // Delete from MinIO
  await minioService.deleteEventFile(file.objectKey, file.thumbnailKey || undefined);
  
  // Delete database record
  await db.delete(eventFiles).where(eq(eventFiles.id, fileId));
  
  console.log(`[EventFileService] Deleted file ${fileId}`);
}

/**
 * Move a file to a different folder
 */
export async function moveFile(
  fileId: number,
  destinationFolderId: number
): Promise<EventFile> {
  const file = await getFile(fileId);
  if (!file) {
    throw new Error(`File ${fileId} not found`);
  }
  
  const destFolder = await getFolder(destinationFolderId);
  if (!destFolder) {
    throw new Error(`Destination folder ${destinationFolderId} not found`);
  }
  
  // Move in MinIO
  const destMinioPath = destFolder.path.substring(1);
  const newObjectKey = await minioService.moveEventFile(
    file.objectKey,
    destFolder.eventId,
    destMinioPath
  );
  
  // Update database record
  const [updatedFile] = await db
    .update(eventFiles)
    .set({
      eventFolderId: destinationFolderId,
      objectKey: newObjectKey,
    })
    .where(eq(eventFiles.id, fileId))
    .returning();
  
  console.log(`[EventFileService] Moved file ${fileId} to folder ${destinationFolderId}`);
  return updatedFile;
}

/**
 * Copy a file to a different folder
 */
export async function copyFile(
  fileId: number,
  destinationFolderId: number,
  userId?: number
): Promise<EventFile> {
  const file = await getFile(fileId);
  if (!file) {
    throw new Error(`File ${fileId} not found`);
  }
  
  const destFolder = await getFolder(destinationFolderId);
  if (!destFolder) {
    throw new Error(`Destination folder ${destinationFolderId} not found`);
  }
  
  // Copy in MinIO
  const destMinioPath = destFolder.path.substring(1);
  const newObjectKey = await minioService.copyEventFile(
    file.objectKey,
    destFolder.eventId,
    destMinioPath
  );
  
  // Create new database record
  const [newFile] = await db
    .insert(eventFiles)
    .values({
      eventFolderId: destinationFolderId,
      objectKey: newObjectKey,
      thumbnailKey: null, // Thumbnails are not copied
      originalFileName: file.originalFileName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      sourceType: 'upload',
      sourceId: null,
      uploadedByUserId: userId,
    })
    .returning();
  
  console.log(`[EventFileService] Copied file ${fileId} to folder ${destinationFolderId}`);
  return newFile;
}

/**
 * Get all files for an event
 */
export async function getEventFiles(eventId: string): Promise<EventFile[]> {
  const folders = await getEventFolders(eventId);
  const folderIds = folders.map(f => f.id);
  
  if (folderIds.length === 0) return [];
  
  return await db
    .select()
    .from(eventFiles)
    .where(inArray(eventFiles.eventFolderId, folderIds));
}

/**
 * Get files by source (e.g., all files from task comments)
 */
export async function getFilesBySource(
  eventId: string,
  sourceType: 'upload' | 'task_comment' | 'agenda',
  sourceId?: number
): Promise<EventFile[]> {
  const folders = await getEventFolders(eventId);
  const folderIds = folders.map(f => f.id);
  
  if (folderIds.length === 0) return [];
  
  if (sourceId !== undefined) {
    return await db
      .select()
      .from(eventFiles)
      .where(and(
        inArray(eventFiles.eventFolderId, folderIds),
        eq(eventFiles.sourceType, sourceType),
        eq(eventFiles.sourceId, sourceId)
      ));
  }
  
  return await db
    .select()
    .from(eventFiles)
    .where(and(
      inArray(eventFiles.eventFolderId, folderIds),
      eq(eventFiles.sourceType, sourceType)
    ));
}

/**
 * Get signed URL for file access
 */
export function getSignedFileUrl(file: EventFile): string {
  return minioService.generateSignedEventFileUrl(file.objectKey);
}

/**
 * Get signed URL for thumbnail
 */
export function getSignedThumbnailUrl(file: EventFile): string | null {
  if (!file.thumbnailKey) return null;
  return minioService.generateSignedEventFileUrl(file.thumbnailKey);
}

/**
 * Get all event files across all events (admin only)
 */
export async function getAllEventFiles() {
  const files = await db
    .select({
      id: eventFiles.id,
      eventFolderId: eventFiles.eventFolderId,
      objectKey: eventFiles.objectKey,
      thumbnailKey: eventFiles.thumbnailKey,
      originalFileName: eventFiles.originalFileName,
      mimeType: eventFiles.mimeType,
      fileSize: eventFiles.fileSize,
      sourceType: eventFiles.sourceType,
      sourceId: eventFiles.sourceId,
      uploadedByUserId: eventFiles.uploadedByUserId,
      uploadedAt: eventFiles.uploadedAt,
      folder: {
        id: eventFolders.id,
        eventId: eventFolders.eventId,
        name: eventFolders.name,
        path: eventFolders.path,
      },
      event: {
        id: events.id,
        name: events.name,
      },
    })
    .from(eventFiles)
    .innerJoin(eventFolders, eq(eventFiles.eventFolderId, eventFolders.id))
    .innerJoin(events, eq(eventFolders.eventId, events.id))
    .orderBy(eventFiles.uploadedAt);
  
  return files;
}

export const eventFileService = {
  initializeEventFolders,
  getEventFolders,
  getFolder,
  getFolderByPath,
  getRootFolders,
  getChildFolders,
  createFolder,
  deleteFolder,
  listFolderContents,
  uploadFile,
  uploadTaskCommentFile,
  getFile,
  getFileWithFolder,
  downloadFile,
  deleteFile,
  moveFile,
  copyFile,
  getEventFiles,
  getFilesBySource,
  getSignedFileUrl,
  getSignedThumbnailUrl,
  getAllEventFiles,
};
