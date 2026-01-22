import { Event } from '@/lib/types';
import { useState, useEffect } from 'react';
import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval,
  format,
  isSameMonth,
  isWithinInterval,
  parseISO,
  isSameDay,
  isToday,
  addDays,
  differenceInDays,
  min,
  max
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { getEventColor, getEventColorByIndex } from '@/lib/eventColors';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CalendarGridProps {
  currentDate: Date;
  events: Event[];
  onEventClick: (event: Event) => void;
  hoveredEventId?: string | null;
  onEventHover?: (eventId: string | null) => void;
}

interface EventBar {
  event: Event;
  startCol: number;
  span: number;
  colorIndex: number;
  row: number;
}

interface WeekEventData {
  eventBars: EventBar[];
  rowCount: number;
}

export default function CalendarGrid({ currentDate, events, onEventClick, hoveredEventId, onEventHover }: CalendarGridProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const locale = isArabic ? ar : undefined;
  
  // Force re-render when theme changes to update event colors
  const [, forceUpdate] = useState(0);
  
  useEffect(() => {
    const handleThemeChange = () => {
      forceUpdate(prev => prev + 1);
    };
    
    window.addEventListener('themechange', handleThemeChange);
    return () => window.removeEventListener('themechange', handleThemeChange);
  }, []);
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = [
    t('calendar.weekdays.mon'),
    t('calendar.weekdays.tue'),
    t('calendar.weekdays.wed'),
    t('calendar.weekdays.thu'),
    t('calendar.weekdays.fri'),
    t('calendar.weekdays.sat'),
    t('calendar.weekdays.sun')
  ];
  
  // Organize days into weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  
  // Create a global color map for all events to ensure consistent colors across weeks
  const eventColorMap = new Map<string, number>();
  events.forEach((event) => {
    if (!eventColorMap.has(event.id)) {
      eventColorMap.set(event.id, getEventColor(event.id));
    }
  });
  
  // Track the first week index where each event appears (for name display)
  const eventFirstAppearance = new Map<string, number>();
  weeks.forEach((week, weekIndex) => {
    const weekStart = week[0];
    const weekEnd = week[6];
    
    events.forEach((event) => {
      const eventStart = parseISO(event.startDate);
      const eventEnd = parseISO(event.endDate);
      
      // Check if event overlaps with this week
      if (eventStart <= weekEnd && eventEnd >= weekStart) {
        if (!eventFirstAppearance.has(event.id)) {
          eventFirstAppearance.set(event.id, weekIndex);
        }
      }
    });
  });
  
  // Get event bars for a specific week with smart row-based color assignment
  const getEventBarsForWeek = (week: Date[]): WeekEventData => {
    const weekStart = week[0];
    const weekEnd = week[6];
    const weekEvents: Array<{ event: Event; startCol: number; endCol: number; span: number }> = [];
    
    // First, collect all events for this week
    events.forEach((event) => {
      const eventStart = parseISO(event.startDate);
      const eventEnd = parseISO(event.endDate);
      
      // Check if event overlaps with this week
      if (eventStart <= weekEnd && eventEnd >= weekStart) {
        // Calculate where the event starts and ends within this week
        const barStart = max([eventStart, weekStart]);
        const barEnd = min([eventEnd, weekEnd]);
        
        // Find which column (day) the bar starts at
        const startCol = week.findIndex(day => isSameDay(day, barStart));
        const endCol = week.findIndex(day => isSameDay(day, barEnd));
        
        if (startCol !== -1 && endCol !== -1) {
          weekEvents.push({
            event,
            startCol,
            endCol,
            span: endCol - startCol + 1,
          });
        }
      }
    });
    
    // Sort by start column, then by end column (longer events first)
    weekEvents.sort((a, b) => {
      if (a.startCol !== b.startCol) return a.startCol - b.startCol;
      return b.endCol - a.endCol;
    });
    
    // Assign events to rows with smart color assignment
    const rows: Array<Array<{ event: Event; startCol: number; endCol: number; span: number; colorIndex: number; rowIndex: number }>> = [];
    const usedColorsInWeek = new Set<number>();
    
    weekEvents.forEach((weekEvent) => {
      // Find the first row where this event fits (no overlap with any event in that row)
      let targetRow = -1;
      for (let i = 0; i < rows.length; i++) {
        // Check if event overlaps with any event in this row
        const hasOverlap = rows[i].some(existingEvent => {
          // Events overlap if one starts before the other ends
          return !(weekEvent.endCol < existingEvent.startCol || weekEvent.startCol > existingEvent.endCol);
        });
        
        if (!hasOverlap) {
          targetRow = i;
          break;
        }
      }
      
      // If no suitable row found, create a new one
      if (targetRow === -1) {
        targetRow = rows.length;
        rows.push([]);
      }
      
      // Use the globally assigned color for consistency across weeks
      const colorIndex = eventColorMap.get(weekEvent.event.id) ?? getEventColor(weekEvent.event.id);
      
      usedColorsInWeek.add(colorIndex);
      
      const currentRow = rows[targetRow];
      currentRow.push({
        ...weekEvent,
        colorIndex,
        rowIndex: targetRow,
      });
    });
    
    // Flatten rows back into event bars
    const eventBars: EventBar[] = [];
    rows.forEach((row, rowIndex) => {
      row.forEach((item) => {
        eventBars.push({
          event: item.event,
          startCol: item.startCol,
          span: item.span,
          colorIndex: item.colorIndex,
          row: rowIndex,
        });
      });
    });
    
    return {
      eventBars,
      rowCount: rows.length,
    };
  };
  
  // Calculate dynamic height based on event row count
  const calculateWeekHeight = (rowCount: number, isMobile: boolean): string => {
    const baseHeight = isMobile ? 112 : 80; // min-h-28 (112px) for mobile, min-h-20 (80px) for desktop
    const rowHeight = 24; // ~24px per event row (h-5 is 20px + gap)
    const additionalHeight = Math.max(0, rowCount) * rowHeight;
    return `${baseHeight + additionalHeight}px`;
  };

  return (
    <div className="border rounded-md overflow-hidden" data-testid="calendar-grid">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 bg-secondary">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-2 md:p-3 text-center text-xs md:text-sm font-semibold text-secondary-foreground font-heading"
          >
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar weeks */}
      <div className="bg-card">
        {weeks.map((week, weekIndex) => {
          const weekData = getEventBarsForWeek(week);
          const { eventBars, rowCount } = weekData;
          
          // Calculate dynamic heights for desktop and mobile
          const desktopHeight = calculateWeekHeight(rowCount, false);
          const mobileHeight = calculateWeekHeight(rowCount, true);
          
          return (
            <div key={weekIndex} className="relative">
              {/* Day cells */}
              <div className="grid grid-cols-7">
                {week.map((day, dayIndex) => {
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isCurrentDay = isToday(day);
                  
                  return (
                    <div
                      key={dayIndex}
                      style={{
                        minHeight: `max(${mobileHeight}, ${desktopHeight})`
                      }}
                      className={`border border-border p-1 md:p-2 ${
                        isCurrentMonth ? 'bg-background' : 'bg-muted/30'
                      } ${isCurrentDay ? 'ring-2 ring-primary ring-inset' : ''}`}
                      data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                    >
                      <div
                        className={`text-xs md:text-sm font-medium mb-1 ${
                          isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                        } ${isCurrentDay ? 'text-primary font-bold' : ''}`}
                      >
                        {format(day, 'd')}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Event bars overlaid on desktop */}
              <div className="hidden md:block absolute inset-0 pointer-events-none">
                {/* Event bars grid */}
                <div className="grid grid-cols-7 h-full p-1 md:p-2">
                  <div className="col-span-7 pt-5 md:pt-6">
                    <div className="grid grid-cols-7 gap-y-1">
                      {eventBars.map((bar, barIndex) => {
                        const isFirstDayOfEvent = week[bar.startCol] && isSameDay(week[bar.startCol], parseISO(bar.event.startDate));
                        const isFirstAppearanceInMonth = eventFirstAppearance.get(bar.event.id) === weekIndex;
                        const colors = getEventColorByIndex(bar.colorIndex);
                        
                        return (
                          <Tooltip key={`${bar.event.id}-${weekIndex}`}>
                            <TooltipTrigger asChild>
                              <div
                                onClick={() => onEventClick(bar.event)}
                                onMouseEnter={() => onEventHover?.(bar.event.id)}
                                onMouseLeave={() => onEventHover?.(null)}
                                style={{
                                  gridColumnStart: bar.startCol + 1,
                                  gridColumnEnd: bar.startCol + bar.span + 1,
                                  backgroundColor: colors.light,
                                  borderLeftWidth: '4px',
                                  borderLeftStyle: 'solid',
                                  borderLeftColor: colors.base,
                                  filter: hoveredEventId === bar.event.id ? 'brightness(1.1)' : 'none',
                                }}
                                className={`text-xs px-1.5 h-5 flex items-center cursor-pointer pointer-events-auto transition-all mx-0.5 ${
                                  bar.span === 1 ? 'rounded' : isFirstDayOfEvent ? 'rounded-l' : 'rounded'
                                } ${
                                  hoveredEventId === bar.event.id 
                                    ? 'ring-2 ring-primary/50' 
                                    : ''
                                }`}
                                data-testid={`event-bar-${bar.event.id}`}
                              >
                                <div className="truncate text-gray-800 dark:text-white font-medium">
                                  {i18n.language === 'ar' && bar.event.nameAr ? bar.event.nameAr : bar.event.name}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{i18n.language === 'ar' && bar.event.nameAr ? bar.event.nameAr : bar.event.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(bar.event.startDate), isArabic ? 'MMM d' : 'MMM d', { locale })} - {format(parseISO(bar.event.endDate), isArabic ? 'MMM d yyyy' : 'MMM d, yyyy', { locale })}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Mobile: Show event bars with names */}
              <div className="md:hidden absolute inset-0 pointer-events-none">
                <div className="grid grid-cols-7 h-full p-1">
                  <div className="col-span-7 pt-5">
                    <div className="grid grid-cols-7 gap-y-0.5">
                      {eventBars.map((bar, barIndex) => {
                        const isFirstDayOfEvent = week[bar.startCol] && isSameDay(week[bar.startCol], parseISO(bar.event.startDate));
                        const isFirstAppearanceInMonth = eventFirstAppearance.get(bar.event.id) === weekIndex;
                        const colors = getEventColorByIndex(bar.colorIndex);
                        
                        return (
                          <Tooltip key={`${bar.event.id}-${weekIndex}-mobile`}>
                            <TooltipTrigger asChild>
                              <div
                                onClick={() => onEventClick(bar.event)}
                                onMouseEnter={() => onEventHover?.(bar.event.id)}
                                onMouseLeave={() => onEventHover?.(null)}
                                style={{
                                  gridColumnStart: bar.startCol + 1,
                                  gridColumnEnd: bar.startCol + bar.span + 1,
                                  backgroundColor: colors.light,
                                  borderLeftWidth: '3px',
                                  borderLeftStyle: 'solid',
                                  borderLeftColor: colors.base,
                                }}
                                className={`text-xs px-1.5 h-5 flex items-center cursor-pointer pointer-events-auto transition-all ${
                                  bar.span === 1 ? 'rounded' : isFirstDayOfEvent ? 'rounded-l' : 'rounded'
                                }`}
                                data-testid={`event-bar-mobile-${bar.event.id}`}
                              >
                                <div className="truncate text-gray-800 dark:text-white font-medium">
                                  {i18n.language === 'ar' && bar.event.nameAr ? bar.event.nameAr : bar.event.name}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{i18n.language === 'ar' && bar.event.nameAr ? bar.event.nameAr : bar.event.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(bar.event.startDate), isArabic ? 'MMM d' : 'MMM d', { locale })} - {format(parseISO(bar.event.endDate), isArabic ? 'MMM d yyyy' : 'MMM d, yyyy', { locale })}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
