/**
 * Elasticsearch Indexing Service
 * 
 * Provides real-time indexing of entities to Elasticsearch.
 * Handles transformations, bulk operations, and error recovery.
 * 
 * @module services/elasticsearch-indexing
 */

import { getOptionalElasticsearchClient, isElasticsearchEnabled } from '../elasticsearch/client';
import { 
  ENTITY_INDEX_MAP, 
  EntityIndexMapKey, 
  BulkIndexResult, 
  IndexResult 
} from '../elasticsearch/types';
import { 
  Event, 
  Task, 
  Contact, 
  Organization, 
  Lead, 
  PartnershipAgreement, 
  EventAttendee, 
  EventInvitee,
  LeadInteraction, 
  PartnershipActivity, 
  PartnershipInteraction,
  ArchivedEvent, 
  Update,
  Department,
} from '@shared/schema.mssql';

// Logger
const logger = {
  debug: (...args: any[]) => console.log('[ES Indexing]', ...args),
  info: (...args: any[]) => console.log('[ES Indexing]', ...args),
  warn: (...args: any[]) => console.warn('[ES Indexing]', ...args),
  error: (...args: any[]) => console.error('[ES Indexing]', ...args),
};

// ==================== Document Interfaces ====================

export interface ESEventDocument {
  id: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  searchText: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  locationAr: string | null;
  organizers: string | null;
  organizersAr: string | null;
  // Category (denormalized)
  category: string | null;
  categoryId: number | null;
  categoryNameEn: string | null;
  categoryNameAr: string | null;
  // Event classification
  eventType: string;
  eventScope: string;
  expectedAttendance: number | null;
  isScraped: boolean;
  source: string | null;
  isArchived: boolean;
  // Pre-computed stats
  mediaCount: number;
  inviteeCount: number;
  attendeeCount: number;
  registeredCount: number;
  attendanceRate: number;
  suggest: {
    input: string[];
    contexts: {
      category?: string[];
      type?: string[];
    };
  };
}

// ==================== Denormalized Attendee Document ====================
export interface ESAttendeeDocument {
  // Identity
  id: number;
  
  // Event Context (denormalized from events table)
  eventId: string;
  eventName: string;
  eventNameAr: string | null;
  eventDate: string;
  eventEndDate: string | null;
  eventLocation: string | null;
  eventCategory: string | null;
  eventCategoryId: number | null;
  eventCategoryNameEn: string | null;
  eventCategoryNameAr: string | null;
  eventType: string;
  eventScope: string;
  
  // Contact Context (denormalized from contacts table)
  contactId: number;
  contactName: string;
  contactNameAr: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactTitle: string | null;
  
  // Organization Context (denormalized from organizations table)
  organizationId: number | null;
  organizationName: string | null;
  organizationNameAr: string | null;
  
  // Country Context (denormalized from countries table)
  countryId: number | null;
  countryCode: string | null;
  countryNameEn: string | null;
  countryNameAr: string | null;
  
  // Attendance Data
  attendedAt: string | null;
  notes: string | null;
  createdAt: string;
  
  // Search
  searchText: string;
}

// ==================== Denormalized Invitee Document ====================
export interface ESInviteeDocument {
  // Identity
  id: number;
  
  // Event Context (denormalized)
  eventId: string;
  eventName: string;
  eventNameAr: string | null;
  eventDate: string;
  eventEndDate: string | null;
  eventLocation: string | null;
  eventCategory: string | null;
  eventCategoryId: number | null;
  eventCategoryNameEn: string | null;
  eventCategoryNameAr: string | null;
  eventType: string;
  eventScope: string;
  
  // Contact Context (denormalized)
  contactId: number;
  contactName: string;
  contactNameAr: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactTitle: string | null;
  
  // Organization Context (denormalized)
  organizationId: number | null;
  organizationName: string | null;
  organizationNameAr: string | null;
  
  // Country Context (denormalized)
  countryId: number | null;
  countryCode: string | null;
  countryNameEn: string | null;
  countryNameAr: string | null;
  
  // Invitation Data
  rsvp: boolean;
  registered: boolean;
  inviteEmailSent: boolean;
  invitedAt: string | null;
  rsvpAt: string | null;
  registeredAt: string | null;
  inviteEmailSentAt: string | null;
  notes: string | null;
  createdAt: string;
  
  // Search
  searchText: string;
}

export interface ESTaskDocument {
  id: number;
  name: string;
  nameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  searchText: string;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  departmentId: number | null;
  departmentName: string | null;
  eventId: number | null;
  eventName: string | null;
  isOverdue: boolean;
  // Computed: days from creation to completion (for analytics)
  completionDays: number | null;
}

export interface ESContactDocument {
  id: number;
  name: string;
  nameAr: string | null;
  title: string | null;
  titleAr: string | null;
  email: string | null;
  phone: string | null;
  organizationId: number | null;
  organizationName: string | null;
  positionId: number | null;
  countryId: number | null;
  countryName: string | null;
  countryNameAr: string | null;
  countryCode: string | null;
  isEligibleSpeaker: boolean;
  searchText: string;
  createdAt: string;
  suggest: {
    input: string[];
    contexts: {
      type?: string[];
      category?: string[];
    };
  };
}

export interface ESOrganizationDocument {
  id: number;
  name: string;
  nameAr: string | null;
  searchText: string;
  website: string | null;
  countryId: number | null;
  countryName: string | null;
  countryNameAr: string | null;
  countryCode: string | null;
  isPartner: boolean;
  partnershipStatus: string | null;
  contactsCount: number;
  createdAt: string;
  suggest: {
    input: string[];
    contexts: {
      type?: string[];
      category?: string[];
    };
  };
}

export interface ESLeadDocument {
  id: number;
  name: string;
  nameAr: string | null;
  searchText: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  suggest: {
    input: string[];
    contexts: {
      type?: string[];
      category?: string[];
    };
  };
}

// ==================== Enrichment Interfaces ====================

export interface EventEnrichment {
  mediaCount?: number;
  taskCount?: number;
  attendeeCount?: number;
  inviteeCount?: number;
  registeredCount?: number;
  categoryNameEn?: string;
  categoryNameAr?: string;
  stakeholderIds?: number[];
  speakerIds?: number[];
}

export interface TaskEnrichment {
  eventId?: string;
  eventName?: string;
  departmentName?: string;
}

