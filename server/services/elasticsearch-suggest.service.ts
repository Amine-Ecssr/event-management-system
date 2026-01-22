/**
 * Elasticsearch Suggest Service
 * Provides autocomplete and search suggestions
 */

import {
  getOptionalElasticsearchClient,
  isElasticsearchEnabled,
} from '../elasticsearch/client';
import { ES_INDEX_PREFIX, ES_INDEX_SUFFIX } from '../elasticsearch/config';
import {
  SuggestionRequest,
  SuggestionResponse,
  Suggestion,
  AutocompleteResponse,
  AutocompleteOption,
  SuggestionEntityType,
  PopularSearchesResponse,
  PopularSearch,
} from '../elasticsearch/types/suggest.types';

export class ElasticsearchSuggestService {
  /**
   * Build index name from entity type
   */
  private buildIndexName(entity: string): string {
    return `${ES_INDEX_PREFIX}-${entity}-${ES_INDEX_SUFFIX}`;
  }

  /**
   * Extract entity type from index name
   */
  private extractEntityType(indexName: string): SuggestionEntityType {
    const prefix = ES_INDEX_PREFIX + '-';
    const suffix = '-' + ES_INDEX_SUFFIX;
    let entityPart = indexName;

    if (entityPart.startsWith(prefix)) {
      entityPart = entityPart.substring(prefix.length);
    }
    if (entityPart.endsWith(suffix)) {
      entityPart = entityPart.substring(0, entityPart.length - suffix.length);
    }

    // Map to valid entity types
    const typeMap: Record<string, SuggestionEntityType> = {
      events: 'events',
      contacts: 'contacts',
      organizations: 'organizations',
      tasks: 'tasks',
      partnerships: 'partnerships',
    };

    return typeMap[entityPart] || 'events';
  }

  /**
   * Get title/name field based on entity type
   */
  private getTitleField(type: SuggestionEntityType): string {
    switch (type) {
      case 'contacts':
      case 'organizations':
        return 'name';
      case 'tasks':
        return 'name';
      case 'events':
      case 'partnerships':
      default:
        return 'name';
    }
  }

  /**
   * Get Arabic title/name field based on entity type
   */
  private getArabicTitleField(type: SuggestionEntityType): string {
    switch (type) {
      case 'contacts':
      case 'organizations':
        return 'nameAr';
      case 'tasks':
        return 'titleAr';
      case 'events':
      case 'partnerships':
      default:
        return 'titleAr';
    }
  }

