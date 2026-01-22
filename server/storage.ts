/**
 * Storage Module
 *
 * This file re-exports the Storage facade from the repositories module.
 * All storage operations are now implemented in domain-specific repository files
 * under the /repositories directory.
 *
 * @module storage
 * @see /repositories/index.ts - Main Storage facade
 * @see /repositories/base.ts - Base repository class
 */

export { storage, sessionStore, Storage, type IStorage } from './repositories';
