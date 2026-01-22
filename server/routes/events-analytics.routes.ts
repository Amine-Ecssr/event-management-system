/**
 * Events Analytics Routes
 * 
 * API endpoints for events analytics data.
 * 
 * @module routes/events-analytics.routes
 */

import { Router } from 'express';
import { eventsAnalyticsService } from '../services/events-analytics.service.js';
import { isAuthenticated } from '../auth';

const router = Router();

/**
 * GET /api/analytics/events
 * Get comprehensive events analytics data
 */
router.get('/api/analytics/events/dashboard', isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate, scope } = req.query;

    const data = await eventsAnalyticsService.getEventsAnalytics(
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined,
      scope ? String(scope) : undefined
    );

    res.json(data);
  } catch (error) {
    console.error('Events analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch events analytics' });
  }
});

/**
 * GET /api/analytics/events/heatmap
 * Get calendar heatmap data for a specific year
 */
router.get('/api/analytics/events/heatmap', isAuthenticated, async (req, res) => {
  try {
    const { year, scope } = req.query;
    const selectedYear = Number(year) || new Date().getFullYear();
    const startDate = new Date(selectedYear, 0, 1);
    const endDate = new Date(selectedYear, 11, 31);

    const data = await eventsAnalyticsService.getEventsAnalytics(
      startDate,
      endDate,
      scope ? String(scope) : undefined
    );

    res.json(data.calendarHeatmap);
  } catch (error) {
    console.error('Heatmap error:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

/**
 * GET /api/analytics/events/timeline
 * Get event timeline data
 */
router.get('/api/analytics/events/timeline', isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate, scope } = req.query;

    const data = await eventsAnalyticsService.getEventsAnalytics(
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined,
      scope ? String(scope) : undefined
    );

    res.json(data.timeline);
  } catch (error) {
    console.error('Timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch timeline data' });
  }
});

/**
 * GET /api/analytics/events/summary
 * Get events summary stats
 */
router.get('/api/analytics/events/summary', isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate, scope } = req.query;

    const data = await eventsAnalyticsService.getEventsAnalytics(
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined,
      scope ? String(scope) : undefined
    );

    res.json(data.summary);
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary data' });
  }
});

/**
 * GET /api/analytics/events/scopes
 * Get scope comparison for events (internal vs external)
 */
router.get('/api/analytics/events/scopes', isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const data = await eventsAnalyticsService.getEventsAnalytics(
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined
    );

    res.json(data.scopeComparison);
  } catch (error) {
    console.error('Scope comparison error:', error);
    res.status(500).json({ error: 'Failed to fetch scope comparison data' });
  }
});

export default router;
