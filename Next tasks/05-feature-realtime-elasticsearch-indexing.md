# Feature: Real-time Elasticsearch Indexing

## Type
Feature / Data Synchronization

## Priority
🟠 High

## Estimated Effort
6-8 hours

## Description
Implement automatic real-time indexing of data to Elasticsearch during CRUD operations. Every create, update, and delete operation should sync to ES.

## Index Naming
All indices use the configurable `ES_INDEX_PREFIX` (default: `eventcal`) and `ES_INDEX_SUFFIX` (environment-based).
- Example index: `eventcal-events-prod`
- Query via alias: `eventcal-events`

## Requirements

### Indexing Service Interface
Create `server/services/elasticsearch-indexing.service.ts`:

```typescript
// Core indexing methods
indexEvent(event: Event): Promise<void>
indexTask(task: Task): Promise<void>
indexContact(contact: Contact): Promise<void>
indexOrganization(org: Organization): Promise<void>
indexPartnership(partnership: Organization): Promise<void>
indexAgreement(agreement: PartnershipAgreement): Promise<void>
indexLead(lead: Lead): Promise<void>
indexEventAttendee(attendee: EventAttendee): Promise<void>
indexEventInvitee(invitee: EventInvitee): Promise<void>
indexLeadInteraction(interaction: LeadInteraction): Promise<void>
indexPartnershipActivity(activity: PartnershipActivity): Promise<void>
indexPartnershipInteraction(interaction: PartnershipInteraction): Promise<void>
indexArchivedEvent(archived: ArchivedEvent): Promise<void>

// Bulk operations
bulkIndex(items: IndexableItem[]): Promise<BulkResult>
deleteDocument(index: string, id: string): Promise<void>
```

---

## Complete Implementation

