/**
 * Calendar Heatmap Component
 * 
 * GitHub-style calendar heatmap showing event density per day.
 * 
 * @module components/analytics/CalendarHeatmap
 */

import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface HeatmapData {
  date: string;
  count: number;
  events: { id: number; title: string }[];
}

interface CalendarHeatmapProps {
  data: HeatmapData[];
  year: number;
  onDateClick?: (date: string, events: { id: number; title: string }[]) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Get color class based on event count
 */
function getColor(count: number): string {
  if (count === 0) return 'bg-muted';
  if (count === 1) return 'bg-green-200 dark:bg-green-900';
  if (count <= 3) return 'bg-green-400 dark:bg-green-700';
  if (count <= 5) return 'bg-green-600 dark:bg-green-500';
  return 'bg-green-800 dark:bg-green-300';
}

/**
 * Calendar Heatmap displaying event density
 */
export function CalendarHeatmap({ data, year, onDateClick }: CalendarHeatmapProps) {
  const { t } = useTranslation('analytics');

  // Create map for O(1) lookup
  const dataMap = useMemo(() => {
    const map = new Map<string, HeatmapData>();
    data.forEach((d) => map.set(d.date, d));
    return map;
  }, [data]);

  // Generate weeks for the calendar
  const weeks = useMemo(() => {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const weeksArray: (Date | null)[][] = [];
    let currentWeek: (Date | null)[] = [];

    // Pad first week with nulls
    const firstDay = startDate.getDay();
    for (let i = 0; i < firstDay; i++) {
      currentWeek.push(null);
    }

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      currentWeek.push(new Date(d));

      if (currentWeek.length === 7) {
        weeksArray.push(currentWeek);
        currentWeek = [];
      }
    }

    // Add remaining days
    if (currentWeek.length > 0) {
      weeksArray.push(currentWeek);
    }

    return weeksArray;
  }, [year]);

  return (
    <TooltipProvider>
      <div className="overflow-x-auto pb-4">
        <div className="inline-flex gap-1 min-w-max">
          {/* Day labels */}
          <div className="flex flex-col gap-1 me-2 pt-5">
            {DAYS.map((day, idx) => (
              <div
                key={day}
                className={cn(
                  "h-3 text-xs text-muted-foreground flex items-center",
                  idx % 2 === 0 ? "opacity-100" : "opacity-0" // Show every other day
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Weeks grid */}
          <div className="flex gap-1">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1">
                {/* Month label at top of first week of month */}
                <div className="h-4 text-xs text-muted-foreground">
                  {week[0] && week[0].getDate() <= 7 
                    ? MONTHS[week[0].getMonth()] 
                    : ''}
                </div>
                {week.map((date, dayIndex) => {
                  if (!date) {
                    return <div key={`empty-${dayIndex}`} className="h-3 w-3" />;
                  }

                  const dateStr = date.toISOString().split('T')[0];
                  const dayData = dataMap.get(dateStr);
                  const count = dayData?.count || 0;

                  return (
                    <Tooltip key={dateStr}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'h-3 w-3 rounded-sm cursor-pointer hover:ring-2 hover:ring-primary transition-all',
                            getColor(count)
                          )}
                          onClick={() => dayData && onDateClick?.(dateStr, dayData.events)}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm">
                          <p className="font-medium">
                            {date.toLocaleDateString(undefined, {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                          <p className="text-muted-foreground">
                            {count} {t('heatmap.events', { count })}
                          </p>
                          {dayData?.events.slice(0, 3).map((e) => (
                            <p key={e.id} className="text-xs text-muted-foreground truncate max-w-48">
                              • {e.title}
                            </p>
                          ))}
                          {dayData && dayData.events.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{dayData.events.length - 3} {t('eventsAnalytics.heatmap.more')}
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 justify-end">
          <span className="text-xs text-muted-foreground">{t('eventsAnalytics.heatmap.less')}</span>
          <div className="flex gap-1">
            {[0, 1, 3, 5, 7].map((count) => (
              <div key={count} className={cn('h-3 w-3 rounded-sm', getColor(count))} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{t('eventsAnalytics.heatmap.more')}</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

/**
 * Loading skeleton for Calendar Heatmap
 */
export function CalendarHeatmapSkeleton() {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="h-28 bg-muted animate-pulse rounded" />
      <div className="flex items-center gap-2 mt-4 justify-end">
        <div className="h-3 w-20 bg-muted animate-pulse rounded" />
      </div>
    </div>
  );
}

export default CalendarHeatmap;
