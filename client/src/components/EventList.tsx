import { Event, CalendarViewMode } from '@/lib/types';
import EventCard from './EventCard';
import { Button } from '@/components/ui/button';
import { Calendar, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  addMonths 
} from 'date-fns';

interface EventListProps {
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

export default function EventList({ 
  events, 
  onEventClick, 
  onEventHover, 
  hoveredEventId,
  currentDate,
  viewMode = 'monthly',
  showAdminActions = false,
  onEdit,
  onDelete
}: EventListProps) {
  const { t } = useTranslation();
  
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
        
        // Show event if it overlaps with the period at all
        // Event overlaps if: eventStart <= periodEnd AND eventEnd >= periodStart
        // Using startOfDay/endOfDay ensures proper boundary handling
        return eventStart <= periodEnd && eventEnd >= periodStart;
      })
    : events;
  
  if (filteredEvents.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <p className="text-muted-foreground font-body">{t('events.noEventsForPeriod')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="event-list">
      {filteredEvents.map((event) => (
        <div key={event.id} className="relative">
          <EventCard
            event={event}
            onClick={() => onEventClick(event)}
            onHover={onEventHover}
            hoveredEventId={hoveredEventId}
          />
          {showAdminActions && (
            <div className="absolute bottom-3 ltr:right-3 rtl:left-3 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5 h-8 shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(event);
                }}
                data-testid={`button-edit-${event.id}`}
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('common.edit')}</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5 h-8 shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(event);
                }}
                data-testid={`button-delete-${event.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('common.delete')}</span>
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
