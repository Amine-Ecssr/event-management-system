/**
 * Partnership Routes
 *
 * API endpoints for partnership management, including partners, agreements,
 * activities, contacts, comments, interactions, tasks, and inactivity monitoring.
 *
 * Note: Partnership Types CRUD is handled in organization.routes.ts as it's
 * closely related to organization management.
 *
 * @module routes/partnership
 */

import { Router } from "express";
import multer from "multer";
import { storage } from "../storage";
import { isAuthenticated, isAdminOrSuperAdmin, isSuperAdmin } from "../auth";
import { minioService } from "../services/minio";
import { indexingService } from "../services/elasticsearch-indexing.service";
import type { User } from "@shared/schema.mssql";

const router = Router();

// ==================== Multer Configuration for Agreement Attachments ====================

const agreementAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: minioService.getAgreementMaxFileSize(),
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = minioService.getAgreementAllowedMimeTypes();
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: PDF, Word, Excel, and common image formats.`));
    }
  },
});

// ==================== Partnership Analytics & Stats ====================

// Get partnership analytics
router.get('/api/partnerships/analytics', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const stats = await storage.getPartnerStats();
    
    // Get all partners to calculate by-type breakdown
    const { partners } = await storage.getAllPartners({ limit: 1000 });
    
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byScope: Record<string, number> = { local: 0, regional: 0, international: 0 };
    
    partners.forEach(partner => {
      // Count by type
      const typeId = partner.partnershipTypeId?.toString() || 'unspecified';
      byType[typeId] = (byType[typeId] || 0) + 1;
      
      // Count by status
      const status = partner.partnershipStatus || 'active';
      byStatus[status] = (byStatus[status] || 0) + 1;
      
      // Count by scope
      const scope = (partner as any).scope as 'local' | 'regional' | 'international' | undefined;
      if (scope) {
        byScope[scope] = (byScope[scope] || 0) + 1;
      }
    });
    
    res.json({
      totalPartners: stats.totalPartners,
      activePartners: stats.activePartnerships,
      byType,
      byStatus,
      byScope,
    });
  } catch (error: any) {
    console.error('[Partnerships] Failed to get analytics:', error);
    res.status(500).json({ error: error.message || 'Failed to get analytics' });
  }
});

// Get partner statistics
router.get('/api/partnerships/stats', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const stats = await storage.getPartnerStats();
    res.json(stats);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get stats:', error);
    res.status(500).json({ error: error.message || 'Failed to get stats' });
  }
});

// Get inactive partnerships
router.get('/api/partnerships/inactive', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const defaultThresholdDate = new Date();
    defaultThresholdDate.setMonth(defaultThresholdDate.getMonth() - 6);
    
    const inactivePartnerships = await storage.getInactivePartnerships(defaultThresholdDate);
    res.json(inactivePartnerships);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get inactive partnerships:', error);
    res.status(500).json({ error: error.message || 'Failed to get inactive partnerships' });
  }
});

// Manually trigger inactivity check (superadmin only)
router.post('/api/partnerships/inactive/check', isSuperAdmin, async (req, res) => {
  try {
    const { triggerPartnershipInactivityCheck } = await import('../partnershipInactivityScheduler');
    const result = await triggerPartnershipInactivityCheck();
    res.json({
      success: true,
      message: `Inactivity check complete: ${result.processed} partnerships checked, ${result.notified} notifications sent`,
      ...result,
    });
  } catch (error: any) {
    console.error('[Partnerships] Failed to trigger inactivity check:', error);
    res.status(500).json({ error: error.message || 'Failed to trigger inactivity check' });
  }
});

// ==================== Partnership CRUD ====================

// Get all partners with filtering
router.get('/api/partnerships', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { page, limit, status, type, search, sortBy } = req.query;
    const result = await storage.getAllPartners({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      status: status as string,
      type: type as string,
      search: search as string,
      sortBy: sortBy as string,
    });
    res.json(result);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get partners:', error);
    res.status(500).json({ error: error.message || 'Failed to get partners' });
  }
});

// Create a new partnership (organization + partnership info)
router.post('/api/partnerships', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { organizationId, partnershipTypeId, partnershipStatus, partnershipStartDate, partnershipEndDate, partnershipNotes, agreementSignedBy, agreementSignedByUs } = req.body;
    
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    const organization = await storage.updatePartnership(organizationId, {
      isPartner: true,
      partnershipTypeId: partnershipTypeId || null,
      partnershipStatus: partnershipStatus || 'active',
      partnershipStartDate: partnershipStartDate || null,
      partnershipEndDate: partnershipEndDate || null,
      partnershipNotes: partnershipNotes || null,
      agreementSignedBy: agreementSignedBy || null,
      agreementSignedByUs: agreementSignedByUs || null,
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Index partnership to Elasticsearch (non-blocking)
    indexingService.indexOrganization(organization).catch(err => {
      console.warn("[ES] Failed to index new partnership:", err?.message || err);
    });

    res.status(201).json(organization);
  } catch (error: any) {
    console.error('[Partnerships] Failed to create partnership:', error);
    res.status(500).json({ error: error.message || 'Failed to create partnership' });
  }
});

// Get single partner/organization details
router.get('/api/partnerships/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const organization = await storage.getOrganization(id);
    if (!organization) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    // Get partnership type if it exists
    let partnershipType = null;
    if (organization.partnershipTypeId) {
      partnershipType = await storage.getPartnershipType(organization.partnershipTypeId);
    }

    // Transform to match frontend expectations
    const partnership = {
      id: organization.id,
      organizationId: organization.id,
      organization: {
        id: organization.id,
        nameEn: organization.nameEn,
        nameAr: organization.nameAr,
        countryId: organization.countryId,
        country: organization.country,
        website: organization.website,
      },
      partnershipType,
      partnershipStatus: organization.partnershipStatus,
      partnershipSignedDate: null, // Not in schema yet
      partnershipSignedByUserId: null, // Not in schema yet
      signedByUser: null, // Not in schema yet
      partnershipStartDate: organization.partnershipStartDate,
      partnershipEndDate: organization.partnershipEndDate,
      partnershipNotes: organization.partnershipNotes,
    };

    res.json(partnership);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get partner:', error);
    res.status(500).json({ error: error.message || 'Failed to get partner' });
  }
});

// Update a partnership
router.put('/api/partnerships/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { partnershipTypeId, partnershipStatus, partnershipStartDate, partnershipEndDate, partnershipNotes, agreementSignedBy, agreementSignedByUs } = req.body;

    const organization = await storage.updatePartnership(id, {
      partnershipTypeId: partnershipTypeId || null,
      partnershipStatus: partnershipStatus || null,
      partnershipStartDate: partnershipStartDate || null,
      partnershipEndDate: partnershipEndDate || null,
      partnershipNotes: partnershipNotes || null,
      agreementSignedBy: agreementSignedBy || null,
      agreementSignedByUs: agreementSignedByUs || null,
    });

    if (!organization) {
      return res.status(404).json({ error: 'Partnership not found' });
    }

    // Re-index partnership to Elasticsearch (non-blocking)
    indexingService.indexOrganization(organization).catch(err => {
      console.warn("[ES] Failed to re-index updated partnership:", err?.message || err);
    });

    res.json(organization);
  } catch (error: any) {
    console.error('[Partnerships] Failed to update partnership:', error);
    res.status(500).json({ error: error.message || 'Failed to update partnership' });
  }
});

// Delete a partnership (remove partnership status)
router.delete('/api/partnerships/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const organization = await storage.updatePartnership(id, {
      isPartner: false,
      partnershipStatus: null,
      partnershipTypeId: null,
    });

    if (!organization) {
      return res.status(404).json({ error: 'Partnership not found' });
    }

    // Delete partnership from ES partnerships index (it's no longer a partner, move to organizations)
    indexingService.deleteDocument('partnerships', String(id)).catch(err => {
      console.warn("[ES] Failed to delete partnership from index:", err?.message || err);
    });
    // Re-index as organization (no longer partner)
    indexingService.indexOrganization(organization).catch(err => {
      console.warn("[ES] Failed to re-index as organization:", err?.message || err);
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('[Partnerships] Failed to delete partnership:', error);
    res.status(500).json({ error: error.message || 'Failed to delete partnership' });
  }
});

// ==================== Organization Partnership Routes (alias routes) ====================

// Make an organization a partner
router.post('/api/organizations/:id/partnership', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const organization = await storage.updatePartnership(id, {
      ...req.body,
      isPartner: true,
    });
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    res.json(organization);
  } catch (error: any) {
    console.error('[Partnerships] Failed to create partnership:', error);
    res.status(500).json({ error: error.message || 'Failed to create partnership' });
  }
});

// Update partnership info
router.put('/api/organizations/:id/partnership', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const organization = await storage.updatePartnership(id, req.body);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    res.json(organization);
  } catch (error: any) {
    console.error('[Partnerships] Failed to update partnership:', error);
    res.status(500).json({ error: error.message || 'Failed to update partnership' });
  }
});

// Remove partnership status
router.delete('/api/organizations/:id/partnership', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const organization = await storage.updatePartnership(id, {
      isPartner: false,
      partnershipStatus: null,
      partnershipTypeId: null,
    });
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    res.json(organization);
  } catch (error: any) {
    console.error('[Partnerships] Failed to remove partnership:', error);
    res.status(500).json({ error: error.message || 'Failed to remove partnership' });
  }
});

// ==================== Partnership Inactivity Settings ====================

// Update partnership inactivity settings
router.put('/api/partnerships/:id/inactivity-settings', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { inactivityThresholdMonths, notifyOnInactivity } = req.body;
    
    // Validate threshold
    if (inactivityThresholdMonths !== undefined && (inactivityThresholdMonths < 1 || inactivityThresholdMonths > 24)) {
      return res.status(400).json({ error: 'Inactivity threshold must be between 1 and 24 months' });
    }
    
    const updated = await storage.updatePartnershipInactivitySettings(id, {
      inactivityThresholdMonths,
      notifyOnInactivity,
    });
    
    if (!updated) {
      return res.status(404).json({ error: 'Partnership not found' });
    }
    
    res.json(updated);
  } catch (error: any) {
    console.error('[Partnerships] Failed to update inactivity settings:', error);
    res.status(500).json({ error: error.message || 'Failed to update inactivity settings' });
  }
});

// Get partnership inactivity details
router.get('/api/partnerships/:id/inactivity', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const organization = await storage.getOrganization(id);
    
    if (!organization) {
      return res.status(404).json({ error: 'Partnership not found' });
    }
    
    const now = new Date();
    const lastActivityDate = organization.lastActivityDate;
    const daysSinceLastActivity = lastActivityDate 
      ? Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    const threshold = organization.inactivityThresholdMonths || 6;
    const thresholdDate = new Date();
    thresholdDate.setMonth(thresholdDate.getMonth() - threshold);
    
    const isInactive = lastActivityDate ? lastActivityDate < thresholdDate : true;
    
    res.json({
      id: organization.id,
      nameEn: organization.nameEn,
      nameAr: organization.nameAr,
      lastActivityDate,
      daysSinceLastActivity,
      inactivityThresholdMonths: threshold,
      notifyOnInactivity: organization.notifyOnInactivity ?? true,
      lastInactivityNotificationSent: organization.lastInactivityNotificationSent,
      isInactive,
    });
  } catch (error: any) {
    console.error('[Partnerships] Failed to get inactivity details:', error);
    res.status(500).json({ error: error.message || 'Failed to get inactivity details' });
  }
});

// ==================== Partnership Agreements ====================

// Get agreements for a partnership
router.get('/api/partnerships/:id/agreements', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const agreements = await storage.getPartnershipAgreements(id);
    res.json(agreements);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get agreements:', error);
    res.status(500).json({ error: error.message || 'Failed to get agreements' });
  }
});

// Create agreement for a partnership
router.post('/api/partnerships/:id/agreements', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const agreement = await storage.createPartnershipAgreement({
      ...req.body,
      organizationId,
    });
    res.status(201).json(agreement);
  } catch (error: any) {
    console.error('[Partnerships] Failed to create agreement:', error);
    res.status(500).json({ error: error.message || 'Failed to create agreement' });
  }
});

// Update agreement
router.put('/api/partnerships/:id/agreements/:agreementId', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const agreementId = parseInt(req.params.agreementId);
    const agreement = await storage.updatePartnershipAgreement(agreementId, req.body);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }
    res.json(agreement);
  } catch (error: any) {
    console.error('[Partnerships] Failed to update agreement:', error);
    res.status(500).json({ error: error.message || 'Failed to update agreement' });
  }
});

// Delete agreement
router.delete('/api/partnerships/:id/agreements/:agreementId', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const agreementId = parseInt(req.params.agreementId);
    await storage.deletePartnershipAgreement(agreementId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Partnerships] Failed to delete agreement:', error);
    res.status(500).json({ error: error.message || 'Failed to delete agreement' });
  }
});

// Organization agreements (original routes)
router.get('/api/organizations/:id/agreements', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const agreements = await storage.getPartnershipAgreements(id);
    res.json(agreements);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get agreements:', error);
    res.status(500).json({ error: error.message || 'Failed to get agreements' });
  }
});

router.post('/api/organizations/:id/agreements', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const user = req.user as User | undefined;
    const agreement = await storage.createPartnershipAgreement({
      ...req.body,
      organizationId,
      createdByUserId: user?.id,
    });
    res.json(agreement);
  } catch (error: any) {
    console.error('[Partnerships] Failed to create agreement:', error);
    res.status(500).json({ error: error.message || 'Failed to create agreement' });
  }
});

// Single agreement routes
router.get('/api/agreements/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const agreement = await storage.getPartnershipAgreement(id);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }
    res.json(agreement);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get agreement:', error);
    res.status(500).json({ error: error.message || 'Failed to get agreement' });
  }
});

router.put('/api/agreements/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const agreement = await storage.updatePartnershipAgreement(id, req.body);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }
    res.json(agreement);
  } catch (error: any) {
    console.error('[Partnerships] Failed to update agreement:', error);
    res.status(500).json({ error: error.message || 'Failed to update agreement' });
  }
});

router.delete('/api/agreements/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deletePartnershipAgreement(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Partnerships] Failed to delete agreement:', error);
    res.status(500).json({ error: error.message || 'Failed to delete agreement' });
  }
});

// ==================== Agreement Attachments ====================

// Get all attachments for an agreement
router.get('/api/agreements/:agreementId/attachments', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const agreementId = parseInt(req.params.agreementId);
    const attachments = await storage.getAgreementAttachments(agreementId);
    
    // Add signed URLs for each attachment
    const attachmentsWithUrls = attachments.map(attachment => ({
      ...attachment,
      downloadUrl: minioService.generateSignedAgreementAttachmentUrl(attachment.objectKey),
    }));
    
    res.json(attachmentsWithUrls);
  } catch (error: any) {
    console.error('[Agreements] Failed to get attachments:', error);
    res.status(500).json({ error: error.message || 'Failed to get attachments' });
  }
});

// Upload an attachment to an agreement
router.post('/api/agreements/:agreementId/attachments', isAdminOrSuperAdmin, agreementAttachmentUpload.single('file'), async (req, res) => {
  try {
    const agreementId = parseInt(req.params.agreementId);
    const file = req.file;
    const user = req.user as User | undefined;
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Verify agreement exists
    const agreement = await storage.getPartnershipAgreement(agreementId);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }
    
    // Upload to MinIO
    const uploadResult = await minioService.uploadAgreementAttachment(
      file.buffer,
      file.originalname,
      file.mimetype,
      agreementId
    );
    
    // Create database record
    const attachment = await storage.createAgreementAttachment({
      agreementId,
      fileName: file.originalname.replace(/[<>:"|?*]/g, '_'),
      originalFileName: file.originalname,
      objectKey: uploadResult.objectKey,
      fileSize: uploadResult.fileSize,
      mimeType: file.mimetype,
      uploadedByUserId: user?.id || null,
    });
    
    res.status(201).json({
      ...attachment,
      downloadUrl: minioService.generateSignedAgreementAttachmentUrl(attachment.objectKey),
    });
  } catch (error: any) {
    console.error('[Agreements] Failed to upload attachment:', error);
    res.status(500).json({ error: error.message || 'Failed to upload attachment' });
  }
});

// Delete an attachment
router.delete('/api/agreements/:agreementId/attachments/:attachmentId', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const attachmentId = parseInt(req.params.attachmentId);
    
    // Get attachment to find object key
    const attachment = await storage.getAgreementAttachment(attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    // Delete from MinIO
    try {
      await minioService.deleteAgreementAttachment(attachment.objectKey);
    } catch (error) {
      console.error(`[Agreements] Failed to delete from MinIO:`, error);
      // Continue to delete database record even if MinIO fails
    }
    
    // Delete from database
    await storage.deleteAgreementAttachment(attachmentId);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Agreements] Failed to delete attachment:', error);
    res.status(500).json({ error: error.message || 'Failed to delete attachment' });
  }
});

// Serve agreement attachment file (with signature verification)
router.get('/api/agreements/attachments/:objectKey(*)', async (req, res) => {
  try {
    const objectKey = decodeURIComponent(req.params.objectKey);
    const { expires, sig } = req.query;
    
    // Verify signature
    if (!expires || !sig || !minioService.verifySignedAgreementAttachmentUrl(objectKey, String(expires), String(sig))) {
      return res.status(403).json({ error: 'Invalid or expired URL' });
    }
    
    // Get attachment metadata from database
    const attachment = await storage.getAgreementAttachmentByObjectKey(objectKey);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    // Get file from MinIO
    const { buffer, contentType } = await minioService.getAgreementAttachmentBuffer(objectKey);
    
    // Set headers for download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.originalFileName)}"`);
    res.setHeader('Content-Length', buffer.length);
    
    res.send(buffer);
  } catch (error: any) {
    console.error('[Agreements] Failed to serve attachment:', error);
    res.status(500).json({ error: error.message || 'Failed to serve attachment' });
  }
});

