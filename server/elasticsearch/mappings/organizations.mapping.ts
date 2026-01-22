/**
 * Organizations Index Mapping
 * 
 * Elasticsearch mapping for organizations (including partners).
 * 
 * @module elasticsearch/mappings/organizations
 */

import type { MappingTypeMapping } from '@elastic/elasticsearch/lib/api/types';
import {
  bilingualTextField,
  emailField,
  phoneField,
  urlField,
  dateField,
  integerField,
  booleanField,
  floatField,
  auditFields,
  idField,
  suggestField,
} from './common-fields';

export const organizationsMapping: MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    // Primary identifier
    id: integerField,
    
    // Organization name (bilingual)
    ...bilingualTextField('name'),
    
    // Short name / acronym
    shortName: { type: 'keyword' },
    shortNameAr: { type: 'keyword' },
    
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
    
    // Organization type
    organizationType: { type: 'keyword' }, // government, private, non-profit, academic, media, etc.
    
    // Contact information
    ...emailField('email'),
    ...phoneField('phone'),
    ...urlField('website'),
    
    // Location (denormalized for aggregations and Kibana maps)
    countryId: integerField,
    countryName: { type: 'keyword' }, // Keyword for aggregations/filtering
    countryNameAr: { type: 'keyword' }, // Arabic name for RTL support
    countryCode: { type: 'keyword' }, // ISO code for Kibana map visualization
    country: { type: 'keyword' }, // Deprecated - use countryName instead
    city: { type: 'keyword' },
    address: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
    },
    
    // Industry/Sector
    industry: { type: 'keyword' },
    sector: { type: 'keyword' },
    
    // Description
    ...bilingualTextField('description'),
    
    // Partnership status
    isPartner: booleanField,
    partnershipTypeId: integerField,
    partnershipTypeName: { type: 'keyword' },
    partnershipStatus: { type: 'keyword' }, // active, inactive, potential, former
    partnerSince: dateField,
    
    // Lead status (for potential partners)
    isLead: booleanField,
    leadStatus: { type: 'keyword' }, // new, contacted, qualified, proposal, negotiation, won, lost
    leadScore: integerField, // 1-100
    
    // Statistics (denormalized)
    contactsCount: integerField,
    eventsCount: integerField,
    agreementsCount: integerField,
    activeAgreementsCount: integerField,
    
    // Financial (if applicable)
    totalAgreementValue: floatField,
    
    // Status
    isActive: booleanField,
    
    // Tags
    tags: { type: 'keyword' },
    
    // Notes
    notes: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
    },

    // Completion suggester for autocomplete
    ...suggestField('suggest', true),

    // Audit fields
    ...auditFields,
  },
};
