/**
 * Tasks Index Mapping
 * 
 * Elasticsearch mapping for tasks with status tracking and timeline support.
 * 
 * @module elasticsearch/mappings/tasks
 */

import type { MappingTypeMapping } from '@elastic/elasticsearch/lib/api/types';
import {
  bilingualTextField,
  keywordField,
  dateField,
  integerField,
  booleanField,
  auditFields,
  idField,
} from './common-fields';

export const tasksMapping: MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    // Primary identifier
    id: integerField,
    
    // Task name (bilingual)
    ...bilingualTextField('name'),
    
    // Task description
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
    
    // Status and priority
    status: { type: 'keyword' }, // pending, in_progress, completed, blocked, cancelled
    priority: { type: 'keyword' }, // low, medium, high, urgent
    
    // Timeline
    dueDate: dateField,
    dueDateBasis: { type: 'keyword' }, // event_start, event_end, custom
    dueDateOffset: integerField, // Days before/after basis
    startDate: dateField,
    completedAt: dateField,
    // Computed field: days from creation to completion (for analytics)
    completionDays: { type: 'float' },
    
    // Relationships
    eventId: idField,
    eventName: { type: 'keyword' }, // Denormalized for display
    eventNameAr: { type: 'keyword' },
    
    departmentId: integerField,
    departmentName: { type: 'keyword' },
    departmentNameAr: { type: 'keyword' },
    
    assignedToId: integerField,
    assignedToName: { type: 'keyword' },
    
    parentTaskId: integerField,
    
    // Task template reference
    templateId: integerField,
    templateName: { type: 'keyword' },
    
    // Dependencies
    dependsOn: { type: 'integer' }, // Array of task IDs
    blockedBy: { type: 'integer' }, // Array of blocking task IDs
    
    // Progress tracking
    estimatedHours: { type: 'float' },
    actualHours: { type: 'float' },
    progress: integerField, // 0-100 percentage
    
    // Flags
    isRecurring: booleanField,
    isMilestone: booleanField,
    isOverdue: booleanField,
    
    // Comments count (denormalized)
    commentsCount: integerField,
    attachmentsCount: integerField,
    
    // Audit fields
    ...auditFields,
  },
};
