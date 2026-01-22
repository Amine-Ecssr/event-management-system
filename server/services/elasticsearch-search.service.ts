/**
 * Elasticsearch Search Service
 * 
 * Core search service providing query building, result ranking, and unified
 * search across all indexed entities. Powers both global search and
 * entity-specific searches.
 * 
 * Features:
 * - Multi-field matching with configurable boosting
 * - Fuzzy matching for typo tolerance
 * - Arabic/English bilingual search
 * - Result highlighting
 * - Faceted search with aggregations
 * - Autocomplete suggestions
 * 
 * @module services/elasticsearch-search
 */

import { getOptionalElasticsearchClient, isElasticsearchEnabled } from '../elasticsearch/client';
import { ENTITY_INDEX_MAP, EntityIndexMapKey } from '../elasticsearch/types';
import {
  SearchQuery,
  SearchResult,
  SearchHit,
  SearchAggregations,
  SearchFilters,
  SearchSuggestion,
  AggregationBucket,
  ENTITY_SEARCH_FIELDS,
  DEFAULT_HIGHLIGHT_CONFIG,
} from '../elasticsearch/types/search.types';

// Logger
const logger = {
  info: (...args: unknown[]) => console.log('[Search]', ...args),
  warn: (...args: unknown[]) => console.warn('[Search]', ...args),
  error: (...args: unknown[]) => console.error('[Search]', ...args),
  debug: (...args: unknown[]) => console.debug('[Search]', ...args),
};

// Map from URL-friendly entity names to ENTITY_INDEX_MAP keys
const ENTITY_NAME_TO_KEY: Record<string, EntityIndexMapKey> = {
  'events': 'events',
  'archived-events': 'archivedEvents',
  'tasks': 'tasks',
  'contacts': 'contacts',
  'organizations': 'organizations',
  'leads': 'leads',
  'agreements': 'agreements',
  'attendees': 'attendees',
  'invitees': 'invitees',
  'departments': 'departments',
  'partnerships': 'partnerships',
  'updates': 'updates',
  'lead-interactions': 'leadInteractions',
  'partnership-activities': 'partnershipActivities',
  'partnership-interactions': 'partnershipInteractions',
};

// Map from ENTITY_INDEX_MAP keys to URL-friendly names
const KEY_TO_ENTITY_NAME: Record<EntityIndexMapKey, string> = {
  'events': 'events',
  'archivedEvents': 'archived-events',
  'tasks': 'tasks',
  'contacts': 'contacts',
  'organizations': 'organizations',
  'leads': 'leads',
  'agreements': 'agreements',
  'attendees': 'attendees',
  'invitees': 'invitees',
  'departments': 'departments',
  'partnerships': 'partnerships',
  'updates': 'updates',
  'leadInteractions': 'lead-interactions',
  'partnershipActivities': 'partnership-activities',
  'partnershipInteractions': 'partnership-interactions',
};

// Default search fields when searching all entities
const ALL_SEARCH_FIELDS = [
  'name^3', 'nameAr^3',
  'title^3', 'titleAr^3',
  'email^2.5',
  'phone^2',
  'organizationName^2',
  'description^1.5', 'descriptionAr^1.5',
  'notes^1', 'notesAr^1',
  'content^1.5', 'contentAr^1.5',
  'location^2', 'locationAr^2',
  'website^1.5',
];

export class ElasticsearchSearchService {
  private readonly DEFAULT_PAGE_SIZE = 20;
  private readonly MAX_PAGE_SIZE = 100;

