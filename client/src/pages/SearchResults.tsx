/**
 * SearchResults Page - Modern Feature-Rich Implementation
 * 
 * Beautiful search experience with:
 * - Hero-style search input with animated suggestions
 * - Quick filter chips with toggle groups
 * - Grid/list view toggle
 * - Enhanced result cards with hover effects
 * - Faceted search sidebar with collapsible sections
 * - Keyboard navigation support
 * - Recent searches and trending topics
 * 
 * @module pages/SearchResults
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { 
  Search, 
  SlidersHorizontal, 
  LayoutGrid, 
  LayoutList,
  Calendar as CalendarIcon,
  CheckSquare,
  User,
  Building2,
  Target,
  FileText,
  Users,
  Layers,
  FileEdit,
  Archive,
  X,
  Clock,
  TrendingUp,
  Sparkles,
  Filter,
  ChevronDown,
  Command,
  ArrowRight,
  Zap,
  History,
  CalendarRange,
  Tag,
  Flag,
  Globe,
  Home,
} from 'lucide-react';
import { useSearch } from '@/hooks/use-search';
import { SearchResultCard } from '@/components/search/SearchResultCard';
import { GlobalSearchBar } from '@/components/search/GlobalSearchBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import type { EntityType, SearchFilters, SearchAggregations } from '@/types/search';

// ============================================================
// Constants & Configuration
// ============================================================

interface EntityConfig {
  key: EntityType;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  labelKey: string;
}

const ENTITY_CONFIGS: EntityConfig[] = [
  { key: 'events', icon: CalendarIcon, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', labelKey: 'search.entities.events' },
  { key: 'tasks', icon: CheckSquare, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', labelKey: 'search.entities.tasks' },
  { key: 'contacts', icon: User, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', labelKey: 'search.entities.contacts' },
  { key: 'organizations', icon: Building2, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', labelKey: 'search.entities.organizations' },
  { key: 'leads', icon: Target, color: 'text-pink-600', bgColor: 'bg-pink-100 dark:bg-pink-900/30', labelKey: 'search.entities.leads' },
  { key: 'partnerships', icon: Building2, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', labelKey: 'search.entities.partnerships' },
  { key: 'departments', icon: Layers, color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30', labelKey: 'search.entities.departments' },
  { key: 'agreements', icon: FileText, color: 'text-cyan-600', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30', labelKey: 'search.entities.agreements' },
  { key: 'updates', icon: FileEdit, color: 'text-violet-600', bgColor: 'bg-violet-100 dark:bg-violet-900/30', labelKey: 'search.entities.updates' },
  { key: 'archived-events', icon: Archive, color: 'text-slate-600', bgColor: 'bg-slate-100 dark:bg-slate-900/30', labelKey: 'search.entities.archivedEvents' },
];

const QUICK_FILTERS: EntityConfig[] = ENTITY_CONFIGS.slice(0, 6);

const TRENDING_SEARCHES = [
  'upcoming events',
  'high priority tasks',
  'VIP contacts',
  'active partnerships',
];

// ============================================================
// Sub-Components
// ============================================================

/**
 * Quick filter chips for entity types
 */
