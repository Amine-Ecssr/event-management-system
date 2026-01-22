# Feature: Scheduled Elasticsearch Sync & Bulk Operations

## Type
Feature / Background Jobs

## Priority
🟠 High

## Estimated Effort
4-5 hours

## Description
Implement scheduled background jobs for full ES synchronization and bulk indexing operations. Ensures ES stays in sync with PostgreSQL even if real-time indexing fails.

## Requirements

### Cron Service
Create `server/services/cron.service.ts`:
- Daily full sync at 3 AM GST
- Hourly incremental sync (based on updated_at)
- Weekly index optimization

---

## Complete Implementation

### Sync Service (`server/services/elasticsearch-sync.service.ts`)
```typescript
import { getOptionalElasticsearchClient, isElasticsearchEnabled } from '../elasticsearch/client';
import { ENTITY_INDEX_MAP, SyncResult, SyncStatus, SyncError } from '../elasticsearch/types';
import { indexingService } from './elasticsearch-indexing.service';
import { storage } from '../repositories';
import { logger } from '../utils/logger';
import { db } from '../db';
import { events, tasks, contacts, organizations, leads, partnershipAgreements } from '@shared/schema';
import { gt, gte, sql, and, eq } from 'drizzle-orm';

interface SyncState {
  lastFullSync: Date | null;
  lastIncrementalSync: Date | null;
  isRunning: boolean;
  currentEntity: string | null;
  progress: number;
  errors: SyncError[];
}

export class ElasticsearchSyncService {
  private state: SyncState = {
    lastFullSync: null,
    lastIncrementalSync: null,
    isRunning: false,
    currentEntity: null,
    progress: 0,
    errors: [],
  };
  
  private readonly BATCH_SIZE = 500;
  
  getStatus(): SyncStatus {
    return {
      lastSyncAt: this.state.lastIncrementalSync,
      lastFullSyncAt: this.state.lastFullSync,
      documentsIndexed: 0, // Set during sync
      documentsDeleted: 0,
      errors: this.state.errors.length,
      inProgress: this.state.isRunning,
      currentEntity: this.state.currentEntity,
      progress: this.state.progress,
    };
  }
  
  // Full reindex - syncs ALL data from PostgreSQL to ES
  async reindexAll(): Promise<SyncResult> {
    if (!isElasticsearchEnabled()) {
      return { success: false, documentsIndexed: 0, documentsDeleted: 0, errors: [], duration_ms: 0 };
    }
    
    if (this.state.isRunning) {
      throw new Error('Sync already in progress');
    }
    
    this.state.isRunning = true;
    this.state.errors = [];
    this.state.progress = 0;
    
    const startTime = Date.now();
    let totalIndexed = 0;
    let totalErrors: SyncError[] = [];
    
    const entities = [
      { name: 'events', fn: () => this.syncEvents() },
      { name: 'tasks', fn: () => this.syncTasks() },
      { name: 'contacts', fn: () => this.syncContacts() },
      { name: 'organizations', fn: () => this.syncOrganizations() },
      { name: 'leads', fn: () => this.syncLeads() },
      { name: 'agreements', fn: () => this.syncAgreements() },
      { name: 'attendees', fn: () => this.syncAttendees() },
      { name: 'invitees', fn: () => this.syncInvitees() },
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
      
      return {
        success: totalErrors.length === 0,
        documentsIndexed: totalIndexed,
        documentsDeleted: 0,
        errors: totalErrors,
        duration_ms: Date.now() - startTime,
      };
    } finally {
      this.state.isRunning = false;
      this.state.currentEntity = null;
    }
  }
  
  // Incremental sync - only sync changed documents
  async syncIncremental(since?: Date): Promise<SyncResult> {
    if (!isElasticsearchEnabled()) {
      return { success: false, documentsIndexed: 0, documentsDeleted: 0, errors: [], duration_ms: 0 };
    }
    
    const sinceDate = since || this.state.lastIncrementalSync || new Date(Date.now() - 3600000); // Default: last hour
    
    if (this.state.isRunning) {
      throw new Error('Sync already in progress');
    }
    
    this.state.isRunning = true;
    const startTime = Date.now();
    let totalIndexed = 0;
    const errors: SyncError[] = [];
    
    try {
      // Sync events updated since last sync
      const updatedEvents = await db.select()
        .from(events)
        .where(gte(events.updatedAt, sinceDate));
      
      for (const event of updatedEvents) {
        try {
          await indexingService.indexEvent(event);
          totalIndexed++;
        } catch (error) {
          errors.push({
            entity: 'events',
            id: event.id,
            error: error instanceof Error ? error.message : 'Unknown',
            timestamp: new Date(),
          });
        }
      }
      
      // Sync tasks updated since last sync
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
      
      // Add similar blocks for other entities...
      
      this.state.lastIncrementalSync = new Date();
      
      return {
        success: errors.length === 0,
        documentsIndexed: totalIndexed,
        documentsDeleted: 0,
        errors,
        duration_ms: Date.now() - startTime,
      };
    } finally {
      this.state.isRunning = false;
    }
  }
  
  // Sync specific entity type
  async reindexEntity(entityType: string): Promise<SyncResult> {
    switch (entityType) {
      case 'events': return this.syncEvents();
      case 'tasks': return this.syncTasks();
      case 'contacts': return this.syncContacts();
      case 'organizations': return this.syncOrganizations();
      case 'leads': return this.syncLeads();
      case 'agreements': return this.syncAgreements();
      case 'attendees': return this.syncAttendees();
      case 'invitees': return this.syncInvitees();
      default: throw new Error(`Unknown entity type: ${entityType}`);
    }
  }
  
  // Sync all events in batches
  private async syncEvents(): Promise<SyncResult> {
    const startTime = Date.now();
    let indexed = 0;
    const errors: SyncError[] = [];
    
    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(events);
    const total = Number(countResult[0]?.count || 0);
    
    let offset = 0;
    while (offset < total) {
      const batch = await db.select()
        .from(events)
        .limit(this.BATCH_SIZE)
        .offset(offset);
      
      const operations = batch.map(event => ({
        action: 'index' as const,
        index: ENTITY_INDEX_MAP.events,
        id: event.id,
        document: this.transformEvent(event),
      }));
      
      const result = await indexingService.bulkIndex(operations);
      indexed += result.indexed + result.updated;
      
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push({
            entity: 'events',
            id: err.id,
            error: err.error?.reason || 'Unknown error',
            timestamp: new Date(),
          });
        }
      }
      
      offset += this.BATCH_SIZE;
      logger.debug(`Synced events ${Math.min(offset, total)}/${total}`);
    }
    
    return {
      success: errors.length === 0,
      documentsIndexed: indexed,
      documentsDeleted: 0,
      errors,
      duration_ms: Date.now() - startTime,
      entity: 'events',
    };
  }
  
  // Similar implementations for other entities...
  private async syncTasks(): Promise<SyncResult> {
    const startTime = Date.now();
    let indexed = 0;
    const errors: SyncError[] = [];
    
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(tasks);
    const total = Number(countResult[0]?.count || 0);
    
    let offset = 0;
    while (offset < total) {
      const batch = await db.select().from(tasks).limit(this.BATCH_SIZE).offset(offset);
      
      const operations = batch.map(task => ({
        action: 'index' as const,
        index: ENTITY_INDEX_MAP.tasks,
        id: String(task.id),
        document: this.transformTask(task),
      }));
      
      const result = await indexingService.bulkIndex(operations);
      indexed += result.indexed + result.updated;
      
      offset += this.BATCH_SIZE;
    }
    
    return { success: true, documentsIndexed: indexed, documentsDeleted: 0, errors, duration_ms: Date.now() - startTime, entity: 'tasks' };
  }
  
  private async syncContacts(): Promise<SyncResult> { /* Similar implementation */ }
  private async syncOrganizations(): Promise<SyncResult> { /* Similar implementation */ }
  private async syncLeads(): Promise<SyncResult> { /* Similar implementation */ }
  private async syncAgreements(): Promise<SyncResult> { /* Similar implementation */ }
  private async syncAttendees(): Promise<SyncResult> { /* Similar implementation */ }
  private async syncInvitees(): Promise<SyncResult> { /* Similar implementation */ }
  
  // Orphan cleanup - remove ES docs without DB records
  async cleanupOrphans(): Promise<{ removed: number; errors: string[] }> {
    const client = await getOptionalElasticsearchClient();
    if (!client) return { removed: 0, errors: ['ES not available'] };
    
    let removed = 0;
    const errors: string[] = [];
    
    // Get all event IDs from ES
    const esEvents = await client.search({
      index: ENTITY_INDEX_MAP.events,
      body: { query: { match_all: {} }, _source: false },
      size: 10000,
    });
    
    const esEventIds = esEvents.hits.hits.map(h => h._id);
    
    // Get all event IDs from DB
    const dbEvents = await db.select({ id: events.id }).from(events);
    const dbEventIds = new Set(dbEvents.map(e => e.id));
    
    // Find orphans
    const orphanIds = esEventIds.filter(id => !dbEventIds.has(id));
    
    // Delete orphans
    for (const id of orphanIds) {
      try {
        await client.delete({ index: ENTITY_INDEX_MAP.events, id });
        removed++;
      } catch (error) {
        errors.push(`Failed to delete orphan event ${id}`);
      }
    }
    
    // Repeat for other entity types...
    
    return { removed, errors };
  }
  
  // Transform functions (simplified - use from indexing service in real impl)
  private transformEvent(event: any) {
    return {
      id: event.id,
      nameEn: event.name,
      nameAr: event.nameAr,
      startDate: event.startDate,
      endDate: event.endDate,
      category: event.category,
      eventType: event.eventType,
      eventScope: event.eventScope,
      isArchived: event.isArchived,
      searchText: [event.name, event.nameAr, event.description].filter(Boolean).join(' '),
    };
  }
  
  private transformTask(task: any) {
    return {
      id: task.id,
      nameEn: task.name,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      searchText: [task.name, task.description].filter(Boolean).join(' '),
    };
  }
}

export const syncService = new ElasticsearchSyncService();
```

