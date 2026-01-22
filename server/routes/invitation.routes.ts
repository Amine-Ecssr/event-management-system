/**
 * Invitation Routes
 *
 * API endpoints for event attendees, invitees, invitation emails,
 * and invitation job management.
 *
 * @module routes/invitation
 */

import { Router } from "express";
import multer from "multer";
import path from "path";
import { storage } from "../storage";
import { isAuthenticated, isAdminOrSuperAdmin } from "../auth";
import { emailService } from "../email";
import { canManageAttendees } from "./utils";

const router = Router();

// ==================== CSV Upload Configuration ====================

// Multer config for attendees CSV upload
const attendeesCSVUpload = multer({
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

// Multer config for invitees CSV upload
const inviteesCSVUpload = multer({
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

// ==================== Event Attendees Routes ====================

// Download event attendees CSV template
router.get("/api/events/attendees/csv-template", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const fs = await import('fs/promises');
    const templatePath = path.join(process.cwd(), 'server', 'templates', 'event-attendees-template.csv');
    const template = await fs.readFile(templatePath, 'utf-8');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="event-attendees-template.csv"');
    res.send(template);
  } catch (error) {
    console.error('[Event Attendees] Failed to download CSV template:', error);
    res.status(500).json({ error: "Failed to download CSV template" });
  }
});

// Get attendees for an event
router.get("/api/events/:eventId/attendees", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await storage.getEvent(eventId);
    
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const attendees = await storage.getEventAttendees(eventId);
    const speakers = await storage.getEventSpeakers(eventId);
    
    res.json({
      eventId,
      eventName: event.name,
      attendees,
      totalAttendees: attendees.length,
      speakers: speakers.length,
      regularAttendees: attendees.length,
    });
  } catch (error) {
    console.error('[Event Attendees] Failed to fetch attendees:', error);
    res.status(500).json({ error: "Failed to fetch event attendees" });
  }
});

// Download attendees list as CSV
router.get("/api/events/:eventId/attendees/download", canManageAttendees, async (req, res) => {
  try {
    const Papa = (await import('papaparse')).default;
    const eventId = req.params.eventId;
    const event = await storage.getEvent(eventId);
    
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const attendees = await storage.getEventAttendees(eventId);

    // Transform attendees to CSV format
    const csvData = attendees.map(attendee => ({
      nameEn: attendee.contact.nameEn || '',
      nameAr: attendee.contact.nameAr || '',
      email: attendee.contact.email || '',
      organization: attendee.contact.organization?.nameEn || '',
      organizationAr: attendee.contact.organization?.nameAr || '',
      position: attendee.contact.position?.nameEn || '',
      positionAr: attendee.contact.position?.nameAr || '',
      country: attendee.contact.country?.code || '',
      phone: attendee.contact.phone || '',
      title: attendee.contact.title || '',
      titleAr: attendee.contact.titleAr || '',
      notes: attendee.notes || '',
      attendedAt: attendee.attendedAt ? new Date(attendee.attendedAt).toISOString() : '',
    }));

    const csv = Papa.unparse(csvData, {
      header: true,
      columns: ['nameEn', 'nameAr', 'email', 'organization', 'organizationAr', 
                'position', 'positionAr', 'country', 'phone', 'title', 'titleAr', 'notes', 'attendedAt']
    });

    const eventName = event.name.replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendees-${eventName}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('[Event Attendees] Failed to download CSV:', error);
    res.status(500).json({ error: "Failed to download attendees list" });
  }
});