### Full Indexing Service (`server/services/elasticsearch-indexing.service.ts`)
```typescript
import { getOptionalElasticsearchClient, classifyESError } from '../elasticsearch/client';
import { ENTITY_INDEX_MAP, BulkIndexResult, IndexResult } from '../elasticsearch/types';
import { logger } from '../utils/logger';
import { 
  Event, Task, Contact, Organization, Lead, 
  PartnershipAgreement, EventAttendee, EventInvitee,
  LeadInteraction, PartnershipActivity, PartnershipInteraction,
  ArchivedEvent, WeeklyUpdate
} from '@shared/schema';

// Transform functions - convert DB models to ES documents
export interface ESEventDocument {
  id: string;
  nameEn: string;
  nameAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  searchText: string; // Combined searchable text
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  locationEn: string | null;
  locationAr: string | null;
  organizersEn: string | null;
  organizersAr: string | null;
  category: string | null;
  categoryId: number | null;
  eventType: string;
  eventScope: string;
  expectedAttendance: number | null;
  isScraped: boolean;
  source: string;
  isArchived: boolean;
  hasMedia: boolean;
  mediaCount: number;
  createdAt: string;
  updatedAt: string;
  suggest: {
    input: string[];
    contexts: {
      category?: string[];
      type?: string[];
    };
  };
}

interface EventEnrichment {
  mediaCount?: number;
  taskCount?: number;
  attendeeCount?: number;
  inviteeCount?: number;
  stakeholderIds?: number[];
  speakerIds?: number[];
}

// Transform Event to ES document
function transformEvent(event: Event, enrichment?: EventEnrichment): ESEventDocument {
  const searchText = [
    event.name,
    event.nameAr,
    event.description,
    event.descriptionAr,
    event.location,
    event.locationAr,
    event.organizers,
    event.category,
  ].filter(Boolean).join(' ');
  
  return {
    id: event.id,
    nameEn: event.name,
    nameAr: event.nameAr,
    descriptionEn: event.description,
    descriptionAr: event.descriptionAr,
    searchText,
    startDate: event.startDate,
    endDate: event.endDate,
    startTime: event.startTime,
    endTime: event.endTime,
    locationEn: event.location,
    locationAr: event.locationAr,
    organizersEn: event.organizers,
    organizersAr: event.organizersAr,
    category: event.category,
    categoryId: event.categoryId,
    eventType: event.eventType,
    eventScope: event.eventScope,
    expectedAttendance: event.expectedAttendance,
    isScraped: event.isScraped,
    source: event.source,
    isArchived: event.isArchived,
    hasMedia: (enrichment?.mediaCount || 0) > 0,
    mediaCount: enrichment?.mediaCount || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    suggest: {
      input: [event.name, event.nameAr].filter(Boolean) as string[],
      contexts: {
        category: event.category ? [event.category] : [],
        type: [event.eventType],
      },
    },
  };
}

interface TaskEnrichment {
  eventName?: string;
  stakeholderName?: string;
  departmentName?: string;
}

interface ESTaskDocument {
  id: number;
  nameEn: string;
  nameAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  searchText: string;
  status: string;
  priority: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  eventId: string | null;
  eventName: string | null;
  leadId: number | null;
  partnershipId: number | null;
  stakeholderId: number | null;
  stakeholderName: string | null;
  isWorkflowTask: boolean;
  isOverdue: boolean;
  daysOverdue: number;
  daysUntilDue: number | null;
}

// Transform Task to ES document
function transformTask(task: Task, enrichment?: TaskEnrichment): ESTaskDocument {
  const now = new Date();
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && dueDate < now && task.status !== 'completed';
  const daysOverdue = isOverdue ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const daysUntilDue = dueDate && !isOverdue ? Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  
  return {
    id: task.id,
    nameEn: task.name,
    nameAr: task.nameAr,
    descriptionEn: task.description,
    descriptionAr: task.descriptionAr,
    searchText: [task.name, task.nameAr, task.description, task.descriptionAr].filter(Boolean).join(' '),
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    completedAt: task.completedAt?.toISOString() || null,
    createdAt: task.createdAt?.toISOString() || new Date().toISOString(),
    eventId: task.eventId,
    eventName: enrichment?.eventName || null,
    leadId: task.leadId,
    partnershipId: task.partnershipId,
    stakeholderId: task.stakeholderId,
    stakeholderName: enrichment?.stakeholderName || null,
    isWorkflowTask: task.isWorkflowTask || false,
    isOverdue,
    daysOverdue,
    daysUntilDue,
  };
}

interface ContactEnrichment {
  organizationName?: string;
  eventsAttended?: number;
  eventsSpokenAt?: number;
}

interface RetryQueueItem {
  entityType: string;
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

function calculateProfileCompleteness(contact: Contact): number {
  const fields = [
    contact.firstName,
    contact.lastName,
    contact.email,
    contact.phone,
    contact.position,
    contact.organizationId,
    contact.photoUrl,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

export class ElasticsearchIndexingService {
  private retryQueue: RetryQueueItem[] = [];
  private isProcessingQueue = false;
  
  // Index single event
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
      
      logger.debug(\`Indexed event \${event.id}\`, { result: result.result });
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
  
  // Index single task
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
  
  // Index contact
  async indexContact(contact: Contact, enrichment?: ContactEnrichment): Promise<IndexResult | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return null;
    
    const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
    const document = {
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      fullName,
      nameEn: fullName,
      nameAr: contact.nameAr,
      positionEn: contact.position,
      positionAr: contact.positionAr,
      email: contact.email,
      phone: contact.phone,
      organizationId: contact.organizationId,
      organizationName: enrichment?.organizationName,
      isSpeaker: contact.isSpeaker || false,
      country: contact.country,
      createdAt: contact.createdAt?.toISOString(),
      hasPhoto: !!contact.photoUrl,
      hasEmail: !!contact.email,
      hasPhone: !!contact.phone,
      profileCompleteness: calculateProfileCompleteness(contact),
      eventsAttended: enrichment?.eventsAttended || 0,
      eventsSpokenAt: enrichment?.eventsSpokenAt || 0,
      suggest: {
        input: [fullName, contact.nameAr].filter(Boolean),
        contexts: {
          organization: enrichment?.organizationName ? [enrichment.organizationName] : [],
          speaker: contact.isSpeaker ? ['true'] : ['false'],
        },
      },
    };
    
    try {
      const result = await client.index({
        index: ENTITY_INDEX_MAP.contacts,
        id: String(contact.id),
        document,
        refresh: 'wait_for',
      });
      
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
  
  // Delete document from any index
  async deleteDocument(entityType: keyof typeof ENTITY_INDEX_MAP, id: string): Promise<boolean> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return false;
    
    try {
      await client.delete({
        index: ENTITY_INDEX_MAP[entityType],
        id,
        refresh: 'wait_for',
      });
      
      logger.debug(\`Deleted \${entityType} document \${id}\`);
      return true;
    } catch (error: any) {
      if (error?.statusCode === 404) {
        return true; // Already gone
      }
      logger.error(\`Failed to delete \${entityType} document \${id}:\`, error);
      return false;
    }
  }
  
  // Bulk index multiple documents
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
          errors.push({ id: response._id, index: response._index, type: response.error.type, error: response.error });
        } else if (response.result === 'created') {
          indexed++;
        } else if (response.result === 'updated') {
          updated++;
        }
      }
      
      return { indexed, updated, failed, took_ms: Date.now() - startTime, errors };
    } catch (error) {
      logger.error('Bulk indexing failed:', error);
      return { indexed: 0, updated: 0, failed: operations.length, took_ms: Date.now() - startTime, errors: [] };
    }
  }
  
  // Error handling with retry queue
  private handleIndexingError(entityType: string, id: string, document: any, error: unknown): void {
    const classified = classifyESError(error);
    
    logger.error(\`Failed to index \${entityType} \${id}:\`, { error: classified.message, retryable: classified.retryable });
    
    if (classified.retryable) {
      this.retryQueue.push({ entityType, id, document, attempts: 0, lastAttempt: new Date() });
      if (!this.isProcessingQueue) {
        this.scheduleRetryProcessing();
      }
    }
  }
  
  private scheduleRetryProcessing(): void {
    setTimeout(() => this.processRetryQueue(), 30000);
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
    
    const itemsToRetry = this.retryQueue.splice(0, 100);
    
    for (const item of itemsToRetry) {
      if (item.attempts >= 5) {
        logger.error(\`Giving up on indexing \${item.entityType} \${item.id} after 5 attempts\`);
        continue;
      }
      
      try {
        await client.index({
          index: ENTITY_INDEX_MAP[item.entityType as keyof typeof ENTITY_INDEX_MAP],
          id: item.id,
          document: item.document,
        });
        logger.info(\`Retry succeeded for \${item.entityType} \${item.id}\`);
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
  
  getRetryQueueStatus(): { pending: number; oldestItem: Date | null } {
    return {
      pending: this.retryQueue.length,
      oldestItem: this.retryQueue.length > 0 ? this.retryQueue[0].lastAttempt : null,
    };
  }
}

export const indexingService = new ElasticsearchIndexingService();
```

