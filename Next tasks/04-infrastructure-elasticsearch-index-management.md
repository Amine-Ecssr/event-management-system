# Infrastructure: Elasticsearch Index Management

## Type
Infrastructure / Index Configuration

## Priority
🔴 Critical

## Estimated Effort
4-5 hours

## Description
Create index management system for all EventCal entities with proper mappings, lifecycle policies, and initialization logic.

## Requirements

### Index Definitions
Create indices for all 15 entity types:
1. `eventcal-events` - Events with bilingual fields
2. `eventcal-archived-events` - Historical event data
3. `eventcal-tasks` - Task management data
4. `eventcal-contacts` - Contact/speaker database
5. `eventcal-organizations` - Organizations and partners
6. `eventcal-partnerships` - Partnership relationships
7. `eventcal-agreements` - Partnership agreements
8. `eventcal-leads` - Lead management
9. `eventcal-departments` - Department data
10. `eventcal-event-attendees` - Attendance records
11. `eventcal-event-invitees` - Invitation tracking
12. `eventcal-lead-interactions` - Lead interaction logs
13. `eventcal-partnership-activities` - Partnership activities
14. `eventcal-partnership-interactions` - Partnership interaction logs
15. `eventcal-updates` - Weekly/monthly updates

### Index Naming Convention
- **Configurable Prefix**: `ES_INDEX_PREFIX` environment variable (default: `eventcal`)
- **Pattern**: `{prefix}-{entity}-{environment}`
- **Dev Example**: `eventcal-events-dev`
- **Prod Example**: `eventcal-events-prod`

---

## Complete Implementation

### Index Configuration (`server/elasticsearch/config.ts`)
```typescript
/**
 * Elasticsearch Configuration
 * 
 * Index names are configurable via environment variables:
 * - ES_INDEX_PREFIX: Base prefix for all indices (default: 'eventcal')
 * - ES_INDEX_SUFFIX: Environment suffix (default: 'dev' or 'prod' based on NODE_ENV)
 */

// Configurable index prefix - allows deployment customization
export const ES_INDEX_PREFIX = process.env.ES_INDEX_PREFIX || 'eventcal';

// Environment suffix for index names
export const ES_INDEX_SUFFIX = process.env.ES_INDEX_SUFFIX || 
  (process.env.NODE_ENV === 'production' ? 'prod' : 'dev');

// Build index name with prefix and suffix
export const buildIndexName = (entity: string): string => {
  return `${ES_INDEX_PREFIX}-${entity}-${ES_INDEX_SUFFIX}`;
};

// Build alias name (without suffix for cross-environment queries)
export const buildAliasName = (entity: string): string => {
  return `${ES_INDEX_PREFIX}-${entity}`;
};

// Entity type constants
export const ES_ENTITIES = {
  EVENTS: 'events',
  ARCHIVED_EVENTS: 'archived-events',
  TASKS: 'tasks',
  CONTACTS: 'contacts',
  ORGANIZATIONS: 'organizations',
  PARTNERSHIPS: 'partnerships',
  AGREEMENTS: 'agreements',
  LEADS: 'leads',
  DEPARTMENTS: 'departments',
  ATTENDEES: 'attendees',
  INVITEES: 'invitees',
  LEAD_INTERACTIONS: 'lead-interactions',
  PARTNERSHIP_ACTIVITIES: 'partnership-activities',
  PARTNERSHIP_INTERACTIONS: 'partnership-interactions',
  UPDATES: 'updates',
} as const;

export type ESEntityType = typeof ES_ENTITIES[keyof typeof ES_ENTITIES];
```

