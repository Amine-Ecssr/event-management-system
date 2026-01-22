/**
 * Custom Elasticsearch Analyzers for Arabic and English Text Processing
 * 
 * Requires ICU Analysis plugin to be installed in Elasticsearch.
 * These analyzers provide:
 * - Arabic text normalization (diacritics removal, alef normalization)
 * - English stemming and stop word removal
 * - Bilingual text handling
 * - Autocomplete support
 * 
 * @module elasticsearch/analyzers
 */

import type { IndicesIndexSettings, MappingProperty } from '@elastic/elasticsearch/lib/api/types';

/**
 * Analyzer settings configuration for Elasticsearch indices
 * Includes character filters, token filters, and custom analyzers
 */
export const ANALYZER_SETTINGS: IndicesIndexSettings = {
  analysis: {
    // Character filters for text preprocessing
    char_filter: {
      // Remove Arabic diacritics (tashkeel/harakat)
      arabic_normalize: {
        type: 'pattern_replace',
        pattern: '[\u064B-\u065F\u0670]',
        replacement: '',
      },
      // Normalize different forms of alef
      alef_normalize: {
        type: 'mapping',
        mappings: [
          '\u0622=>\u0627', // Alef with madda above -> Alef
          '\u0623=>\u0627', // Alef with hamza above -> Alef
          '\u0625=>\u0627', // Alef with hamza below -> Alef
        ],
      },
      // Normalize teh marbuta to heh
      teh_marbuta_normalize: {
        type: 'mapping',
        mappings: [
          '\u0629=>\u0647', // Teh marbuta -> Heh
        ],
      },
    },

    // Token filters for post-tokenization processing
    filter: {
      // English stemmer (Porter2)
      english_stemmer: {
        type: 'stemmer',
        language: 'english',
      },
      // English possessive stemmer
      english_possessive_stemmer: {
        type: 'stemmer',
        language: 'possessive_english',
      },
      // Arabic stemmer using built-in Arabic analyzer
      arabic_stemmer: {
        type: 'stemmer',
        language: 'arabic',
      },
      // ICU Folding for consistent unicode handling (requires ICU plugin)
      // @ts-expect-error ICU plugin types not in @elastic/elasticsearch
      icu_folding: {
        type: 'icu_folding',
      },
      // ICU Normalizer for Unicode normalization (requires ICU plugin)
      icu_normalizer: {
        type: 'icu_normalizer',
        name: 'nfc',
        // @ts-expect-error ICU plugin mode option not in types
        mode: 'compose',
      },
      // Lowercase with ICU (handles Arabic properly)
      lowercase_icu: {
        type: 'icu_transform',
        id: 'Any-Lower',
      },
      // Edge n-gram for autocomplete
      edge_ngram_filter: {
        type: 'edge_ngram',
        min_gram: 2,
        max_gram: 20,
      },
      // Shingle for phrase matching
      shingle_filter: {
        type: 'shingle',
        min_shingle_size: 2,
        max_shingle_size: 3,
        output_unigrams: true,
      },
      // Stop words - English
      english_stop: {
        type: 'stop',
        stopwords: '_english_',
      },
      // Stop words - Arabic
      arabic_stop: {
        type: 'stop',
        stopwords: '_arabic_',
      },
    },

    // Custom analyzers combining tokenizers and filters
    analyzer: {
      // English text analyzer with stemming
      english_analyzer: {
        type: 'custom',
        tokenizer: 'standard',
        char_filter: [],
        filter: [
          'english_possessive_stemmer',
          'lowercase',
          'english_stop',
          'english_stemmer',
          'icu_folding',
        ],
      },

      // Arabic text analyzer (requires ICU plugin)
      arabic_analyzer: {
        type: 'custom',
        tokenizer: 'icu_tokenizer',
        char_filter: [
          'arabic_normalize',
          'alef_normalize',
          'teh_marbuta_normalize',
        ],
        filter: [
          'lowercase_icu',
          'arabic_stop',
          'arabic_stemmer',
          'icu_folding',
          'icu_normalizer',
        ],
      },

      // Search analyzer for Arabic (less aggressive - no stemming)
      arabic_search_analyzer: {
        type: 'custom',
        tokenizer: 'icu_tokenizer',
        char_filter: [
          'arabic_normalize',
          'alef_normalize',
          'teh_marbuta_normalize',
        ],
        filter: [
          'lowercase_icu',
          'icu_folding',
          'icu_normalizer',
        ],
      },

      // Bilingual analyzer (handles both Arabic and English)
      bilingual_analyzer: {
        type: 'custom',
        tokenizer: 'icu_tokenizer',
        char_filter: [
          'arabic_normalize',
          'alef_normalize',
        ],
        filter: [
          'lowercase_icu',
          'icu_folding',
          'icu_normalizer',
        ],
      },

      // Autocomplete analyzer (for suggestions with edge n-grams)
      autocomplete_analyzer: {
        type: 'custom',
        tokenizer: 'standard',
        filter: [
          'lowercase',
          'edge_ngram_filter',
        ],
      },

      // Autocomplete search analyzer (without n-grams)
      autocomplete_search_analyzer: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase'],
      },

      // Exact match analyzer (no stemming, just normalization)
      exact_analyzer: {
        type: 'custom',
        tokenizer: 'keyword',
        filter: ['lowercase', 'icu_folding'],
      },

      // Phone/Email analyzer (preserve structure)
      identifier_analyzer: {
        type: 'custom',
        tokenizer: 'keyword',
        filter: ['lowercase'],
      },
    },
  },
};

