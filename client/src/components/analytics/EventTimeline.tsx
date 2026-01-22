/**
 * Event Timeline Component
 * 
 * Vertical timeline showing events in chronological order.
 * 
 * @module components/analytics/EventTimeline
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Calendar, Clock, Users, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';

interface TimelineEvent {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  category: string;
  type: string;
  status: 'upcoming' | 'active' | 'completed';
  attendeeCount: number;
}

interface EventTimelineProps {
  events: TimelineEvent[];
  maxItems?: number;
  showViewAll?: boolean;
}

const statusColors = {
  upcoming: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800',
  active: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800',
  completed: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
};

const dotColors = {
  upcoming: 'border-blue-500',
  active: 'border-green-500',
  completed: 'border-gray-400',
};

/**
 * Format date range for display
 */
function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startStr = start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  
  const endStr = end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  
  // If same day, show time range
  if (start.toDateString() === end.toDateString()) {
    return `${startStr}, ${start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  return `${startStr} - ${endStr}`;
}

/**
 * Event Timeline Component
 */
export function EventTimeline({ events, maxItems = 10, showViewAll = true }: EventTimelineProps) {
  const { t } = useTranslation();
  const displayEvents = events.slice(0, maxItems);

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('eventsAnalytics.timeline.noEvents')}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute start-4 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-0">
        {displayEvents.map((event, index) => (
          <div key={event.id} className="relative ps-10 pb-8 last:pb-0">
            {/* Timeline dot */}
            <div
              className={cn(
                'absolute start-2.5 w-3 h-3 rounded-full border-2 bg-background',
                dotColors[event.status]
              )}
            />

            {/* Event card */}
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge 
                      variant="outline" 
                      className={cn('text-xs', statusColors[event.status])}
                    >
                      {t(`eventsAnalytics.timeline.status.${event.status}`)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {event.category}
                    </Badge>
                  </div>
                  
                  <h4 className="font-medium truncate mb-2">
                    {event.name}
                  </h4>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDateRange(event.startDate, event.endDate)}
                    </span>
                    {event.type && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {event.type}
                      </span>
                    )}
                    {event.attendeeCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {event.attendeeCount}
                      </span>
                    )}
                  </div>
                </div>
                
                <Link href={`/admin/events/${event.id}`}>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* View all link */}
      {showViewAll && events.length > maxItems && (
        <div className="mt-4 text-center">
          <Link href="/calendar">
            <Button variant="outline">
              {t('eventsAnalytics.timeline.viewAll', { count: events.length - maxItems })}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Loading skeleton for Event Timeline
 */
export function EventTimelineSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="relative">
      <div className="absolute start-4 top-0 bottom-0 w-0.5 bg-border" />
      <div className="space-y-0">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="relative ps-10 pb-8 last:pb-0">
            <div className="absolute start-2.5 w-3 h-3 rounded-full border-2 bg-muted" />
            <div className="border rounded-lg p-4 bg-card">
              <div className="flex gap-2 mb-2">
                <div className="h-5 w-16 bg-muted animate-pulse rounded" />
                <div className="h-5 w-20 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-5 w-48 bg-muted animate-pulse rounded mb-2" />
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EventTimeline;
