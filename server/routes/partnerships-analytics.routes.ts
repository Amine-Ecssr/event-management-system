/**
 * Partnerships Analytics Routes
 * 
 * API endpoints for partnerships analytics dashboard:
 * - GET /api/analytics/partnerships - Full dashboard data
 * - GET /api/analytics/partnerships/summary - Summary KPIs only
 * - GET /api/analytics/partnerships/pipeline - Pipeline/Kanban data
 * - GET /api/analytics/partnerships/renewals - Renewal calendar
 */

import { Router } from 'express';
import { partnershipsAnalyticsService } from '../services/partnerships-analytics.service';
import { isAuthenticated, isAdminOrSuperAdmin } from '../auth';

const router = Router();

/**
 * GET /api/analytics/partnerships
 * Get complete partnerships analytics dashboard data
 * Access: Admin, Superadmin
 */
router.get('/api/analytics/partnerships', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const data = await partnershipsAnalyticsService.getPartnershipsAnalytics(
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined
    );

    res.json(data);
  } catch (error) {
    console.error('Partnerships analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch partnerships analytics' });
  }
});

/**
 * GET /api/analytics/partnerships/summary
 * Get summary KPIs only (lightweight)
 * Access: Authenticated users
 */
router.get('/api/analytics/partnerships/summary', isAuthenticated, async (req, res) => {
  try {
    const data = await partnershipsAnalyticsService.getPartnershipsAnalytics();
    res.json(data.summary);
  } catch (error) {
    console.error('Partnerships summary error:', error);
    res.status(500).json({ error: 'Failed to fetch partnerships summary' });
  }
});

/**
 * GET /api/analytics/partnerships/pipeline
 * Get pipeline/Kanban data
 * Access: Authenticated users
 */
router.get('/api/analytics/partnerships/pipeline', isAuthenticated, async (req, res) => {
  try {
    const data = await partnershipsAnalyticsService.getPartnershipsAnalytics();
    res.json(data.pipeline);
  } catch (error) {
    console.error('Pipeline error:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline data' });
  }
});

/**
 * GET /api/analytics/partnerships/renewals
 * Get renewal calendar
 * Access: Authenticated users
 */
router.get('/api/analytics/partnerships/renewals', isAuthenticated, async (req, res) => {
  try {
    const data = await partnershipsAnalyticsService.getPartnershipsAnalytics();
    res.json(data.renewalCalendar);
  } catch (error) {
    console.error('Renewals error:', error);
    res.status(500).json({ error: 'Failed to fetch renewal calendar' });
  }
});

/**
 * GET /api/analytics/partnerships/performance
 * Get partner performance rankings
 * Access: Authenticated users
 */
router.get('/api/analytics/partnerships/performance', isAuthenticated, async (req, res) => {
  try {
    const data = await partnershipsAnalyticsService.getPartnershipsAnalytics();
    res.json(data.partnerPerformance);
  } catch (error) {
    console.error('Partner performance error:', error);
    res.status(500).json({ error: 'Failed to fetch partner performance' });
  }
});

/**
 * GET /api/analytics/partnerships/trends
 * Get monthly trends data
 * Access: Authenticated users
 */
router.get('/api/analytics/partnerships/trends', isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const data = await partnershipsAnalyticsService.getPartnershipsAnalytics(
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined
    );
    
    res.json(data.monthlyTrends);
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({ error: 'Failed to fetch partnership trends' });
  }
});

export default router;
