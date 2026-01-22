import { Event } from './types';
import { format, parseISO } from 'date-fns';

export function exportEventsToCSV(events: Event[]): void {
  if (events.length === 0) {
    return;
  }

  const headers = [
    'Name',
    'Name (Arabic)',
    'Description',
    'Description (Arabic)',
    'Start Date',
    'Start Time',
    'End Date',
    'End Time',
    'Location',
    'Location (Arabic)',
    'Organizers',
    'Organizers (Arabic)',
    'Category',
    'Category (Arabic)',
    'URL',
    'Event Type',
    'Event Scope'
  ];

  const csvRows = [headers.join(',')];

  events.forEach(event => {
    const row = [
      escapeCSVField(event.name),
      escapeCSVField(event.nameAr || ''),
      escapeCSVField(event.description || ''),
      escapeCSVField(event.descriptionAr || ''),
      format(parseISO(event.startDate), 'yyyy-MM-dd'),
      escapeCSVField(event.startTime || ''),
      format(parseISO(event.endDate), 'yyyy-MM-dd'),
      escapeCSVField(event.endTime || ''),
      escapeCSVField(event.location || ''),
      escapeCSVField(event.locationAr || ''),
      escapeCSVField(event.organizers || ''),
      escapeCSVField(event.organizersAr || ''),
      escapeCSVField(event.category || ''),
      escapeCSVField(event.categoryAr || ''),
      escapeCSVField(event.url || ''),
      escapeCSVField(event.eventType || 'local'),
      escapeCSVField(event.eventScope || 'external')
    ];
    csvRows.push(row.join(','));
  });

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `ecssr-events-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
