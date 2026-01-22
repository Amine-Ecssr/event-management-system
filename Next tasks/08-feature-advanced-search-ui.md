# Feature: Advanced Search UI (Elastiflix-Inspired)

## Type
Feature / Frontend

## Priority
�� High

## Estimated Effort
8-10 hours

## Description
Build an advanced search interface inspired by Netflix's Elastiflix demo. Features instant search, faceted filtering, result highlighting, and a responsive design for both desktop and mobile.

## Requirements

### Search Components
- Global search bar with autocomplete
- Search results page with faceted filters
- Entity-specific result cards
- Keyboard navigation support
- Search history

---

## Complete Implementation

### Custom Hooks

#### useSearch Hook (`client/src/hooks/useSearch.ts`)
```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from './useDebounce';
import type { SearchResult, SearchQuery, SearchFilters, EntityType } from '@/types/search';

interface UseSearchOptions {
  debounceMs?: number;
  initialQuery?: string;
  initialFilters?: SearchFilters;
  initialEntities?: EntityType[];
  pageSize?: number;
}

export function useSearch(options: UseSearchOptions = {}) {
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
  
  const debouncedQuery = useDebounce(query, debounceMs);
  const queryClient = useQueryClient();
  
  // Build search params
  const searchParams = new URLSearchParams();
  if (debouncedQuery) searchParams.set('q', debouncedQuery);
  if (entities?.length) searchParams.set('entities', entities.join(','));
  searchParams.set('page', String(page));
  searchParams.set('pageSize', String(pageSize));
  searchParams.set('includeAggregations', 'true');
  
  // Add filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, String(v)));
      } else if (value instanceof Date) {
        searchParams.set(key, value.toISOString());
      } else {
        searchParams.set(key, String(value));
      }
    }
  });
  
  // Search query
  const {
    data: results,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<SearchResult>({
    queryKey: ['search', debouncedQuery, filters, entities, page],
    queryFn: async () => {
      if (!debouncedQuery.trim()) {
        return { hits: [], total: 0, took: 0, page: 1, pageSize, totalPages: 0 };
      }
      
      const response = await fetch(`/api/search?${searchParams}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000,
    placeholderData: (previous) => previous,
  });
  
  // Update filter
  const updateFilter = useCallback((key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page
  }, []);
  
  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
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
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('page', String(page + 1));
      
      queryClient.prefetchQuery({
        queryKey: ['search', debouncedQuery, filters, entities, page + 1],
        queryFn: async () => {
          const response = await fetch(`/api/search?${nextParams}`);
          return response.json();
        },
      });
    }
  }, [results, page]);
  
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
    error,
    refetch,
  };
}
```

#### useSuggestions Hook (`client/src/hooks/useSuggestions.ts`)
```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './useDebounce';

export function useSuggestions(prefix: string, debounceMs = 150) {
  const debouncedPrefix = useDebounce(prefix, debounceMs);
  
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['suggestions', debouncedPrefix],
    queryFn: async () => {
      if (debouncedPrefix.length < 2) return [];
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(debouncedPrefix)}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: debouncedPrefix.length >= 2,
    staleTime: 60000,
  });
  
  return { suggestions, isLoading };
}
```

### Components

#### GlobalSearchBar (`client/src/components/search/GlobalSearchBar.tsx`)
```tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSuggestions } from '@/hooks/useSuggestions';
import { cn } from '@/lib/utils';

