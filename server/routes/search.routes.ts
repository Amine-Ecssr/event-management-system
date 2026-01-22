/**
 * Elasticsearch Search Routes
 * 
 * API endpoints for searching across all indexed entities.
 * Provides global search, entity-specific search, and autocomplete.
 * 
 * Endpoints:
 * - GET /api/search - Global search across all entities
 * - GET /api/search/events - Search events only
 * - GET /api/search/tasks - Search tasks only
 * - GET /api/search/contacts - Search contacts only
 * - GET /api/search/organizations - Search organizations only
 * - GET /api/search/leads - Search leads only
 * - GET /api/search/partnerships - Search partnerships only
 * - GET /api/search/agreements - Search agreements only
 * - GET /api/search/archived - Search archived events only
 * - GET /api/search/suggestions - Autocomplete suggestions
 * 
 * @module routes/search
 */

import { Router, Request, Response } from 'express';
import { searchService } from '../services/elasticsearch-search.service';
import { isAuthenticated } from '../auth';
import { z } from 'zod';
import { SearchFilters, EntityType } from '../elasticsearch/types/search.types';
import { buildIndexName, ES_ENTITIES, ES_INDEX_PREFIX, ES_INDEX_SUFFIX } from '../elasticsearch/config';

const router = Router();

// ==================== Validation Schemas ====================

/**
 * Main search query validation schema
 */
const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  // Handle both single string and array for entities
  entities: z.union([z.array(z.string()), z.string().transform(s => [s])]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  // Event filters
  eventType: z.union([z.array(z.string()), z.string().transform(s => [s])]).optional(),
  eventScope: z.union([z.array(z.string()), z.string().transform(s => [s])]).optional(),
  category: z.union([z.array(z.string()), z.string().transform(s => [s])]).optional(),
  dateStart: z.coerce.date().optional(),
  dateEnd: z.coerce.date().optional(),
  isArchived: z.coerce.boolean().optional(),
  // Task filters
  status: z.union([z.array(z.string()), z.string().transform(s => [s])]).optional(),
  priority: z.union([z.array(z.string()), z.string().transform(s => [s])]).optional(),
  // Common filters - both ID-based and name-based
  departmentId: z.union([
    z.array(z.coerce.number().int()),
    z.coerce.number().int().transform(n => [n])
  ]).optional(),
  organizationId: z.union([
    z.array(z.coerce.number().int()),
    z.coerce.number().int().transform(n => [n])
  ]).optional(),
  departmentName: z.union([z.array(z.string()), z.string().transform(s => [s])]).optional(),
  organizationName: z.union([z.array(z.string()), z.string().transform(s => [s])]).optional(),
  // Options
  fuzzy: z.coerce.boolean().default(true),
  includeAggregations: z.coerce.boolean().default(true),
  // Sort
  sortField: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
});

/**
 * Suggestions query validation schema
 */
