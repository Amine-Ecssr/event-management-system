/**
 * Search Types for Elasticsearch
 * 
 * Type definitions for search queries, results, filters, and aggregations.
 * Used by the search service to provide type-safe search operations.
 * 
 * @module elasticsearch/types/search
 */

/**
 * Entity types that can be searched
 */
export type EntityType = 
  | 'events' 
  | 'archived-events'
  | 'tasks' 
  | 'contacts' 
  | 'organizations' 
  | 'leads' 
  | 'agreements' 
  | 'attendees' 
  | 'invitees'
  | 'departments'
  | 'partnerships'
  | 'updates'
  | 'lead-interactions'
  | 'partnership-activities'
  | 'partnership-interactions';

/**
 * Main search query interface
 */
export interface SearchQuery {
  /** Search query string */
  q: string;
  /** Filter by entity types (empty = search all) */
  entities?: EntityType[];
  /** Field-specific filters */
  filters?: SearchFilters;
  /** Sorting configuration */
  sort?: SortOptions;
  /** Pagination options */
  pagination?: PaginationOptions;
  /** Enable result highlighting (default: true) */
  highlight?: boolean;
  /** Enable fuzzy matching for typos (default: true) */
  fuzzy?: boolean;
  /** Include aggregations in response (default: false) */
  includeAggregations?: boolean;
}

/**
 * Search filters for narrowing results
 */
export interface SearchFilters {
  // Event filters
  eventType?: string[];
  eventScope?: string[];
  category?: string[];
  dateRange?: { start?: Date; end?: Date };
  isArchived?: boolean;
  
  // Task filters
  status?: string[];
  priority?: string[];
  assigneeId?: number[];
  
  // Contact filters
  organizationId?: number[];
  organizationName?: string[];  // Filter by organization name (from aggregations)
  isEligibleSpeaker?: boolean;
  
  // Organization filters
  countryId?: number[];
  isPartner?: boolean;
  partnershipStatus?: string[];
  
  // Lead filters
  leadStatus?: string[];
  leadType?: string[];
  
  // Common filters
  departmentId?: number[];
  departmentName?: string[];  // Filter by department name (from aggregations)
  countryName?: string[];  // Filter by country name (from aggregations)
  createdDateRange?: { start?: Date; end?: Date };
  modifiedDateRange?: { start?: Date; end?: Date };
}

/**
 * Sort options
 */
export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
}

/**
 * Search result container
 */