// ==================== Partnership Activities ====================

// Get activities for a partnership
router.get('/api/partnerships/:id/activities', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const activities = await storage.getPartnershipActivities(id);
    res.json(activities);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get activities:', error);
    res.status(500).json({ error: error.message || 'Failed to get activities' });
  }
});

// Get activities by event ID
router.get('/api/events/:eventId/partnership-activities', isAuthenticated, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const activities = await storage.getActivitiesByEventId(eventId);
    res.json(activities);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get activities by event:', error);
    res.status(500).json({ error: error.message || 'Failed to get activities' });
  }
});

// Create activity for a partnership
router.post('/api/partnerships/:id/activities', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const activity = await storage.createPartnershipActivity({
      ...req.body,
      organizationId,
    });
    res.status(201).json(activity);
  } catch (error: any) {
    console.error('[Partnerships] Failed to create activity:', error);
    res.status(500).json({ error: error.message || 'Failed to create activity' });
  }
});

// Update activity
router.put('/api/partnerships/:id/activities/:activityId', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const activityId = parseInt(req.params.activityId);
    const activity = await storage.updatePartnershipActivity(activityId, req.body);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    res.json(activity);
  } catch (error: any) {
    console.error('[Partnerships] Failed to update activity:', error);
    res.status(500).json({ error: error.message || 'Failed to update activity' });
  }
});

