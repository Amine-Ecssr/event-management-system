/**
 * Archive Routes
 *
 * API endpoints for archived events management:
 * - GET /api/archive - Get all archived events (paginated, filterable)
 * - GET /api/archive/stats - Get archive statistics
 * - GET /api/archive/timeline - Get archive timeline (for charts)
 * - GET /api/archive/years - Get years with archived events
 * - GET /api/archive/speakers - Get list of eligible speakers for archive filtering
 * - GET /api/archive/minio-status - Check MinIO status (admin only)
 * - GET /api/archive/csv-template - Download CSV template for import (admin only)
 * - GET /api/archive/:id - Get single archived event by ID
 * - GET /api/archive/:id/speakers - Get speakers for an archived event
 * - POST /api/archive - Create archived event directly (admin only)
 * - POST /api/archive/from-event/:eventId - Archive an existing event (admin only)
 * - POST /api/archive/import-csv - Import archived events from CSV (admin only)
 * - POST /api/archive/:id/speakers - Add speaker to archived event (admin only)
 * - POST /api/archive/:id/photos - Upload photos to archived event (admin only)
 * - POST /api/archive/:id/photos/reorder - Reorder photos (admin only)
 * - POST /api/archive/:id/unarchive - Unarchive event (admin only)
 * - PATCH /api/archive/:id - Update archived event (admin only)
 * - DELETE /api/archive/:id - Delete archived event (admin only)
 * - DELETE /api/archive/:id/speakers/:speakerId - Remove speaker from archived event (admin only)
 * - DELETE /api/archive/:id/photos/:mediaId - Delete photo from archived event (admin only)
 *
 * @module routes/archive
 */

