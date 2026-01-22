import { addDays, format } from 'date-fns';
import type { Event } from '@shared/schema';

function escapeText(value?: string | null): string {
  if (!value) return '';
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function formatDateValue(date: Date, includeTime: boolean): string {
  return includeTime
    ? format(date, "yyyyMMdd'T'HHmmss")
    : format(date, 'yyyyMMdd');
}

function buildDateValue(dateStr: string, timeStr?: string | null): { value: string; isAllDay: boolean } {
  if (timeStr && timeStr.trim()) {
    const date = new Date(`${dateStr}T${timeStr}:00`);
    return { value: formatDateValue(date, true), isAllDay: false };
  }

  const date = new Date(dateStr);
  return { value: formatDateValue(date, false), isAllDay: true };
}

export function generateIcsFile(event: Event): { filename: string; content: string } {
  const { value: startValue, isAllDay } = buildDateValue(event.startDate, event.startTime);
  const hasStartTime = Boolean(event.startTime && event.startTime.trim());
  const endTime = event.endTime && event.endTime.trim() ? event.endTime : hasStartTime ? event.startTime : undefined;
  const endDateValue = buildDateValue(event.endDate, endTime);

  const dtEndValue = endDateValue.isAllDay
    ? formatDateValue(addDays(new Date(event.endDate), 1), false)
    : endDateValue.value;

  const timestamp = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");
  const filenameBase = slugify(event.name) || 'event';
  let dateSuffix = '';

  try {
    const parsedStart = new Date(event.startDate);
    if (!Number.isNaN(parsedStart.getTime())) {
      dateSuffix = `-${format(parsedStart, 'yyyyMMdd')}`;
    }
  } catch (error) {
    console.warn('[ICS Generator] Failed to format start date for filename:', error);
  }

  const filename = `${filenameBase}${dateSuffix}.ics`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EventCal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@eventcal`,
    `DTSTAMP:${timestamp}`,
    isAllDay ? `DTSTART;VALUE=DATE:${startValue}` : `DTSTART:${startValue}`,
    endDateValue.isAllDay ? `DTEND;VALUE=DATE:${dtEndValue}` : `DTEND:${dtEndValue}`,
    `SUMMARY:${escapeText(event.name)}`,
    event.description ? `DESCRIPTION:${escapeText(event.description)}` : undefined,
    event.location ? `LOCATION:${escapeText(event.location)}` : undefined,
    event.url ? `URL:${escapeText(event.url)}` : undefined,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return {
    filename,
    content: lines.join('\r\n'),
  };
}

export function getIcsBuffer(event: Event): Buffer {
  const { content } = generateIcsFile(event);
  return Buffer.from(content, 'utf-8');
}