// Delete activity
router.delete('/api/partnerships/:id/activities/:activityId', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const activityId = parseInt(req.params.activityId);
    await storage.deletePartnershipActivity(activityId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Partnerships] Failed to delete activity:', error);
    res.status(500).json({ error: error.message || 'Failed to delete activity' });
  }
});

// Organization activities (original routes)
router.get('/api/organizations/:id/activities', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const activities = await storage.getPartnershipActivities(id);
    res.json(activities);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get activities:', error);
    res.status(500).json({ error: error.message || 'Failed to get activities' });
  }
});

router.post('/api/organizations/:id/activities', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const user = req.user as User | undefined;
    const activity = await storage.createPartnershipActivity({
      ...req.body,
      organizationId,
      createdByUserId: user?.id,
    });
    res.json(activity);
  } catch (error: any) {
    console.error('[Partnerships] Failed to create activity:', error);
    res.status(500).json({ error: error.message || 'Failed to create activity' });
  }
});

// Single activity routes
router.get('/api/activities/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const activity = await storage.getPartnershipActivity(id);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    res.json(activity);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get activity:', error);
    res.status(500).json({ error: error.message || 'Failed to get activity' });
  }
});

router.put('/api/activities/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const activity = await storage.updatePartnershipActivity(id, req.body);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    res.json(activity);
  } catch (error: any) {
    console.error('[Partnerships] Failed to update activity:', error);
    res.status(500).json({ error: error.message || 'Failed to update activity' });
  }
});

