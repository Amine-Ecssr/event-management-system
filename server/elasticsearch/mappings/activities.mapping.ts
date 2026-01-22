/**
 * Partnership Activities Index Mapping
 * 
 * Elasticsearch mapping for partnership activity tracking.
 * 
 * @module elasticsearch/mappings/activities
 */

import type { MappingTypeMapping } from '@elastic/elasticsearch/lib/api/types';
import {
  bilingualTextField,
  dateField,
  integerField,
  booleanField,
  floatField,
  auditFields,
  suggestField,
} from './common-fields';

export const activitiesMapping: MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    // Primary identifier
    id: integerField,
    
    // Organization/Partnership
    organizationId: integerField,
    organizationName: { type: 'keyword' },
    organizationNameAr: { type: 'keyword' },
    
    // Agreement (optional)
    agreementId: integerField,
    agreementTitle: { type: 'keyword' },
    
    // Activity title and description
    ...bilingualTextField('title'),
    ...bilingualTextField('description'),
    
    // Combined search text
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
    
    // Activity type
    activityType: { type: 'keyword' }, // event, publication, research, training, funding, collaboration, other
    
    // Status
    status: { type: 'keyword' }, // planned, in_progress, completed, cancelled, on_hold
    
    // Dates
    startDate: dateField,
    endDate: dateField,
    completedDate: dateField,
    
    // Location
    location: { type: 'keyword' },
    isVirtual: booleanField,
    
    // Participants/Attendees
    participantsCount: integerField,
    targetAudience: { type: 'keyword' },
    
    // Budget/Cost
    budget: floatField,
    actualCost: floatField,
    currency: { type: 'keyword' },
    
    // Event link (if related to an event)
    eventId: { type: 'keyword' },
    eventName: { type: 'keyword' },
    
    // Outcome/Results
    outcome: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
    },
    impact: { type: 'keyword' }, // high, medium, low
    
    // KPIs/Metrics
    metrics: {
      type: 'object',
      enabled: true, // Allow dynamic fields for various metrics
    },
    
    // Department responsible
    departmentId: integerField,
    departmentName: { type: 'keyword' },
    
    // Tags
    tags: { type: 'keyword' },
    
    // Attachments count
    attachmentsCount: integerField,

    // Completion suggester for autocomplete
    ...suggestField('suggest', true),

    // Audit fields
    ...auditFields,
  },
};