function QuickFilterChips({
  entities,
  onToggle,
  aggregations,
}: {
  entities: EntityType[] | undefined;
  onToggle: (entity: EntityType) => void;
  aggregations?: Record<string, number>;
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';

  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className={cn(
        "flex items-center gap-2 pb-2",
        isRTL && "flex-row-reverse"
      )}>
        <Badge 
          variant="outline" 
          className={cn(
            "shrink-0 cursor-pointer transition-all hover:scale-105",
            !entities?.length && "bg-primary text-primary-foreground hover:bg-primary"
          )}
          onClick={() => {
            // Clear all entity filters
            if (entities?.length) {
              entities.forEach(e => onToggle(e));
            }
          }}
        >
          <Sparkles className="h-3 w-3 mr-1" />
          {t('search.allEntities', 'All')}
        </Badge>
        
        {QUICK_FILTERS.map(({ key, icon: Icon, color, bgColor, labelKey }) => {
          const isActive = entities?.includes(key);
          const count = aggregations?.[key];
          
          return (
            <Badge
              key={key}
              variant={isActive ? "default" : "outline"}
              className={cn(
                "shrink-0 cursor-pointer transition-all hover:scale-105 gap-1.5",
                isActive && bgColor,
                isActive && color,
                !isActive && "hover:bg-muted"
              )}
              onClick={() => onToggle(key)}
            >
              <Icon className="h-3 w-3" />
              <span>{t(labelKey, key)}</span>
              {count !== undefined && count > 0 && (
                <span className="text-[10px] opacity-70">({count})</span>
              )}
            </Badge>
          );
        })}
        
        <Badge variant="outline" className="shrink-0 text-muted-foreground">
          <Filter className="h-3 w-3 mr-1" />
          {t('search.filterBy', 'More filters')}
        </Badge>
      </div>
    </div>
  );
}

/**
 * View toggle between grid and list
 */
function ViewToggle({ 
  view, 
  onChange 
}: { 
  view: 'list' | 'grid'; 
  onChange: (view: 'list' | 'grid') => void;
}) {
  return (
    <TooltipProvider>
      <ToggleGroup 
        type="single" 
        value={view} 
        onValueChange={(v) => v && onChange(v as 'list' | 'grid')}
        className="bg-muted p-1 rounded-lg"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem 
              value="list" 
              aria-label="List view"
              className="data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              <LayoutList className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>List view</TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem 
              value="grid" 
              aria-label="Grid view"
              className="data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Grid view</TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </TooltipProvider>
  );
}

/**
 * Sidebar filter section
 */
function FilterSection({
  title,
  icon: Icon,
  defaultOpen = true,
  count,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:text-primary transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span>{title}</span>
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {count}
            </Badge>
          )}
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pb-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Date Range Picker Component
 */
function DateRangePicker({
  dateRange,
  onDateRangeChange,
}: {
  dateRange?: { start?: Date; end?: Date };
  onDateRangeChange: (range: { start?: Date; end?: Date } | undefined) => void;
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  const [isOpen, setIsOpen] = useState(false);
  
  const hasDateRange = dateRange?.start || dateRange?.end;
  
  const handleSelect = (date: Date | undefined, type: 'start' | 'end') => {
    if (type === 'start') {
      onDateRangeChange({ ...dateRange, start: date });
    } else {
      onDateRangeChange({ ...dateRange, end: date });
    }
  };
  
  const clearDateRange = () => {
    onDateRangeChange(undefined);
  };

  const presetRanges = [
    { label: t('search.datePresets.today', 'Today'), getValue: () => ({ start: new Date(), end: new Date() }) },
    { label: t('search.datePresets.thisWeek', 'This Week'), getValue: () => {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start, end };
    }},
    { label: t('search.datePresets.thisMonth', 'This Month'), getValue: () => {
      const now = new Date();
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
    }},
    { label: t('search.datePresets.thisYear', 'This Year'), getValue: () => {
      const now = new Date();
      return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) };
    }},
  ];

  return (
    <div className="space-y-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-full justify-start text-left font-normal h-9",
              !hasDateRange && "text-muted-foreground"
            )}
          >
            <CalendarRange className="mr-2 h-4 w-4" />
            {hasDateRange ? (
              <span className="truncate">
                {dateRange?.start ? format(dateRange.start, 'MMM d, yyyy') : '...'} 
                {' - '}
                {dateRange?.end ? format(dateRange.end, 'MMM d, yyyy') : '...'}
              </span>
            ) : (
              <span>{t('search.selectDateRange', 'Select date range')}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 border-b">
            <div className="flex flex-wrap gap-1">
              {presetRanges.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    onDateRangeChange(preset.getValue());
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex">
            <div className="border-r p-2">
              <p className="text-xs text-muted-foreground mb-2 px-2">{t('search.startDate', 'Start Date')}</p>
              <Calendar
                mode="single"
                selected={dateRange?.start}
                onSelect={(date) => handleSelect(date, 'start')}
                initialFocus
              />
            </div>
            <div className="p-2">
              <p className="text-xs text-muted-foreground mb-2 px-2">{t('search.endDate', 'End Date')}</p>
              <Calendar
                mode="single"
                selected={dateRange?.end}
                onSelect={(date) => handleSelect(date, 'end')}
                disabled={(date) => dateRange?.start ? date < dateRange.start : false}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {hasDateRange && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearDateRange}
          className="h-7 text-xs w-full text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3 mr-1" />
          {t('search.clearDateRange', 'Clear date range')}
        </Button>
      )}
    </div>
  );
}