router.delete('/api/activities/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deletePartnershipActivity(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Partnerships] Failed to delete activity:', error);
    res.status(500).json({ error: error.message || 'Failed to delete activity' });
  }
});

// ==================== Partnership Contacts ====================

// Get contacts for a partnership
router.get('/api/partnerships/:id/contacts', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const contacts = await storage.getPartnershipContacts(id);
    res.json(contacts);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get contacts:', error);
    res.status(500).json({ error: error.message || 'Failed to get contacts' });
  }
});

// Add contact to a partnership
router.post('/api/partnerships/:id/contacts', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const contact = await storage.addPartnershipContact({
      ...req.body,
      organizationId,
    });
    res.status(201).json(contact);
  } catch (error: any) {
    console.error('[Partnerships] Failed to create contact:', error);
    res.status(500).json({ error: error.message || 'Failed to create contact' });
  }
});

// Remove contact from a partnership
router.delete('/api/partnerships/:id/contacts/:contactId', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    await storage.removePartnershipContact(contactId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Partnerships] Failed to remove contact:', error);
    res.status(500).json({ error: error.message || 'Failed to remove contact' });
  }
});

// Organization partnership contacts (original routes)
router.get('/api/organizations/:id/partnership-contacts', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const contacts = await storage.getPartnershipContacts(id);
    res.json(contacts);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get partnership contacts:', error);
    res.status(500).json({ error: error.message || 'Failed to get partnership contacts' });
  }
});

