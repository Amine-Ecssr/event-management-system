/**
 * MinIO Service for Archive Media Storage
 * 
 * This service handles uploading, downloading, and managing images
 * for the Events Archive (الحصاد) feature.
 * 
 * Features:
 * - Image upload with automatic thumbnail generation
 * - Signed URL generation for secure access
 * - Image deletion
 * - Bucket management
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
  CreateBucketCommand,
  CopyObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { randomUUID, createHmac } from 'crypto';
import path from 'path';

// Configuration from environment variables
const MINIO_CONFIG = {
  endpoint: `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`,
  accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  bucket: process.env.MINIO_BUCKET || 'ecssr-archive',
  eventsBucket: process.env.MINIO_EVENTS_BUCKET || 'ecssr-events',
  useSSL: process.env.MINIO_USE_SSL === 'true',
};

// Constants
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILE_SIZE = parseInt(process.env.MINIO_MAX_FILE_SIZE || '52428800', 10); // 50MB default for general file uploads
const THUMBNAIL_WIDTH = 300;
const THUMBNAIL_HEIGHT = 200;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Folder marker for creating virtual folders in MinIO
const FOLDER_MARKER = '.folder';

// Default folder structure for events
const DEFAULT_EVENT_FOLDERS = ['Documents', 'Task Attachments', 'Meeting Notes', 'Media'];

// Export for use in other modules
export { MAX_FILE_SIZE };

// S3 Client instance
let s3Client: S3Client | null = null;

/**
 * Get or initialize the S3 client
 */
function getClient(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: MINIO_CONFIG.endpoint,
      region: 'us-east-1', // MinIO requires a region, but it's not used
      credentials: {
        accessKeyId: MINIO_CONFIG.accessKeyId,
        secretAccessKey: MINIO_CONFIG.secretAccessKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }
  return s3Client;
}

/**
 * Ensure the archive bucket exists (cached for performance)
 */
let bucketChecked = false;
let eventsBucketChecked = false;

async function ensureBucket(): Promise<void> {
  if (bucketChecked) {
    return;
  }
  
  const client = getClient();
  try {
    await client.send(new HeadBucketCommand({ Bucket: MINIO_CONFIG.bucket }));
    bucketChecked = true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.log(`[MinIO] Creating bucket: ${MINIO_CONFIG.bucket}`);
      await client.send(new CreateBucketCommand({ Bucket: MINIO_CONFIG.bucket }));
      bucketChecked = true;
    } else {
      throw error;
    }
  }
}

/**
 * Ensure the events bucket exists for file storage feature
 */
async function ensureEventsBucket(): Promise<void> {
  if (eventsBucketChecked) {
    return;
  }
  
  const client = getClient();
  try {
    await client.send(new HeadBucketCommand({ Bucket: MINIO_CONFIG.eventsBucket }));
    eventsBucketChecked = true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.log(`[MinIO] Creating events bucket: ${MINIO_CONFIG.eventsBucket}`);
      await client.send(new CreateBucketCommand({ Bucket: MINIO_CONFIG.eventsBucket }));
      eventsBucketChecked = true;
    } else {
      throw error;
    }
  }
}

/**
 * Generate a unique object key for an image
 */
function generateObjectKey(originalFileName: string, isThumb: boolean = false): string {
  const ext = path.extname(originalFileName).toLowerCase();
  const uuid = randomUUID();
  const prefix = isThumb ? 'thumbnails' : 'photos';
  return `${prefix}/${uuid}${ext}`;
}

/**
 * Validate image file
 */
function validateImage(buffer: Buffer, mimeType: string): void {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }
  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error(`File size (${(buffer.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (5MB)`);
  }
}

export interface UploadResult {
  objectKey: string;
  thumbnailKey: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
}

/**
 * Upload an image with automatic thumbnail generation
 */
