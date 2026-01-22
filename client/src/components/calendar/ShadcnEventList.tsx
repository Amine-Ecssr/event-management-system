import { Event, CalendarViewMode } from '@/lib/types';
import ShadcnEventCard from './ShadcnEventCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar, CalendarDays, Pencil, Trash2, List, LayoutGrid, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { 
  startOfMonth, 
  endOfMonth, 
  startOfQuarter, 
  endOfQuarter,
  startOfYear,
  endOfYear,
  parseISO, 
  startOfDay, 
  endOfDay,
  addMonths,
  isToday,
  isTomorrow,
  isFuture,
  isPast,
  compareAsc,
  format
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ShadcnEventListProps {
  events: Event[];
  onEventClick: (event: Event) => void;
  onEventHover?: (eventId: string | null) => void;
  hoveredEventId?: string | null;
  currentDate?: Date;
  viewMode?: CalendarViewMode;
  showAdminActions?: boolean;
  onEdit?: (event: Event) => void;
  onDelete?: (event: Event) => void;
}

type ListViewMode = 'full' | 'compact';

export default function ShadcnEventList({ 
  events, 
  onEventClick, 
  onEventHover, 
  hoveredEventId,
  currentDate,
  viewMode = 'monthly',
  showAdminActions = false,
  onEdit,
  onDelete
}: ShadcnEventListProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const locale = isArabic ? ar : undefined;
  const [listViewMode, setListViewMode] = useState<ListViewMode>('compact');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    past: true // Past events collapsed by default
  });
  
  // Filter events based on view mode and current date
  const filteredEvents = currentDate 
    ? events.filter((event) => {
        let periodStart: Date;
        let periodEnd: Date;
        
        switch (viewMode) {
          case 'monthly':
            periodStart = startOfMonth(currentDate);
            periodEnd = endOfMonth(currentDate);
            break;
          case 'quarterly':
            periodStart = startOfQuarter(currentDate);
            periodEnd = endOfQuarter(currentDate);
            break;
          case 'bi-annually':
            const month = currentDate.getMonth();
            if (month < 6) {
              periodStart = startOfYear(currentDate);
              periodEnd = endOfMonth(addMonths(startOfYear(currentDate), 5));
            } else {
              periodStart = startOfMonth(addMonths(startOfYear(currentDate), 6));
              periodEnd = endOfYear(currentDate);
            }
            break;
          case 'yearly':
            periodStart = startOfYear(currentDate);
            periodEnd = endOfYear(currentDate);
            break;
          default:
            periodStart = startOfMonth(currentDate);
            periodEnd = endOfMonth(currentDate);
        }
        
        const eventStart = startOfDay(parseISO(event.startDate));
        const eventEnd = endOfDay(parseISO(event.endDate));
        
        return eventStart <= periodEnd && eventEnd >= periodStart;
      })
    : events;
  
  // Sort events by date
  const sortedEvents = [...filteredEvents].sort((a, b) => 
    compareAsc(parseISO(a.startDate), parseISO(b.startDate))
  );
  
  // Categorize events
  const todayEvents = sortedEvents.filter(e => isToday(parseISO(e.startDate)));
  const tomorrowEvents = sortedEvents.filter(e => isTomorrow(parseISO(e.startDate)));
  const upcomingEvents = sortedEvents.filter(e => {
    const start = parseISO(e.startDate);
    return isFuture(start) && !isToday(start) && !isTomorrow(start);
  });
  const pastEvents = sortedEvents.filter(e => {
    const end = parseISO(e.endDate);
    return isPast(end) && !isToday(end);
  });

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  if (filteredEvents.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-center">{t('events.noEventsForPeriod')}</p>
        </CardContent>
      </Card>
    );
  }

  const renderEventCard = (event: Event) => (
    <div key={event.id} className="relative group">
      <ShadcnEventCard
        event={event}
        onClick={() => onEventClick(event)}
        onHover={onEventHover}
        hoveredEventId={hoveredEventId}
        compact={listViewMode === 'compact'}
      />
      {showAdminActions && (
        <div className={cn(
          "absolute flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10",
          listViewMode === 'compact' 
            ? "top-1/2 -translate-y-1/2 ltr:right-10 rtl:left-10" 
            : "bottom-3 ltr:right-3 rtl:left-3"
        )}>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 w-7 p-0 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(event);
            }}
            title={t('common.edit')}
            data-testid={`shadcn-button-edit-${event.id}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 w-7 p-0 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(event);
            }}
            title={t('common.delete')}
            data-testid={`shadcn-button-delete-${event.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );

  const renderEventSection = (
    sectionKey: string,
    title: string, 
    events: Event[], 
    icon?: React.ReactNode,
    collapsible: boolean = false,
    defaultCollapsed: boolean = false
  ) => {
    if (events.length === 0) return null;
    
    const isCollapsed = collapsedSections[sectionKey] ?? defaultCollapsed;
    
    const sectionContent = (
      <div className={cn(
        listViewMode === 'compact' ? "space-y-1" : "space-y-3"
      )}>
        {events.map(renderEventCard)}
      </div>
    );

    const sectionHeader = (
      <div className={cn(
        "flex items-center justify-between py-2",
        collapsible && "cursor-pointer hover:bg-muted/50 rounded-md px-2 -mx-2"
      )}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {events.length}
          </span>
        </div>
        {collapsible && (
          isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    );
    
    if (collapsible) {
      return (
        <Collapsible
          key={sectionKey}
          open={!isCollapsed}
          onOpenChange={() => toggleSection(sectionKey)}
          className="space-y-2"
        >
          <CollapsibleTrigger asChild>
            {sectionHeader}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2">
            {sectionContent}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return (
      <div key={sectionKey} className="space-y-2">
        {sectionHeader}
        {sectionContent}
      </div>
    );
  };

  // Get period label for header
  const getPeriodLabel = () => {
    if (!currentDate) return '';
    switch (viewMode) {
      case 'monthly':
        return format(currentDate, 'MMMM yyyy', { locale });
      case 'quarterly':
        const quarter = Math.floor(currentDate.getMonth() / 3) + 1;
        return `Q${quarter} ${format(currentDate, 'yyyy')}`;
      case 'bi-annually':
        const half = currentDate.getMonth() < 6 ? 'H1' : 'H2';
        return `${half} ${format(currentDate, 'yyyy')}`;
      case 'yearly':
        return format(currentDate, 'yyyy');
      default:
        return format(currentDate, 'MMMM yyyy', { locale });
    }
  };

  return (
    <Card data-testid="shadcn-event-list">
      {/* Header */}
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-base">{t('home.upcomingEvents')}</h3>
            <p className="text-xs text-muted-foreground">{getPeriodLabel()}</p>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
            <Button
              variant={listViewMode === 'full' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setListViewMode('full')}
              title={t('calendar.views.list')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={listViewMode === 'compact' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setListViewMode('compact')}
              title={t('calendar.views.calendar')}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <Separator />
      
      {/* Content */}
      <CardContent className="p-4 pt-3">
        <div className="space-y-4">
          {renderEventSection(
            'today',
            t('events.today'), 
            todayEvents,
            <CalendarDays className="h-4 w-4 text-primary" />
          )}
          {renderEventSection(
            'tomorrow',
            t('events.tomorrow'), 
            tomorrowEvents,
            <Calendar className="h-4 w-4 text-blue-500" />
          )}
          {renderEventSection(
            'upcoming',
            t('events.upcoming'), 
            upcomingEvents,
            <Calendar className="h-4 w-4 text-green-500" />
          )}
          {renderEventSection(
            'past',
            t('events.past'), 
            pastEvents,
            <Calendar className="h-4 w-4 text-muted-foreground" />,
            true, // collapsible
            true  // default collapsed
          )}
        </div>
        
        {/* Summary footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 mt-4 border-t">
          {t('events.totalEvents', { count: filteredEvents.length })}
        </div>
      </CardContent>
    </Card>
  );
}
