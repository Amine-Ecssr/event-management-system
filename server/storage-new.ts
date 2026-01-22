/**
 * Storage Module
 * 
 * This file re-exports the storage functionality from the refactored repositories.
 * The monolithic storage.ts has been split into domain-specific repositories:
 * 
 * Repository Files (kebab-case naming):
 * - user-repository.ts       - User CRUD operations
 * - event-repository.ts      - Event CRUD operations
 * - category-repository.ts   - Category management
 * - settings-repository.ts   - Application settings
 * - reminder-repository.ts   - Reminder queue operations
 * - update-repository.ts     - Weekly/monthly updates
 * - department-repository.ts - Departments, stakeholders, requirements
 * - task-repository.ts       - Task management and comments
 * - archive-repository.ts    - Archived events management
 * - media-repository.ts      - Event media operations
 * - contact-repository.ts    - Contacts, organizations, speakers
 * - invitation-repository.ts - Event invitations and email templates
 * - workflow-repository.ts   - Task workflows and prerequisites
 * - partnership-repository.ts - Partnership management
 * - lead-repository.ts       - Lead management and CRM
 * - auth-repository.ts       - Keycloak authentication
 * 
 * The Storage facade class in repositories/index.ts composes all repositories
 * and provides a unified interface matching the original IStorage interface.
 */

// Re-export everything from the refactored storage module
export { storage, sessionStore, Storage } from './repositories';

// Re-export types for backwards compatibility
export type { IStorage } from './repositories/types';