// Upload attendees list via CSV
router.post("/api/events/:eventId/attendees/upload", canManageAttendees, attendeesCSVUpload.single('file'), async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await storage.getEvent(eventId);
    
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No CSV file provided" });
    }

    const Papa = (await import('papaparse')).default;
    const csvContent = req.file.buffer.toString('utf-8');
    
    const parseResult = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
    });

    if (parseResult.errors.length > 0) {
      return res.status(400).json({ 
        error: "CSV parsing failed", 
        details: parseResult.errors 
      });
    }

    const rows = parseResult.data as any[];
    let newContacts = 0;
    let existingContacts = 0;
    let linked = 0;
    const errors: Array<{ row: number; error: string; data?: any }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because header is row 1 and array is 0-indexed

      try {
        // Validate required fields
        if (!row.nameEn && !row.email) {
          errors.push({ row: rowNumber, error: "Either nameEn or email is required", data: row });
          continue;
        }

        // Find or create organization
        let organizationId = null;
        if (row.organization) {
          let org = await storage.getOrganizationByName(row.organization);
          if (!org) {
            org = await storage.createOrganization({
              nameEn: row.organization,
              isPartner: false,
              nameAr: row.organizationAr || null,
            });
          }
          organizationId = org.id;
        }

        // Find or create position
        let positionId = null;
        if (row.position) {
          let pos = await storage.getPositionByName(row.position);
          if (!pos) {
            pos = await storage.createPosition({
              nameEn: row.position,
              nameAr: row.positionAr || null,
            });
          }
          positionId = pos.id;
        }

        // Find or create country
        let countryId = null;
        if (row.country) {
          const country = await storage.getCountryByCode(row.country);
          if (country) {
            countryId = country.id;
          }
        }

        // Check if contact exists (by email first, then by name+organization)
        let contact = null;
        if (row.email) {
          contact = await storage.getContactByEmail(row.email);
        }
        if (!contact && row.nameEn) {
          contact = await storage.getContactByName(row.nameEn, organizationId);
        }

        const contactData = {
          nameEn: row.nameEn || '',
          nameAr: row.nameAr || null,
          title: row.title || null,
          titleAr: row.titleAr || null,
          organizationId,
          positionId,
          countryId,
          phone: row.phone || null,
          email: row.email || null,
          isEligibleSpeaker: false, // Attendees are not automatically marked as speakers
        };

        if (contact) {
          // Update existing contact if newer information provided
          await storage.updateContact(contact.id, contactData);
          existingContacts++;
        } else {
          // Create new contact
          contact = await storage.createContact(contactData);
          newContacts++;
        }

        // Link contact to event as attendee (if not already linked)
        try {
          await storage.addEventAttendee({
            eventId,
            contactId: contact.id,
            notes: row.notes || null,
            attendedAt: new Date(),
          });
          linked++;
        } catch (linkError: any) {
          // If duplicate, attendee already linked - don't count as error or existing
          if (linkError.code === '23505' || (linkError.message && linkError.message.includes('unique'))) {
            // Already linked, skip silently
          } else {
            throw linkError;
          }
        }
      } catch (error: any) {
        errors.push({ row: rowNumber, error: error.message, data: row });
      }
    }

    res.json({
      eventId,
      processed: rows.length,
      newContacts,
      existingContacts,
      linked,
      errors,
    });
  } catch (error: any) {
    console.error('[Event Attendees] Failed to upload CSV:', error);
    res.status(500).json({ error: error.message || "Failed to upload attendees" });
  }
});

// Remove an attendee from event
router.delete("/api/events/:eventId/attendees/:contactId", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const contactId = parseInt(req.params.contactId);
    
    const deleted = await storage.removeEventAttendee(eventId, contactId);
    if (!deleted) {
      return res.status(404).json({ error: "Attendee not found for this event" });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('[Event Attendees] Failed to remove attendee:', error);
    res.status(500).json({ error: "Failed to remove attendee from event" });
  }
});

// ==================== Event Invitees Routes ====================

// Get invitees for an event
router.get("/api/events/:eventId/invitees", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await storage.getEvent(eventId);
    
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const invitees = await storage.getEventInvitees(eventId);
    
    // Calculate RSVP, registration, and email statistics
    const totalInvitees = invitees.length;
    const rsvpConfirmed = invitees.filter(inv => inv.rsvp).length;
    const registered = invitees.filter(inv => inv.registered).length;
    const emailsSent = invitees.filter(inv => inv.inviteEmailSent).length;
    const rsvpPending = totalInvitees - rsvpConfirmed;
    const rsvpConversionRate = totalInvitees > 0 ? (rsvpConfirmed / totalInvitees) * 100 : 0;
    const registrationRate = totalInvitees > 0 ? (registered / totalInvitees) * 100 : 0;
    const emailSentRate = totalInvitees > 0 ? (emailsSent / totalInvitees) * 100 : 0;
    
    res.json({
      eventId,
      eventName: event.name,
      invitees,
      totalInvitees,
      rsvpConfirmed,
      registered,
      emailsSent,
      rsvpPending,
      rsvpConversionRate: parseFloat(rsvpConversionRate.toFixed(2)),
      registrationRate: parseFloat(registrationRate.toFixed(2)),
      emailSentRate: parseFloat(emailSentRate.toFixed(2)),
    });
  } catch (error) {
    console.error('[Event Invitees] Failed to fetch invitees:', error);
    res.status(500).json({ error: "Failed to fetch event invitees" });
  }
});

