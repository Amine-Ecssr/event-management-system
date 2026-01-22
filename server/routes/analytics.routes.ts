/**
 * Analytics Routes
 * 
 * API endpoints for analytics aggregations powered by Elasticsearch.
 * 
 * @module routes/analytics.routes
 */

import { Router, Request, Response } from 'express';
import { aggregationsService } from '../services/elasticsearch-aggregations.service';
import { isAuthenticated, isSuperAdmin } from '../auth';
import type { TrendPeriod } from '../elasticsearch/types/aggregations.types';

const router = Router();

// ============ EVENT ANALYTICS ============

/**
 * Get events grouped by category
 */
router.get('/api/analytics/events/by-category', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const departmentId = req.query.departmentId ? parseInt(req.query.departmentId as string) : undefined;
    
    const result = await aggregationsService.getEventsByCategory({ startDate, endDate, departmentId });
    res.json(result);
  } catch (error) {
    console.error('[Analytics] getEventsByCategory error:', error);
    res.status(500).json({ error: 'Failed to fetch event category stats' });
  }
});

/**
 * Get events grouped by type
 */
router.get('/api/analytics/events/by-type', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const departmentId = req.query.departmentId ? parseInt(req.query.departmentId as string) : undefined;
    
    const result = await aggregationsService.getEventsByType({ startDate, endDate, departmentId });
    res.json(result);
  } catch (error) {
    console.error('[Analytics] getEventsByType error:', error);
    res.status(500).json({ error: 'Failed to fetch event type stats' });
  }
});

/**
 * Get events grouped by month with year-over-year comparison
 */
router.get('/api/analytics/events/by-month', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const departmentId = req.query.departmentId ? parseInt(req.query.departmentId as string) : undefined;
    
    const result = await aggregationsService.getEventsByMonth(year, departmentId);
    res.json(result);
  } catch (error) {
    console.error('[Analytics] getEventsByMonth error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly event stats' });
  }
});

/**
 * Get event trends over time
 */
router.get('/api/analytics/events/trends', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as TrendPeriod) || 'month';
    const validPeriods: TrendPeriod[] = ['day', 'week', 'month', 'quarter', 'year'];
    
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Must be one of: day, week, month, quarter, year' });
    }
    
    const result = await aggregationsService.getEventTrends(period);
    res.json(result);
  } catch (error) {
    console.error('[Analytics] getEventTrends error:', error);
    res.status(500).json({ error: 'Failed to fetch event trends' });
  }
});

// ============ TASK ANALYTICS ============

/**
 * Get tasks grouped by status
 */
router.get('/api/analytics/tasks/by-status', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const departmentId = req.query.departmentId ? parseInt(req.query.departmentId as string) : undefined;
    
    const result = await aggregationsService.getTasksByStatus({ startDate, endDate, departmentId });
    res.json(result);
  } catch (error) {
    console.error('[Analytics] getTasksByStatus error:', error);
    res.status(500).json({ error: 'Failed to fetch task status stats' });
  }
});

/**
 * Get tasks grouped by priority
 */
router.get('/api/analytics/tasks/by-priority', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const departmentId = req.query.departmentId ? parseInt(req.query.departmentId as string) : undefined;
    
    const result = await aggregationsService.getTasksByPriority({ startDate, endDate, departmentId });
    res.json(result);
  } catch (error) {
    console.error('[Analytics] getTasksByPriority error:', error);
    res.status(500).json({ error: 'Failed to fetch task priority stats' });
  }
});

/**
 * Get tasks grouped by department with completion rates
 */
router.get('/api/analytics/tasks/by-department', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const result = await aggregationsService.getTasksByDepartment();
    res.json(result);
  } catch (error) {
    console.error('[Analytics] getTasksByDepartment error:', error);
    res.status(500).json({ error: 'Failed to fetch department task stats' });
  }
});

/**
 * Get task completion rate over time
 */
router.get('/api/analytics/tasks/completion-rate', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'month';
    const validPeriods = ['day', 'week', 'month'];
    
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Must be one of: day, week, month' });
    }
    
    const result = await aggregationsService.getTaskCompletionRate(period);
    res.json(result);
  } catch (error) {
    console.error('[Analytics] getTaskCompletionRate error:', error);
    res.status(500).json({ error: 'Failed to fetch completion rate' });
  }
});

/**
 * Get overdue task statistics
 */
router.get('/api/analytics/tasks/overdue', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const result = await aggregationsService.getOverdueTasks();
    res.json(result);
  } catch (error) {
    console.error('[Analytics] getOverdueTasks error:', error);
    res.status(500).json({ error: 'Failed to fetch overdue tasks' });
  }
});

// ============ PARTNERSHIP ANALYTICS ============

/**
 * Get partnerships grouped by status
 */
router.get('/api/analytics/partnerships/by-status', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const result = await aggregationsService.getPartnershipsByStatus();
    res.json(result);
  } catch (error) {
    console.error('[Analytics] getPartnershipsByStatus error:', error);
    res.status(500).json({ error: 'Failed to fetch partnership status stats' });
  }
});

/**
 * Get organizations grouped by country
 */
router.get('/api/analytics/partnerships/by-country', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const result = await aggregationsService.getOrganizationsByCountry();
    res.json(result);
  } catch (error) {
    console.error('[Analytics] getOrganizationsByCountry error:', error);
    res.status(500).json({ error: 'Failed to fetch country stats' });
  }
});

/**
 * Get organizations grouped by type
 */
router.get('/api/analytics/organizations/by-type', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const result = await aggregationsService.getOrganizationsByType();
    res.json(result);
  } catch (error) {
    console.error('[Analytics] getOrganizationsByType error:', error);
    res.status(500).json({ error: 'Failed to fetch organization type stats' });
  }
});

// ============ LEAD ANALYTICS ============

/**
 * Get leads grouped by stage
 */
router.get('/api/analytics/leads/by-stage', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const result = await aggregationsService.getLeadsByStage();
    res.json(result);
  } catch (error) {
    console.error('[Analytics] getLeadsByStage error:', error);
    res.status(500).json({ error: 'Failed to fetch lead stage stats' });
  }
});

// ============ OVERVIEW ANALYTICS ============

/**
 * Get overall activity trends across all entity types
 */
router.get('/api/analytics/overview/trends', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    
    if (days < 1 || days > 365) {
      return res.status(400).json({ error: 'Days must be between 1 and 365' });
    }
    
    const result = await aggregationsService.getOverallActivityTrends(days);
    res.json(result);
  } catch (error) {
    console.error('[Analytics] getOverallActivityTrends error:', error);
    res.status(500).json({ error: 'Failed to fetch activity trends' });
  }
});

/**
 * Get dashboard summary counts
 */
router.get('/api/analytics/dashboard/summary', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const result = await aggregationsService.getDashboardSummary();
    res.json(result);
  } catch (error) {
    console.error('[Analytics] getDashboardSummary error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

// ============ CACHE MANAGEMENT (ADMIN ONLY) ============

/**
 * Invalidate analytics cache
 */
router.post('/api/analytics/cache/invalidate', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { entity } = req.body;
    aggregationsService.invalidateCache(entity);
    res.json({ success: true, message: entity ? `Cache invalidated for ${entity}` : 'All cache invalidated' });
  } catch (error) {
    console.error('[Analytics] cache invalidation error:', error);
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

/**
 * Get cache statistics
 */
router.get('/api/analytics/cache/stats', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    const stats = aggregationsService.getCacheStats();
    res.json(stats);
  } catch (error) {
    console.error('[Analytics] get cache stats error:', error);
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

export default router;
