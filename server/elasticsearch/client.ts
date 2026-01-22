/**
 * Elasticsearch Client - Singleton with lazy initialization
 * 
 * Provides a resilient connection to Elasticsearch with:
 * - Automatic retry logic
 * - Connection pooling
 * - Health checks
 * - Graceful shutdown
 */

import { Client, ClientOptions } from '@elastic/elasticsearch';
import { ES_CONFIG, ES_INDEX_PREFIX, isServerlessMode } from './config';

// Logger interface (use console if no logger available)
const logger = {
  info: (...args: any[]) => console.log('[ES]', ...args),
  warn: (...args: any[]) => console.warn('[ES]', ...args),
  error: (...args: any[]) => console.error('[ES]', ...args),
};

// Get ES client configuration
const getEsConfig = (): ClientOptions => {
  // Serverless mode: Use Cloud ID + API Key
  if (isServerlessMode()) {
    logger.info('Connecting to Elasticsearch Serverless with Cloud ID');
    return {
      cloud: { id: ES_CONFIG.cloudId },
      auth: { apiKey: ES_CONFIG.apiKey },
      maxRetries: ES_CONFIG.maxRetries,
      requestTimeout: ES_CONFIG.requestTimeout,
    };
  }
  
  // Traditional mode: Use node URL + basic auth
  logger.info('Connecting to traditional Elasticsearch');
  return {
    node: ES_CONFIG.url,
    auth: ES_CONFIG.username ? {
      username: ES_CONFIG.username,
      password: ES_CONFIG.password,
    } : undefined,
    maxRetries: ES_CONFIG.maxRetries,
    requestTimeout: ES_CONFIG.requestTimeout,
    sniffOnStart: false,
    sniffOnConnectionFault: false,
    compression: true,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  };
};

// Singleton with lazy initialization
let esClient: Client | null = null;
let isInitialized = false;
let initializationError: Error | null = null;

// Feature flag to disable ES entirely
export const isElasticsearchEnabled = (): boolean => {
  return ES_CONFIG.enabled;
};

/**
 * Get the Elasticsearch client instance
 * Creates a new client if one doesn't exist
 * Throws if ES is disabled or initialization failed
 */
export async function getElasticsearchClient(): Promise<Client> {
  if (!isElasticsearchEnabled()) {
    throw new Error('Elasticsearch is disabled');
  }
  
  if (initializationError) {
    throw initializationError;
  }
  
  if (!esClient) {
    esClient = new Client(getEsConfig());
  }
  
  if (!isInitialized) {
    try {
      // Use ping for serverless (cluster.health not available)
      if (isServerlessMode()) {
        await esClient.ping();
        logger.info('Connected to Elasticsearch Serverless');
      } else {
        const health = await esClient.cluster.health({ timeout: '5s' });
        logger.info(`Connected to Elasticsearch: ${health.cluster_name}, status: ${health.status}`);
      }
      isInitialized = true;
    } catch (error) {
      logger.error('Failed to connect to Elasticsearch:', error);
      initializationError = error as Error;
      throw error;
    }
  }
  
  return esClient;
}

/**
 * Get client without throwing (for optional ES operations)
 * Returns null if ES is disabled or unavailable
 */
export async function getOptionalElasticsearchClient(): Promise<Client | null> {
  if (!isElasticsearchEnabled()) {
    return null;
  }
  
  try {
    return await getElasticsearchClient();
  } catch (error) {
    logger.warn('Elasticsearch unavailable, continuing without search functionality');
    return null;
  }
}

/**
 * Close the Elasticsearch client connection
 */
export async function closeElasticsearchClient(): Promise<void> {
  if (esClient) {
    await esClient.close();
    esClient = null;
    isInitialized = false;
    initializationError = null;
    logger.info('Elasticsearch client closed');
  }
}

/**
 * Reset the client (useful for reconnection after errors)
 */
export function resetElasticsearchClient(): void {
  if (esClient) {
    esClient.close().catch(() => {});
  }
  esClient = null;
  isInitialized = false;
  initializationError = null;
}

// Health check response interface
export interface ESHealthResponse {
  status: 'green' | 'yellow' | 'red' | 'unavailable';
  enabled: boolean;
  cluster_name?: string;
  number_of_nodes?: number;
  number_of_data_nodes?: number;
  active_primary_shards?: number;
  active_shards?: number;
  relocating_shards?: number;
  initializing_shards?: number;
  unassigned_shards?: number;
  pending_tasks?: number;
  error?: string;
  latency_ms?: number;
}

/**
 * Check Elasticsearch health
 * Returns status even if ES is unavailable
 */