export interface ContactEnrichment {
  organizationName?: string;
  countryName?: string;
  countryNameAr?: string | null;
  countryCode?: string;
  eventsAttended?: number;
  eventsSpokenAt?: number;
}

export interface OrganizationEnrichment {
  contactCount?: number;
  countryName?: string;
  countryNameAr?: string | null;
  countryCode?: string;
}

export interface LeadEnrichment {
  interactionCount?: number;
}

// Enriched data for attendee denormalization
export interface AttendeeEnrichment {
  // Event data
  eventName: string;
  eventNameAr: string | null;
  eventDate: string;
  eventEndDate: string | null;
  eventLocation: string | null;
  eventCategory: string | null;
  eventCategoryId: number | null;
  eventCategoryNameEn: string | null;
  eventCategoryNameAr: string | null;
  eventType: string;
  eventScope: string;
  // Contact data
  contactName: string;
  contactNameAr: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactTitle: string | null;
  // Organization data
  organizationId: number | null;
  organizationName: string | null;
  organizationNameAr: string | null;
  // Country data
  countryId: number | null;
  countryCode: string | null;
  countryNameEn: string | null;
  countryNameAr: string | null;
}

// Enriched data for invitee denormalization
export interface InviteeEnrichment {
  // Event data
  eventName: string;
  eventNameAr: string | null;
  eventDate: string;
  eventEndDate: string | null;
  eventLocation: string | null;
  eventCategory: string | null;
  eventCategoryId: number | null;
  eventCategoryNameEn: string | null;
  eventCategoryNameAr: string | null;
  eventType: string;
  eventScope: string;
  // Contact data
  contactName: string;
  contactNameAr: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactTitle: string | null;
  // Organization data
  organizationId: number | null;
  organizationName: string | null;
  organizationNameAr: string | null;
  // Country data
  countryId: number | null;
  countryCode: string | null;
  countryNameEn: string | null;
  countryNameAr: string | null;
}

// Enriched data for agreement denormalization
export interface AgreementEnrichment {
  agreementTypeName: string | null;
  agreementTypeNameAr: string | null;
  organizationName?: string | null;
}

// ==================== Internal Types ====================

interface RetryQueueItem {
  entityType: EntityIndexMapKey;
  id: string;
  document: any;
  attempts: number;
  lastAttempt: Date;
}

interface BulkOperation {
  action: 'index' | 'update' | 'delete';
  index: string;
  id: string;
  document?: Record<string, any>;
}

// ==================== Transform Functions ====================

function transformEvent(event: Event, enrichment?: EventEnrichment): ESEventDocument {
  const searchText = [
    event.name,
    event.nameAr,
    event.description,
    event.descriptionAr,
    event.location,
    event.locationAr,
    event.organizers,
    event.organizersAr,
    event.category,
    enrichment?.categoryNameEn,
    enrichment?.categoryNameAr,
  ].filter(Boolean).join(' ');
  
  const attendeeCount = enrichment?.attendeeCount || 0;
  const inviteeCount = enrichment?.inviteeCount || 0;
  const registeredCount = enrichment?.registeredCount || 0;
  
  return {
    id: event.id,
    name: event.name,
    nameAr: event.nameAr || null,
    description: event.description || null,
    descriptionAr: event.descriptionAr || null,
    searchText,
    startDate: event.startDate,
    endDate: event.endDate,
    startTime: event.startTime || null,
    endTime: event.endTime || null,
    location: event.location || null,
    locationAr: event.locationAr || null,
    organizers: event.organizers || null,
    organizersAr: event.organizersAr || null,
    category: event.category || null,
    categoryId: event.categoryId || null,
    categoryNameEn: enrichment?.categoryNameEn || null,
    categoryNameAr: enrichment?.categoryNameAr || null,
    eventType: event.eventType,
    eventScope: event.eventScope,
    expectedAttendance: event.expectedAttendance || null,
    isScraped: event.isScraped,
    source: event.source || null,
    isArchived: event.isArchived,
    mediaCount: enrichment?.mediaCount || 0,
    inviteeCount,
    attendeeCount,
    registeredCount,
    attendanceRate: inviteeCount > 0 ? Math.round((attendeeCount / inviteeCount) * 100) : 0,
    suggest: {
      input: [event.name, event.nameAr].filter(Boolean) as string[],
      contexts: {
        category: event.category ? [event.category] : [],
        type: [event.eventType],
      },
    },
  };
}

function transformTask(task: Task, enrichment?: TaskEnrichment): ESTaskDocument {
  const now = new Date();
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = !!(dueDate && dueDate < now && task.status !== 'completed');

  // Calculate completionDays: days from creation to completion
  let completionDays: number | null = null;
  if (task.completedAt && task.createdAt) {
    const completedDate = new Date(task.completedAt);
    const createdDate = new Date(task.createdAt);
    const diffMs = completedDate.getTime() - createdDate.getTime();
    completionDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24)); // Convert ms to days
  }

  const searchText = [
    task.title,
    task.titleAr,
    task.description,
    task.descriptionAr,
    enrichment?.eventName,
    enrichment?.departmentName,
  ].filter(Boolean).join(' ');

  return {
    id: task.id,
    name: task.title,
    nameAr: task.titleAr || null,
    description: task.description || null,
    descriptionAr: task.descriptionAr || null,
    searchText,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate || null,
    completedAt: task.completedAt?.toISOString() || null,
    createdAt: task.createdAt?.toISOString() || new Date().toISOString(),
    departmentId: task.departmentId || null,
    departmentName: enrichment?.departmentName || null,
    // Event ID comes from enrichment (resolved through event department relationship)
    eventId: enrichment?.eventId ? parseInt(enrichment.eventId, 10) : null,
    eventName: enrichment?.eventName || null,
    isOverdue,
    completionDays,
  };
}