### Index Manager (`server/elasticsearch/indices/index-manager.ts`)
```typescript
import { getElasticsearchClient, isElasticsearchEnabled } from '../client';
import { ANALYZERS_SETTINGS } from '../analyzers';
import { 
  ES_INDEX_PREFIX, ES_INDEX_SUFFIX, ES_ENTITIES,
  buildIndexName, buildAliasName 
} from '../config';
import { eventsMapping } from '../mappings/events.mapping';
import { tasksMapping } from '../mappings/tasks.mapping';
import { contactsMapping } from '../mappings/contacts.mapping';
import { organizationsMapping } from '../mappings/organizations.mapping';
import { agreementsMapping } from '../mappings/agreements.mapping';
import { leadsMapping } from '../mappings/leads.mapping';
import { attendeesMapping } from '../mappings/attendees.mapping';
import { inviteesMapping } from '../mappings/invitees.mapping';
import { interactionsMapping } from '../mappings/interactions.mapping';
import { activitiesMapping } from '../mappings/activities.mapping';
import { updatesMapping } from '../mappings/updates.mapping';
import { departmentsMapping } from '../mappings/departments.mapping';
import { logger } from '../../utils/logger';

// Index configuration with settings appropriate for each entity
export interface IndexDefinition {
  entity: string;
  name: string;
  alias: string;
  mapping: Record<string, any>;
  settings?: Record<string, any>;
  lifecycle?: {
    rollover_max_size?: string;
    rollover_max_age?: string;
    delete_after?: string;
  };
}

// Generate index definitions dynamically based on configuration
export const getIndexDefinitions = (): IndexDefinition[] => [
  {
    entity: ES_ENTITIES.EVENTS,
    name: buildIndexName(ES_ENTITIES.EVENTS),
    alias: buildAliasName(ES_ENTITIES.EVENTS),
    mapping: eventsMapping,
    settings: {
      number_of_shards: 1,
      number_of_replicas: process.env.NODE_ENV === 'production' ? 1 : 0,
      refresh_interval: '1s',
    },
  },
  {
    entity: ES_ENTITIES.ARCHIVED_EVENTS,
    name: buildIndexName(ES_ENTITIES.ARCHIVED_EVENTS),
    alias: buildAliasName(ES_ENTITIES.ARCHIVED_EVENTS),
    mapping: eventsMapping, // Same structure as events
    settings: {
      number_of_shards: 1,
      number_of_replicas: process.env.NODE_ENV === 'production' ? 1 : 0,
      refresh_interval: '30s', // Less frequent refresh for archive
    },
  },
  {
    entity: ES_ENTITIES.TASKS,
    name: buildIndexName(ES_ENTITIES.TASKS),
    alias: buildAliasName(ES_ENTITIES.TASKS),
    mapping: tasksMapping,
    settings: {
      number_of_shards: 1,
      number_of_replicas: process.env.NODE_ENV === 'production' ? 1 : 0,
    },
  },
  {
    entity: ES_ENTITIES.CONTACTS,
    name: buildIndexName(ES_ENTITIES.CONTACTS),
    alias: buildAliasName(ES_ENTITIES.CONTACTS),
    mapping: contactsMapping,
  },
  {
    entity: ES_ENTITIES.ORGANIZATIONS,
    name: buildIndexName(ES_ENTITIES.ORGANIZATIONS),
    alias: buildAliasName(ES_ENTITIES.ORGANIZATIONS),
    mapping: organizationsMapping,
  },
  {
    entity: ES_ENTITIES.PARTNERSHIPS,
    name: buildIndexName(ES_ENTITIES.PARTNERSHIPS),
    alias: buildAliasName(ES_ENTITIES.PARTNERSHIPS),
    mapping: organizationsMapping, // Partnerships are organizations with isPartner=true
  },
  {
    entity: ES_ENTITIES.AGREEMENTS,
    name: buildIndexName(ES_ENTITIES.AGREEMENTS),
    alias: buildAliasName(ES_ENTITIES.AGREEMENTS),
    mapping: agreementsMapping,
  },
  {
    entity: ES_ENTITIES.LEADS,
    name: buildIndexName(ES_ENTITIES.LEADS),
    alias: buildAliasName(ES_ENTITIES.LEADS),
    mapping: leadsMapping,
  },
  {
    entity: ES_ENTITIES.DEPARTMENTS,
    name: buildIndexName(ES_ENTITIES.DEPARTMENTS),
    alias: buildAliasName(ES_ENTITIES.DEPARTMENTS),
    mapping: departmentsMapping,
  },
  {
    entity: ES_ENTITIES.ATTENDEES,
    name: buildIndexName(ES_ENTITIES.ATTENDEES),
    alias: buildAliasName(ES_ENTITIES.ATTENDEES),
    mapping: attendeesMapping,
  },
  {
    entity: ES_ENTITIES.INVITEES,
    name: buildIndexName(ES_ENTITIES.INVITEES),
    alias: buildAliasName(ES_ENTITIES.INVITEES),
    mapping: inviteesMapping,
  },
  {
    entity: ES_ENTITIES.LEAD_INTERACTIONS,
    name: buildIndexName(ES_ENTITIES.LEAD_INTERACTIONS),
    alias: buildAliasName(ES_ENTITIES.LEAD_INTERACTIONS),
    mapping: interactionsMapping,
    lifecycle: {
      delete_after: '365d', // Keep interaction logs for 1 year
    },
  },
  {
    entity: ES_ENTITIES.PARTNERSHIP_ACTIVITIES,
    name: buildIndexName(ES_ENTITIES.PARTNERSHIP_ACTIVITIES),
    alias: buildAliasName(ES_ENTITIES.PARTNERSHIP_ACTIVITIES),
    mapping: activitiesMapping,
  },
  {
    entity: ES_ENTITIES.PARTNERSHIP_INTERACTIONS,
    name: buildIndexName(ES_ENTITIES.PARTNERSHIP_INTERACTIONS),
    alias: buildAliasName(ES_ENTITIES.PARTNERSHIP_INTERACTIONS),
    mapping: interactionsMapping,
    lifecycle: {
      delete_after: '365d',
    },
  },
  {
    entity: ES_ENTITIES.UPDATES,
    name: buildIndexName(ES_ENTITIES.UPDATES),
    alias: buildAliasName(ES_ENTITIES.UPDATES),
    mapping: updatesMapping,
    lifecycle: {
      delete_after: '730d', // Keep updates for 2 years
    },
  },
];

// Legacy compatibility - export as INDEX_DEFINITIONS
export const INDEX_DEFINITIONS = getIndexDefinitions();

// Default index settings combined with analyzers
const getDefaultSettings = (customSettings?: Record<string, any>) => ({
  ...ANALYZERS_SETTINGS,
  index: {
    number_of_shards: 1,
    number_of_replicas: process.env.NODE_ENV === 'production' ? 1 : 0,
    refresh_interval: '1s',
    max_result_window: 50000,
    max_inner_result_window: 1000,
    highlight: {
      max_analyzed_offset: 1000000,
    },
    ...customSettings,
  },
});

export class IndexManager {
  private initialized = false;
  
  async initialize(): Promise<void> {
    if (!isElasticsearchEnabled()) {
      logger.info('Elasticsearch disabled - skipping index initialization');
      return;
    }
    
    if (this.initialized) {
      return;
    }
    
    try {
      await this.createAllIndices();
      this.initialized = true;
      logger.info('Elasticsearch indices initialized');
    } catch (error) {
      logger.error('Failed to initialize Elasticsearch indices:', error);
      throw error;
    }
  }
  
  async createAllIndices(): Promise<{ created: string[]; existing: string[]; failed: string[] }> {
    const client = await getElasticsearchClient();
    const results = { created: [] as string[], existing: [] as string[], failed: [] as string[] };
    
    for (const indexDef of INDEX_DEFINITIONS) {
      try {
        const exists = await client.indices.exists({ index: indexDef.name });
        
        if (exists) {
          results.existing.push(indexDef.name);
          
          // Update mappings if needed (non-breaking changes only)
          await this.updateMappingIfNeeded(indexDef);
          continue;
        }
        
        // Create index with settings and mappings
        await client.indices.create({
          index: indexDef.name,
          settings: getDefaultSettings(indexDef.settings),
          mappings: indexDef.mapping,
        });
        
        // Create alias if specified
        if (indexDef.alias) {
          await client.indices.putAlias({
            index: indexDef.name,
            name: indexDef.alias,
          });
        }
        
        results.created.push(indexDef.name);
        logger.info(`Created index: ${indexDef.name}`);
      } catch (error) {
        results.failed.push(indexDef.name);
        logger.error(`Failed to create index ${indexDef.name}:`, error);
      }
    }
    
    return results;
  }
  
  async updateMappingIfNeeded(indexDef: IndexDefinition): Promise<boolean> {
    const client = await getElasticsearchClient();
    
    try {
      // Get current mapping
      const currentMapping = await client.indices.getMapping({ index: indexDef.name });
      const currentProps = currentMapping[indexDef.name]?.mappings?.properties || {};
      const newProps = indexDef.mapping.properties || {};
      
      // Find new fields (fields in new mapping but not in current)
      const newFields: Record<string, any> = {};
      for (const [field, config] of Object.entries(newProps)) {
        if (!currentProps[field]) {
          newFields[field] = config;
        }
      }
      
      if (Object.keys(newFields).length > 0) {
        await client.indices.putMapping({
          index: indexDef.name,
          properties: newFields,
        });
        logger.info(`Updated mapping for ${indexDef.name}: added ${Object.keys(newFields).join(', ')}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.warn(`Failed to update mapping for ${indexDef.name}:`, error);
      return false;
    }
  }
  
  async deleteIndex(indexName: string): Promise<boolean> {
    const client = await getElasticsearchClient();
    
    try {
      const exists = await client.indices.exists({ index: indexName });
      if (!exists) {
        return false;
      }
      
      await client.indices.delete({ index: indexName });
      logger.info(`Deleted index: ${indexName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete index ${indexName}:`, error);
      throw error;
    }
  }
  
  async recreateIndex(indexName: string): Promise<void> {
    const indexDef = INDEX_DEFINITIONS.find(i => i.name === indexName || i.alias === indexName);
    if (!indexDef) {
      throw new Error(`Index definition not found: ${indexName}`);
    }
    
    const client = await getElasticsearchClient();
    
    // Delete if exists
    const exists = await client.indices.exists({ index: indexDef.name });
    if (exists) {
      await client.indices.delete({ index: indexDef.name });
    }
    
    // Create fresh
    await client.indices.create({
      index: indexDef.name,
      settings: getDefaultSettings(indexDef.settings),
      mappings: indexDef.mapping,
    });
    
    if (indexDef.alias) {
      await client.indices.putAlias({
        index: indexDef.name,
        name: indexDef.alias,
      });
    }
    
    logger.info(`Recreated index: ${indexDef.name}`);
  }
  
  async getIndexStats(): Promise<IndexStats[]> {
    const client = await getElasticsearchClient();
    
    // Use configurable prefix pattern
    const indexPattern = `${ES_INDEX_PREFIX}-*`;
    
    const stats = await client.indices.stats({
      index: indexPattern,
      metric: ['docs', 'store'],
    });
    
    const results: IndexStats[] = [];
    
    for (const [indexName, indexStats] of Object.entries(stats.indices || {})) {
      results.push({
        index: indexName,
        docs_count: indexStats.total?.docs?.count || 0,
        docs_deleted: indexStats.total?.docs?.deleted || 0,
        size_bytes: indexStats.total?.store?.size_in_bytes || 0,
        size_human: formatBytes(indexStats.total?.store?.size_in_bytes || 0),
        health: await this.getIndexHealth(indexName),
      });
    }
    
    return results;
  }
  
  private async getIndexHealth(indexName: string): Promise<string> {
    const client = await getElasticsearchClient();
    
    try {
      const health = await client.cluster.health({ index: indexName });
      return health.status;
    } catch {
      return 'unknown';
    }
  }
  
  async refreshIndex(indexName: string): Promise<void> {
    const client = await getElasticsearchClient();
    await client.indices.refresh({ index: indexName });
  }
  
  async refreshAllIndices(): Promise<void> {
    const client = await getElasticsearchClient();
    // Use configurable prefix pattern
    await client.indices.refresh({ index: `${ES_INDEX_PREFIX}-*` });
  }
  
  async optimizeIndex(indexName: string): Promise<void> {
    const client = await getElasticsearchClient();
    
    // Force merge to optimize storage (use sparingly)
    await client.indices.forcemerge({
      index: indexName,
      max_num_segments: 1,
    });
    
    logger.info(`Optimized index: ${indexName}`);
  }
}

