/**
 * Organization and Contact Routes
 *
 * API endpoints for organization, position, partnership type, agreement type,
 * country, and contact management.
 *
 * @module routes/organization
 */

import { Router } from "express";
import multer from "multer";
import { storage } from "../storage";
import { isAuthenticated, isAdminOrSuperAdmin } from "../auth";
import { minioService } from "../services/minio";
import { indexingService } from "../services/elasticsearch-indexing.service";
import { aggregationsService } from "../services/elasticsearch-aggregations.service";
import { fromError } from "zod-validation-error";

const router = Router();

// ==================== Multer Configuration ====================

const contactPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  },
});

const contactsCSVUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// ==================== Organization Routes ====================

router.get("/api/organizations", async (req, res) => {
  try {
    const allOrganizations = await storage.getAllOrganizations();
    res.json(allOrganizations);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

router.get("/api/organizations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const organization = await storage.getOrganization(id);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }
    res.json(organization);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch organization" });
  }
});

router.post("/api/organizations", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { nameEn, nameAr } = req.body;
    if (!nameEn) {
      return res.status(400).json({ error: "Organization name (English) is required" });
    }
    const organization = await storage.createOrganization({ nameEn, nameAr, isPartner: false });

    // Index organization to Elasticsearch (non-blocking)
    indexingService.indexOrganization(organization).catch(err => {
      console.warn("[ES] Failed to index new organization:", err?.message || err);
    });

    res.status(201).json(organization);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: "Organization with this name already exists" });
    }
    res.status(500).json({ error: "Failed to create organization" });
  }
});

router.put("/api/organizations/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nameEn, nameAr } = req.body;
    if (!nameEn) {
      return res.status(400).json({ error: "Organization name (English) is required" });
    }
    const organization = await storage.updateOrganization(id, { nameEn, nameAr });
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Re-index organization to Elasticsearch (non-blocking)
    indexingService.indexOrganization(organization).catch(err => {
      console.warn("[ES] Failed to re-index updated organization:", err?.message || err);
    });

    res.json(organization);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: "Organization with this name already exists" });
    }
    res.status(500).json({ error: "Failed to update organization" });
  }
});

router.delete("/api/organizations/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteOrganization(id);
    if (!deleted) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Delete organization from Elasticsearch (non-blocking)
    indexingService.deleteDocument('organizations', String(id)).catch(err => {
      console.warn("[ES] Failed to delete organization from index:", err?.message || err);
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === '23503') {
      return res.status(400).json({ error: "Cannot delete organization that is in use by contacts" });
    }
    res.status(500).json({ error: "Failed to delete organization" });
  }
});

// ==================== Position Routes ====================

router.get("/api/positions", async (req, res) => {
  try {
    const allPositions = await storage.getAllPositions();
    res.json(allPositions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch positions" });
  }
});

router.get("/api/positions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const position = await storage.getPosition(id);
    if (!position) {
      return res.status(404).json({ error: "Position not found" });
    }
    res.json(position);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch position" });
  }
});

router.post("/api/positions", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { nameEn, nameAr } = req.body;
    if (!nameEn) {
      return res.status(400).json({ error: "Position name (English) is required" });
    }
    const position = await storage.createPosition({ nameEn, nameAr });
    res.status(201).json(position);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: "Position with this name already exists" });
    }
    res.status(500).json({ error: "Failed to create position" });
  }
});

router.put("/api/positions/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nameEn, nameAr } = req.body;
    if (!nameEn) {
      return res.status(400).json({ error: "Position name (English) is required" });
    }
    const position = await storage.updatePosition(id, { nameEn, nameAr });
    if (!position) {
      return res.status(404).json({ error: "Position not found" });
    }
    res.json(position);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: "Position with this name already exists" });
    }
    res.status(500).json({ error: "Failed to update position" });
  }
});

