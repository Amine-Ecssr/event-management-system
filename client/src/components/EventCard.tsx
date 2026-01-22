import { Calendar, MapPin, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Event } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface EventCardProps {
  event: Event;
  onClick: () => void;
  onHover?: (eventId: string | null) => void;
  hoveredEventId?: string | null;
}

export default function EventCard({ event, onClick, onHover, hoveredEventId }: EventCardProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const locale = isArabic ? ar : undefined;
  
  // Use Arabic content if available and language is Arabic
  const displayName = isArabic && (event as any).nameAr ? (event as any).nameAr : event.name;
  const displayDescription = isArabic && (event as any).descriptionAr ? (event as any).descriptionAr : event.description;
  const displayLocation = isArabic && (event as any).locationAr ? (event as any).locationAr : event.location;
  const startDate = parseISO(event.startDate);
  const endDate = parseISO(event.endDate);
  const isSameDay = event.startDate === event.endDate;
  
  let dateText;
  const dateFormat = isArabic ? 'MMM d yyyy' : 'MMM d, yyyy';
  const longDateFormat = isArabic ? 'MMMM d yyyy' : 'MMMM d, yyyy';
  const shortDateFormat = isArabic ? 'MMM d' : 'MMM d';
  
  if (isSameDay) {
    if (event.startTime || event.endTime) {
      const startTimeStr = event.startTime || '';
      const endTimeStr = event.endTime || '';
      if (startTimeStr && endTimeStr) {
        dateText = `${format(startDate, dateFormat, { locale })} ${startTimeStr} - ${endTimeStr}`;
      } else if (startTimeStr) {
        dateText = `${format(startDate, dateFormat, { locale })} ${startTimeStr}`;
      } else {
        dateText = `${format(startDate, dateFormat, { locale })} - ${endTimeStr}`;
      }
    } else {
      dateText = format(startDate, longDateFormat, { locale });
    }
  } else {
    const startTimeStr = event.startTime ? ` ${event.startTime}` : '';
    const endTimeStr = event.endTime ? ` ${event.endTime}` : '';
    dateText = `${format(startDate, shortDateFormat, { locale })}${startTimeStr} - ${format(endDate, dateFormat, { locale })}${endTimeStr}`;
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

  return (
    <Card
      className={`p-4 border-l-4 border-l-primary hover-elevate active-elevate-2 cursor-pointer transition-all ${
        isHovered ? 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background' : ''
      }`}
      onClick={onClick}
      onMouseEnter={() => onHover?.(event.id)}
      onMouseLeave={() => onHover?.(null)}
      data-testid={`card-event-${event.id}`}
    >
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          <h3 className="text-base sm:text-lg font-semibold font-heading text-secondary" data-testid={`text-event-name-${event.id}`}>
            {displayName}
          </h3>
          <div className="flex flex-wrap gap-2 shrink-0">
            {event.category && (
              <Badge variant="secondary" className="text-xs sm:text-sm">
                {isArabic && event.categoryAr ? event.categoryAr : event.category}
              </Badge>
            )}
            {sourceLabel && (
              <Badge variant="outline" className="text-xs">
                {sourceLabel}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Calendar className="h-4 w-4 text-primary" />
          <span data-testid={`text-event-date-${event.id}`}>{dateText}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span data-testid={`text-event-location-${event.id}`}>{displayLocation}</span>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2 font-body">
          {displayDescription}
        </p>
        
        <div className="flex items-center gap-2 pt-2">
          <span className="text-sm font-medium text-primary hover:underline">
            {t('events.viewDetails')}
          </span>
          {event.url && (
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
    </Card>
  );
}