export interface IndexStats {
  index: string;
  docs_count: number;
  docs_deleted: number;
  size_bytes: number;
  size_human: string;
  health: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Singleton instance
export const indexManager = new IndexManager();
```

### Events Mapping (`server/elasticsearch/mappings/events.mapping.ts`)
```typescript
import { bilingualTextField, dateField, normalizedKeyword } from './common-fields';

export const eventsMapping = {
  properties: {
    // Primary identifiers
    id: { type: 'keyword' },
    
    // Bilingual text fields
    ...bilingualTextField('name'),
    ...bilingualTextField('description'),
    ...bilingualTextField('location'),
    ...bilingualTextField('organizers'),
    
    // Combined search field (for cross-language search)
    searchText: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
      fields: {
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete_analyzer',
          search_analyzer: 'autocomplete_search_analyzer',
        },
      },
    },
    
    // Dates
    startDate: dateField,
    endDate: dateField,
    startTime: { type: 'keyword' },
    endTime: { type: 'keyword' },
    createdAt: dateField,
    updatedAt: dateField,
    archivedAt: dateField,
    
    // Category
    category: normalizedKeyword,
    categoryId: { type: 'integer' },
    categoryNameEn: { type: 'keyword' },
    categoryNameAr: { type: 'keyword' },
    