  /**
   * Get suggestions using multi_match with phrase_prefix
   */
  async getSuggestions(request: SuggestionRequest): Promise<SuggestionResponse> {
    if (!isElasticsearchEnabled()) {
      return { suggestions: [], took: 0 };
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) {
      return { suggestions: [], took: 0 };
    }

    const startTime = Date.now();
    const {
      q,
      types = ['events', 'contacts', 'organizations'],
      limit = 5,
      fuzzy = true,
      context,
    } = request;

    try {
      const indices = types.map((t) => this.buildIndexName(t));

      // Build search query with multi_match prefix
      const mustClauses: any[] = [];
      const filterClauses: any[] = [];

      // Main query - phrase prefix for autocomplete feel
      mustClauses.push({
        bool: {
          should: [
            {
              multi_match: {
                query: q,
                type: 'phrase_prefix',
                fields: ['name^3', 'nameAr^3', 'description', 'descriptionAr'],
                max_expansions: 10,
              },
            },
            {
              multi_match: {
                query: q,
                type: 'best_fields',
                fields: ['name^2', 'nameAr^2'],
                fuzziness: fuzzy ? 'AUTO' : '0',
                prefix_length: 2,
              },
            },
          ],
          minimum_should_match: 1,
        },
      });

      // Add context filters
      if (context) {
        if (context.departmentId) {
          filterClauses.push({ term: { departmentId: context.departmentId } });
        }
        if (context.category) {
          filterClauses.push({ term: { category: context.category } });
        }
        if (context.isActive !== undefined) {
          filterClauses.push({ term: { isActive: context.isActive } });
        }
      }

      const response = await client.search({
        index: indices.join(','),
        ignore_unavailable: true,
        body: {
          query: {
            bool: {
              must: mustClauses,
              filter: filterClauses.length > 0 ? filterClauses : undefined,
            },
          },
          _source: [
            'id',
            'name',
            'nameAr',
            'category',
            'status',
            'departmentId',
          ],
          size: limit * types.length,
          highlight: {
            fields: {
              name: { number_of_fragments: 1, fragment_size: 100 },
              nameAr: { number_of_fragments: 1, fragment_size: 100 },
            },
            pre_tags: ['<mark>'],
            post_tags: ['</mark>'],
          },
        },
      });

      const suggestions: Suggestion[] = [];
      const seen = new Set<string>();

      for (const hit of response.hits.hits) {
        const source = hit._source as any;
        const entityType = this.extractEntityType(hit._index);
        const key = `${entityType}-${source.id || hit._id}`;

        if (seen.has(key)) continue;
        seen.add(key);

        // Get display text based on entity type
        const text =
          source.name ||
          '';
        const textAr =
          source.nameAr ||
          '';

        // Get highlighted text if available
        const highlight =
          hit.highlight?.name?.[0] ||
          hit.highlight?.nameAr?.[0] ||
          undefined;

        suggestions.push({
          text,
          textAr: textAr || undefined,
          type: entityType,
          id: source.id || hit._id,
          score: hit._score || 0,
          highlight,
          metadata: {
            category: source.category,
            status: source.status,
            departmentId: source.departmentId,
          },
        });
      }

      // Sort by score and limit
      suggestions.sort((a, b) => b.score - a.score);

      return {
        suggestions: suggestions.slice(0, limit * types.length),
        took: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[ElasticsearchSuggestService] getSuggestions error:', error);
      return { suggestions: [], took: Date.now() - startTime };
    }
  }

  /**
   * Get spelling corrections using term suggester
   */
  async getDidYouMean(query: string): Promise<string | null> {
    if (!isElasticsearchEnabled() || query.length < 3) {
      return null;
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return null;

    try {
      const response = await client.search({
        index: `${ES_INDEX_PREFIX}-*`,
        ignore_unavailable: true,
        body: {
          suggest: {
            spelling: {
              text: query,
              term: {
                field: 'title',
                suggest_mode: 'popular',
                sort: 'frequency',
                string_distance: 'levenshtein',
                min_word_length: 3,
                prefix_length: 2,
              },
            },
          },
          _source: false,
          size: 0,
        },
      });

      // Get the best term suggestion
      const termOptions = response.suggest?.spelling as any[];
      if (termOptions && termOptions.length > 0) {
        const corrections: string[] = [];
        const queryWords = query.toLowerCase().split(/\s+/);

        for (let i = 0; i < termOptions.length; i++) {
          const options = termOptions[i]?.options;
          if (options && options.length > 0 && options[0].score > 0.7) {
            corrections.push(options[0].text);
          } else {
            // Keep original word if no good suggestion
            corrections.push(queryWords[i] || '');
          }
        }

        const correctedQuery = corrections.join(' ').trim();
        if (correctedQuery && correctedQuery.toLowerCase() !== query.toLowerCase()) {
          return correctedQuery;
        }
      }

      return null;
    } catch (error) {
      console.error('[ElasticsearchSuggestService] getDidYouMean error:', error);
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

    const client = await getOptionalElasticsearchClient();
    if (!client) {
      return { options: [], took: 0 };
    }

    const startTime = Date.now();
    const indexName = this.buildIndexName(entityType);
    const titleField = this.getTitleField(entityType);
    const arabicField = this.getArabicTitleField(entityType);

    try {
      // Use match_phrase_prefix for autocomplete
      const response = await client.search({
        index: indexName,
        ignore_unavailable: true,
        body: {
          query: {
            bool: {
              should: [
                {
                  match_phrase_prefix: {
                    [titleField]: {
                      query: query,
                      max_expansions: 10,
                      boost: 2.0,
                    },
                  },
                },
                {
                  match_phrase_prefix: {
                    [arabicField]: {
                      query: query,
                      max_expansions: 10,
                      boost: 2.0,
                    },
                  },
                },
                {
                  multi_match: {
                    query: query,
                    type: 'best_fields',
                    fields: [titleField, arabicField],
                    fuzziness: 'AUTO',
                    prefix_length: 2,
                  },
                },
              ],
              minimum_should_match: 1,
            },
          },
          _source: ['id', titleField, arabicField],
          size: limit,
          highlight: {
            fields: {
              [titleField]: {},
              [arabicField]: {},
            },
            pre_tags: ['<mark>'],
            post_tags: ['</mark>'],
          },
        },
      });

      const options: AutocompleteOption[] = response.hits.hits.map((hit) => {
        const source = hit._source as Record<string, unknown> | undefined;
        const id = source?.id ?? hit._id;
        return {
          value: String(id),
          label: String(source?.[titleField] || source?.name || ''),
          labelAr: String(source?.[arabicField] || source?.nameAr || ''),
          type: entityType,
          id: typeof id === 'number' ? id : String(id),
        };
      });

      return {
        options,
        took: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[ElasticsearchSuggestService] getAutocomplete error:', error);
      return { options: [], took: Date.now() - startTime };
    }
  }

  /**
   * Get popular searches based on recent activity
   * Note: This requires search query logging to be implemented
   */
  async getPopularSearches(period: '24h' | '7d' | '30d' = '7d'): Promise<PopularSearchesResponse> {
    // For now, return placeholder data
    // In production, this would query a search_queries index or analytics
    const popularSearches: PopularSearch[] = [
      { term: 'conference', count: 150, trend: 'up' },
      { term: 'workshop', count: 120, trend: 'stable' },
      { term: 'meeting', count: 95, trend: 'down' },
      { term: 'مؤتمر', count: 80, trend: 'up' },
      { term: 'training', count: 65, trend: 'stable' },
    ];

    return {
      searches: popularSearches,
      period,
    };
  }

  /**
   * Build suggest input data for indexing
   * Call this when indexing documents to populate suggest fields
   */
  buildSuggestInput(entity: any, type: SuggestionEntityType): { suggest: string[]; suggestAr: string[] } {
    const inputs: string[] = [];
    const inputsAr: string[] = [];

    switch (type) {
      case 'events':
        if (entity.title) inputs.push(entity.title);
        if (entity.titleAr) inputsAr.push(entity.titleAr);
        if (entity.category) inputs.push(entity.category);
        if (entity.location) inputs.push(entity.location);
        break;

      case 'contacts':
        if (entity.nameEn) inputs.push(entity.nameEn);
        if (entity.nameAr) inputsAr.push(entity.nameAr);
        if (entity.email) {
          const emailName = entity.email.split('@')[0];
          if (emailName) inputs.push(emailName);
        }
        break;

      case 'organizations':
        if (entity.nameEn) inputs.push(entity.nameEn);
        if (entity.nameAr) inputsAr.push(entity.nameAr);
        if (entity.abbreviation) inputs.push(entity.abbreviation);
        break;

      case 'tasks':
        if (entity.title) inputs.push(entity.title);
        if (entity.titleAr) inputsAr.push(entity.titleAr);
        break;

      case 'partnerships':
        if (entity.title) inputs.push(entity.title);
        if (entity.titleAr) inputsAr.push(entity.titleAr);
        if (entity.organizationName) inputs.push(entity.organizationName);
        break;
    }

    return {
      suggest: inputs.filter(Boolean),
      suggestAr: inputsAr.filter(Boolean),
    };
  }
}

// Export singleton instance
export const suggestService = new ElasticsearchSuggestService();
