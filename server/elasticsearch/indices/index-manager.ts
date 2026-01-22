/**
 * Elasticsearch Index Manager
 * 
 * Manages index lifecycle: creation, updates, deletion, and statistics.
 * Uses configurable index prefixes and environment-based naming.
 * 
 * @module elasticsearch/indices/index-manager
 */

import { getElasticsearchClient, isElasticsearchEnabled } from '../client';
import { ANALYZER_SETTINGS } from '../analyzers';
import { 
  ES_INDEX_PREFIX, 
  ES_INDEX_SUFFIX, 
  ES_ENTITIES,
  buildIndexName, 
  buildAliasName,
  type ESEntityType,
  isServerlessMode,
} from '../config';
import {
  eventsMapping,
  archivedEventsMapping,
  tasksMapping,
  contactsMapping,
  organizationsMapping,
  agreementsMapping,
  leadsMapping,
  departmentsMapping,
  attendeesMapping,
  inviteesMapping,
  interactionsMapping,
  activitiesMapping,
  updatesMapping,
} from '../mappings';
import type { MappingTypeMapping, IndicesIndexSettings } from '@elastic/elasticsearch/lib/api/types';

// Logger
const logger = {
  info: (...args: any[]) => console.log('[ES Index]', ...args),
  warn: (...args: any[]) => console.warn('[ES Index]', ...args),
  error: (...args: any[]) => console.error('[ES Index]', ...args),
};

/**
 * Index definition with all configuration
 */
export interface IndexDefinition {
  entity: ESEntityType;
  name: string;
  alias: string;
  mapping: MappingTypeMapping;
  settings?: Partial<IndicesIndexSettings>;
  lifecycle?: {
    rolloverMaxSize?: string;
    rolloverMaxAge?: string;
    deleteAfter?: string;
  };
}

/**
 * Index statistics
 */
export interface IndexStats {
  index: string;
  entity: string;
  docsCount: number;
  docsDeleted: number;
  sizeBytes: number;
  sizeHuman: string;
  health: string;
  status: string;
}

/**
 * Get default index settings combined with analyzers
 */
function getDefaultSettings(customSettings?: Partial<IndicesIndexSettings>): IndicesIndexSettings {
  // Serverless mode: Don't set shards, replicas, or max_result_window (managed automatically)
  // refresh_interval must be >= 5s in serverless
  if (isServerlessMode()) {
    return {
      ...ANALYZER_SETTINGS,
      refresh_interval: '5s',
      ...customSettings,
    };
  }
  
  // Traditional mode: Full control over settings
  return {
    ...ANALYZER_SETTINGS,
    number_of_shards: 1,
    number_of_replicas: process.env.NODE_ENV === 'production' ? 1 : 0,
    refresh_interval: '1s',
    max_result_window: 50000,
    ...customSettings,
  };
}

/**
 * Generate index definitions based on configuration
 */