export async function uploadImage(
  buffer: Buffer,
  originalFileName: string,
  mimeType: string
): Promise<UploadResult> {
  // Validate the image
  validateImage(buffer, mimeType);
  
  await ensureBucket();
  const client = getClient();
  
  // Get image metadata using Sharp
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  
  // Generate object keys
  const objectKey = generateObjectKey(originalFileName, false);
  const thumbnailKey = generateObjectKey(originalFileName, true);
  
  // Generate thumbnail
  const thumbnail = await image
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
      fit: 'cover',
      position: 'center',
    })
    .jpeg({ quality: 80 })
    .toBuffer();
  
  // Upload original image
  await client.send(new PutObjectCommand({
    Bucket: MINIO_CONFIG.bucket,
    Key: objectKey,
    Body: buffer,
    ContentType: mimeType,
    Metadata: {
      'original-filename': encodeURIComponent(originalFileName),
      'width': String(width),
      'height': String(height),
    },
  }));
  
  // Upload thumbnail
  await client.send(new PutObjectCommand({
    Bucket: MINIO_CONFIG.bucket,
    Key: thumbnailKey,
    Body: thumbnail,
    ContentType: 'image/jpeg',
    Metadata: {
      'original-key': objectKey,
    },
  }));
  
  console.log(`[MinIO] Uploaded image: ${objectKey} with thumbnail: ${thumbnailKey}`);
  
  return {
    objectKey,
    thumbnailKey,
    originalFileName,
    mimeType,
    fileSize: buffer.length,
    width,
    height,
  };
}

/**
 * Get a signed URL for accessing an image
 * URLs expire after the specified duration (default: 1 hour)
 */
export async function getSignedUrl(
  objectKey: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: MINIO_CONFIG.bucket,
    Key: objectKey,
  });
  
  const url = await getS3SignedUrl(client, command, { expiresIn });
  return url;
}

/**
 * Get signed URLs for both image and thumbnail
 */
export async function getSignedUrls(
  objectKey: string,
  thumbnailKey: string,
  expiresIn: number = 3600
): Promise<{ imageUrl: string; thumbnailUrl: string }> {
  const [imageUrl, thumbnailUrl] = await Promise.all([
    getSignedUrl(objectKey, expiresIn),
    getSignedUrl(thumbnailKey, expiresIn),
  ]);
  
  return { imageUrl, thumbnailUrl };
}

/**
 * Delete an image and its thumbnail from storage
 */
export async function deleteImage(objectKey: string, thumbnailKey?: string): Promise<void> {
  const client = getClient();
  
  // Delete original image
  await client.send(new DeleteObjectCommand({
    Bucket: MINIO_CONFIG.bucket,
    Key: objectKey,
  }));
  
  // Delete thumbnail if provided
  if (thumbnailKey) {
    await client.send(new DeleteObjectCommand({
      Bucket: MINIO_CONFIG.bucket,
      Key: thumbnailKey,
    }));
  }
  
  console.log(`[MinIO] Deleted image: ${objectKey}${thumbnailKey ? ` and thumbnail: ${thumbnailKey}` : ''}`);
}

/**
 * List all images for an archived event
 */
export async function listEventImages(prefix: string): Promise<string[]> {
  const client = getClient();
  
  const response = await client.send(new ListObjectsV2Command({
    Bucket: MINIO_CONFIG.bucket,
    Prefix: prefix,
  }));
  
  return (response.Contents || []).map(obj => obj.Key!).filter(Boolean);
}

/**
 * Get image buffer (for download)
 */
