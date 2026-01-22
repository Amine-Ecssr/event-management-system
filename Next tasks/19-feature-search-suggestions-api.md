# Feature: Search Suggestions & Autocomplete API

## Type
Feature / Search Enhancement

## Priority
🟡 Medium

## Estimated Effort
3-4 hours

## Description
Implement search suggestions and autocomplete API using Elasticsearch completion suggester and prefix queries. Powers instant search and type-ahead functionality across all indexed entities.

## Architecture Context
- **Index Prefix**: Configurable via `ES_INDEX_PREFIX` (default: `eventcal`)
- **Kibana**: Test queries at `kibana.eventcal.app`
- **Bilingual**: Supports both English and Arabic suggestions

## Requirements

### Suggestion Types

#### 1. Completion Suggester
- Event titles
- Contact names
- Organization names
- Partnership names

#### 2. Term Suggester
- Spelling corrections
- Did you mean suggestions

#### 3. Phrase Suggester
- Multi-word corrections

---

## Complete Implementation

### Suggestion Types (`server/elasticsearch/types/suggest.types.ts`)
```typescript
export interface SuggestionRequest {
  q: string;                    // Query text
  types?: SuggestionEntityType[]; // Entity types to search
  limit?: number;               // Max suggestions per type
  fuzzy?: boolean;              // Enable fuzzy matching
  context?: SuggestionContext;  // Context filters
}

export type SuggestionEntityType = 
  | 'events' | 'contacts' | 'organizations' 
  | 'tasks' | 'partnerships';

export interface SuggestionContext {
  departmentId?: number;
  category?: string;
  isActive?: boolean;
}

export interface SuggestionResponse {
  suggestions: Suggestion[];
  didYouMean?: string;
  took: number;
}

export interface Suggestion {
  text: string;
  textAr?: string;
  type: SuggestionEntityType;
  id: string | number;
  score: number;
  highlight?: string;
  metadata?: Record<string, any>;
}

export interface AutocompleteResponse {
  options: AutocompleteOption[];
  took: number;
}

export interface AutocompleteOption {
  value: string;
  label: string;
  labelAr?: string;
  type: SuggestionEntityType;
  id: string | number;
}
```

### Mapping Updates (`server/elasticsearch/mappings/suggest-fields.ts`)
```typescript
// Add to each entity mapping
export const SUGGEST_FIELD_MAPPING = {
  suggest: {
    type: 'completion',
    analyzer: 'autocomplete_analyzer',
    search_analyzer: 'autocomplete_search_analyzer',
    preserve_separators: true,
    preserve_position_increments: true,
    max_input_length: 50,
    contexts: [
      {
        name: 'type',
        type: 'category',
        path: '_type'
      },
      {
        name: 'department',
        type: 'category',
        path: 'departmentId'
      }
    ]
  },
  suggestAr: {
    type: 'completion',
    analyzer: 'arabic_autocomplete',
    search_analyzer: 'arabic_autocomplete',
    max_input_length: 50
  }
};

// Analyzers for autocomplete
export const AUTOCOMPLETE_ANALYZERS = {
  analysis: {
    analyzer: {
      autocomplete_analyzer: {
        type: 'custom',
        tokenizer: 'autocomplete_tokenizer',
        filter: ['lowercase', 'asciifolding']
      },
      autocomplete_search_analyzer: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase', 'asciifolding']
      },
      arabic_autocomplete: {
        type: 'custom',
        tokenizer: 'autocomplete_tokenizer',
        filter: ['arabic_normalization']
      }
    },
    tokenizer: {
      autocomplete_tokenizer: {
        type: 'edge_ngram',
        min_gram: 2,
        max_gram: 20,
        token_chars: ['letter', 'digit']
      }
    }
  }
};
```

