import { Calendar, MapPin, Clock, ExternalLink, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Event } from '@/lib/types';
import { format, parseISO, isToday, isTomorrow, isPast, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { getEventColor, getEventColorByIndex } from '@/lib/eventColors';

interface ShadcnEventCardProps {
  event: Event;
  onClick: () => void;
  onHover?: (eventId: string | null) => void;
  hoveredEventId?: string | null;
  compact?: boolean;
}

export default function ShadcnEventCard({ 
  event, 
  onClick, 
  onHover, 
  hoveredEventId,
  compact = false 
}: ShadcnEventCardProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const locale = isArabic ? ar : undefined;
  
  // Use Arabic content if available and language is Arabic
  const displayName = isArabic && event.nameAr ? event.nameAr : event.name;
  const displayDescription = isArabic && event.descriptionAr ? event.descriptionAr : event.description;
  const displayLocation = isArabic && event.locationAr ? event.locationAr : event.location;
  const startDate = parseISO(event.startDate);
  const endDate = parseISO(event.endDate);
  const isSameDay = event.startDate === event.endDate;
  
  // Get event color
  const colorIndex = getEventColor(event.id);
  const colors = getEventColorByIndex(colorIndex);
  
  // Determine event timing status
  const getTimingStatus = () => {
    const now = new Date();
    if (isPast(endDate) && !isToday(endDate)) {
      return { label: t('events.past'), variant: 'secondary' as const };
    }
    if (isToday(startDate)) {
      return { label: t('events.today'), variant: 'default' as const };
    }
    if (isTomorrow(startDate)) {
      return { label: t('events.tomorrow'), variant: 'default' as const };
    }
    const daysUntil = differenceInDays(startDate, now);
    if (daysUntil <= 7 && daysUntil > 0) {
      return { label: t('events.thisWeek'), variant: 'outline' as const };
    }
    return null;
  };
  
  const timingStatus = getTimingStatus();
  
  // Format date text
  let dateText;
  const dateFormat = isArabic ? 'MMM d yyyy' : 'MMM d, yyyy';
  const shortDateFormat = isArabic ? 'MMM d' : 'MMM d';
  
  if (isSameDay) {
    dateText = format(startDate, dateFormat, { locale });
  } else {
    dateText = `${format(startDate, shortDateFormat, { locale })} - ${format(endDate, dateFormat, { locale })}`;
  }
  
  // Format time
  let timeText = null;
  if (event.startTime) {
    timeText = event.endTime 
      ? `${event.startTime} - ${event.endTime}`
      : event.startTime;
  }
  
  const isHovered = hoveredEventId === event.id;
  
  // Determine source label
  const getSourceLabel = () => {
    if (!event.source || event.source === 'manual') return null;
    if (event.source === 'abu-dhabi-media-office') return t('events.sourceAbuDhabiMedia');
    if (event.source === 'adnec') return t('events.sourceAdnec');
    return t('events.sourceScraped');
  };
  
  const sourceLabel = getSourceLabel();

  if (compact) {
    return (
      <div
        onClick={onClick}
        onMouseEnter={() => onHover?.(event.id)}
        onMouseLeave={() => onHover?.(null)}
        className={cn(
          "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
          "hover:bg-accent/50",
          isHovered && "bg-accent ring-1 ring-ring"
        )}
        style={{
          borderLeftWidth: '3px',
          borderLeftStyle: 'solid',
          borderLeftColor: colors.base,
        }}
        data-testid={`shadcn-card-event-compact-${event.id}`}
      >
        {/* Date indicator */}
        <div 
          className="flex flex-col items-center justify-center min-w-[48px] h-12 rounded-md text-center"
          style={{ backgroundColor: colors.light }}
        >
          <span className="text-xs font-medium text-muted-foreground">
            {format(startDate, 'MMM', { locale })}
          </span>
          <span className="text-lg font-bold" style={{ color: colors.base }}>
            {format(startDate, 'd')}
          </span>
        </div>
        
        {/* Event info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{displayName}</h4>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {timeText && (
              <>
                <Clock className="h-3 w-3" />
                <span>{timeText}</span>
              </>
            )}
            {displayLocation && (
              <>
                {timeText && <span>•</span>}
                <MapPin className="h-3 w-3" />
                <span className="truncate">{displayLocation}</span>
              </>
            )}
          </div>
        </div>
        
        {/* Arrow indicator */}
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  return (
    <Card
      onClick={onClick}
      onMouseEnter={() => onHover?.(event.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        "group cursor-pointer transition-all overflow-hidden",
        "hover:shadow-md hover:border-primary/20",
        isHovered && "ring-2 ring-ring ring-offset-2 ring-offset-background shadow-md"
      )}
      data-testid={`shadcn-card-event-${event.id}`}
    >
      {/* Color accent bar */}
      <div 
        className="h-1.5 w-full"
        style={{ backgroundColor: colors.base }}
      />
      
      <CardContent className="p-4 space-y-3">
        {/* Header with badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base leading-tight line-clamp-2" data-testid={`shadcn-text-event-name-${event.id}`}>
              {displayName}
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5 shrink-0">
            {timingStatus && (
              <Badge variant={timingStatus.variant} className="text-xs">
                {timingStatus.label}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Date and time */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-primary shrink-0" />
            <span className="text-foreground" data-testid={`shadcn-text-event-date-${event.id}`}>
              {dateText}
            </span>
          </div>
          
          {timeText && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">{timeText}</span>
            </div>
          )}
          
          {displayLocation && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate" data-testid={`shadcn-text-event-location-${event.id}`}>
                {displayLocation}
              </span>
            </div>
          )}
        </div>
        
        {/* Description */}
        {displayDescription && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {displayDescription}
          </p>
        )}
        
        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex flex-wrap gap-1.5">
            {event.category && (
              <Badge variant="secondary" className="text-xs">
                {isArabic && event.categoryAr ? event.categoryAr : event.category}
              </Badge>
            )}
            {sourceLabel && (
              <Badge variant="outline" className="text-xs">
                {sourceLabel}
              </Badge>
            )}
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {t('events.viewDetails')}
            {event.url ? (
              <ExternalLink className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