router.delete("/api/positions/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await storage.deletePosition(id);
    if (!deleted) {
      return res.status(404).json({ error: "Position not found" });
    }
    res.status(204).send();
  } catch (error: any) {
    if (error.code === '23503') {
      return res.status(400).json({ error: "Cannot delete position that is in use by contacts" });
    }
    res.status(500).json({ error: "Failed to delete position" });
  }
});

// ==================== Partnership Type Routes ====================

router.get("/api/partnership-types", async (req, res) => {
  try {
    const allPartnershipTypes = await storage.getAllPartnershipTypes();
    res.json(allPartnershipTypes);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch partnership types" });
  }
});

router.get("/api/partnership-types/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const partnershipType = await storage.getPartnershipType(id);
    if (!partnershipType) {
      return res.status(404).json({ error: "Partnership type not found" });
    }
    res.json(partnershipType);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch partnership type" });
  }
});

router.post("/api/partnership-types", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { nameEn, nameAr } = req.body;
    if (!nameEn) {
      return res.status(400).json({ error: "Partnership type name (English) is required" });
    }
    const partnershipType = await storage.createPartnershipType({ nameEn, nameAr });
    res.status(201).json(partnershipType);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: "Partnership type with this name already exists" });
    }
    res.status(500).json({ error: "Failed to create partnership type" });
  }
});

router.put("/api/partnership-types/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nameEn, nameAr } = req.body;
    if (!nameEn) {
      return res.status(400).json({ error: "Partnership type name (English) is required" });
    }
    const partnershipType = await storage.updatePartnershipType(id, { nameEn, nameAr });
    if (!partnershipType) {
      return res.status(404).json({ error: "Partnership type not found" });
    }
    res.json(partnershipType);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: "Partnership type with this name already exists" });
    }
    res.status(500).json({ error: "Failed to update partnership type" });
  }
});

router.delete("/api/partnership-types/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await storage.deletePartnershipType(id);
    if (!deleted) {
      return res.status(404).json({ error: "Partnership type not found" });
    }
    res.status(204).send();
  } catch (error: any) {
    if (error.code === '23503') {
      return res.status(400).json({ error: "Cannot delete partnership type that is in use" });
    }
    res.status(500).json({ error: "Failed to delete partnership type" });
  }
});

// ==================== Agreement Type Routes ====================

router.get("/api/agreement-types", async (req, res) => {
  try {
    const allAgreementTypes = await storage.getAllAgreementTypes();
    res.json(allAgreementTypes);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch agreement types" });
  }
});

router.get("/api/agreement-types/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const agreementType = await storage.getAgreementType(id);
    if (!agreementType) {
      return res.status(404).json({ error: "Agreement type not found" });
    }
    res.json(agreementType);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch agreement type" });
  }
});

router.post("/api/agreement-types", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { nameEn, nameAr } = req.body;
    if (!nameEn) {
      return res.status(400).json({ error: "Agreement type name (English) is required" });
    }
    const agreementType = await storage.createAgreementType({ nameEn, nameAr });
    res.status(201).json(agreementType);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: "Agreement type with this name already exists" });
    }
    res.status(500).json({ error: "Failed to create agreement type" });
  }
});

router.put("/api/agreement-types/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nameEn, nameAr } = req.body;
    if (!nameEn) {
      return res.status(400).json({ error: "Agreement type name (English) is required" });
    }
    const agreementType = await storage.updateAgreementType(id, { nameEn, nameAr });
    if (!agreementType) {
      return res.status(404).json({ error: "Agreement type not found" });
    }
    res.json(agreementType);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: "Agreement type with this name already exists" });
    }
    res.status(500).json({ error: "Failed to update agreement type" });
  }
});

router.delete("/api/agreement-types/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteAgreementType(id);
    if (!deleted) {
      return res.status(404).json({ error: "Agreement type not found" });
    }
    res.status(204).send();
  } catch (error: any) {
    if (error.code === '23503') {
      return res.status(400).json({ error: "Cannot delete agreement type that is in use" });
    }
    res.status(500).json({ error: "Failed to delete agreement type" });
  }
});