// Download invitees list as CSV
router.get("/api/events/:eventId/invitees/download", canManageAttendees, async (req, res) => {
  try {
    const Papa = (await import('papaparse')).default;
    const eventId = req.params.eventId;
    const event = await storage.getEvent(eventId);
    
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const invitees = await storage.getEventInvitees(eventId);

    // Transform invitees to CSV format
    const csvData = invitees.map(invitee => ({
      nameEn: invitee.contact.nameEn || '',
      nameAr: invitee.contact.nameAr || '',
      email: invitee.contact.email || '',
      organization: invitee.contact.organization?.nameEn || '',
      organizationAr: invitee.contact.organization?.nameAr || '',
      position: invitee.contact.position?.nameEn || '',
      positionAr: invitee.contact.position?.nameAr || '',
      country: invitee.contact.country?.code || '',
      phone: invitee.contact.phone || '',
      title: invitee.contact.title || '',
      titleAr: invitee.contact.titleAr || '',
      rsvp: invitee.rsvp ? 'Yes' : 'No',
      registered: invitee.registered ? 'Yes' : 'No',
      inviteEmailSent: invitee.inviteEmailSent ? 'Yes' : 'No',
      rsvpAt: invitee.rsvpAt ? new Date(invitee.rsvpAt).toISOString() : '',
      registeredAt: invitee.registeredAt ? new Date(invitee.registeredAt).toISOString() : '',
      inviteEmailSentAt: invitee.inviteEmailSentAt ? new Date(invitee.inviteEmailSentAt).toISOString() : '',
      invitedAt: invitee.invitedAt ? new Date(invitee.invitedAt).toISOString() : '',
      notes: invitee.notes || '',
    }));

    const csv = Papa.unparse(csvData, {
      header: true,
      columns: ['nameEn', 'nameAr', 'email', 'organization', 'organizationAr', 
                'position', 'positionAr', 'country', 'phone', 'title', 'titleAr', 
                'rsvp', 'registered', 'inviteEmailSent', 'rsvpAt', 'registeredAt', 
                'inviteEmailSentAt', 'invitedAt', 'notes']
    });

    const eventName = event.name.replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="invitees-${eventName}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('[Event Invitees] Failed to download CSV:', error);
    res.status(500).json({ error: "Failed to download invitees list" });
  }
});

// Upload invitees list via CSV
router.post("/api/events/:eventId/invitees/upload", canManageAttendees, inviteesCSVUpload.single('file'), async (req, res) => {
  try {
    const Papa = (await import('papaparse')).default;
    const eventId = req.params.eventId;
    
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const parseResult = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim().toLowerCase(),
    });

    if (parseResult.errors.length > 0) {
      return res.status(400).json({ 
        error: "CSV parsing failed", 
        details: parseResult.errors 
      });
    }

    const rows = parseResult.data as any[];
    const results = {
      success: 0,
      existing: 0,
      created: 0,
      errors: [] as string[],
    };

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const nameEn = row['nameen'] || row['name_en'] || row['name'];
        const email = row['email'];

        if (!nameEn && !email) {
          results.errors.push(`Row ${i + 1}: Missing both name and email`);
          continue;
        }

        // Try to find existing contact by email
        let contact;
        if (email) {
          contact = await storage.getContactByEmail(email);
        }

        // If contact doesn't exist, create it
        if (!contact) {
          const newContact = await storage.createContact({
            nameEn: nameEn || 'Unknown',
            nameAr: row['namear'] || row['name_ar'] || undefined,
            email: email || undefined,
            phone: row['phone'] || undefined,
            title: row['title'] || undefined,
            titleAr: row['titlear'] || row['title_ar'] || undefined,
            organizationId: undefined,
            positionId: undefined,
            countryId: undefined,
            isEligibleSpeaker: false,
          });
          contact = newContact;
          results.created++;
        }

        // Link contact to event as invitee (if not already linked)
        try {
          const rsvp = row['rsvp']?.toLowerCase() === 'yes' || row['rsvp'] === '1' || row['rsvp'] === 'true';
          const registered = row['registered']?.toLowerCase() === 'yes' || row['registered'] === '1' || row['registered'] === 'true';
          const inviteEmailSent = row['inviteemailsent']?.toLowerCase() === 'yes' || row['invite_email_sent']?.toLowerCase() === 'yes' || row['inviteemailsent'] === '1' || row['invite_email_sent'] === '1';
          await storage.addEventInvitee({
            eventId,
            contactId: contact.id,
            rsvp,
            registered,
            inviteEmailSent,
            invitedAt: new Date(),
            rsvpAt: rsvp ? new Date() : undefined,
            registeredAt: registered ? new Date() : undefined,
            inviteEmailSentAt: inviteEmailSent ? new Date() : undefined,
            notes: row['notes'] || undefined,
          });
          results.success++;
        } catch (dupError: any) {
          // If duplicate, invitee already linked - count as existing
          if (dupError.code === '23505') {
            results.existing++;
          } else {
            throw dupError;
          }
        }
      } catch (rowError: any) {
        results.errors.push(`Row ${i + 1}: ${rowError.message}`);
      }
    }

    res.json(results);
  } catch (error: any) {
    console.error('[Event Invitees] Upload failed:', error);
    res.status(500).json({ error: error.message || "Failed to upload invitees" });
  }
});

