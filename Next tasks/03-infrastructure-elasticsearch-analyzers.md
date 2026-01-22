# Infrastructure: Arabic/English Text Analyzers

## Type
Infrastructure / Search Configuration

## Priority
🔴 Critical

## Estimated Effort
3-4 hours

## Description
Configure custom Elasticsearch analyzers for proper handling of Arabic and English text. Arabic requires ICU analysis plugin for proper tokenization, normalization, and stemming.

## Requirements

### ICU Plugin
- Install ICU Analysis plugin in ES Docker image
- Configure Arabic text normalization
- Handle Arabic diacritics and variations

### Custom Analyzers
- English analyzer with stemming
- Arabic analyzer with ICU tokenizer
- Bilingual field mappings

---

## Complete Implementation

### Custom Dockerfile for Elasticsearch with ICU
```dockerfile
# elasticsearch/Dockerfile
FROM docker.elastic.co/elasticsearch/elasticsearch:8.12.0

# Install ICU Analysis plugin for Arabic support
RUN elasticsearch-plugin install analysis-icu

# Set default to single-node for development
ENV discovery.type=single-node
```

### Build and Use Custom Image
```yaml
# In docker-compose files
services:
  elasticsearch:
    build:
      context: ./elasticsearch
      dockerfile: Dockerfile
    image: eventcal-elasticsearch:8.12.0-icu
```

### Analyzer Definitions (`server/elasticsearch/analyzers/index.ts`)
```typescript
/**
 * Custom analyzers for Arabic and English text processing
 * Requires ICU Analysis plugin to be installed
 */

export const ANALYZER_SETTINGS = {
  analysis: {
    // Character filters
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
    
    // Token filters
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
      // Arabic stemmer using ICU
      arabic_stemmer: {
        type: 'stemmer',
        language: 'arabic',
      },
      // ICU Folding for consistent unicode
      icu_folding: {
        type: 'icu_folding',
      },
      // ICU Normalizer
      icu_normalizer: {
        type: 'icu_normalizer',
        name: 'nfc',
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
    
    // Analyzers
    analyzer: {
      // English text analyzer
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
      
      // Search analyzer for Arabic (less aggressive)
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
      
      // Autocomplete analyzer (for suggestions)
      autocomplete_analyzer: {
        type: 'custom',
        tokenizer: 'standard',
        filter: [
          'lowercase',
          'edge_ngram_filter',
        ],
      },
      
      // Autocomplete search analyzer
      autocomplete_search_analyzer: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase'],
      },
      
      // Exact match analyzer (no stemming)
      exact_analyzer: {
        type: 'custom',
        tokenizer: 'keyword',
        filter: ['lowercase', 'icu_folding'],
      },
      
      // Phone/Email analyzer
      identifier_analyzer: {
        type: 'custom',
        tokenizer: 'keyword',
        filter: ['lowercase'],
      },
    },
  },
};

// Field mapping templates for different field types
export const FIELD_MAPPINGS = {
  // English text field with autocomplete
  englishText: (fieldName: string) => ({
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
  
  // Arabic text field with autocomplete
  arabicText: (fieldName: string) => ({
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
  
  // Bilingual text field
  bilingualText: (fieldName: string) => ({
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
  
  // Email field
  email: (fieldName: string) => ({
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
  
  // Phone field
  phone: (fieldName: string) => ({
    [fieldName]: {
      type: 'text',
      analyzer: 'identifier_analyzer',
      fields: {
        keyword: { type: 'keyword' },
      },
    },
  }),
  
  // Keyword (exact match)
  keyword: (fieldName: string) => ({
    [fieldName]: {
      type: 'keyword',
    },
  }),
  
  // Date field
  date: (fieldName: string) => ({
    [fieldName]: {
      type: 'date',
      format: 'strict_date_optional_time||epoch_millis',
    },
  }),
  
  // Number fields
  integer: (fieldName: string) => ({
    [fieldName]: { type: 'integer' },
  }),
  
  float: (fieldName: string) => ({
    [fieldName]: { type: 'float' },
  }),
  
  boolean: (fieldName: string) => ({
    [fieldName]: { type: 'boolean' },
  }),
  
  // Completion suggester field
  suggest: (fieldName: string) => ({
    [fieldName]: {
      type: 'completion',
      analyzer: 'autocomplete_analyzer',
      search_analyzer: 'autocomplete_search_analyzer',
      preserve_separators: true,
      preserve_position_increments: true,
      max_input_length: 50,
    },
  }),
};

// Common index settings
export const COMMON_INDEX_SETTINGS = {
  number_of_shards: 1,
  number_of_replicas: 0, // Set to 1 in production
  refresh_interval: '1s',
  max_result_window: 10000,
  ...ANALYZER_SETTINGS,
};

// Production index settings
export const PRODUCTION_INDEX_SETTINGS = {
  ...COMMON_INDEX_SETTINGS,
  number_of_replicas: 1,
  refresh_interval: '5s',
};
```

