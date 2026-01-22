/**
 * Elasticsearch Admin Types
 * 
 * Client-side types for Elasticsearch admin interface
 */

// ES Health status from server
export interface ESHealthResponse {
  status: 'green' | 'yellow' | 'red' | 'unavailable';
  cluster_name: string;
  number_of_nodes: number;
  number_of_data_nodes: number;
  active_primary_shards: number;
  active_shards: number;
  relocating_shards: number;
  initializing_shards: number;
  unassigned_shards: number;
  delayed_unassigned_shards: number;
  number_of_pending_tasks: number;
  number_of_in_flight_fetch: number;
  task_max_waiting_in_queue_millis: number;
  active_shards_percent_as_number: number;
}

// Index stats from server
export interface IndexStats {
  index: string;
  entity: string;
  docsCount: number;
  docsDeleted: number;
  sizeBytes: number;
  sizeHuman: string;
  health: 'green' | 'yellow' | 'red';
  status: string;
}

// Sync status from server
export interface SyncStatus {
  lastSyncAt: string | null;
  lastFullSyncAt: string | null;
  documentsIndexed: number;
  documentsDeleted: number;
  errors: number;
  inProgress: boolean;
  currentEntity: string | null;
  progress: number;
}

// Full admin status response
export interface ESAdminStatus {
  sync: SyncStatus;
  cron: {
    running: boolean;
    lastRun: string | null;
    nextRun: string | null;
    interval: string;
  };
}

// Data quality check result
export interface DataQualityResult {
  entity: string;
  pgCount: number;
  esCount: number;
  missingInEs: number;
  orphanedInEs: number;
  lastChecked: string;
}

// Sync history entry
export interface SyncHistoryEntry {
  id: string;
  type: 'full' | 'incremental' | 'entity';
  entity?: string;
  startedAt: string;
  completedAt: string | null;
  documentsIndexed: number;
  documentsDeleted: number;
  errors: number;
  status: 'running' | 'completed' | 'failed';
}

// Index action result
export interface IndexActionResult {
  success: boolean;
  message: string;
  error?: string;
}