router.post('/api/organizations/:id/partnership-contacts', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const contact = await storage.addPartnershipContact({
      ...req.body,
      organizationId,
    });
    res.json(contact);
  } catch (error: any) {
    console.error('[Partnerships] Failed to add partnership contact:', error);
    res.status(500).json({ error: error.message || 'Failed to add partnership contact' });
  }
});

// Single partnership contact routes
router.put('/api/partnership-contacts/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const contact = await storage.updatePartnershipContact(id, req.body);
    if (!contact) {
      return res.status(404).json({ error: 'Partnership contact not found' });
    }
    res.json(contact);
  } catch (error: any) {
    console.error('[Partnerships] Failed to update partnership contact:', error);
    res.status(500).json({ error: error.message || 'Failed to update partnership contact' });
  }
});

router.delete('/api/partnership-contacts/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.removePartnershipContact(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Partnerships] Failed to remove partnership contact:', error);
    res.status(500).json({ error: error.message || 'Failed to remove partnership contact' });
  }
});

// ==================== Partnership Comments ====================

// Get comments for a partnership
router.get('/api/partnerships/:id/comments', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const comments = await storage.getPartnershipComments(organizationId);
    res.json(comments);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get comments:', error);
    res.status(500).json({ error: error.message || 'Failed to get comments' });
  }
});