function transformContact(contact: Contact, enrichment?: ContactEnrichment): ESContactDocument {
  const searchText = [
    contact.nameEn,
    contact.nameAr,
    contact.email,
    enrichment?.organizationName,
    enrichment?.countryName,
    enrichment?.countryNameAr,
  ].filter(Boolean).join(' ');
  
  return {
    id: contact.id,
    name: contact.nameEn,
    nameAr: contact.nameAr || null,
    title: contact.title || null,
    titleAr: contact.titleAr || null,
    email: contact.email || null,
    phone: contact.phone || null,
    organizationId: contact.organizationId || null,
    organizationName: enrichment?.organizationName || null,
    positionId: contact.positionId || null,
    countryId: contact.countryId || null,
    countryName: enrichment?.countryName || null,
    countryNameAr: enrichment?.countryNameAr || null,
    countryCode: enrichment?.countryCode || null,
    isEligibleSpeaker: contact.isEligibleSpeaker || false,
    searchText,
    createdAt: contact.createdAt?.toISOString() || new Date().toISOString(),
    suggest: {
      input: [contact.nameEn, contact.nameAr].filter(Boolean) as string[],
      contexts: {
        // Use 'type' and 'category' contexts (matches ES mapping)
        type: ['contact'],
        category: contact.isEligibleSpeaker ? ['speaker'] : ['general'],
      },
    },
  };
}

function transformOrganization(org: Organization, enrichment?: OrganizationEnrichment): ESOrganizationDocument {
  const searchText = [
    org.nameEn,
    org.nameAr,
    org.partnershipNotes,
    org.website,
    enrichment?.countryName,
    enrichment?.countryNameAr,
  ].filter(Boolean).join(' ');
  
  return {
    id: org.id,
    name: org.nameEn,
    nameAr: org.nameAr || null,
    searchText,
    website: org.website || null,
    countryId: org.countryId || null,
    countryName: enrichment?.countryName || null,
    countryNameAr: enrichment?.countryNameAr || null,
    countryCode: enrichment?.countryCode || null,
    isPartner: org.isPartner,
    partnershipStatus: org.partnershipStatus || null,
    contactsCount: enrichment?.contactCount || 0,
    createdAt: org.createdAt?.toISOString() || new Date().toISOString(),
    suggest: {
      input: [org.nameEn, org.nameAr].filter(Boolean) as string[],
      contexts: {
        // Use 'type' context (matches mapping) for partner status
        type: org.isPartner ? ['partner'] : ['organization'],
        // Use 'category' context for partnership status
        category: org.partnershipStatus ? [org.partnershipStatus] : ['none'],
      },
    },
  };
}

function transformLead(lead: Lead, enrichment?: LeadEnrichment): ESLeadDocument {
  const searchText = [
    lead.name,
    lead.nameAr,
    lead.organizationName,
    lead.notes,
    lead.notesAr,
    lead.email,
  ].filter(Boolean).join(' ');
  
  return {
    id: lead.id,
    name: lead.name,
    nameAr: lead.nameAr || null,
    searchText,
    email: lead.email || null,
    phone: lead.phone || null,
    status: lead.status,
    createdAt: lead.createdAt?.toISOString() || new Date().toISOString(),
    suggest: {
      input: [lead.name, lead.nameAr].filter(Boolean) as string[],
      contexts: {
        // Use 'type' for entity type and 'category' for status
        type: ['lead'],
        category: [lead.status],
      },
    },
  };
}

function transformArchivedEvent(archived: ArchivedEvent & { 
  speakers?: any[], 
  departments?: any[] 
}): Record<string, any> {
  const searchText = [
    archived.name,
    archived.nameAr,
    archived.description,
    archived.descriptionAr,
    archived.highlights,
    archived.highlightsAr,
    archived.location,
    archived.locationAr,
  ].filter(Boolean).join(' ');
  
  return {
    id: archived.id, // Use integer id, not string - mapping expects integer
    originalEventId: archived.originalEventId,
    name: archived.name,
    nameAr: archived.nameAr || null,
    description: archived.description || null,
    descriptionAr: archived.descriptionAr || null,
    searchText,
    startDate: archived.startDate,
    endDate: archived.endDate,
    startTime: archived.startTime || null,
    endTime: archived.endTime || null,
    location: archived.location || null,
    locationAr: archived.locationAr || null,
    organizers: archived.organizers || null,
    organizersAr: archived.organizersAr || null,
    category: archived.category || null,
    categoryId: archived.categoryId || null,
    categoryNameEn: archived.category || null, // Map to expected field
    categoryNameAr: archived.categoryAr || null, // Map to expected field
    eventType: archived.eventType,
    eventScope: archived.eventScope,
    actualAttendance: archived.actualAttendees || null,
    expectedAttendance: null, // Archived events don't have this
    isScraped: false, // Archived events are never scraped
    source: archived.createdDirectly ? 'archive-direct' : 'archive-event',
    mediaCount: archived.photoKeys?.length || 0,
    
    // Archive-specific audit fields (map to what ES expects)
    archivedAt: archived.createdAt?.toISOString() || null, // When it was archived
    archivedById: archived.archivedByUserId || null, // Who archived it
    
    // Computed counts (0 if not provided)
    speakersCount: archived.speakers?.length || 0,
    attendeesCount: archived.actualAttendees || 0,
    tasksCount: 0, // Not tracked for archives
    completedTasksCount: 0, // Not tracked for archives
    
    // Nested arrays (empty if not provided)
    departments: archived.departments || [],
    speakers: archived.speakers || [],
    
    createdDirectly: archived.createdDirectly || false,
    createdAt: archived.createdAt?.toISOString() || null,
    updatedAt: archived.updatedAt?.toISOString() || null,
    suggest: {
      input: [archived.name, archived.nameAr].filter(Boolean) as string[],
      contexts: {
        category: archived.category ? [archived.category] : [],
        type: [archived.eventType],
      },
    },
  };
}

function transformDepartment(dept: Department): Record<string, any> {
  const searchText = [dept.name, dept.nameAr].filter(Boolean).join(' ');
  
  return {
    id: dept.id,
    name: dept.name, // English name (matches ES mapping)
    nameAr: dept.nameAr || null,
    keycloakGroupId: dept.keycloakGroupId || null,
    isActive: dept.active, // Map 'active' from DB to 'isActive' for ES mapping
    searchText,
    createdAt: dept.createdAt?.toISOString() || new Date().toISOString(),
    suggest: {
      input: [dept.name, dept.nameAr].filter(Boolean),
      contexts: {
        type: ['department'],
        category: dept.active ? ['active'] : ['inactive'],
      },
    },
  };
}

/**
 * Transform attendee with full denormalized data
 * IMPORTANT: This requires enrichment data from JOINed queries
 */