    // Enums
    eventType: { type: 'keyword' }, // local, international
    eventScope: { type: 'keyword' }, // internal, external
    
    // URLs
    url: { type: 'keyword', index: false },
    
    // Attendance
    expectedAttendance: { type: 'integer' },
    actualAttendance: { type: 'integer' },
    
    // Source tracking
    isScraped: { type: 'boolean' },
    source: { type: 'keyword' },
    externalId: { type: 'keyword' },
    adminModified: { type: 'boolean' },
    
    // Status
    isArchived: { type: 'boolean' },
    
    // Reminders
    reminder1Week: { type: 'boolean' },
    reminder1Day: { type: 'boolean' },
    reminderWeekly: { type: 'boolean' },
    reminderDaily: { type: 'boolean' },
    reminderMorningOf: { type: 'boolean' },
    
    // Media
    hasMedia: { type: 'boolean' },
    mediaCount: { type: 'integer' },
    thumbnailUrl: { type: 'keyword', index: false },
    
    // Agendas
    hasAgendaEn: { type: 'boolean' },
    hasAgendaAr: { type: 'boolean' },
    
    // Related entities (for faceting)
    stakeholderIds: { type: 'integer' },
    speakerIds: { type: 'integer' },
    taskCount: { type: 'integer' },
    attendeeCount: { type: 'integer' },
    inviteeCount: { type: 'integer' },
    
