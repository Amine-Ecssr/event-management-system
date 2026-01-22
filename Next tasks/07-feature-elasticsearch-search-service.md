# Feature: Elasticsearch Search Service

## Type
Feature / Core Service

## Priority
🔴 Critical

## Estimated Effort
6-8 hours

## Description
Core search service providing query building, result ranking, and unified search across all indexed entities. Powers both global search and entity-specific searches.

## Requirements

### Search Service
Create `server/services/elasticsearch-search.service.ts`:
- Query parsing and building
- Multi-field matching with boosting
- Fuzzy matching for typos
- Arabic/English bilingual search
- Result highlighting
- Faceted search with aggregations

---

## Complete Implementation

### Search Types (`server/elasticsearch/types/search.types.ts`)
```typescript
export interface SearchQuery {
  q: string;                    // Search query string
  entities?: EntityType[];      // Filter by entity types
  filters?: SearchFilters;      // Field-specific filters
  sort?: SortOptions;           // Sorting configuration
  pagination?: PaginationOptions;
  highlight?: boolean;          // Enable highlighting
  fuzzy?: boolean;              // Enable fuzzy matching
  includeAggregations?: boolean;
}

export type EntityType = 
  | 'events' | 'tasks' | 'contacts' | 'organizations' 
  | 'leads' | 'agreements' | 'attendees' | 'invitees';

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
  
  // Organization filters
  country?: string[];
  
  // Lead filters
  leadStatus?: string[];
  
  // Common filters
  departmentId?: number[];
  createdDateRange?: { start?: Date; end?: Date };
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface SearchResult<T = any> {
  hits: SearchHit<T>[];
  total: number;
  aggregations?: SearchAggregations;
  took: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SearchHit<T = any> {
  id: string;
  index: string;
  entityType: EntityType;
  score: number;
  source: T;
  highlight?: Record<string, string[]>;
}

export interface SearchAggregations {
  entityTypes: { key: string; count: number }[];
  categories?: { key: string; count: number }[];
  eventTypes?: { key: string; count: number }[];
  statuses?: { key: string; count: number }[];
  priorities?: { key: string; count: number }[];
  organizations?: { key: string; count: number }[];
  departments?: { key: string; count: number }[];
  dateHistogram?: { key: string; count: number }[];
}

export interface SearchSuggestion {
  text: string;
  score: number;
  highlighted?: string;
  type: 'completion' | 'phrase';
}
```

