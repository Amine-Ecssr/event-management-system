/**
 * Departments Index Mapping
 * 
 * Elasticsearch mapping for departments/stakeholders.
 * 
 * @module elasticsearch/mappings/departments
 */

import type { MappingTypeMapping } from '@elastic/elasticsearch/lib/api/types';
import {
  bilingualTextField,
  emailField,
  dateField,
  integerField,
  booleanField,
  auditFields,
  suggestField,
} from './common-fields';

export const departmentsMapping: MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    // Primary identifier
    id: integerField,
    
    // Department name (bilingual)
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
    
    // Department code/abbreviation
    code: { type: 'keyword' },
    
    // Keycloak integration
    keycloakGroupId: { type: 'keyword' },
    keycloakGroupPath: { type: 'keyword' },
    
    // Contact
    ...emailField('email'),
    headOfDepartment: { type: 'keyword' },
    
    // Hierarchy
    parentDepartmentId: integerField,
    parentDepartmentName: { type: 'keyword' },
    level: integerField, // Hierarchy level (0 = root)
    path: { type: 'keyword' }, // Full path like /parent/child
    
    // Status
    isActive: booleanField,
    
    // Statistics (denormalized)
    membersCount: integerField,
    activeEventsCount: integerField,
    pendingTasksCount: integerField,

    // Completion suggester for autocomplete
    ...suggestField('suggest', true),

    // Audit fields
    ...auditFields,
  },
};