    // Completion suggester
    suggest: {
      type: 'completion',
      analyzer: 'autocomplete_analyzer',
      preserve_separators: true,
      preserve_position_increments: true,
      max_input_length: 100,
      contexts: [
        { name: 'category', type: 'category' },
        { name: 'type', type: 'category' },
      ],
    },
  },
};
```

### Tasks Mapping (`server/elasticsearch/mappings/tasks.mapping.ts`)
```typescript
import { bilingualTextField, dateField, normalizedKeyword } from './common-fields';

export const tasksMapping = {
  properties: {
    id: { type: 'integer' },
    
    // Bilingual task name/description
    ...bilingualTextField('name'),
    ...bilingualTextField('description'),
    
    // Combined search field
    searchText: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
    },
    
    // Status and priority
    status: { type: 'keyword' },
    priority: { type: 'keyword' },
    
    // Dates
    dueDate: dateField,
    completedAt: dateField,
    createdAt: dateField,
    updatedAt: dateField,
    
    // Related entities
    eventId: { type: 'keyword' },
    eventName: { type: 'text' },
    leadId: { type: 'integer' },
    partnershipId: { type: 'integer' },
    parentTaskId: { type: 'integer' },
    
    // Assignment
    stakeholderId: { type: 'integer' },
    stakeholderName: { type: 'keyword' },
    departmentId: { type: 'integer' },
    departmentName: { type: 'keyword' },
    assignedToUserId: { type: 'integer' },
    
    // Workflow
    isWorkflowTask: { type: 'boolean' },
    workflowId: { type: 'integer' },
    workflowStepId: { type: 'integer' },
    dueDateBasis: { type: 'keyword' },
    dueDateOffset: { type: 'integer' },
    
    // Metrics
    isOverdue: { type: 'boolean' },
    daysOverdue: { type: 'integer' },
    daysUntilDue: { type: 'integer' },
    completionTime: { type: 'integer' }, // Days from creation to completion
    
    // Subtasks
    hasSubtasks: { type: 'boolean' },
    subtaskCount: { type: 'integer' },
    completedSubtaskCount: { type: 'integer' },
  },
};
```

### Contacts Mapping (`server/elasticsearch/mappings/contacts.mapping.ts`)
```typescript
import { bilingualTextField, dateField, normalizedKeyword } from './common-fields';