### Search Service (`server/services/elasticsearch-search.service.ts`)
```typescript
import { getOptionalElasticsearchClient, isElasticsearchEnabled } from '../elasticsearch/client';
import { ENTITY_INDEX_MAP } from '../elasticsearch/types';
import { 
  SearchQuery, SearchResult, SearchHit, SearchAggregations, 
  SearchFilters, EntityType, SearchSuggestion 
} from '../elasticsearch/types/search.types';
import { logger } from '../utils/logger';

// Field boosting configuration
const FIELD_BOOSTS = {
  'nameEn': 3.0,           // English name highest priority
  'nameAr': 3.0,           // Arabic name same priority
  'titleEn': 3.0,          // Title fields
  'titleAr': 3.0,
  'email': 2.5,            // Email important for contact search
  'phone': 2.0,            // Phone number
  'description': 1.5,      // Description lower priority
  'notes': 1.0,            // Notes lowest
  'searchText': 1.0,       // Combined search text
  'tags': 2.0,             // Tags important
};

// Entity-specific search fields
const ENTITY_SEARCH_FIELDS: Record<EntityType, string[]> = {
  events: ['nameEn^3', 'nameAr^3', 'description^1.5', 'location^2', 'category^2', 'tags^2'],
  tasks: ['nameEn^3', 'description^1.5', 'status^1'],
  contacts: ['nameEn^3', 'nameAr^3', 'email^2.5', 'phone^2', 'jobTitle^2', 'notes^1'],
  organizations: ['nameEn^3', 'nameAr^3', 'industry^2', 'country^1.5', 'notes^1'],
  leads: ['nameEn^3', 'companyName^2.5', 'email^2', 'phone^2', 'notes^1'],
  agreements: ['titleEn^3', 'titleAr^3', 'partnerName^2.5', 'description^1.5'],
  attendees: ['nameEn^3', 'email^2.5', 'phone^2', 'organization^2'],
  invitees: ['nameEn^3', 'email^2.5', 'organization^2'],
};

export class ElasticsearchSearchService {
  private readonly DEFAULT_PAGE_SIZE = 20;
  private readonly MAX_PAGE_SIZE = 100;
  
  // Main search method - searches across multiple indices
  async search(query: SearchQuery): Promise<SearchResult> {
    if (!isElasticsearchEnabled()) {
      return this.emptyResult(query);
    }
    
    const client = await getOptionalElasticsearchClient();
    if (!client) {
      return this.emptyResult(query);
    }
    
    const page = query.pagination?.page || 1;
    const pageSize = Math.min(query.pagination?.pageSize || this.DEFAULT_PAGE_SIZE, this.MAX_PAGE_SIZE);
    const from = (page - 1) * pageSize;
    
    // Determine which indices to search
    const indices = this.getSearchIndices(query.entities);
    
    // Build the ES query
    const esQuery = this.buildQuery(query);
    
    // Build aggregations if requested
    const aggs = query.includeAggregations ? this.buildAggregations(query) : undefined;
    
    // Build highlight config
    const highlight = query.highlight !== false ? this.buildHighlight() : undefined;
    
    try {
      const response = await client.search({
        index: indices.join(','),
        body: {
          query: esQuery,
          from,
          size: pageSize,
          sort: this.buildSort(query.sort),
          highlight,
          aggs,
          track_total_hits: true,
        },
      });
      
      const total = typeof response.hits.total === 'number' 
        ? response.hits.total 
        : response.hits.total?.value || 0;
      
      return {
        hits: this.transformHits(response.hits.hits),
        total,
        aggregations: aggs ? this.transformAggregations(response.aggregations) : undefined,
        took: response.took,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      logger.error('Search failed:', error);
      throw error;
    }
  }
  
  // Global search - searches all entity types
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
  
  // Entity-specific search
  async searchEvents(q: string, filters?: SearchFilters, page = 1, pageSize = 20): Promise<SearchResult> {
    return this.search({
      q,
      entities: ['events'],
      filters,
      pagination: { page, pageSize },
      highlight: true,
      fuzzy: true,
    });
  }
  
  async searchTasks(q: string, filters?: SearchFilters, page = 1, pageSize = 20): Promise<SearchResult> {
    return this.search({
      q,
      entities: ['tasks'],
      filters,
      pagination: { page, pageSize },
      highlight: true,
      fuzzy: true,
    });
  }
  
  async searchContacts(q: string, filters?: SearchFilters, page = 1, pageSize = 20): Promise<SearchResult> {
    return this.search({
      q,
      entities: ['contacts'],
      filters,
      pagination: { page, pageSize },
      highlight: true,
      fuzzy: true,
    });
  }
  
  async searchOrganizations(q: string, filters?: SearchFilters, page = 1, pageSize = 20): Promise<SearchResult> {
    return this.search({
      q,
      entities: ['organizations'],
      filters,
      pagination: { page, pageSize },
      highlight: true,
      fuzzy: true,
    });
  }
  
  async searchLeads(q: string, filters?: SearchFilters, page = 1, pageSize = 20): Promise<SearchResult> {
    return this.search({
      q,
      entities: ['leads'],
      filters,
      pagination: { page, pageSize },
      highlight: true,
      fuzzy: true,
    });
  }
  
  // Autocomplete / Suggestions
  async getSuggestions(prefix: string, entities?: EntityType[], limit = 10): Promise<SearchSuggestion[]> {
    if (!isElasticsearchEnabled() || prefix.length < 2) {
      return [];
    }
    
    const client = await getOptionalElasticsearchClient();
    if (!client) return [];
    
    const indices = this.getSearchIndices(entities);
    
    try {
      const response = await client.search({
        index: indices.join(','),
        body: {
          suggest: {
            name_suggest: {
              prefix,
              completion: {
                field: 'suggest',
                size: limit,
                skip_duplicates: true,
                fuzzy: {
                  fuzziness: 'AUTO',
                },
              },
            },
          },
          // Also do a prefix query for partial matches
          query: {
            multi_match: {
              query: prefix,
              type: 'phrase_prefix',
              fields: ['nameEn', 'nameAr', 'titleEn', 'titleAr', 'email'],
            },
          },
          size: limit,
          _source: ['nameEn', 'nameAr', 'email'],
        },
      });
      
      const suggestions: SearchSuggestion[] = [];
      
      // Extract completion suggestions
      const completions = response.suggest?.name_suggest?.[0]?.options || [];
      for (const opt of completions) {
        suggestions.push({
          text: opt.text,
          score: opt._score || 0,
          type: 'completion',
        });
      }
      
      // Extract prefix match suggestions
      for (const hit of response.hits.hits) {
        const source = hit._source as any;
        const text = source.nameEn || source.nameAr || source.email;
        if (text && !suggestions.find(s => s.text === text)) {
          suggestions.push({
            text,
            score: hit._score || 0,
            type: 'phrase',
          });
        }
      }
      
      return suggestions.slice(0, limit);
    } catch (error) {
      logger.error('Suggestions failed:', error);
      return [];
    }
  }
  
  // Build the main query
  private buildQuery(query: SearchQuery): any {
    const must: any[] = [];
    const filter: any[] = [];
    
    // Main text search
    if (query.q && query.q.trim()) {
      const searchFields = this.getSearchFields(query.entities);
      
      must.push({
        bool: {
          should: [
            // Exact phrase match (highest priority)
            {
              multi_match: {
                query: query.q,
                type: 'phrase',
                fields: searchFields,
                boost: 3,
              },
            },
            // Best fields match
            {
              multi_match: {
                query: query.q,
                type: 'best_fields',
                fields: searchFields,
                boost: 2,
              },
            },
            // Cross fields for multi-word queries
            {
              multi_match: {
                query: query.q,
                type: 'cross_fields',
                fields: searchFields,
                operator: 'and',
                boost: 1.5,
              },
            },
            // Fuzzy match for typos (if enabled)
            ...(query.fuzzy !== false ? [{
              multi_match: {
                query: query.q,
                type: 'best_fields',
                fields: searchFields,
                fuzziness: 'AUTO',
                boost: 1,
              },
            }] : []),
          ],
          minimum_should_match: 1,
        },
      });
    }
    
    // Apply filters
    if (query.filters) {
      const filterClauses = this.buildFilters(query.filters);
      filter.push(...filterClauses);
    }
    
    return {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        filter: filter.length > 0 ? filter : undefined,
      },
    };
  }
  
  // Build filter clauses
  private buildFilters(filters: SearchFilters): any[] {
    const clauses: any[] = [];
    
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
      clauses.push({ terms: { category: filters.category } });
    }
    
    // Date range filter
    if (filters.dateRange) {
      const rangeClause: any = { range: { startDate: {} } };
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
    if (filters.country?.length) {
      clauses.push({ terms: { country: filters.country } });
    }
    
    // Lead status filter
    if (filters.leadStatus?.length) {
      clauses.push({ terms: { leadStatus: filters.leadStatus } });
    }
    
    // Department filter
    if (filters.departmentId?.length) {
      clauses.push({ terms: { departmentId: filters.departmentId } });
    }
    
    // Created date range
    if (filters.createdDateRange) {
      const rangeClause: any = { range: { createdAt: {} } };
      if (filters.createdDateRange.start) {
        rangeClause.range.createdAt.gte = filters.createdDateRange.start.toISOString();
      }
      if (filters.createdDateRange.end) {
        rangeClause.range.createdAt.lte = filters.createdDateRange.end.toISOString();
      }
      if (rangeClause.range.createdAt.gte || rangeClause.range.createdAt.lte) {
        clauses.push(rangeClause);
      }
    }
    
    return clauses;
  }
  
  // Build aggregations
  private buildAggregations(query: SearchQuery): any {
    return {
      entityTypes: {
        terms: { field: '_index', size: 10 },
      },
      categories: {
        terms: { field: 'category', size: 20 },
      },
      eventTypes: {
        terms: { field: 'eventType', size: 10 },
      },
      statuses: {
        terms: { field: 'status', size: 10 },
      },
      priorities: {
        terms: { field: 'priority', size: 5 },
      },
      departments: {
        terms: { field: 'departmentId', size: 20 },
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
  
  // Build highlight configuration
  private buildHighlight(): any {
    return {
      pre_tags: ['<mark>'],
      post_tags: ['</mark>'],
      fields: {
        nameEn: { number_of_fragments: 0 },
        nameAr: { number_of_fragments: 0 },
        titleEn: { number_of_fragments: 0 },
        description: { number_of_fragments: 2, fragment_size: 150 },
        notes: { number_of_fragments: 2, fragment_size: 150 },
        email: { number_of_fragments: 0 },
      },
    };
  }
  
  // Build sort configuration
  private buildSort(sort?: { field: string; direction: 'asc' | 'desc' }): any[] {
    if (sort) {
      return [{ [sort.field]: { order: sort.direction } }];
    }
    
    // Default: relevance score, then by date
    return [
      { _score: { order: 'desc' } },
      { startDate: { order: 'desc', missing: '_last' } },
      { createdAt: { order: 'desc', missing: '_last' } },
    ];
  }
  
  // Get indices to search
  private getSearchIndices(entities?: EntityType[]): string[] {
    if (!entities || entities.length === 0) {
      return Object.values(ENTITY_INDEX_MAP);
    }
    
    return entities.map(e => ENTITY_INDEX_MAP[e]).filter(Boolean);
  }
  
  // Get search fields based on entity types
  private getSearchFields(entities?: EntityType[]): string[] {
    if (!entities || entities.length === 0) {
      // All fields from all entities
      const allFields = new Set<string>();
      for (const fields of Object.values(ENTITY_SEARCH_FIELDS)) {
        for (const field of fields) {
          allFields.add(field);
        }
      }
      return Array.from(allFields);
    }
    
    const fields = new Set<string>();
    for (const entity of entities) {
      for (const field of ENTITY_SEARCH_FIELDS[entity] || []) {
        fields.add(field);
      }
    }
    return Array.from(fields);
  }
  
  // Transform ES hits to our format
  private transformHits(hits: any[]): SearchHit[] {
    return hits.map(hit => ({
      id: hit._id,
      index: hit._index,
      entityType: this.indexToEntityType(hit._index),
      score: hit._score,
      source: hit._source,
      highlight: hit.highlight,
    }));
  }
  
  // Transform aggregations to our format
  private transformAggregations(aggs: any): SearchAggregations | undefined {
    if (!aggs) return undefined;
    
    const transform = (buckets: any[]) => 
      buckets?.map((b: any) => ({ key: b.key, count: b.doc_count })) || [];
    
    return {
      entityTypes: transform(aggs.entityTypes?.buckets),
      categories: transform(aggs.categories?.buckets),
      eventTypes: transform(aggs.eventTypes?.buckets),
      statuses: transform(aggs.statuses?.buckets),
      priorities: transform(aggs.priorities?.buckets),
      departments: transform(aggs.departments?.buckets),
      dateHistogram: transform(aggs.dateHistogram?.buckets),
    };
  }
  
  // Map index name to entity type
  private indexToEntityType(index: string): EntityType {
    for (const [entity, indexName] of Object.entries(ENTITY_INDEX_MAP)) {
      if (index.startsWith(indexName)) {
        return entity as EntityType;
      }
    }
    return 'events'; // Default
  }
  
  // Empty result for when ES is disabled
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
}

export const searchService = new ElasticsearchSearchService();
```

