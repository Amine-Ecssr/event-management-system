/**
 * Interactions Index Mapping
 * 
 * Elasticsearch mapping for lead and partnership interactions.
 * Used for both lead_interactions and partnership_interactions indices.
 * 
 * @module elasticsearch/mappings/interactions
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

export const interactionsMapping: MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    // Primary identifier
    id: integerField,
    
    // Reference (can be leadId or organizationId)
    referenceId: integerField,
    referenceType: { type: 'keyword' }, // lead, partnership
    
    // Lead reference (if lead interaction)
    leadId: integerField,
    leadName: { type: 'keyword' },
    
    // Organization/Partnership reference
    organizationId: integerField,
    organizationName: { type: 'keyword' },
    
    // Interaction type
    type: { type: 'keyword' }, // call, email, meeting, note, task, demo, proposal, follow_up
    direction: { type: 'keyword' }, // inbound, outbound
    
    // Subject and content
    ...bilingualTextField('subject'),
    content: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
    },
    
    // Outcome
    outcome: { type: 'keyword' }, // successful, unsuccessful, no_answer, voicemail, scheduled, completed
    nextAction: { type: 'keyword' },
    nextActionDate: dateField,
    
    // Duration (for calls/meetings)
    durationMinutes: integerField,
    
    // Date/Time
    interactionDate: dateField,
    scheduledDate: dateField,
    
    // Contact involved
    contactId: integerField,
    contactName: { type: 'keyword' },
    
    // User who logged
    userId: integerField,
    userName: { type: 'keyword' },
    
    // Related entities
    eventId: { type: 'keyword' },
    agreementId: integerField,
    
    // Sentiment (optional AI-generated)
    sentiment: { type: 'keyword' }, // positive, neutral, negative
    
    // Priority
    priority: { type: 'keyword' }, // low, normal, high
    
    // Follow-up required
    followUpRequired: booleanField,
    followUpDate: dateField,
    followUpCompleted: booleanField,

    // Completion suggester for autocomplete
    ...suggestField('suggest', true),

    // Audit fields
    ...auditFields,
  },
};
