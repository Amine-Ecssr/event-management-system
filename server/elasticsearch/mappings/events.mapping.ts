/**
 * Events Index Mapping
 * 
 * Elasticsearch mapping for events with bilingual support.
 * Indexes both active events and provides structure for archived events.
 * 
 * @module elasticsearch/mappings/events
 */

import type { MappingTypeMapping } from '@elastic/elasticsearch/lib/api/types';
import {
  bilingualTextField,
  englishTextField,
  keywordField,
  dateField,
  integerField,
  booleanField,
  auditFields,
  idField,
  urlField,
  suggestField,
} from './common-fields';

export const eventsMapping: MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    // Primary identifier
    id: idField,
    
    // Bilingual text fields
    ...bilingualTextField('name'),
    ...bilingualTextField('description'),
    ...bilingualTextField('location'),
    ...bilingualTextField('organizers'),
    
    // Combined search text for cross-language queries
    searchText: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
      fields: {
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete_analyzer',
          search_analyzer: 'autocomplete_search_analyzer',
        },
      },
    },
    
    // Autocomplete suggestions with context filtering
    ...suggestField('suggest', true),
    
    // Date and time fields
    startDate: dateField,
    endDate: dateField,
    startTime: { type: 'keyword' },
    endTime: { type: 'keyword' },
    
    // Category
    category: { type: 'keyword' },
    categoryId: integerField,
    categoryNameEn: { type: 'keyword' },
    categoryNameAr: { type: 'keyword' },
    
    // Event type enums
    eventType: { type: 'keyword' }, // local, international
    eventScope: { type: 'keyword' }, // internal, external
    
    // URLs
    ...urlField('url'),
    
    // Attendance metrics
    expectedAttendance: integerField,
    actualAttendance: integerField,
    
    // Scraping and source tracking
    isScraped: booleanField,
    source: { type: 'keyword' }, // manual, abu-dhabi-media-office, etc.
    externalId: { type: 'keyword' },
    adminModified: booleanField,
    
    // Reminder preferences
    reminder1Week: booleanField,
    reminder1Day: booleanField,
    reminderWeekly: booleanField,
    reminderDaily: booleanField,
    reminderMorningOf: booleanField,
    
    // Archive status
    isArchived: booleanField,
    archivedAt: dateField,
    
    // Agenda files
    agendaEnFileName: { type: 'keyword', index: false },
    agendaEnStoredFileName: { type: 'keyword', index: false },
    agendaArFileName: { type: 'keyword', index: false },
    agendaArStoredFileName: { type: 'keyword', index: false },
    
    // Related entities (denormalized for search)
    departments: {
      type: 'nested',
      properties: {
        id: integerField,
        name: { type: 'keyword' },
        nameAr: { type: 'keyword' },
        isLeadDepartment: booleanField,
      },
    },
    
    // Tags for filtering
    tags: { type: 'keyword' },
    
    // Media count
    mediaCount: integerField,
    hasThumbnail: booleanField,
    
    // Pre-computed engagement stats (denormalized)
    inviteeCount: integerField,
    attendeeCount: integerField,
    registeredCount: integerField,
    attendanceRate: integerField, // Percentage
    
    // Audit fields
    ...auditFields,
  },
};

/**
 * Archived Events Mapping
 * Same structure as events with additional archive-specific fields
 */
export const archivedEventsMapping: MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    // Archive-specific fields
    id: integerField, // Serial ID in archived_events table
    originalEventId: idField, // Reference to original event
    
    // Copy all event fields
    ...bilingualTextField('name'),
    ...bilingualTextField('description'),
    ...bilingualTextField('location'),
    ...bilingualTextField('organizers'),
    
    searchText: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
      fields: {
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete_analyzer',
          search_analyzer: 'autocomplete_search_analyzer',
        },
      },
    },
    
    ...suggestField('suggest', true),
    
    startDate: dateField,
    endDate: dateField,
    startTime: { type: 'keyword' },
    endTime: { type: 'keyword' },
    
    category: { type: 'keyword' },
    categoryId: integerField,
    categoryNameEn: { type: 'keyword' },
    categoryNameAr: { type: 'keyword' },
    
    eventType: { type: 'keyword' },
    eventScope: { type: 'keyword' },
    
    ...urlField('url'),
    
    expectedAttendance: integerField,
    actualAttendance: integerField,
    
    isScraped: booleanField,
    source: { type: 'keyword' },
    
    // Archive-specific audit
    archivedAt: dateField,
    archivedById: integerField,
    
    // Summary data from archive
    speakersCount: integerField,
    attendeesCount: integerField,
    tasksCount: integerField,
    completedTasksCount: integerField,
    
    // Media
    mediaCount: integerField,
    
    // Departments snapshot
    departments: {
      type: 'nested',
      properties: {
        id: integerField,
        name: { type: 'keyword' },
        nameAr: { type: 'keyword' },
        isLeadDepartment: booleanField,
      },
    },
    
    // Speakers snapshot
    speakers: {
      type: 'nested',
      properties: {
        id: integerField,
        name: { type: 'text', analyzer: 'bilingual_analyzer' },
        organization: { type: 'keyword' },
        role: { type: 'keyword' },
      },
    },
    
    // Archive creation method flag
    createdDirectly: booleanField,
    
    ...auditFields,
  },
};
