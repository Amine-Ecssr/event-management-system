/**
 * Common Elasticsearch Field Mappings
 * 
 * Reusable field definitions for consistent mapping across all indices.
 * These leverage the custom analyzers for proper Arabic/English text handling.
 * 
 * @module elasticsearch/mappings/common-fields
 */

import type { MappingProperty } from '@elastic/elasticsearch/lib/api/types';

/**
 * Bilingual text field with English and Arabic subfields
 * Supports autocomplete and exact matching
 */
export function bilingualTextField(baseName: string): Record<string, MappingProperty> {
  return {
    // English version
    [`${baseName}`]: {
      type: 'text',
      analyzer: 'english_analyzer',
      fields: {
        keyword: { type: 'keyword', ignore_above: 256 },
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete_analyzer',
          search_analyzer: 'autocomplete_search_analyzer',
        },
      },
    },
    // Arabic version
    [`${baseName}Ar`]: {
      type: 'text',
      analyzer: 'arabic_analyzer',
      search_analyzer: 'arabic_search_analyzer',
      fields: {
        keyword: { type: 'keyword', ignore_above: 256 },
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete_analyzer',
          search_analyzer: 'autocomplete_search_analyzer',
        },
      },
    },
  };
}

/**
 * English-only text field with autocomplete support
 */
export function englishTextField(fieldName: string): Record<string, MappingProperty> {
  return {
    [fieldName]: {
      type: 'text',
      analyzer: 'english_analyzer',
      fields: {
        keyword: { type: 'keyword', ignore_above: 256 },
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete_analyzer',
          search_analyzer: 'autocomplete_search_analyzer',
        },
      },
    },
  };
}

/**
 * Arabic-only text field with autocomplete support
 */
export function arabicTextField(fieldName: string): Record<string, MappingProperty> {
  return {
    [fieldName]: {
      type: 'text',
      analyzer: 'arabic_analyzer',
      search_analyzer: 'arabic_search_analyzer',
      fields: {
        keyword: { type: 'keyword', ignore_above: 256 },
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete_analyzer',
          search_analyzer: 'autocomplete_search_analyzer',
        },
      },
    },
  };
}

/**
 * Generic text field with bilingual analyzer
 */
export function textField(fieldName: string): Record<string, MappingProperty> {
  return {
    [fieldName]: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
      fields: {
        keyword: { type: 'keyword', ignore_above: 256 },
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete_analyzer',
          search_analyzer: 'autocomplete_search_analyzer',
        },
      },
    },
  };
}

/**
 * Keyword field for exact matching and aggregations
 */
export function keywordField(fieldName: string): Record<string, MappingProperty> {
  return {
    [fieldName]: {
      type: 'keyword',
    },
  };
}

/**
 * Normalized keyword - lowercased for case-insensitive matching
 */
export const normalizedKeyword: MappingProperty = {
  type: 'keyword',
  normalizer: 'lowercase',
};

/**
 * Date field with flexible parsing
 */
export const dateField: MappingProperty = {
  type: 'date',
  format: 'strict_date_optional_time||epoch_millis||yyyy-MM-dd',
};

/**
 * Integer field
 */
export const integerField: MappingProperty = {
  type: 'integer',
};

/**
 * Float/decimal field
 */
export const floatField: MappingProperty = {
  type: 'float',
};

/**
 * Boolean field
 */
export const booleanField: MappingProperty = {
  type: 'boolean',
};

/**
 * Email field with autocomplete
 */
export function emailField(fieldName: string): Record<string, MappingProperty> {
  return {
    [fieldName]: {
      type: 'text',
      analyzer: 'identifier_analyzer',
      fields: {
        keyword: { type: 'keyword' },
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete_analyzer',
          search_analyzer: 'autocomplete_search_analyzer',
        },
      },
    },
  };
}

/**
 * Phone number field
 */
export function phoneField(fieldName: string): Record<string, MappingProperty> {
  return {
    [fieldName]: {
      type: 'text',
      analyzer: 'identifier_analyzer',
      fields: {
        keyword: { type: 'keyword' },
      },
    },
  };
}

/**
 * URL field (not analyzed, stored for retrieval)
 */
export function urlField(fieldName: string): Record<string, MappingProperty> {
  return {
    [fieldName]: {
      type: 'keyword',
      index: false, // Not searchable but stored
    },
  };
}

/**
 * Nested object field for arrays of complex objects
 */
export function nestedField(fieldName: string, properties: Record<string, MappingProperty>): Record<string, MappingProperty> {
  return {
    [fieldName]: {
      type: 'nested',
      properties,
    },
  };
}

/**
 * Object field for embedded objects
 */
export function objectField(fieldName: string, properties: Record<string, MappingProperty>): Record<string, MappingProperty> {
  return {
    [fieldName]: {
      type: 'object',
      properties,
    },
  };
}

/**
 * Completion suggester field for type-ahead
 * With optional context support for filtering suggestions
 */
export function suggestField(fieldName: string, withContexts = false): Record<string, MappingProperty> {
  const baseConfig: any = {
    type: 'completion',
    analyzer: 'autocomplete_analyzer',
    search_analyzer: 'autocomplete_search_analyzer',
    preserve_separators: true,
    preserve_position_increments: true,
    max_input_length: 50,
  };
  
  // Add contexts for category/type filtering if requested
  if (withContexts) {
    baseConfig.contexts = [
      {
        name: 'category',
        type: 'category',
      },
      {
        name: 'type',
        type: 'category',
      },
    ];
  }
  
  return {
    [fieldName]: baseConfig,
  };
}

/**
 * Common audit fields (createdAt, updatedAt, createdById)
 */
export const auditFields: Record<string, MappingProperty> = {
  createdAt: dateField,
  updatedAt: dateField,
  createdById: integerField,
  updatedById: integerField,
};

/**
 * ID field (UUID or serial)
 */
export const idField: MappingProperty = {
  type: 'keyword',
};