// ==================== Country Routes ====================

router.get("/api/countries", async (req, res) => {
  try {
    const allCountries = await storage.getAllCountries();
    res.json(allCountries);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch countries" });
  }
});

// ==================== Contact Routes ====================

router.get("/api/contacts", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;
    const organizationId = req.query.organizationId ? parseInt(req.query.organizationId as string) : undefined;
    const positionId = req.query.positionId ? parseInt(req.query.positionId as string) : undefined;
    const countryId = req.query.countryId ? parseInt(req.query.countryId as string) : undefined;
    const isEligibleSpeaker = req.query.isEligibleSpeaker === 'true' ? true :
      req.query.isEligibleSpeaker === 'false' ? false : undefined;

    const result = await storage.getAllContacts({ page, limit, search, organizationId, positionId, countryId, isEligibleSpeaker });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

router.get("/api/contacts/grouped", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const groupBy = req.query.groupBy as 'organization' | 'position' | 'country';
    if (!groupBy || !['organization', 'position', 'country'].includes(groupBy)) {
      return res.status(400).json({ error: "Invalid groupBy parameter" });
    }

    const groupId = req.query.groupId ? parseInt(req.query.groupId as string) : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 5;
    const search = req.query.search as string | undefined;
    const isEligibleSpeaker = req.query.isEligibleSpeaker === 'true' ? true :
      req.query.isEligibleSpeaker === 'false' ? false : undefined;

    const result = await storage.getGroupedContacts({ groupBy, groupId, page, limit, search, isEligibleSpeaker });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch grouped contacts" });
  }
});

router.get("/api/contacts/speakers", isAuthenticated, async (req, res) => {
  try {
    const speakers = await storage.getEligibleSpeakers();
    res.json(speakers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch eligible speakers" });
  }
});

router.get("/api/contacts/statistics", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const statistics = await storage.getContactsStatistics(limit);
    res.json(statistics);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch contacts statistics" });
  }
});

router.get("/api/contacts/organizations/statistics", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const sortBy = (req.query.sortBy as string) || 'totalAttendances';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const statistics = await storage.getOrganizationStatistics({ limit, sortBy, sortOrder });
    res.json(statistics);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch organization statistics" });
  }
});

router.get("/api/analytics/engagement", isAdminOrSuperAdmin, async (req, res) => {
  try {
    // Use Elasticsearch exclusively - NO SQL FALLBACK
    const esAnalytics = await aggregationsService.getEngagementAnalytics();
    if (!esAnalytics) {
      console.error('[Engagement Analytics] Elasticsearch unavailable - NO SQL FALLBACK');
      res.status(503).json({ error: "Analytics service unavailable. Elasticsearch is required for engagement analytics." });
      return;
    }

    // ES returned data - all data is from Elasticsearch including geographic engagement
    res.json({
      ...esAnalytics,
      // Add default values for fields not yet implemented in ES
      engagementByCategory: esAnalytics.engagementByCategory.map(cat => ({
        ...cat,
        totalRegistrations: 0,
        totalRSVPs: 0,
        totalSpeakers: 0,
        registrationRate: 0,
        rsvpRate: 0,
        conversionRate: cat.attendanceRate,
      })),
      engagementByMonth: esAnalytics.engagementByMonth.map(month => ({
        ...month,
        totalRegistrations: 0,
        totalRSVPs: 0,
      })),
      conversionFunnel: {
        ...esAnalytics.conversionFunnel,
        // Use invited count as emailsSent for the funnel display
        emailsSent: esAnalytics.conversionFunnel.invited,
        rsvped: 0,
        emailSentRate: 100,
        rsvpRate: 0,
      },
      topPerformingEvents: esAnalytics.topPerformingEvents.map(evt => ({
        ...evt,
        categoryNameAr: null,
      })),
      // Geographic engagement now comes from ES
      geographicEngagement: esAnalytics.geographicEngagement,
      eventTypeEngagement: esAnalytics.eventTypeEngagement.map(et => ({
        ...et,
        averageAttendance: 0,
      })),
    });
  } catch (error) {
    console.error('[Engagement Analytics] Error:', error);
    res.status(500).json({ error: "Failed to fetch engagement analytics" });
  }
});

