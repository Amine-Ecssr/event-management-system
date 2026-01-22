/**
 * Health and Dashboard Routes
 *
 * API endpoints for system health checks and dashboard statistics:
 * - GET /api/health - Health check endpoint for Docker/monitoring
 * - GET /api/dashboard/stats - Dashboard statistics (public and authenticated)
 *
 * @module routes/health
 */

import { Router } from "express";
import { storage } from "../storage";
import type { Event } from "@shared/schema";

const router = Router();

// ==================== Health Routes ====================

/**
 * GET /api/health
 * Health check endpoint for Docker and monitoring systems
 */
router.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics (public and authenticated)
 * Public users see basic event stats, authenticated users see tasks stats
 */
router.get("/api/dashboard/stats", async (req, res) => {
  try {
    const user = req.user;
    const settings = await storage.getSettings();

    // Get all events
    let allEvents = await storage.getAllEvents();

    // Filter out scraped events if the setting is disabled
    if (!settings.scrapedEventsEnabled) {
      allEvents = allEvents.filter(event => !event.isScraped);
    }

    // Calculate upcoming events (events that haven't ended yet)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingEvents = allEvents.filter(event => {
      const endDate = new Date(event.endDate);
      return endDate >= today;
    });

    // Calculate events by category
    const eventsByCategory: Record<string, number> = {};
    allEvents.forEach(event => {
      const categoryName = event.category || 'Uncategorized';
      eventsByCategory[categoryName] = (eventsByCategory[categoryName] || 0) + 1;
    });

    interface DashboardStatsResponse {
      totalEvents: number;
      upcomingEvents: number;
      eventsByCategory: Record<string, number>;
      totalTasks?: number;
      pendingTasks?: number;
      completedTasks?: number;
      totalStakeholders?: number;
    }

    const stats: DashboardStatsResponse = {
      totalEvents: allEvents.length,
      upcomingEvents: upcomingEvents.length,
      eventsByCategory,
    };

    // Add authenticated user stats
    if (user) {
      try {
        // Get total tasks count
        const allTasksData = await storage.getAllTasksForAdminDashboard();
        const allTasks = allTasksData.map((t: { task: any; eventDepartment?: any; department?: any; event?: Event }) => t.task);
        stats.totalTasks = allTasks.length;
        stats.pendingTasks = allTasks.filter((t: { status: string }) => t.status === 'pending').length;
        stats.completedTasks = allTasks.filter((t: { status: string }) => t.status === 'completed').length;

        // Get total stakeholders/departments count
        const departments = await storage.getAllDepartments();
        stats.totalStakeholders = departments.length;
      } catch (error) {
        console.error('[Dashboard Stats] Error fetching authenticated stats:', error);
      }
    }

    res.json(stats);
  } catch (error) {
    console.error('[Dashboard Stats] Error:', error);
    res.status(500).json({ error: "Failed to fetch dashboard statistics" });
  }
});

export default router;