---

### Integration Points

Modify route handlers to trigger indexing after successful DB operations:

#### Event Routes Integration (\`server/routes/event.routes.ts\`)
```typescript
import { indexingService } from '../services/elasticsearch-indexing.service';

// After creating event
router.post('/api/events', isAdminOrSuperAdmin, async (req, res) => {
  const validated = insertEventSchema.parse(req.body);
  const event = await storage.createEvent(validated);
  
  // Index to ES (non-blocking)
  indexingService.indexEvent(event).catch(err => {
    logger.warn('Failed to index new event:', err);
  });
  
  res.json(event);
});

// After updating event
router.patch('/api/events/:id', isAdminOrSuperAdmin, async (req, res) => {
  const event = await storage.updateEvent(req.params.id, req.body);
  
  indexingService.indexEvent(event).catch(err => {
    logger.warn('Failed to re-index updated event:', err);
  });
  
  res.json(event);
});

// After deleting event
router.delete('/api/events/:id', isAdminOrSuperAdmin, async (req, res) => {
  await storage.deleteEvent(req.params.id);
  
  indexingService.deleteDocument('events', req.params.id).catch(err => {
    logger.warn('Failed to delete event from index:', err);
  });
  
  res.json({ success: true });
});
```

---

### Files to Create
- \`server/services/elasticsearch-indexing.service.ts\` - Main indexing service
- \`server/services/elasticsearch-transformers.ts\` - Entity transformers (optional, can be in main file)
- \`server/middleware/elasticsearch-indexing.middleware.ts\` - Optional middleware approach

### Files to Modify
- \`server/routes/event.routes.ts\`
- \`server/routes/task.routes.ts\`
- \`server/routes/organization.routes.ts\`
- \`server/routes/lead.routes.ts\`
- \`server/routes/partnership.routes.ts\`
- \`server/routes/invitation.routes.ts\`
- \`server/routes/archive.routes.ts\`

## Error Handling Strategy
1. **Non-Blocking**: Indexing failures should not block the main operation
2. **Retry Queue**: Failed operations are queued for retry with exponential backoff
3. **Max Retries**: Give up after 5 attempts
4. **Logging**: All failures logged for monitoring
5. **Alerting**: High failure rates should trigger alerts (future: integrate with monitoring)

## Acceptance Criteria
- [ ] Creating an event indexes it to ES immediately
- [ ] Updating an event updates ES document
- [ ] Deleting an event removes ES document
- [ ] Same for all other entity types (15 total)
- [ ] Failed indexing doesn't break main operation
- [ ] Indexing errors are logged
- [ ] Retry queue processes failed operations
- [ ] Bulk operations handle 1000+ documents
- [ ] Refresh strategy makes docs immediately searchable
- [ ] Transform functions handle null/undefined gracefully

## Performance Considerations
- Use \`refresh: 'wait_for'\` for single ops (immediate searchability)
- Use \`refresh: false\` for bulk operations (batch at end)
- Batch bulk operations in chunks of 500
- Monitor indexing latency via logs

## Dependencies
- Task 04: Index Management