export async function getImageBuffer(objectKey: string): Promise<Buffer> {
  const client = getClient();
  
  const response = await client.send(new GetObjectCommand({
    Bucket: MINIO_CONFIG.bucket,
    Key: objectKey,
  }));
  
  if (!response.Body) {
    throw new Error(`Image not found: ${objectKey}`);
  }
  
  // Convert readable stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Check if MinIO is available and configured
 */
export async function isMinioAvailable(): Promise<boolean> {
  try {
    await ensureBucket();
    return true;
  } catch (error) {
    console.error('[MinIO] MinIO service is not available:', error);
    return false;
  }
}

/**
 * Get MinIO configuration status (for admin UI)
 */
export function getMinioConfig() {
  return {
    endpoint: MINIO_CONFIG.endpoint,
    bucket: MINIO_CONFIG.bucket,
    maxImageSize: MAX_IMAGE_SIZE,
    allowedTypes: ALLOWED_MIME_TYPES,
    thumbnailDimensions: { width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT },
  };
}

// Secret for signing media URLs (use SESSION_SECRET or generate one)
const MEDIA_SIGN_SECRET = process.env.SESSION_SECRET || process.env.MEDIA_SIGN_SECRET || 'change-this-media-secret';

/**
 * Generate a signed media proxy URL
 * This creates a URL like /media/{objectKey}?expires={timestamp}&sig={signature}
 * The signature ensures the URL hasn't been tampered with and is time-limited
 */
export function generateSignedMediaUrl(objectKey: string, expiresIn: number = 3600): string {
  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const dataToSign = `${objectKey}:${expires}`;
  const signature = createHmac('sha256', MEDIA_SIGN_SECRET)
    .update(dataToSign)
    .digest('hex')
    .slice(0, 32); // Use first 32 chars for shorter URL
  
  // Use /api/media/ which works in both dev (Vite) and prod (nginx proxies /api/*)
  return `/api/media/${encodeURIComponent(objectKey)}?expires=${expires}&sig=${signature}`;
}

/**
 * Verify a signed media URL
 * Returns the objectKey if valid, null if invalid or expired
 */
export function verifySignedMediaUrl(objectKey: string, expires: string, signature: string): boolean {
  // Check if expired
  const expiresNum = parseInt(expires, 10);
  if (isNaN(expiresNum) || expiresNum < Math.floor(Date.now() / 1000)) {
    return false;
  }
  
  // Verify signature
  const dataToSign = `${objectKey}:${expires}`;
  const expectedSig = createHmac('sha256', MEDIA_SIGN_SECRET)
    .update(dataToSign)
    .digest('hex')
    .slice(0, 32);
  
  // Timing-safe comparison
  if (signature.length !== expectedSig.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  return result === 0;
}

// ==================== Event File Storage Operations ====================

/**
 * Interface for folder content item
 */
export interface FolderContentItem {
  name: string;
  path: string;
  isFolder: boolean;
  size?: number;
  lastModified?: Date;
}

/**
 * Interface for file upload result (general files, not just images)
 */
export interface FileUploadResult {
  objectKey: string;
  thumbnailKey?: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
}

/**
 * Generate the object key path for event files
 * Format: events/{eventId}/{folderPath}/{filename}
 */
function generateEventObjectKey(eventId: string, folderPath: string, fileName: string): string {
  const sanitizedFolderPath = folderPath.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
  const sanitizedFileName = fileName.replace(/[<>:"|?*]/g, '_'); // Sanitize filename
  const basePath = `events/${eventId}`;
  
  if (sanitizedFolderPath) {
    return `${basePath}/${sanitizedFolderPath}/${sanitizedFileName}`;
  }
  return `${basePath}/${sanitizedFileName}`;
}

/**
 * Create a virtual folder in MinIO by creating a .folder marker
 */
export async function createFolder(eventId: string, folderPath: string): Promise<void> {
  await ensureEventsBucket();
  const client = getClient();
  
  const sanitizedPath = folderPath.replace(/^\/+|\/+$/g, '');
  const markerKey = `events/${eventId}/${sanitizedPath}/${FOLDER_MARKER}`;
  
  await client.send(new PutObjectCommand({
    Bucket: MINIO_CONFIG.eventsBucket,
    Key: markerKey,
    Body: '',
    ContentType: 'application/x-directory',
  }));
  
  console.log(`[MinIO] Created folder: ${markerKey}`);
}

/**
 * Initialize default folder structure for an event
 */
export async function initializeEventFolders(eventId: string): Promise<void> {
  await ensureEventsBucket();
  
  for (const folderName of DEFAULT_EVENT_FOLDERS) {
    await createFolder(eventId, folderName);
  }
  
  console.log(`[MinIO] Initialized default folders for event: ${eventId}`);
}

/**
 * List contents of a folder (files and subfolders)
 */
export async function listFolderContents(eventId: string, folderPath: string = ''): Promise<FolderContentItem[]> {
  await ensureEventsBucket();
  const client = getClient();
  
  const sanitizedPath = folderPath.replace(/^\/+|\/+$/g, '');
  const prefix = sanitizedPath 
    ? `events/${eventId}/${sanitizedPath}/`
    : `events/${eventId}/`;
  
  const response = await client.send(new ListObjectsV2Command({
    Bucket: MINIO_CONFIG.eventsBucket,
    Prefix: prefix,
    Delimiter: '/',
  }));
  
  const items: FolderContentItem[] = [];
  
  // Add folders (CommonPrefixes)
  if (response.CommonPrefixes) {
    for (const commonPrefix of response.CommonPrefixes) {
      if (commonPrefix.Prefix) {
        const folderName = commonPrefix.Prefix.slice(prefix.length, -1); // Remove prefix and trailing slash
        if (folderName) {
          items.push({
            name: folderName,
            path: sanitizedPath ? `${sanitizedPath}/${folderName}` : folderName,
            isFolder: true,
          });
        }
      }
    }
  }
  
  // Add files (Contents, excluding folder markers)
  if (response.Contents) {
    for (const content of response.Contents) {
      if (content.Key && !content.Key.endsWith(FOLDER_MARKER)) {
        const fileName = content.Key.slice(prefix.length);
        if (fileName && !fileName.includes('/')) { // Only direct children, not nested
          items.push({
            name: fileName,
            path: content.Key,
            isFolder: false,
            size: content.Size,
            lastModified: content.LastModified,
          });
        }
      }
    }
  }
  
  return items;
}

/**
 * Upload a file to an event folder
 * Supports image files with optional thumbnail generation
 */
export async function uploadEventFile(
  buffer: Buffer,
  originalFileName: string,
  mimeType: string,
  eventId: string,
  folderPath: string = ''
): Promise<FileUploadResult> {
  // Validate file size
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size (${(buffer.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (50MB)`);
  }
  
  await ensureEventsBucket();
  const client = getClient();
  
  const objectKey = generateEventObjectKey(eventId, folderPath, originalFileName);
  let thumbnailKey: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  
  // Generate thumbnail for images
  if (ALLOWED_MIME_TYPES.includes(mimeType)) {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();
      width = metadata.width;
      height = metadata.height;
      
      // Generate thumbnail
      const thumbnail = await image
        .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      // Upload thumbnail
      const thumbnailFileName = `thumb_${originalFileName.replace(/\.[^.]+$/, '.jpg')}`;
      thumbnailKey = generateEventObjectKey(eventId, `${folderPath}/.thumbnails`, thumbnailFileName);
      
      await client.send(new PutObjectCommand({
        Bucket: MINIO_CONFIG.eventsBucket,
        Key: thumbnailKey,
        Body: thumbnail,
        ContentType: 'image/jpeg',
      }));
    } catch (err) {
      console.warn(`[MinIO] Failed to generate thumbnail for ${originalFileName}:`, err);
    }
  }
  
  // Upload original file
  await client.send(new PutObjectCommand({
    Bucket: MINIO_CONFIG.eventsBucket,
    Key: objectKey,
    Body: buffer,
    ContentType: mimeType,
    Metadata: {
      'original-filename': encodeURIComponent(originalFileName),
    },
  }));
  
  console.log(`[MinIO] Uploaded event file: ${objectKey}`);
  
  return {
    objectKey,
    thumbnailKey,
    originalFileName,
    mimeType,
    fileSize: buffer.length,
    width,
    height,
  };
}

/**
 * Delete a file from event storage
 */
export async function deleteEventFile(objectKey: string, thumbnailKey?: string): Promise<void> {
  await ensureEventsBucket();
  const client = getClient();
  
  await client.send(new DeleteObjectCommand({
    Bucket: MINIO_CONFIG.eventsBucket,
    Key: objectKey,
  }));
  
  if (thumbnailKey) {
    try {
      await client.send(new DeleteObjectCommand({
        Bucket: MINIO_CONFIG.eventsBucket,
        Key: thumbnailKey,
      }));
    } catch (err) {
      console.warn(`[MinIO] Failed to delete thumbnail ${thumbnailKey}:`, err);
    }
  }
  
  console.log(`[MinIO] Deleted event file: ${objectKey}`);
}

/**
 * Delete a folder and all its contents recursively
 */
export async function deleteFolderRecursive(eventId: string, folderPath: string): Promise<number> {
  await ensureEventsBucket();
  const client = getClient();
  
  const sanitizedPath = folderPath.replace(/^\/+|\/+$/g, '');
  const prefix = `events/${eventId}/${sanitizedPath}/`;
  
  let deletedCount = 0;
  let continuationToken: string | undefined;
  
  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: MINIO_CONFIG.eventsBucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    
    if (response.Contents) {
      for (const content of response.Contents) {
        if (content.Key) {
          await client.send(new DeleteObjectCommand({
            Bucket: MINIO_CONFIG.eventsBucket,
            Key: content.Key,
          }));
          deletedCount++;
        }
      }
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  console.log(`[MinIO] Deleted folder ${prefix} with ${deletedCount} objects`);
  return deletedCount;
}

/**
 * Copy a file to a new location
 */
export async function copyEventFile(
  sourceKey: string,
  destEventId: string,
  destFolderPath: string,
  newFileName?: string
): Promise<string> {
  await ensureEventsBucket();
  const client = getClient();
  
  const fileName = newFileName || sourceKey.split('/').pop() || 'file';
  const destKey = generateEventObjectKey(destEventId, destFolderPath, fileName);
  
  await client.send(new CopyObjectCommand({
    Bucket: MINIO_CONFIG.eventsBucket,
    CopySource: `${MINIO_CONFIG.eventsBucket}/${sourceKey}`,
    Key: destKey,
  }));
  
  console.log(`[MinIO] Copied file from ${sourceKey} to ${destKey}`);
  return destKey;
}

/**
 * Move a file to a new location (copy + delete)
 */
export async function moveEventFile(
  sourceKey: string,
  destEventId: string,
  destFolderPath: string,
  newFileName?: string
): Promise<string> {
  const destKey = await copyEventFile(sourceKey, destEventId, destFolderPath, newFileName);
  await deleteEventFile(sourceKey);
  console.log(`[MinIO] Moved file from ${sourceKey} to ${destKey}`);
  return destKey;
}

/**
 * Get file buffer from events bucket
 */
export async function getEventFileBuffer(objectKey: string): Promise<Buffer> {
  await ensureEventsBucket();
  const client = getClient();
  
  const response = await client.send(new GetObjectCommand({
    Bucket: MINIO_CONFIG.eventsBucket,
    Key: objectKey,
  }));
  
  if (!response.Body) {
    throw new Error(`File not found: ${objectKey}`);
  }
  
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Get file metadata
 */
export async function getEventFileMetadata(objectKey: string): Promise<{
  contentType: string;
  contentLength: number;
  lastModified: Date | undefined;
  metadata: Record<string, string>;
}> {
  await ensureEventsBucket();
  const client = getClient();
  
  const response = await client.send(new HeadObjectCommand({
    Bucket: MINIO_CONFIG.eventsBucket,
    Key: objectKey,
  }));
  
  return {
    contentType: response.ContentType || 'application/octet-stream',
    contentLength: response.ContentLength || 0,
    lastModified: response.LastModified,
    metadata: response.Metadata || {},
  };
}

/**
 * Check if events bucket is available
 */
export async function isEventsBucketAvailable(): Promise<boolean> {
  try {
    await ensureEventsBucket();
    return true;
  } catch (error) {
    console.error('[MinIO] Events bucket is not available:', error);
    return false;
  }
}

/**
 * Generate signed URL for event files
 */
export function generateSignedEventFileUrl(objectKey: string, expiresIn: number = 3600): string {
  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const dataToSign = `event:${objectKey}:${expires}`;
  const signature = createHmac('sha256', MEDIA_SIGN_SECRET)
    .update(dataToSign)
    .digest('hex')
    .slice(0, 32);
  
  return `/api/event-files/${encodeURIComponent(objectKey)}?expires=${expires}&sig=${signature}`;
}

/**
 * Verify signed URL for event files
 */
export function verifySignedEventFileUrl(objectKey: string, expires: string, signature: string): boolean {
  const expiresNum = parseInt(expires, 10);
  if (isNaN(expiresNum) || expiresNum < Math.floor(Date.now() / 1000)) {
    return false;
  }
  
  const dataToSign = `event:${objectKey}:${expires}`;
  const expectedSig = createHmac('sha256', MEDIA_SIGN_SECRET)
    .update(dataToSign)
    .digest('hex')
    .slice(0, 32);
  
  if (signature.length !== expectedSig.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Get default event folder names
 */
export function getDefaultEventFolders(): string[] {
  return [...DEFAULT_EVENT_FOLDERS];
}

// ==================== Interaction Attachment Operations ====================

// Allowed MIME types for interaction attachments (documents, images, archives)
const INTERACTION_ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  // Text
  'text/plain',
  'text/csv',
];

// Max file size for interaction attachments (10MB)
const INTERACTION_MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Generate the object key path for interaction attachments
 * Format: interactions/{entityType}-{entityId}/interaction-{interactionId}/{uuid}-{filename}
 */
function generateInteractionObjectKey(
  entityType: 'lead' | 'partnership',
  entityId: number,
  interactionId: number,
  fileName: string
): string {
  const uuid = randomUUID();
  const sanitizedFileName = fileName.replace(/[<>:"|?*]/g, '_'); // Sanitize filename
  return `interactions/${entityType}-${entityId}/interaction-${interactionId}/${uuid}-${sanitizedFileName}`;
}

/**
 * Validate interaction attachment file
 */
function validateInteractionAttachment(buffer: Buffer, mimeType: string): void {
  if (!INTERACTION_ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Allowed types: PDF, Word, Excel, PowerPoint, images, ZIP, and text files.`);
  }
  if (buffer.length > INTERACTION_MAX_FILE_SIZE) {
    throw new Error(`File size (${(buffer.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (10MB)`);
  }
}

/**
 * Upload an interaction attachment to MinIO
 */
export async function uploadInteractionAttachment(
  buffer: Buffer,
  originalFileName: string,
  mimeType: string,
  entityType: 'lead' | 'partnership',
  entityId: number,
  interactionId: number
): Promise<{ objectKey: string; fileSize: number }> {
  // Validate the file
  validateInteractionAttachment(buffer, mimeType);
  
  await ensureEventsBucket();
  const client = getClient();
  
  const objectKey = generateInteractionObjectKey(entityType, entityId, interactionId, originalFileName);
  
  await client.send(new PutObjectCommand({
    Bucket: MINIO_CONFIG.eventsBucket,
    Key: objectKey,
    Body: buffer,
    ContentType: mimeType,
    Metadata: {
      'original-filename': encodeURIComponent(originalFileName),
      'entity-type': entityType,
      'entity-id': String(entityId),
      'interaction-id': String(interactionId),
    },
  }));
  
  console.log(`[MinIO] Uploaded interaction attachment: ${objectKey}`);
  
  return {
    objectKey,
    fileSize: buffer.length,
  };
}

/**
 * Get interaction attachment buffer for download
 */
export async function getInteractionAttachmentBuffer(objectKey: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  await ensureEventsBucket();
  const client = getClient();
  
  const response = await client.send(new GetObjectCommand({
    Bucket: MINIO_CONFIG.eventsBucket,
    Key: objectKey,
  }));
  
  if (!response.Body) {
    throw new Error(`Attachment not found: ${objectKey}`);
  }
  
  // Convert readable stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  
  return {
    buffer: Buffer.concat(chunks),
    contentType: response.ContentType || 'application/octet-stream',
  };
}

/**
 * Delete an interaction attachment from MinIO
 */
export async function deleteInteractionAttachment(objectKey: string): Promise<void> {
  await ensureEventsBucket();
  const client = getClient();
  
  await client.send(new DeleteObjectCommand({
    Bucket: MINIO_CONFIG.eventsBucket,
    Key: objectKey,
  }));
  
  console.log(`[MinIO] Deleted interaction attachment: ${objectKey}`);
}

/**
 * Generate a signed URL for interaction attachments
 */
export function generateSignedInteractionAttachmentUrl(objectKey: string, expiresIn: number = 3600): string {
  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const dataToSign = `interaction:${objectKey}:${expires}`;
  const signature = createHmac('sha256', MEDIA_SIGN_SECRET)
    .update(dataToSign)
    .digest('hex')
    .slice(0, 32);
  
  return `/api/interactions/attachments/${encodeURIComponent(objectKey)}?expires=${expires}&sig=${signature}`;
}

/**
 * Verify signed URL for interaction attachments
 */
export function verifySignedInteractionAttachmentUrl(objectKey: string, expires: string, signature: string): boolean {
  const expiresNum = parseInt(expires, 10);
  if (isNaN(expiresNum) || expiresNum < Math.floor(Date.now() / 1000)) {
    return false;
  }
  
  const dataToSign = `interaction:${objectKey}:${expires}`;
  const expectedSig = createHmac('sha256', MEDIA_SIGN_SECRET)
    .update(dataToSign)
    .digest('hex')
    .slice(0, 32);
  
  if (signature.length !== expectedSig.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Get allowed MIME types for interaction attachments
 */
export function getInteractionAllowedMimeTypes(): string[] {
  return [...INTERACTION_ALLOWED_MIME_TYPES];
}

/**
 * Get max file size for interaction attachments (in bytes)
 */
export function getInteractionMaxFileSize(): number {
  return INTERACTION_MAX_FILE_SIZE;
}

// ==================== Agreement Attachment Operations ====================

// Allowed MIME types for agreement attachments
const AGREEMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

// Max file size for agreement attachments (10MB)
const AGREEMENT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Generate the object key path for agreement attachments
 * Format: agreements/{agreementId}/attachments/{uuid}-{filename}
 */
function generateAgreementObjectKey(agreementId: number, fileName: string): string {
  const uuid = randomUUID();
  const sanitizedFileName = fileName.replace(/[<>:"|?*]/g, '_'); // Sanitize filename
  return `agreements/${agreementId}/attachments/${uuid}-${sanitizedFileName}`;
}

/**
 * Validate agreement attachment file
 */
function validateAgreementAttachment(buffer: Buffer, mimeType: string): void {
  if (!AGREEMENT_ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Allowed types: PDF, Word, Excel, and common image formats.`);
  }
  if (buffer.length > AGREEMENT_MAX_FILE_SIZE) {
    throw new Error(`File size (${(buffer.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (10MB)`);
  }
}

/**
 * Upload an agreement attachment to MinIO
 */
export async function uploadAgreementAttachment(
  buffer: Buffer,
  originalFileName: string,
  mimeType: string,
  agreementId: number
): Promise<{ objectKey: string; fileSize: number }> {
  // Validate the file
  validateAgreementAttachment(buffer, mimeType);
  
  await ensureEventsBucket();
  const client = getClient();
  
  const objectKey = generateAgreementObjectKey(agreementId, originalFileName);
  
  await client.send(new PutObjectCommand({
    Bucket: MINIO_CONFIG.eventsBucket,
    Key: objectKey,
    Body: buffer,
    ContentType: mimeType,
    Metadata: {
      'original-filename': encodeURIComponent(originalFileName),
      'agreement-id': String(agreementId),
    },
  }));
  
  console.log(`[MinIO] Uploaded agreement attachment: ${objectKey}`);
  
  return {
    objectKey,
    fileSize: buffer.length,
  };
}

/**
 * Get agreement attachment buffer for download
 */
export async function getAgreementAttachmentBuffer(objectKey: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  await ensureEventsBucket();
  const client = getClient();
  
  const response = await client.send(new GetObjectCommand({
    Bucket: MINIO_CONFIG.eventsBucket,
    Key: objectKey,
  }));
  
  if (!response.Body) {
    throw new Error(`Attachment not found: ${objectKey}`);
  }
  
  // Convert readable stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  
  return {
    buffer: Buffer.concat(chunks),
    contentType: response.ContentType || 'application/octet-stream',
  };
}

/**
 * Delete an agreement attachment from MinIO
 */
export async function deleteAgreementAttachment(objectKey: string): Promise<void> {
  await ensureEventsBucket();
  const client = getClient();
  
  await client.send(new DeleteObjectCommand({
    Bucket: MINIO_CONFIG.eventsBucket,
    Key: objectKey,
  }));
  
  console.log(`[MinIO] Deleted agreement attachment: ${objectKey}`);
}

/**
 * Generate a signed URL for agreement attachments
 */
export function generateSignedAgreementAttachmentUrl(objectKey: string, expiresIn: number = 3600): string {
  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const dataToSign = `agreement:${objectKey}:${expires}`;
  const signature = createHmac('sha256', MEDIA_SIGN_SECRET)
    .update(dataToSign)
    .digest('hex')
    .slice(0, 32);
  
  return `/api/agreements/attachments/${encodeURIComponent(objectKey)}?expires=${expires}&sig=${signature}`;
}

/**
 * Verify signed URL for agreement attachments
 */
export function verifySignedAgreementAttachmentUrl(objectKey: string, expires: string, signature: string): boolean {
  const expiresNum = parseInt(expires, 10);
  if (isNaN(expiresNum) || expiresNum < Math.floor(Date.now() / 1000)) {
    return false;
  }
  
  const dataToSign = `agreement:${objectKey}:${expires}`;
  const expectedSig = createHmac('sha256', MEDIA_SIGN_SECRET)
    .update(dataToSign)
    .digest('hex')
    .slice(0, 32);
  
  if (signature.length !== expectedSig.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Get allowed MIME types for agreement attachments
 */
export function getAgreementAllowedMimeTypes(): string[] {
  return [...AGREEMENT_ALLOWED_MIME_TYPES];
}

/**
 * Get max file size for agreement attachments (in bytes)
 */
export function getAgreementMaxFileSize(): number {
  return AGREEMENT_MAX_FILE_SIZE;
}

export const minioService = {
  // Original archive functions
  uploadImage,
  getSignedUrl,
  getSignedUrls,
  deleteImage,
  listEventImages,
  getImageBuffer,
  isMinioAvailable,
  getMinioConfig,
  generateSignedMediaUrl,
  verifySignedMediaUrl,
  // New event file storage functions
  createFolder,
  initializeEventFolders,
  listFolderContents,
  uploadEventFile,
  deleteEventFile,
  deleteFolderRecursive,
  copyEventFile,
  moveEventFile,
  getEventFileBuffer,
  getEventFileMetadata,
  isEventsBucketAvailable,
  generateSignedEventFileUrl,
  verifySignedEventFileUrl,
  getDefaultEventFolders,
  // Agreement attachment functions
  uploadAgreementAttachment,
  getAgreementAttachmentBuffer,
  deleteAgreementAttachment,
  generateSignedAgreementAttachmentUrl,
  verifySignedAgreementAttachmentUrl,
  getAgreementAllowedMimeTypes,
  getAgreementMaxFileSize,
  // Interaction attachment functions
  uploadInteractionAttachment,
  getInteractionAttachmentBuffer,
  deleteInteractionAttachment,
  generateSignedInteractionAttachmentUrl,
  verifySignedInteractionAttachmentUrl,
  getInteractionAllowedMimeTypes,
  getInteractionMaxFileSize,
};