/**
 * Aggregation Filter Component - Renders checkbox filters from aggregation buckets
 */
function AggregationFilter({
  title,
  icon: Icon,
  buckets,
  selectedValues,
  onToggle,
  maxItems = 8,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  buckets?: { key: string; count: number }[];
  selectedValues?: string[];
  onToggle: (value: string) => void;
  maxItems?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  
  if (!buckets || buckets.length === 0) return null;
  
  const displayBuckets = showAll ? buckets : buckets.slice(0, maxItems);
  const hasMore = buckets.length > maxItems;
  
  return (
    <FilterSection 
      title={title} 
      icon={Icon} 
      defaultOpen={false}
      count={selectedValues?.length}
    >
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {displayBuckets.map((bucket) => {
          const isSelected = selectedValues?.includes(bucket.key);
          return (
            <button
              key={bucket.key}
              onClick={() => onToggle(bucket.key)}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm",
                "transition-all duration-150",
                isSelected 
                  ? "bg-primary/10 text-primary" 
                  : "hover:bg-muted",
                isRTL && "flex-row-reverse"
              )}
            >
              <div className={cn(
                "flex items-center gap-2",
                isRTL && "flex-row-reverse"
              )}>
                <Checkbox 
                  checked={isSelected} 
                  className="pointer-events-none"
                />
                <span className={cn("truncate", isSelected && "font-medium")}>
                  {bucket.key}
                </span>
              </div>
              <Badge variant="secondary" className="h-5 px-1.5 text-xs shrink-0">
                {bucket.count}
              </Badge>
            </button>
          );
        })}
      </div>
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(!showAll)}
          className="w-full h-7 mt-2 text-xs"
        >
          {showAll 
            ? t('common.showLess', 'Show less') 
            : t('common.showMore', 'Show {{count}} more', { count: buckets.length - maxItems })}
        </Button>
      )}
    </FilterSection>
  );
}

/**
 * Enhanced sidebar filters
 */