// Update invitee RSVP, registration, and email sent status
router.patch("/api/events/:eventId/invitees/:contactId", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const contactId = parseInt(req.params.contactId);
    const { rsvp, registered, inviteEmailSent, notes } = req.body;

    const updateData: any = {};
    if (typeof rsvp === 'boolean') {
      updateData.rsvp = rsvp;
      updateData.rsvpAt = rsvp ? new Date() : null;
    }
    if (typeof registered === 'boolean') {
      updateData.registered = registered;
      updateData.registeredAt = registered ? new Date() : null;
    }
    if (typeof inviteEmailSent === 'boolean') {
      updateData.inviteEmailSent = inviteEmailSent;
      updateData.inviteEmailSentAt = inviteEmailSent ? new Date() : null;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const invitee = await storage.updateEventInvitee(eventId, contactId, updateData);
    res.json(invitee);
  } catch (error) {
    console.error('[Event Invitees] Failed to update invitee:', error);
    res.status(500).json({ error: "Failed to update invitee" });
  }
});

// Remove an invitee from event
router.delete("/api/events/:eventId/invitees/:contactId", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const contactId = parseInt(req.params.contactId);
    
    const deleted = await storage.removeEventInvitee(eventId, contactId);
    if (!deleted) {
      return res.status(404).json({ error: "Invitee not found for this event" });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('[Event Invitees] Failed to remove invitee:', error);
    res.status(500).json({ error: "Failed to remove invitee from event" });
  }
});

// Bulk add invitees to event
router.post("/api/events/:eventId/invitees/bulk", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const { contactIds } = req.body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: "contactIds must be a non-empty array" });
    }

    // Verify event exists
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Get existing invitees to avoid duplicates
    const existingInvitees = await storage.getEventInvitees(eventId);
    const existingContactIds = new Set(existingInvitees.map(inv => inv.contactId));

    let added = 0;
    let skipped = 0;

    for (const contactId of contactIds) {
      // Skip if already invited
      if (existingContactIds.has(contactId)) {
        skipped++;
        continue;
      }

      // Verify contact exists
      const contact = await storage.getContact(contactId);
      if (!contact) {
        skipped++;
        continue;
      }

      // Add invitee
      await storage.addEventInvitee({
        eventId,
        contactId,
        rsvp: false,
        registered: false,
        inviteEmailSent: false,
        notes: null,
      });
      added++;
    }

    res.json({
      success: true,
      added,
      skipped,
      total: contactIds.length,
    });
  } catch (error) {
    console.error('[Event Invitees] Failed to bulk add invitees:', error);
    res.status(500).json({ error: "Failed to add invitees to event" });
  }
});

// Download event invitees CSV template
router.get("/api/events/invitees/csv-template", isAdminOrSuperAdmin, async (req, res) => {
  try {
    // Generate a simple CSV template with headers
    const templatePath = path.join(process.cwd(), 'server', 'templates', 'event-invitees-template.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="event-invitees-template.csv"');
    res.sendFile(templatePath);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate CSV template" });
  }
});

// ==================== Custom Email Routes ====================

// Get custom email for event (if exists)
router.get("/api/events/:eventId/custom-email", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const customEmail = await storage.getEventCustomEmail(eventId);
    
    if (!customEmail) {
      return res.status(404).json({ error: "No custom email found for this event" });
    }

    res.json(customEmail);
  } catch (error) {
    console.error('[Custom Email] Failed to fetch custom email:', error);
    res.status(500).json({ error: "Failed to fetch custom email" });
  }
});