export const contactsMapping = {
  properties: {
    id: { type: 'integer' },
    
    // Name fields
    ...bilingualTextField('name'),
    firstName: { type: 'text', analyzer: 'bilingual_analyzer' },
    lastName: { type: 'text', analyzer: 'bilingual_analyzer' },
    fullName: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
      fields: {
        keyword: { type: 'keyword' },
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete_analyzer',
          search_analyzer: 'autocomplete_search_analyzer',
        },
      },
    },
    
    // Professional info
    ...bilingualTextField('position'),
    ...bilingualTextField('bio'),
    
    // Contact details
    email: { type: 'keyword' },
    phone: { type: 'keyword' },
    
    // Organization
    organizationId: { type: 'integer' },
    organizationName: { type: 'keyword' },
    organizationType: { type: 'keyword' },
    
    // Location
    country: { type: 'keyword' },
    city: { type: 'keyword' },
    
    // Speaker info
    isSpeaker: { type: 'boolean' },
    speakerTopics: { type: 'keyword' },
    speakerBio: { type: 'text', analyzer: 'bilingual_analyzer' },
    
    // Social links
    linkedIn: { type: 'keyword', index: false },
    twitter: { type: 'keyword', index: false },
    
    // Dates
    createdAt: dateField,
    updatedAt: dateField,
    
    // Engagement metrics
    eventsAttended: { type: 'integer' },
    eventsSpokenAt: { type: 'integer' },
    lastEventDate: dateField,
    engagementScore: { type: 'float' },
    
    // Profile completeness
    hasPhoto: { type: 'boolean' },
    hasEmail: { type: 'boolean' },
    hasPhone: { type: 'boolean' },
    profileCompleteness: { type: 'integer' }, // Percentage 0-100
    
    // Suggest for autocomplete
    suggest: {
      type: 'completion',
      analyzer: 'autocomplete_analyzer',
      contexts: [
        { name: 'organization', type: 'category' },
        { name: 'speaker', type: 'category' },
      ],
    },
  },
};
```

### Organizations Mapping (`server/elasticsearch/mappings/organizations.mapping.ts`)
```typescript
import { bilingualTextField, dateField, normalizedKeyword } from './common-fields';

export const organizationsMapping = {
  properties: {
    id: { type: 'integer' },
    
    // Name
    ...bilingualTextField('name'),
    
    // Type and classification
    type: { type: 'keyword' }, // government, private, academic, ngo, etc.
    industry: { type: 'keyword' },
    
    // Location
    country: { type: 'keyword' },
    city: { type: 'keyword' },
    address: { type: 'text' },
    
    // Contact
    email: { type: 'keyword' },
    phone: { type: 'keyword' },
    website: { type: 'keyword', index: false },
    
    // Partnership specific
    isPartner: { type: 'boolean' },
    partnershipStatus: { type: 'keyword' }, // active, inactive, potential
    partnershipType: { type: 'keyword' },
    partnerSince: dateField,
    
    // Metrics
    contactCount: { type: 'integer' },
    eventCount: { type: 'integer' },
    agreementCount: { type: 'integer' },
    activeAgreements: { type: 'integer' },
    
    // Dates
    createdAt: dateField,
    updatedAt: dateField,
    lastActivityDate: dateField,
    
    // Logo
    hasLogo: { type: 'boolean' },
    logoUrl: { type: 'keyword', index: false },
    
    // Suggest
    suggest: {
      type: 'completion',
      analyzer: 'autocomplete_analyzer',
      contexts: [
        { name: 'type', type: 'category' },
        { name: 'country', type: 'category' },
      ],
    },
  },
};
```

### Files to Create
- `server/elasticsearch/indices/index-manager.ts` - Index lifecycle management
- `server/elasticsearch/mappings/events.mapping.ts`
- `server/elasticsearch/mappings/tasks.mapping.ts`
- `server/elasticsearch/mappings/contacts.mapping.ts`
- `server/elasticsearch/mappings/organizations.mapping.ts`
- `server/elasticsearch/mappings/agreements.mapping.ts`
- `server/elasticsearch/mappings/leads.mapping.ts`
- `server/elasticsearch/mappings/attendees.mapping.ts`
- `server/elasticsearch/mappings/invitees.mapping.ts`
- `server/elasticsearch/mappings/interactions.mapping.ts`
- `server/elasticsearch/mappings/activities.mapping.ts`
- `server/elasticsearch/mappings/updates.mapping.ts`
- `server/elasticsearch/mappings/departments.mapping.ts`
- `server/elasticsearch/mappings/common-fields.ts`
- `server/elasticsearch/mappings/index.ts` - Export all mappings

### Index Manager Features
- `initialize()` - Initialize all indices on startup
- `createAllIndices()` - Create all indices with mappings
- `updateMappingIfNeeded()` - Add new fields without recreating
- `deleteIndex(name)` - Delete specific index
- `recreateIndex(name)` - Delete and recreate (data loss)
- `getIndexStats()` - Document counts and sizes
- `refreshIndex(name)` - Force refresh for immediate search
- `optimizeIndex(name)` - Force merge for storage optimization

## Acceptance Criteria
- [ ] All 15 indices created on server startup
- [ ] Mappings include bilingual analyzers
- [ ] Aliases work for environment-agnostic access
- [ ] Index stats endpoint available
- [ ] New fields can be added without recreation
- [ ] Mapping updates are non-breaking
- [ ] Completion suggesters configured
- [ ] Lifecycle policies set for interaction logs

## Dependencies
- Tasks 01-03 completed
