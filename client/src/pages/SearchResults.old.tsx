/**
 * SearchResults Page
 * 
 * Full search results page with filters, pagination,
 * and aggregations.
 * 
 * @module pages/SearchResults
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useSearch } from '@/hooks/use-search';
import { GlobalSearchBar } from '@/components/search/GlobalSearchBar';
import { SearchFilters } from '@/components/search/SearchFilters';
import { SearchResultCard } from '@/components/search/SearchResultCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ListLoadingSkeleton } from '@/components/ui/loading-state';
import { EmptyState, NoSearchResultsEmptyState } from '@/components/ui/empty-state';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export default function SearchResults() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  const [, setLocation] = useLocation();
  
  // Get initial query from URL
  const getQueryFromUrl = () => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      return searchParams.get('q') || '';
    }
    return '';
  };
  
  // Track URL query changes
  const [urlQuery, setUrlQuery] = useState(getQueryFromUrl);
  
  // Listen for URL changes (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setUrlQuery(getQueryFromUrl());
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
  } = useSearch({ initialQuery: urlQuery, pageSize: 20 });

  // Update URL when query changes (but not on initial load)
  useEffect(() => {
    if (query && query !== urlQuery) {
      const newPath = `/admin/search?q=${encodeURIComponent(query)}`;
      setLocation(newPath, { replace: true });
      setUrlQuery(query);
    }
  }, [query, urlQuery, setLocation]);

  const handleSearch = (newQuery: string) => {
    setQuery(newQuery);
    setLocation(`/admin/search?q=${encodeURIComponent(newQuery)}`);
  };

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Search Header */}
      <div className="mb-6">
        <GlobalSearchBar
          className="max-w-2xl mx-auto"
          autoFocus={!urlQuery}
          onSearch={handleSearch}
          defaultValue={query}
          keepQueryAfterSearch
        />
      </div>

      <div className={cn(
        'flex gap-6',
        isRTL && 'flex-row-reverse'
      )}>
        {/* Sidebar Filters - Desktop */}
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
          <div className={cn(
            'flex items-center justify-between mb-4',
            isRTL && 'flex-row-reverse'
          )}>
            <div className="text-sm text-muted-foreground">
              {results ? (
                <>
                  {t('search.resultsCount', {
                    count: results.total,
                    defaultValue: '{{count}} results found',
                  })}
                  {results.took > 0 && (
                    <span className="ml-1">
                      ({results.took}ms)
                    </span>
                  )}
                </>
              ) : isLoading ? (
                <Skeleton className="h-4 w-32" />
              ) : query ? (
                t('search.searching', 'Searching...')
              ) : (
                t('search.enterQuery', 'Enter a search term to begin')
              )}
            </div>

            {/* Mobile Filters Button */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  {t('search.filters', 'Filters')}
                </Button>
              </SheetTrigger>
              <SheetContent side={isRTL ? 'left' : 'right'}>
                <SheetHeader>
                  <SheetTitle>{t('search.filters', 'Filters')}</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <SearchFilters
                    filters={filters}
                    onFilterChange={updateFilter}
                    onClearAll={clearFilters}
                    entities={entities}
                    onToggleEntity={toggleEntity}
                    aggregations={results?.aggregations}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Results List */}
          <div className="space-y-4">
            {isLoading ? (
              // Loading skeletons
              <ListLoadingSkeleton count={5} />
            ) : !query ? (
              // No query
              <EmptyState
                icon={Search}
                title={t('search.startSearching', 'Start Searching')}
                description={t('search.searchDescription', 
                  'Search across events, tasks, contacts, organizations, and more.'
                )}
              />
            ) : results?.hits.length === 0 ? (
              // No results
              <NoSearchResultsEmptyState searchTerm={query} />
            ) : (
              // Results
              <>
                {results?.hits.map((hit) => (
                  <SearchResultCard
                    key={`${hit.index}-${hit.id}`}
                    hit={hit}
                    query={query}
                  />
                ))}

                {/* Loading overlay when fetching */}
                {isFetching && !isLoading && (
                  <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50">
                    <div className="animate-pulse text-muted-foreground">
                      {t('common.loading', 'Loading...')}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pagination */}
          {results && results.totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                {t('common.previous', 'Previous')}
              </Button>
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                {t('search.pageOf', {
                  page,
                  totalPages: results.totalPages,
                  defaultValue: 'Page {{page}} of {{totalPages}}',
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= results.totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t('common.next', 'Next')}
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
