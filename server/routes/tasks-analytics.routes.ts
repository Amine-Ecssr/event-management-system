/**
 * Tasks Analytics Routes
 * 
 * API endpoints for tasks analytics dashboard:
 * - GET /api/analytics/tasks - Full dashboard data
 * - GET /api/analytics/tasks/summary - Summary KPIs only
 * - GET /api/analytics/tasks/overdue - Overdue tasks list
 * - GET /api/analytics/tasks/departments - Department performance
 */

import { Router } from 'express';
import { tasksAnalyticsService } from '../services/tasks-analytics.service';
import { isAuthenticated, isAdminOrSuperAdmin } from '../auth';

const router = Router();

/**
 * GET /api/analytics/tasks
 * Get complete tasks analytics dashboard data
 * Access: Admin, Superadmin
 */
router.get('/api/analytics/tasks', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { startDate, endDate, departmentId } = req.query;

    const data = await tasksAnalyticsService.getTasksAnalytics(
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined,
      departmentId ? parseInt(String(departmentId)) : undefined
    );

    res.json(data);
  } catch (error) {
    console.error('Tasks analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks analytics' });
  }
});

/**
 * GET /api/analytics/tasks/summary
 * Get summary KPIs only (lightweight)
 * Access: Authenticated users
 */
router.get('/api/analytics/tasks/summary', isAuthenticated, async (req, res) => {
  try {
    const { departmentId } = req.query;
    const data = await tasksAnalyticsService.getTasksAnalytics(
      undefined,
      undefined,
      departmentId ? parseInt(String(departmentId)) : undefined
    );
    res.json(data.summary);
  } catch (error) {
    console.error('Tasks summary error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks summary' });
  }
});

/**
 * GET /api/analytics/tasks/overdue
 * Get overdue tasks list
 * Access: Authenticated users
 */
router.get('/api/analytics/tasks/overdue', isAuthenticated, async (req, res) => {
  try {
    const { departmentId } = req.query;
    const data = await tasksAnalyticsService.getTasksAnalytics(
      undefined,
      undefined,
      departmentId ? parseInt(String(departmentId)) : undefined
    );
    res.json(data.overdueTasks);
  } catch (error) {
    console.error('Overdue tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch overdue tasks' });
  }
});

/**
 * GET /api/analytics/tasks/departments
 * Get department performance metrics
 * Access: Authenticated users
 */
router.get('/api/analytics/tasks/departments', isAuthenticated, async (req, res) => {
  try {
    const data = await tasksAnalyticsService.getTasksAnalytics();
    res.json(data.departmentPerformance);
  } catch (error) {
    console.error('Department performance error:', error);
    res.status(500).json({ error: 'Failed to fetch department performance' });
  }
});

/**
 * GET /api/analytics/tasks/trends
 * Get monthly task trends
 * Access: Authenticated users
 */
router.get('/api/analytics/tasks/trends', isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate, departmentId } = req.query;
    
    const data = await tasksAnalyticsService.getTasksAnalytics(
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined,
      departmentId ? parseInt(String(departmentId)) : undefined
    );
    
    res.json(data.monthlyTrends);
  } catch (error) {
    console.error('Task trends error:', error);
    res.status(500).json({ error: 'Failed to fetch task trends' });
  }
});

/**
 * GET /api/analytics/tasks/workload
 * Get workload distribution across departments
 * Access: Authenticated users
 */
router.get('/api/analytics/tasks/workload', isAuthenticated, async (req, res) => {
  try {
    const data = await tasksAnalyticsService.getTasksAnalytics();
    res.json(data.workloadDistribution);
  } catch (error) {
    console.error('Workload distribution error:', error);
    res.status(500).json({ error: 'Failed to fetch workload distribution' });
  }
});

export default router;
