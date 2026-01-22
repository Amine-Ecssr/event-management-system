import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './use-debounce';

export interface AutocompleteOption {
  value: string;
  label: string;
  labelAr?: string;
  type: string;
  id: string | number;
}

export interface AutocompleteResponse {
  options: AutocompleteOption[];
  took: number;
}

export interface UseAutocompleteOptions {
  /** Entity type to search */
  entityType: 'events' | 'contacts' | 'organizations' | 'tasks' | 'partnerships';
  /** Debounce delay in ms (default: 200) */
  debounceMs?: number;
  /** Minimum characters to trigger search (default: 2) */
  minChars?: number;
  /** Maximum results (default: 10) */
  limit?: number;
  /** Whether autocomplete is enabled */
  enabled?: boolean;
}

/**
 * Hook for entity-specific autocomplete
 * 
 * @example
 * ```tsx
 * const { query, setQuery, options, isLoading } = useAutocomplete({
 *   entityType: 'contacts',
 *   minChars: 2,
 *   limit: 5
 * });
 * 
 * return (
 *   <input
 *     value={query}
 *     onChange={(e) => setQuery(e.target.value)}
 *   />
 * );
 * ```
 */
export function useAutocomplete(options: UseAutocompleteOptions) {
  const {
    entityType,
    debounceMs = 200,
    minChars = 2,
    limit = 10,
    enabled = true,
  } = options;

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, debounceMs);

  const {
    data,
    isLoading,
    error,
    isFetching,
  } = useQuery<AutocompleteResponse>({
    queryKey: ['autocomplete', entityType, debouncedQuery, limit],
    queryFn: async () => {
      if (debouncedQuery.length < minChars) {
        return { options: [], took: 0 };
      }
      const params = new URLSearchParams({
        q: debouncedQuery,
        limit: String(limit),
      });
      const response = await fetch(`/api/autocomplete/${entityType}?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Autocomplete failed');
      }
      return response.json();
    },
    enabled: enabled && debouncedQuery.length >= minChars,
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 60000, // Keep in cache for 1 minute
  });

  const autocompleteOptions = useMemo(
    () => data?.options || [],
    [data]
  );

  const clear = () => {
    setQuery('');
  };

  return {
    /** Current query value */
    query,
    /** Set query value */
    setQuery,
    /** Autocomplete options */
    options: autocompleteOptions,
    /** Whether loading */
    isLoading: isLoading || isFetching,
    /** Error if any */
    error,
    /** Query time in ms */
    took: data?.took || 0,
    /** Clear query */
    clear,
  };
}
