/**
 * Contacts Index Mapping
 * 
 * Elasticsearch mapping for contacts/speakers with organization relationships.
 * 
 * @module elasticsearch/mappings/contacts
 */

import type { MappingTypeMapping } from '@elastic/elasticsearch/lib/api/types';
import {
  bilingualTextField,
  englishTextField,
  emailField,
  phoneField,
  keywordField,
  dateField,
  integerField,
  booleanField,
  auditFields,
  idField,
  suggestField,
} from './common-fields';

export const contactsMapping: MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    // Primary identifier
    id: integerField,
    
    // Name (bilingual)
    ...bilingualTextField('name'),
    
    // Title/Position
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
    
    // Contact information
    ...emailField('email'),
    ...phoneField('phone'),
    ...phoneField('mobile'),
    
    // Organization relationship
    organizationId: integerField,
    organizationName: { type: 'keyword' },
    organizationNameAr: { type: 'keyword' },
    
    // Position/Role
    positionId: integerField,
    positionName: { type: 'keyword' },
    positionNameAr: { type: 'keyword' },
    
    // Country
    countryId: integerField,
    countryName: { type: 'keyword' },
    countryNameAr: { type: 'keyword' },
    countryCode: { type: 'keyword' },
    
    // Contact type
    contactType: { type: 'keyword' }, // speaker, vip, media, partner, other
    
    // Social links (not indexed, just stored)
    linkedIn: { type: 'keyword', index: false },
    twitter: { type: 'keyword', index: false },
    
    isEligibleSpeaker: booleanField,
    // Bio
    ...bilingualTextField('bio'),
    
    // Status
    isActive: booleanField,
    isVIP: booleanField,
    
    // Statistics (denormalized)
    eventsCount: integerField, // Number of events participated
    lastEventDate: dateField, // Last event they participated in
    
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
