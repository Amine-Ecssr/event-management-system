/**
 * Storage Re-export
 * 
 * This file provides backward compatibility for the storage refactoring.
 * It re-exports the Storage facade and the IStorage interface.
 * 
 * After migrating all imports in the codebase:
 * - Update imports from './storage' to './repositories'
 * - Remove this file
 */

export { Storage, IStorage } from './index';
