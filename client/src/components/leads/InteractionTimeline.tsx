import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Mail,
  Phone,
  Users,
  MessageSquare,
  ArrowUpDown,
  History,
  Filter,
  X,
} from 'lucide-react';
import { InteractionCard, type LeadInteraction } from './InteractionCard';
import { cn } from '@/lib/utils';

const INTERACTION_TYPES = ['all', 'email', 'phone_call', 'meeting', 'other'] as const;

type InteractionType = (typeof INTERACTION_TYPES)[number];
type SortOrder = 'newest' | 'oldest';

interface InteractionTimelineProps {
  interactions: LeadInteraction[];
  isLoading?: boolean;
  onAddInteraction?: () => void;
  onEditInteraction?: (interaction: LeadInteraction) => void;
  onDeleteInteraction?: (interaction: LeadInteraction) => void;
}

const INTERACTION_ICON_BG = {
  email: 'bg-blue-500',
  phone_call: 'bg-green-500',
  meeting: 'bg-purple-500',
  other: 'bg-gray-500',
};

export function InteractionTimeline({
  interactions,
  isLoading = false,
  onAddInteraction,
  onEditInteraction,
  onDeleteInteraction,
}: InteractionTimelineProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<InteractionType>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [showFilters, setShowFilters] = useState(false);

  const getInteractionIcon = (type: string) => {
    const iconProps = { className: 'h-4 w-4 text-white' };
    switch (type) {
      case 'email':
        return <Mail {...iconProps} />;
      case 'phone_call':
        return <Phone {...iconProps} />;
      case 'meeting':
        return <Users {...iconProps} />;
      default:
        return <MessageSquare {...iconProps} />;
    }
  };

  // Filter and sort interactions
  const filteredInteractions = useMemo(() => {
    let result = [...interactions];

    // Apply type filter
    if (filterType !== 'all') {
      result = result.filter((i) => i.type === filterType);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.description.toLowerCase().includes(query) ||
          i.descriptionAr?.toLowerCase().includes(query) ||
          i.outcome?.toLowerCase().includes(query) ||
          i.outcomeAr?.toLowerCase().includes(query) ||
          i.createdByUsername?.toLowerCase().includes(query)
      );
    }

    // Apply sort
    result.sort((a, b) => {
      const dateA = new Date(a.interactionDate || a.createdAt).getTime();
      const dateB = new Date(b.interactionDate || b.createdAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [interactions, filterType, searchQuery, sortOrder]);

  // Count interactions by type
  const typeCounts = useMemo(() => {
    return interactions.reduce(
      (acc, i) => {
        acc[i.type] = (acc[i.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [interactions]);

  const hasActiveFilters = filterType !== 'all' || searchQuery.trim();

  const clearFilters = () => {
    setFilterType('all');
    setSearchQuery('');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="w-0.5 h-20 mt-2" />
              </div>
              <Skeleton className="h-24 flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with title and add button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium text-lg">
            {t('leads.interactions.timeline')}
          </h3>
          <Badge variant="secondary" className="ml-1">
            {interactions.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(hasActiveFilters && 'border-primary text-primary')}
          >
            <Filter className="h-4 w-4 mr-1.5" />
            {t('leads.interactions.filterSearch')}
            {hasActiveFilters && (
              <Badge
                variant="secondary"
                className="ml-1.5 h-5 w-5 p-0 justify-center"
              >
                !
              </Badge>
            )}
          </Button>
          {onAddInteraction && (
            <Button size="sm" onClick={onAddInteraction}>
              <Plus className="h-4 w-4 mr-1.5" />
              {t('leads.interactions.addInteraction')}
            </Button>
          )}
        </div>
      </div>

      {/* Filter/Search Panel */}
      {showFilters && (
        <div className="p-4 bg-muted/50 rounded-lg space-y-3 border">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('leads.interactions.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Type Filter */}
            <Select
              value={filterType}
              onValueChange={(v) => setFilterType(v as InteractionType)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('leads.interactions.filterByType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('leads.interactions.allTypes')} ({interactions.length})
                </SelectItem>
                {(['email', 'phone_call', 'meeting', 'other'] as const).map(
                  (type) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        {t(`leads.interactions.types.${type}`)}
                        {typeCounts[type] && (
                          <span className="text-muted-foreground">
                            ({typeCounts[type]})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>

            {/* Sort Order */}
            <Select
              value={sortOrder}
              onValueChange={(v) => setSortOrder(v as SortOrder)}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">
                  {t('leads.interactions.newestFirst')}
                </SelectItem>
                <SelectItem value="oldest">
                  {t('leads.interactions.oldestFirst')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              {t('leads.interactions.clearFilters')}
            </Button>
          )}
        </div>
      )}

      {/* Empty State */}
      {interactions.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <h4 className="font-medium text-lg mb-1">
            {t('leads.interactions.noInteractions')}
          </h4>
          <p className="text-sm text-muted-foreground mb-4">
            {t('leads.interactions.noInteractionsDesc')}
          </p>
          {onAddInteraction && (
            <Button onClick={onAddInteraction}>
              <Plus className="h-4 w-4 mr-1.5" />
              {t('leads.interactions.addFirstInteraction')}
            </Button>
          )}
        </div>
      ) : filteredInteractions.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Search className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <h4 className="font-medium text-lg mb-1">
            {t('leads.interactions.noResults')}
          </h4>
          <p className="text-sm text-muted-foreground mb-4">
            {t('leads.interactions.noResultsDesc')}
          </p>
          <Button variant="outline" onClick={clearFilters}>
            {t('leads.interactions.clearFilters')}
          </Button>
        </div>
      ) : (
        /* Timeline */
        <div className="relative">
          {/* Timeline line */}
          <div
            className={cn(
              'absolute top-0 bottom-0 w-0.5 bg-border',
              isRTL ? 'right-5' : 'left-5'
            )}
            style={{ height: 'calc(100% - 40px)' }}
          />

          {/* Interaction items */}
          <div className="space-y-6">
            {filteredInteractions.map((interaction, index) => {
              const isLast = index === filteredInteractions.length - 1;

              return (
                <div
                  key={interaction.id}
                  className={cn('flex gap-4', isRTL && 'flex-row-reverse')}
                >
                  {/* Timeline node */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div
                      className={cn(
                        'flex items-center justify-center w-10 h-10 rounded-full shadow-sm',
                        INTERACTION_ICON_BG[interaction.type]
                      )}
                    >
                      {getInteractionIcon(interaction.type)}
                    </div>
                  </div>

                  {/* Interaction Card */}
                  <div className="flex-1 min-w-0 pb-2">
                    <InteractionCard
                      interaction={interaction}
                      onEdit={onEditInteraction}
                      onDelete={onDeleteInteraction}
                      isLast={isLast}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
