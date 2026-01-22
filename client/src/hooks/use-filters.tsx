import { createContext, useContext, useCallback, useMemo, useReducer, useEffect, useRef, ReactNode } from 'react';
import { useLocation } from 'wouter';

export interface Filters {
  selectedCategories: string[];
  selectedEventTypes: string[];
  selectedEventScopes: string[];
  selectedSources: string[];
  selectedDate: string | null;
}

type FilterAction =
  | { type: 'TOGGLE_FILTER'; filterType: keyof Filters; value: string }
  | { type: 'SET_FILTER'; filterType: keyof Filters; value: string[] | string | null }
  | { type: 'REMOVE_FILTER'; filterType: keyof Filters; value: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'INIT_FROM_URL'; filters: Filters };

function filterReducer(state: Filters, action: FilterAction): Filters {
  switch (action.type) {
    case 'INIT_FROM_URL':
      return action.filters;
      
    case 'TOGGLE_FILTER': {
      const { filterType, value } = action;
      if (filterType === 'selectedDate') {
        return { ...state, selectedDate: value };
      }
      const currentArray = state[filterType] as string[];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(v => v !== value)
        : [...currentArray, value];
      return { ...state, [filterType]: newArray };
    }
    
    case 'SET_FILTER': {
      const { filterType, value } = action;
      return { ...state, [filterType]: value };
    }
    
    case 'REMOVE_FILTER': {
      const { filterType, value } = action;
      if (filterType === 'selectedDate') {
        return { ...state, selectedDate: null };
      }
      const currentArray = state[filterType] as string[];
      return { ...state, [filterType]: currentArray.filter(v => v !== value) };
    }
    
    case 'CLEAR_ALL':
      return {
        selectedCategories: [],
        selectedEventTypes: [],
        selectedEventScopes: [],
        selectedSources: [],
        selectedDate: null,
      };
      
    default:
      return state;
  }
}

export interface UseFiltersReturn {
  filters: Filters;
  setFilter: (filterType: keyof Filters, value: string | string[] | null) => void;
  removeFilter: (filterType: keyof Filters, value: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

const FiltersContext = createContext<UseFiltersReturn | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const isInitialMount = useRef(true);
  
  // Initialize state from URL params on first render
  const [filters, dispatch] = useReducer(filterReducer, {
    selectedCategories: [],
    selectedEventTypes: [],
    selectedEventScopes: [],
    selectedSources: [],
    selectedDate: null,
  });
  
  // Initialize from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlFilters: Filters = {
      selectedCategories: params.get('categories')?.split(',').filter(Boolean) || [],
      selectedEventTypes: params.get('eventTypes')?.split(',').filter(Boolean) || [],
      selectedEventScopes: params.get('eventScopes')?.split(',').filter(Boolean) || [],
      selectedSources: params.get('sources')?.split(',').filter(Boolean) || [],
      selectedDate: params.get('date') || null,
    };
    
    // Only init if there are filters in the URL
    if (urlFilters.selectedCategories.length > 0 || 
        urlFilters.selectedEventTypes.length > 0 || 
        urlFilters.selectedEventScopes.length > 0 ||
        urlFilters.selectedSources.length > 0 || 
        urlFilters.selectedDate) {
      dispatch({ type: 'INIT_FROM_URL', filters: urlFilters });
    }
  }, []); // Only run on mount

  // Sync filters to URL (debounced to avoid re-renders during events)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const params = new URLSearchParams();
    
    if (filters.selectedCategories.length > 0) {
      params.set('categories', filters.selectedCategories.join(','));
    }
    
    if (filters.selectedEventTypes.length > 0) {
      params.set('eventTypes', filters.selectedEventTypes.join(','));
    }
    
    if (filters.selectedEventScopes.length > 0) {
      params.set('eventScopes', filters.selectedEventScopes.join(','));
    }
    
    if (filters.selectedSources.length > 0) {
      params.set('sources', filters.selectedSources.join(','));
    }
    
    if (filters.selectedDate) {
      params.set('date', filters.selectedDate);
    }
    
    const search = params.toString();
    const newPath = `${window.location.pathname}${search ? `?${search}` : ''}`;
    
    // Only update URL if it actually changed
    if (window.location.pathname + window.location.search !== newPath) {
      setLocation(newPath, { replace: true });
    }
  }, [filters, setLocation]);

  const setFilter = useCallback((filterType: keyof Filters, value: string | string[] | null) => {
    if (Array.isArray(value) || filterType === 'selectedDate') {
      dispatch({ type: 'SET_FILTER', filterType, value });
    } else if (value) {
      dispatch({ type: 'TOGGLE_FILTER', filterType, value });
    }
  }, []);

  const removeFilter = useCallback((filterType: keyof Filters, value: string) => {
    dispatch({ type: 'REMOVE_FILTER', filterType, value });
  }, []);

  const clearFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.selectedCategories.length > 0 ||
      filters.selectedEventTypes.length > 0 ||
      filters.selectedEventScopes.length > 0 ||
      filters.selectedSources.length > 0 ||
      filters.selectedDate !== null
    );
  }, [filters]);

  const value = {
    filters,
    setFilter,
    removeFilter,
    clearFilters,
    hasActiveFilters,
  };

  return (
    <FiltersContext.Provider value={value}>
      {children}
    </FiltersContext.Provider>
  );
}

export function useFilters(): UseFiltersReturn {
  const context = useContext(FiltersContext);
  if (!context) {
    throw new Error('useFilters must be used within FiltersProvider');
  }
  return context;
}