// Create a comment
router.post('/api/partnerships/:id/comments', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const { body, bodyAr } = req.body;
    const user = req.user as User;

    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Comment body is required' });
    }

    const comment = await storage.createPartnershipComment({
      organizationId,
      body: body.trim(),
      bodyAr: bodyAr?.trim() || null,
      authorUserId: user.id,
    });

    // Return with author username
    const comments = await storage.getPartnershipComments(organizationId);
    const createdComment = comments.find(c => c.id === comment.id);
    res.status(201).json(createdComment || comment);
  } catch (error: any) {
    console.error('[Partnerships] Failed to create comment:', error);
    res.status(500).json({ error: error.message || 'Failed to create comment' });
  }
});

// Update a comment
router.put('/api/partnerships/:id/comments/:commentId', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    const { body, bodyAr } = req.body;
    const user = req.user as User;

    // Check if the comment exists
    const existingComment = await storage.getPartnershipComment(commentId);
    if (!existingComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only allow editing own comments (unless superadmin)
    if (user.role !== 'superadmin' && existingComment.authorUserId !== user.id) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }

    const updated = await storage.updatePartnershipComment(commentId, {
      body: body?.trim(),
      bodyAr: bodyAr?.trim() || null,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Return with author username
    const organizationId = parseInt(req.params.id);
    const comments = await storage.getPartnershipComments(organizationId);
    const updatedComment = comments.find(c => c.id === commentId);
    res.json(updatedComment || updated);
  } catch (error: any) {
    console.error('[Partnerships] Failed to update comment:', error);
    res.status(500).json({ error: error.message || 'Failed to update comment' });
  }
});