### Example Index Mapping Using Analyzers
```typescript
// server/elasticsearch/indices/events.mapping.ts
import { FIELD_MAPPINGS, COMMON_INDEX_SETTINGS } from '../analyzers';

export const EVENTS_INDEX_MAPPING = {
  settings: COMMON_INDEX_SETTINGS,
  mappings: {
    dynamic: 'strict',
    properties: {
      id: { type: 'keyword' },
      
      // Bilingual name fields
      ...FIELD_MAPPINGS.englishText('nameEn'),
      ...FIELD_MAPPINGS.arabicText('nameAr'),
      
      // Description with bilingual support
      ...FIELD_MAPPINGS.bilingualText('description'),
      
      // Location (primarily English)
      ...FIELD_MAPPINGS.englishText('location'),
      
      // Category and type as keywords for filtering
      ...FIELD_MAPPINGS.keyword('category'),
      ...FIELD_MAPPINGS.keyword('eventType'),
      ...FIELD_MAPPINGS.keyword('eventScope'),
      
      // Dates
      ...FIELD_MAPPINGS.date('startDate'),
      ...FIELD_MAPPINGS.date('endDate'),
      ...FIELD_MAPPINGS.date('createdAt'),
      ...FIELD_MAPPINGS.date('updatedAt'),
      
      // Booleans
      ...FIELD_MAPPINGS.boolean('isArchived'),
      ...FIELD_MAPPINGS.boolean('isApproved'),
      
      // Foreign keys
      ...FIELD_MAPPINGS.integer('departmentId'),
      ...FIELD_MAPPINGS.integer('createdById'),
      
      // Tags as keyword array
      tags: { type: 'keyword' },
      
      // Combined search text
      ...FIELD_MAPPINGS.bilingualText('searchText'),
      
      // Autocomplete suggestions
      ...FIELD_MAPPINGS.suggest('suggest'),
    },
  },
};
```

### Analyzer Testing Script
```typescript
// scripts/test-analyzers.ts
import { getOptionalElasticsearchClient } from '../server/elasticsearch/client';

async function testAnalyzers() {
  const client = await getOptionalElasticsearchClient();
  if (!client) {
    console.error('ES client not available');
    return;
  }
  
  const testCases = [
    // Arabic text with diacritics
    { text: 'مُؤْتَمَر', analyzer: 'arabic_analyzer', expected: 'مؤتمر' },
    // Arabic with alef variations
    { text: 'الإمارات', analyzer: 'arabic_analyzer', expected: 'امارات' },
    // English with stemming
    { text: 'conferences', analyzer: 'english_analyzer', expected: 'confer' },
    // Bilingual text
    { text: 'مؤتمر Conference', analyzer: 'bilingual_analyzer' },
  ];
  
  for (const testCase of testCases) {
    try {
      const result = await client.indices.analyze({
        body: {
          analyzer: testCase.analyzer,
          text: testCase.text,
        },
      });
      
      console.log(`\nAnalyzer: ${testCase.analyzer}`);
      console.log(`Input: "${testCase.text}"`);
      console.log(`Tokens:`, result.tokens?.map(t => t.token).join(', '));
    } catch (error) {
      console.error(`Failed to test ${testCase.analyzer}:`, error);
    }
  }
}

testAnalyzers();
```

### ICU Plugin Verification
```bash
# Check if ICU plugin is installed
curl -X GET "localhost:9200/_cat/plugins?v"

# Expected output should include:
# node analysis-icu 8.12.0

# Test ICU tokenizer directly
curl -X POST "localhost:9200/_analyze?pretty" -H 'Content-Type: application/json' -d'
{
  "tokenizer": "icu_tokenizer",
  "text": "مرحبا بكم في مؤتمر الإمارات"
}'
```

---

## Files to Create
- `elasticsearch/Dockerfile` - Custom ES image with ICU plugin
- `server/elasticsearch/analyzers/index.ts` - Analyzer definitions
- `server/elasticsearch/indices/events.mapping.ts` - Event index with analyzers
- `scripts/test-analyzers.ts` - Analyzer testing script

## Files to Modify
- All `docker-compose*.yml` files - Use custom ES image
- Index mapping files - Apply analyzer settings

## Arabic Text Processing Features
1. **Diacritics Removal**: Removes tashkeel (حركات) marks
2. **Alef Normalization**: Treats آ أ إ as ا
3. **Teh Marbuta**: Normalizes ة to ه
4. **ICU Tokenization**: Proper Arabic word boundary detection
5. **Arabic Stemming**: Reduces words to root form

## English Text Processing Features
1. **Porter2 Stemming**: "running" → "run"
2. **Possessive Removal**: "John's" → "John"
3. **Stop Words Removal**: Common words filtered
4. **Case Folding**: Unicode-aware lowercasing

## Acceptance Criteria
- [ ] ICU plugin installed in ES Docker image
- [ ] Arabic text searchable with/without diacritics
- [ ] Alef variations return same results
- [ ] English stemming works correctly
- [ ] Autocomplete works for both languages
- [ ] Mixed Arabic/English text handled
- [ ] Analyzer testing script passes

## Dependencies
- Task 01: Docker Setup (Elasticsearch running)
