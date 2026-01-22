/**
 * Event Attendees Index Mapping (Denormalized)
 * 
 * Elasticsearch mapping for event attendees tracking.
 * Contains fully denormalized event, contact, and organization data
 * for fast aggregations without cross-index lookups.
 * 
 * @module elasticsearch/mappings/attendees
 */

import type { MappingTypeMapping } from '@elastic/elasticsearch/lib/api/types';
import {
  emailField,
  phoneField,
  dateField,
  integerField,
  booleanField,
  auditFields,
  idField,
} from './common-fields';

export const attendeesMapping: MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    // Primary identifier
    id: integerField,
    
    // ========== EVENT CONTEXT (Denormalized) ==========
    eventId: idField,
    eventName: { type: 'keyword' },
    eventNameAr: { type: 'keyword' },
    eventDate: dateField,
    eventEndDate: dateField,
    eventLocation: { type: 'keyword' },
    eventCategory: { type: 'keyword' },
    eventCategoryId: integerField,
    eventCategoryNameEn: { type: 'keyword' },
    eventCategoryNameAr: { type: 'keyword' },
    eventType: { type: 'keyword' },
    eventScope: { type: 'keyword' },
    
    // ========== CONTACT CONTEXT (Denormalized) ==========
    contactId: integerField,
    contactName: { 
      type: 'text',
      analyzer: 'bilingual_analyzer',
      fields: {
        keyword: { type: 'keyword' },
      },
    },
    contactNameAr: { 
      type: 'text',
      analyzer: 'bilingual_analyzer',
      fields: {
        keyword: { type: 'keyword' },
      },
    },
    ...emailField('contactEmail'),
    ...phoneField('contactPhone'),
    contactTitle: { type: 'keyword' },
    
    // ========== ORGANIZATION CONTEXT (Denormalized) ==========
    organizationId: integerField,
    organizationName: { type: 'keyword' },
    organizationNameAr: { type: 'keyword' },
    
    // ========== COUNTRY CONTEXT (Denormalized) ==========
    countryId: integerField,
    countryCode: { type: 'keyword' },
    countryNameEn: { type: 'keyword' },
    countryNameAr: { type: 'keyword' },
    
    // ========== ATTENDANCE DATA ==========
    attendedAt: dateField,
    notes: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
    },
    
    // Search text (concatenated for full-text search)
    searchText: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
    },

    // Audit fields
    ...auditFields,
  },
};