/**
 * useSuggestions Hook
 * 
 * Provides autocomplete suggestions for search queries.
 * Debounces the input to avoid excessive API calls.
 * 
 * @module hooks/useSuggestions
 */

import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './use-debounce';
import type { SearchSuggestion, EntityType } from '@/types/search';

interface UseSuggestionsOptions {
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Maximum number of suggestions */
  limit?: number;
  /** Entity types to search */
  entities?: EntityType[];
}

interface UseSuggestionsReturn {
  suggestions: SearchSuggestion[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
}

/**
 * Hook for getting search suggestions / autocomplete
 */
export function useSuggestions(
  prefix: string,
  options: UseSuggestionsOptions = {}
): UseSuggestionsReturn {
  const { debounceMs = 150, limit = 10, entities } = options;
  
  const debouncedPrefix = useDebounce(prefix, debounceMs);

  const { data: suggestions = [], isLoading, isFetching, error } = useQuery<SearchSuggestion[]>({
    queryKey: ['suggestions', debouncedPrefix, entities, limit],
    queryFn: async () => {
      if (debouncedPrefix.length < 2) return [];
      
      const params = new URLSearchParams();
      params.set('q', debouncedPrefix);
      params.set('limit', String(limit));
      if (entities?.length) {
        entities.forEach(e => params.append('entities', e));
      }
      
      const response = await fetch(`/api/search/suggestions?${params}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: debouncedPrefix.length >= 2,
    staleTime: 60000,
    // Keep previous data while fetching new results to prevent flickering
    placeholderData: (previousData) => previousData,
  });

  return {
    suggestions,
    // Only show loading on initial fetch, not when keeping previous data
    isLoading: isLoading && !suggestions.length,
    isFetching,
    error: error as Error | null,
  };
}
