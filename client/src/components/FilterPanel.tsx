import { Event, Category } from '@/lib/types';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useFilters } from '@/hooks/use-filters';

interface FilterPanelProps {
  events: Event[];
}

export default function FilterPanel({ events }: FilterPanelProps) {
  console.log('[FilterPanel] Rendering with events count:', events.length);
  
  const { t, i18n } = useTranslation();
  const { filters, setFilter } = useFilters();
  const isArabic = i18n.language === 'ar';

  // Fetch categories from the API
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  // Get unique category IDs from events that have categories
  const eventCategoryIds = Array.from(
    new Set(events.map(event => event.categoryId).filter(Boolean))
  );

  // Filter categories to only show those that are used in events
  const usedCategories = categories.filter(cat => eventCategoryIds.includes(cat.id));

  const eventTypes = [
    { value: 'local', label: t('events.eventTypes.local') },
    { value: 'international', label: t('events.eventTypes.international') },
  ];

  const eventScopes = [
    { value: 'internal', label: t('events.eventScopes.internal') },
    { value: 'external', label: t('events.eventScopes.external') },
  ];

  const eventSources = [
    { value: 'manual', label: t('events.sourceManual') },
    { value: 'abu-dhabi-media-office', label: t('events.sourceAbuDhabiMedia') },
    { value: 'adnec', label: t('events.sourceAdnec') },
  ];
  
  // Debug logging
  console.log('[FilterPanel] Categories:', usedCategories);
  console.log('[FilterPanel] Current filters:', filters);

  const handleCategoryToggle = (categoryId: number) => {
    console.log('[FilterPanel] Category toggled:', categoryId);
    setFilter('selectedCategories', String(categoryId));
  };

  const handleEventTypeToggle = (eventType: string) => {
    console.log('[FilterPanel] Event type toggled:', eventType);
    setFilter('selectedEventTypes', eventType);
  };

  const handleEventScopeToggle = (eventScope: string) => {
    console.log('[FilterPanel] Event scope toggled:', eventScope);
    setFilter('selectedEventScopes', eventScope);
  };

  const handleSourceToggle = (source: string) => {
    console.log('[FilterPanel] Source toggled:', source);
    setFilter('selectedSources', source);
  };

  return (
    <Card className="w-full" data-testid="card-filter-panel">
      <CardContent className="p-4 md:p-6">
        <Tabs defaultValue="category" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1" data-testid="tabs-filter-list">
            <TabsTrigger value="category" className="text-xs sm:text-sm py-2" data-testid="tab-trigger-category">
              {t('events.category')}
            </TabsTrigger>
            <TabsTrigger value="eventType" className="text-xs sm:text-sm py-2" data-testid="tab-trigger-eventtype">
              {t('events.eventType')}
            </TabsTrigger>
            <TabsTrigger value="scope" className="text-xs sm:text-sm py-2" data-testid="tab-trigger-scope">
              {t('events.eventScope')}
            </TabsTrigger>
            <TabsTrigger value="source" className="text-xs sm:text-sm py-2" data-testid="tab-trigger-source">
              {t('events.source')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="category" className="space-y-4" data-testid="tab-content-category">
            {usedCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No categories available
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {usedCategories.map((category) => (
                  <div key={category.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`category-${category.id}`}
                      checked={filters.selectedCategories.includes(String(category.id))}
                      onCheckedChange={() => handleCategoryToggle(category.id)}
                      data-testid={`checkbox-category-${category.nameEn.toLowerCase().replace(/\s+/g, '-')}`}
                    />
                    <Label
                      htmlFor={`category-${category.id}`}
                      className="text-sm font-normal cursor-pointer"
                      data-testid={`label-category-${category.nameEn.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {isArabic ? category.nameAr || category.nameEn : category.nameEn}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="eventType" className="space-y-4" data-testid="tab-content-eventtype">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {eventTypes.map((type) => (
                <div key={type.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`eventType-${type.value}`}
                    checked={filters.selectedEventTypes.includes(type.value)}
                    onCheckedChange={() => handleEventTypeToggle(type.value)}
                    data-testid={`checkbox-eventtype-${type.value}`}
                  />
                  <Label
                    htmlFor={`eventType-${type.value}`}
                    className="text-sm font-normal cursor-pointer"
                    data-testid={`label-eventtype-${type.value}`}
                  >
                    {type.label}
                  </Label>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="scope" className="space-y-4" data-testid="tab-content-scope">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {eventScopes.map((scope) => (
                <div key={scope.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`eventScope-${scope.value}`}
                    checked={filters.selectedEventScopes.includes(scope.value)}
                    onCheckedChange={() => handleEventScopeToggle(scope.value)}
                    data-testid={`checkbox-eventscope-${scope.value}`}
                  />
                  <Label
                    htmlFor={`eventScope-${scope.value}`}
                    className="text-sm font-normal cursor-pointer"
                    data-testid={`label-eventscope-${scope.value}`}
                  >
                    {scope.label}
                  </Label>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="source" className="space-y-4" data-testid="tab-content-source">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {eventSources.map((source) => (
                <div key={source.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`source-${source.value}`}
                    checked={filters.selectedSources.includes(source.value)}
                    onCheckedChange={() => handleSourceToggle(source.value)}
                    data-testid={`checkbox-source-${source.value}`}
                  />
                  <Label
                    htmlFor={`source-${source.value}`}
                    className="text-sm font-normal cursor-pointer"
                    data-testid={`label-source-${source.value}`}
                  >
                    {source.label}
                  </Label>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