  /**
   * Main search method - searches across multiple indices
   */
  async search(query: SearchQuery): Promise<SearchResult> {
    if (!isElasticsearchEnabled()) {
      return this.emptyResult(query);
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) {
      return this.emptyResult(query);
    }

    const page = query.pagination?.page || 1;
    const pageSize = Math.min(
      query.pagination?.pageSize || this.DEFAULT_PAGE_SIZE,
      this.MAX_PAGE_SIZE
    );
    const from = (page - 1) * pageSize;

    // Determine which indices to search
    const indices = this.getSearchIndices(query.entities);
    
    if (indices.length === 0) {
      return this.emptyResult(query);
    }

    // Build the ES query
    const esQuery = this.buildQuery(query);

    // Build aggregations if requested
    const aggs = query.includeAggregations ? this.buildAggregations() : undefined;

    // Build highlight config
    const highlight = query.highlight !== false ? this.buildHighlight() : undefined;

    try {
      logger.debug('Executing search:', {
        indices: indices.join(','),
        query: query.q,
        page,
        pageSize,
      });

      // Use body parameter to avoid ES client type constraints
      const searchBody: Record<string, unknown> = {
        query: esQuery,
        from,
        size: pageSize,
        sort: this.buildSort(query.sort),
        track_total_hits: true,
      };
      
      if (highlight) {
        searchBody.highlight = highlight;
      }
      
      if (aggs) {
        searchBody.aggs = aggs;
      }
      
      // Build request params
      const searchParams = {
        index: indices.join(','),
        body: searchBody,
      };

      const response = await client.search(searchParams);

      const total = typeof response.hits.total === 'number'
        ? response.hits.total
        : response.hits.total?.value || 0;

      const result: SearchResult = {
        hits: this.transformHits(response.hits.hits),
        total,
        aggregations: aggs ? this.transformAggregations(response.aggregations) : undefined,
        took: response.took,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };

      logger.debug(`Search returned ${result.hits.length} results (${total} total) in ${response.took}ms`);

      return result;
    } catch (error) {
      logger.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Global search - searches all entity types
   */
  async globalSearch(q: string, options?: Partial<SearchQuery>): Promise<SearchResult> {
    return this.search({
      q,
      entities: undefined, // Search all
      highlight: true,
      fuzzy: true,
      includeAggregations: true,
      ...options,
    });
  }

  /**
   * Search events
   */
  async searchEvents(
    q: string,
    filters?: SearchFilters,
    page = 1,
    pageSize = 20
  ): Promise<SearchResult> {
    return this.search({
      q,
      entities: ['events'],
      filters,
      pagination: { page, pageSize },
      highlight: true,
      fuzzy: true,
    });
  }

  /**
   * Search archived events
   */
  async searchArchivedEvents(
    q: string,
    filters?: SearchFilters,
    page = 1,
    pageSize = 20
  ): Promise<SearchResult> {
    return this.search({
      q,
      entities: ['archived-events'],
      filters,
      pagination: { page, pageSize },
      highlight: true,
      fuzzy: true,
    });
  }

  /**
   * Search tasks
   */
  async searchTasks(
    q: string,
    filters?: SearchFilters,
    page = 1,
    pageSize = 20
  ): Promise<SearchResult> {
    return this.search({
      q,
      entities: ['tasks'],
      filters,
      pagination: { page, pageSize },
      highlight: true,
      fuzzy: true,
    });
  }

  /**
   * Search contacts
   */
  async searchContacts(
    q: string,
    filters?: SearchFilters,
    page = 1,
    pageSize = 20
  ): Promise<SearchResult> {
    return this.search({
      q,
      entities: ['contacts'],
      filters,
      pagination: { page, pageSize },
      highlight: true,
      fuzzy: true,
    });
  }

  /**
   * Search organizations
   */
  async searchOrganizations(
    q: string,
    filters?: SearchFilters,
    page = 1,
    pageSize = 20
  ): Promise<SearchResult> {
    return this.search({
      q,
      entities: ['organizations'],
      filters,
      pagination: { page, pageSize },
      highlight: true,
      fuzzy: true,
    });
  }

  /**
   * Search leads
   */
  async searchLeads(
    q: string,
    filters?: SearchFilters,
    page = 1,
    pageSize = 20
  ): Promise<SearchResult> {
    return this.search({
      q,
      entities: ['leads'],
      filters,
      pagination: { page, pageSize },
      highlight: true,
      fuzzy: true,
    });
  }

  /**
   * Search partnerships
   */
  async searchPartnerships(
    q: string,
    filters?: SearchFilters,
    page = 1,
    pageSize = 20
  ): Promise<SearchResult> {
    return this.search({
      q,
      entities: ['partnerships'],
      filters,
      pagination: { page, pageSize },
      highlight: true,
      fuzzy: true,
    });
  }

  /**
   * Search agreements
   */
  async searchAgreements(
    q: string,
    filters?: SearchFilters,
    page = 1,
    pageSize = 20
  ): Promise<SearchResult> {
    return this.search({
      q,
      entities: ['agreements'],
      filters,
      pagination: { page, pageSize },
      highlight: true,
      fuzzy: true,
    });
  }

  /**
   * Search departments
   */
  async searchDepartments(
    q: string,
    filters?: SearchFilters,
    page = 1,
    pageSize = 20
  ): Promise<SearchResult> {
    return this.search({
      q,
      entities: ['departments'],
      filters,
      pagination: { page, pageSize },
      highlight: true,
      fuzzy: true,
    });
  }

  /**
   * Search updates (weekly/monthly)
   */
  async searchUpdates(
    q: string,
    filters?: SearchFilters,
    page = 1,
    pageSize = 20
  ): Promise<SearchResult> {
    return this.search({
      q,
      entities: ['updates'],
      filters,
      pagination: { page, pageSize },
      highlight: true,
      fuzzy: true,
    });
  }

  /**
   * Autocomplete / Suggestions
   * Returns suggestions based on prefix matching
   */
  async getSuggestions(
    prefix: string,
    entities?: string[],
    limit = 10
  ): Promise<SearchSuggestion[]> {
    if (!isElasticsearchEnabled() || prefix.length < 2) {
      return [];
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return [];

    const indices = this.getSearchIndices(entities);
    
    if (indices.length === 0) {
      return [];
    }

    try {
      const response = await client.search({
        index: indices.join(','),
        body: {
          // Prefix query for partial matches
          query: {
            bool: {
              should: [
                // Phrase prefix for multi-word queries
                {
                  multi_match: {
                    query: prefix,
                    type: 'phrase_prefix',
                    fields: ['name^3', 'nameAr^3', 'title^3', 'titleAr^3', 'email^2'],
                  },
                },
                // Regular prefix for edge cases
                {
                  multi_match: {
                    query: prefix,
                    type: 'best_fields',
                    fields: ['name^2', 'nameAr^2', 'title^2', 'email'],
                    fuzziness: 'AUTO',
                  },
                },
              ],
              minimum_should_match: 1,
            },
          },
          size: limit,
          _source: ['name', 'nameAr', 'title', 'titleAr', 'email', 'organizationName'],
          highlight: {
            pre_tags: ['<b>'],
            post_tags: ['</b>'],
            fields: {
              name: { number_of_fragments: 0 },
              nameAr: { number_of_fragments: 0 },
              title: { number_of_fragments: 0 },
              titleAr: { number_of_fragments: 0 },
              email: { number_of_fragments: 0 },
            },
          },
        },
      });

      const suggestions: SearchSuggestion[] = [];
      const seen = new Set<string>();

      for (const hit of response.hits.hits) {
        const source = hit._source as Record<string, unknown>;
        const highlight = hit.highlight as Record<string, string[]> | undefined;
        
        // Get the best field to display
        const displayText = (source.name || source.nameAr || source.title || source.titleAr || source.email) as string;
        
        if (displayText && !seen.has(displayText.toLowerCase())) {
          seen.add(displayText.toLowerCase());
          
          // Get highlighted version if available
          const highlightedField = highlight?.name?.[0] || 
                                  highlight?.nameAr?.[0] || 
                                  highlight?.title?.[0] || 
                                  highlight?.titleAr?.[0] ||
                                  highlight?.email?.[0];
          
          suggestions.push({
            text: displayText,
            score: hit._score || 0,
            highlighted: highlightedField,
            type: 'phrase',
            entityType: this.indexToEntityName(hit._index) as SearchSuggestion['entityType'],
          });
        }
      }

      return suggestions.slice(0, limit);
    } catch (error) {
      logger.error('Suggestions failed:', error);
      return [];
    }
  }

  /**
   * Build the main Elasticsearch query
   */
  private buildQuery(query: SearchQuery): Record<string, unknown> {
    // Build filter clauses first to determine if we need bool query
    const filterClauses = query.filters ? this.buildFilters(query.filters) : [];
    
    // Main text search - simplified to match working pattern
    if (query.q && query.q.trim()) {
      const searchFields = this.getSearchFields(query.entities);
      
      const multiMatchQuery = {
        multi_match: {
          query: query.q,
          fields: searchFields,
          type: 'best_fields',
          fuzziness: query.fuzzy !== false ? 'AUTO' : undefined,
          operator: 'or',
        },
      };
      
      // If no filters, return simple multi_match without bool wrapper
      if (filterClauses.length === 0) {
        return multiMatchQuery;
      }
      
      // If filters, use bool query
      return {
        bool: {
          must: [multiMatchQuery],
          filter: filterClauses,
        },
      };
    }

    // No query - return match_all with optional filters
    if (filterClauses.length > 0) {
      return {
        bool: {
          must: [{ match_all: {} }],
          filter: filterClauses,
        },
      };
    }
    
    return { match_all: {} };
  }

  /**
   * Build filter clauses from SearchFilters
   */
  private buildFilters(filters: SearchFilters): unknown[] {
    const clauses: unknown[] = [];

    // Event type filter
    if (filters.eventType?.length) {
      clauses.push({ terms: { eventType: filters.eventType } });
    }

    // Event scope filter
    if (filters.eventScope?.length) {
      clauses.push({ terms: { eventScope: filters.eventScope } });
    }

    // Category filter
    if (filters.category?.length) {
      clauses.push({ terms: { categoryId: filters.category } });
    }

    // Date range filter (events)
    if (filters.dateRange) {
      const rangeClause: { range: { startDate: { gte?: string; lte?: string } } } = {
        range: { startDate: {} },
      };
      if (filters.dateRange.start) {
        rangeClause.range.startDate.gte = filters.dateRange.start.toISOString();
      }
      if (filters.dateRange.end) {
        rangeClause.range.startDate.lte = filters.dateRange.end.toISOString();
      }
      if (rangeClause.range.startDate.gte || rangeClause.range.startDate.lte) {
        clauses.push(rangeClause);
      }
    }

    // Archived filter
    if (typeof filters.isArchived === 'boolean') {
      clauses.push({ term: { isArchived: filters.isArchived } });
    }

    // Task status filter
    if (filters.status?.length) {
      clauses.push({ terms: { status: filters.status } });
    }

    // Priority filter
    if (filters.priority?.length) {
      clauses.push({ terms: { priority: filters.priority } });
    }

    // Assignee filter
    if (filters.assigneeId?.length) {
      clauses.push({ terms: { assigneeId: filters.assigneeId } });
    }

    // Organization filter
    if (filters.organizationId?.length) {
      clauses.push({ terms: { organizationId: filters.organizationId } });
    }

    // Country filter
    if (filters.countryId?.length) {
      clauses.push({ terms: { countryId: filters.countryId } });
    }

    // Is partner filter
    if (typeof filters.isPartner === 'boolean') {
      clauses.push({ term: { isPartner: filters.isPartner } });
    }

    // Partnership status filter
    if (filters.partnershipStatus?.length) {
      clauses.push({ terms: { partnershipStatus: filters.partnershipStatus } });
    }

    // Lead status filter
    if (filters.leadStatus?.length) {
      clauses.push({ terms: { status: filters.leadStatus } });
    }

    // Lead type filter
    if (filters.leadType?.length) {
      clauses.push({ terms: { type: filters.leadType } });
    }

    // Is eligible speaker filter
    if (typeof filters.isEligibleSpeaker === 'boolean') {
      clauses.push({ term: { isEligibleSpeaker: filters.isEligibleSpeaker } });
    }

    // Department filter (by ID)
    if (filters.departmentId?.length) {
      clauses.push({ terms: { departmentId: filters.departmentId } });
    }

    // Department filter (by name - from aggregations)
    if (filters.departmentName?.length) {
      clauses.push({ terms: { departmentName: filters.departmentName } });
    }

    // Organization filter (by name - from aggregations)
    if (filters.organizationName?.length) {
      clauses.push({ terms: { organizationName: filters.organizationName } });
    }
    // Country filter (by name - from aggregations)
    if (filters.countryName?.length) {
      clauses.push({ terms: { countryName: filters.countryName } });
    }
    // Created date range
    if (filters.createdDateRange) {
      const rangeClause: { range: { indexedAt: { gte?: string; lte?: string } } } = {
        range: { indexedAt: {} },
      };
      if (filters.createdDateRange.start) {
        rangeClause.range.indexedAt.gte = filters.createdDateRange.start.toISOString();
      }
      if (filters.createdDateRange.end) {
        rangeClause.range.indexedAt.lte = filters.createdDateRange.end.toISOString();
      }
      if (rangeClause.range.indexedAt.gte || rangeClause.range.indexedAt.lte) {
        clauses.push(rangeClause);
      }
    }

    // Modified date range
    if (filters.modifiedDateRange) {
      const rangeClause: { range: { modifiedAt: { gte?: string; lte?: string } } } = {
        range: { modifiedAt: {} },
      };
      if (filters.modifiedDateRange.start) {
        rangeClause.range.modifiedAt.gte = filters.modifiedDateRange.start.toISOString();
      }
      if (filters.modifiedDateRange.end) {
        rangeClause.range.modifiedAt.lte = filters.modifiedDateRange.end.toISOString();
      }
      if (rangeClause.range.modifiedAt.gte || rangeClause.range.modifiedAt.lte) {
        clauses.push(rangeClause);
      }
    }

    return clauses;
  }

  /**
   * Build aggregations for faceted search
   */
  private buildAggregations(): Record<string, object> {
    return {
      entityTypes: {
        terms: { field: '_index', size: 20 },
      },
      categories: {
        terms: { field: 'categoryId', size: 30 },
      },
      eventTypes: {
        terms: { field: 'eventType', size: 15 },
      },
      eventScopes: {
        terms: { field: 'eventScope', size: 10 },
      },
      statuses: {
        terms: { field: 'status', size: 15 },
      },
      priorities: {
        terms: { field: 'priority', size: 10 },
      },
      departments: {
        terms: { field: 'departmentName', size: 30, missing: 'Unknown' },
      },
      organizations: {
        terms: { field: 'organizationName', size: 30, missing: 'Unknown' },
      },
      countries: {
        terms: { field: 'countryName', size: 50, missing: 'Unknown' },
      },
      leadStatuses: {
        terms: { field: 'leadStatus', size: 10 },
      },
      partnershipStatuses: {
        terms: { field: 'partnershipStatus', size: 10 },
      },
      dateHistogram: {
        date_histogram: {
          field: 'startDate',
          calendar_interval: 'month',
          format: 'yyyy-MM',
          min_doc_count: 0,
        },
      },
    };
  }

  /**
   * Build highlight configuration
   */
  private buildHighlight(): object {
    const fields: Record<string, object> = {};
    
    for (const [field, config] of Object.entries(DEFAULT_HIGHLIGHT_CONFIG.fields)) {
      fields[field] = {
        number_of_fragments: config.numberOfFragments,
        ...(config.fragmentSize ? { fragment_size: config.fragmentSize } : {}),
      };
    }

    return {
      pre_tags: DEFAULT_HIGHLIGHT_CONFIG.preTags,
      post_tags: DEFAULT_HIGHLIGHT_CONFIG.postTags,
      fields,
    };
  }

  /**
   * Build sort configuration
   */
  private buildSort(sort?: { field: string; direction: 'asc' | 'desc' }): object[] {
    if (sort) {
      return [{ 
        [sort.field]: { 
          order: sort.direction, 
          missing: '_last',
          unmapped_type: 'date' 
        } 
      }];
    }

    // Default: relevance score, then by date
    // Use unmapped_type to handle indices that don't have these fields
    return [
      { _score: { order: 'desc' } },
      { startDate: { order: 'desc', missing: '_last', unmapped_type: 'date' } },
      { indexedAt: { order: 'desc', missing: '_last', unmapped_type: 'date' } },
    ];
  }

  /**
   * Get indices to search based on entity types
   */
  private getSearchIndices(entities?: string[]): string[] {
    if (!entities || entities.length === 0) {
      // Return all indices
      return Object.values(ENTITY_INDEX_MAP);
    }

    const indices: string[] = [];
    for (const entity of entities) {
      const key = ENTITY_NAME_TO_KEY[entity];
      if (key && ENTITY_INDEX_MAP[key]) {
        indices.push(ENTITY_INDEX_MAP[key]);
      }
    }
    return indices;
  }

  /**
   * Get search fields based on entity types
   */
  private getSearchFields(entities?: string[]): string[] {
    if (!entities || entities.length === 0) {
      return ALL_SEARCH_FIELDS;
    }

    const fields = new Set<string>();
    for (const entity of entities) {
      const entityFields = ENTITY_SEARCH_FIELDS[entity as keyof typeof ENTITY_SEARCH_FIELDS];
      if (entityFields) {
        for (const field of entityFields) {
          fields.add(field);
        }
      }
    }
    return Array.from(fields);
  }

  /**
   * Transform ES hits to our SearchHit format
   */
  private transformHits(hits: unknown[]): SearchHit[] {
    return hits.map((hit: unknown) => {
      const h = hit as {
        _id: string;
        _index: string;
        _score: number | null;
        _source: unknown;
        highlight?: Record<string, string[]>;
      };

      return {
        id: h._id,
        index: h._index,
        entityType: this.indexToEntityName(h._index) as SearchHit['entityType'],
        score: h._score || 0,
        source: h._source,
        highlight: h.highlight,
      };
    });
  }

  /**
   * Transform ES aggregations to our format
   */
  private transformAggregations(aggs: unknown): SearchAggregations | undefined {
    if (!aggs) return undefined;

    const a = aggs as Record<string, { buckets?: Array<{ key: string; doc_count: number }> }>;

    const transform = (buckets: Array<{ key: string; doc_count: number }> | undefined): AggregationBucket[] =>
      buckets?.map((b) => ({ key: String(b.key), count: b.doc_count })) || [];

    return {
      entityTypes: transform(a.entityTypes?.buckets),
      categories: transform(a.categories?.buckets),
      eventTypes: transform(a.eventTypes?.buckets),
      eventScopes: transform(a.eventScopes?.buckets),
      statuses: transform(a.statuses?.buckets),
      priorities: transform(a.priorities?.buckets),
      departments: transform(a.departments?.buckets),
      organizations: transform(a.organizations?.buckets),
      leadStatuses: transform(a.leadStatuses?.buckets),
      partnershipStatuses: transform(a.partnershipStatuses?.buckets),
      dateHistogram: transform(a.dateHistogram?.buckets),
    };
  }

  /**
   * Map index name to entity type name
   */
  private indexToEntityName(index: string): string {
    // Index names are like "eventcal-events-dev"
    for (const [key, indexName] of Object.entries(ENTITY_INDEX_MAP) as [EntityIndexMapKey, string][]) {
      if (index === indexName || index.startsWith(indexName.split('-').slice(0, -1).join('-'))) {
        return KEY_TO_ENTITY_NAME[key] || key;
      }
    }
    return 'events'; // Default fallback
  }

  /**
   * Return empty result when ES is disabled or unavailable
   */
  private emptyResult(query: SearchQuery): SearchResult {
    return {
      hits: [],
      total: 0,
      took: 0,
      page: query.pagination?.page || 1,
      pageSize: query.pagination?.pageSize || this.DEFAULT_PAGE_SIZE,
      totalPages: 0,
    };
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    enabled: boolean;
    connected: boolean;
    indexCount: number;
  }> {
    if (!isElasticsearchEnabled()) {
      return { enabled: false, connected: false, indexCount: 0 };
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) {
      return { enabled: true, connected: false, indexCount: 0 };
    }

    try {
      const indices = await client.cat.indices({
        format: 'json',
        index: 'eventcal-*',
      });

      return {
        enabled: true,
        connected: true,
        indexCount: Array.isArray(indices) ? indices.length : 0,
      };
    } catch {
      return { enabled: true, connected: false, indexCount: 0 };
    }
  }
}

// Singleton instance
export const searchService = new ElasticsearchSearchService();
