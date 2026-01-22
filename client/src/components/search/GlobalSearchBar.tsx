/**
 * GlobalSearchBar Component
 * 
 * A search input with autocomplete suggestions and search history.
 * Supports keyboard navigation and RTL layouts.
 * 
 * @module components/search/GlobalSearchBar
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Search, X, Clock, TrendingUp, Loader2, Command } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSuggestions } from '@/hooks/use-suggestions';
import { cn } from '@/lib/utils';

interface GlobalSearchBarProps {
  /** Additional CSS classes */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Callback when search is submitted */
  onSearch?: (query: string) => void;
  /** Compact mode for header */
  compact?: boolean;
  /** Default value for the search input */
  defaultValue?: string;
  /** Keep the query in the input after search (useful for search results page) */
  keepQueryAfterSearch?: boolean;
  /** Hero mode with animated styling */
  hero?: boolean;
}

const MAX_HISTORY = 5;
const STORAGE_KEY = 'eventcal_search_history';

export function GlobalSearchBar({
  className,
  placeholder,
  autoFocus,
  onSearch,
  compact = false,
  defaultValue = '',
  keepQueryAfterSearch = false,
  hero = false,
}: GlobalSearchBarProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  
  const [query, setQuery] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  // Sync with defaultValue changes
  useEffect(() => {
    if (defaultValue !== query) {
      setQuery(defaultValue);
    }
  }, [defaultValue]);

  const { suggestions, isLoading, isFetching } = useSuggestions(query);

  // Get search history from localStorage
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, [history]);

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Handle search
  const handleSearch = useCallback((searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;

    addToHistory(trimmed);
    setIsOpen(false);
    
    // Only clear query if not keeping it (for header search, clear after navigation)
    // For search results page, keep the query visible
    if (!keepQueryAfterSearch) {
      setQuery('');
    }
    
    if (onSearch) {
      onSearch(trimmed);
    } else {
      setLocation(`/admin/search?q=${encodeURIComponent(trimmed)}`);
    }
  }, [setLocation, addToHistory, onSearch, keepQueryAfterSearch]);

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
          const item = items[selectedIndex];
          const term = typeof item === 'string' ? item : item.text;
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

  // Determine if dropdown should show
  // For query >= 2: show when we have suggestions OR first time loading
  // For query < 2: show history if available
  const showDropdown = isOpen && (
    query.length >= 2 
      ? (suggestions.length > 0 || isLoading)  // Keep open with previous results during fetch
      : history.length > 0
  );

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {hero ? (
        // Hero mode with animated styling
        <div className={cn(
          "relative group transition-all duration-300",
          isFocused && "scale-[1.02]"
        )}>
          {/* Gradient glow effect */}
          <div className={cn(
            "absolute -inset-1 rounded-2xl opacity-0 blur-xl transition-opacity duration-500",
            "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500",
            isFocused && "opacity-30"
          )} />
          
          {/* Search container */}
          <div className={cn(
            "relative flex items-center gap-3 px-5 py-4 rounded-xl",
            "bg-background/80 backdrop-blur-sm border-2",
            "transition-all duration-300",
            isFocused 
              ? "border-primary shadow-lg shadow-primary/10" 
              : "border-border hover:border-primary/50",
            isRTL && "flex-row-reverse"
          )}>
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              isFocused ? "bg-primary/10" : "bg-muted"
            )}>
              {isFetching ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Search className={cn(
                  "h-5 w-5 transition-colors",
                  isFocused ? "text-primary" : "text-muted-foreground"
                )} />
              )}
            </div>
            
            <Input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                setIsOpen(true);
                setIsFocused(true);
              }}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || t('search.placeholder', 'Search events, tasks, contacts...')}
              className={cn(
                "flex-1 border-0 bg-transparent text-lg focus-visible:ring-0 focus-visible:ring-offset-0",
                "placeholder:text-muted-foreground/60",
                isRTL && "text-right"
              )}
              autoFocus={autoFocus}
              dir={isRTL ? 'rtl' : 'ltr'}
            />

            {/* Keyboard shortcut hint */}
            <div className={cn(
              "hidden sm:flex items-center gap-1 text-xs text-muted-foreground",
              "px-2 py-1 rounded-md bg-muted/50"
            )}>
              <Command className="h-3 w-3" />
              <span>K</span>
            </div>

            {query && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuery('')}
                className="h-8 w-8 p-0 hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        // Standard mode
        <div className="relative">
          <Search className={cn(
            'absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground',
            isRTL ? 'right-3' : 'left-3'
          )} />
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || t('search.placeholder', 'Search events, tasks, contacts...')}
            className={cn(
              compact ? 'h-8' : 'h-10',
              isRTL ? 'pr-9 pl-9' : 'pl-9 pr-9'
            )}
            autoFocus={autoFocus}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          {(query || isFetching) && (
            <div className={cn(
              'absolute top-1/2 -translate-y-1/2',
              isRTL ? 'left-1' : 'right-1'
            )}>
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : query && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setQuery('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {showDropdown && (
        <div className={cn(
          'absolute top-full mt-1 w-full bg-popover border rounded-md shadow-lg z-50 overflow-hidden',
          'max-h-80 overflow-y-auto'
        )}>
          {query.length >= 2 ? (
            // Suggestions
            <div className="py-2">
              <div className="px-3 py-1 text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {t('search.suggestions.title', 'Suggestions')}
                {isFetching && suggestions.length > 0 && (
                  <Loader2 className="h-3 w-3 animate-spin ml-auto" />
                )}
              </div>
              {isLoading && suggestions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {t('common.loading', 'Loading...')}
                </div>
              ) : suggestions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {t('search.noSuggestions', 'No suggestions found')}
                </div>
              ) : (
                suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.text}-${index}`}
                    className={cn(
                      'w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 text-sm',
                      selectedIndex === index && 'bg-accent'
                    )}
                    onClick={() => handleSearch(suggestion.text)}
                  >
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span 
                      className="truncate"
                      dangerouslySetInnerHTML={{ 
                        __html: suggestion.highlighted || suggestion.text 
                      }} 
                    />
                    {suggestion.entityType && (
                      <span className="ml-auto text-xs text-muted-foreground capitalize">
                        {(suggestion.entityType || 'item').replace('-', ' ')}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          ) : (
            // History
            <div className="py-2">
              <div className="px-3 py-1 text-xs text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t('search.recentSearches', 'Recent Searches')}
                </span>
                {history.length > 0 && (
                  <button
                    className="text-xs hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearHistory();
                    }}
                  >
                    {t('common.clear', 'Clear')}
                  </button>
                )}
              </div>
              {history.map((term, index) => (
                <button
                  key={term}
                  className={cn(
                    'w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 text-sm',
                    selectedIndex === index && 'bg-accent'
                  )}
                  onClick={() => handleSearch(term)}
                >
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{term}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
