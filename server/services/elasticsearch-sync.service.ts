/**
 * Elasticsearch Sync Service
 * 
 * Provides batch synchronization operations for Elasticsearch.
 * Handles full reindex, incremental sync, and orphan cleanup.
 * 
 * @module services/elasticsearch-sync
 */

import { getOptionalElasticsearchClient, isElasticsearchEnabled } from '../elasticsearch/client';
import { ENTITY_INDEX_MAP, SyncResult, SyncStatus, SyncError } from '../elasticsearch/types';
import { indexingService, AttendeeEnrichment, InviteeEnrichment, AgreementEnrichment } from './elasticsearch-indexing.service';
import { db } from '../db';
import { 
  events, 
  tasks, 
  contacts, 
  organizations, 
  leads, 
  partnershipAgreements,
  agreementTypes,
  eventAttendees,
  eventInvitees,
  departments,
  archivedEvents,
  archivedEventSpeakers,
  leadInteractions,
  partnershipActivities,
  partnershipInteractions,
  updates,
  categories,
  eventDepartments,
  countries,
} from '@shared/schema.mssql';
import { eq, gte, sql, inArray } from 'drizzle-orm';

// Logger
const logger = {
  info: (...args: any[]) => console.log('[ES Sync]', ...args),
  warn: (...args: any[]) => console.warn('[ES Sync]', ...args),
  error: (...args: any[]) => console.error('[ES Sync]', ...args),
  debug: (...args: any[]) => console.log('[ES Sync Debug]', ...args),
};

interface SyncState {
  lastFullSync: Date | null;
  lastIncrementalSync: Date | null;
  isRunning: boolean;
  currentEntity: string | null;
  progress: number;
  errors: SyncError[];
  totalDocumentsIndexed: number;
  totalDocumentsDeleted: number;
}

export class ElasticsearchSyncService {
  private state: SyncState = {
    lastFullSync: null,
    lastIncrementalSync: null,
    isRunning: false,
    currentEntity: null,
    progress: 0,
    errors: [],
    totalDocumentsIndexed: 0,
    totalDocumentsDeleted: 0,
  };
  