// Create or update custom email for event
router.post("/api/events/:eventId/custom-email", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const { subject, body } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ error: "Subject and body are required" });
    }

    // Check if event exists
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Create new custom email (this will automatically deactivate old ones)
    const customEmail = await storage.createEventCustomEmail({
      eventId,
      subject,
      body,
      isActive: true,
      createdByUserId: req.user?.id,
    });

    res.json(customEmail);
  } catch (error) {
    console.error('[Custom Email] Failed to save custom email:', error);
    res.status(500).json({ error: "Failed to save custom email" });
  }
});

// Delete custom email for event
router.delete("/api/events/:eventId/custom-email/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteEventCustomEmail(id);
    
    if (!deleted) {
      return res.status(404).json({ error: "Custom email not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error('[Custom Email] Failed to delete custom email:', error);
    res.status(500).json({ error: "Failed to delete custom email" });
  }
});

// ==================== Invitation Email Routes ====================

// Send test invitation email
router.post("/api/events/:eventId/send-test-invitation", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { invitationEmailService } = await import('../invitationEmailService');
    const eventId = req.params.eventId;
    const { testEmail, useCustomEmail } = req.body;

    if (!testEmail) {
      return res.status(400).json({ error: "Test email address is required" });
    }

    // Get event
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Create a test contact object
    const testContact = {
      id: 0,
      nameEn: "Test Recipient",
      email: testEmail,
    } as any;

    // Send test email
    if (useCustomEmail) {
      const customEmail = await storage.getEventCustomEmail(eventId);
      if (!customEmail) {
        return res.status(400).json({ error: "No custom email template found for this event" });
      }
      await emailService.sendCustomInvitationEmail(event, testContact, customEmail.subject, customEmail.body);
    } else {
      await emailService.sendInvitationEmail(event, testContact);
    }

    res.json({ success: true, message: `Test email sent to ${testEmail}` });
  } catch (error) {
    console.error('[Invitation Email] Failed to send test email:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to send test email" });
  }
});

// Start invitation email job
router.post("/api/events/:eventId/send-invitations", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { invitationEmailService } = await import('../invitationEmailService');
    const eventId = req.params.eventId;
    const { useCustomEmail = false, waitTimeSeconds = 2 } = req.body;

    // Validate wait time
    if (waitTimeSeconds < 1 || waitTimeSeconds > 60) {
      return res.status(400).json({ error: "Wait time must be between 1 and 60 seconds" });
    }

    // Get event
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // If using custom email, verify it exists
    if (useCustomEmail) {
      const customEmail = await storage.getEventCustomEmail(eventId);
      if (!customEmail) {
        return res.status(400).json({ error: "No custom email template found for this event. Please create one first." });
      }
    }

    // Create job
    const job = await invitationEmailService.createJob(
      eventId,
      useCustomEmail,
      waitTimeSeconds,
      req.user?.id
    );

    // Start processing in background
    invitationEmailService.startJob(job.id);

    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        totalRecipients: job.totalRecipients,
        useCustomEmail: job.useCustomEmail,
        waitTimeSeconds: job.waitTimeSeconds,
      },
      message: `Invitation email job started. ${job.totalRecipients} emails will be sent.`,
    });
  } catch (error) {
    console.error('[Invitation Email] Failed to start email job:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start invitation email job" });
  }
});

// Get invitation email job status for an event
router.get("/api/events/:eventId/invitation-jobs", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { invitationEmailService } = await import('../invitationEmailService');
    const eventId = req.params.eventId;

    const jobs = await invitationEmailService.getEventJobs(eventId);
    res.json(jobs);
  } catch (error) {
    console.error('[Invitation Email] Failed to fetch jobs:', error);
    res.status(500).json({ error: "Failed to fetch invitation email jobs" });
  }
});

// Get single job status
router.get("/api/invitation-jobs/:jobId", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { invitationEmailService } = await import('../invitationEmailService');
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
    console.error('[Invitation Email] Failed to fetch job:', error);
    res.status(500).json({ error: "Failed to fetch job status" });
  }
});

// Cancel invitation email job
router.post("/api/invitation-jobs/:jobId/cancel", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { invitationEmailService } = await import('../invitationEmailService');
    const jobId = parseInt(req.params.jobId);

    const job = await invitationEmailService.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.status !== 'pending' && job.status !== 'in_progress') {
      return res.status(400).json({ error: "Only pending or in-progress jobs can be cancelled" });
    }

    await invitationEmailService.cancelJob(jobId);
    res.json({ success: true, message: "Job cancelled successfully" });
  } catch (error) {
    console.error('[Invitation Email] Failed to cancel job:', error);
    res.status(500).json({ error: "Failed to cancel job" });
  }
});

export default router;