### Cron Service (`server/services/cron.service.ts`)
```typescript
import cron from 'node-cron';
import { syncService } from './elasticsearch-sync.service';
import { indexManager } from '../elasticsearch/indices/index-manager';
import { logger } from '../utils/logger';

export class CronService {
  private jobs: cron.ScheduledTask[] = [];
  
  initialize(): void {
    // Daily full sync at 3 AM GST (11 PM UTC previous day)
    this.jobs.push(
      cron.schedule('0 23 * * *', async () => {
        logger.info('Starting scheduled full ES sync');
        try {
          const result = await syncService.reindexAll();
          logger.info('Full ES sync completed', {
            indexed: result.documentsIndexed,
            errors: result.errors.length,
            duration_ms: result.duration_ms,
          });
        } catch (error) {
          logger.error('Full ES sync failed:', error);
        }
      }, { timezone: 'UTC' })
    );
    
    // Hourly incremental sync
    this.jobs.push(
      cron.schedule('0 * * * *', async () => {
        logger.info('Starting scheduled incremental ES sync');
        try {
          const result = await syncService.syncIncremental();
          logger.info('Incremental ES sync completed', {
            indexed: result.documentsIndexed,
            duration_ms: result.duration_ms,
          });
        } catch (error) {
          logger.error('Incremental ES sync failed:', error);
        }
      })
    );
    
    // Weekly index optimization (Sunday 2 AM)
    this.jobs.push(
      cron.schedule('0 2 * * 0', async () => {
        logger.info('Starting weekly index optimization');
        try {
          // Refresh all indices
          await indexManager.refreshAllIndices();
          // Optionally force merge old indices
          logger.info('Index optimization completed');
        } catch (error) {
          logger.error('Index optimization failed:', error);
        }
      })
    );
    
    // Orphan cleanup (every Sunday at 4 AM)
    this.jobs.push(
      cron.schedule('0 4 * * 0', async () => {
        logger.info('Starting orphan cleanup');
        try {
          const result = await syncService.cleanupOrphans();
          logger.info('Orphan cleanup completed', { removed: result.removed });
        } catch (error) {
          logger.error('Orphan cleanup failed:', error);
        }
      })
    );
    
    logger.info('Cron jobs initialized');
  }
  
  stop(): void {
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
    logger.info('Cron jobs stopped');
  }
}

export const cronService = new CronService();
```