export async function checkElasticsearchHealth(): Promise<ESHealthResponse> {
  if (!isElasticsearchEnabled()) {
    return { status: 'unavailable', enabled: false, error: 'Elasticsearch is disabled' };
  }
  
  const startTime = Date.now();
  
  try {
    const client = await getElasticsearchClient();
    const latency = Date.now() - startTime;
    
    // Serverless: Use ping instead of cluster.health
    if (isServerlessMode()) {
      await client.ping();
      return {
        status: 'green',
        enabled: true,
        cluster_name: 'Elasticsearch Serverless',
        latency_ms: latency,
      };
    }
    
    // Traditional: Use cluster.health
    const health = await client.cluster.health({});
    return {
      status: health.status as 'green' | 'yellow' | 'red',
      enabled: true,
      cluster_name: health.cluster_name,
      number_of_nodes: health.number_of_nodes,
      number_of_data_nodes: health.number_of_data_nodes,
      active_primary_shards: health.active_primary_shards,
      active_shards: health.active_shards,
      relocating_shards: health.relocating_shards,
      initializing_shards: health.initializing_shards,
      unassigned_shards: health.unassigned_shards,
      pending_tasks: health.number_of_pending_tasks,
      latency_ms: latency,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      enabled: true,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency_ms: Date.now() - startTime,
    };
  }
}

// Index statistics interface
export interface ESIndexStats {
  index: string;
  health: string;
  status: string;
  docs_count: number;
  docs_deleted: number;
  store_size: string;
  store_size_bytes: number;
  pri_store_size: string;
}

/**
 * Get statistics for all EventCal indices
 */
export async function getIndexStats(): Promise<ESIndexStats[]> {
  const client = await getElasticsearchClient();
  
  // Serverless: Use indices.stats (CAT API not available)
  if (isServerlessMode()) {
    const stats = await client.indices.stats({
      index: `${ES_INDEX_PREFIX}-*`,
      metric: ['docs', 'store'],
    });
    
    const results: ESIndexStats[] = [];
    if (stats.indices) {
      for (const [indexName, indexStats] of Object.entries(stats.indices)) {
        const total = (indexStats as any).total;
        results.push({
          index: indexName,
          health: 'green', // Serverless doesn't expose health per index
          status: 'open',
          docs_count: total?.docs?.count || 0,
          docs_deleted: total?.docs?.deleted || 0,
          store_size: formatBytes(total?.store?.size_in_bytes || 0),
          store_size_bytes: total?.store?.size_in_bytes || 0,
          pri_store_size: formatBytes(total?.store?.size_in_bytes || 0),
        });
      }
    }
    return results;
  }
  
  // Traditional: Use CAT API
  const indices = await client.cat.indices({
    index: `${ES_INDEX_PREFIX}-*`,
    format: 'json',
    h: 'index,health,status,docs.count,docs.deleted,store.size,pri.store.size',
  });
  
  return (indices as any[]).map(idx => ({
    index: idx.index,
    health: idx.health,
    status: idx.status,
    docs_count: parseInt(idx['docs.count'] || '0', 10),
    docs_deleted: parseInt(idx['docs.deleted'] || '0', 10),
    store_size: idx['store.size'] || '0b',
    store_size_bytes: parseSize(idx['store.size'] || '0b'),
    pri_store_size: idx['pri.store.size'] || '0b',
  }));
}

// Parse size string (e.g., "10mb") to bytes
function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)([a-z]+)?$/i);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'b').toLowerCase();
  
  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024,
  };
  
  return value * (multipliers[unit] || 1);
}

// Format bytes to human-readable string
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0b';
  
  const units = ['b', 'kb', 'mb', 'gb', 'tb'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)}${units[unitIndex]}`;
}

/**
 * Wait for Elasticsearch to become available
 * Uses exponential backoff for retries
 */
export async function waitForElasticsearch(
  maxRetries = 30,
  initialDelay = 1000,
  maxDelay = 30000
): Promise<boolean> {
  if (!isElasticsearchEnabled()) {
    logger.info('Elasticsearch is disabled, skipping wait');
    return false;
  }
  
  let delay = initialDelay;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Reset any previous errors
      resetElasticsearchClient();
      
      const client = await getElasticsearchClient();
      
      // Serverless: Just ping
      if (isServerlessMode()) {
        await client.ping();
      } else {
        await client.cluster.health({ 
          wait_for_status: 'yellow', 
          timeout: '10s' 
        });
      }
      return true;
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;
      logger.warn(
        `Waiting for Elasticsearch (attempt ${i + 1}/${maxRetries})${isLastAttempt ? ' - giving up' : ''}`,
      );
      
      if (isLastAttempt) {
        return false;
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, maxDelay);
    }
  }
  
  return false;
}

/**
 * Setup graceful shutdown handlers
 */
export function setupElasticsearchShutdown(): void {
  const shutdown = async () => {
    await closeElasticsearchClient();
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/**
 * Initialize Elasticsearch (non-blocking)
 * Connects to ES and creates indices if needed
 * Logs connection status but doesn't throw
 */
export async function initializeElasticsearch(): Promise<void> {
  if (!isElasticsearchEnabled()) {
    logger.info('Elasticsearch is disabled');
    return;
  }
  
  try {
    await getElasticsearchClient();
    logger.info('Elasticsearch client initialized successfully');
    
    // Initialize indices (lazy import to avoid circular dependency)
    const { indexManager } = await import('./indices');
    await indexManager.initialize();
  } catch (error) {
    logger.error('Failed to initialize Elasticsearch:', error);
    // Don't throw - app should continue without ES
  }
  
  // Setup graceful shutdown
  setupElasticsearchShutdown();
}