export interface SearchResult<T = any> {
  /** Array of search hits */
  hits: SearchHit<T>[];
  /** Total number of matching documents */
  total: number;
  /** Aggregation results (if requested) */
  aggregations?: SearchAggregations;
  /** Time taken in milliseconds */
  took: number;
  /** Current page number */
  page: number;
  /** Page size */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * Individual search hit
 */
export interface SearchHit<T = any> {
  /** Document ID */
  id: string;
  /** Index name */
  index: string;
  /** Entity type derived from index */
  entityType: EntityType;
  /** Relevance score */
  score: number;
  /** Document source data */
  source: T;
  /** Highlighted fields (if requested) */
  highlight?: Record<string, string[]>;
}

/**
 * Search aggregations for faceted search
 */
export interface SearchAggregations {
  /** Count by entity type / index */
  entityTypes: AggregationBucket[];
  /** Count by category */
  categories?: AggregationBucket[];
  /** Count by event type */
  eventTypes?: AggregationBucket[];
  /** Count by event scope */
  eventScopes?: AggregationBucket[];
  /** Count by status */
  statuses?: AggregationBucket[];
  /** Count by priority */
  priorities?: AggregationBucket[];
  /** Count by organization */
  organizations?: AggregationBucket[];
  /** Count by department */
  departments?: AggregationBucket[];
  /** Count by date (monthly histogram) */
  dateHistogram?: AggregationBucket[];
  /** Count by lead status */
  leadStatuses?: AggregationBucket[];
  /** Count by partnership status */
  partnershipStatuses?: AggregationBucket[];
}

/**
 * Aggregation bucket
 */
export interface AggregationBucket {
  key: string;
  count: number;
}

/**
 * Autocomplete / suggestion result
 */
export interface SearchSuggestion {
  /** Suggested text */
  text: string;
  /** Relevance score */
  score: number;
  /** Highlighted text (if available) */
  highlighted?: string;
  /** Suggestion type */
  type: 'completion' | 'phrase';
  /** Entity type this suggestion came from */
  entityType?: EntityType;
}

/**
 * Field boost configuration for search relevance
 */
export interface FieldBoost {
  field: string;
  boost: number;
}

/**
 * Highlight configuration
 */
export interface HighlightConfig {
  preTags: string[];
  postTags: string[];
  fields: Record<string, { numberOfFragments: number; fragmentSize?: number }>;
}

/**
 * Default search field boosts
 */
export const DEFAULT_FIELD_BOOSTS: Record<string, number> = {
  'nameEn': 3.0,
  'nameAr': 3.0,
  'titleEn': 3.0,
  'titleAr': 3.0,
  'title': 3.0,
  'email': 2.5,
  'phone': 2.0,
  'organizationName': 2.0,
  'description': 1.5,
  'descriptionAr': 1.5,
  'notes': 1.0,
  'notesAr': 1.0,
  'content': 1.5,
  'contentAr': 1.5,
  'location': 2.0,
  'locationAr': 2.0,
};

/**
 * Entity-specific search field configurations
 * Note: ES documents use 'name' not 'nameEn', and 'title' not 'titleEn'
 */
export const ENTITY_SEARCH_FIELDS: Record<EntityType, string[]> = {
  'events': ['name^3', 'nameAr^3', 'title^3', 'titleAr^3', 'description^1.5', 'descriptionAr^1.5', 'location^2', 'locationAr^2', 'searchText^1'],
  'archived-events': ['name^3', 'nameAr^3', 'title^3', 'titleAr^3', 'description^1.5', 'descriptionAr^1.5', 'location^2', 'locationAr^2', 'searchText^1'],
  'tasks': ['title^3', 'titleAr^3', 'description^1.5', 'descriptionAr^1.5', 'searchText^1'],
  'contacts': ['name^3', 'nameAr^3', 'email^2.5', 'phone^2', 'organizationName^2', 'searchText^1'],
  'organizations': ['name^3', 'nameAr^3', 'website^1.5', 'searchText^1'],
  'leads': ['name^3', 'nameAr^3', 'organizationName^2.5', 'email^2', 'phone^2', 'notes^1', 'notesAr^1', 'searchText^1'],
  'agreements': ['name^3', 'nameAr^3', 'title^3', 'titleAr^3', 'description^1.5', 'partnerName^2.5', 'searchText^1'],
  'attendees': ['name^3', 'nameAr^3', 'email^2.5', 'searchText^1'],
  'invitees': ['name^3', 'nameAr^3', 'email^2.5', 'searchText^1'],
  'departments': ['name^3', 'nameAr^3', 'searchText^1'],
  'partnerships': ['name^3', 'nameAr^3', 'website^1.5', 'searchText^1'],
  'updates': ['content^2', 'contentAr^2', 'searchText^1'],
  'lead-interactions': ['notes^2', 'notesAr^2', 'description^2', 'searchText^1'],
  'partnership-activities': ['title^3', 'titleAr^3', 'description^1.5', 'searchText^1'],
  'partnership-interactions': ['notes^2', 'notesAr^2', 'description^2', 'searchText^1'],
};

/**
 * Default highlight configuration
 * Note: ES documents use 'name' not 'nameEn'
 */
export const DEFAULT_HIGHLIGHT_CONFIG: HighlightConfig = {
  preTags: ['<mark>'],
  postTags: ['</mark>'],
  fields: {
    'name': { numberOfFragments: 0 },
    'nameAr': { numberOfFragments: 0 },
    'title': { numberOfFragments: 0 },
    'titleAr': { numberOfFragments: 0 },
    'description': { numberOfFragments: 2, fragmentSize: 150 },
    'descriptionAr': { numberOfFragments: 2, fragmentSize: 150 },
    'notes': { numberOfFragments: 2, fragmentSize: 150 },
    'notesAr': { numberOfFragments: 2, fragmentSize: 150 },
    'content': { numberOfFragments: 2, fragmentSize: 200 },
    'contentAr': { numberOfFragments: 2, fragmentSize: 200 },
    'email': { numberOfFragments: 0 },
    'phone': { numberOfFragments: 0 },
    'organizationName': { numberOfFragments: 0 },
    'searchText': { numberOfFragments: 2, fragmentSize: 200 },
  },
};
