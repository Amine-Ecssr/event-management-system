import { Event, CalendarViewMode } from '@/lib/types';
import ShadcnCalendarGrid from './ShadcnCalendarGrid';
import { 
  startOfQuarter, 
  startOfYear,
  addMonths,
  format 
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface ShadcnMultiMonthCalendarProps {
  currentDate: Date;
  events: Event[];
  onEventClick: (event: Event) => void;
  hoveredEventId?: string | null;
  onEventHover?: (eventId: string | null) => void;
  viewMode: CalendarViewMode;
}

export default function ShadcnMultiMonthCalendar({
  currentDate,
  events,
  onEventClick,
  hoveredEventId,
  onEventHover,
  viewMode,
}: ShadcnMultiMonthCalendarProps) {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const locale = isArabic ? ar : undefined;

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
  
  const gridClass = cn(
    viewMode === 'monthly' && '',
    viewMode === 'quarterly' && 'grid grid-cols-1 lg:grid-cols-3 gap-6',
    viewMode === 'bi-annually' && 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
    viewMode === 'yearly' && 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
  );

  return (
    <div className={gridClass} data-testid="shadcn-multi-month-calendar">
      {months.map((monthDate, index) => (
        <div key={index} className="space-y-3">
          {viewMode !== 'monthly' && (
            <h3 className="text-lg font-semibold text-foreground">
              {format(monthDate, 'MMMM yyyy', { locale })}
            </h3>
          )}
          <ShadcnCalendarGrid
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
