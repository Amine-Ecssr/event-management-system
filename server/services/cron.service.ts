/**
 * Cron Service
 * 
 * Manages scheduled background jobs for Elasticsearch synchronization,
 * index optimization, and orphan cleanup.
 * 
 * Schedule (GST = UTC+4):
 * - Daily full sync: 3 AM GST (11 PM UTC previous day)
 * - Hourly incremental sync: Every hour at :00
 * - Weekly index optimization: Sunday 2 AM GST (Saturday 10 PM UTC)
 * - Weekly orphan cleanup: Sunday 4 AM GST (Sunday 12 AM UTC)
 * 
 * @module services/cron
 */

import cron, { ScheduledTask } from 'node-cron';
import { syncService } from './elasticsearch-sync.service';
import { indexManager } from '../elasticsearch/indices/index-manager';
import { isElasticsearchEnabled } from '../elasticsearch/client';

// Logger
const logger = {
  info: (...args: any[]) => console.log('[Cron]', ...args),
  warn: (...args: any[]) => console.warn('[Cron]', ...args),
  error: (...args: any[]) => console.error('[Cron]', ...args),
};

export class CronService {
  private jobs: ScheduledTask[] = [];
  private isInitialized = false;
  
  /**
   * Initialize all cron jobs
   */
  initialize(): void {
    if (this.isInitialized) {
      logger.warn('Cron jobs already initialized');
      return;
    }
    
    if (!isElasticsearchEnabled()) {
      logger.info('Elasticsearch not enabled - skipping cron job initialization');
      return;
    }
    
    // Daily full sync at 3 AM GST (11 PM UTC previous day)
    this.jobs.push(
      cron.schedule('0 23 * * *', async () => {
        logger.info('Starting scheduled full ES sync (daily)');
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
        logger.info('Starting scheduled incremental ES sync (hourly)');
        try {
          const result = await syncService.syncIncremental();
          if (result.documentsIndexed > 0) {
            logger.info('Incremental ES sync completed', {
              indexed: result.documentsIndexed,
              duration_ms: result.duration_ms,
            });
          }
        } catch (error) {
          if ((error as Error).message === 'Sync already in progress') {
            logger.warn('Skipping incremental sync - sync already in progress');
          } else {
            logger.error('Incremental ES sync failed:', error);
          }
        }
      })
    );
    
    // Weekly index optimization (Sunday 2 AM GST = Saturday 10 PM UTC)
    this.jobs.push(
      cron.schedule('0 22 * * 6', async () => {
        logger.info('Starting weekly index optimization');
        try {
          await indexManager.refreshAllIndices();
          logger.info('Index optimization completed');
        } catch (error) {
          logger.error('Index optimization failed:', error);
        }
      }, { timezone: 'UTC' })
    );
    
    // Weekly orphan cleanup (Sunday 4 AM GST = Sunday 12 AM UTC)
    this.jobs.push(
      cron.schedule('0 0 * * 0', async () => {
        logger.info('Starting weekly orphan cleanup');
        try {
          const result = await syncService.cleanupOrphans();
          logger.info('Orphan cleanup completed', { 
            removed: result.removed,
            errors: result.errors.length,
          });
        } catch (error) {
          logger.error('Orphan cleanup failed:', error);
        }
      }, { timezone: 'UTC' })
    );
    
    this.isInitialized = true;
    logger.info('Cron jobs initialized successfully', {
      jobs: this.jobs.length,
      schedule: {
        fullSync: 'Daily at 11 PM UTC (3 AM GST)',
        incrementalSync: 'Every hour at :00',
        indexOptimization: 'Saturday at 10 PM UTC (Sunday 2 AM GST)',
        orphanCleanup: 'Sunday at 12 AM UTC (Sunday 4 AM GST)',
      },
    });
  }
  
  /**
   * Stop all cron jobs
   */
  stop(): void {
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
    this.isInitialized = false;
    logger.info('Cron jobs stopped');
  }
  
  /**
   * Get cron job status
   */
  getStatus(): { initialized: boolean; jobCount: number } {
    return {
      initialized: this.isInitialized,
      jobCount: this.jobs.length,
    };
  }
}

// Singleton instance
export const cronService = new CronService();