function transformAttendee(attendee: EventAttendee, enrichment?: AttendeeEnrichment): ESAttendeeDocument {
  const searchText = [
    enrichment?.eventName,
    enrichment?.eventNameAr,
    enrichment?.contactName,
    enrichment?.contactNameAr,
    enrichment?.contactEmail,
    enrichment?.organizationName,
    enrichment?.eventCategoryNameEn,
  ].filter(Boolean).join(' ');
  
  return {
    // Identity
    id: attendee.id,
    
    // Event Context (denormalized)
    eventId: attendee.eventId,
    eventName: enrichment?.eventName || '',
    eventNameAr: enrichment?.eventNameAr || null,
    eventDate: enrichment?.eventDate || '',
    eventEndDate: enrichment?.eventEndDate || null,
    eventLocation: enrichment?.eventLocation || null,
    eventCategory: enrichment?.eventCategory || null,
    eventCategoryId: enrichment?.eventCategoryId || null,
    eventCategoryNameEn: enrichment?.eventCategoryNameEn || null,
    eventCategoryNameAr: enrichment?.eventCategoryNameAr || null,
    eventType: enrichment?.eventType || 'internal',
    eventScope: enrichment?.eventScope || 'local',
    
    // Contact Context (denormalized)
    contactId: attendee.contactId,
    contactName: enrichment?.contactName || '',
    contactNameAr: enrichment?.contactNameAr || null,
    contactEmail: enrichment?.contactEmail || null,
    contactPhone: enrichment?.contactPhone || null,
    contactTitle: enrichment?.contactTitle || null,
    
    // Organization Context (denormalized)
    organizationId: enrichment?.organizationId || null,
    organizationName: enrichment?.organizationName || null,
    organizationNameAr: enrichment?.organizationNameAr || null,
    
    // Country Context (denormalized)
    countryId: enrichment?.countryId || null,
    countryCode: enrichment?.countryCode || null,
    countryNameEn: enrichment?.countryNameEn || null,
    countryNameAr: enrichment?.countryNameAr || null,
    
    // Attendance Data
    attendedAt: attendee.attendedAt?.toISOString() || null,
    notes: attendee.notes || null,
    createdAt: attendee.createdAt?.toISOString() || new Date().toISOString(),
    
    // Search
    searchText,
  };
}

/**
 * Transform invitee with full denormalized data
 * IMPORTANT: This requires enrichment data from JOINed queries
 */
function transformInvitee(invitee: EventInvitee, enrichment?: InviteeEnrichment): ESInviteeDocument {
  const searchText = [
    enrichment?.eventName,
    enrichment?.eventNameAr,
    enrichment?.contactName,
    enrichment?.contactNameAr,
    enrichment?.contactEmail,
    enrichment?.organizationName,
    enrichment?.eventCategoryNameEn,
  ].filter(Boolean).join(' ');
  
  return {
    // Identity
    id: invitee.id,
    
    // Event Context (denormalized)
    eventId: invitee.eventId,
    eventName: enrichment?.eventName || '',
    eventNameAr: enrichment?.eventNameAr || null,
    eventDate: enrichment?.eventDate || '',
    eventEndDate: enrichment?.eventEndDate || null,
    eventLocation: enrichment?.eventLocation || null,
    eventCategory: enrichment?.eventCategory || null,
    eventCategoryId: enrichment?.eventCategoryId || null,
    eventCategoryNameEn: enrichment?.eventCategoryNameEn || null,
    eventCategoryNameAr: enrichment?.eventCategoryNameAr || null,
    eventType: enrichment?.eventType || 'internal',
    eventScope: enrichment?.eventScope || 'local',
    
    // Contact Context (denormalized)
    contactId: invitee.contactId,
    contactName: enrichment?.contactName || '',
    contactNameAr: enrichment?.contactNameAr || null,
    contactEmail: enrichment?.contactEmail || null,
    contactPhone: enrichment?.contactPhone || null,
    contactTitle: enrichment?.contactTitle || null,
    
    // Organization Context (denormalized)
    organizationId: enrichment?.organizationId || null,
    organizationName: enrichment?.organizationName || null,
    organizationNameAr: enrichment?.organizationNameAr || null,
    
    // Country Context (denormalized)
    countryId: enrichment?.countryId || null,
    countryCode: enrichment?.countryCode || null,
    countryNameEn: enrichment?.countryNameEn || null,
    countryNameAr: enrichment?.countryNameAr || null,
    
    // Invitation Data
    rsvp: invitee.rsvp,
    registered: invitee.registered,
    inviteEmailSent: invitee.inviteEmailSent,
    invitedAt: invitee.invitedAt?.toISOString() || null,
    rsvpAt: invitee.rsvpAt?.toISOString() || null,
    registeredAt: invitee.registeredAt?.toISOString() || null,
    inviteEmailSentAt: invitee.inviteEmailSentAt?.toISOString() || null,
    notes: invitee.notes || null,
    createdAt: invitee.createdAt?.toISOString() || new Date().toISOString(),
    
    // Search
    searchText,
  };
}

function transformLeadInteraction(interaction: LeadInteraction): Record<string, any> {
  return {
    id: interaction.id,
    leadId: interaction.leadId,
    referenceId: interaction.leadId,
    referenceType: 'lead',
    type: interaction.type,
    content: interaction.description, // Map description to content for ES mapping
    subject: interaction.description?.slice(0, 100) || null, // Generate subject from description
    outcome: interaction.outcome || null,
    interactionDate: interaction.interactionDate?.toISOString() || null,
    createdAt: interaction.createdAt?.toISOString() || new Date().toISOString(),
    suggest: {
      input: [interaction.description?.slice(0, 50)].filter(Boolean),
      contexts: {
        type: [interaction.type],
        category: ['lead-interaction'],
      },
    },
  };
}

function transformPartnershipActivity(activity: PartnershipActivity, enrichment?: { organizationName?: string }): Record<string, any> {
  const searchText = [
    activity.title,
    activity.titleAr,
    activity.description,
    enrichment?.organizationName,
  ].filter(Boolean).join(' ');
  
  return {
    id: activity.id,
    organizationId: activity.organizationId,
    organizationName: enrichment?.organizationName || null,
    activityType: activity.activityType,
    status: 'completed', // Default status for activities
    title: activity.title,
    titleAr: activity.titleAr || null,
    description: activity.description || null,
    descriptionAr: activity.descriptionAr || null,
    searchText,
    startDate: activity.startDate,
    endDate: activity.endDate || null,
    eventId: activity.eventId || null,
    outcome: activity.outcome || null,
    impact: activity.impactScore ? (activity.impactScore >= 7 ? 'high' : activity.impactScore >= 4 ? 'medium' : 'low') : null,
    createdAt: activity.createdAt?.toISOString() || new Date().toISOString(),
    suggest: {
      input: [activity.title, activity.titleAr].filter(Boolean),
      contexts: {
        type: ['activity'],
        category: [activity.activityType],
      },
    },
  };
}

