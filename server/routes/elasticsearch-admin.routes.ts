/**
 * Elasticsearch Admin Routes
 * 
 * Admin-only API endpoints for managing Elasticsearch synchronization,
 * index management, and monitoring.
 * 
 * @module routes/elasticsearch-admin
 */

import { Router, Request, Response, NextFunction } from 'express';
import { syncService } from '../services/elasticsearch-sync.service';
import { indexManager } from '../elasticsearch/indices/index-manager';
import { cronService } from '../services/cron.service';
import { isSuperAdmin } from '../auth';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import {
  events,
  archivedEvents,
  tasks,
  contacts,
  organizations,
  leads,
  leadInteractions,
  partnershipAgreements,
  partnershipActivities,
  partnershipInteractions,
  eventAttendees,
  eventInvitees,
  departments,
} from '@shared/schema';

const router = Router();

// Logger
const logger = {
  info: (...args: any[]) => console.log('[ES Admin]', ...args),
  error: (...args: any[]) => console.error('[ES Admin]', ...args),
};

// ==================== Data Quality Endpoints ====================

/**
 * Get PostgreSQL entity counts for data quality comparison
 * GET /api/admin/elasticsearch/pg-counts
 */
router.get('/api/admin/elasticsearch/pg-counts', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    // Get counts from all tables
    const [
      eventsCount,
      archivedEventsCount,
      tasksCount,
      contactsCount,
      organizationsCount,
      leadsCount,
      leadInteractionsCount,
      agreementsCount,
      activitiesCount,
      interactionsCount,
      attendeesCount,
      inviteesCount,
      departmentsCount,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(events),
      db.select({ count: sql<number>`count(*)` }).from(archivedEvents),
      db.select({ count: sql<number>`count(*)` }).from(tasks),
      db.select({ count: sql<number>`count(*)` }).from(contacts),
      db.select({ count: sql<number>`count(*)` }).from(organizations),
      db.select({ count: sql<number>`count(*)` }).from(leads),
      db.select({ count: sql<number>`count(*)` }).from(leadInteractions),
      db.select({ count: sql<number>`count(*)` }).from(partnershipAgreements),
      db.select({ count: sql<number>`count(*)` }).from(partnershipActivities),
      db.select({ count: sql<number>`count(*)` }).from(partnershipInteractions),
      db.select({ count: sql<number>`count(*)` }).from(eventAttendees),
      db.select({ count: sql<number>`count(*)` }).from(eventInvitees),
      db.select({ count: sql<number>`count(*)` }).from(departments),
    ]);

    // Count organizations that are partners vs non-partners
    const [partnersCount, nonPartnersCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(organizations).where(sql`is_partner = true`),
      db.select({ count: sql<number>`count(*)` }).from(organizations).where(sql`is_partner = false OR is_partner IS NULL`),
    ]);

    res.json({
      'Events': Number(eventsCount[0]?.count || 0),
      'Archived Events': Number(archivedEventsCount[0]?.count || 0),
      'Tasks': Number(tasksCount[0]?.count || 0),
      'Contacts': Number(contactsCount[0]?.count || 0),
      'Organizations': Number(nonPartnersCount[0]?.count || 0),
      'Partnerships': Number(partnersCount[0]?.count || 0),
      'Leads': Number(leadsCount[0]?.count || 0),
      'Lead Interactions': Number(leadInteractionsCount[0]?.count || 0),
      'Agreements': Number(agreementsCount[0]?.count || 0),
      'Partnership Activities': Number(activitiesCount[0]?.count || 0),
      'Partnership Interactions': Number(interactionsCount[0]?.count || 0),
      'Attendees': Number(attendeesCount[0]?.count || 0),
      'Invitees': Number(inviteesCount[0]?.count || 0),
      'Departments': Number(departmentsCount[0]?.count || 0),
    });
  } catch (error) {
    logger.error('Failed to get PostgreSQL counts:', error);
    res.status(500).json({ error: 'Failed to get PostgreSQL counts' });
  }
});

// ==================== Sync Endpoints ====================

/**
 * Get sync status
 * GET /api/admin/elasticsearch/sync-status
 */