export function getIndexDefinitions(): IndexDefinition[] {
  return [
    {
      entity: ES_ENTITIES.EVENTS,
      name: buildIndexName(ES_ENTITIES.EVENTS),
      alias: buildAliasName(ES_ENTITIES.EVENTS),
      mapping: eventsMapping,
    },
    {
      entity: ES_ENTITIES.ARCHIVED_EVENTS,
      name: buildIndexName(ES_ENTITIES.ARCHIVED_EVENTS),
      alias: buildAliasName(ES_ENTITIES.ARCHIVED_EVENTS),
      mapping: archivedEventsMapping,
      settings: {
        refresh_interval: '30s', // Less frequent for archive
      },
    },
    {
      entity: ES_ENTITIES.TASKS,
      name: buildIndexName(ES_ENTITIES.TASKS),
      alias: buildAliasName(ES_ENTITIES.TASKS),
      mapping: tasksMapping,
    },
    {
      entity: ES_ENTITIES.CONTACTS,
      name: buildIndexName(ES_ENTITIES.CONTACTS),
      alias: buildAliasName(ES_ENTITIES.CONTACTS),
      mapping: contactsMapping,
    },
    {
      entity: ES_ENTITIES.ORGANIZATIONS,
      name: buildIndexName(ES_ENTITIES.ORGANIZATIONS),
      alias: buildAliasName(ES_ENTITIES.ORGANIZATIONS),
      mapping: organizationsMapping,
    },
    {
      entity: ES_ENTITIES.PARTNERSHIPS,
      name: buildIndexName(ES_ENTITIES.PARTNERSHIPS),
      alias: buildAliasName(ES_ENTITIES.PARTNERSHIPS),
      mapping: organizationsMapping, // Same structure, filtered by isPartner
    },
    {
      entity: ES_ENTITIES.AGREEMENTS,
      name: buildIndexName(ES_ENTITIES.AGREEMENTS),
      alias: buildAliasName(ES_ENTITIES.AGREEMENTS),
      mapping: agreementsMapping,
    },
    {
      entity: ES_ENTITIES.LEADS,
      name: buildIndexName(ES_ENTITIES.LEADS),
      alias: buildAliasName(ES_ENTITIES.LEADS),
      mapping: leadsMapping,
    },
    {
      entity: ES_ENTITIES.DEPARTMENTS,
      name: buildIndexName(ES_ENTITIES.DEPARTMENTS),
      alias: buildAliasName(ES_ENTITIES.DEPARTMENTS),
      mapping: departmentsMapping,
    },
    {
      entity: ES_ENTITIES.ATTENDEES,
      name: buildIndexName(ES_ENTITIES.ATTENDEES),
      alias: buildAliasName(ES_ENTITIES.ATTENDEES),
      mapping: attendeesMapping,
    },
    {
      entity: ES_ENTITIES.INVITEES,
      name: buildIndexName(ES_ENTITIES.INVITEES),
      alias: buildAliasName(ES_ENTITIES.INVITEES),
      mapping: inviteesMapping,
    },
    {
      entity: ES_ENTITIES.LEAD_INTERACTIONS,
      name: buildIndexName(ES_ENTITIES.LEAD_INTERACTIONS),
      alias: buildAliasName(ES_ENTITIES.LEAD_INTERACTIONS),
      mapping: interactionsMapping,
      lifecycle: {
        deleteAfter: '365d', // Keep for 1 year
      },
    },
    {
      entity: ES_ENTITIES.PARTNERSHIP_ACTIVITIES,
      name: buildIndexName(ES_ENTITIES.PARTNERSHIP_ACTIVITIES),
      alias: buildAliasName(ES_ENTITIES.PARTNERSHIP_ACTIVITIES),
      mapping: activitiesMapping,
    },
    {
      entity: ES_ENTITIES.PARTNERSHIP_INTERACTIONS,
      name: buildIndexName(ES_ENTITIES.PARTNERSHIP_INTERACTIONS),
      alias: buildAliasName(ES_ENTITIES.PARTNERSHIP_INTERACTIONS),
      mapping: interactionsMapping,
      lifecycle: {
        deleteAfter: '365d',
      },
    },
    {
      entity: ES_ENTITIES.UPDATES,
      name: buildIndexName(ES_ENTITIES.UPDATES),
      alias: buildAliasName(ES_ENTITIES.UPDATES),
      mapping: updatesMapping,
      lifecycle: {
        deleteAfter: '730d', // Keep for 2 years
      },
    },
  ];
}

// Cached index definitions
let INDEX_DEFINITIONS: IndexDefinition[] | null = null;

/**
 * Get index definitions with caching
 */
export function getCachedIndexDefinitions(): IndexDefinition[] {
  if (!INDEX_DEFINITIONS) {
    INDEX_DEFINITIONS = getIndexDefinitions();
  }
  return INDEX_DEFINITIONS;
}

/**
 * Index Manager class for managing ES indices
 */
export class IndexManager {
  private initialized = false;