function transformPartnershipInteraction(interaction: PartnershipInteraction): Record<string, any> {
  return {
    id: interaction.id,
    organizationId: interaction.organizationId,
    referenceId: interaction.organizationId,
    referenceType: 'partnership',
    type: interaction.type,
    content: interaction.description, // Map description to content for ES mapping
    subject: interaction.description?.slice(0, 100) || null, // Generate subject from description
    outcome: interaction.outcome || null,
    interactionDate: interaction.interactionDate?.toISOString() || null,
    createdAt: interaction.createdAt?.toISOString() || new Date().toISOString(),
    suggest: {
      input: [interaction.description?.slice(0, 50)].filter(Boolean),
      contexts: {
        type: [interaction.type],
        category: ['partnership-interaction'],
      },
    },
  };
}

function transformAgreement(agreement: PartnershipAgreement, enrichment?: AgreementEnrichment): Record<string, any> {
  const searchText = [
    agreement.title,
    agreement.titleAr,
    enrichment?.organizationName,
  ].filter(Boolean).join(' ');
  
  return {
    id: agreement.id,
    organizationId: agreement.organizationId,
    organizationName: enrichment?.organizationName || null,
    title: agreement.title,
    titleAr: agreement.titleAr || null,
    searchText,
    agreementTypeId: agreement.agreementTypeId || null,
    agreementTypeName: enrichment?.agreementTypeName || null,
    agreementTypeNameAr: enrichment?.agreementTypeNameAr || null,
    status: agreement.status,
    startDate: agreement.effectiveDate || null,
    endDate: agreement.expiryDate || null, // Map expiryDate to endDate for ES mapping
    signedDate: agreement.signedDate || null,
    createdAt: agreement.createdAt?.toISOString() || new Date().toISOString(),
    suggest: {
      input: [agreement.title, agreement.titleAr].filter(Boolean),
      contexts: {
        type: ['agreement'],
        category: [agreement.status],
      },
    },
  };
}

function transformUpdate(update: Update): Record<string, any> {
  // Handle periodStart - in drizzle it comes as a string (date column)
  const periodStartStr = update.periodStart || null;
  const createdAtStr = update.createdAt
    ? (typeof update.createdAt === 'string' ? update.createdAt : update.createdAt.toISOString())
    : new Date().toISOString();
  const updatedAtStr = update.updatedAt
    ? (typeof update.updatedAt === 'string' ? update.updatedAt : update.updatedAt.toISOString())
    : null;

  return {
    id: update.id,
    updateType: update.type, // Map 'type' from DB to 'updateType' for ES mapping
    periodStart: periodStartStr,
    content: update.content,
    departmentId: update.departmentId || null,
    // Use authorId field which exists in mapping (not updatedByUserId)
    authorId: update.updatedByUserId || null,
    createdAt: createdAtStr,
    updatedAt: updatedAtStr,
    searchText: update.content || '',
    // Add suggest field for autocomplete
    suggest: {
      input: [`${update.type} update`, periodStartStr?.slice(0, 10)].filter(Boolean),
      contexts: {
        type: [update.type],
        category: ['update'],
      },
    },
  };
}

// ==================== Main Service Class ====================

export class ElasticsearchIndexingService {
  private retryQueue: RetryQueueItem[] = [];
  private isProcessingQueue = false;
  
  // ==================== Event Indexing ====================
  
  async indexEvent(event: Event, enrichment?: EventEnrichment): Promise<IndexResult | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return null;
    
    const document = transformEvent(event, enrichment);
    
