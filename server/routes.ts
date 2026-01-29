/**
 * Routes
 *
 * Central router that mounts all domain-specific route modules.
 * Each route module is self-contained and follows kebab-case naming.
 *
 * @module routes
 */

import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";

// Import all route modules
import eventRoutes from "./routes/event.routes";
import eventFileRoutes from "./routes/event-files.routes";
import categoryRoutes from "./routes/category.routes";
import healthRoutes from "./routes/health.routes";
import organizationRoutes from "./routes/organization.routes";
import stakeholderRoutes from "./routes/stakeholder.routes";
import taskRoutes from "./routes/task.routes";
import archiveRoutes from "./routes/archive.routes";
import settingsRoutes from "./routes/settings.routes";
import adminRoutes from "./routes/admin.routes";
import partnershipRoutes from "./routes/partnership.routes";
import leadRoutes from "./routes/lead.routes";
import integrationRoutes from "./routes/integration.routes";
import invitationRoutes from "./routes/invitation.routes";
import workflowRoutes from "./routes/workflow.routes";
import permissionRoutes from "./routes/permission.routes";
import elasticsearchHealthRoutes from "./routes/elasticsearch-health.routes";
import elasticsearchAdminRoutes from "./routes/elasticsearch-admin.routes";
import searchRoutes from "./routes/search.routes";
import suggestRoutes from "./routes/suggest.routes";
import analyticsRoutes from "./routes/analytics.routes";
import eventsAnalyticsRoutes from "./routes/events-analytics.routes";
import partnershipsAnalyticsRoutes from "./routes/partnerships-analytics.routes";
import tasksAnalyticsRoutes from "./routes/tasks-analytics.routes";
import contactsAnalyticsRoutes from "./routes/contacts-analytics.routes";
import exportRoutes from "./routes/export.routes";
import aiRoutes from "./routes/ai.routes";

/**
 * Register all routes on the Express application
 *
 * @param app - Express application instance
 * @returns HTTP server instance
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);

  // ==================== Mount Route Modules ====================

  // Health & system routes
  app.use(healthRoutes);
  app.use(elasticsearchHealthRoutes);
  app.use(elasticsearchAdminRoutes);
  app.use(searchRoutes);
  app.use(suggestRoutes);
  app.use(analyticsRoutes);
  app.use(eventsAnalyticsRoutes);
  app.use(partnershipsAnalyticsRoutes);
  app.use(tasksAnalyticsRoutes);
  app.use(contactsAnalyticsRoutes);
  app.use(exportRoutes);
  app.use(aiRoutes);

  // Event management
  app.use(eventRoutes);
  app.use("/api", eventFileRoutes);
  app.use(categoryRoutes);

  // Organization & contacts
  app.use(organizationRoutes);

  // Stakeholder (department) management
  app.use(stakeholderRoutes);

  // Task management
  app.use(taskRoutes);

  // Archive management
  app.use(archiveRoutes);

  // Settings & configuration
  app.use(settingsRoutes);

  // Admin operations
  app.use(adminRoutes);

  // Partnership management
  app.use(partnershipRoutes);

  // Lead management
  app.use(leadRoutes);

  // External integrations (scraper, reminders, updates)
  app.use(integrationRoutes);

  // Invitation & attendee management
  app.use(invitationRoutes);

  // Workflow management
  app.use(workflowRoutes);
  app.use(permissionRoutes);

  // Create and return HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