### Elasticsearch Suggest Service (`server/services/elasticsearch-suggest.service.ts`)
```typescript
import { getOptionalElasticsearchClient, isElasticsearchEnabled } from '../elasticsearch/client';
import { getIndexConfig } from '../elasticsearch/config';
import { 
  SuggestionRequest, SuggestionResponse, Suggestion,
  AutocompleteResponse, AutocompleteOption, SuggestionEntityType 
} from '../elasticsearch/types/suggest.types';
import { logger } from '../utils/logger';

const { ES_INDEX_PREFIX, ES_INDEX_SUFFIX } = getIndexConfig();

export class ElasticsearchSuggestService {
  private buildIndexName(entity: string): string {
    return `${ES_INDEX_PREFIX}-${entity}-${ES_INDEX_SUFFIX}`;
  }

  /**
   * Get autocomplete suggestions using completion suggester
   */
  async getSuggestions(request: SuggestionRequest): Promise<SuggestionResponse> {
    if (!isElasticsearchEnabled()) {
      return { suggestions: [], took: 0 };
    }

    const client = getOptionalElasticsearchClient();
    if (!client) {
      return { suggestions: [], took: 0 };
    }

    const startTime = Date.now();
    const { q, types = ['events', 'contacts', 'organizations'], limit = 5, fuzzy = true, context } = request;

    try {
      const indices = types.map(t => this.buildIndexName(t));
      
      // Build completion suggest query
      const suggestQuery: any = {
        text: q,
        completion: {
          field: 'suggest',
          size: limit,
          skip_duplicates: true,
          fuzzy: fuzzy ? {
            fuzziness: 'AUTO',
            prefix_length: 2,
            min_length: 3
          } : undefined
        }
      };

      // Add context filters if provided
      if (context) {
        suggestQuery.completion.contexts = {};
        if (context.departmentId) {
          suggestQuery.completion.contexts.department = [String(context.departmentId)];
        }
      }

      const response = await client.search({
        index: indices.join(','),
        body: {
          suggest: {
            entity_suggest: suggestQuery,
            // Arabic suggestions
            entity_suggest_ar: {
              text: q,
              completion: {
                field: 'suggestAr',
                size: limit,
                skip_duplicates: true
              }
            }
          },
          // Also get did-you-mean
          _source: false,
          size: 0
        }
      });

      const suggestions: Suggestion[] = [];
      const seen = new Set<string>();

      // Process English suggestions
      const englishSuggestions = response.suggest?.entity_suggest?.[0]?.options || [];
      for (const option of englishSuggestions) {
        const key = `${option._source?._type || 'unknown'}-${option._id}`;
        if (!seen.has(key)) {
          seen.add(key);
          suggestions.push({
            text: option.text,
            type: this.extractEntityType(option._index),
            id: option._id,
            score: option._score,
            metadata: option._source
          });
        }
      }

      // Process Arabic suggestions
      const arabicSuggestions = response.suggest?.entity_suggest_ar?.[0]?.options || [];
      for (const option of arabicSuggestions) {
        const key = `${option._source?._type || 'unknown'}-${option._id}`;
        if (!seen.has(key)) {
          seen.add(key);
          suggestions.push({
            text: option.text,
            textAr: option._source?.titleAr || option._source?.nameAr,
            type: this.extractEntityType(option._index),
            id: option._id,
            score: option._score,
            metadata: option._source
          });
        }
      }

      // Sort by score
      suggestions.sort((a, b) => b.score - a.score);

      return {
        suggestions: suggestions.slice(0, limit * types.length),
        took: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Suggestion error:', error);
      return { suggestions: [], took: Date.now() - startTime };
    }
  }

  /**
   * Get spelling corrections using term suggester
   */
  async getDidYouMean(query: string): Promise<string | null> {
    if (!isElasticsearchEnabled()) {
      return null;
    }

    const client = getOptionalElasticsearchClient();
    if (!client) return null;

    try {
      const response = await client.search({
        index: `${ES_INDEX_PREFIX}-*`,
        body: {
          suggest: {
            spelling: {
              text: query,
              term: {
                field: 'title',
                suggest_mode: 'popular',
                sort: 'frequency',
                string_distance: 'levenshtein'
              }
            },
            phrase_correction: {
              text: query,
              phrase: {
                field: 'title.shingle',
                size: 1,
                gram_size: 2,
                direct_generator: [{
                  field: 'title.shingle',
                  suggest_mode: 'popular',
                  min_word_length: 3
                }],
                highlight: {
                  pre_tag: '<em>',
                  post_tag: '</em>'
                }
              }
            }
          },
          _source: false,
          size: 0
        }
      });

      // Prefer phrase suggestion over term suggestion
      const phraseSuggestion = response.suggest?.phrase_correction?.[0]?.options?.[0]?.text;
      if (phraseSuggestion && phraseSuggestion !== query) {
        return phraseSuggestion;
      }

      // Fall back to term suggestion
      const termOptions = response.suggest?.spelling?.[0]?.options;
      if (termOptions && termOptions.length > 0) {
        return termOptions[0].text;
      }

      return null;
    } catch (error) {
      logger.error('Did-you-mean error:', error);
      return null;
    }
  }

  /**
   * Get autocomplete options for a specific entity type
   */
  async getAutocomplete(
    entityType: SuggestionEntityType,
    query: string,
    limit = 10
  ): Promise<AutocompleteResponse> {
    if (!isElasticsearchEnabled()) {
      return { options: [], took: 0 };
    }

    const client = getOptionalElasticsearchClient();
    if (!client) {
      return { options: [], took: 0 };
    }

    const startTime = Date.now();
    const indexName = this.buildIndexName(entityType);

    try {
      // Use prefix query for simple autocomplete
      const response = await client.search({
        index: indexName,
        body: {
          query: {
            bool: {
              should: [
                {
                  prefix: {
                    'title.keyword': {
                      value: query.toLowerCase(),
                      boost: 2.0
                    }
                  }
                },
                {
                  match_phrase_prefix: {
                    title: {
                      query: query,
                      max_expansions: 10
                    }
                  }
                },
                {
                  match_phrase_prefix: {
                    titleAr: {
                      query: query,
                      max_expansions: 10
                    }
                  }
                }
              ],
              minimum_should_match: 1
            }
          },
          _source: ['id', 'title', 'titleAr', 'name', 'nameAr'],
          size: limit,
          highlight: {
            fields: {
              title: {},
              titleAr: {},
              name: {},
              nameAr: {}
            },
            pre_tags: ['<mark>'],
            post_tags: ['</mark>']
          }
        }
      });

      const options: AutocompleteOption[] = response.hits.hits.map(hit => ({
        value: String(hit._source?.id || hit._id),
        label: hit._source?.title || hit._source?.name || '',
        labelAr: hit._source?.titleAr || hit._source?.nameAr,
        type: entityType,
        id: hit._source?.id || hit._id
      }));

      return {
        options,
        took: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Autocomplete error:', error);
      return { options: [], took: Date.now() - startTime };
    }
  }

  /**
   * Build suggest field data for indexing
   */
  buildSuggestInput(entity: any, type: SuggestionEntityType): any {
    const inputs: string[] = [];
    const inputsAr: string[] = [];

    // Add relevant fields based on entity type
    switch (type) {
      case 'events':
        if (entity.title) inputs.push(entity.title);
        if (entity.titleAr) inputsAr.push(entity.titleAr);
        if (entity.category) inputs.push(entity.category);
        if (entity.location) inputs.push(entity.location);
        break;
        
      case 'contacts':
        if (entity.name) inputs.push(entity.name);
        if (entity.nameAr) inputsAr.push(entity.nameAr);
        if (entity.email) inputs.push(entity.email.split('@')[0]);
        break;
        
      case 'organizations':
        if (entity.name) inputs.push(entity.name);
        if (entity.nameAr) inputsAr.push(entity.nameAr);
        if (entity.abbreviation) inputs.push(entity.abbreviation);
        break;
        
      case 'tasks':
        if (entity.title) inputs.push(entity.title);
        break;
        
      case 'partnerships':
        if (entity.organizationName) inputs.push(entity.organizationName);
        if (entity.agreementType) inputs.push(entity.agreementType);
        break;
    }

    return {
      suggest: {
        input: inputs.filter(Boolean),
        contexts: {
          type: type,
          department: entity.departmentId ? String(entity.departmentId) : undefined
        }
      },
      suggestAr: inputsAr.length > 0 ? {
        input: inputsAr
      } : undefined
    };
  }

  private extractEntityType(indexName: string): SuggestionEntityType {
    // Extract entity type from index name like "eventcal-events-prod"
    const parts = indexName.split('-');
    if (parts.length >= 2) {
      return parts[1] as SuggestionEntityType;
    }
    return 'events';
  }
}

export const suggestService = new ElasticsearchSuggestService();
```

