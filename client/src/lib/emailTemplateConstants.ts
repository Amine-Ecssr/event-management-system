export const TEMPLATE_VARIABLES = [
  { key: '{{eventName}}', description: 'Name of the event' },
  { key: '{{description}}', description: 'Event description' },
  { key: '{{startDate}}', description: 'Event start date' },
  { key: '{{endDate}}', description: 'Event end date' },
  { key: '{{location}}', description: 'Event location/venue' },
  { key: '{{organizers}}', description: 'Event organizers' },
  { key: '{{category}}', description: 'Event category' },
  { key: '{{eventType}}', description: 'Event type (local/international)' },
  { key: '{{url}}', description: 'Event URL/link' },
  { key: '{{expectedAttendance}}', description: 'Expected number of attendees' },
  { key: '{{requirements}}', description: 'Auto-generated requirements section (use this to control where requirements appear)' },
];

export const SAMPLE_EVENT = {
  eventName: 'Annual Technology Summit 2025',
  description: 'Join us for the premier technology conference featuring industry leaders, innovative workshops, and networking opportunities.',
  startDate: 'March 15, 2025',
  endDate: 'March 17, 2025',
  location: 'Dubai World Trade Centre',
  organizers: 'Tech Innovation Hub',
  category: 'Technology',
  eventType: 'International',
  url: 'https://example.com/tech-summit',
  expectedAttendance: '500',
};