router.get("/api/contacts/csv-template", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const templatePath = path.join(process.cwd(), 'server', 'templates', 'contacts-template.csv');
    const template = await fs.readFile(templatePath, 'utf-8');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts-template.csv"');
    res.send(template);
  } catch (error) {
    res.status(500).json({ error: "Failed to download CSV template" });
  }
});

router.post("/api/contacts/export", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const Papa = (await import('papaparse')).default;
    const filters = req.body.filters || {};
    const result = await storage.getAllContacts({
      page: 1, limit: 10000,
      search: filters.search,
      organizationId: filters.organizationId,
      positionId: filters.positionId,
      countryId: filters.countryId,
      isEligibleSpeaker: filters.isEligibleSpeaker,
    });

    const csvData = result.contacts.map(contact => ({
      nameEn: contact.nameEn || '',
      nameAr: contact.nameAr || '',
      title: contact.title || '',
      titleAr: contact.titleAr || '',
      organization: contact.organization?.nameEn || '',
      organizationAr: contact.organization?.nameAr || '',
      position: contact.position?.nameEn || '',
      positionAr: contact.position?.nameAr || '',
      country: contact.country?.code || '',
      phone: contact.phone || '',
      email: contact.email || '',
      isEligibleSpeaker: contact.isEligibleSpeaker ? 'true' : 'false',
    }));

    const csv = Papa.unparse(csvData, { header: true });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="contacts-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: "Failed to export contacts" });
  }
});

router.post("/api/contacts/import", isAdminOrSuperAdmin, contactsCSVUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No CSV file provided" });
    }

    const Papa = (await import('papaparse')).default;
    const csvContent = req.file.buffer.toString('utf-8');
    const parseResult = Papa.parse(csvContent, {
      header: true, skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
    });

    if (parseResult.errors.length > 0) {
      return res.status(400).json({ error: "CSV parsing failed", details: parseResult.errors });
    }

    const rows = parseResult.data as any[];
    let imported = 0, updated = 0, skipped = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        if (!row.nameEn && !row.email) {
          errors.push({ row: rowNumber, error: "Either nameEn or email is required" });
          skipped++;
          continue;
        }

        let organizationId = null;
        if (row.organization) {
          let org = await storage.getOrganizationByName(row.organization);
          if (!org) {
            org = await storage.createOrganization({ nameEn: row.organization, isPartner: false, nameAr: row.organizationAr || null });
          }
          organizationId = org.id;
        }

        let positionId = null;
        if (row.position) {
          let pos = await storage.getPositionByName(row.position);
          if (!pos) {
            pos = await storage.createPosition({ nameEn: row.position, nameAr: row.positionAr || null });
          }
          positionId = pos.id;
        }

        let countryId = null;
        if (row.country) {
          const country = await storage.getCountryByCode(row.country);
          if (country) countryId = country.id;
        }

        let existingContact = row.email ? await storage.getContactByEmail(row.email) : null;
        if (!existingContact && row.nameEn) {
          existingContact = await storage.getContactByName(row.nameEn, organizationId);
        }

        const contactData = {
          nameEn: row.nameEn || '',
          nameAr: row.nameAr || null,
          title: row.title || null,
          titleAr: row.titleAr || null,
          organizationId, positionId, countryId,
          phone: row.phone || null,
          email: row.email || null,
          isEligibleSpeaker: row.isEligibleSpeaker === 'true' || row.isEligibleSpeaker === '1',
        };

        if (existingContact) {
          await storage.updateContact(existingContact.id, contactData);
          updated++;
        } else {
          await storage.createContact(contactData);
          imported++;
        }
      } catch (error: any) {
        errors.push({ row: rowNumber, error: error.message });
        skipped++;
      }
    }

    res.json({ imported, updated, skipped, errors, total: rows.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to import contacts" });
  }
});

