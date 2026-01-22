import { Event, CalendarViewMode } from '@/lib/types';
import CalendarGrid from './CalendarGrid';
import { 
  startOfMonth, 
  addMonths, 
  startOfQuarter, 
  startOfYear,
  format 
} from 'date-fns';

interface MultiMonthCalendarProps {
  currentDate: Date;
  events: Event[];
  onEventClick: (event: Event) => void;
  hoveredEventId?: string | null;
  onEventHover?: (eventId: string | null) => void;
  viewMode: CalendarViewMode;
}

export default function MultiMonthCalendar({
  currentDate,
  events,
  onEventClick,
  hoveredEventId,
  onEventHover,
  viewMode,
}: MultiMonthCalendarProps) {
  const getMonthsToDisplay = (): Date[] => {
    switch (viewMode) {
      case 'monthly':
        return [currentDate];
      case 'quarterly':
        const quarterStart = startOfQuarter(currentDate);
        return [quarterStart, addMonths(quarterStart, 1), addMonths(quarterStart, 2)];
      case 'bi-annually':
        const month = currentDate.getMonth();
        const halfStart = month < 6 
          ? startOfYear(currentDate) 
          : addMonths(startOfYear(currentDate), 6);
        return Array.from({ length: 6 }, (_, i) => addMonths(halfStart, i));
      case 'yearly':
        const yearStart = startOfYear(currentDate);
        return Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));
      default:
        return [currentDate];
    }
  };

  const months = getMonthsToDisplay();
  const gridClass = viewMode === 'monthly' 
    ? '' 
    : viewMode === 'quarterly'
    ? 'grid grid-cols-1 lg:grid-cols-3 gap-6'
    : viewMode === 'bi-annually'
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
    : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6';

  return (
    <div className={gridClass}>
      {months.map((monthDate, index) => (
        <div key={index}>
          {viewMode !== 'monthly' && (
            <h3 className="text-lg font-semibold font-heading text-secondary mb-3">
              {format(monthDate, 'MMMM yyyy')}
            </h3>
          )}
          <CalendarGrid
            currentDate={monthDate}
            events={events}
            onEventClick={onEventClick}
            hoveredEventId={hoveredEventId}
            onEventHover={onEventHover}
          />
        </div>
      ))}
    </div>
  );
}