### Search Routes (`server/routes/search.routes.ts`)
```typescript
import { Router } from 'express';
import { searchService } from '../services/elasticsearch-search.service';
import { isAuthenticated } from '../auth';
import { z } from 'zod';

const router = Router();

// Search query validation
const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  entities: z.array(z.enum(['events', 'tasks', 'contacts', 'organizations', 'leads', 'agreements'])).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  // Filters
  eventType: z.array(z.string()).optional(),
  eventScope: z.array(z.string()).optional(),
  category: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  priority: z.array(z.string()).optional(),
  isArchived: z.coerce.boolean().optional(),
  dateStart: z.coerce.date().optional(),
  dateEnd: z.coerce.date().optional(),
  // Options
  fuzzy: z.coerce.boolean().default(true),
  includeAggregations: z.coerce.boolean().default(true),
});

// Global search endpoint
router.get('/api/search', isAuthenticated, async (req, res) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    
    const result = await searchService.search({
      q: params.q,
      entities: params.entities,
      filters: {
        eventType: params.eventType,
        eventScope: params.eventScope,
        category: params.category,
        status: params.status,
        priority: params.priority,
        isArchived: params.isArchived,
        dateRange: params.dateStart || params.dateEnd ? {
          start: params.dateStart,
          end: params.dateEnd,
        } : undefined,
      },
      pagination: { page: params.page, pageSize: params.pageSize },
      fuzzy: params.fuzzy,
      highlight: true,
      includeAggregations: params.includeAggregations,
    });
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid search parameters', details: error.errors });
    }
    throw error;
  }
});

// Entity-specific search endpoints
router.get('/api/search/events', isAuthenticated, async (req, res) => {
  const { q, page, pageSize, ...filters } = req.query;
  const result = await searchService.searchEvents(
    String(q || ''),
    filters as any,
    Number(page) || 1,
    Number(pageSize) || 20
  );
  res.json(result);
});

router.get('/api/search/tasks', isAuthenticated, async (req, res) => {
  const { q, page, pageSize, ...filters } = req.query;
  const result = await searchService.searchTasks(
    String(q || ''),
    filters as any,
    Number(page) || 1,
    Number(pageSize) || 20
  );
  res.json(result);
});

router.get('/api/search/contacts', isAuthenticated, async (req, res) => {
  const { q, page, pageSize, ...filters } = req.query;
  const result = await searchService.searchContacts(
    String(q || ''),
    filters as any,
    Number(page) || 1,
    Number(pageSize) || 20
  );
  res.json(result);
});

router.get('/api/search/organizations', isAuthenticated, async (req, res) => {
  const { q, page, pageSize, ...filters } = req.query;
  const result = await searchService.searchOrganizations(
    String(q || ''),
    filters as any,
    Number(page) || 1,
    Number(pageSize) || 20
  );
  res.json(result);
});

router.get('/api/search/leads', isAuthenticated, async (req, res) => {
  const { q, page, pageSize, ...filters } = req.query;
  const result = await searchService.searchLeads(
    String(q || ''),
    filters as any,
    Number(page) || 1,
    Number(pageSize) || 20
  );
  res.json(result);
});

// Autocomplete / Suggestions
router.get('/api/search/suggestions', isAuthenticated, async (req, res) => {
  const { q, entities, limit } = req.query;
  
  if (!q || String(q).length < 2) {
    return res.json([]);
  }
  
  const suggestions = await searchService.getSuggestions(
    String(q),
    entities ? (Array.isArray(entities) ? entities : [entities]) as any : undefined,
    Number(limit) || 10
  );
  
  res.json(suggestions);
});

export default router;
```

---

## Files to Create
- `server/elasticsearch/types/search.types.ts` - Search type definitions
- `server/services/elasticsearch-search.service.ts` - Core search service
- `server/routes/search.routes.ts` - Search API endpoints

## Files to Modify
- `server/routes.ts` - Register search routes

## Acceptance Criteria
- [ ] Global search across all entity types
- [ ] Entity-specific search endpoints
- [ ] Fuzzy matching handles typos
- [ ] Arabic and English text both searchable
- [ ] Search highlights in results
- [ ] Faceted search with aggregations
- [ ] Autocomplete suggestions
- [ ] Pagination with total count
- [ ] Configurable field boosting
- [ ] Date range filtering
- [ ] Status/category filtering

## Performance Considerations
- Query caching for repeated searches
- Efficient pagination with from/size
- Field limiting for large documents
- Index aliasing for zero-downtime updates

## Dependencies
- Task 03: Arabic/English Analyzers
- Task 04: Index Management