const suggestionsQuerySchema = z.object({
  q: z.string().min(1).max(200),
  entities: z.union([z.array(z.string()), z.string().transform(s => [s])]).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

// ==================== Helper Functions ====================

/**
 * Build SearchFilters from validated query params
 */
function buildFilters(params: z.infer<typeof searchQuerySchema>): SearchFilters & { departmentName?: string[]; organizationName?: string[] } {
  const filters: SearchFilters & { departmentName?: string[]; organizationName?: string[] } = {};
  
  if (params.eventType) filters.eventType = params.eventType;
  if (params.eventScope) filters.eventScope = params.eventScope;
  if (params.category) filters.category = params.category;
  if (params.dateStart || params.dateEnd) {
    filters.dateRange = {
      start: params.dateStart,
      end: params.dateEnd,
    };
  }
  if (typeof params.isArchived === 'boolean') filters.isArchived = params.isArchived;
  if (params.status) filters.status = params.status;
  if (params.priority) filters.priority = params.priority;
  if (params.departmentId) filters.departmentId = params.departmentId;
  if (params.organizationId) filters.organizationId = params.organizationId;
  if (params.departmentName) filters.departmentName = params.departmentName;
  if (params.organizationName) filters.organizationName = params.organizationName;
  
  return filters;
}

// ==================== Routes ====================

/**
 * GET /api/search
 * Global search across all entity types
 */
router.get('/api/search', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    
    // DIRECT ES call bypassing service
    const { getOptionalElasticsearchClient } = await import('../elasticsearch/client');
    const client = await getOptionalElasticsearchClient();
    
    if (!client) {
      return res.json({ hits: [], total: 0, error: 'ES client not available' });
    }
    
    // Map entity types to indices using configured prefix/suffix
    // Note: attendees and invitees are excluded - they're junction tables already covered by contacts
    const entityToIndex: Record<string, string> = {
      'events': buildIndexName(ES_ENTITIES.EVENTS),
      'archived-events': buildIndexName(ES_ENTITIES.ARCHIVED_EVENTS),
      'tasks': buildIndexName(ES_ENTITIES.TASKS),
      'contacts': buildIndexName(ES_ENTITIES.CONTACTS),
      'organizations': buildIndexName(ES_ENTITIES.ORGANIZATIONS),
      'partnerships': buildIndexName(ES_ENTITIES.PARTNERSHIPS),
      'agreements': buildIndexName(ES_ENTITIES.AGREEMENTS),
      'leads': buildIndexName(ES_ENTITIES.LEADS),
      'departments': buildIndexName(ES_ENTITIES.DEPARTMENTS),
      'lead-interactions': buildIndexName(ES_ENTITIES.LEAD_INTERACTIONS),
      'partnership-activities': buildIndexName(ES_ENTITIES.PARTNERSHIP_ACTIVITIES),
      'partnership-interactions': buildIndexName(ES_ENTITIES.PARTNERSHIP_INTERACTIONS),
      'updates': buildIndexName(ES_ENTITIES.UPDATES),
    };
    
    // Filter indices based on selected entities
    let searchIndices: string;
    if (params.entities && params.entities.length > 0) {
      const selectedIndices = params.entities
        .map(e => entityToIndex[e])
        .filter(Boolean);
      searchIndices = selectedIndices.length > 0 
        ? selectedIndices.join(',')
        : Object.values(entityToIndex).join(',');
    } else {
      searchIndices = Object.values(entityToIndex).join(',');
    }
    
    const allFields = ['name^3', 'nameAr^3', 'title^3', 'titleAr^3', 'email^2.5', 'phone^2', 'organizationName^2', 'description^1.5', 'descriptionAr^1.5', 'notes^1', 'notesAr^1', 'content^1.5', 'contentAr^1.5', 'location^2', 'locationAr^2', 'website^1.5'];
    
    // Build filters
    const filters = buildFilters(params);
    const mustClauses: any[] = [];
    
    if (filters.category && filters.category.length > 0) {
      mustClauses.push({ terms: { 'category.keyword': filters.category } });
    }
    if (filters.eventType && filters.eventType.length > 0) {
      mustClauses.push({ terms: { 'eventType.keyword': filters.eventType } });
    }
    if (filters.eventScope && filters.eventScope.length > 0) {
      mustClauses.push({ terms: { 'eventScope.keyword': filters.eventScope } });
    }
    if (filters.status && filters.status.length > 0) {
      mustClauses.push({ terms: { 'status.keyword': filters.status } });
    }
    if (filters.priority && filters.priority.length > 0) {
      mustClauses.push({ terms: { 'priority.keyword': filters.priority } });
    }
    if (filters.departmentId && filters.departmentId.length > 0) {
      mustClauses.push({ terms: { departmentId: filters.departmentId } });
    }
    if (filters.organizationId && filters.organizationId.length > 0) {
      mustClauses.push({ terms: { organizationId: filters.organizationId } });
    }
    // Name-based filters (from aggregations)
    if (filters.departmentName && filters.departmentName.length > 0) {
      mustClauses.push({ terms: { departmentName: filters.departmentName } });
    }
    if (filters.organizationName && filters.organizationName.length > 0) {
      // organizationName in contacts/attendees/invitees is text with .keyword sub-field
      mustClauses.push({ terms: { 'organizationName.keyword': filters.organizationName } });
    }
    if (filters.dateRange?.start || filters.dateRange?.end) {
      const dateFilter: any = { range: { startDate: {} } };
      if (filters.dateRange.start) dateFilter.range.startDate.gte = filters.dateRange.start;
      if (filters.dateRange.end) dateFilter.range.startDate.lte = filters.dateRange.end;
      mustClauses.push(dateFilter);
    }
    if (typeof filters.isArchived === 'boolean') {
      mustClauses.push({ term: { isArchived: filters.isArchived } });
    }
    
    const queryBody: any = {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: params.q,
                fields: allFields,
                type: 'best_fields',
                fuzziness: params.fuzzy ? 'AUTO' : 0,
                operator: 'or'
              }
            },
            ...mustClauses
          ]
        }
      },
      size: params.pageSize,
      from: (params.page - 1) * params.pageSize,
      track_total_hits: true,
      highlight: {
        fields: {
          'name': {},
          'nameAr': {},
          'title': {},
          'titleAr': {},
          'description': {},
          'descriptionAr': {},
          'content': {},
          'contentAr': {},
        },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
      },
    };
    
    // Add aggregations if requested
    // Note: Use .keyword for text fields, and unmapped_type to handle fields missing from some indices
    if (params.includeAggregations) {
      queryBody.aggs = {
        entityTypes: {
          terms: { field: '_index', size: 20 }
        },
        categories: {
          terms: { field: 'category.keyword', size: 50, missing: 'Unknown' }
        },
        eventTypes: {
          terms: { field: 'eventType.keyword', size: 10, missing: 'Unknown' }
        },
        eventScopes: {
          terms: { field: 'eventScope.keyword', size: 10, missing: 'Unknown' }
        },
        statuses: {
          terms: { field: 'status.keyword', size: 20, missing: 'Unknown' }
        },
        priorities: {
          terms: { field: 'priority.keyword', size: 10, missing: 'Unknown' }
        },
        departments: {
          terms: { field: 'departmentName', size: 50, missing: 'Unknown' }
        },
        organizations: {
          // organizationName in contacts/attendees/invitees is text with .keyword sub-field
          terms: { field: 'organizationName.keyword', size: 100, missing: 'Unknown' }
        },
      };
    }
    
    // Add sorting
    if (params.sortField) {
      const sortOrder = params.sortDirection || 'asc';
      queryBody.sort = [{ [params.sortField]: sortOrder }];
    }
    
    const response = await client.search({
      index: searchIndices,
      body: queryBody,
    });
    
    const total = typeof response.hits.total === 'number'
      ? response.hits.total
      : (response.hits.total as { value: number })?.value || 0;
    
    // Transform hits to expected format
    // Extract entity type from index name using configured prefix/suffix
    const hits = response.hits.hits.map((hit: any) => ({
      id: hit._id,
      index: hit._index,
      entityType: hit._index.replace(`${ES_INDEX_PREFIX}-`, '').replace(`-${ES_INDEX_SUFFIX}`, ''),
      score: hit._score || 0,
      source: hit._source,
      highlight: hit.highlight,
    }));
    
    // Transform aggregations
    const aggregations: any = {
      entityTypes: [],
      categories: [],
      eventTypes: [],
      eventScopes: [],
      statuses: [],
      priorities: [],
      departments: [],
      organizations: [],
    };
    
    if (response.aggregations) {
      const aggs = response.aggregations as any;
      if (aggs.entityTypes?.buckets) {
        aggregations.entityTypes = aggs.entityTypes.buckets.map((b: any) => ({
          key: b.key.replace(`${ES_INDEX_PREFIX}-`, '').replace(`-${ES_INDEX_SUFFIX}`, ''),
          count: b.doc_count,
        }));
      }
      if (aggs.categories?.buckets) {
        aggregations.categories = aggs.categories.buckets.map((b: any) => ({
          key: b.key,
          count: b.doc_count,
        }));
      }
      if (aggs.eventTypes?.buckets) {
        aggregations.eventTypes = aggs.eventTypes.buckets.map((b: any) => ({
          key: b.key,
          count: b.doc_count,
        }));
      }
      if (aggs.eventScopes?.buckets) {
        aggregations.eventScopes = aggs.eventScopes.buckets.map((b: any) => ({
          key: b.key,
          count: b.doc_count,
        }));
      }
      if (aggs.statuses?.buckets) {
        aggregations.statuses = aggs.statuses.buckets.map((b: any) => ({
          key: b.key,
          count: b.doc_count,
        }));
      }
      if (aggs.priorities?.buckets) {
        aggregations.priorities = aggs.priorities.buckets.map((b: any) => ({
          key: b.key,
          count: b.doc_count,
        }));
      }
      if (aggs.departments?.buckets) {
        aggregations.departments = aggs.departments.buckets.map((b: any) => ({
          key: b.key,
          count: b.doc_count,
        }));
      }
      if (aggs.organizations?.buckets) {
        aggregations.organizations = aggs.organizations.buckets.map((b: any) => ({
          key: b.key,
          count: b.doc_count,
        }));
      }
    }
    
    res.json({
      hits,
      total,
      aggregations,
      took: response.took,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid search parameters', 
        details: error.errors 
      });
    }
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/events
 * Search events only
 */