function EnhancedFilters({
  entities,
  onToggleEntity,
  filters,
  onUpdateFilter,
  aggregations,
  onClearAll,
  hasFilters,
  onSearchClick,
}: {
  entities: EntityType[] | undefined;
  onToggleEntity: (entity: EntityType) => void;
  filters: SearchFilters;
  onUpdateFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  aggregations?: SearchAggregations;
  onClearAll: () => void;
  hasFilters: boolean;
  onSearchClick: (query: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';

  const getEntityCount = (key: EntityType): number | undefined => {
    const bucket = aggregations?.entityTypes?.find(e => 
      e.key.toLowerCase().includes(key.toLowerCase().replace('-', ''))
    );
    return bucket?.count;
  };

  // Helper to toggle array filter values
  const toggleArrayFilter = <K extends keyof SearchFilters>(
    key: K,
    value: string
  ) => {
    const current = (filters[key] as string[] | undefined) || [];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onUpdateFilter(key, next.length > 0 ? (next as SearchFilters[K]) : undefined);
  };

  return (
    <Card className="border-0 shadow-md bg-background/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className={cn(
          "flex items-center justify-between",
          isRTL && "flex-row-reverse"
        )}>
          <CardTitle className="text-base flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            {t('search.filters', 'Filters')}
          </CardTitle>
          {hasFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClearAll}
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
            >
              {t('common.clearAll', 'Clear')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-1">
        {/* Entity Type Filter */}
        <FilterSection 
          title={t('search.entityType', 'Entity Type')} 
          icon={Layers}
          count={entities?.length}
        >
          <div className="space-y-1">
            {ENTITY_CONFIGS.map(({ key, icon: Icon, color, bgColor, labelKey }) => {
              const isActive = entities?.includes(key);
              const count = getEntityCount(key);
              
              return (
                <button
                  key={key}
                  onClick={() => onToggleEntity(key)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
                    "transition-all duration-200",
                    isActive 
                      ? cn(bgColor, "shadow-sm") 
                      : "hover:bg-muted",
                    isRTL && "flex-row-reverse"
                  )}
                >
                  <div className={cn(
                    "flex items-center gap-2",
                    isRTL && "flex-row-reverse"
                  )}>
                    <Icon className={cn("h-4 w-4", isActive ? color : "text-muted-foreground")} />
                    <span className={isActive ? "font-medium" : ""}>{t(labelKey, key)}</span>
                  </div>
                  {count !== undefined && (
                    <Badge variant="secondary" className="text-xs h-5">
                      {count}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </FilterSection>
        
        <Separator className="my-2" />

        {/* Date Range Filter */}
        <FilterSection 
          title={t('search.dateRange', 'Date Range')} 
          icon={CalendarRange}
          count={filters.dateRange?.start || filters.dateRange?.end ? 1 : undefined}
        >
          <DateRangePicker
            dateRange={filters.dateRange}
            onDateRangeChange={(range) => onUpdateFilter('dateRange', range)}
          />
        </FilterSection>

        <Separator className="my-2" />

        {/* Category Filter */}
        <AggregationFilter
          title={t('search.category', 'Category')}
          icon={Tag}
          buckets={aggregations?.categories}
          selectedValues={filters.category}
          onToggle={(value) => toggleArrayFilter('category', value)}
        />

        {/* Status Filter */}
        <AggregationFilter
          title={t('search.status', 'Status')}
          icon={CheckSquare}
          buckets={aggregations?.statuses}
          selectedValues={filters.status}
          onToggle={(value) => toggleArrayFilter('status', value)}
        />

        {/* Priority Filter */}
        <AggregationFilter
          title={t('search.priority', 'Priority')}
          icon={Flag}
          buckets={aggregations?.priorities}
          selectedValues={filters.priority}
          onToggle={(value) => toggleArrayFilter('priority', value)}
        />

        {/* Event Type Filter */}
        <AggregationFilter
          title={t('search.eventType', 'Event Type')}
          icon={Globe}
          buckets={aggregations?.eventTypes}
          selectedValues={filters.eventType}
          onToggle={(value) => toggleArrayFilter('eventType', value)}
        />

        {/* Event Scope Filter */}
        <AggregationFilter
          title={t('search.eventScope', 'Event Scope')}
          icon={Home}
          buckets={aggregations?.eventScopes}
          selectedValues={filters.eventScope}
          onToggle={(value) => toggleArrayFilter('eventScope', value)}
        />

        {/* Department Filter */}
        <AggregationFilter
          title={t('search.department', 'Department')}
          icon={Building2}
          buckets={aggregations?.departments}
          selectedValues={filters.departmentName}
          onToggle={(value) => {
            const current = filters.departmentName || [];
            const next = current.includes(value)
              ? current.filter(v => v !== value)
              : [...current, value];
            onUpdateFilter('departmentName', next.length > 0 ? next : undefined);
          }}
        />

        {/* Organization Filter */}
        <AggregationFilter
          title={t('search.organization', 'Organization')}
          icon={Building2}
          buckets={aggregations?.organizations}
          selectedValues={filters.organizationName}
          onToggle={(value) => {
            const current = filters.organizationName || [];
            const next = current.includes(value)
              ? current.filter(v => v !== value)
              : [...current, value];
            onUpdateFilter('organizationName', next.length > 0 ? next : undefined);
          }}
        />

        <Separator className="my-2" />

        {/* Recent Searches */}
        <FilterSection 
          title={t('search.suggestions.recentSearches', 'Recent Searches')} 
          icon={History} 
          defaultOpen={false}
        >
          <RecentSearchesList onSearchClick={onSearchClick} />
        </FilterSection>
      </CardContent>
    </Card>
  );
}

/**
 * Recent searches list
 */
function RecentSearchesList({ onSearchClick }: { onSearchClick: (query: string) => void }) {
  const { t } = useTranslation();
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('recentSearches') || '[]').slice(0, 5);
    } catch {
      return [];
    }
  });

  const clearHistory = () => {
    localStorage.removeItem('recentSearches');
    setRecentSearches([]);
  };

  if (recentSearches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        {t('search.noRecentSearches', 'No recent searches')}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {recentSearches.map((search, i) => (
        <button
          key={i}
          onClick={() => onSearchClick(search)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-muted transition-colors"
        >
          <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="truncate">{search}</span>
        </button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={clearHistory}
        className="w-full h-7 mt-1 text-xs text-muted-foreground hover:text-destructive"
      >
        <X className="h-3 w-3 mr-1" />
        {t('search.suggestions.clearHistory', 'Clear History')}
      </Button>
    </div>
  );
}

/**
 * Empty state when no query
 */
function SearchEmptyState({ onSearchClick }: { onSearchClick: (query: string) => void }) {
  const { t } = useTranslation();
  const [recentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('recentSearches') || '[]').slice(0, 4);
    } catch {
      return [];
    }
  });
  
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Animated search icon */}
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <div className="relative p-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
          <Search className="h-12 w-12 text-primary" />
        </div>
      </div>
      
      <h3 className="text-2xl font-bold mb-2">
        {t('search.startSearching', 'Start Searching')}
      </h3>
      <p className="text-muted-foreground max-w-md mb-8">
        {t('search.searchDescription', 'Search across events, tasks, contacts, organizations, and more.')}
      </p>
      
      {/* Recent searches */}
      {recentSearches.length > 0 && (
        <div className="w-full max-w-md mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <History className="h-4 w-4" />
            <span>{t('search.suggestions.recentSearches', 'Recent Searches')}</span>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {recentSearches.map((search) => (
              <Badge 
                key={search} 
                variant="secondary" 
                className="cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors"
                onClick={() => onSearchClick(search)}
              >
                <Clock className="h-3 w-3 mr-1" />
                {search}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {/* Trending / Popular searches */}
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <TrendingUp className="h-4 w-4" />
          <span>{t('search.suggestions.popularSearches', 'Popular Searches')}</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {TRENDING_SEARCHES.map((search) => (
            <Badge 
              key={search} 
              variant="outline" 
              className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors"
              onClick={() => onSearchClick(search)}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {search}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * No results state
 */
function NoResultsState({ query, onSearchClick }: { query: string; onSearchClick: (query: string) => void }) {
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="p-6 rounded-full bg-muted mb-6">
        <Search className="h-12 w-12 text-muted-foreground" />
      </div>
      
      <h3 className="text-xl font-semibold mb-2">
        {t('search.noResults', 'No Results Found')}
      </h3>
      <p className="text-muted-foreground max-w-md">
        {t('search.noResultsDescription', 'No results found for "{{query}}"', { query })}
      </p>
      
      <div className="mt-6 space-y-2 text-sm text-muted-foreground text-left">
        <p className="font-medium">{t('search.tryTheFollowing', 'Try the following:')}</p>
        <ul className="space-y-1">
          <li>• {t('search.tips.differentKeywords', 'Using different keywords')}</li>
          <li>• {t('search.tips.removeFilters', 'Removing some filters')}</li>
          <li>• {t('search.tips.checkTypos', 'Checking for typos')}</li>
          <li>• {t('search.tips.fewerWords', 'Using fewer words')}</li>
        </ul>
      </div>
      
      {/* Suggested searches */}
      <div className="mt-8 w-full max-w-md">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3 justify-center">
          <Sparkles className="h-4 w-4" />
          <span>{t('search.trySearching', 'Try searching for')}</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {TRENDING_SEARCHES.map((search) => (
            <Badge 
              key={search} 
              variant="outline" 
              className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors"
              onClick={() => onSearchClick(search)}
            >
              {search}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Results loading skeleton
 */
function ResultsSkeleton({ view }: { view: 'list' | 'grid' }) {
  const items = Array.from({ length: 6 });
  
  if (view === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {items.map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-full" />
              </div>
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Results stats bar
 */
function ResultsStats({ 
  total, 
  took, 
  page, 
  totalPages,
  view,
  onViewChange,
}: { 
  total: number; 
  took: number;
  page: number;
  totalPages: number;
  view: 'list' | 'grid';
  onViewChange: (view: 'list' | 'grid') => void;
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  
  return (
    <div className={cn(
      "flex items-center justify-between py-3 px-1",
      isRTL && "flex-row-reverse"
    )}>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">
          {t('search.resultsCount', { count: total, defaultValue: '{{count}} results' })}
        </span>
        {took > 0 && (
          <Badge variant="secondary" className="text-xs">
            <Zap className="h-3 w-3 mr-1" />
            {took}ms
          </Badge>
        )}
      </div>
      
      <div className={cn(
        "flex items-center gap-3",
        isRTL && "flex-row-reverse"
      )}>
        {totalPages > 1 && (
          <span className="text-sm text-muted-foreground">
            {t('search.pageOf', { page, totalPages, defaultValue: 'Page {{page}} of {{totalPages}}' })}
          </span>
        )}
        <ViewToggle view={view} onChange={onViewChange} />
      </div>
    </div>
  );
}

/**
 * Enhanced pagination
 */
function EnhancedPagination({ 
  page, 
  totalPages, 
  onPageChange,
}: { 
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  
  if (totalPages <= 1) return null;
  
  const progress = (page / totalPages) * 100;
  
  return (
    <div className="mt-8 space-y-4">
      {/* Progress indicator */}
      <div className="space-y-2">
        <Progress value={progress} className="h-1" />
        <p className="text-xs text-center text-muted-foreground">
          Showing page {page} of {totalPages}
        </p>
      </div>
      
      {/* Pagination buttons */}
      <div className={cn(
        "flex items-center justify-center gap-2",
        isRTL && "flex-row-reverse"
      )}>
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="gap-1"
        >
          {t('common.previous', 'Previous')}
        </Button>
        
        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }
            
            return (
              <Button
                key={pageNum}
                variant={page === pageNum ? "default" : "ghost"}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className="w-8 h-8 p-0"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="gap-1"
        >
          {t('common.next', 'Next')}
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function SearchResults() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  const [, setLocation] = useLocation();
  const [view, setView] = useState<'list' | 'grid'>('list');
  
  // Get initial query from URL
  const getQueryFromUrl = () => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      return searchParams.get('q') || '';
    }
    return '';
  };
  
  const [urlQuery, setUrlQuery] = useState(getQueryFromUrl);
  
  // Listen for URL changes
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

  // Update URL when query changes
  useEffect(() => {
    if (query && query !== urlQuery) {
      const newPath = `/admin/search?q=${encodeURIComponent(query)}`;
      setLocation(newPath, { replace: true });
      setUrlQuery(query);
    }
  }, [query, urlQuery, setLocation]);

  // Save to recent searches
  const saveRecentSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    try {
      const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]');
      const updated = [searchQuery, ...recent.filter((s: string) => s !== searchQuery)].slice(0, 10);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleSearch = useCallback((newQuery: string) => {
    setQuery(newQuery);
    saveRecentSearch(newQuery);
    setLocation(`/admin/search?q=${encodeURIComponent(newQuery)}`);
  }, [setQuery, saveRecentSearch, setLocation]);

  const hasFilters = useMemo(() => {
    const hasEntityFilters = !!(entities && entities.length > 0);
    const hasOtherFilters = Object.values(filters).some(v => v !== undefined && v !== null && 
      (Array.isArray(v) ? v.length > 0 : true));
    return hasEntityFilters || hasOtherFilters;
  }, [filters, entities]);

  // Build entity aggregations for chips
  const entityAggregations = useMemo(() => {
    if (!results?.aggregations?.entityTypes) return undefined;
    return results.aggregations.entityTypes.reduce((acc, { key, count }) => {
      acc[key] = count;
      return acc;
    }, {} as Record<string, number>);
  }, [results?.aggregations]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      {/* Hero Search Section */}
      <div className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Main search input with suggestions */}
          <GlobalSearchBar
            hero
            defaultValue={query}
            onSearch={handleSearch}
            keepQueryAfterSearch={true}
            className="w-full"
          />
          
          {/* Quick filter chips */}
          <QuickFilterChips
            entities={entities}
            onToggle={toggleEntity}
            aggregations={entityAggregations}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className={cn(
          "flex gap-8",
          isRTL && "flex-row-reverse"
        )}>
          {/* Sidebar Filters - Desktop */}
          <aside className="w-72 shrink-0 hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent pr-2">
              <EnhancedFilters
                entities={entities}
                onToggleEntity={toggleEntity}
                filters={filters}
                onUpdateFilter={updateFilter}
                aggregations={results?.aggregations}
                onClearAll={clearFilters}
                hasFilters={hasFilters}
                onSearchClick={handleSearch}
              />
            </div>
          </aside>

          {/* Results Area */}
          <main className="flex-1 min-w-0">
            {/* Mobile Filters */}
            <div className="lg:hidden mb-4">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    {t('search.filters', 'Filters')}
                    {hasFilters && (
                      <Badge variant="secondary" className="h-5 px-1.5">
                        {(entities?.length || 0) + Object.keys(filters).length}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side={isRTL ? 'left' : 'right'} className="w-80 overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4" />
                      {t('search.filters', 'Filters')}
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <EnhancedFilters
                      entities={entities}
                      onToggleEntity={toggleEntity}
                      filters={filters}
                      onUpdateFilter={updateFilter}
                      aggregations={results?.aggregations}
                      onClearAll={clearFilters}
                      hasFilters={hasFilters}
                      onSearchClick={handleSearch}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Results */}
            {isLoading ? (
              <ResultsSkeleton view={view} />
            ) : !query ? (
              <SearchEmptyState onSearchClick={handleSearch} />
            ) : results?.hits.length === 0 ? (
              <NoResultsState query={query} onSearchClick={handleSearch} />
            ) : results ? (
              <>
                {/* Stats bar */}
                <ResultsStats
                  total={results.total}
                  took={results.took}
                  page={page}
                  totalPages={results.totalPages}
                  view={view}
                  onViewChange={setView}
                />
                
                {/* Results grid/list */}
                <div className={cn(
                  view === 'grid' 
                    ? "grid grid-cols-1 md:grid-cols-2 gap-4" 
                    : "space-y-3"
                )}>
                  {results.hits.map((hit) => (
                    <SearchResultCard
                      key={`${hit.index}-${hit.id}`}
                      hit={hit}
                      query={query}
                    />
                  ))}
                </div>

                {/* Pagination */}
                <EnhancedPagination
                  page={page}
                  totalPages={results.totalPages}
                  onPageChange={setPage}
                />
                
                {/* Loading overlay */}
                {isFetching && !isLoading && (
                  <div className="fixed bottom-4 right-4 bg-background/95 backdrop-blur-sm shadow-lg rounded-full px-4 py-2 flex items-center gap-2 border">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-sm">{t('common.loading', 'Loading...')}</span>
                  </div>
                )}
              </>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
