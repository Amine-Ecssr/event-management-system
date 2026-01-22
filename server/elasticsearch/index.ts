/**
 * Elasticsearch Module Index
 * 
 * Re-exports all ES functionality for easy importing
 */

// Configuration
export { 
  ES_INDEX_PREFIX,
  ES_INDEX_SUFFIX,
  ES_ENTITIES,
  ES_CONFIG,
  buildIndexName,
  buildAliasName,
  getAllIndexNames,
  type ESEntityType,
} from './config';

// Client
export {
  getElasticsearchClient,
  getOptionalElasticsearchClient,
  closeElasticsearchClient,
  resetElasticsearchClient,
  checkElasticsearchHealth,
  getIndexStats,
  waitForElasticsearch,
  setupElasticsearchShutdown,
  initializeElasticsearch,
  isElasticsearchEnabled,
  type ESHealthResponse,
  type ESIndexStats,
} from './client';

// Analyzers
export {
  ANALYZER_SETTINGS,
  FIELD_MAPPINGS,
  COMMON_INDEX_SETTINGS,
  PRODUCTION_INDEX_SETTINGS,
  getIndexSettings,
  mergeFieldMappings,
} from './analyzers';

// Index Manager
export {
  IndexManager,
  indexManager,
  getIndexDefinitions,
  getCachedIndexDefinitions,
  type IndexDefinition,
  type IndexStats,
} from './indices';

// Mappings
export * from './mappings';

// Types
export * from './types';
