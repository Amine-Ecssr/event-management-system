# Infrastructure: Elasticsearch Backend Client Integration

## Type
Infrastructure / Backend Integration

## Priority
🔴 Critical - Required for all ES operations

## Estimated Effort
2-3 hours

## Description
Create the Elasticsearch client integration in the Node.js backend. This establishes the connection to Elasticsearch and provides the foundation for all indexing, search, and aggregation operations.

## Current State
- No Elasticsearch client in backend
- No connection management
- No health monitoring for ES

## Requirements

### Package Installation
```bash
npm install @elastic/elasticsearch
npm install --save-dev @types/node
```

### Client Configuration

#### Create `server/elasticsearch/client.ts`
```typescript
import { Client, ClientOptions } from '@elastic/elasticsearch';
import { logger } from '../utils/logger';

// Environment configuration
const esConfig: ClientOptions = {
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || '',
  },
  maxRetries: 5,
  requestTimeout: 30000,
  sniffOnStart: false, // Disable for single-node setup
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production',
  },
};

// Singleton client instance
let esClient: Client | null = null;

export async function getElasticsearchClient(): Promise<Client> {
  if (!esClient) {
    esClient = new Client(esConfig);
    
    // Verify connection on first use
    try {
      const health = await esClient.cluster.health({});
      logger.info(`Elasticsearch connected: ${health.cluster_name}, status: ${health.status}`);
    } catch (error) {
      logger.error('Failed to connect to Elasticsearch:', error);
      throw error;
    }
  }
  return esClient;
}

export async function closeElasticsearchClient(): Promise<void> {
  if (esClient) {
    await esClient.close();
    esClient = null;
    logger.info('Elasticsearch client closed');
  }
}

// Health check function
export async function checkElasticsearchHealth(): Promise<{
  status: 'green' | 'yellow' | 'red' | 'unavailable';
  cluster_name?: string;
  number_of_nodes?: number;
  active_shards?: number;
  error?: string;
}> {
  try {
    const client = await getElasticsearchClient();
    const health = await client.cluster.health({});
    return {
      status: health.status,
      cluster_name: health.cluster_name,
      number_of_nodes: health.number_of_nodes,
      active_shards: health.active_shards,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Graceful shutdown handler
export function setupElasticsearchShutdown(): void {
  process.on('SIGTERM', async () => {
    await closeElasticsearchClient();
  });
  process.on('SIGINT', async () => {
    await closeElasticsearchClient();
  });
}
```

### Health Check Endpoint

#### Create `server/routes/elasticsearch-health.routes.ts`
```typescript
import { Router } from 'express';
import { checkElasticsearchHealth } from '../elasticsearch/client';
import { isSuperAdmin } from '../auth';

const router = Router();

// Public health check (minimal info)
router.get('/api/health/elasticsearch', async (req, res) => {
  const health = await checkElasticsearchHealth();
  const statusCode = health.status === 'unavailable' ? 503 : 200;
  res.status(statusCode).json({ status: health.status });
});

// Detailed health check (superadmin only)
router.get('/api/health/elasticsearch/detailed', isSuperAdmin, async (req, res) => {
  const health = await checkElasticsearchHealth();
  res.json(health);
});

export default router;
```

### Server Initialization

#### Modify `server/index.ts`
```typescript
import { getElasticsearchClient, setupElasticsearchShutdown } from './elasticsearch/client';
import elasticsearchHealthRoutes from './routes/elasticsearch-health.routes';

// In server initialization
async function initializeServices() {
  // Initialize Elasticsearch connection
  try {
    await getElasticsearchClient();
    logger.info('Elasticsearch client initialized');
  } catch (error) {
    logger.error('Failed to initialize Elasticsearch:', error);
    // Don't crash server - ES is optional for basic functionality
  }
  
  // Setup graceful shutdown
  setupElasticsearchShutdown();
}

// Register routes
app.use(elasticsearchHealthRoutes);
```

### Connection Retry Logic

