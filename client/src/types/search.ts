/**
 * Search Type Definitions for Frontend
 * 
 * Types for search queries, results, filters, and aggregations
 * used throughout the search UI components.
 * 
 * @module types/search
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
 * Search query parameters
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
  organizationName?: string[];  // Filter by organization name (for aggregations)
  isEligibleSpeaker?: boolean;
  countryId?: number[];
  countryName?: string[];  // Filter by country name (for aggregations)
  
  // Organization filters
  isPartner?: boolean;
  partnershipStatus?: string[];
  
  // Lead filters
  leadStatus?: string[];
  leadType?: string[];
  
  // Common filters
  departmentId?: number[];
  departmentName?: string[];  // Filter by department name (for aggregations)
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
 * Search result from API
 */
export interface SearchResult {
  /** Array of search hits */
  hits: SearchHit[];
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
export interface SearchHit<T = Record<string, unknown>> {
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
  /** Count by country */
  countries?: AggregationBucket[];
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
 * Event source in search results
 */
export interface EventSource {
  nameEn: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  locationAr?: string;
  eventType?: string;
  eventScope?: string;
  categoryId?: number;
  departmentId?: number;
  isArchived?: boolean;
}

/**
 * Task source in search results
 */
export interface TaskSource {
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  eventDepartmentId?: number;
}

/**
 * Contact source in search results
 */
export interface ContactSource {
  nameEn: string;
  nameAr?: string;
  email?: string;
  phone?: string;
  notes?: string;
  notesAr?: string;
  organizationId?: number;
  organizationName?: string;
  positionId?: number;
  isEligibleSpeaker?: boolean;
}

/**
 * Organization source in search results
 */
export interface OrganizationSource {
  nameEn: string;
  nameAr?: string;
  website?: string;
  isPartner?: boolean;
  partnershipStatus?: string;
  countryId?: number;
}

/**
 * Lead source in search results
 */
export interface LeadSource {
  nameEn: string;
  nameAr?: string;
  organizationName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  notesAr?: string;
  status?: string;
  type?: string;
  departmentId?: number;
}

/**
 * Entity display configuration
 */
export interface EntityConfig {
  icon: string;
  color: string;
  route: string;
  label: string;
  labelAr: string;
}

/**
 * Search status
 */
export interface SearchStatus {
  enabled: boolean;
  connected: boolean;
  indexCount: number;
}
