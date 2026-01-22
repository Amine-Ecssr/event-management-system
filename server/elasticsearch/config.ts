/**
 * Elasticsearch Configuration
 * 
 * Index names are configurable via environment variables:
 * - ES_INDEX_PREFIX: Base prefix for all indices (default: 'eventcal')
 * - ES_INDEX_SUFFIX: Environment suffix (default: 'dev' or 'prod' based on NODE_ENV)
 */

// Configurable index prefix - allows deployment customization
export const ES_INDEX_PREFIX = process.env.ES_INDEX_PREFIX || 'eventcal';

// Environment suffix for index names
export const ES_INDEX_SUFFIX = process.env.ES_INDEX_SUFFIX || 
  (process.env.NODE_ENV === 'production' ? 'prod' : 'dev');

// Build index name with prefix and suffix
export const buildIndexName = (entity: string): string => {
  return `${ES_INDEX_PREFIX}-${entity}-${ES_INDEX_SUFFIX}`;
};

// Build alias name (without suffix for cross-environment queries)
export const buildAliasName = (entity: string): string => {
  return `${ES_INDEX_PREFIX}-${entity}`;
};

// Entity type constants
export const ES_ENTITIES = {
  EVENTS: 'events',
  ARCHIVED_EVENTS: 'archived-events',
  TASKS: 'tasks',
  CONTACTS: 'contacts',
  ORGANIZATIONS: 'organizations',
  PARTNERSHIPS: 'partnerships',
  AGREEMENTS: 'agreements',
  LEADS: 'leads',
  DEPARTMENTS: 'departments',
  ATTENDEES: 'attendees',
  INVITEES: 'invitees',
  LEAD_INTERACTIONS: 'lead-interactions',
  PARTNERSHIP_ACTIVITIES: 'partnership-activities',
  PARTNERSHIP_INTERACTIONS: 'partnership-interactions',
  UPDATES: 'updates',
} as const;

export type ESEntityType = typeof ES_ENTITIES[keyof typeof ES_ENTITIES];

// Get all index names for initialization
export const getAllIndexNames = (): string[] => {
  return Object.values(ES_ENTITIES).map(entity => buildIndexName(entity));
};

// ES configuration object
export const ES_CONFIG = {
  // Serverless configuration (takes precedence)
  cloudId: process.env.ELASTICSEARCH_CLOUD_ID || '',
  apiKey: process.env.ELASTICSEARCH_API_KEY || '',
  
  // Traditional configuration (fallback)
  url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
  password: process.env.ELASTICSEARCH_PASSWORD || '',
  
  enabled: process.env.ELASTICSEARCH_ENABLED !== 'false',
  maxRetries: 5,
  requestTimeout: 30000,
};

// Detect if using serverless (Cloud ID + API Key)
export const isServerlessMode = (): boolean => {
  return !!(ES_CONFIG.cloudId && ES_CONFIG.apiKey);
};
