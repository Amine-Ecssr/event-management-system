/**
 * Elasticsearch Type Definitions
 * 
 * TypeScript interfaces for ES operations across the application
 */

import { buildIndexName, ES_ENTITIES, ESEntityType } from './config';

// Entity to index name mapping - dynamically built from config
export const ENTITY_INDEX_MAP = {
  events: buildIndexName(ES_ENTITIES.EVENTS),
  archivedEvents: buildIndexName(ES_ENTITIES.ARCHIVED_EVENTS),
  tasks: buildIndexName(ES_ENTITIES.TASKS),
  contacts: buildIndexName(ES_ENTITIES.CONTACTS),
  organizations: buildIndexName(ES_ENTITIES.ORGANIZATIONS),
  partnerships: buildIndexName(ES_ENTITIES.PARTNERSHIPS),
  agreements: buildIndexName(ES_ENTITIES.AGREEMENTS),
  leads: buildIndexName(ES_ENTITIES.LEADS),
  departments: buildIndexName(ES_ENTITIES.DEPARTMENTS),
  attendees: buildIndexName(ES_ENTITIES.ATTENDEES),
  invitees: buildIndexName(ES_ENTITIES.INVITEES),
  leadInteractions: buildIndexName(ES_ENTITIES.LEAD_INTERACTIONS),
  partnershipActivities: buildIndexName(ES_ENTITIES.PARTNERSHIP_ACTIVITIES),
  partnershipInteractions: buildIndexName(ES_ENTITIES.PARTNERSHIP_INTERACTIONS),
  updates: buildIndexName(ES_ENTITIES.UPDATES),
} as const;

export type EntityIndexMapKey = keyof typeof ENTITY_INDEX_MAP;

// Get index name for an entity type
export function getIndexName(entityType: EntityIndexMapKey): string {
  return ENTITY_INDEX_MAP[entityType];
}

// Single index result
export interface IndexResult {
  _id: string;
  _index: string;
  _version?: number;
  result: 'created' | 'updated' | 'deleted' | 'noop';
}

// Bulk operation result
export interface BulkIndexResult {
  indexed: number;
  updated: number;
  failed: number;
  took_ms: number;
  errors: Array<{
    id: string;
    index?: string;
    type?: string;
    error: any;
  }>;
}

// Search result wrapper
export interface SearchResult<T> {
  hits: Array<{
    _id: string;
    _score: number;
    _source: T;
    highlight?: Record<string, string[]>;
  }>;
  total: number;
  took: number;
  max_score: number | null;
}

// Aggregation bucket
export interface AggregationBucket {
  key: string | number;
  doc_count: number;
  [key: string]: any;
}

// Aggregation result
export interface AggregationResult {
  buckets: AggregationBucket[];
  doc_count_error_upper_bound?: number;
  sum_other_doc_count?: number;
}

// Search options
export interface SearchOptions {
  query?: string;
  filters?: Record<string, any>;
  sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
  from?: number;
  size?: number;
  highlight?: boolean;
  aggregations?: Record<string, any>;
}

// Index document options
export interface IndexDocumentOptions {
  refresh?: boolean | 'wait_for';
  routing?: string;
}

// Bulk operation item
export interface BulkOperation<T = any> {
  action: 'index' | 'update' | 'delete';
  id: string;
  document?: T;
  routing?: string;
}

// Date range filter
export interface DateRangeFilter {
  field: string;
  gte?: string | Date;
  lte?: string | Date;
  format?: string;
}

// Term filter
export interface TermFilter {
  field: string;
  value: string | number | boolean;
}

// Range filter
export interface RangeFilter {
  field: string;
  gte?: number;
  lte?: number;
  gt?: number;
  lt?: number;
}

// Geo distance filter
export interface GeoDistanceFilter {
  field: string;
  lat: number;
  lon: number;
  distance: string;
}

// Sort options
export type SortOrder = 'asc' | 'desc';

export interface SortOption {
  field: string;
  order: SortOrder;
  mode?: 'min' | 'max' | 'sum' | 'avg' | 'median';
  nested?: {
    path: string;
    filter?: any;
  };
}

// Suggest options for autocomplete
export interface SuggestOptions {
  field: string;
  prefix: string;
  size?: number;
  fuzzy?: {
    fuzziness: number | 'AUTO';
    prefix_length?: number;
  };
}

// Suggest result
export interface SuggestResult {
  text: string;
  score: number;
  payload?: Record<string, any>;
}

// Index mapping field types
export type ESFieldType = 
  | 'text'
  | 'keyword'
  | 'long'
  | 'integer'
  | 'short'
  | 'byte'
  | 'double'
  | 'float'
  | 'half_float'
  | 'scaled_float'
  | 'date'
  | 'boolean'
  | 'binary'
  | 'integer_range'
  | 'float_range'
  | 'long_range'
  | 'double_range'
  | 'date_range'
  | 'object'
  | 'nested'
  | 'geo_point'
  | 'geo_shape'
  | 'completion'
  | 'search_as_you_type';

// Field mapping definition
export interface ESFieldMapping {
  type: ESFieldType;
  analyzer?: string;
  search_analyzer?: string;
  fields?: Record<string, ESFieldMapping>;
  properties?: Record<string, ESFieldMapping>;
  copy_to?: string | string[];
  index?: boolean;
  store?: boolean;
  doc_values?: boolean;
  null_value?: any;
  boost?: number;
  format?: string;
  locale?: string;
  ignore_malformed?: boolean;
  coerce?: boolean;
  max_input_length?: number;
  preserve_separators?: boolean;
  preserve_position_increments?: boolean;
  contexts?: Array<{
    name: string;
    type: 'category' | 'geo';
    path?: string;
    precision?: number;
  }>;
}

// Index settings
export interface ESIndexSettings {
  number_of_shards?: number;
  number_of_replicas?: number;
  refresh_interval?: string;
  max_result_window?: number;
  analysis?: {
    analyzer?: Record<string, any>;
    tokenizer?: Record<string, any>;
    filter?: Record<string, any>;
    char_filter?: Record<string, any>;
    normalizer?: Record<string, any>;
  };
}

// Index definition
export interface ESIndexDefinition {
  settings: ESIndexSettings;
  mappings: {
    properties: Record<string, ESFieldMapping>;
    _source?: {
      enabled?: boolean;
      includes?: string[];
      excludes?: string[];
    };
    dynamic?: 'strict' | 'true' | 'false';
  };
}

// Re-export health types from client
export type { ESHealthResponse, ESIndexStats } from './client';
// ==================== Sync Types ====================

// Sync error record
export interface SyncError {
  entity: string;
  id: string;
  error: string;
  timestamp: Date;
}

// Sync result
export interface SyncResult {
  success: boolean;
  documentsIndexed: number;
  documentsDeleted: number;
  errors: SyncError[];
  duration_ms: number;
  entity?: string;
}

// Sync status
export interface SyncStatus {
  lastSyncAt: Date | null;
  lastFullSyncAt: Date | null;
  documentsIndexed: number;
  documentsDeleted: number;
  errors: number;
  inProgress: boolean;
  currentEntity: string | null;
  progress: number;
}