### Suggest Routes (`server/routes/suggest.routes.ts`)
```typescript
import { Router } from 'express';
import { suggestService } from '../services/elasticsearch-suggest.service';
import { z } from 'zod';

const router = Router();

const suggestQuerySchema = z.object({
  q: z.string().min(1).max(100),
  types: z.string().optional().transform(v => v?.split(',') as any),
  limit: z.coerce.number().min(1).max(50).default(5),
  fuzzy: z.coerce.boolean().default(true),
  departmentId: z.coerce.number().optional()
});

const autocompleteQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().min(1).max(20).default(10)
});

// Main suggestion endpoint
router.get('/api/suggest', async (req, res) => {
  try {
    const params = suggestQuerySchema.parse(req.query);
    
    const [suggestions, didYouMean] = await Promise.all([
      suggestService.getSuggestions({
        q: params.q,
        types: params.types,
        limit: params.limit,
        fuzzy: params.fuzzy,
        context: params.departmentId ? { departmentId: params.departmentId } : undefined
      }),
      suggestService.getDidYouMean(params.q)
    ]);

    res.json({
      ...suggestions,
      didYouMean
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters' });
    }
    console.error('Suggest error:', error);
    res.status(500).json({ error: 'Suggestion failed' });
  }
});

// Entity-specific autocomplete
router.get('/api/autocomplete/events', async (req, res) => {
  try {
    const { q, limit } = autocompleteQuerySchema.parse(req.query);
    const result = await suggestService.getAutocomplete('events', q, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

router.get('/api/autocomplete/contacts', async (req, res) => {
  try {
    const { q, limit } = autocompleteQuerySchema.parse(req.query);
    const result = await suggestService.getAutocomplete('contacts', q, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

router.get('/api/autocomplete/organizations', async (req, res) => {
  try {
    const { q, limit } = autocompleteQuerySchema.parse(req.query);
    const result = await suggestService.getAutocomplete('organizations', q, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

router.get('/api/autocomplete/partnerships', async (req, res) => {
  try {
    const { q, limit } = autocompleteQuerySchema.parse(req.query);
    const result = await suggestService.getAutocomplete('partnerships', q, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

// Did-you-mean endpoint
router.get('/api/suggest/did-you-mean', async (req, res) => {
  try {
    const q = z.string().min(1).parse(req.query.q);
    const suggestion = await suggestService.getDidYouMean(q);
    res.json({ original: q, suggestion });
  } catch (error) {
    res.status(500).json({ error: 'Spell check failed' });
  }
});

export default router;
```