import { Router, Response } from "express";
import multer from "multer";
import { storage } from "../storage";
import { isAdminOrSuperAdmin } from "../auth";
import { minioService } from "../services/minio";
import { indexingService } from "../services/elasticsearch-indexing.service";
import { insertArchivedEventSchema, updateArchivedEventSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";

const router = Router();

// ==================== Helper Functions ====================

/**
 * Helper to check if archive feature is enabled
 */
async function ensureArchiveEnabled(res: Response): Promise<boolean> {
  const settings = await storage.getSettings();
  if (!settings.archiveEnabled) {
    res.status(403).json({ error: "Archive feature is disabled" });
    return false;
  }
  return true;
}

/**
 * Helper to enrich archived event with speakers data for ES indexing
 */
async function enrichArchivedEventForIndexing(archivedEventId: number) {
  const archivedEvent = await storage.getArchivedEvent(archivedEventId);
  if (!archivedEvent) return null;
  
  const speakers = await storage.getArchivedEventSpeakers(archivedEventId);
  return {
    ...archivedEvent,
    speakers: speakers.map(s => ({
      id: s.contactId || 0,
      name: s.speakerNameEn || '',
      organization: s.speakerOrganization || '',
      role: s.role || '',
    })),
    departments: [], // Archives don't track departments
  };
}

// ==================== Multer Configuration ====================

// Configure multer for archive photo uploads
const archivePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`));
    }
  },
});

// Configure multer for CSV uploads
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// ==================== Public Routes ====================

/**
 * GET /api/archive/speakers
 * Get list of eligible speakers for archive filtering (limited fields)
 */
router.get("/api/archive/speakers", async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const speakers = await storage.getEligibleSpeakers();
    const safeSpeakers = speakers.map((speaker) => ({
      id: speaker.id,
      nameEn: speaker.nameEn,
      nameAr: speaker.nameAr,
      title: speaker.title,
      titleAr: speaker.titleAr,
      isEligibleSpeaker: true,
      positionId: speaker.positionId,
      organizationId: speaker.organizationId,
      organization: speaker.organization
        ? { id: speaker.organization.id, nameEn: speaker.organization.nameEn, nameAr: speaker.organization.nameAr }
        : undefined,
      position: speaker.position
        ? { id: speaker.position.id, nameEn: speaker.position.nameEn, nameAr: speaker.position.nameAr }
        : undefined,
      organizationNameEn: speaker.organization?.nameEn,
      organizationNameAr: speaker.organization?.nameAr,
      positionNameEn: speaker.position?.nameEn,
      positionNameAr: speaker.position?.nameAr,
      profilePictureKey: speaker.profilePictureKey,
      profilePictureThumbnailKey: speaker.profilePictureThumbnailKey,
    }));

    res.json(safeSpeakers);
  } catch (error) {
    console.error('[Archive] Failed to fetch speakers:', error);
    res.status(500).json({ error: "Failed to fetch speakers" });
  }
});

/**
 * GET /api/archive
 * Get all archived events (paginated, filterable)
 */
router.get("/api/archive", async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
    const search = req.query.search as string | undefined;
    const speakerId = req.query.speaker ? parseInt(req.query.speaker as string) : undefined;

    const result = await storage.getAllArchivedEvents({ page, limit, year, categoryId, search, speakerId });
    
    // Add signed thumbnail URLs for card display
    const eventsWithUrls = result.events.map((event) => {
      const thumbnailUrl = event.thumbnailKeys && event.thumbnailKeys[0]
        ? minioService.generateSignedMediaUrl(event.thumbnailKeys[0], 3600)
        : undefined;
      return { ...event, thumbnailUrl };
    });
    
    res.json({ ...result, events: eventsWithUrls });
  } catch (error) {
    console.error('[Archive] Failed to fetch archived events:', error);
    res.status(500).json({ error: "Failed to fetch archived events" });
  }
});

/**
 * GET /api/archive/stats
 * Get archive statistics
 */
router.get("/api/archive/stats", async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const stats = await storage.getArchiveStats();
    res.json(stats);
  } catch (error) {
    console.error('[Archive] Failed to fetch archive stats:', error);
    res.status(500).json({ error: "Failed to fetch archive statistics" });
  }
});

/**
 * GET /api/archive/timeline
 * Get archive timeline (for charts)
 */
router.get("/api/archive/timeline", async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const timeline = await storage.getArchiveTimeline();
    res.json(timeline);
  } catch (error) {
    console.error('[Archive] Failed to fetch archive timeline:', error);
    res.status(500).json({ error: "Failed to fetch archive timeline" });
  }
});

/**
 * GET /api/archive/years
 * Get years with archived events
 */
router.get("/api/archive/years", async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const years = await storage.getArchiveYears();
    res.json(years);
  } catch (error) {
    console.error('[Archive] Failed to fetch archive years:', error);
    res.status(500).json({ error: "Failed to fetch archive years" });
  }
});

// ==================== Admin Routes ====================

/**
 * GET /api/archive/minio-status
 * Check MinIO status (admin only)
 */
router.get("/api/archive/minio-status", isAdminOrSuperAdmin, async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const available = await minioService.isMinioAvailable();
    const config = minioService.getMinioConfig();
    res.json({ available, config });
  } catch (error) {
    console.error('[Archive] Failed to check MinIO status:', error);
    res.status(500).json({ available: false, error: "Failed to check MinIO status" });
  }
});

/**
 * GET /api/archive/csv-template
 * Download CSV template for archive import (admin only)
 */
router.get("/api/archive/csv-template", isAdminOrSuperAdmin, async (req, res) => {
  if (!(await ensureArchiveEnabled(res))) return;

  const template = `name,name_ar,description,description_ar,start_date,end_date,start_time,end_time,location,location_ar,organizers,organizers_ar,category,actual_attendees,highlights,highlights_ar,impact,impact_ar,key_takeaways,key_takeaways_ar,url,youtube_video_ids
"Annual Conference 2024","المؤتمر السنوي 2024","Description of the event","وصف الحدث","2024-03-15","2024-03-16","09:00","17:00","Abu Dhabi National Exhibition Centre","مركز أبوظبي الوطني للمعارض","ECSSR","مركز الإمارات للدراسات","Conference",500,"Key highlights of the event","أبرز النقاط","Impact description","وصف التأثير","Main takeaways","الدروس المستفادة","https://example.com","dQw4w9WgXcQ"`;
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="archive_import_template.csv"');
  res.send(template);
});

/**
 * GET /api/archive/:id
 * Get single archived event by ID
 */
router.get("/api/archive/:id", async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const rawId = req.params.id;
    let archiveId = parseInt(rawId, 10);

    // Support lookups by original event UUID for backward compatibility
    const archivedEvent = isNaN(archiveId)
      ? await storage.getArchivedEventByOriginalId(rawId)
      : await storage.getArchivedEvent(archiveId);

    if (!archivedEvent) {
      return res.status(404).json({ error: "Archived event not found" });
    }

    // Ensure we have the numeric archive ID for media lookups
    archiveId = archivedEvent.id;

    // Get associated media with signed proxy URLs
    // URLs are signed with HMAC and expire after 1 hour (3600 seconds)
    const media = await storage.getArchiveMedia(archiveId);
    const mediaWithUrls = media.map((m) => {
      // Generate signed URLs that go through our /media/ proxy
      const imageUrl = minioService.generateSignedMediaUrl(m.objectKey, 3600);
      const thumbnailUrl = m.thumbnailKey 
        ? minioService.generateSignedMediaUrl(m.thumbnailKey, 3600)
        : imageUrl; // Fallback to main image if no thumbnail
      return { ...m, imageUrl, thumbnailUrl };
    });

    res.json({ ...archivedEvent, media: mediaWithUrls });
  } catch (error) {
    console.error('[Archive] Failed to fetch archived event:', error);
    res.status(500).json({ error: "Failed to fetch archived event" });
  }
});

/**
 * GET /api/archive/:id/speakers
 * Get speakers for an archived event
 */
router.get("/api/archive/:id/speakers", async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const id = parseInt(req.params.id);
    const speakers = await storage.getArchivedEventSpeakers(id);
    res.json(speakers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch archived event speakers" });
  }
});

/**
 * POST /api/archive/from-event/:eventId
 * Archive an existing event (internal events only)
 */
router.post("/api/archive/from-event/:eventId", isAdminOrSuperAdmin, async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const { eventId } = req.params;

    // Verify event exists and is not scraped
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (event.isScraped) {
      return res.status(400).json({ error: "Cannot archive scraped events. Only internal events can be archived." });
    }

    if (event.isArchived) {
      return res.status(400).json({ error: "Event is already archived" });
    }

    // Archive with optional additional data
    const archiveData = req.body || {};
    const archivedEvent = await storage.archiveEvent(eventId, req.user!.id, archiveData);

    // Index archived event to Elasticsearch with enriched data (non-blocking)
    enrichArchivedEventForIndexing(archivedEvent.id).then(enriched => {
      if (enriched) {
        return indexingService.indexArchivedEvent(enriched);
      }
    }).catch(err => {
      console.warn("[ES] Failed to index archived event:", err?.message || err);
    });

    res.status(201).json(archivedEvent);
  } catch (error: any) {
    console.error('[Archive] Failed to archive event:', error);
    res.status(500).json({ error: error.message || "Failed to archive event" });
  }
});

/**
 * POST /api/archive
 * Create archived event directly (without original event)
 */
router.post("/api/archive", isAdminOrSuperAdmin, async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const data = {
      ...req.body,
      archivedByUserId: req.user!.id,
      createdDirectly: true,
    };

    const result = insertArchivedEventSchema.safeParse(data);
    if (!result.success) {
      return res.status(400).json({ error: fromError(result.error).toString() });
    }

    const archivedEvent = await storage.createArchivedEvent(result.data);

    // Index archived event to Elasticsearch with enriched data (non-blocking)
    enrichArchivedEventForIndexing(archivedEvent.id).then(enriched => {
      if (enriched) {
        return indexingService.indexArchivedEvent(enriched);
      }
    }).catch(err => {
      console.warn("[ES] Failed to index new archived event:", err?.message || err);
    });

    res.status(201).json(archivedEvent);
  } catch (error) {
    console.error('[Archive] Failed to create archived event:', error);
    res.status(500).json({ error: "Failed to create archived event" });
  }
});

/**
 * POST /api/archive/:id/speakers
 * Add speaker to archived event
 */
router.post("/api/archive/:id/speakers", isAdminOrSuperAdmin, async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const archivedEventId = parseInt(req.params.id);
    const { contactId, role, roleAr, displayOrder } = req.body;

    // Get contact details to snapshot
    let speakerData: any = {
      archivedEventId,
      role,
      roleAr,
      displayOrder: displayOrder || 0,
    };

    if (contactId) {
      const contact = await storage.getContact(contactId);
      if (contact) {
        speakerData = {
          ...speakerData,
          contactId,
          speakerNameEn: contact.nameEn,
          speakerNameAr: contact.nameAr,
          speakerTitle: contact.title,
          speakerTitleAr: contact.titleAr,
          speakerPosition: contact.position?.nameEn,
          speakerPositionAr: contact.position?.nameAr,
          speakerOrganization: contact.organization?.nameEn,
          speakerOrganizationAr: contact.organization?.nameAr,
          speakerProfilePictureKey: contact.profilePictureKey,
          speakerProfilePictureThumbnailKey: contact.profilePictureThumbnailKey,
        };
      }
    }

    const speaker = await storage.addArchivedEventSpeaker(speakerData);
    res.status(201).json(speaker);
  } catch (error) {
    res.status(500).json({ error: "Failed to add speaker to archived event" });
  }
});

/**
 * PATCH /api/archive/:id
 * Update archived event
 */
router.patch("/api/archive/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid archive ID" });
    }

    const result = updateArchivedEventSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: fromError(result.error).toString() });
    }

    const archivedEvent = await storage.updateArchivedEvent(id, result.data);
    if (!archivedEvent) {
      return res.status(404).json({ error: "Archived event not found" });
    }

    // Re-index archived event to Elasticsearch with enriched data (non-blocking)
    enrichArchivedEventForIndexing(id).then(enriched => {
      if (enriched) {
        return indexingService.indexArchivedEvent(enriched);
      }
    }).catch(err => {
      console.warn("[ES] Failed to re-index updated archived event:", err?.message || err);
    });

    res.json(archivedEvent);
  } catch (error) {
    console.error('[Archive] Failed to update archived event:', error);
    res.status(500).json({ error: "Failed to update archived event" });
  }
});

/**
 * DELETE /api/archive/:id
 * Delete archived event
 */
router.delete("/api/archive/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid archive ID" });
    }

    // Get media to delete from MinIO
    const media = await storage.getArchiveMedia(id);
    
    // Delete from database (will cascade delete media records)
    const deleted = await storage.deleteArchivedEvent(id);
    if (!deleted) {
      return res.status(404).json({ error: "Archived event not found" });
    }

    // Delete files from MinIO
    for (const m of media) {
      try {
        await minioService.deleteImage(m.objectKey, m.thumbnailKey || undefined);
      } catch (error) {
        console.error(`[Archive] Failed to delete media file ${m.objectKey}:`, error);
      }
    }

    // Delete from Elasticsearch (non-blocking)
    indexingService.deleteDocument('archivedEvents', String(id)).catch(err => {
      console.warn("[ES] Failed to delete archived event from index:", err?.message || err);
    });

    res.status(204).send();
  } catch (error) {
    console.error('[Archive] Failed to delete archived event:', error);
    res.status(500).json({ error: "Failed to delete archived event" });
  }
});

/**
 * DELETE /api/archive/:id/speakers/:speakerId
 * Remove speaker from archived event
 */
router.delete("/api/archive/:id/speakers/:speakerId", isAdminOrSuperAdmin, async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const speakerId = parseInt(req.params.speakerId);
    const deleted = await storage.removeArchivedEventSpeaker(speakerId);
    if (!deleted) {
      return res.status(404).json({ error: "Speaker not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to remove speaker from archived event" });
  }
});

/**
 * POST /api/archive/:id/unarchive
 * Unarchive event (restore to regular event, remove from archive)
 */
router.post("/api/archive/:id/unarchive", isAdminOrSuperAdmin, async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid archive ID" });
    }

    const success = await storage.unarchiveEvent(id);
    if (!success) {
      return res.status(404).json({ error: "Archived event not found" });
    }

    res.json({ success: true, message: "Event unarchived successfully" });
  } catch (error) {
    console.error('[Archive] Failed to unarchive event:', error);
    res.status(500).json({ error: "Failed to unarchive event" });
  }
});

/**
 * POST /api/archive/:id/photos
 * Upload photos to archived event
 */
router.post("/api/archive/:id/photos", isAdminOrSuperAdmin, archivePhotoUpload.array('photos', 20), async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid archive ID" });
    }

    // Verify archived event exists
    const archivedEvent = await storage.getArchivedEvent(id);
    if (!archivedEvent) {
      return res.status(404).json({ error: "Archived event not found" });
    }

    // Check current photo count
    const existingMedia = await storage.getArchiveMedia(id);
    const files = req.files as Express.Multer.File[];
    
    if (existingMedia.length + files.length > 20) {
      return res.status(400).json({ 
        error: `Maximum 20 photos allowed. Currently have ${existingMedia.length}, trying to add ${files.length}.` 
      });
    }

    // Upload each file to MinIO and create media records
    const uploadedMedia = [];
    const nextDisplayOrder = existingMedia.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Upload to MinIO
        const uploadResult = await minioService.uploadImage(
          file.buffer,
          file.originalname,
          file.mimetype
        );

        // Create media record
        const media = await storage.createArchiveMedia({
          archivedEventId: id,
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
        const thumbnailUrl = media.thumbnailKey 
          ? minioService.generateSignedMediaUrl(media.thumbnailKey, 3600)
          : imageUrl;
        uploadedMedia.push({ ...media, imageUrl, thumbnailUrl });
      } catch (error: any) {
        console.error(`[Archive] Failed to upload photo ${file.originalname}:`, error);
        // Continue with other files
      }
    }

    // Update archived event's photoKeys and thumbnailKeys only if they don't already exist
    // This preserves seeded data (which stores photoKeys in archivedEvents table)
    // while supporting uploaded photos (which go into archiveMedia table)
    if (!archivedEvent.photoKeys || archivedEvent.photoKeys.length === 0) {
      const allMedia = await storage.getArchiveMedia(id);
      await storage.updateArchivedEvent(id, {
        photoKeys: allMedia.map(m => m.objectKey),
        thumbnailKeys: allMedia.map(m => m.thumbnailKey).filter(Boolean) as string[],
      });
    }

    res.status(201).json({
      uploaded: uploadedMedia.length,
      total: existingMedia.length + uploadedMedia.length,
      media: uploadedMedia,
    });
  } catch (error) {
    console.error('[Archive] Failed to upload photos:', error);
    res.status(500).json({ error: "Failed to upload photos" });
  }
});

/**
 * DELETE /api/archive/:id/photos/:mediaId
 * Delete a photo from archived event
 */
router.delete("/api/archive/:id/photos/:mediaId", isAdminOrSuperAdmin, async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const id = parseInt(req.params.id);
    const mediaId = parseInt(req.params.mediaId);
    
    if (isNaN(id) || isNaN(mediaId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    // Get media to delete
    const allMedia = await storage.getArchiveMedia(id);
    const media = allMedia.find(m => m.id === mediaId);
    
    if (!media) {
      return res.status(404).json({ error: "Media not found" });
    }

    // Delete from MinIO
    try {
      await minioService.deleteImage(media.objectKey, media.thumbnailKey || undefined);
    } catch (error) {
      console.error(`[Archive] Failed to delete from MinIO:`, error);
    }

    // Delete from database
    await storage.deleteArchiveMedia(mediaId);

    // Update archived event's photoKeys
    const remainingMedia = await storage.getArchiveMedia(id);
    await storage.updateArchivedEvent(id, {
      photoKeys: remainingMedia.map(m => m.objectKey),
      thumbnailKeys: remainingMedia.map(m => m.thumbnailKey).filter(Boolean) as string[],
    });

    res.status(204).send();
  } catch (error) {
    console.error('[Archive] Failed to delete photo:', error);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

/**
 * POST /api/archive/:id/photos/reorder
 * Reorder photos
 */
router.post("/api/archive/:id/photos/reorder", isAdminOrSuperAdmin, async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid archive ID" });
    }

    const { mediaIds } = req.body;
    if (!Array.isArray(mediaIds)) {
      return res.status(400).json({ error: "mediaIds must be an array" });
    }

    await storage.reorderArchiveMedia(id, mediaIds);

    // Update archived event's photoKeys order
    const reorderedMedia = await storage.getArchiveMedia(id);
    await storage.updateArchivedEvent(id, {
      photoKeys: reorderedMedia.map(m => m.objectKey),
      thumbnailKeys: reorderedMedia.map(m => m.thumbnailKey).filter(Boolean) as string[],
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Archive] Failed to reorder photos:', error);
    res.status(500).json({ error: "Failed to reorder photos" });
  }
});

/**
 * POST /api/archive/import-csv
 * Import archived events from CSV
 */
router.post("/api/archive/import-csv", isAdminOrSuperAdmin, csvUpload.single('file'), async (req, res) => {
  try {
    if (!(await ensureArchiveEnabled(res))) return;

    if (!req.file) {
      return res.status(400).json({ error: "No CSV file provided" });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length < 2) {
      return res.status(400).json({ error: "CSV file must have a header row and at least one data row" });
    }

    // Parse header row
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
    
    // Expected column mappings
    const columnMap: Record<string, string> = {
      'name': 'name',
      'name_en': 'name',
      'title': 'name',
      'event_name': 'name',
      'name_ar': 'nameAr',
      'arabic_name': 'nameAr',
      'description': 'description',
      'description_en': 'description',
      'description_ar': 'descriptionAr',
      'arabic_description': 'descriptionAr',
      'start_date': 'startDate',
      'startdate': 'startDate',
      'date': 'startDate',
      'event_date': 'startDate',
      'end_date': 'endDate',
      'enddate': 'endDate',
      'start_time': 'startTime',
      'starttime': 'startTime',
      'time': 'startTime',
      'end_time': 'endTime',
      'endtime': 'endTime',
      'location': 'location',
      'venue': 'location',
      'location_en': 'location',
      'location_ar': 'locationAr',
      'venue_ar': 'locationAr',
      'organizers': 'organizers',
      'organizer': 'organizers',
      'organizers_ar': 'organizersAr',
      'category': 'category',
      'category_id': 'categoryId',
      'attendees': 'actualAttendees',
      'actual_attendees': 'actualAttendees',
      'attendance': 'actualAttendees',
      'expected_attendance': 'expectedAttendees',
      'highlights': 'highlights',
      'highlights_en': 'highlights',
      'highlights_ar': 'highlightsAr',
      'impact': 'impact',
      'impact_en': 'impact',
      'impact_ar': 'impactAr',
      'key_takeaways': 'keyTakeaways',
      'takeaways': 'keyTakeaways',
      'key_takeaways_ar': 'keyTakeawaysAr',
      'url': 'url',
      'link': 'url',
      'youtube': 'youtubeVideoIds',
      'youtube_video_ids': 'youtubeVideoIds',
      'videos': 'youtubeVideoIds',
    };

    // Map headers to our schema fields
    const fieldIndices: Record<string, number> = {};
    headers.forEach((header, index) => {
      const mappedField = columnMap[header];
      if (mappedField && !(mappedField in fieldIndices)) {
        fieldIndices[mappedField] = index;
      }
    });

    // Validate required fields
    if (!('name' in fieldIndices) && !('nameAr' in fieldIndices)) {
      return res.status(400).json({ error: "CSV must have a 'name' or 'name_ar' column" });
    }
    if (!('startDate' in fieldIndices)) {
      return res.status(400).json({ error: "CSV must have a 'start_date' or 'date' column" });
    }

    // Get all categories for matching
    const categories = await storage.getCategories();
    const categoryMap = new Map(categories.map(c => [c.nameEn?.toLowerCase() || '', c.id]));
    const categoryMapAr = new Map(categories.map(c => [c.nameAr?.toLowerCase() || '', c.id]));

    const imported: any[] = [];
    const errors: string[] = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        
        const getValue = (field: string): string | undefined => {
          const index = fieldIndices[field];
          if (index !== undefined && values[index]) {
            return values[index].trim() || undefined;
          }
          return undefined;
        };

        const name = getValue('name') || getValue('nameAr') || `Event ${i}`;
        const startDate = getValue('startDate');
        
        if (!startDate) {
          errors.push(`Row ${i + 1}: Missing start date`);
          continue;
        }

        // Parse and validate date format
        let parsedStartDate: string;
        try {
          const dateMatch = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (dateMatch) {
            parsedStartDate = startDate;
          } else {
            // Try other formats
            const date = new Date(startDate);
            if (isNaN(date.getTime())) {
              throw new Error('Invalid date');
            }
            parsedStartDate = date.toISOString().split('T')[0];
          }
        } catch {
          errors.push(`Row ${i + 1}: Invalid date format "${startDate}"`);
          continue;
        }

        let parsedEndDate = parsedStartDate;
        const endDate = getValue('endDate');
        if (endDate) {
          try {
            const dateMatch = endDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (dateMatch) {
              parsedEndDate = endDate;
            } else {
              const date = new Date(endDate);
              if (!isNaN(date.getTime())) {
                parsedEndDate = date.toISOString().split('T')[0];
              }
            }
          } catch {
            // Use start date as end date
          }
        }

        // Match category by name
        let categoryId: number | undefined;
        const categoryName = getValue('category');
        if (categoryName) {
          categoryId = categoryMap.get(categoryName.toLowerCase()) || categoryMapAr.get(categoryName.toLowerCase());
        }
        const rawCategoryId = getValue('categoryId');
        if (rawCategoryId && !categoryId) {
          const parsed = parseInt(rawCategoryId);
          if (!isNaN(parsed)) categoryId = parsed;
        }

        // Parse attendees
        let actualAttendees: number | undefined;
        const attendeesStr = getValue('actualAttendees');
        if (attendeesStr) {
          const parsed = parseInt(attendeesStr.replace(/,/g, ''));
          if (!isNaN(parsed)) actualAttendees = parsed;
        }

        // Parse YouTube video IDs
        let youtubeVideoIds: string[] | undefined;
        const youtubeStr = getValue('youtubeVideoIds');
        if (youtubeStr) {
          youtubeVideoIds = youtubeStr.split(/[,;]/).map(id => id.trim()).filter(Boolean);
        }

        const archiveData = {
          name,
          nameAr: getValue('nameAr'),
          description: getValue('description'),
          descriptionAr: getValue('descriptionAr'),
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          startTime: getValue('startTime'),
          endTime: getValue('endTime'),
          location: getValue('location'),
          locationAr: getValue('locationAr'),
          organizers: getValue('organizers'),
          organizersAr: getValue('organizersAr'),
          categoryId,
          actualAttendees,
          highlights: getValue('highlights'),
          highlightsAr: getValue('highlightsAr'),
          impact: getValue('impact'),
          impactAr: getValue('impactAr'),
          keyTakeaways: getValue('keyTakeaways'),
          keyTakeawaysAr: getValue('keyTakeawaysAr'),
          url: getValue('url'),
          youtubeVideoIds,
          archivedByUserId: req.user!.id,
          createdDirectly: true,
        };

        const result = insertArchivedEventSchema.safeParse(archiveData);
        if (!result.success) {
          errors.push(`Row ${i + 1}: ${fromError(result.error).toString()}`);
          continue;
        }

        const archivedEvent = await storage.createArchivedEvent(result.data);
        imported.push(archivedEvent);
        
        // Index to Elasticsearch with enriched data (non-blocking)
        enrichArchivedEventForIndexing(archivedEvent.id).then(enriched => {
          if (enriched) {
            return indexingService.indexArchivedEvent(enriched);
          }
        }).catch(err => {
          console.warn(`[ES] Failed to index archived event ${archivedEvent.id}:`, err?.message || err);
        });
      } catch (err: any) {
        errors.push(`Row ${i + 1}: ${err.message || 'Unknown error'}`);
      }
    }

    res.json({
      success: true,
      imported: imported.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully imported ${imported.length} archived events${errors.length > 0 ? `. ${errors.length} rows had errors.` : '.'}`,
    });
  } catch (error: any) {
    console.error('[Archive] Failed to import CSV:', error);
    res.status(500).json({ error: error.message || "Failed to import CSV" });
  }
});

export default router;