### Admin Routes (`server/routes/elasticsearch-admin.routes.ts`)
```typescript
import { Router } from 'express';
import { syncService } from '../services/elasticsearch-sync.service';
import { indexManager } from '../elasticsearch/indices/index-manager';
import { isSuperAdmin } from '../auth';

const router = Router();

// Get sync status
router.get('/api/admin/elasticsearch/sync-status', isSuperAdmin, async (req, res) => {
  const status = syncService.getStatus();
  res.json(status);
});

// Trigger full reindex
router.post('/api/admin/elasticsearch/reindex', isSuperAdmin, async (req, res) => {
  try {
    // Don't wait for completion - return immediately
    syncService.reindexAll().then(result => {
      logger.info('Full reindex completed', result);
    });
    
    res.json({ message: 'Reindex started', status: 'in-progress' });
  } catch (error) {
    if ((error as Error).message === 'Sync already in progress') {
      return res.status(409).json({ error: 'Sync already in progress' });
    }
    throw error;
  }
});

// Trigger incremental sync
router.post('/api/admin/elasticsearch/sync', isSuperAdmin, async (req, res) => {
  try {
    const result = await syncService.syncIncremental();
    res.json(result);
  } catch (error) {
    if ((error as Error).message === 'Sync already in progress') {
      return res.status(409).json({ error: 'Sync already in progress' });
    }
    throw error;
  }
});

// Reindex specific entity
router.post('/api/admin/elasticsearch/reindex/:entity', isSuperAdmin, async (req, res) => {
  const { entity } = req.params;
  
  try {
    const result = await syncService.reindexEntity(entity);
    res.json(result);
  } catch (error) {
    if ((error as Error).message.includes('Unknown entity')) {
      return res.status(400).json({ error: (error as Error).message });
    }
    throw error;
  }
});

// Orphan cleanup
router.post('/api/admin/elasticsearch/cleanup', isSuperAdmin, async (req, res) => {
  const result = await syncService.cleanupOrphans();
  res.json(result);
});

// Get index stats
router.get('/api/admin/elasticsearch/indices', isSuperAdmin, async (req, res) => {
  const stats = await indexManager.getIndexStats();
  res.json(stats);
});

// Recreate index (WARNING: deletes all data in that index)
router.post('/api/admin/elasticsearch/indices/:index/recreate', isSuperAdmin, async (req, res) => {
  const { index } = req.params;
  const { confirm } = req.body;
  
  if (confirm !== 'DELETE_ALL_DATA') {
    return res.status(400).json({ 
      error: 'Must confirm with body: { confirm: "DELETE_ALL_DATA" }' 
    });
  }
  
  try {
    await indexManager.recreateIndex(index);
    res.json({ message: `Index ${index} recreated` });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
```