  private readonly BATCH_SIZE = 500;
  
  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return {
      lastSyncAt: this.state.lastIncrementalSync,
      lastFullSyncAt: this.state.lastFullSync,
      documentsIndexed: this.state.totalDocumentsIndexed,
      documentsDeleted: this.state.totalDocumentsDeleted,
      errors: this.state.errors.length,
      inProgress: this.state.isRunning,
      currentEntity: this.state.currentEntity,
      progress: this.state.progress,
    };
  }
  
  /**
   * Full reindex - syncs ALL data from PostgreSQL to ES
   */
  async reindexAll(): Promise<SyncResult> {
    if (!isElasticsearchEnabled()) {
      return { 
        success: false, 
        documentsIndexed: 0, 
        documentsDeleted: 0, 
        errors: [{ entity: 'all', id: '-', error: 'Elasticsearch not enabled', timestamp: new Date() }], 
        duration_ms: 0 
      };
    }
    
    if (this.state.isRunning) {
      throw new Error('Sync already in progress');
    }
    
    this.state.isRunning = true;
    this.state.errors = [];
    this.state.progress = 0;
    this.state.totalDocumentsIndexed = 0;
    
    const startTime = Date.now();
    let totalIndexed = 0;
    let totalErrors: SyncError[] = [];
    
    const entities = [
      { name: 'events', fn: () => this.syncEvents() },
      { name: 'archivedEvents', fn: () => this.syncArchivedEvents() },
      { name: 'tasks', fn: () => this.syncTasks() },
      { name: 'contacts', fn: () => this.syncContacts() },
      { name: 'organizations', fn: () => this.syncOrganizations() },
      { name: 'leads', fn: () => this.syncLeads() },
      { name: 'agreements', fn: () => this.syncAgreements() },
      { name: 'attendees', fn: () => this.syncAttendees() },
      { name: 'invitees', fn: () => this.syncInvitees() },
      { name: 'departments', fn: () => this.syncDepartments() },
      { name: 'leadInteractions', fn: () => this.syncLeadInteractions() },
      { name: 'partnershipActivities', fn: () => this.syncPartnershipActivities() },
      { name: 'partnershipInteractions', fn: () => this.syncPartnershipInteractions() },
      { name: 'updates', fn: () => this.syncUpdates() },
    ];
    
    try {
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        this.state.currentEntity = entity.name;
        this.state.progress = Math.round((i / entities.length) * 100);
        
        logger.info(`Syncing ${entity.name}...`);
        
        try {
          const result = await entity.fn();
          totalIndexed += result.documentsIndexed;
          totalErrors = [...totalErrors, ...result.errors];
          logger.info(`  Synced ${result.documentsIndexed} ${entity.name} documents`);
        } catch (error) {
          logger.error(`Failed to sync ${entity.name}:`, error);
          totalErrors.push({
            entity: entity.name,
            id: 'all',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          });
        }
      }
      
      this.state.lastFullSync = new Date();
      this.state.progress = 100;
      this.state.totalDocumentsIndexed = totalIndexed;
      this.state.errors = totalErrors;
      
      const duration = Date.now() - startTime;
      logger.info(`Full reindex completed: ${totalIndexed} documents in ${duration}ms`);
      
      return {
        success: totalErrors.length === 0,
        documentsIndexed: totalIndexed,
        documentsDeleted: 0,
        errors: totalErrors,
        duration_ms: duration,
      };
    } finally {
      this.state.isRunning = false;
      this.state.currentEntity = null;
    }
  }
  
  /**
   * Incremental sync - only sync documents modified since last sync
   */
  async syncIncremental(since?: Date): Promise<SyncResult> {
    if (!isElasticsearchEnabled()) {
      return { 
        success: false, 
        documentsIndexed: 0, 
        documentsDeleted: 0, 
        errors: [{ entity: 'all', id: '-', error: 'Elasticsearch not enabled', timestamp: new Date() }], 
        duration_ms: 0 
      };
    }
    
    // Default: sync records modified in the last hour
    const sinceDate = since || this.state.lastIncrementalSync || new Date(Date.now() - 3600000);
    
    if (this.state.isRunning) {
      throw new Error('Sync already in progress');
    }
    
    this.state.isRunning = true;
    const startTime = Date.now();
    let totalIndexed = 0;
    const errors: SyncError[] = [];
    
    try {
      logger.info(`Starting incremental sync since ${sinceDate.toISOString()}`);
      
      // Sync tasks (has updatedAt)
      this.state.currentEntity = 'tasks';
      const updatedTasks = await db.select()
        .from(tasks)
        .where(gte(tasks.updatedAt, sinceDate));
      
      for (const task of updatedTasks) {
        try {
          await indexingService.indexTask(task);
          totalIndexed++;
        } catch (error) {
          errors.push({
            entity: 'tasks',
            id: String(task.id),
            error: error instanceof Error ? error.message : 'Unknown',
            timestamp: new Date(),
          });
        }
      }
      
      // Sync contacts (has updatedAt)
      this.state.currentEntity = 'contacts';
      const updatedContacts = await db.select()
        .from(contacts)
        .where(gte(contacts.updatedAt, sinceDate));
      
      for (const contact of updatedContacts) {
        try {
          await indexingService.indexContact(contact);
          totalIndexed++;
        } catch (error) {
          errors.push({
            entity: 'contacts',
            id: String(contact.id),
            error: error instanceof Error ? error.message : 'Unknown',
            timestamp: new Date(),
          });
        }
      }
      
      // Sync leads (has updatedAt)
      this.state.currentEntity = 'leads';
      const updatedLeads = await db.select()
        .from(leads)
        .where(gte(leads.updatedAt, sinceDate));
      
      for (const lead of updatedLeads) {
        try {
          await indexingService.indexLead(lead);
          totalIndexed++;
        } catch (error) {
          errors.push({
            entity: 'leads',
            id: String(lead.id),
            error: error instanceof Error ? error.message : 'Unknown',
            timestamp: new Date(),
          });
        }
      }
      
      // Sync agreements (has updatedAt)
      this.state.currentEntity = 'agreements';
      const updatedAgreements = await db.select()
        .from(partnershipAgreements)
        .where(gte(partnershipAgreements.updatedAt, sinceDate));
      
      for (const agreement of updatedAgreements) {
        try {
          await indexingService.indexAgreement(agreement);
          totalIndexed++;
        } catch (error) {
          errors.push({
            entity: 'agreements',
            id: String(agreement.id),
            error: error instanceof Error ? error.message : 'Unknown',
            timestamp: new Date(),
          });
        }
      }
      
      // Sync archived events (has updatedAt)
      this.state.currentEntity = 'archivedEvents';
      const updatedArchived = await db.select()
        .from(archivedEvents)
        .where(gte(archivedEvents.updatedAt, sinceDate));
      
      for (const archived of updatedArchived) {
        try {
          await indexingService.indexArchivedEvent(archived);
          totalIndexed++;
        } catch (error) {
          errors.push({
            entity: 'archivedEvents',
            id: String(archived.id),
            error: error instanceof Error ? error.message : 'Unknown',
            timestamp: new Date(),
          });
        }
      }
      
      // Sync updates (has updatedAt)
      this.state.currentEntity = 'updates';
      const updatedUpdates = await db.select()
        .from(updates)
        .where(gte(updates.updatedAt, sinceDate));
      
      for (const update of updatedUpdates) {
        try {
          await indexingService.indexUpdate(update);
          totalIndexed++;
        } catch (error) {
          errors.push({
            entity: 'updates',
            id: String(update.id),
            error: error instanceof Error ? error.message : 'Unknown',
            timestamp: new Date(),
          });
        }
      }
      
      // Sync partnership activities (has updatedAt)
      this.state.currentEntity = 'partnershipActivities';
      const updatedActivities = await db.select()
        .from(partnershipActivities)
        .where(gte(partnershipActivities.updatedAt, sinceDate));
      
      for (const activity of updatedActivities) {
        try {
          await indexingService.indexPartnershipActivity(activity);
          totalIndexed++;
        } catch (error) {
          errors.push({
            entity: 'partnershipActivities',
            id: String(activity.id),
            error: error instanceof Error ? error.message : 'Unknown',
            timestamp: new Date(),
          });
        }
      }
      
      this.state.lastIncrementalSync = new Date();
      const duration = Date.now() - startTime;
      
      logger.info(`Incremental sync completed: ${totalIndexed} documents in ${duration}ms`);
      
      return {
        success: errors.length === 0,
        documentsIndexed: totalIndexed,
        documentsDeleted: 0,
        errors,
        duration_ms: duration,
      };
    } finally {
      this.state.isRunning = false;
      this.state.currentEntity = null;
    }
  }
  
  /**
   * Reindex a specific entity type
   */
  async reindexEntity(entityType: string): Promise<SyncResult> {
    switch (entityType) {
      case 'events': return this.syncEvents();
      case 'archivedEvents': return this.syncArchivedEvents();
      case 'tasks': return this.syncTasks();
      case 'contacts': return this.syncContacts();
      case 'organizations': return this.syncOrganizations();
      case 'leads': return this.syncLeads();
      case 'agreements': return this.syncAgreements();
      case 'attendees': return this.syncAttendees();
      case 'invitees': return this.syncInvitees();
      case 'departments': return this.syncDepartments();
      case 'leadInteractions': return this.syncLeadInteractions();
      case 'partnershipActivities': return this.syncPartnershipActivities();
      case 'partnershipInteractions': return this.syncPartnershipInteractions();
      case 'updates': return this.syncUpdates();
      default: throw new Error(`Unknown entity type: ${entityType}`);
    }
  }
  
  // ==================== Entity Sync Methods ====================
  
  private async syncEvents(): Promise<SyncResult> {
    const startTime = Date.now();
    let indexed = 0;
    const errors: SyncError[] = [];
    
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(events);
    const total = Number(countResult[0]?.count || 0);
    
    logger.info(`Syncing ${total} events with denormalized data...`);
    
    let offset = 0;
    while (offset < total) {
      // Enriched query with JOINs to get category names
      const batch = await db
        .select({
          event: events,
          categoryNameEn: categories.nameEn,
          categoryNameAr: categories.nameAr,
        })
        .from(events)
        .leftJoin(categories, eq(events.categoryId, categories.id))
        .offset(this.BATCH_SIZE)
        .offset(offset);
      
      // Get attendee/invitee/registered counts for each event in batch
      const eventIds = batch.map(row => row.event.id);
      
      // Batch count queries for performance - use inArray for proper type handling
      const [attendeeCounts, inviteeCounts, registeredCounts] = await Promise.all([
        eventIds.length > 0 ? db.select({
          eventId: eventAttendees.eventId,
          count: sql<number>`count(*)::int`,
        })
        .from(eventAttendees)
        .where(inArray(eventAttendees.eventId, eventIds))
        .groupBy(eventAttendees.eventId) : [],
        
        eventIds.length > 0 ? db.select({
          eventId: eventInvitees.eventId,
          count: sql<number>`count(*)::int`,
        })
        .from(eventInvitees)
        .where(inArray(eventInvitees.eventId, eventIds))
        .groupBy(eventInvitees.eventId) : [],
        
        eventIds.length > 0 ? db.select({
          eventId: eventInvitees.eventId,
          count: sql<number>`count(*)::int`,
        })
        .from(eventInvitees)
        .where(sql`${eventInvitees.eventId} IN (${sql.join(eventIds.map(id => sql`${id}`), sql`, `)}) AND ${eventInvitees.registered} = true`)
        .groupBy(eventInvitees.eventId) : [],
      ]);
      
      // Build lookup maps
      const attendeeMap = new Map(attendeeCounts.map(r => [r.eventId, r.count]));
      const inviteeMap = new Map(inviteeCounts.map(r => [r.eventId, r.count]));
      const registeredMap = new Map(registeredCounts.map(r => [r.eventId, r.count]));
      
      // Build enrichment and create bulk operations
      const bulkOps = batch.map(row => {
        const enrichment = {
          categoryNameEn: row.categoryNameEn || undefined,
          categoryNameAr: row.categoryNameAr || undefined,
          attendeeCount: attendeeMap.get(row.event.id) || 0,
          inviteeCount: inviteeMap.get(row.event.id) || 0,
          registeredCount: registeredMap.get(row.event.id) || 0,
        };
        return indexingService.createEventBulkOp(row.event, enrichment);
      });
      
      const result = await indexingService.bulkIndex(bulkOps);
      indexed += result.indexed + result.updated;
      
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push({
            entity: 'events',
            id: String(err.id),
            error: typeof err.error === 'string' ? err.error : JSON.stringify(err.error),
            timestamp: new Date(),
          });
        }
      }
      
      offset += this.BATCH_SIZE;
      logger.debug(`Synced events ${Math.min(offset, total)}/${total}`);
    }
    
    logger.info(`Synced ${indexed} events with denormalized data`);
    
    return {
      success: errors.length === 0,
      documentsIndexed: indexed,
      documentsDeleted: 0,
      errors,
      duration_ms: Date.now() - startTime,
      entity: 'events',
    };
  }
  
  private async syncArchivedEvents(): Promise<SyncResult> {
    const startTime = Date.now();
    let indexed = 0;
    const errors: SyncError[] = [];
    
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(archivedEvents);
    const total = Number(countResult[0]?.count || 0);
    
    let offset = 0;
    while (offset < total) {
      const batch = await db.select()
        .from(archivedEvents)
        .offset(this.BATCH_SIZE)
        .offset(offset);
      
      // Fetch speakers for each archived event in the batch
      const archivedEventIds = batch.map(ae => ae.id);
      const speakers = archivedEventIds.length > 0
        ? await db.select()
            .from(archivedEventSpeakers)
            .where(inArray(archivedEventSpeakers.archivedEventId, archivedEventIds))
        : [];
      
      // Group speakers by archived event ID
      const speakersByEventId = speakers.reduce((acc, speaker) => {
        if (!acc[speaker.archivedEventId]) {
          acc[speaker.archivedEventId] = [];
        }
        acc[speaker.archivedEventId].push({
          id: speaker.contactId || 0,
          name: speaker.speakerNameEn || '',
          organization: speaker.speakerOrganization || '',
          role: speaker.role || '',
        });
        return acc;
      }, {} as Record<number, Array<{ id: number; name: string; organization: string; role: string }>>);
      
      // Enrich archived events with speakers data
      const enrichedBatch = batch.map(archived => ({
        ...archived,
        speakers: speakersByEventId[archived.id] || [],
        departments: [], // Archives don't currently track departments
      }));
      
      // Use bulk indexing for performance
      const bulkOps = enrichedBatch.map(archived => indexingService.createArchivedEventBulkOp(archived));
      const result = await indexingService.bulkIndex(bulkOps);
      indexed += result.indexed + result.updated;
      
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push({
            entity: 'archivedEvents',
            id: String(err.id),
            error: typeof err.error === 'string' ? err.error : JSON.stringify(err.error),
            timestamp: new Date(),
          });
        }
      }
      
      offset += this.BATCH_SIZE;
    }
    
    return {
      success: errors.length === 0,
      documentsIndexed: indexed,
      documentsDeleted: 0,
      errors,
      duration_ms: Date.now() - startTime,
      entity: 'archivedEvents',
    };
  }
  
  private async syncTasks(): Promise<SyncResult> {
    const startTime = Date.now();
    let indexed = 0;
    const errors: SyncError[] = [];
    
    logger.info(`[ES Sync] Starting task sync - counting tasks...`);
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(tasks);
    const total = Number(countResult[0]?.count || 0);
    logger.info(`[ES Sync] Task count complete: ${total} tasks`);
    
    // Fetch all departments for enrichment lookup
    logger.info(`[ES Sync] Fetching departments for enrichment...`);
    const allDepartments = await db.select({
      id: departments.id,
      name: departments.name,
    }).from(departments);
    const deptMap = new Map(allDepartments.map(d => [d.id, d.name]));
    
    logger.info(`[ES Sync] Task sync: found ${allDepartments.length} departments for enrichment`, {
      departments: allDepartments.map(d => ({ id: d.id, name: d.name }))
    });
    
    // Fetch all events for enrichment lookup
    logger.info(`[ES Sync] Fetching events for enrichment...`);
    const allEvents = await db.select({ 
      id: events.id, 
      name: events.name,
    }).from(events);
    const eventMap = new Map(allEvents.map(e => [e.id, e.name]));
    logger.info(`[ES Sync] Fetched ${allEvents.length} events for enrichment`);
    
    // Fetch event_departments to map eventDepartmentId -> eventId AND departmentId
    logger.info(`[ES Sync] Fetching event_departments for enrichment...`);
    const allEventDepartments = await db.select({
      id: eventDepartments.id,
      eventId: eventDepartments.eventId,
      departmentId: eventDepartments.departmentId,
    }).from(eventDepartments);
    const eventDeptToEventMap = new Map(allEventDepartments.map(ed => [ed.id, ed.eventId]));
    const eventDeptToDeptMap = new Map(allEventDepartments.map(ed => [ed.id, ed.departmentId]));
    logger.info(`[ES Sync] Fetched ${allEventDepartments.length} event_departments for enrichment`);
    
    let offset = 0;
    while (offset < total) {
      // Use raw SQL to avoid Drizzle ORM orderSelectedFields issue
      const batch = await db.execute<{
        id: number;
        event_department_id: number | null;
        department_id: number | null;
        title: string;
        title_ar: string | null;
        description: string | null;
        description_ar: string | null;
        status: string;
        priority: string;
        due_date: string | null;
        created_at: string | null;
        completed_at: string | null;
      }>(sql`
        SELECT id, event_department_id, department_id, title, title_ar, 
               description, description_ar, status, priority, due_date, 
               created_at, completed_at
        FROM tasks
        ORDER BY id
        LIMIT ${this.BATCH_SIZE}
        OFFSET ${offset}
      `).then(result => result.rows.map(row => ({
        id: row.id,
        eventDepartmentId: row.event_department_id,
        departmentId: row.department_id,
        title: row.title,
        titleAr: row.title_ar,
        description: row.description,
        descriptionAr: row.description_ar,
        status: row.status,
        priority: row.priority,
        dueDate: row.due_date,
        createdAt: row.created_at ? new Date(row.created_at) : null,
        completedAt: row.completed_at ? new Date(row.completed_at) : null,
      })));
      
      // Use bulk indexing for performance with enrichment data
      const bulkOps = batch.map(task => {
        // Resolve event name and department through event_departments
        let eventName: string | undefined;
        let resolvedDepartmentId = task.departmentId;
        
        if (task.eventDepartmentId) {
          const eventId = eventDeptToEventMap.get(task.eventDepartmentId);
          if (eventId) {
            eventName = eventMap.get(eventId);
          }
          // For event tasks, use the eventDepartment's departmentId if task.departmentId is not set
          if (!resolvedDepartmentId) {
            resolvedDepartmentId = eventDeptToDeptMap.get(task.eventDepartmentId) || null;
          }
        }
        
        const departmentName = resolvedDepartmentId ? deptMap.get(resolvedDepartmentId) : undefined;
        
        // Debug log for tasks with departments
        if (resolvedDepartmentId) {
          logger.info(`[ES Sync] Task ${task.id} has resolvedDepartmentId=${resolvedDepartmentId} (direct=${task.departmentId}, fromEventDept=${task.eventDepartmentId ? eventDeptToDeptMap.get(task.eventDepartmentId) : null}), name=${departmentName}`);
        }
        
        const enrichment = {
          departmentName: departmentName || undefined,
          eventName,
        };
        return indexingService.createTaskBulkOp(task as any, enrichment);
      });
      const result = await indexingService.bulkIndex(bulkOps);
      indexed += result.indexed + result.updated;
      
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push({
            entity: 'tasks',
            id: String(err.id),
            error: typeof err.error === 'string' ? err.error : JSON.stringify(err.error),
            timestamp: new Date(),
          });
        }
      }
      
      offset += this.BATCH_SIZE;
    }
    
    return {
      success: errors.length === 0,
      documentsIndexed: indexed,
      documentsDeleted: 0,
      errors,
      duration_ms: Date.now() - startTime,
      entity: 'tasks',
    };
  }
  
  private async syncContacts(): Promise<SyncResult> {
    const startTime = Date.now();
    let indexed = 0;
    const errors: SyncError[] = [];
    
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(contacts);
    const total = Number(countResult[0]?.count || 0);
    
    // Fetch all organizations for enrichment lookup
    const allOrganizations = await db.select().from(organizations);
    const orgMap = new Map(allOrganizations.map(o => [o.id, o.nameEn]));
    
    // Fetch all countries for enrichment lookup
    const allCountries = await db.select().from(countries);
    const countryMap = new Map(allCountries.map(c => [c.id, { nameEn: c.nameEn, nameAr: c.nameAr, code: c.code }]));
    
    let offset = 0;
    while (offset < total) {
      const batch = await db.select()
        .from(contacts)
        .offset(this.BATCH_SIZE)
        .offset(offset);
      
      // Use bulk indexing for performance with enrichment data
      const bulkOps = batch.map(contact => {
        const country = contact.countryId ? countryMap.get(contact.countryId) : undefined;
        const enrichment = {
          organizationName: contact.organizationId ? orgMap.get(contact.organizationId) || undefined : undefined,
          countryName: country?.nameEn,
          countryNameAr: country?.nameAr,
          countryCode: country?.code,
        };
        return indexingService.createContactBulkOp(contact, enrichment);
      });
      const result = await indexingService.bulkIndex(bulkOps);
      indexed += result.indexed + result.updated;
      
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push({
            entity: 'contacts',
            id: String(err.id),
            error: typeof err.error === 'string' ? err.error : JSON.stringify(err.error),
            timestamp: new Date(),
          });
        }
      }
      
      offset += this.BATCH_SIZE;
    }
    
    return {
      success: errors.length === 0,
      documentsIndexed: indexed,
      documentsDeleted: 0,
      errors,
      duration_ms: Date.now() - startTime,
      entity: 'contacts',
    };
  }
  
  private async syncOrganizations(): Promise<SyncResult> {
    const startTime = Date.now();
    let indexed = 0;
    const errors: SyncError[] = [];
    
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(organizations);
    const total = Number(countResult[0]?.count || 0);
    
    // Fetch all countries for enrichment lookup
    const allCountries = await db.select().from(countries);
    const countryMap = new Map(allCountries.map(c => [c.id, { nameEn: c.nameEn, nameAr: c.nameAr, code: c.code }]));
    
    let offset = 0;
    while (offset < total) {
      const batch = await db.select()
        .from(organizations)
        .offset(this.BATCH_SIZE)
        .offset(offset);
      
      // Use bulk indexing for performance with country enrichment
      const bulkOps = batch.map(org => {
        const country = org.countryId ? countryMap.get(org.countryId) : undefined;
        const enrichment = {
          countryName: country?.nameEn,
          countryNameAr: country?.nameAr,
          countryCode: country?.code,
        };
        return indexingService.createOrganizationBulkOp(org, enrichment);
      });
      const result = await indexingService.bulkIndex(bulkOps);
      indexed += result.indexed + result.updated;
      
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push({
            entity: 'organizations',
            id: String(err.id),
            error: typeof err.error === 'string' ? err.error : JSON.stringify(err.error),
            timestamp: new Date(),
          });
        }
      }
      
      offset += this.BATCH_SIZE;
    }
    
    return {
      success: errors.length === 0,
      documentsIndexed: indexed,
      documentsDeleted: 0,
      errors,
      duration_ms: Date.now() - startTime,
      entity: 'organizations',
    };
  }
  
  private async syncLeads(): Promise<SyncResult> {
    const startTime = Date.now();
    let indexed = 0;
    const errors: SyncError[] = [];
    
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(leads);
    const total = Number(countResult[0]?.count || 0);
    
    let offset = 0;
    while (offset < total) {
      const batch = await db.select()
        .from(leads)
        .offset(this.BATCH_SIZE)
        .offset(offset);
      
      // Use bulk indexing for performance
      const bulkOps = batch.map(lead => indexingService.createLeadBulkOp(lead));
      const result = await indexingService.bulkIndex(bulkOps);
      indexed += result.indexed + result.updated;
      
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push({
            entity: 'leads',
            id: String(err.id),
            error: typeof err.error === 'string' ? err.error : JSON.stringify(err.error),
            timestamp: new Date(),
          });
        }
      }
      
      offset += this.BATCH_SIZE;
    }
    
    return {
      success: errors.length === 0,
      documentsIndexed: indexed,
      documentsDeleted: 0,
      errors,
      duration_ms: Date.now() - startTime,
      entity: 'leads',
    };
  }
  
  private async syncAgreements(): Promise<SyncResult> {
    const startTime = Date.now();
    let indexed = 0;
    const errors: SyncError[] = [];
    
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(partnershipAgreements);
    const total = Number(countResult[0]?.count || 0);
    
    // Fetch all organizations for enrichment lookup
    const allOrganizations = await db.select().from(organizations);
    const orgMap = new Map(allOrganizations.map(o => [o.id, o.nameEn]));
    
    let offset = 0;
    while (offset < total) {
      // Enriched query with JOIN to include agreement type name
      const batch = await db.select({
        agreement: partnershipAgreements,
        agreementTypeName: agreementTypes.nameEn,
        agreementTypeNameAr: agreementTypes.nameAr,
      })
        .from(partnershipAgreements)
        .leftJoin(agreementTypes, eq(partnershipAgreements.agreementTypeId, agreementTypes.id))
        .offset(this.BATCH_SIZE)
        .offset(offset);
      
      // Use bulk indexing for performance - include enrichment data
      const bulkOps = batch.map(row => indexingService.createAgreementBulkOp(row.agreement, {
        agreementTypeName: row.agreementTypeName || null,
        agreementTypeNameAr: row.agreementTypeNameAr || null,
        organizationName: orgMap.get(row.agreement.organizationId) || null,
      }));
      const result = await indexingService.bulkIndex(bulkOps);
      indexed += result.indexed + result.updated;
      
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push({
            entity: 'agreements',
            id: String(err.id),
            error: typeof err.error === 'string' ? err.error : JSON.stringify(err.error),
            timestamp: new Date(),
          });
        }
      }
      
      offset += this.BATCH_SIZE;
    }
    
    return {
      success: errors.length === 0,
      documentsIndexed: indexed,
      documentsDeleted: 0,
      errors,
      duration_ms: Date.now() - startTime,
      entity: 'agreements',
    };
  }
  
  private async syncAttendees(): Promise<SyncResult> {
    const startTime = Date.now();
    let indexed = 0;
    const errors: SyncError[] = [];
    
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(eventAttendees);
    const total = Number(countResult[0]?.count || 0);
    
    logger.info(`Syncing ${total} attendees with denormalized data...`);
    
    let offset = 0;
    while (offset < total) {
      // Enriched query with JOINs to denormalize all related data
      const batch = await db
        .select({
          // Attendee fields
          attendee: eventAttendees,
          // Event fields (denormalized)
          eventName: events.name,
          eventNameAr: events.nameAr,
          eventDate: events.startDate,
          eventEndDate: events.endDate,
          eventLocation: events.location,
          eventCategory: events.category,
          eventCategoryId: events.categoryId,
          eventType: events.eventType,
          eventScope: events.eventScope,
          // Category fields (denormalized)
          categoryNameEn: categories.nameEn,
          categoryNameAr: categories.nameAr,
          // Contact fields (denormalized)
          contactName: contacts.nameEn,
          contactNameAr: contacts.nameAr,
          contactEmail: contacts.email,
          contactPhone: contacts.phone,
          contactTitle: contacts.title,
          // Organization fields (denormalized)
          organizationId: contacts.organizationId,
          organizationName: organizations.nameEn,
          organizationNameAr: organizations.nameAr,
          // Country fields (denormalized)
          countryId: contacts.countryId,
          countryCode: countries.code,
          countryNameEn: countries.nameEn,
          countryNameAr: countries.nameAr,
        })
        .from(eventAttendees)
        .innerJoin(events, eq(eventAttendees.eventId, events.id))
        .innerJoin(contacts, eq(eventAttendees.contactId, contacts.id))
        .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
        .leftJoin(categories, eq(events.categoryId, categories.id))
        .leftJoin(countries, eq(contacts.countryId, countries.id))
        .offset(this.BATCH_SIZE)
        .offset(offset);
      
      // Build enrichment data and create bulk operations
      const bulkOps = batch.map(row => {
        const enrichment: AttendeeEnrichment = {
          eventName: row.eventName,
          eventNameAr: row.eventNameAr,
          eventDate: row.eventDate,
          eventEndDate: row.eventEndDate,
          eventLocation: row.eventLocation,
          eventCategory: row.eventCategory,
          eventCategoryId: row.eventCategoryId,
          eventCategoryNameEn: row.categoryNameEn,
          eventCategoryNameAr: row.categoryNameAr,
          eventType: row.eventType,
          eventScope: row.eventScope,
          contactName: row.contactName,
          contactNameAr: row.contactNameAr,
          contactEmail: row.contactEmail,
          contactPhone: row.contactPhone,
          contactTitle: row.contactTitle,
          organizationId: row.organizationId,
          organizationName: row.organizationName,
          organizationNameAr: row.organizationNameAr,
          countryId: row.countryId,
          countryCode: row.countryCode,
          countryNameEn: row.countryNameEn,
          countryNameAr: row.countryNameAr,
        };
        return indexingService.createAttendeeBulkOp(row.attendee, enrichment);
      });
      
      const result = await indexingService.bulkIndex(bulkOps);
      indexed += result.indexed + result.updated;
      
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push({
            entity: 'attendees',
            id: String(err.id),
            error: typeof err.error === 'string' ? err.error : JSON.stringify(err.error),
            timestamp: new Date(),
          });
        }
      }
      
      offset += this.BATCH_SIZE;
    }
    
    logger.info(`Synced ${indexed} attendees with denormalized data`);
    
    return {
      success: errors.length === 0,
      documentsIndexed: indexed,
      documentsDeleted: 0,
      errors,
      duration_ms: Date.now() - startTime,
      entity: 'attendees',
    };
  }
  
  private async syncInvitees(): Promise<SyncResult> {
    const startTime = Date.now();
    let indexed = 0;
    const errors: SyncError[] = [];
    
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(eventInvitees);
    const total = Number(countResult[0]?.count || 0);
    
    logger.info(`Syncing ${total} invitees with denormalized data...`);
    
    let offset = 0;
    while (offset < total) {
      // Enriched query with JOINs to denormalize all related data
      const batch = await db
        .select({
          // Invitee fields
          invitee: eventInvitees,
          // Event fields (denormalized)
          eventName: events.name,
          eventNameAr: events.nameAr,
          eventDate: events.startDate,
          eventEndDate: events.endDate,
          eventLocation: events.location,
          eventCategory: events.category,
          eventCategoryId: events.categoryId,
          eventType: events.eventType,
          eventScope: events.eventScope,
          // Category fields (denormalized)
          categoryNameEn: categories.nameEn,
          categoryNameAr: categories.nameAr,
          // Contact fields (denormalized)
          contactName: contacts.nameEn,
          contactNameAr: contacts.nameAr,
          contactEmail: contacts.email,
          contactPhone: contacts.phone,
          contactTitle: contacts.title,
          // Organization fields (denormalized)
          organizationId: contacts.organizationId,
          organizationName: organizations.nameEn,
          organizationNameAr: organizations.nameAr,
          // Country fields (denormalized)
          countryId: contacts.countryId,
          countryCode: countries.code,
          countryNameEn: countries.nameEn,
          countryNameAr: countries.nameAr,
        })
        .from(eventInvitees)
        .innerJoin(events, eq(eventInvitees.eventId, events.id))
        .innerJoin(contacts, eq(eventInvitees.contactId, contacts.id))
        .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
        .leftJoin(categories, eq(events.categoryId, categories.id))
        .leftJoin(countries, eq(contacts.countryId, countries.id))
        .offset(this.BATCH_SIZE)
        .offset(offset);
      
      // Build enrichment data and create bulk operations
      const bulkOps = batch.map(row => {
        const enrichment: InviteeEnrichment = {
          eventName: row.eventName,
          eventNameAr: row.eventNameAr,
          eventDate: row.eventDate,
          eventEndDate: row.eventEndDate,
          eventLocation: row.eventLocation,
          eventCategory: row.eventCategory,
          eventCategoryId: row.eventCategoryId,
          eventCategoryNameEn: row.categoryNameEn,
          eventCategoryNameAr: row.categoryNameAr,
          eventType: row.eventType,
          eventScope: row.eventScope,
          contactName: row.contactName,
          contactNameAr: row.contactNameAr,
          contactEmail: row.contactEmail,
          contactPhone: row.contactPhone,
          contactTitle: row.contactTitle,
          organizationId: row.organizationId,
          organizationName: row.organizationName,
          organizationNameAr: row.organizationNameAr,
          countryId: row.countryId,
          countryCode: row.countryCode,
          countryNameEn: row.countryNameEn,
          countryNameAr: row.countryNameAr,
        };
        return indexingService.createInviteeBulkOp(row.invitee, enrichment);
      });
      
      const result = await indexingService.bulkIndex(bulkOps);
      indexed += result.indexed + result.updated;
      
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push({
            entity: 'invitees',
            id: String(err.id),
            error: typeof err.error === 'string' ? err.error : JSON.stringify(err.error),
            timestamp: new Date(),
          });
        }
      }
      
      offset += this.BATCH_SIZE;
    }
    
    logger.info(`Synced ${indexed} invitees with denormalized data`);
    
    return {
      success: errors.length === 0,
      documentsIndexed: indexed,
      documentsDeleted: 0,
      errors,
      duration_ms: Date.now() - startTime,
      entity: 'invitees',
    };
  }
  
  private async syncDepartments(): Promise<SyncResult> {
    const startTime = Date.now();
    let indexed = 0;
    const errors: SyncError[] = [];
    
    const allDepartments = await db.select().from(departments);
    
    // Use bulk indexing for performance
    const bulkOps = allDepartments.map(dept => indexingService.createDepartmentBulkOp(dept));
    const result = await indexingService.bulkIndex(bulkOps);
    indexed = result.indexed + result.updated;
    
    if (result.errors.length > 0) {
      for (const err of result.errors) {
        errors.push({
          entity: 'departments',
          id: String(err.id),
          error: typeof err.error === 'string' ? err.error : JSON.stringify(err.error),
          timestamp: new Date(),
        });
      }
    }
    
    return {
      success: errors.length === 0,
      documentsIndexed: indexed,
      documentsDeleted: 0,
      errors,
      duration_ms: Date.now() - startTime,
      entity: 'departments',
    };
  }
  
  private async syncLeadInteractions(): Promise<SyncResult> {
    const startTime = Date.now();
    let indexed = 0;
    const errors: SyncError[] = [];
    
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(leadInteractions);
    const total = Number(countResult[0]?.count || 0);
    
    let offset = 0;
    while (offset < total) {
      const batch = await db.select()
        .from(leadInteractions)
        .offset(this.BATCH_SIZE)
        .offset(offset);
      
      // Use bulk indexing for performance
      const bulkOps = batch.map(interaction => indexingService.createLeadInteractionBulkOp(interaction));
      const result = await indexingService.bulkIndex(bulkOps);
      indexed += result.indexed + result.updated;
      
      // Handle any bulk errors
      if (result.errors && result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push({
            entity: 'leadInteractions',
            id: err.id || 'unknown',
            error: err.error || 'Unknown bulk error',
            timestamp: new Date(),
          });
        }
      }
      
      offset += this.BATCH_SIZE;
    }
    
    return {
      success: errors.length === 0,
      documentsIndexed: indexed,
      documentsDeleted: 0,
      errors,
      duration_ms: Date.now() - startTime,
      entity: 'leadInteractions',
    };
  }
  
  private async syncPartnershipActivities(): Promise<SyncResult> {
    const startTime = Date.now();
    let indexed = 0;
    const errors: SyncError[] = [];
    
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(partnershipActivities);
    const total = Number(countResult[0]?.count || 0);
    
    // Fetch all organizations for enrichment lookup
    const allOrganizations = await db.select().from(organizations);
    const orgMap = new Map(allOrganizations.map(o => [o.id, o.nameEn]));
    
    let offset = 0;
    while (offset < total) {
      const batch = await db.select()
        .from(partnershipActivities)
        .offset(this.BATCH_SIZE)
        .offset(offset);
      
      // Use bulk indexing for performance - include organization name enrichment
      const bulkOps = batch.map(activity => indexingService.createPartnershipActivityBulkOp(activity, {
        organizationName: orgMap.get(activity.organizationId) || undefined,
      }));
      const result = await indexingService.bulkIndex(bulkOps);
      indexed += result.indexed + result.updated;
      
      // Handle any bulk errors
      if (result.errors && result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push({
            entity: 'partnershipActivities',
            id: err.id || 'unknown',
            error: err.error || 'Unknown bulk error',
            timestamp: new Date(),
          });
        }
      }
      
      offset += this.BATCH_SIZE;
    }
    
    return {
      success: errors.length === 0,
      documentsIndexed: indexed,
      documentsDeleted: 0,
      errors,
      duration_ms: Date.now() - startTime,
      entity: 'partnershipActivities',
    };
  }
  
  private async syncPartnershipInteractions(): Promise<SyncResult> {
    const startTime = Date.now();
    let indexed = 0;
    const errors: SyncError[] = [];
    
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(partnershipInteractions);
    const total = Number(countResult[0]?.count || 0);
    
    let offset = 0;
    while (offset < total) {
      const batch = await db.select()
        .from(partnershipInteractions)
        .offset(this.BATCH_SIZE)
        .offset(offset);
      
      // Use bulk indexing for performance
      const bulkOps = batch.map(interaction => indexingService.createPartnershipInteractionBulkOp(interaction));
      const result = await indexingService.bulkIndex(bulkOps);
      indexed += result.indexed + result.updated;
      
      // Handle any bulk errors
      if (result.errors && result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push({
            entity: 'partnershipInteractions',
            id: err.id || 'unknown',
            error: err.error || 'Unknown bulk error',
            timestamp: new Date(),
          });
        }
      }
      
      offset += this.BATCH_SIZE;
    }
    
    return {
      success: errors.length === 0,
      documentsIndexed: indexed,
      documentsDeleted: 0,
      errors,
      duration_ms: Date.now() - startTime,
      entity: 'partnershipInteractions',
    };
  }
  
  private async syncUpdates(): Promise<SyncResult> {
    const startTime = Date.now();
    let indexed = 0;
    const errors: SyncError[] = [];
    
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(updates);
    const total = Number(countResult[0]?.count || 0);
    
    let offset = 0;
    while (offset < total) {
      const batch = await db.select()
        .from(updates)
        .offset(this.BATCH_SIZE)
        .offset(offset);
      
      // Use bulk indexing for performance
      const bulkOps = batch.map(update => indexingService.createUpdateBulkOp(update));
      const result = await indexingService.bulkIndex(bulkOps);
      indexed += result.indexed + result.updated;
      
      // Handle any bulk errors
      if (result.errors && result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push({
            entity: 'updates',
            id: err.id || 'unknown',
            error: err.error || 'Unknown bulk error',
            timestamp: new Date(),
          });
        }
      }
      
      offset += this.BATCH_SIZE;
    }
    
    return {
      success: errors.length === 0,
      documentsIndexed: indexed,
      documentsDeleted: 0,
      errors,
      duration_ms: Date.now() - startTime,
      entity: 'updates',
    };
  }
  
  // ==================== Orphan Cleanup ====================
  
  /**
   * Remove ES documents that no longer exist in the database
   */
  async cleanupOrphans(): Promise<{ removed: number; errors: string[] }> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return { removed: 0, errors: ['ES not available'] };
    
    let removed = 0;
    const errors: string[] = [];
    
    try {
      // Cleanup orphan events
      const esEventsResult = await client.search({
        index: ENTITY_INDEX_MAP.events,
        body: { query: { match_all: {} }, _source: false },
        size: 10000,
      });
      
      const esEventIds = esEventsResult.hits.hits.map((h: { _id: string }) => h._id);
      const dbEvents = await db.select({ id: events.id }).from(events);
      const dbEventIds = new Set(dbEvents.map(e => e.id));
      
      const orphanEventIds = esEventIds.filter((id: string) => !dbEventIds.has(id));
      
      for (const id of orphanEventIds) {
        try {
          await client.delete({ index: ENTITY_INDEX_MAP.events, id });
          removed++;
        } catch (error) {
          errors.push(`Failed to delete orphan event ${id}`);
        }
      }
      
      // Cleanup orphan tasks
      const esTasksResult = await client.search({
        index: ENTITY_INDEX_MAP.tasks,
        body: { query: { match_all: {} }, _source: false },
        size: 10000,
      });
      
      const esTaskIds = esTasksResult.hits.hits.map((h: { _id: string }) => h._id);
      const dbTasks = await db.select({ id: tasks.id }).from(tasks);
      const dbTaskIds = new Set(dbTasks.map(t => String(t.id)));
      
      const orphanTaskIds = esTaskIds.filter((id: string) => !dbTaskIds.has(id));
      
      for (const id of orphanTaskIds) {
        try {
          await client.delete({ index: ENTITY_INDEX_MAP.tasks, id });
          removed++;
        } catch (error) {
          errors.push(`Failed to delete orphan task ${id}`);
        }
      }
      
      // Cleanup orphan contacts
      const esContactsResult = await client.search({
        index: ENTITY_INDEX_MAP.contacts,
        body: { query: { match_all: {} }, _source: false },
        size: 10000,
      });
      
      const esContactIds = esContactsResult.hits.hits.map((h: { _id: string }) => h._id);
      const dbContacts = await db.select({ id: contacts.id }).from(contacts);
      const dbContactIds = new Set(dbContacts.map(c => String(c.id)));
      
      const orphanContactIds = esContactIds.filter((id: string) => !dbContactIds.has(id));
      
      for (const id of orphanContactIds) {
        try {
          await client.delete({ index: ENTITY_INDEX_MAP.contacts, id });
          removed++;
        } catch (error) {
          errors.push(`Failed to delete orphan contact ${id}`);
        }
      }
      
      // Cleanup orphan organizations
      const esOrgsResult = await client.search({
        index: ENTITY_INDEX_MAP.organizations,
        body: { query: { match_all: {} }, _source: false },
        size: 10000,
      });
      
      const esOrgIds = esOrgsResult.hits.hits.map((h: { _id: string }) => h._id);
      const dbOrgs = await db.select({ id: organizations.id }).from(organizations);
      const dbOrgIds = new Set(dbOrgs.map(o => String(o.id)));
      
      const orphanOrgIds = esOrgIds.filter((id: string) => !dbOrgIds.has(id));
      
      for (const id of orphanOrgIds) {
        try {
          await client.delete({ index: ENTITY_INDEX_MAP.organizations, id });
          removed++;
        } catch (error) {
          errors.push(`Failed to delete orphan organization ${id}`);
        }
      }
      
      // Cleanup orphan leads
      const esLeadsResult = await client.search({
        index: ENTITY_INDEX_MAP.leads,
        body: { query: { match_all: {} }, _source: false },
        size: 10000,
      });
      
      const esLeadIds = esLeadsResult.hits.hits.map((h: { _id: string }) => h._id);
      const dbLeads = await db.select({ id: leads.id }).from(leads);
      const dbLeadIds = new Set(dbLeads.map(l => String(l.id)));
      
      const orphanLeadIds = esLeadIds.filter((id: string) => !dbLeadIds.has(id));
      
      for (const id of orphanLeadIds) {
        try {
          await client.delete({ index: ENTITY_INDEX_MAP.leads, id });
          removed++;
        } catch (error) {
          errors.push(`Failed to delete orphan lead ${id}`);
        }
      }
      
      logger.info(`Orphan cleanup completed: removed ${removed} documents`);
      
    } catch (error) {
      logger.error('Orphan cleanup failed:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
    }
    
    return { removed, errors };
  }
}

// Singleton instance
export const syncService = new ElasticsearchSyncService();