  /**
   * Initialize all indices (create if not exist)
   */
  async initialize(): Promise<void> {
    if (!isElasticsearchEnabled()) {
      logger.info('Elasticsearch disabled - skipping index initialization');
      return;
    }

    if (this.initialized) {
      return;
    }

    try {
      const results = await this.createAllIndices();
      this.initialized = true;
      logger.info(`Index initialization complete: ${results.created.length} created, ${results.existing.length} existing`);
    } catch (error) {
      logger.error('Failed to initialize indices:', error);
      throw error;
    }
  }

  /**
   * Create all configured indices
   */
  async createAllIndices(): Promise<{ created: string[]; existing: string[]; failed: string[] }> {
    const client = await getElasticsearchClient();
    const results = { created: [] as string[], existing: [] as string[], failed: [] as string[] };
    const definitions = getCachedIndexDefinitions();

    for (const indexDef of definitions) {
      try {
        const exists = await client.indices.exists({ index: indexDef.name });

        if (exists) {
          results.existing.push(indexDef.name);
          // Try to update mapping with new fields (non-breaking only)
          await this.updateMappingIfNeeded(indexDef);
          continue;
        }

        // Create index with settings and mappings
        await client.indices.create({
          index: indexDef.name,
          settings: getDefaultSettings(indexDef.settings),
          mappings: indexDef.mapping,
        });

        // Create alias
        if (indexDef.alias) {
          await client.indices.putAlias({
            index: indexDef.name,
            name: indexDef.alias,
          });
        }

        results.created.push(indexDef.name);
        logger.info(`Created index: ${indexDef.name}`);
      } catch (error) {
        results.failed.push(indexDef.name);
        logger.error(`Failed to create index ${indexDef.name}:`, error);
      }
    }

    return results;
  }

