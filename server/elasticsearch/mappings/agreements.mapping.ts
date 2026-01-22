/**
 * Partnership Agreements Index Mapping
 * 
 * Elasticsearch mapping for partnership agreements.
 * 
 * @module elasticsearch/mappings/agreements
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

export const agreementsMapping: MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    // Primary identifier
    id: integerField,
    
    // Agreement title (bilingual)
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
    
    // Agreement type
    agreementTypeId: integerField,
    agreementTypeName: { type: 'keyword' },
    agreementTypeNameAr: { type: 'keyword' },
    
    // Partner organization
    organizationId: integerField,
    organizationName: { type: 'keyword' },
    organizationNameAr: { type: 'keyword' },
    
    // Status
    status: { type: 'keyword' }, // draft, pending, active, expired, terminated, renewed
    
    // Dates
    startDate: dateField,
    endDate: dateField,
    signedDate: dateField,
    renewalDate: dateField,
    
    // Financial
    value: floatField,
    currency: { type: 'keyword' },
    
    // Terms
    ...bilingualTextField('terms'),
    ...bilingualTextField('scope'),
    
    // Renewal
    autoRenewal: booleanField,
    renewalPeriodMonths: integerField,
    renewalNotificationDays: integerField,
    
    // Reference number
    referenceNumber: { type: 'keyword' },
    
    // Department responsible
    departmentId: integerField,
    departmentName: { type: 'keyword' },
    
    // Contact person
    primaryContactId: integerField,
    primaryContactName: { type: 'keyword' },
    
    // Attachments count
    attachmentsCount: integerField,
    
    // Activities count
    activitiesCount: integerField,
    
    // Flags
    isExpiringSoon: booleanField, // Within 30 days
    needsRenewal: booleanField,
    
    // Notes
    notes: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
    },
    
    // Tags
    tags: { type: 'keyword' },

    // Completion suggester for autocomplete
    ...suggestField('suggest', true),

    // Audit fields
    ...auditFields,
  },
};
