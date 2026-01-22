import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFilters } from '@/hooks/use-filters';
import { Category } from '@/lib/types';

export default function FilterChips() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const locale = isArabic ? ar : undefined;
  const { filters, removeFilter, clearFilters, hasActiveFilters } = useFilters();

  // Fetch categories to map IDs to names
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  console.log('[FilterChips] Rendering:', { filters, hasActiveFilters });

  if (!hasActiveFilters) {
    console.log('[FilterChips] No active filters, returning null');
    return null;
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, isArabic ? 'MMM dd yyyy' : 'MMM dd, yyyy', { locale });
    } catch {
      return dateString;
    }
  };

  const totalFilters =
    filters.selectedCategories.length +
    filters.selectedEventTypes.length +
    filters.selectedEventScopes.length +
    (filters.selectedDate ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="container-filter-chips">
      {/* Category chips */}
      {filters.selectedCategories.map((categoryId) => {
        const category = categories.find(c => c.id === Number(categoryId));
        const categoryName = category 
          ? (isArabic ? category.nameAr || category.nameEn : category.nameEn)
          : categoryId;
        
        return (
          <Badge
            key={`category-${categoryId}`}
            variant="secondary"
            className="gap-1"
            data-testid={`chip-category-${categoryId}`}
          >
            <span>{categoryName}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeFilter('selectedCategories', categoryId);
              }}
              className="ms-1 hover:bg-secondary-foreground/20 rounded-full p-0.5 touch-manipulation"
              data-testid={`button-remove-category-${categoryId}`}
              aria-label={t('filters.removeFilter', { filterName: categoryName })}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}

      {/* Event Type chips */}
      {filters.selectedEventTypes.map((eventType) => {
        const eventTypeLabel = eventType === 'local' ? t('events.eventTypes.local') : t('events.eventTypes.international');
        return (
          <Badge
            key={`eventType-${eventType}`}
            variant="secondary"
            className="gap-1"
            data-testid={`chip-eventtype-${eventType}`}
          >
            <span>{eventTypeLabel}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeFilter('selectedEventTypes', eventType);
              }}
              className="ms-1 hover:bg-secondary-foreground/20 rounded-full p-0.5 touch-manipulation"
              data-testid={`button-remove-eventtype-${eventType}`}
              aria-label={t('filters.removeFilter', { filterName: eventTypeLabel })}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}

      {/* Event Scope chips */}
      {filters.selectedEventScopes.map((eventScope) => {
        const eventScopeLabel = eventScope === 'internal' ? t('events.eventScopes.internal') : t('events.eventScopes.external');
        return (
          <Badge
            key={`eventScope-${eventScope}`}
            variant="secondary"
            className="gap-1"
            data-testid={`chip-eventscope-${eventScope}`}
          >
            <span>{eventScopeLabel}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeFilter('selectedEventScopes', eventScope);
              }}
              className="ms-1 hover:bg-secondary-foreground/20 rounded-full p-0.5 touch-manipulation"
              data-testid={`button-remove-eventscope-${eventScope}`}
              aria-label={t('filters.removeFilter', { filterName: eventScopeLabel })}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}

      {/* Date chip */}
      {filters.selectedDate && (
        <Badge
          variant="secondary"
          className="gap-1"
          data-testid="chip-date"
        >
          <span>{formatDate(filters.selectedDate)}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeFilter('selectedDate', filters.selectedDate!);
            }}
            className="ms-1 hover:bg-secondary-foreground/20 rounded-full p-0.5 touch-manipulation"
            data-testid="button-remove-date"
            aria-label={t('filters.removeDateFilter')}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {/* Clear All button - show only when multiple filters are active */}
      {totalFilters > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-6 px-2 text-xs"
          data-testid="button-clear-all-filters"
        >
          {t('common.clearFilters')}
        </Button>
      )}
    </div>
  );
}
