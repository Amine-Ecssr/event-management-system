/**
 * Elasticsearch Suggestion Types
 * Types for autocomplete and search suggestions
 */

export type SuggestionEntityType =
  | 'events'
  | 'contacts'
  | 'organizations'
  | 'tasks'
  | 'partnerships';

export interface SuggestionRequest {
  /** Query text to search for */
  q: string;
  /** Entity types to search (defaults to events, contacts, organizations) */
  types?: SuggestionEntityType[];
  /** Maximum suggestions per type (default: 5) */
  limit?: number;
  /** Enable fuzzy matching (default: true) */
  fuzzy?: boolean;
  /** Context filters */
  context?: SuggestionContext;
}

export interface SuggestionContext {
  /** Filter by department */
  departmentId?: number;
  /** Filter by category */
  category?: string;
  /** Filter by active status */
  isActive?: boolean;
}

export interface SuggestionResponse {
  /** List of suggestions */
  suggestions: Suggestion[];
  /** Did-you-mean correction */
  didYouMean?: string;
  /** Query time in milliseconds */
  took: number;
}

export interface Suggestion {
  /** Display text (English) */
  text: string;
  /** Display text (Arabic) */
  textAr?: string;
  /** Entity type */
  type: SuggestionEntityType;
  /** Entity ID */
  id: string | number;
  /** Relevance score */
  score: number;
  /** Highlighted text */
  highlight?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface AutocompleteResponse {
  /** List of autocomplete options */
  options: AutocompleteOption[];
  /** Query time in milliseconds */
  took: number;
}

export interface AutocompleteOption {
  /** Option value (usually ID) */
  value: string;
  /** Display label (English) */
  label: string;
  /** Display label (Arabic) */
  labelAr?: string;
  /** Entity type */
  type: SuggestionEntityType;
  /** Entity ID */
  id: string | number;
}

export interface PopularSearchesResponse {
  /** Popular search terms */
  searches: PopularSearch[];
  /** Time period covered */
  period: string;
}

export interface PopularSearch {
  /** Search term */
  term: string;
  /** Number of searches */
  count: number;
  /** Trend direction */
  trend?: 'up' | 'down' | 'stable';
}

export interface RecentSearchesResponse {
  /** User's recent searches */
  searches: RecentSearch[];
}

export interface RecentSearch {
  /** Search query */
  query: string;
  /** Timestamp */
  timestamp: Date;
  /** Results count */
  resultsCount: number;
}

/**
 * Completion suggest field configuration for Elasticsearch mappings
 */
export const SUGGEST_FIELD_MAPPING = {
  suggest: {
    type: 'completion' as const,
    analyzer: 'autocomplete_analyzer',
    search_analyzer: 'autocomplete_search',
    preserve_separators: true,
    preserve_position_increments: true,
    max_input_length: 50
  },
  suggestAr: {
    type: 'completion' as const,
    analyzer: 'arabic_autocomplete',
    search_analyzer: 'arabic_autocomplete',
    max_input_length: 50
  }
};
