/**
 * SearchFilters Component
 * 
 * Sidebar filters for search results including entity types,
 * categories, status, dates, and more.
 * 
 * @module components/search/SearchFilters
 */

import { useTranslation } from 'react-i18next';
import { X, Filter, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import type { SearchFilters as Filters, EntityType, SearchAggregations } from '@/types/search';

interface SearchFiltersProps {
  filters: Filters;
  onFilterChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onClearAll: () => void;
  entities?: EntityType[];
  onToggleEntity: (entity: EntityType) => void;
  aggregations?: SearchAggregations;
  className?: string;
}

interface EntityLabel {
  key: EntityType;
  labelKey: string;
}

const ENTITY_OPTIONS: EntityLabel[] = [
  { key: 'events', labelKey: 'search.entities.events' },
  { key: 'tasks', labelKey: 'search.entities.tasks' },
  { key: 'contacts', labelKey: 'search.entities.contacts' },
  { key: 'organizations', labelKey: 'search.entities.organizations' },
  { key: 'leads', labelKey: 'search.entities.leads' },
  { key: 'partnerships', labelKey: 'search.entities.partnerships' },
  { key: 'agreements', labelKey: 'search.entities.agreements' },
  { key: 'departments', labelKey: 'search.entities.departments' },
  { key: 'updates', labelKey: 'search.entities.updates' },
  { key: 'lead-interactions', labelKey: 'search.entities.leadInteractions' },
  { key: 'partnership-activities', labelKey: 'search.entities.partnershipActivities' },
  { key: 'partnership-interactions', labelKey: 'search.entities.partnershipInteractions' },
];

export function SearchFilters({
  filters,
  onFilterChange,
  onClearAll,
  entities,
  onToggleEntity,
  aggregations,
  className,
}: SearchFiltersProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';

  const hasFilters = 
    Object.values(filters).some(v => v !== undefined && v !== null && 
      (Array.isArray(v) ? v.length > 0 : true)) || 
    (entities && entities.length > 0);

  /**
   * Get count for entity type from aggregations
   */
  const getEntityCount = (entityKey: EntityType): number | undefined => {
    if (!aggregations?.entityTypes) return undefined;
    const bucket = aggregations.entityTypes.find(e => 
      e.key.toLowerCase().includes(entityKey.toLowerCase().replace('-', ''))
    );
    return bucket?.count;
  };

  /**
   * Toggle array filter value
   */
  const toggleArrayFilter = <K extends keyof Filters>(
    key: K,
    value: string
  ) => {
    const current = (filters[key] as string[] | undefined) || [];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onFilterChange(key, next.length > 0 ? (next as Filters[K]) : undefined);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className={cn(
        'flex items-center justify-between',
        isRTL && 'flex-row-reverse'
      )}>
        <h3 className="font-semibold flex items-center gap-2">
          <Filter className="h-4 w-4" />
          {t('search.filters', 'Filters')}
        </h3>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            <X className="h-4 w-4 mr-1" />
            {t('common.clearAll', 'Clear All')}
          </Button>
        )}
      </div>

      <Accordion 
        type="multiple" 
        defaultValue={['entities', 'categories', 'statuses']}
        className="space-y-2"
      >
        {/* Entity Type Filter */}
        <AccordionItem value="entities" className="border rounded-lg px-3">
          <AccordionTrigger className="text-sm font-medium py-3">
            {t('search.entityType', 'Entity Type')}
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <div className="space-y-2">
              {ENTITY_OPTIONS.map(({ key, labelKey }) => {
                const count = getEntityCount(key);
                return (
                  <div key={key} className={cn(
                    'flex items-center space-x-2',
                    isRTL && 'flex-row-reverse space-x-reverse'
                  )}>
                    <Checkbox
                      id={`entity-${key}`}
                      checked={entities?.includes(key) ?? false}
                      onCheckedChange={() => onToggleEntity(key)}
                    />
                    <Label
                      htmlFor={`entity-${key}`}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      {t(labelKey, key)}
                      {count !== undefined && (
                        <span className="text-muted-foreground ml-1">
                          ({count})
                        </span>
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
          <AccordionItem value="categories" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-medium py-3">
              {t('search.category', 'Category')}
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {aggregations.categories.map((cat) => (
                  <div key={cat.key} className={cn(
                    'flex items-center space-x-2',
                    isRTL && 'flex-row-reverse space-x-reverse'
                  )}>
                    <Checkbox
                      id={`cat-${cat.key}`}
                      checked={filters.category?.includes(cat.key) ?? false}
                      onCheckedChange={() => toggleArrayFilter('category', cat.key)}
                    />
                    <Label
                      htmlFor={`cat-${cat.key}`}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      {cat.key}
                      <span className="text-muted-foreground ml-1">
                        ({cat.count})
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Status Filter */}
        {aggregations?.statuses && aggregations.statuses.length > 0 && (
          <AccordionItem value="statuses" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-medium py-3">
              {t('search.status', 'Status')}
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="space-y-2">
                {aggregations.statuses.map((status) => (
                  <div key={status.key} className={cn(
                    'flex items-center space-x-2',
                    isRTL && 'flex-row-reverse space-x-reverse'
                  )}>
                    <Checkbox
                      id={`status-${status.key}`}
                      checked={filters.status?.includes(status.key) ?? false}
                      onCheckedChange={() => toggleArrayFilter('status', status.key)}
                    />
                    <Label
                      htmlFor={`status-${status.key}`}
                      className="flex-1 cursor-pointer text-sm capitalize"
                    >
                      {status.key}
                      <span className="text-muted-foreground ml-1">
                        ({status.count})
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Event Type Filter */}
        {aggregations?.eventTypes && aggregations.eventTypes.length > 0 && (
          <AccordionItem value="eventTypes" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-medium py-3">
              {t('search.eventType', 'Event Type')}
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="space-y-2">
                {aggregations.eventTypes.map((eventType) => (
                  <div key={eventType.key} className={cn(
                    'flex items-center space-x-2',
                    isRTL && 'flex-row-reverse space-x-reverse'
                  )}>
                    <Checkbox
                      id={`eventType-${eventType.key}`}
                      checked={filters.eventType?.includes(eventType.key) ?? false}
                      onCheckedChange={() => toggleArrayFilter('eventType', eventType.key)}
                    />
                    <Label
                      htmlFor={`eventType-${eventType.key}`}
                      className="flex-1 cursor-pointer text-sm capitalize"
                    >
                      {eventType.key}
                      <span className="text-muted-foreground ml-1">
                        ({eventType.count})
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Country Filter */}
        {aggregations?.countries && aggregations.countries.length > 0 && (
          <AccordionItem value="countries" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-medium py-3">
              {t('search.country', 'Country')}
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {aggregations.countries.map(country => (
                  <div key={country.key} className={cn(
                    'flex items-center space-x-2',
                    isRTL && 'flex-row-reverse space-x-reverse'
                  )}>
                    <Checkbox
                      id={`country-${country.key}`}
                      checked={filters.countryName?.includes(country.key) ?? false}
                      onCheckedChange={() => toggleArrayFilter('countryName', country.key)}
                    />
                    <Label
                      htmlFor={`country-${country.key}`}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      {country.key}
                      <span className="text-muted-foreground ml-1">
                        ({country.count})
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Event Scope Filter */}
        {aggregations?.eventScopes && aggregations.eventScopes.length > 0 && (
          <AccordionItem value="eventScopes" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-medium py-3">
              {t('search.eventScope', 'Event Scope')}
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="space-y-2">
                {aggregations.eventScopes.map((scope) => (
                  <div key={scope.key} className={cn(
                    'flex items-center space-x-2',
                    isRTL && 'flex-row-reverse space-x-reverse'
                  )}>
                    <Checkbox
                      id={`eventScope-${scope.key}`}
                      checked={filters.eventScope?.includes(scope.key) ?? false}
                      onCheckedChange={() => toggleArrayFilter('eventScope', scope.key)}
                    />
                    <Label
                      htmlFor={`eventScope-${scope.key}`}
                      className="flex-1 cursor-pointer text-sm capitalize"
                    >
                      {scope.key}
                      <span className="text-muted-foreground ml-1">
                        ({scope.count})
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Date Range Filter */}
        <AccordionItem value="dateRange" className="border rounded-lg px-3">
          <AccordionTrigger className="text-sm font-medium py-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t('search.dateRange', 'Date Range')}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <div className="space-y-3">
              {/* Quick Date Presets */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    onFilterChange('dateRange', { start: today, end: new Date() });
                  }}
                  className="text-xs h-8"
                >
                  {t('search.today', 'Today')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const start = new Date();
                    start.setDate(start.getDate() - 7);
                    onFilterChange('dateRange', { start, end: new Date() });
                  }}
                  className="text-xs h-8"
                >
                  {t('search.last7Days', 'Last 7 Days')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const start = new Date();
                    start.setDate(start.getDate() - 30);
                    onFilterChange('dateRange', { start, end: new Date() });
                  }}
                  className="text-xs h-8"
                >
                  {t('search.last30Days', 'Last 30 Days')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const start = new Date();
                    start.setMonth(start.getMonth() - 3);
                    onFilterChange('dateRange', { start, end: new Date() });
                  }}
                  className="text-xs h-8"
                >
                  {t('search.last3Months', 'Last 3 Months')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const start = new Date();
                    const end = new Date();
                    end.setDate(end.getDate() + 30);
                    onFilterChange('dateRange', { start, end });
                  }}
                  className="text-xs h-8"
                >
                  {t('search.next30Days', 'Next 30 Days')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const start = new Date();
                    start.setMonth(0, 1); // January 1st
                    const end = new Date();
                    end.setMonth(11, 31); // December 31st
                    onFilterChange('dateRange', { start, end });
                  }}
                  className="text-xs h-8"
                >
                  {t('search.thisYear', 'This Year')}
                </Button>
              </div>
              
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-2">
                  {t('search.customRange', 'Custom Range')}
                </p>
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="date-start" className="text-xs">
                      {t('search.from', 'From')}
                    </Label>
                    <Input
                      id="date-start"
                      type="date"
                      value={filters.dateRange?.start ? filters.dateRange.start.toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : undefined;
                        onFilterChange('dateRange', {
                          ...filters.dateRange,
                          start: date,
                        } as any);
                      }}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="date-end" className="text-xs">
                      {t('search.to', 'To')}
                    </Label>
                    <Input
                      id="date-end"
                      type="date"
                      value={filters.dateRange?.end ? filters.dateRange.end.toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : undefined;
                        onFilterChange('dateRange', {
                          ...filters.dateRange,
                          end: date,
                        } as any);
                      }}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
              
              {(filters.dateRange?.start || filters.dateRange?.end) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFilterChange('dateRange', undefined)}
                  className="w-full text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  {t('common.clearDateFilter', 'Clear Date Filter')}
                </Button>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Priority Filter */}
        {aggregations?.priorities && aggregations.priorities.length > 0 && (
          <AccordionItem value="priorities" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-medium py-3">
              {t('search.priority', 'Priority')}
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="space-y-2">
                {aggregations.priorities.map((priority) => (
                  <div key={priority.key} className={cn(
                    'flex items-center space-x-2',
                    isRTL && 'flex-row-reverse space-x-reverse'
                  )}>
                    <Checkbox
                      id={`priority-${priority.key}`}
                      checked={filters.priority?.includes(priority.key) ?? false}
                      onCheckedChange={() => toggleArrayFilter('priority', priority.key)}
                    />
                    <Label
                      htmlFor={`priority-${priority.key}`}
                      className="flex-1 cursor-pointer text-sm capitalize"
                    >
                      {priority.key}
                      <span className="text-muted-foreground ml-1">
                        ({priority.count})
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Include Archived Filter */}
        <AccordionItem value="archived" className="border rounded-lg px-3">
          <AccordionTrigger className="text-sm font-medium py-3">
            {t('search.archivedEvents', 'Archived Events')}
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <div className={cn(
              'flex items-center space-x-2',
              isRTL && 'flex-row-reverse space-x-reverse'
            )}>
              <Checkbox
                id="include-archived"
                checked={filters.isArchived === undefined || filters.isArchived === true}
                onCheckedChange={(checked) =>
                  onFilterChange('isArchived', checked ? undefined : false)
                }
              />
              <Label htmlFor="include-archived" className="text-sm cursor-pointer">
                {t('search.includeArchived', 'Include archived events')}
              </Label>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