  /**
   * Update index mapping with new fields (non-breaking changes only)
   */
  async updateMappingIfNeeded(indexDef: IndexDefinition): Promise<boolean> {
    const client = await getElasticsearchClient();

    try {
      const currentMapping = await client.indices.getMapping({ index: indexDef.name });
      const currentProps = currentMapping[indexDef.name]?.mappings?.properties || {};
      const newProps = indexDef.mapping.properties || {};

      // Find new fields
      const newFields: Record<string, any> = {};
      for (const [field, config] of Object.entries(newProps)) {
        if (!currentProps[field]) {
          newFields[field] = config;
        }
      }

      if (Object.keys(newFields).length > 0) {
        await client.indices.putMapping({
          index: indexDef.name,
          properties: newFields,
        });
        logger.info(`Updated mapping for ${indexDef.name}: added ${Object.keys(newFields).join(', ')}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.warn(`Failed to update mapping for ${indexDef.name}:`, error);
      return false;
    }
  }

  /**
   * Delete a specific index
   */
  async deleteIndex(indexName: string): Promise<boolean> {
    const client = await getElasticsearchClient();

    try {
      const exists = await client.indices.exists({ index: indexName });
      if (!exists) {
        return false;
      }

      await client.indices.delete({ index: indexName });
      logger.info(`Deleted index: ${indexName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete index ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Recreate an index (delete and create fresh)
   */
  async recreateIndex(entityOrName: string): Promise<void> {
    const definitions = getCachedIndexDefinitions();
    const indexDef = definitions.find(
      i => i.name === entityOrName || i.alias === entityOrName || i.entity === entityOrName
    );
    
    if (!indexDef) {
      throw new Error(`Index definition not found: ${entityOrName}`);
    }

    const client = await getElasticsearchClient();

    // Delete if exists
    const exists = await client.indices.exists({ index: indexDef.name });
    if (exists) {
      await client.indices.delete({ index: indexDef.name });
    }

    // Create fresh
    await client.indices.create({
      index: indexDef.name,
      settings: getDefaultSettings(indexDef.settings),
      mappings: indexDef.mapping,
    });

    if (indexDef.alias) {
      await client.indices.putAlias({
        index: indexDef.name,
        name: indexDef.alias,
      });
    }

    logger.info(`Recreated index: ${indexDef.name}`);
  }

  /**
   * Get statistics for all indices
   */
  async getIndexStats(): Promise<IndexStats[]> {
    const client = await getElasticsearchClient();
    const indexPattern = `${ES_INDEX_PREFIX}-*-${ES_INDEX_SUFFIX}`;

    // Serverless: Use count and basic index info (no detailed stats API)
    if (isServerlessMode()) {
      const results: IndexStats[] = [];
      const definitions = getCachedIndexDefinitions();

      // Get list of indices
      const indices = await client.cat.indices({
        index: indexPattern,
        format: 'json',
        h: 'index',
      });

      // Get count for each index individually
      for (const idx of (indices as any[])) {
        const indexName = idx.index;
        const def = definitions.find(d => d.name === indexName);

        try {
          // Use count API (available in serverless)
          const countResult = await client.count({ index: indexName });
          
          results.push({
            index: indexName,
            entity: def?.entity || 'unknown',
            docsCount: countResult.count || 0,
            docsDeleted: 0, // Not available in serverless
            sizeBytes: 0, // Not available in serverless
            sizeHuman: 'N/A', // Not available in serverless
            health: 'green', // Serverless is always healthy
            status: 'open',
          });
        } catch (error) {
          // If count fails, just add with zero docs
          results.push({
            index: indexName,
            entity: def?.entity || 'unknown',
            docsCount: 0,
            docsDeleted: 0,
            sizeBytes: 0,
            sizeHuman: 'N/A',
            health: 'green',
            status: 'open',
          });
        }
      }

      return results.sort((a, b) => a.entity.localeCompare(b.entity));
    }

    // Traditional: Use full stats API
    const stats = await client.indices.stats({
      index: indexPattern,
      metric: ['docs', 'store'],
    });

    const health = await client.cluster.health({ index: indexPattern, level: 'indices' });

    const results: IndexStats[] = [];
    const definitions = getCachedIndexDefinitions();

    for (const [indexName, indexStats] of Object.entries(stats.indices || {})) {
      const indexHealth = health.indices?.[indexName];
      const def = definitions.find(d => d.name === indexName);

      results.push({
        index: indexName,
        entity: def?.entity || 'unknown',
        docsCount: indexStats.total?.docs?.count || 0,
        docsDeleted: indexStats.total?.docs?.deleted || 0,
        sizeBytes: indexStats.total?.store?.size_in_bytes || 0,
        sizeHuman: formatBytes(indexStats.total?.store?.size_in_bytes || 0),
        health: indexHealth?.status || 'unknown',
        status: indexHealth?.status || 'unknown',
      });
    }

    return results.sort((a, b) => a.entity.localeCompare(b.entity));
  }

  /**
   * Refresh a specific index
   */
  async refreshIndex(indexName: string): Promise<void> {
    const client = await getElasticsearchClient();
    await client.indices.refresh({ index: indexName });
  }

  /**
   * Refresh all indices
   */
  async refreshAllIndices(): Promise<void> {
    const client = await getElasticsearchClient();
    await client.indices.refresh({ index: `${ES_INDEX_PREFIX}-*-${ES_INDEX_SUFFIX}` });
  }

  /**
   * Force merge (optimize) an index
   */
  async optimizeIndex(indexName: string): Promise<void> {
    const client = await getElasticsearchClient();
    await client.indices.forcemerge({
      index: indexName,
      max_num_segments: 1,
    });
    logger.info(`Optimized index: ${indexName}`);
  }

  /**
   * Get index definition by entity type
   */
  getIndexDefinition(entity: ESEntityType): IndexDefinition | undefined {
    return getCachedIndexDefinitions().find(d => d.entity === entity);
  }

  /**
   * Check if an index exists
   */
  async indexExists(indexName: string): Promise<boolean> {
    const client = await getElasticsearchClient();
    return await client.indices.exists({ index: indexName });
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Singleton instance
export const indexManager = new IndexManager();