### NPM Package Requirements
```bash
npm install node-cron
npm install --save-dev @types/node-cron
```

---

## Files to Create
- `server/services/cron.service.ts` - Cron job scheduler
- `server/services/elasticsearch-sync.service.ts` - Sync operations
- `server/routes/elasticsearch-admin.routes.ts` - Admin API endpoints

## Files to Modify
- `server/index.ts` - Initialize cron service on startup
- `server/routes.ts` - Register admin routes
- `package.json` - Add node-cron dependency

## Server Integration
```typescript
// In server/index.ts
import { cronService } from './services/cron.service';

// After server starts
cronService.initialize();

// On shutdown
process.on('SIGTERM', () => {
  cronService.stop();
});
```

## Acceptance Criteria
- [ ] Daily sync runs automatically at 3 AM GST
- [ ] Incremental sync only processes changed records
- [ ] Admin can trigger manual reindex via API
- [ ] Sync status visible via API endpoint
- [ ] Bulk operations process in batches (500 docs)
- [ ] Orphan cleanup removes stale ES documents
- [ ] Index recreation requires explicit confirmation
- [ ] Sync prevents concurrent runs
- [ ] Progress tracking during sync

## Monitoring & Alerting
- Log sync results for monitoring
- Track sync duration trends
- Alert if sync fails repeatedly
- Alert if orphan count exceeds threshold

## Dependencies
- Task 05: Real-time Indexing