interface GlobalSearchBarProps {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

const MAX_HISTORY = 5;

export function GlobalSearchBar({ className, placeholder, autoFocus }: GlobalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  const { suggestions, isLoading } = useSuggestions(query);
  
  // Get search history from localStorage
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('searchHistory') || '[]');
    } catch {
      return [];
    }
  });
  
  // Add to history
  const addToHistory = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    
    const updated = [trimmed, ...history.filter(h => h !== trimmed)].slice(0, MAX_HISTORY);
    setHistory(updated);
    localStorage.setItem('searchHistory', JSON.stringify(updated));
  }, [history]);
  
  // Handle search
  const handleSearch = useCallback((searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    
    addToHistory(trimmed);
    setIsOpen(false);
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  }, [navigate, addToHistory]);
  
  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const items = query.length >= 2 ? suggestions : history;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && items[selectedIndex]) {
          const term = typeof items[selectedIndex] === 'string' 
            ? items[selectedIndex] 
            : (items[selectedIndex] as any).text;
          handleSearch(term);
        } else if (query.trim()) {
          handleSearch(query);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  }, [query, suggestions, history, selectedIndex, handleSearch]);
  
  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [query]);
  
  const showDropdown = isOpen && (query.length >= 2 ? suggestions.length > 0 : history.length > 0);
  
  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Search events, tasks, contacts...'}
          className="pl-9 pr-9"
          autoFocus={autoFocus}
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => setQuery('')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      
      {showDropdown && (
        <div className="absolute top-full mt-1 w-full bg-popover border rounded-md shadow-lg z-50 overflow-hidden">
          {query.length >= 2 ? (
            // Suggestions
            <div className="py-2">
              <div className="px-3 py-1 text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Suggestions
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.text}
                  className={cn(
                    'w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2',
                    selectedIndex === index && 'bg-accent'
                  )}
                  onClick={() => handleSearch(suggestion.text)}
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span dangerouslySetInnerHTML={{ __html: suggestion.highlighted || suggestion.text }} />
                </button>
              ))}
            </div>
          ) : (
            // History
            <div className="py-2">
              <div className="px-3 py-1 text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Recent Searches
              </div>
              {history.map((term, index) => (
                <button
                  key={term}
                  className={cn(
                    'w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2',
                    selectedIndex === index && 'bg-accent'
                  )}
                  onClick={() => handleSearch(term)}
                >
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {term}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

#### SearchResults Page (`client/src/pages/SearchResults.tsx`)
```tsx
import { useSearchParams } from 'react-router-dom';
import { useSearch } from '@/hooks/useSearch';
import { GlobalSearchBar } from '@/components/search/GlobalSearchBar';
import { SearchFilters } from '@/components/search/SearchFilters';
import { SearchResultCard } from '@/components/search/SearchResultCard';
import { SearchAggregations } from '@/components/search/SearchAggregations';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';

export default function SearchResults() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const {
    query,
    setQuery,
    filters,
    updateFilter,
    clearFilters,
    entities,
    toggleEntity,
    page,
    setPage,
    results,
    isLoading,
    isFetching,
  } = useSearch({ initialQuery, pageSize: 20 });
  
  // Sync query with URL
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    setSearchParams({ q: newQuery });
  };
  
  return (
    <div className="container mx-auto py-6">
      {/* Search Header */}
      <div className="mb-6">
        <GlobalSearchBar
          className="max-w-2xl mx-auto"
          autoFocus
        />
      </div>
      
      <div className="flex gap-6">
        {/* Sidebar Filters */}
        <aside className="w-64 shrink-0 hidden lg:block">
          <SearchFilters
            filters={filters}
            onFilterChange={updateFilter}
            onClearAll={clearFilters}
            entities={entities}
            onToggleEntity={toggleEntity}
            aggregations={results?.aggregations}
          />
        </aside>
        
        {/* Results */}
        <main className="flex-1 min-w-0">
          {/* Results Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {results ? (
                <>
                  {t('search.resultsCount', { count: results.total })} 
                  {results.took && (
                    <span className="ml-1">
                      ({results.took}ms)
                    </span>
                  )}
                </>
              ) : isLoading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                t('search.enterQuery')
              )}
            </div>
            
            {/* Aggregation Pills */}
            {results?.aggregations && (
              <SearchAggregations
                aggregations={results.aggregations}
                entities={entities}
                onToggleEntity={toggleEntity}
              />
            )}
          </div>
          
          {/* Results List */}
          <div className="space-y-4">
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))
            ) : results?.hits.length === 0 ? (
              // No results
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {t('search.noResults', { query })}
                </p>
              </div>
            ) : (
              // Results
              results?.hits.map((hit) => (
                <SearchResultCard
                  key={`${hit.index}-${hit.id}`}
                  hit={hit}
                  query={query}
                />
              ))
            )}
          </div>
          
          {/* Pagination */}
          {results && results.totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination
                currentPage={page}
                totalPages={results.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
```

#### SearchResultCard (`client/src/components/search/SearchResultCard.tsx`)
```tsx
import { Link } from 'react-router-dom';
import { Calendar, CheckSquare, User, Building2, Target, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SearchHit, EntityType } from '@/types/search';

interface SearchResultCardProps {
  hit: SearchHit;
  query: string;
}

const ENTITY_CONFIG: Record<EntityType, { icon: any; color: string; route: string }> = {
  events: { icon: Calendar, color: 'bg-blue-500', route: '/events' },
  tasks: { icon: CheckSquare, color: 'bg-green-500', route: '/tasks' },
  contacts: { icon: User, color: 'bg-purple-500', route: '/contacts' },
  organizations: { icon: Building2, color: 'bg-orange-500', route: '/organizations' },
  leads: { icon: Target, color: 'bg-pink-500', route: '/leads' },
  agreements: { icon: FileText, color: 'bg-cyan-500', route: '/partnerships/agreements' },
  attendees: { icon: User, color: 'bg-indigo-500', route: '/events' },
  invitees: { icon: User, color: 'bg-teal-500', route: '/events' },
};

export function SearchResultCard({ hit, query }: SearchResultCardProps) {
  const config = ENTITY_CONFIG[hit.entityType] || ENTITY_CONFIG.events;
  const Icon = config.icon;
  
  // Get display fields based on entity type
  const getDisplayFields = () => {
    const source = hit.source;
    const highlight = hit.highlight || {};
    
    return {
      title: highlight.nameEn?.[0] || highlight.titleEn?.[0] || source.nameEn || source.titleEn || source.name || 'Untitled',
      titleAr: source.nameAr || source.titleAr,
      subtitle: getSubtitle(hit.entityType, source),
      description: highlight.description?.[0] || source.description?.substring(0, 200),
      badges: getBadges(hit.entityType, source),
    };
  };
  
  const getSubtitle = (type: EntityType, source: any): string => {
    switch (type) {
      case 'events':
        return source.startDate ? new Date(source.startDate).toLocaleDateString() : '';
      case 'tasks':
        return source.status || '';
      case 'contacts':
        return source.email || source.phone || '';
      case 'organizations':
        return source.industry || source.country || '';
      case 'leads':
        return source.companyName || '';
      default:
        return '';
    }
  };
  
  const getBadges = (type: EntityType, source: any): string[] => {
    const badges: string[] = [];
    if (source.category) badges.push(source.category);
    if (source.eventType) badges.push(source.eventType);
    if (source.status) badges.push(source.status);
    if (source.priority) badges.push(source.priority);
    return badges.slice(0, 3);
  };
  
  const fields = getDisplayFields();
  const linkTo = `${config.route}/${hit.id}`;
  
  return (
    <Link to={linkTo}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex gap-4">
            {/* Entity Icon */}
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', config.color)}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 
                    className="font-medium text-foreground line-clamp-1"
                    dangerouslySetInnerHTML={{ __html: fields.title }}
                  />
                  {fields.titleAr && (
                    <p className="text-sm text-muted-foreground line-clamp-1" dir="rtl">
                      {fields.titleAr}
                    </p>
                  )}
                </div>
                
                {/* Score indicator */}
                {hit.score > 0 && (
                  <Badge variant="outline" className="shrink-0">
                    {Math.round(hit.score * 10) / 10}
                  </Badge>
                )}
              </div>
              
              {/* Subtitle */}
              {fields.subtitle && (
                <p className="text-sm text-muted-foreground mt-1">
                  {fields.subtitle}
                </p>
              )}
              
              {/* Description with highlighting */}
              {fields.description && (
                <p 
                  className="text-sm text-muted-foreground mt-2 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: fields.description }}
                />
              )}
              
              {/* Badges */}
              {fields.badges.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {fields.badges.map(badge => (
                    <Badge key={badge} variant="secondary" className="text-xs">
                      {badge}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

#### SearchFilters (`client/src/components/search/SearchFilters.tsx`)
```tsx
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { SearchFilters as Filters, EntityType, SearchAggregations } from '@/types/search';

interface SearchFiltersProps {
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: any) => void;
  onClearAll: () => void;
  entities?: EntityType[];
  onToggleEntity: (entity: EntityType) => void;
  aggregations?: SearchAggregations;
}

const ENTITY_LABELS: Record<EntityType, string> = {
  events: 'Events',
  tasks: 'Tasks',
  contacts: 'Contacts',
  organizations: 'Organizations',
  leads: 'Leads',
  agreements: 'Agreements',
  attendees: 'Attendees',
  invitees: 'Invitees',
};

export function SearchFilters({
  filters,
  onFilterChange,
  onClearAll,
  entities,
  onToggleEntity,
  aggregations,
}: SearchFiltersProps) {
  const { t } = useTranslation();
  
  const hasFilters = Object.values(filters).some(v => v !== undefined) || entities?.length;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('search.filters')}</h3>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            <X className="h-4 w-4 mr-1" />
            {t('common.clearAll')}
          </Button>
        )}
      </div>
      
      <Accordion type="multiple" defaultValue={['entities', 'category', 'dates']}>
        {/* Entity Type Filter */}
        <AccordionItem value="entities">
          <AccordionTrigger>{t('search.entityType')}</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {Object.entries(ENTITY_LABELS).map(([key, label]) => {
                const entityKey = key as EntityType;
                const count = aggregations?.entityTypes?.find(
                  e => e.key.includes(entityKey)
                )?.count;
                
                return (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`entity-${key}`}
                      checked={entities?.includes(entityKey) ?? false}
                      onCheckedChange={() => onToggleEntity(entityKey)}
                    />
                    <Label htmlFor={`entity-${key}`} className="flex-1 cursor-pointer">
                      {label}
                      {count !== undefined && (
                        <span className="text-muted-foreground ml-1">({count})</span>
                      )}
                    </Label>
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
        
        {/* Category Filter */}
        {aggregations?.categories && aggregations.categories.length > 0 && (
          <AccordionItem value="category">
            <AccordionTrigger>{t('search.category')}</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {aggregations.categories.map(cat => (
                  <div key={cat.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cat-${cat.key}`}
                      checked={filters.category?.includes(cat.key) ?? false}
                      onCheckedChange={(checked) => {
                        const current = filters.category || [];
                        onFilterChange(
                          'category',
                          checked ? [...current, cat.key] : current.filter(c => c !== cat.key)
                        );
                      }}
                    />
                    <Label htmlFor={`cat-${cat.key}`} className="flex-1 cursor-pointer">
                      {cat.key}
                      <span className="text-muted-foreground ml-1">({cat.count})</span>
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
        
        {/* Date Range Filter */}
        <AccordionItem value="dates">
          <AccordionTrigger>{t('search.dateRange')}</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <div>
                <Label>{t('search.startDate')}</Label>
                <DatePicker
                  date={filters.dateRange?.start}
                  onSelect={(date) => onFilterChange('dateRange', { ...filters.dateRange, start: date })}
                />
              </div>
              <div>
                <Label>{t('search.endDate')}</Label>
                <DatePicker
                  date={filters.dateRange?.end}
                  onSelect={(date) => onFilterChange('dateRange', { ...filters.dateRange, end: date })}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
        
        {/* Status Filter */}
        {aggregations?.statuses && aggregations.statuses.length > 0 && (
          <AccordionItem value="status">
            <AccordionTrigger>{t('search.status')}</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {aggregations.statuses.map(status => (
                  <div key={status.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status.key}`}
                      checked={filters.status?.includes(status.key) ?? false}
                      onCheckedChange={(checked) => {
                        const current = filters.status || [];
                        onFilterChange(
                          'status',
                          checked ? [...current, status.key] : current.filter(s => s !== status.key)
                        );
                      }}
                    />
                    <Label htmlFor={`status-${status.key}`} className="flex-1 cursor-pointer">
                      {status.key}
                      <span className="text-muted-foreground ml-1">({status.count})</span>
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
        
        {/* Archived Filter */}
        <AccordionItem value="archived">
          <AccordionTrigger>{t('search.includeArchived')}</AccordionTrigger>
          <AccordionContent>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-archived"
                checked={filters.isArchived === undefined}
                onCheckedChange={(checked) => 
                  onFilterChange('isArchived', checked ? undefined : false)
                }
              />
              <Label htmlFor="include-archived">{t('search.showArchived')}</Label>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
```

---

## Files to Create
- `client/src/hooks/useSearch.ts` - Search hook with state management
- `client/src/hooks/useSuggestions.ts` - Autocomplete hook
- `client/src/components/search/GlobalSearchBar.tsx` - Main search input
- `client/src/components/search/SearchFilters.tsx` - Filter sidebar
- `client/src/components/search/SearchResultCard.tsx` - Result display card
- `client/src/components/search/SearchAggregations.tsx` - Aggregation pills
- `client/src/pages/SearchResults.tsx` - Search results page
- `client/src/types/search.ts` - Search type definitions

## Files to Modify
- `client/src/App.tsx` - Add search route
- `client/src/components/layout/Header.tsx` - Add global search bar
- `client/src/i18n/locales/en/search.json` - English translations
- `client/src/i18n/locales/ar/search.json` - Arabic translations

## Acceptance Criteria
- [ ] Global search bar in header with autocomplete
- [ ] Search results page with faceted filters
- [ ] Entity-specific result cards
- [ ] Highlight matches in results
- [ ] Keyboard navigation (arrows, enter, escape)
- [ ] Search history in localStorage
- [ ] Responsive design (mobile sidebar collapse)
- [ ] RTL support for Arabic results
- [ ] Pagination with prefetching
- [ ] Loading states and skeletons

## Dependencies
- Task 07: Search Service (backend API)
