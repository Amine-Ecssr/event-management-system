/**
 * Routes Index
 *
 * Central barrel file that exports all route modules.
 * Each route module follows kebab-case naming and is organized by domain.
 *
 * @module routes
 */

// System routes
export { default as healthRoutes } from './health.routes';

// Event-related routes
export { default as eventRoutes } from './event.routes';
export { default as eventFileRoutes } from './event-files.routes';
export { default as categoryRoutes } from './category.routes';

// Organization and contact routes
export { default as organizationRoutes } from './organization.routes';

// Stakeholder (department) routes
export { default as stakeholderRoutes } from './stakeholder.routes';

// Task management routes
export { default as taskRoutes } from './task.routes';

// Workflow management routes
export { default as workflowRoutes } from './workflow.routes';

// Archive routes
export { default as archiveRoutes } from './archive.routes';

// Settings routes
export { default as settingsRoutes } from './settings.routes';

// Admin routes
export { default as adminRoutes } from './admin.routes';

// Partnership management routes
export { default as partnershipRoutes } from './partnership.routes';

// Lead management routes
export { default as leadRoutes } from './lead.routes';

// Integration routes (scraper, reminders, updates, invitation jobs)
export { default as integrationRoutes } from './integration.routes';

// Invitation routes (attendees, invitees, invitation emails)
export { default as invitationRoutes } from './invitation.routes';

// Permission management routes
export { default as permissionRoutes } from './permission.routes';
