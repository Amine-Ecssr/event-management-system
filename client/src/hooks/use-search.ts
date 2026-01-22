/**
 * useSearch Hook
 * 
 * Provides search functionality with state management,
 * debouncing, filtering, pagination, and prefetching.
 * 
 * @module hooks/useSearch
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from './use-debounce';
import type { SearchResult, SearchFilters, EntityType } from '@/types/search';

interface UseSearchOptions {
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Initial search query */
  initialQuery?: string;
  /** Initial filters */
  initialFilters?: SearchFilters;
  /** Initial entity types to search */
  initialEntities?: EntityType[];
  /** Results per page */
  pageSize?: number;
}

interface UseSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  updateFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  clearFilters: () => void;
  entities: EntityType[] | undefined;
  setEntities: (entities: EntityType[] | undefined) => void;
  toggleEntity: (entity: EntityType) => void;
  page: number;
  setPage: (page: number) => void;
  results: SearchResult | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Build URLSearchParams from search state
 */
function buildSearchParams(
  query: string,
  entities: EntityType[] | undefined,
  filters: SearchFilters,
  page: number,
  pageSize: number
): URLSearchParams {
  const params = new URLSearchParams();
  
  if (query) params.set('q', query);
  if (entities?.length) entities.forEach(e => params.append('entities', e));
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  params.set('includeAggregations', 'true');
  params.set('fuzzy', 'true');
  
  // Add filters
  if (filters.eventType?.length) {
    filters.eventType.forEach(v => params.append('eventType', v));
  }
  if (filters.eventScope?.length) {
    filters.eventScope.forEach(v => params.append('eventScope', v));
  }
  if (filters.category?.length) {
    filters.category.forEach(v => params.append('category', v));
  }
  if (filters.status?.length) {
    filters.status.forEach(v => params.append('status', v));
  }
  if (filters.priority?.length) {
    filters.priority.forEach(v => params.append('priority', v));
  }
  if (filters.departmentId?.length) {
    filters.departmentId.forEach(v => params.append('departmentId', String(v)));
  }
  if (filters.organizationId?.length) {
    filters.organizationId.forEach(v => params.append('organizationId', String(v)));
  }
  // Name-based filters (from aggregations)
  if (filters.departmentName?.length) {
    filters.departmentName.forEach(v => params.append('departmentName', v));
  }
  if (filters.organizationName?.length) {
    filters.organizationName.forEach(v => params.append('organizationName', v));
  }
  if (typeof filters.isArchived === 'boolean') {
    params.set('isArchived', String(filters.isArchived));
  }
  if (filters.dateRange?.start) {
    params.set('dateStart', filters.dateRange.start.toISOString());
  }
  if (filters.dateRange?.end) {
    params.set('dateEnd', filters.dateRange.end.toISOString());
  }
  
  return params;
}

/**
 * Hook for searching across entities
 */
export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const {
    debounceMs = 300,
    initialQuery = '',
    initialFilters = {},
    initialEntities,
    pageSize = 20,
  } = options;

  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [entities, setEntities] = useState<EntityType[] | undefined>(initialEntities);
  const [page, setPage] = useState(1);

  // Sync query when initialQuery changes (e.g., from URL navigation)
  useEffect(() => {
    if (initialQuery !== query) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const debouncedQuery = useDebounce(query, debounceMs);
  const queryClient = useQueryClient();

  // Build search params
  const searchParams = buildSearchParams(debouncedQuery, entities, filters, page, pageSize);

  // Search query
  const {
    data: results,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<SearchResult>({
    queryKey: ['search', debouncedQuery, JSON.stringify(filters), entities, page],
    queryFn: async () => {
      if (!debouncedQuery.trim()) {
        return {
          hits: [],
          total: 0,
          took: 0,
          page: 1,
          pageSize,
          totalPages: 0,
        };
      }

      const response = await fetch(`/api/search?${searchParams}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Search failed');
      }
      return response.json();
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000,
    placeholderData: (previous) => previous,
  });

  // Update a single filter
  const updateFilter = useCallback(<K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
    setEntities(undefined);
    setPage(1);
  }, []);

  // Toggle entity type filter
  const toggleEntity = useCallback((entity: EntityType) => {
    setEntities(prev => {
      if (!prev) return [entity];
      if (prev.includes(entity)) {
        const next = prev.filter(e => e !== entity);
        return next.length === 0 ? undefined : next;
      }
      return [...prev, entity];
    });
    setPage(1);
  }, []);

  // Prefetch next page
  useEffect(() => {
    if (results && page < results.totalPages) {
      const nextParams = buildSearchParams(debouncedQuery, entities, filters, page + 1, pageSize);

      queryClient.prefetchQuery({
        queryKey: ['search', debouncedQuery, JSON.stringify(filters), entities, page + 1],
        queryFn: async () => {
          const response = await fetch(`/api/search?${nextParams}`);
          return response.json();
        },
      });
    }
  }, [results, page, debouncedQuery, filters, entities, pageSize, queryClient]);

  return {
    query,
    setQuery,
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    entities,
    setEntities,
    toggleEntity,
    page,
    setPage,
    results,
    isLoading: isLoading && debouncedQuery.length >= 2,
    isFetching,
    error: error as Error | null,
    refetch,
  };
}
