/**
 * Leads Index Mapping
 * 
 * Elasticsearch mapping for lead management.
 * 
 * @module elasticsearch/mappings/leads
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
  suggestField,
} from './common-fields';

export const leadsMapping: MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    // Primary identifier
    id: integerField,
    
    // Lead name (organization/company name - bilingual)
    ...bilingualTextField('name'),
    
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
    
    // Status and stage
    status: { type: 'keyword' }, // new, contacted, qualified, proposal, negotiation, won, lost
    stage: { type: 'keyword' }, // awareness, interest, consideration, intent, evaluation, purchase
    
    // Lead scoring
    score: integerField, // 1-100
    priority: { type: 'keyword' }, // low, medium, high, hot
    
    // Source
    source: { type: 'keyword' }, // website, referral, event, cold_call, social, etc.
    sourceDetail: { type: 'keyword' },
    campaignId: { type: 'keyword' },
    
    // Contact information
    contactName: { type: 'text', analyzer: 'bilingual_analyzer' },
    contactTitle: { type: 'keyword' },
    ...emailField('email'),
    ...phoneField('phone'),
    ...urlField('website'),
    
    // Company details
    companySize: { type: 'keyword' }, // small, medium, large, enterprise
    industry: { type: 'keyword' },
    country: { type: 'keyword' },
    city: { type: 'keyword' },
    
    // Description and notes
    ...bilingualTextField('description'),
    notes: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
    },
    
    // Assignment
    assignedToId: integerField,
    assignedToName: { type: 'keyword' },
    departmentId: integerField,
    departmentName: { type: 'keyword' },
    
    // Opportunity
    estimatedValue: floatField,
    currency: { type: 'keyword' },
    probability: integerField, // Win probability percentage
    expectedCloseDate: dateField,
    
    // Activity tracking
    lastContactDate: dateField,
    nextFollowUpDate: dateField,
    interactionsCount: integerField,
    
    // Conversion
    isConverted: booleanField,
    convertedToOrganizationId: integerField,
    convertedAt: dateField,
    lostReason: { type: 'keyword' },
    
    // Tags
    tags: { type: 'keyword' },

    // Completion suggester for autocomplete
    ...suggestField('suggest', true),

    // Audit fields
    ...auditFields,
  },
};
