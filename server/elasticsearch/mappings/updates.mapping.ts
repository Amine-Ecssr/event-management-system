/**
 * Updates Index Mapping
 * 
 * Elasticsearch mapping for weekly/monthly organizational updates.
 * 
 * @module elasticsearch/mappings/updates
 */

import type { MappingTypeMapping } from '@elastic/elasticsearch/lib/api/types';
import {
  bilingualTextField,
  dateField,
  integerField,
  booleanField,
  auditFields,
  suggestField,
} from './common-fields';

export const updatesMapping: MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    // Primary identifier
    id: integerField,
    
    // Update title
    ...bilingualTextField('title'),
    
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
    
    // Update type
    updateType: { type: 'keyword' }, // weekly, monthly, quarterly, annual, special
    
    // Period covered
    periodStart: dateField,
    periodEnd: dateField,
    
    // Content (could be large - store but limit indexing)
    content: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
    },
    contentAr: {
      type: 'text',
      analyzer: 'arabic_analyzer',
      search_analyzer: 'arabic_search_analyzer',
    },
    
    // HTML content (not indexed)
    htmlContent: { type: 'keyword', index: false },
    htmlContentAr: { type: 'keyword', index: false },
    
    // Summary
    ...bilingualTextField('summary'),
    
    // Status
    status: { type: 'keyword' }, // draft, review, published, archived
    publishedAt: dateField,
    
    // Distribution
    sentViaEmail: booleanField,
    sentViaWhatsApp: booleanField,
    sentAt: dateField,
    recipientsCount: integerField,
    
    // Highlights/Key points
    highlights: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
    },
    
    // Statistics snapshot
    eventsCount: integerField,
    tasksCompletedCount: integerField,
    newPartnershipsCount: integerField,
    
    // Author
    authorId: integerField,
    authorName: { type: 'keyword' },
    
    // Department
    departmentId: integerField,
    departmentName: { type: 'keyword' },
    
    // Tags
    tags: { type: 'keyword' },
    
    // Attachments
    attachmentsCount: integerField,
    
    // View tracking
    viewsCount: integerField,

    // Completion suggester for autocomplete
    ...suggestField('suggest', true),

    // Audit fields
    ...auditFields,
  },
};