// Delete a comment
router.delete('/api/partnerships/:id/comments/:commentId', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    const user = req.user as User;

    // Check if the comment exists
    const existingComment = await storage.getPartnershipComment(commentId);
    if (!existingComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only allow deleting own comments (unless superadmin)
    if (user.role !== 'superadmin' && existingComment.authorUserId !== user.id) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    await storage.deletePartnershipComment(commentId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Partnerships] Failed to delete comment:', error);
    res.status(500).json({ error: error.message || 'Failed to delete comment' });
  }
});

// ==================== Partnership Interactions ====================

// Get interactions for a partnership
router.get('/api/partnerships/:id/interactions', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const interactions = await storage.getPartnershipInteractions(id);
    
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
    console.error('[Partnerships] Failed to get interactions:', error);
    res.status(500).json({ error: error.message || 'Failed to get interactions' });
  }
});

// Create an interaction
router.post('/api/partnerships/:id/interactions', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const organizationId = parseInt(req.params.id);
    const user = req.user as User;
    
    // Convert interactionDate string to Date object if provided
    const data = {
      ...req.body,
      organizationId,
      createdByUserId: user.id,
      interactionDate: req.body.interactionDate ? new Date(req.body.interactionDate) : new Date(),
    };
    
    const interaction = await storage.createPartnershipInteraction(data);
    
    // Return with username
    const userDetails = await storage.getUser(user.id);
    res.status(201).json({ ...interaction, createdByUsername: userDetails?.username || null });
  } catch (error: any) {
    console.error('[Partnerships] Failed to create interaction:', error);
    res.status(500).json({ error: error.message || 'Failed to create interaction' });
  }
});

// Get single interaction
router.get('/api/partnership-interactions/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const interaction = await storage.getPartnershipInteraction(id);
    if (!interaction) {
      return res.status(404).json({ error: 'Interaction not found' });
    }
    res.json(interaction);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get interaction:', error);
    res.status(500).json({ error: error.message || 'Failed to get interaction' });
  }
});

// Update an interaction
router.put('/api/partnership-interactions/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Convert interactionDate string to Date object if provided
    const data = {
      ...req.body,
      interactionDate: req.body.interactionDate ? new Date(req.body.interactionDate) : undefined,
    };
    
    const interaction = await storage.updatePartnershipInteraction(id, data);
    if (!interaction) {
      return res.status(404).json({ error: 'Interaction not found' });
    }
    res.json(interaction);
  } catch (error: any) {
    console.error('[Partnerships] Failed to update interaction:', error);
    res.status(500).json({ error: error.message || 'Failed to update interaction' });
  }
});

// Delete an interaction
router.delete('/api/partnership-interactions/:id', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deletePartnershipInteraction(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Partnerships] Failed to delete interaction:', error);
    res.status(500).json({ error: error.message || 'Failed to delete interaction' });
  }
});

// ==================== Partnership Tasks ====================

// Get tasks for a partnership
router.get('/api/partnerships/:id/tasks', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tasks = await storage.getPartnershipTasks(id);
    res.json(tasks);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get tasks:', error);
    res.status(500).json({ error: error.message || 'Failed to get tasks' });
  }
});

// Create a task for a partnership
router.post('/api/partnerships/:id/tasks', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const partnershipId = parseInt(req.params.id);
    const user = req.user as User;
    const task = await storage.createPartnershipTask({
      ...req.body,
      partnershipId,
      createdByUserId: user.id,
    });
    res.status(201).json(task);
  } catch (error: any) {
    console.error('[Partnerships] Failed to create task:', error);
    res.status(500).json({ error: error.message || 'Failed to create task' });
  }
});

// ==================== Partner Events ====================

// Get events associated with a partner
router.get('/api/organizations/:id/partner-events', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const events = await storage.getPartnerEvents(id);
    res.json(events);
  } catch (error: any) {
    console.error('[Partnerships] Failed to get partner events:', error);
    res.status(500).json({ error: error.message || 'Failed to get partner events' });
  }
});

export default router;