router.get('/api/admin/elasticsearch/sync-status', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    const status = syncService.getStatus();
    const cronStatus = cronService.getStatus();
    
    res.json({
      sync: status,
      cron: cronStatus,
    });
  } catch (error) {
    logger.error('Failed to get sync status:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

/**
 * Trigger full reindex (async - returns immediately)
 * POST /api/admin/elasticsearch/reindex
 */
router.post('/api/admin/elasticsearch/reindex', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    // Don't wait for completion - return immediately
    syncService.reindexAll().then(result => {
      logger.info('Full reindex completed', {
        indexed: result.documentsIndexed,
        errors: result.errors.length,
        duration_ms: result.duration_ms,
      });
    }).catch(error => {
      logger.error('Full reindex failed:', error);
    });
    
    res.json({ 
      message: 'Reindex started', 
      status: 'in-progress',
      note: 'Check /api/admin/elasticsearch/sync-status for progress',
    });
  } catch (error) {
    if ((error as Error).message === 'Sync already in progress') {
      return res.status(409).json({ error: 'Sync already in progress' });
    }
    logger.error('Failed to start reindex:', error);
    res.status(500).json({ error: 'Failed to start reindex' });
  }
});

/**
 * Trigger incremental sync (waits for completion)
 * POST /api/admin/elasticsearch/sync
 */
router.post('/api/admin/elasticsearch/sync', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { since } = req.body;
    const sinceDate = since ? new Date(since) : undefined;
    
    const result = await syncService.syncIncremental(sinceDate);
    res.json(result);
  } catch (error) {
    if ((error as Error).message === 'Sync already in progress') {
      return res.status(409).json({ error: 'Sync already in progress' });
    }
    logger.error('Failed to run incremental sync:', error);
    res.status(500).json({ error: 'Failed to run incremental sync' });
  }
});

/**
 * Reindex specific entity type
 * POST /api/admin/elasticsearch/reindex/:entity
 */
router.post('/api/admin/elasticsearch/reindex/:entity', isSuperAdmin, async (req: Request, res: Response) => {
  const { entity } = req.params;
  
  try {
    const result = await syncService.reindexEntity(entity);
    res.json(result);
  } catch (error) {
    if ((error as Error).message.includes('Unknown entity')) {
      return res.status(400).json({ error: (error as Error).message });
    }
    logger.error(`Failed to reindex ${entity}:`, error);
    res.status(500).json({ error: `Failed to reindex ${entity}` });
  }
});

/**
 * Run orphan cleanup
 * POST /api/admin/elasticsearch/cleanup
 */
router.post('/api/admin/elasticsearch/cleanup', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    const result = await syncService.cleanupOrphans();
    res.json(result);
  } catch (error) {
    logger.error('Failed to run orphan cleanup:', error);
    res.status(500).json({ error: 'Failed to run orphan cleanup' });
  }
});

// ==================== Index Management Endpoints ====================

/**
 * Get all index stats
 * GET /api/admin/elasticsearch/indices
 */
router.get('/api/admin/elasticsearch/indices', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await indexManager.getIndexStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get index stats:', error);
    res.status(500).json({ error: 'Failed to get index stats' });
  }
});

/**
 * Refresh all indices
 * POST /api/admin/elasticsearch/indices/refresh
 */
router.post('/api/admin/elasticsearch/indices/refresh', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    await indexManager.refreshAllIndices();
    res.json({ message: 'All indices refreshed' });
  } catch (error) {
    logger.error('Failed to refresh indices:', error);
    res.status(500).json({ error: 'Failed to refresh indices' });
  }
});

/**
 * Recreate specific index (WARNING: deletes all data in that index)
 * POST /api/admin/elasticsearch/indices/:index/recreate
 * Body: { confirm: "DELETE_ALL_DATA" }
 */
router.post('/api/admin/elasticsearch/indices/:index/recreate', isSuperAdmin, async (req: Request, res: Response) => {
  const { index } = req.params;
  const { confirm } = req.body;
  
  if (confirm !== 'DELETE_ALL_DATA') {
    return res.status(400).json({ 
      error: 'Must confirm with body: { confirm: "DELETE_ALL_DATA" }',
    });
  }
  
  try {
    await indexManager.recreateIndex(index);
    res.json({ message: `Index ${index} recreated successfully` });
  } catch (error) {
    logger.error(`Failed to recreate index ${index}:`, error);
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * Create all indices (if they don't exist)
 * POST /api/admin/elasticsearch/indices/create-all
 */
router.post('/api/admin/elasticsearch/indices/create-all', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    await indexManager.createAllIndices();
    res.json({ message: 'All indices created' });
  } catch (error) {
    logger.error('Failed to create indices:', error);
    res.status(500).json({ error: 'Failed to create indices' });
  }
});

export default router;
