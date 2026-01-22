/**
 * Indices Module Index
 * 
 * Re-exports index management functionality.
 * 
 * @module elasticsearch/indices
 */

export {
  IndexManager,
  indexManager,
  getIndexDefinitions,
  getCachedIndexDefinitions,
  type IndexDefinition,
  type IndexStats,
} from './index-manager';