    try {
      const result = await client.index({
        index: ENTITY_INDEX_MAP.events,
        id: event.id,
        document,
        refresh: 'wait_for',
      });
      
      logger.debug(`Indexed event ${event.id}: ${result.result}`);
      return {
        _id: result._id,
        _index: result._index,
        _version: result._version,
        result: result.result as 'created' | 'updated',
      };
    } catch (error) {
      this.handleIndexingError('events', event.id, document, error);
      return null;
    }
  }
  
  // ==================== Task Indexing ====================
  
  async indexTask(task: Task, enrichment?: TaskEnrichment): Promise<IndexResult | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return null;
    
    const document = transformTask(task, enrichment);
    
    try {
      const result = await client.index({
        index: ENTITY_INDEX_MAP.tasks,
        id: String(task.id),
        document,
        refresh: 'wait_for',
      });
      
      logger.debug(`Indexed task ${task.id}: ${result.result}`);
      return {
        _id: result._id,
        _index: result._index,
        _version: result._version,
        result: result.result as 'created' | 'updated',
      };
    } catch (error) {
      this.handleIndexingError('tasks', String(task.id), document, error);
      return null;
    }
  }
  
  // ==================== Contact Indexing ====================
  
  async indexContact(contact: Contact, enrichment?: ContactEnrichment): Promise<IndexResult | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return null;
    
    const document = transformContact(contact, enrichment);
    
    try {
      const result = await client.index({
        index: ENTITY_INDEX_MAP.contacts,
        id: String(contact.id),
        document,
        refresh: 'wait_for',
      });
      
      logger.debug(`Indexed contact ${contact.id}: ${result.result}`);
      return {
        _id: result._id,
        _index: result._index,
        _version: result._version,
        result: result.result as 'created' | 'updated',
      };
    } catch (error) {
      this.handleIndexingError('contacts', String(contact.id), document, error);
      return null;
    }
  }
  
  // ==================== Organization Indexing ====================
  
  async indexOrganization(org: Organization, enrichment?: OrganizationEnrichment): Promise<IndexResult | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return null;
    
    const document = transformOrganization(org, enrichment);
    const indexName = org.isPartner ? ENTITY_INDEX_MAP.partnerships : ENTITY_INDEX_MAP.organizations;
    
    try {
      const result = await client.index({
        index: indexName,
        id: String(org.id),
        document,
        refresh: 'wait_for',
      });
      
      logger.debug(`Indexed organization ${org.id} to ${indexName}: ${result.result}`);
      return {
        _id: result._id,
        _index: result._index,
        _version: result._version,
        result: result.result as 'created' | 'updated',
      };
    } catch (error) {
      this.handleIndexingError(org.isPartner ? 'partnerships' : 'organizations', String(org.id), document, error);
      return null;
    }
  }
  
  // ==================== Lead Indexing ====================
  
  async indexLead(lead: Lead, enrichment?: LeadEnrichment): Promise<IndexResult | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return null;
    
    const document = transformLead(lead, enrichment);
    
    try {
      const result = await client.index({
        index: ENTITY_INDEX_MAP.leads,
        id: String(lead.id),
        document,
        refresh: 'wait_for',
      });
      
      logger.debug(`Indexed lead ${lead.id}: ${result.result}`);
      return {
        _id: result._id,
        _index: result._index,
        _version: result._version,
        result: result.result as 'created' | 'updated',
      };
    } catch (error) {
      this.handleIndexingError('leads', String(lead.id), document, error);
      return null;
    }
  }
  
  // ==================== Agreement Indexing ====================
  
  async indexAgreement(agreement: PartnershipAgreement): Promise<IndexResult | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return null;
    
    const document = transformAgreement(agreement);
    
    try {
      const result = await client.index({
        index: ENTITY_INDEX_MAP.agreements,
        id: String(agreement.id),
        document,
        refresh: 'wait_for',
      });
      
      logger.debug(`Indexed agreement ${agreement.id}: ${result.result}`);
      return {
        _id: result._id,
        _index: result._index,
        _version: result._version,
        result: result.result as 'created' | 'updated',
      };
    } catch (error) {
      this.handleIndexingError('agreements', String(agreement.id), document, error);
      return null;
    }
  }
  
  // ==================== Department Indexing ====================
  
  async indexDepartment(dept: Department): Promise<IndexResult | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return null;
    
    const document = transformDepartment(dept);
    
    try {
      const result = await client.index({
        index: ENTITY_INDEX_MAP.departments,
        id: String(dept.id),
        document,
        refresh: 'wait_for',
      });
      
      logger.debug(`Indexed department ${dept.id}: ${result.result}`);
      return {
        _id: result._id,
        _index: result._index,
        _version: result._version,
        result: result.result as 'created' | 'updated',
      };
    } catch (error) {
      this.handleIndexingError('departments', String(dept.id), document, error);
      return null;
    }
  }
  
  // ==================== Attendee Indexing ====================
  
  async indexAttendee(attendee: EventAttendee, enrichment?: AttendeeEnrichment): Promise<IndexResult | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return null;
    
    const document = transformAttendee(attendee, enrichment);
    
    try {
      const result = await client.index({
        index: ENTITY_INDEX_MAP.attendees,
        id: String(attendee.id),
        document,
        refresh: 'wait_for',
      });
      
      logger.debug(`Indexed attendee ${attendee.id}: ${result.result}`);
      return {
        _id: result._id,
        _index: result._index,
        _version: result._version,
        result: result.result as 'created' | 'updated',
      };
    } catch (error) {
      this.handleIndexingError('attendees', String(attendee.id), document, error);
      return null;
    }
  }
  
  // ==================== Invitee Indexing ====================
  
  async indexInvitee(invitee: EventInvitee, enrichment?: InviteeEnrichment): Promise<IndexResult | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return null;
    
    const document = transformInvitee(invitee, enrichment);
    
    try {
      const result = await client.index({
        index: ENTITY_INDEX_MAP.invitees,
        id: String(invitee.id),
        document,
        refresh: 'wait_for',
      });
      
      logger.debug(`Indexed invitee ${invitee.id}: ${result.result}`);
      return {
        _id: result._id,
        _index: result._index,
        _version: result._version,
        result: result.result as 'created' | 'updated',
      };
    } catch (error) {
      this.handleIndexingError('invitees', String(invitee.id), document, error);
      return null;
    }
  }
  
  // ==================== Lead Interaction Indexing ====================
  
  async indexLeadInteraction(interaction: LeadInteraction): Promise<IndexResult | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return null;
    
    const document = transformLeadInteraction(interaction);
    
    try {
      const result = await client.index({
        index: ENTITY_INDEX_MAP.leadInteractions,
        id: String(interaction.id),
        document,
        refresh: 'wait_for',
      });
      
      logger.debug(`Indexed lead interaction ${interaction.id}: ${result.result}`);
      return {
        _id: result._id,
        _index: result._index,
        _version: result._version,
        result: result.result as 'created' | 'updated',
      };
    } catch (error) {
      this.handleIndexingError('leadInteractions', String(interaction.id), document, error);
      return null;
    }
  }
  
  // ==================== Partnership Activity Indexing ====================
  
  async indexPartnershipActivity(activity: PartnershipActivity): Promise<IndexResult | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return null;
    
    const document = transformPartnershipActivity(activity);
    
    try {
      const result = await client.index({
        index: ENTITY_INDEX_MAP.partnershipActivities,
        id: String(activity.id),
        document,
        refresh: 'wait_for',
      });
      
      logger.debug(`Indexed partnership activity ${activity.id}: ${result.result}`);
      return {
        _id: result._id,
        _index: result._index,
        _version: result._version,
        result: result.result as 'created' | 'updated',
      };
    } catch (error) {
      this.handleIndexingError('partnershipActivities', String(activity.id), document, error);
      return null;
    }
  }
  
  // ==================== Partnership Interaction Indexing ====================
  
  async indexPartnershipInteraction(interaction: PartnershipInteraction): Promise<IndexResult | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return null;
    
    const document = transformPartnershipInteraction(interaction);
    
    try {
      const result = await client.index({
        index: ENTITY_INDEX_MAP.partnershipInteractions,
        id: String(interaction.id),
        document,
        refresh: 'wait_for',
      });
      
      logger.debug(`Indexed partnership interaction ${interaction.id}: ${result.result}`);
      return {
        _id: result._id,
        _index: result._index,
        _version: result._version,
        result: result.result as 'created' | 'updated',
      };
    } catch (error) {
      this.handleIndexingError('partnershipInteractions', String(interaction.id), document, error);
      return null;
    }
  }
  
  // ==================== Archived Event Indexing ====================
  
  async indexArchivedEvent(archived: ArchivedEvent): Promise<IndexResult | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return null;
    
    const document = transformArchivedEvent(archived);
    
    try {
      const result = await client.index({
        index: ENTITY_INDEX_MAP.archivedEvents,
        id: String(archived.id),
        document,
        refresh: 'wait_for',
      });
      
      logger.debug(`Indexed archived event ${archived.id}: ${result.result}`);
      return {
        _id: result._id,
        _index: result._index,
        _version: result._version,
        result: result.result as 'created' | 'updated',
      };
    } catch (error) {
      this.handleIndexingError('archivedEvents', String(archived.id), document, error);
      return null;
    }
  }
  
  // ==================== Update Indexing ====================
  
  async indexUpdate(update: Update): Promise<IndexResult | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return null;
    
    const document = transformUpdate(update);
    
    try {
      const result = await client.index({
        index: ENTITY_INDEX_MAP.updates,
        id: String(update.id),
        document,
        refresh: 'wait_for',
      });
      
      logger.debug(`Indexed update ${update.id}: ${result.result}`);
      return {
        _id: result._id,
        _index: result._index,
        _version: result._version,
        result: result.result as 'created' | 'updated',
      };
    } catch (error) {
      this.handleIndexingError('updates', String(update.id), document, error);
      return null;
    }
  }
  
  // ==================== Delete Operations ====================
  
  async deleteDocument(entityType: EntityIndexMapKey, id: string): Promise<boolean> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return false;
    
    const indexName = ENTITY_INDEX_MAP[entityType];
    
    try {
      await client.delete({
        index: indexName,
        id,
        refresh: 'wait_for',
      });
      
      logger.debug(`Deleted ${entityType} document ${id}`);
      return true;
    } catch (error: any) {
      if (error?.meta?.statusCode === 404 || error?.statusCode === 404) {
        logger.debug(`Document ${entityType}/${id} already deleted or not found`);
        return true; // Already gone
      }
      logger.error(`Failed to delete ${entityType} document ${id}:`, error?.message || error);
      return false;
    }
  }
  
  // ==================== Bulk Operations ====================
  
  async bulkIndex(operations: BulkOperation[]): Promise<BulkIndexResult> {
    const client = await getOptionalElasticsearchClient();
    if (!client) {
      return { indexed: 0, updated: 0, failed: operations.length, took_ms: 0, errors: [] };
    }
    
    const startTime = Date.now();
    const body: any[] = [];
    
    for (const op of operations) {
      if (op.action === 'index' || op.action === 'update') {
        body.push(
          { [op.action]: { _index: op.index, _id: op.id } },
          op.action === 'update' ? { doc: op.document, doc_as_upsert: true } : op.document
        );
      } else if (op.action === 'delete') {
        body.push({ delete: { _index: op.index, _id: op.id } });
      }
    }
    
    if (body.length === 0) {
      return { indexed: 0, updated: 0, failed: 0, took_ms: 0, errors: [] };
    }
    
    try {
      const result = await client.bulk({ body, refresh: 'wait_for' });
      
      let indexed = 0, updated = 0, failed = 0;
      const errors: any[] = [];
      
      for (const item of result.items) {
        const action = Object.keys(item)[0] as string;
        const response = item[action as keyof typeof item] as any;
        
        if (response.error) {
          failed++;
          const errorDetail = {
            id: response._id,
            index: response._index,
            type: response.error.type,
            reason: response.error.reason,
            error: response.error
          };
          errors.push(errorDetail);
          // Log detailed error for debugging
          logger.error(`[ES Indexing Error] Failed to ${action} document ${response._id} in ${response._index}:`, {
            type: response.error.type,
            reason: response.error.reason,
            causedBy: response.error.caused_by,
          });
        } else if (response.result === 'created') {
          indexed++;
        } else if (response.result === 'updated') {
          updated++;
        } else if (response.result === 'deleted') {
          // Count deletions as updates for simplicity
          updated++;
        }
      }
      
      const tookMs = Date.now() - startTime;
      logger.info(`Bulk operation completed: ${indexed} indexed, ${updated} updated, ${failed} failed (${tookMs}ms)`);
      
      return { indexed, updated, failed, took_ms: tookMs, errors };
    } catch (error) {
      logger.error('Bulk indexing failed:', error);
      return { 
        indexed: 0, 
        updated: 0, 
        failed: operations.length, 
        took_ms: Date.now() - startTime, 
        errors: [{ id: 'bulk', error }] 
      };
    }
  }
  
  // ==================== Utility Methods ====================
  
  /**
   * Create a bulk operation for indexing an event
   */
  createEventBulkOp(event: Event, enrichment?: EventEnrichment): BulkOperation {
    return {
      action: 'index',
      index: ENTITY_INDEX_MAP.events,
      id: event.id,
      document: transformEvent(event, enrichment),
    };
  }
  
  /**
   * Create a bulk operation for indexing a task
   */
  createTaskBulkOp(task: Task, enrichment?: TaskEnrichment): BulkOperation {
    return {
      action: 'index',
      index: ENTITY_INDEX_MAP.tasks,
      id: String(task.id),
      document: transformTask(task, enrichment),
    };
  }
  
  /**
   * Create a bulk operation for indexing a contact
   */
  createContactBulkOp(contact: Contact, enrichment?: ContactEnrichment): BulkOperation {
    return {
      action: 'index',
      index: ENTITY_INDEX_MAP.contacts,
      id: String(contact.id),
      document: transformContact(contact, enrichment),
    };
  }
  
  /**
   * Create a bulk operation for indexing an organization
   */
  createOrganizationBulkOp(org: Organization, enrichment?: OrganizationEnrichment): BulkOperation {
    return {
      action: 'index',
      index: org.isPartner ? ENTITY_INDEX_MAP.partnerships : ENTITY_INDEX_MAP.organizations,
      id: String(org.id),
      document: transformOrganization(org, enrichment),
    };
  }
  
  /**
   * Create a bulk operation for indexing a lead
   */
  createLeadBulkOp(lead: Lead, enrichment?: LeadEnrichment): BulkOperation {
    return {
      action: 'index',
      index: ENTITY_INDEX_MAP.leads,
      id: String(lead.id),
      document: transformLead(lead, enrichment),
    };
  }
  
  /**
   * Create a bulk operation for indexing an attendee with denormalized data
   */
  createAttendeeBulkOp(attendee: EventAttendee, enrichment?: AttendeeEnrichment): BulkOperation {
    return {
      action: 'index',
      index: ENTITY_INDEX_MAP.attendees,
      id: String(attendee.id),
      document: transformAttendee(attendee, enrichment),
    };
  }
  
  /**
   * Create a bulk operation for indexing an invitee with denormalized data
   */
  createInviteeBulkOp(invitee: EventInvitee, enrichment?: InviteeEnrichment): BulkOperation {
    return {
      action: 'index',
      index: ENTITY_INDEX_MAP.invitees,
      id: String(invitee.id),
      document: transformInvitee(invitee, enrichment),
    };
  }
  
  /**
   * Create a bulk operation for indexing an agreement
   */
  createAgreementBulkOp(agreement: PartnershipAgreement, enrichment?: AgreementEnrichment): BulkOperation {
    return {
      action: 'index',
      index: ENTITY_INDEX_MAP.agreements,
      id: String(agreement.id),
      document: transformAgreement(agreement, enrichment),
    };
  }
  
  /**
   * Create a bulk operation for indexing a department
   */
  createDepartmentBulkOp(dept: Department): BulkOperation {
    return {
      action: 'index',
      index: ENTITY_INDEX_MAP.departments,
      id: String(dept.id),
      document: transformDepartment(dept),
    };
  }
  
  /**
   * Create a bulk operation for indexing an archived event
   */
  createArchivedEventBulkOp(event: ArchivedEvent & { speakers?: any[], departments?: any[] }): BulkOperation {
    return {
      action: 'index',
      index: ENTITY_INDEX_MAP.archivedEvents,
      id: String(event.id),
      document: transformArchivedEvent(event),
    };
  }

  /**
   * Create a bulk operation for indexing a lead interaction
   */
  createLeadInteractionBulkOp(interaction: LeadInteraction): BulkOperation {
    return {
      action: 'index',
      index: ENTITY_INDEX_MAP.leadInteractions,
      id: String(interaction.id),
      document: transformLeadInteraction(interaction),
    };
  }

  /**
   * Create a bulk operation for indexing a partnership activity
   */
  createPartnershipActivityBulkOp(activity: PartnershipActivity, enrichment?: { organizationName?: string }): BulkOperation {
    return {
      action: 'index',
      index: ENTITY_INDEX_MAP.partnershipActivities,
      id: String(activity.id),
      document: transformPartnershipActivity(activity, enrichment),
    };
  }

  /**
   * Create a bulk operation for indexing a partnership interaction
   */
  createPartnershipInteractionBulkOp(interaction: PartnershipInteraction): BulkOperation {
    return {
      action: 'index',
      index: ENTITY_INDEX_MAP.partnershipInteractions,
      id: String(interaction.id),
      document: transformPartnershipInteraction(interaction),
    };
  }

  /**
   * Create a bulk operation for indexing an update
   */
  createUpdateBulkOp(update: Update): BulkOperation {
    return {
      action: 'index',
      index: ENTITY_INDEX_MAP.updates,
      id: String(update.id),
      document: transformUpdate(update),
    };
  }

  /**
   * Create a bulk delete operation
   */
  createDeleteBulkOp(entityType: EntityIndexMapKey, id: string): BulkOperation {
    return {
      action: 'delete',
      index: ENTITY_INDEX_MAP[entityType],
      id,
    };
  }
  
  // ==================== Error Handling ====================
  
  private handleIndexingError(entityType: EntityIndexMapKey, id: string, document: any, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRetryable = this.isRetryableError(error);
    
    logger.error(`Failed to index ${entityType} ${id}:`, { error: errorMessage, retryable: isRetryable });
    
    if (isRetryable) {
      this.retryQueue.push({ entityType, id, document, attempts: 0, lastAttempt: new Date() });
      if (!this.isProcessingQueue) {
        this.scheduleRetryProcessing();
      }
    }
  }
  
  private isRetryableError(error: unknown): boolean {
    const errorObj = error as any;
    
    // Connection errors are retryable
    if (errorObj?.name === 'ConnectionError' || errorObj?.name === 'TimeoutError') {
      return true;
    }
    
    // 5xx errors are retryable
    const statusCode = errorObj?.meta?.statusCode || errorObj?.statusCode;
    if (statusCode && statusCode >= 500) {
      return true;
    }
    
    // 429 Too Many Requests is retryable
    if (statusCode === 429) {
      return true;
    }
    
    return false;
  }
  
  private scheduleRetryProcessing(): void {
    setTimeout(() => this.processRetryQueue(), 30000); // 30 seconds
  }
  
  private async processRetryQueue(): Promise<void> {
    if (this.retryQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }
    
    this.isProcessingQueue = true;
    const client = await getOptionalElasticsearchClient();
    
    if (!client) {
      this.scheduleRetryProcessing();
      return;
    }
    
    const itemsToRetry = this.retryQueue.splice(0, 100); // Process up to 100 items
    
    for (const item of itemsToRetry) {
      if (item.attempts >= 5) {
        logger.error(`Giving up on indexing ${item.entityType} ${item.id} after 5 attempts`);
        continue;
      }
      
      try {
        await client.index({
          index: ENTITY_INDEX_MAP[item.entityType],
          id: item.id,
          document: item.document,
        });
        logger.info(`Retry succeeded for ${item.entityType} ${item.id}`);
      } catch (error) {
        item.attempts++;
        item.lastAttempt = new Date();
        this.retryQueue.push(item);
      }
    }
    
    if (this.retryQueue.length > 0) {
      this.scheduleRetryProcessing();
    } else {
      this.isProcessingQueue = false;
    }
  }
  
  /**
   * Get retry queue status for monitoring
   */
  getRetryQueueStatus(): { pending: number; oldestItem: Date | null } {
    return {
      pending: this.retryQueue.length,
      oldestItem: this.retryQueue.length > 0 ? this.retryQueue[0].lastAttempt : null,
    };
  }
  
  /**
   * Check if Elasticsearch indexing is available
   */
  isEnabled(): boolean {
    return isElasticsearchEnabled();
  }
}

// Export singleton instance
export const indexingService = new ElasticsearchIndexingService();