### Frontend Autocomplete Hook (`client/src/hooks/useAutocomplete.ts`)
```typescript
import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './useDebounce';

interface AutocompleteOption {
  value: string;
  label: string;
  labelAr?: string;
  type: string;
  id: string | number;
}

interface UseAutocompleteOptions {
  entityType: 'events' | 'contacts' | 'organizations' | 'partnerships';
  debounceMs?: number;
  minChars?: number;
  limit?: number;
}

export function useAutocomplete(options: UseAutocompleteOptions) {
  const { entityType, debounceMs = 200, minChars = 2, limit = 10 } = options;
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, debounceMs);

  const { data, isLoading, error } = useQuery({
    queryKey: ['autocomplete', entityType, debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < minChars) {
        return { options: [] };
      }
      const params = new URLSearchParams({
        q: debouncedQuery,
        limit: String(limit)
      });
      const response = await fetch(`/api/autocomplete/${entityType}?${params}`);
      if (!response.ok) throw new Error('Autocomplete failed');
      return response.json();
    },
    enabled: debouncedQuery.length >= minChars,
    staleTime: 30000, // Cache for 30 seconds
  });

  const options = useMemo(() => data?.options || [], [data]);

  return {
    query,
    setQuery,
    options,
    isLoading,
    error,
  };
}
```

