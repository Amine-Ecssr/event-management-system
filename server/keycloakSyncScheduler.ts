/**
 * Keycloak Group Sync Scheduler
 * 
 * Automatically syncs Keycloak groups and users to the local database
 * on a scheduled interval to ensure department memberships are always up-to-date.
 */

import { keycloakAdmin } from './keycloak-admin';

// Sync interval in milliseconds (default: 1 hour)
const SYNC_INTERVAL = parseInt(process.env.KEYCLOAK_SYNC_INTERVAL || '3600000'); // 1 hour
const SYNC_ENABLED = process.env.KEYCLOAK_SYNC_ENABLED !== 'false'; // Default to enabled

let syncIntervalId: NodeJS.Timeout | null = null;

/**
 * Perform a full sync of Keycloak groups and members
 */
async function performSync(): Promise<void> {
  if (!keycloakAdmin.isConfigured()) {
    console.log('[Keycloak Sync] Not configured, skipping sync');
    return;
  }

  try {
    console.log('[Keycloak Sync] Starting scheduled sync...');
    const startTime = Date.now();

    await keycloakAdmin.syncAllGroupsAndMembers();

    const duration = Date.now() - startTime;
    console.log(`[Keycloak Sync] Sync completed successfully in ${duration}ms`);
  } catch (error) {
    console.error('[Keycloak Sync] Failed to sync:', error);
  }
}

/**
 * Start the Keycloak sync scheduler
 */
export function startKeycloakSyncScheduler(): void {
  if (!SYNC_ENABLED) {
    console.log('[Keycloak Sync] Scheduler disabled via KEYCLOAK_SYNC_ENABLED=false');
    return;
  }

  if (!keycloakAdmin.isConfigured()) {
    console.log('[Keycloak Sync] Keycloak not configured, scheduler will not start');
    return;
  }

  // Perform initial sync on startup
  console.log('[Keycloak Sync] Performing initial sync on startup...');
  performSync().catch(error => {
    console.error('[Keycloak Sync] Initial sync failed:', error);
  });

  // Schedule periodic syncs
  syncIntervalId = setInterval(() => {
    performSync();
  }, SYNC_INTERVAL);

  const intervalMinutes = Math.floor(SYNC_INTERVAL / 60000);
  console.log(`[Keycloak Sync] Scheduler started (interval: ${intervalMinutes} minutes)`);
}

/**
 * Stop the Keycloak sync scheduler
 */
export function stopKeycloakSyncScheduler(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[Keycloak Sync] Scheduler stopped');
  }
}

/**
 * Manually trigger a sync (useful for testing or on-demand syncs)
 */
export async function triggerManualSync(): Promise<void> {
  console.log('[Keycloak Sync] Manual sync triggered');
  await performSync();
}