router.get("/api/contacts/profile-picture/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const useThumbnail = req.query.thumbnail === 'true';
    const contact = await storage.getContact(id);

    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    const serveSignedUrl = () => {
      const objectKey = useThumbnail && contact.profilePictureThumbnailKey
        ? contact.profilePictureThumbnailKey
        : contact.profilePictureKey;

      if (!objectKey) {
        return res.status(404).json({ error: "Profile picture not found" });
      }

      const signedUrl = minioService.generateSignedMediaUrl(objectKey, 3600);
      return res.redirect(signedUrl);
    };

    if (!contact.isEligibleSpeaker) {
      return isAdminOrSuperAdmin(req, res, serveSignedUrl);
    }
    return serveSignedUrl();
  } catch (error) {
    res.status(500).json({ error: "Failed to load profile picture" });
  }
});

router.get("/api/contacts/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const contact = await storage.getContact(id);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch contact" });
  }
});

router.get("/api/contacts/:contactId/events", async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    const contact = await storage.getContact(contactId);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }
    const { events: contactEvents, archivedEvents: contactArchivedEvents } = await storage.getContactEvents(contactId);
    res.json({ contact, events: contactEvents, archivedEvents: contactArchivedEvents });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch contact events" });
  }
});

router.post("/api/contacts/:id/profile-picture", isAdminOrSuperAdmin, contactPhotoUpload.single('file'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!req.file) {
      return res.status(400).json({ error: "Profile photo file is required" });
    }

    const contact = await storage.getContact(id);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    const uploadResult = await minioService.uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);

    if (contact.profilePictureKey) {
      await minioService.deleteImage(contact.profilePictureKey, contact.profilePictureThumbnailKey || undefined);
    }

    const updatedContact = await storage.updateContact(id, {
      profilePictureKey: uploadResult.objectKey,
      profilePictureThumbnailKey: uploadResult.thumbnailKey,
    });
    res.json(updatedContact);
  } catch (error) {
    res.status(500).json({ error: "Failed to upload profile picture" });
  }
});

router.post("/api/contacts", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { insertContactSchema } = await import("@shared/schema.mssql");
    const result = insertContactSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: fromError(result.error).toString() });
    }
    const contact = await storage.createContact(result.data);

    // Index contact to Elasticsearch (non-blocking)
    indexingService.indexContact(contact).catch(err => {
      console.warn("[ES] Failed to index new contact:", err?.message || err);
    });

    res.status(201).json(contact);
  } catch (error) {
    res.status(500).json({ error: "Failed to create contact" });
  }
});

router.patch("/api/contacts/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { updateContactSchema } = await import("@shared/schema.mssql");
    const result = updateContactSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: fromError(result.error).toString() });
    }
    const contact = await storage.updateContact(id, result.data);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // Re-index contact to Elasticsearch (non-blocking)
    indexingService.indexContact(contact).catch(err => {
      console.warn("[ES] Failed to re-index updated contact:", err?.message || err);
    });

    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: "Failed to update contact" });
  }
});

router.delete("/api/contacts/:id/profile-picture", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const contact = await storage.getContact(id);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    if (contact.profilePictureKey) {
      await minioService.deleteImage(contact.profilePictureKey, contact.profilePictureThumbnailKey || undefined);
    }
    await storage.updateContact(id, { profilePictureKey: null, profilePictureThumbnailKey: null });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete profile picture" });
  }
});

router.delete("/api/contacts/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteContact(id);
    if (!deleted) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // Delete contact from Elasticsearch (non-blocking)
    indexingService.deleteDocument('contacts', String(id)).catch(err => {
      console.warn("[ES] Failed to delete contact from index:", err?.message || err);
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === '23503') {
      return res.status(400).json({ error: "Cannot delete contact that is linked to events" });
    }
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

export default router;