### Frontend Search Input with Suggestions (`client/src/components/SearchInput.tsx`)
```tsx
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery } from '@tanstack/react-query';

interface Suggestion {
  text: string;
  textAr?: string;
  type: string;
  id: string | number;
  score: number;
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: Suggestion) => void;
  placeholder?: string;
  className?: string;
  types?: string[];
}

export function SearchInput({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  types = ['events', 'contacts', 'organizations']
}: SearchInputProps) {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedValue = useDebounce(value, 200);

  const { data, isLoading } = useQuery({
    queryKey: ['suggestions', debouncedValue, types],
    queryFn: async () => {
      if (debouncedValue.length < 2) return { suggestions: [], didYouMean: null };
      const params = new URLSearchParams({
        q: debouncedValue,
        types: types.join(','),
        limit: '5'
      });
      const response = await fetch(`/api/suggest?${params}`);
      if (!response.ok) throw new Error('Suggestion failed');
      return response.json();
    },
    enabled: debouncedValue.length >= 2
  });

  const suggestions = data?.suggestions || [];
  const didYouMean = data?.didYouMean;

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (suggestion: Suggestion) => {
    onChange(suggestion.text);
    setIsOpen(false);
    setSelectedIndex(-1);
    onSelect?.(suggestion);
  };

  const handleDidYouMeanClick = () => {
    if (didYouMean) {
      onChange(didYouMean);
    }
  };

  useEffect(() => {
    if (debouncedValue.length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [debouncedValue]);

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      events: '📅',
      contacts: '👤',
      organizations: '🏢',
      tasks: '✅',
      partnerships: '🤝'
    };
    return icons[type] || '📄';
  };

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 2 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder || t('common.search')}
          className="pl-10 pr-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {value && !isLoading && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (suggestions.length > 0 || didYouMean) && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg">
          {didYouMean && (
            <button
              onClick={handleDidYouMeanClick}
              className="w-full px-3 py-2 text-sm text-left text-muted-foreground hover:bg-accent border-b"
            >
              {t('search.didYouMean')}: <span className="font-medium text-primary">{didYouMean}</span>
            </button>
          )}
          
          <ul className="py-1 max-h-60 overflow-auto">
            {suggestions.map((suggestion, index) => (
              <li key={`${suggestion.type}-${suggestion.id}`}>
                <button
                  onClick={() => handleSelect(suggestion)}
                  className={cn(
                    'w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-accent',
                    index === selectedIndex && 'bg-accent'
                  )}
                >
                  <span>{getTypeIcon(suggestion.type)}</span>
                  <span className="flex-1">
                    {i18n.language === 'ar' && suggestion.textAr
                      ? suggestion.textAr
                      : suggestion.text}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {t(`entities.${suggestion.type}`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

### API Endpoints
```
GET /api/suggest?q=tech&types=events,contacts
GET /api/autocomplete/events?q=conf
GET /api/autocomplete/contacts?q=ahmad
GET /api/autocomplete/organizations?q=ecssr
GET /api/autocomplete/partnerships?q=sponsor
GET /api/suggest/did-you-mean?q=conferance
```

### Response Format
```json
{
  "suggestions": [
    {
      "text": "Technology Conference 2024",
      "textAr": "مؤتمر التكنولوجيا 2024",
      "type": "events",
      "id": 123,
      "score": 0.95
    }
  ],
  "didYouMean": "conference",
  "took": 12
}
```

### Files to Create
- `server/elasticsearch/types/suggest.types.ts` - Type definitions
- `server/elasticsearch/mappings/suggest-fields.ts` - Mapping updates
- `server/services/elasticsearch-suggest.service.ts` - Suggest service
- `server/routes/suggest.routes.ts` - API routes
- `client/src/hooks/useAutocomplete.ts` - Autocomplete hook
- `client/src/components/SearchInput.tsx` - Search input with suggestions

### Files to Modify
- All mapping files (add completion fields)
- Indexing service (populate suggest field with `buildSuggestInput()`)
- `server/routes.ts` - Mount suggest routes
- `client/src/i18n/locales/en/search.json` - Add translations
- `client/src/i18n/locales/ar/search.json` - Add translations

## Acceptance Criteria
- [ ] Autocomplete returns results <100ms (p95)
- [ ] Suggestions ranked by relevance score
- [ ] Did-you-mean catches common typos
- [ ] Arabic autocomplete works correctly
- [ ] Context filtering (department) works
- [ ] Keyboard navigation (up/down/enter/escape)
- [ ] Mobile-friendly dropdown
- [ ] i18n translations for UI elements

## Dependencies
- Task 07: Search Service
- Task 03: Elasticsearch Analyzers (arabic_autocomplete)
