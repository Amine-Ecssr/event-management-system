import { useState, useRef, useEffect, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, X, History, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { useQuery } from '@tanstack/react-query';

export interface Suggestion {
  text: string;
  textAr?: string;
  type: string;
  id: string | number;
  score: number;
  highlight?: string;
  metadata?: Record<string, any>;
}

export interface SuggestionResponse {
  suggestions: Suggestion[];
  didYouMean?: string;
  took: number;
}

export interface SearchInputWithSuggestionsProps {
  /** Current search value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Callback when a suggestion is selected */
  onSelect?: (suggestion: Suggestion) => void;
  /** Callback when search is submitted */
  onSubmit?: (query: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Entity types to search */
  types?: string[];
  /** Whether to show popular searches when empty */
  showPopular?: boolean;
  /** Whether to show search history */
  showHistory?: boolean;
  /** Minimum characters to trigger suggestions */
  minChars?: number;
  /** Maximum suggestions to show */
  maxSuggestions?: number;
}

const ENTITY_ICONS: Record<string, string> = {
  events: '📅',
  contacts: '👤',
  organizations: '🏢',
  tasks: '✅',
  partnerships: '🤝',
};

const ENTITY_COLORS: Record<string, string> = {
  events: 'text-blue-500',
  contacts: 'text-green-500',
  organizations: 'text-purple-500',
  tasks: 'text-orange-500',
  partnerships: 'text-pink-500',
};

/**
 * Enhanced search input with autocomplete suggestions and did-you-mean
 */
export const SearchInputWithSuggestions = forwardRef<HTMLInputElement, SearchInputWithSuggestionsProps>(
  (
    {
      value,
      onChange,
      onSelect,
      onSubmit,
      placeholder,
      className,
      types = ['events', 'contacts', 'organizations'],
      showPopular = true,
      showHistory = true,
      minChars = 2,
      maxSuggestions = 8,
    },
    ref
  ) => {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const debouncedValue = useDebounce(value, 200);

    // Search history from localStorage
    const [searchHistory, setSearchHistory] = useState<string[]>(() => {
      try {
        const stored = localStorage.getItem('searchHistory');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    });

    // Fetch suggestions
    const { data, isLoading } = useQuery<SuggestionResponse>({
      queryKey: ['suggestions', debouncedValue, types],
      queryFn: async () => {
        if (debouncedValue.length < minChars) {
          return { suggestions: [], took: 0 };
        }
        const params = new URLSearchParams({
          q: debouncedValue,
          types: types.join(','),
          limit: String(maxSuggestions),
        });
        const response = await fetch(`/api/suggest?${params}`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Suggestion failed');
        return response.json();
      },
      enabled: debouncedValue.length >= minChars,
      staleTime: 30000,
    });

    const suggestions = data?.suggestions || [];
    const didYouMean = data?.didYouMean;

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      const totalItems = suggestions.length + (didYouMean ? 1 : 0);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen && value.length >= minChars) {
            setIsOpen(true);
          } else if (totalItems > 0) {
            setSelectedIndex((prev) => Math.min(prev + 1, totalItems - 1));
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (selectedIndex > 0) {
            setSelectedIndex((prev) => prev - 1);
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (didYouMean && selectedIndex === 0) {
            handleDidYouMeanClick();
          } else if (selectedIndex >= (didYouMean ? 1 : 0)) {
            const suggestionIndex = selectedIndex - (didYouMean ? 1 : 0);
            if (suggestions[suggestionIndex]) {
              handleSelect(suggestions[suggestionIndex]);
            }
          } else if (value.trim()) {
            handleSubmit();
          }
          break;

        case 'Escape':
          setIsOpen(false);
          setSelectedIndex(-1);
          break;
      }
    };

    // Handle suggestion selection
    const handleSelect = (suggestion: Suggestion) => {
      const text = isRTL && suggestion.textAr ? suggestion.textAr : suggestion.text;
      onChange(text);
      setIsOpen(false);
      setSelectedIndex(-1);
      addToHistory(text);
      onSelect?.(suggestion);
    };

    // Handle did-you-mean click
    const handleDidYouMeanClick = () => {
      if (didYouMean) {
        onChange(didYouMean);
        setSelectedIndex(-1);
      }
    };

    // Handle search submit
    const handleSubmit = () => {
      if (value.trim()) {
        addToHistory(value.trim());
        setIsOpen(false);
        onSubmit?.(value.trim());
      }
    };

    // Add to search history
    const addToHistory = (query: string) => {
      const updated = [query, ...searchHistory.filter((h) => h !== query)].slice(0, 10);
      setSearchHistory(updated);
      localStorage.setItem('searchHistory', JSON.stringify(updated));
    };

    // Handle history item click
    const handleHistoryClick = (query: string) => {
      onChange(query);
      setIsOpen(false);
    };

    // Clear search
    const handleClear = () => {
      onChange('');
      setIsOpen(false);
      inputRef.current?.focus();
    };

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Open dropdown when typing
    useEffect(() => {
      if (debouncedValue.length >= minChars) {
        setIsOpen(true);
        setSelectedIndex(-1);
      }
    }, [debouncedValue, minChars]);

    const showDropdown = isOpen && (
      suggestions.length > 0 ||
      didYouMean ||
      (value.length === 0 && showHistory && searchHistory.length > 0)
    );

    return (
      <div ref={containerRef} className={cn('relative', className)}>
        <div className="relative">
          <Search
            className={cn(
              'absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground',
              isRTL ? 'right-3' : 'left-3'
            )}
          />
          <Input
            ref={ref || inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (value.length >= minChars || (showHistory && searchHistory.length > 0)) {
                setIsOpen(true);
              }
            }}
            placeholder={placeholder || t('common.search')}
            className={cn(isRTL ? 'pr-10 pl-10' : 'pl-10 pr-10')}
          />
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 flex items-center gap-1',
              isRTL ? 'left-3' : 'right-3'
            )}
          >
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {value && !isLoading && (
              <button
                onClick={handleClear}
                className="text-muted-foreground hover:text-foreground transition-colors"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-80 overflow-auto">
            {/* Did you mean */}
            {didYouMean && (
              <button
                onClick={handleDidYouMeanClick}
                className={cn(
                  'w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-accent border-b',
                  selectedIndex === 0 && 'bg-accent'
                )}
                type="button"
              >
                <span className="text-muted-foreground">{t('search.didYouMean')}:</span>
                <span className="font-medium text-primary">{didYouMean}</span>
              </button>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <ul className="py-1">
                {suggestions.map((suggestion, index) => {
                  const adjustedIndex = index + (didYouMean ? 1 : 0);
                  const displayText = isRTL && suggestion.textAr
                    ? suggestion.textAr
                    : suggestion.text;

                  return (
                    <li key={`${suggestion.type}-${suggestion.id}`}>
                      <button
                        onClick={() => handleSelect(suggestion)}
                        className={cn(
                          'w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-accent transition-colors',
                          adjustedIndex === selectedIndex && 'bg-accent'
                        )}
                        type="button"
                      >
                        <span className="flex-shrink-0">{ENTITY_ICONS[suggestion.type] || '📄'}</span>
                        <span
                          className="flex-1 truncate"
                          dangerouslySetInnerHTML={{
                            __html: suggestion.highlight || displayText,
                          }}
                        />
                        <span
                          className={cn(
                            'text-xs capitalize flex-shrink-0',
                            ENTITY_COLORS[suggestion.type] || 'text-muted-foreground'
                          )}
                        >
                          {t(`common.${suggestion.type}`, suggestion.type)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Search history (when empty) */}
            {value.length === 0 && showHistory && searchHistory.length > 0 && !suggestions.length && (
              <div className="py-1">
                <div className="px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-1">
                  <History className="h-3 w-3" />
                  {t('search.recentSearches')}
                </div>
                {searchHistory.slice(0, 5).map((query, index) => (
                  <button
                    key={index}
                    onClick={() => handleHistoryClick(query)}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
                    type="button"
                  >
                    <History className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{query}</span>
                  </button>
                ))}
              </div>
            )}

            {/* No results */}
            {value.length >= minChars && !isLoading && suggestions.length === 0 && !didYouMean && (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                {t('search.noSuggestions')}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

SearchInputWithSuggestions.displayName = 'SearchInputWithSuggestions';