Add retry logic for resilient connections:
```typescript
export async function waitForElasticsearch(
  maxRetries = 30,
  retryDelay = 2000
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = await getElasticsearchClient();
      await client.cluster.health({ wait_for_status: 'yellow', timeout: '5s' });
      return true;
    } catch (error) {
      logger.warn(`Waiting for Elasticsearch (attempt ${i + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  return false;
}
```

### Type Definitions

#### Create `server/elasticsearch/types.ts`
```typescript
export interface ESHealthResponse {
  status: 'green' | 'yellow' | 'red' | 'unavailable';
  cluster_name?: string;
  number_of_nodes?: number;
  active_shards?: number;
  error?: string;
}

export interface ESIndexStats {
  index: string;
  docs_count: number;
  size_bytes: number;
  health: string;
}

export interface BulkIndexResult {
  indexed: number;
  failed: number;
  errors: Array<{
    id: string;
    error: string;
  }>;
}
```

## Files to Create
- `server/elasticsearch/client.ts` - ES client singleton
- `server/elasticsearch/types.ts` - TypeScript type definitions
- `server/routes/elasticsearch-health.routes.ts` - Health check endpoints

## Files to Modify
- `package.json` - Add @elastic/elasticsearch dependency
- `server/index.ts` - Initialize ES client on startup
- `server/routes.ts` - Register health check routes

## Acceptance Criteria
- [ ] ES client connects successfully on server startup
- [ ] Connection errors logged but don't crash server
- [ ] `/api/health/elasticsearch` returns ES status
- [ ] `/api/health/elasticsearch/detailed` returns full cluster info (superadmin only)
- [ ] Graceful shutdown closes ES connection
- [ ] Retry logic handles temporary ES unavailability
- [ ] Type definitions exported for use across codebase

## Testing Steps
1. Start ES container: `npm run docker:dev`
2. Start server: `npm run dev`
3. Check logs for "Elasticsearch client initialized"
4. Test health endpoint: `curl http://localhost:3000/api/health/elasticsearch`
5. Stop ES container, verify server continues running
6. Restart ES container, verify reconnection

## Dependencies
- Task 01: Elasticsearch Docker Setup (must be completed)
- @elastic/elasticsearch npm package

## Notes
- Client is singleton pattern - one connection per server instance
- Connection pooling handled by ES client library
- maxRetries and requestTimeout prevent hanging requests
- SSL verification only enforced in production
- Health checks are non-blocking - app works without ES

## Related Tasks
- 01: Docker Setup (prerequisite)
- 03: Arabic/English Analyzer Configuration
- 04: Index Management

---

## Complete Implementation Details

### Full Client Implementation (`server/elasticsearch/client.ts`)
```typescript
import { Client, ClientOptions, errors as ESErrors } from '@elastic/elasticsearch';
import { logger } from '../utils/logger';

// Environment configuration with validation
const getEsConfig = (): ClientOptions => {
  const esUrl = process.env.ELASTICSEARCH_URL;
  
  if (!esUrl && process.env.NODE_ENV === 'production') {
    throw new Error('ELASTICSEARCH_URL is required in production');
  }
  
  return {
    node: esUrl || 'http://localhost:9200',
    auth: process.env.ELASTICSEARCH_USERNAME ? {
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD || '',
    } : undefined,
    maxRetries: 5,
    requestTimeout: 30000,
    sniffOnStart: false,
    sniffOnConnectionFault: false,
    resurrectStrategy: 'ping',
    compression: true,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      ca: process.env.ELASTICSEARCH_CA_CERT,
    },
    // Connection pool settings
    agent: {
      maxSockets: 10,
      maxFreeSockets: 5,
      keepAlive: true,
      keepAliveMsecs: 30000,
    },
  };
};

// Singleton with lazy initialization
let esClient: Client | null = null;
let isInitialized = false;
let initializationError: Error | null = null;

// Feature flag to disable ES entirely
export const isElasticsearchEnabled = (): boolean => {
  return process.env.ELASTICSEARCH_ENABLED !== 'false';
};

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
      const health = await esClient.cluster.health({ timeout: '5s' });
      logger.info(`Elasticsearch connected: ${health.cluster_name}, status: ${health.status}`);
      isInitialized = true;
    } catch (error) {
      if (error instanceof ESErrors.ConnectionError) {
        logger.error('Failed to connect to Elasticsearch:', error.message);
      } else if (error instanceof ESErrors.TimeoutError) {
        logger.error('Elasticsearch connection timed out');
      } else {
        logger.error('Elasticsearch initialization error:', error);
      }
      initializationError = error as Error;
      throw error;
    }
  }
  
  return esClient;
}

// Get client without throwing (for optional ES operations)
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

export async function closeElasticsearchClient(): Promise<void> {
  if (esClient) {
    await esClient.close();
    esClient = null;
    isInitialized = false;
    initializationError = null;
    logger.info('Elasticsearch client closed');
  }
}

// Comprehensive health check
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
  max_task_wait_time_in_queue_millis?: number;
  error?: string;
  latency_ms?: number;
}

export async function checkElasticsearchHealth(): Promise<ESHealthResponse> {
  if (!isElasticsearchEnabled()) {
    return { status: 'unavailable', enabled: false, error: 'Elasticsearch is disabled' };
  }
  
  const startTime = Date.now();
  
  try {
    const client = await getElasticsearchClient();
    const health = await client.cluster.health({});
    const latency = Date.now() - startTime;
    
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
      max_task_wait_time_in_queue_millis: health.task_max_waiting_in_queue_millis,
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

// Index statistics
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

export async function getIndexStats(): Promise<ESIndexStats[]> {
  const client = await getElasticsearchClient();
  // Use configurable index prefix from config
  const { ES_INDEX_PREFIX } = await import('./config');
  
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

// Retry with exponential backoff
export async function waitForElasticsearch(
  maxRetries = 30,
  initialDelay = 1000,
  maxDelay = 30000
): Promise<boolean> {
  let delay = initialDelay;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = await getElasticsearchClient();
      await client.cluster.health({ 
        wait_for_status: 'yellow', 
        timeout: '10s' 
      });
      return true;
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;
      logger.warn(
        `Waiting for Elasticsearch (attempt ${i + 1}/${maxRetries})${isLastAttempt ? ' - giving up' : ''}`,
        { error: error instanceof Error ? error.message : 'Unknown' }
      );
      
      if (isLastAttempt) {
        return false;
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, maxDelay); // Exponential backoff with cap
    }
  }
  return false;
}

// Graceful shutdown handler
export function setupElasticsearchShutdown(): void {
  const shutdown = async () => {
    logger.info('Shutting down Elasticsearch client...');
    await closeElasticsearchClient();
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Error classification helper
export function classifyESError(error: unknown): {
  type: 'connection' | 'timeout' | 'not_found' | 'conflict' | 'validation' | 'unknown';
  retryable: boolean;
  message: string;
} {
  if (error instanceof ESErrors.ConnectionError) {
    return { type: 'connection', retryable: true, message: 'Elasticsearch connection failed' };
  }
  if (error instanceof ESErrors.TimeoutError) {
    return { type: 'timeout', retryable: true, message: 'Elasticsearch request timed out' };
  }
  if (error instanceof ESErrors.ResponseError) {
    const statusCode = error.statusCode;
    if (statusCode === 404) {
      return { type: 'not_found', retryable: false, message: 'Document or index not found' };
    }
    if (statusCode === 409) {
      return { type: 'conflict', retryable: true, message: 'Document version conflict' };
    }
    if (statusCode === 400) {
      return { type: 'validation', retryable: false, message: error.message };
    }
  }
  return { 
    type: 'unknown', 
    retryable: false, 
    message: error instanceof Error ? error.message : 'Unknown error' 
  };
}
```

### Enhanced Health Check Routes (`server/routes/elasticsearch-health.routes.ts`)
```typescript
import { Router } from 'express';
import { 
  checkElasticsearchHealth, 
  getIndexStats,
  isElasticsearchEnabled,
  getElasticsearchClient
} from '../elasticsearch/client';
import { isSuperAdmin, isAdminOrSuperAdmin } from '../auth';

const router = Router();

// Public health check - minimal info for load balancers
router.get('/api/health/elasticsearch', async (req, res) => {
  const health = await checkElasticsearchHealth();
  const statusCode = health.status === 'unavailable' ? 503 : 200;
  
  res.status(statusCode).json({
    status: health.status,
    enabled: health.enabled,
  });
});

// Detailed health check (admin access)
router.get('/api/health/elasticsearch/detailed', isAdminOrSuperAdmin, async (req, res) => {
  const health = await checkElasticsearchHealth();
  
  let indexStats: any[] = [];
  if (health.status !== 'unavailable') {
    try {
      indexStats = await getIndexStats();
    } catch (error) {
      // Index stats failed but health is available
    }
  }
  
  res.json({
    ...health,
    indices: indexStats,
    timestamp: new Date().toISOString(),
  });
});

// Node info (superadmin only - contains sensitive data)
router.get('/api/health/elasticsearch/nodes', isSuperAdmin, async (req, res) => {
  if (!isElasticsearchEnabled()) {
    return res.status(503).json({ error: 'Elasticsearch is disabled' });
  }
  
  try {
    const client = await getElasticsearchClient();
    const nodes = await client.nodes.stats({
      metric: ['jvm', 'os', 'fs', 'process'],
    });
    
    res.json(nodes);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get node stats' 
    });
  }
});

// Pending tasks (superadmin only)
router.get('/api/health/elasticsearch/tasks', isSuperAdmin, async (req, res) => {
  if (!isElasticsearchEnabled()) {
    return res.status(503).json({ error: 'Elasticsearch is disabled' });
  }
  
  try {
    const client = await getElasticsearchClient();
    const tasks = await client.cluster.pendingTasks({});
    
    res.json({
      pending_tasks: tasks.tasks,
      total: tasks.tasks?.length || 0,
    });
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get pending tasks' 
    });
  }
});

export default router;
```

### Type Definitions (`server/elasticsearch/types.ts`)
```typescript
import { 
  ES_INDEX_PREFIX, ES_INDEX_SUFFIX, ES_ENTITIES, 
  buildIndexName, buildAliasName, ESEntityType 
} from './config';

// Re-export config for convenience
export { ES_INDEX_PREFIX, ES_INDEX_SUFFIX, ES_ENTITIES, buildIndexName, buildAliasName };
export type { ESEntityType };

// Base types for ES operations
export interface BulkIndexResult {
  indexed: number;
  updated: number;
  failed: number;
  took_ms: number;
  errors: BulkError[];
}

export interface BulkError {
  id: string;
  index: string;
  type: string;
  error: {
    type: string;
    reason: string;
    caused_by?: {
      type: string;
      reason: string;
    };
  };
}

export interface SearchHit<T> {
  _id: string;
  _index: string;
  _score: number | null;
  _source: T;
  highlight?: Record<string, string[]>;
  sort?: (string | number)[];
}

export interface SearchResponse<T> {
  hits: SearchHit<T>[];
  total: number;
  max_score: number | null;
  aggregations?: Record<string, AggregationResult>;
  took: number;
  timed_out: boolean;
}

export interface AggregationResult {
  buckets?: AggregationBucket[];
  value?: number;
  doc_count?: number;
}

export interface AggregationBucket {
  key: string | number;
  key_as_string?: string;
  doc_count: number;
  [key: string]: any; // Nested aggregations
}

// Query building types
export interface QueryOptions {
  query?: string;
  filters?: Record<string, any>;
  sort?: SortOption[];
  from?: number;
  size?: number;
  highlight?: HighlightConfig;
  aggregations?: Record<string, any>;
  source?: string[] | boolean;
  track_total_hits?: boolean | number;
}

export interface SortOption {
  field: string;
  order: 'asc' | 'desc';
  missing?: '_first' | '_last';
  unmapped_type?: string;
}

export interface HighlightConfig {
  fields: Record<string, HighlightFieldConfig>;
  pre_tags?: string[];
  post_tags?: string[];
  number_of_fragments?: number;
  fragment_size?: number;
}

export interface HighlightFieldConfig {
  type?: 'unified' | 'plain' | 'fvh';
  number_of_fragments?: number;
  fragment_size?: number;
}

// Indexing types
export interface IndexDocument {
  id: string;
  body: Record<string, any>;
  routing?: string;
}

export interface IndexResult {
  _id: string;
  _index: string;
  _version: number;
  result: 'created' | 'updated' | 'deleted' | 'noop';
}

// Sync types
export interface SyncStatus {
  lastSyncAt: Date | null;
  lastFullSyncAt: Date | null;
  documentsIndexed: number;
  documentsDeleted: number;
  errors: number;
  inProgress: boolean;
  currentEntity?: string;
  progress?: number;
}

export interface SyncResult {
  success: boolean;
  documentsIndexed: number;
  documentsDeleted: number;
  errors: SyncError[];
  duration_ms: number;
  entity?: string;
}

export interface SyncError {
  entity: string;
  id: string;
  error: string;
  timestamp: Date;
}

// Index configuration types
export interface IndexConfig {
  name: string;
  settings: Record<string, any>;
  mappings: Record<string, any>;
  aliases?: string[];
}

// Entity type mapping using configurable index names
export type EntityType = ESEntityType;

// Build entity index map dynamically based on configuration
export const getEntityIndexMap = (): Record<EntityType, string> => ({
  'events': buildAliasName(ES_ENTITIES.EVENTS),
  'archived-events': buildAliasName(ES_ENTITIES.ARCHIVED_EVENTS),
  'tasks': buildAliasName(ES_ENTITIES.TASKS),
  'contacts': buildAliasName(ES_ENTITIES.CONTACTS),
  'organizations': buildAliasName(ES_ENTITIES.ORGANIZATIONS),
  'partnerships': buildAliasName(ES_ENTITIES.PARTNERSHIPS),
  'agreements': buildAliasName(ES_ENTITIES.AGREEMENTS),
  'leads': buildAliasName(ES_ENTITIES.LEADS),
  'attendees': buildAliasName(ES_ENTITIES.ATTENDEES),
  'invitees': buildAliasName(ES_ENTITIES.INVITEES),
  'lead-interactions': buildAliasName(ES_ENTITIES.LEAD_INTERACTIONS),
  'partnership-activities': buildAliasName(ES_ENTITIES.PARTNERSHIP_ACTIVITIES),
  'partnership-interactions': buildAliasName(ES_ENTITIES.PARTNERSHIP_INTERACTIONS),
  'updates': buildAliasName(ES_ENTITIES.UPDATES),
});

// Legacy compatibility - use alias names for queries
export const ENTITY_INDEX_MAP = getEntityIndexMap();

/**
 * Helper to get index name for a specific entity
 * Uses alias names which work across environments
 */
export function getIndexForEntity(entity: EntityType): string {
  return ENTITY_INDEX_MAP[entity];
}
```

### Server Integration (`server/index.ts` modifications)
```typescript
// Add to imports
import { 
  getElasticsearchClient, 
  setupElasticsearchShutdown,
  waitForElasticsearch,
  isElasticsearchEnabled 
} from './elasticsearch/client';
import elasticsearchHealthRoutes from './routes/elasticsearch-health.routes';

// In initialization
async function initializeServices() {
  // Initialize Elasticsearch (non-blocking)
  if (isElasticsearchEnabled()) {
    // Fire and forget - don't block server startup
    waitForElasticsearch(10, 2000, 10000)
      .then(success => {
        if (success) {
          logger.info('Elasticsearch connection established');
        } else {
          logger.warn('Elasticsearch unavailable - search features disabled');
        }
      })
      .catch(error => {
        logger.error('Elasticsearch initialization failed:', error);
      });
    
    // Setup graceful shutdown
    setupElasticsearchShutdown();
  } else {
    logger.info('Elasticsearch disabled by configuration');
  }
}

// Register routes (in registerRoutes function)
app.use(elasticsearchHealthRoutes);
```

## Acceptance Criteria (Expanded)
- [ ] ES client connects successfully on server startup
- [ ] Connection errors logged but don't crash server
- [ ] `/api/health/elasticsearch` returns ES status (public)
- [ ] `/api/health/elasticsearch/detailed` returns full cluster info (admin)
- [ ] `/api/health/elasticsearch/nodes` returns node stats (superadmin)
- [ ] Graceful shutdown closes ES connection
- [ ] Retry logic handles temporary ES unavailability
- [ ] Type definitions exported for use across codebase
- [ ] ELASTICSEARCH_ENABLED=false disables all ES operations
- [ ] Connection pooling configured correctly
- [ ] Compression enabled for network efficiency
- [ ] Error classification working for retry decisions

## Integration Tests
```typescript
// __tests__/elasticsearch/client.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  getElasticsearchClient, 
  checkElasticsearchHealth,
  closeElasticsearchClient 
} from '../../server/elasticsearch/client';

describe('Elasticsearch Client', () => {
  afterAll(async () => {
    await closeElasticsearchClient();
  });
  
  it('should connect to Elasticsearch', async () => {
    const client = await getElasticsearchClient();
    expect(client).toBeDefined();
  });
  
  it('should return health status', async () => {
    const health = await checkElasticsearchHealth();
    expect(['green', 'yellow', 'red', 'unavailable']).toContain(health.status);
  });
  
  it('should handle multiple getClient calls (singleton)', async () => {
    const client1 = await getElasticsearchClient();
    const client2 = await getElasticsearchClient();
    expect(client1).toBe(client2);
  });
});
```