router.get('/api/search/events', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    const filters = buildFilters(params);
    
    const result = await searchService.searchEvents(
      params.q,
      filters,
      params.page,
      params.pageSize
    );
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid search parameters', 
        details: error.errors 
      });
    }
    console.error('Event search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/archived
 * Search archived events only
 */
router.get('/api/search/archived', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    const filters = buildFilters(params);
    
    const result = await searchService.searchArchivedEvents(
      params.q,
      filters,
      params.page,
      params.pageSize
    );
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid search parameters', 
        details: error.errors 
      });
    }
    console.error('Archived search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/tasks
 * Search tasks only
 */
router.get('/api/search/tasks', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    const filters = buildFilters(params);
    
    const result = await searchService.searchTasks(
      params.q,
      filters,
      params.page,
      params.pageSize
    );
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid search parameters', 
        details: error.errors 
      });
    }
    console.error('Task search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/contacts
 * Search contacts only
 */
router.get('/api/search/contacts', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    const filters = buildFilters(params);
    
    const result = await searchService.searchContacts(
      params.q,
      filters,
      params.page,
      params.pageSize
    );
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid search parameters', 
        details: error.errors 
      });
    }
    console.error('Contact search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/organizations
 * Search organizations only
 */
router.get('/api/search/organizations', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    const filters = buildFilters(params);
    
    const result = await searchService.searchOrganizations(
      params.q,
      filters,
      params.page,
      params.pageSize
    );
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid search parameters', 
        details: error.errors 
      });
    }
    console.error('Organization search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/leads
 * Search leads only
 */
router.get('/api/search/leads', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    const filters = buildFilters(params);
    
    const result = await searchService.searchLeads(
      params.q,
      filters,
      params.page,
      params.pageSize
    );
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid search parameters', 
        details: error.errors 
      });
    }
    console.error('Lead search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/partnerships
 * Search partnerships only
 */
router.get('/api/search/partnerships', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    const filters = buildFilters(params);
    
    const result = await searchService.searchPartnerships(
      params.q,
      filters,
      params.page,
      params.pageSize
    );
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid search parameters', 
        details: error.errors 
      });
    }
    console.error('Partnership search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/agreements
 * Search agreements only
 */
router.get('/api/search/agreements', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    const filters = buildFilters(params);
    
    const result = await searchService.searchAgreements(
      params.q,
      filters,
      params.page,
      params.pageSize
    );
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid search parameters', 
        details: error.errors 
      });
    }
    console.error('Agreement search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/departments
 * Search departments only
 */
router.get('/api/search/departments', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    const filters = buildFilters(params);
    
    const result = await searchService.searchDepartments(
      params.q,
      filters,
      params.page,
      params.pageSize
    );
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid search parameters', 
        details: error.errors 
      });
    }
    console.error('Department search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/updates
 * Search weekly/monthly updates only
 */
router.get('/api/search/updates', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    const filters = buildFilters(params);
    
    const result = await searchService.searchUpdates(
      params.q,
      filters,
      params.page,
      params.pageSize
    );
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid search parameters', 
        details: error.errors 
      });
    }
    console.error('Update search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/suggestions
 * Get autocomplete suggestions
 */
router.get('/api/search/suggestions', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const params = suggestionsQuerySchema.parse(req.query);
    
    if (params.q.length < 2) {
      return res.json([]);
    }
    
    const suggestions = await searchService.getSuggestions(
      params.q,
      params.entities,
      params.limit
    );
    
    res.json(suggestions);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid parameters', 
        details: error.errors 
      });
    }
    console.error('Suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

/**
 * GET /api/search/status
 * Get search service status
 */
router.get('/api/search/status', isAuthenticated, async (_req: Request, res: Response) => {
  try {
    const status = await searchService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Search status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

export default router;