/**
 * Field mapping factory functions for different field types
 * These create consistent field mappings with appropriate analyzers
 */
export const FIELD_MAPPINGS = {
  /**
   * English text field with autocomplete and exact match subfields
   */
  englishText: (fieldName: string): Record<string, MappingProperty> => ({
    [fieldName]: {
      type: 'text',
      analyzer: 'english_analyzer',
      search_analyzer: 'english_analyzer',
      fields: {
        keyword: { type: 'keyword', ignore_above: 256 },
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete_analyzer',
          search_analyzer: 'autocomplete_search_analyzer',
        },
        exact: {
          type: 'text',
          analyzer: 'exact_analyzer',
        },
      },
    },
  }),

  /**
   * Arabic text field with autocomplete and raw subfields
   */
  arabicText: (fieldName: string): Record<string, MappingProperty> => ({
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
        raw: {
          type: 'text',
          analyzer: 'bilingual_analyzer',
        },
      },
    },
  }),

  /**
   * Bilingual text field supporting both Arabic and English
   */
  bilingualText: (fieldName: string): Record<string, MappingProperty> => ({
    [fieldName]: {
      type: 'text',
      analyzer: 'bilingual_analyzer',
      fields: {
        keyword: { type: 'keyword', ignore_above: 256 },
        english: {
          type: 'text',
          analyzer: 'english_analyzer',
        },
        arabic: {
          type: 'text',
          analyzer: 'arabic_analyzer',
          search_analyzer: 'arabic_search_analyzer',
        },
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete_analyzer',
          search_analyzer: 'autocomplete_search_analyzer',
        },
      },
    },
  }),

  /**
   * Email field with autocomplete support
   */
  email: (fieldName: string): Record<string, MappingProperty> => ({
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
  }),

  /**
   * Phone number field
   */
  phone: (fieldName: string): Record<string, MappingProperty> => ({
    [fieldName]: {
      type: 'text',
      analyzer: 'identifier_analyzer',
      fields: {
        keyword: { type: 'keyword' },
      },
    },
  }),

  /**
   * Keyword field for exact matching and aggregations
   */
  keyword: (fieldName: string): Record<string, MappingProperty> => ({
    [fieldName]: {
      type: 'keyword',
    },
  }),

  /**
   * Date field with flexible format support
   */
  date: (fieldName: string): Record<string, MappingProperty> => ({
    [fieldName]: {
      type: 'date',
      format: 'strict_date_optional_time||epoch_millis',
    },
  }),

  /**
   * Integer number field
   */
  integer: (fieldName: string): Record<string, MappingProperty> => ({
    [fieldName]: { type: 'integer' },
  }),

  /**
   * Float/decimal number field
   */
  float: (fieldName: string): Record<string, MappingProperty> => ({
    [fieldName]: { type: 'float' },
  }),

  /**
   * Boolean field
   */
  boolean: (fieldName: string): Record<string, MappingProperty> => ({
    [fieldName]: { type: 'boolean' },
  }),

  /**
   * Completion suggester field for type-ahead suggestions
   */
  suggest: (fieldName: string): Record<string, MappingProperty> => ({
    [fieldName]: {
      type: 'completion',
      analyzer: 'autocomplete_analyzer',
      search_analyzer: 'autocomplete_search_analyzer',
      preserve_separators: true,
      preserve_position_increments: true,
      max_input_length: 50,
    },
  }),

  /**
   * Nested object field for arrays of complex objects
   */
  nested: (fieldName: string, properties: Record<string, MappingProperty>): Record<string, MappingProperty> => ({
    [fieldName]: {
      type: 'nested',
      properties,
    },
  }),

  /**
   * Object field for embedded objects (not arrays)
   */
  object: (fieldName: string, properties: Record<string, MappingProperty>): Record<string, MappingProperty> => ({
    [fieldName]: {
      type: 'object',
      properties,
    },
  }),
};

/**
 * Common index settings for development environment
 */
export const COMMON_INDEX_SETTINGS: IndicesIndexSettings = {
  number_of_shards: 1,
  number_of_replicas: 0, // Set to 1 in production
  refresh_interval: '1s',
  max_result_window: 10000,
  ...ANALYZER_SETTINGS,
};

/**
 * Index settings for production environment
 */
export const PRODUCTION_INDEX_SETTINGS: IndicesIndexSettings = {
  number_of_shards: 1, // Adjust based on data volume
  number_of_replicas: 1, // At least 1 replica for high availability
  refresh_interval: '5s', // Less frequent refreshes for better performance
  max_result_window: 10000,
  ...ANALYZER_SETTINGS,
};

/**
 * Get appropriate index settings based on environment
 */
export function getIndexSettings(): IndicesIndexSettings {
  return process.env.NODE_ENV === 'production' 
    ? PRODUCTION_INDEX_SETTINGS 
    : COMMON_INDEX_SETTINGS;
}

/**
 * Helper to merge multiple field mappings into one properties object
 */
export function mergeFieldMappings(...mappings: Record<string, MappingProperty>[]): Record<string, MappingProperty> {
  return Object.assign({}, ...mappings);
}
