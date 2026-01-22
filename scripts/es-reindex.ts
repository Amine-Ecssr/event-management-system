#!/usr/bin/env npx tsx
/**
 * Elasticsearch Full Reindex Script
 * 
 * This script performs a complete reindex of Elasticsearch data with
 * the new denormalized schema. It will:
 * 1. Delete existing indices (attendees, invitees, events)
 * 2. Recreate indices with updated mappings
 * 3. Sync all data with fully denormalized documents
 * 
 * Usage: npm run es:reindex
 * Or: npx tsx scripts/es-reindex.ts
 */

import { getOptionalElasticsearchClient, isElasticsearchEnabled } from '../server/elasticsearch/client';
import { ES_INDEX_PREFIX, ES_INDEX_SUFFIX } from '../server/elasticsearch/config';
import { syncService } from '../server/services/elasticsearch-sync.service';

const INDICES_TO_RECREATE = ['events', 'attendees', 'invitees'];

async function buildIndexName(entity: string): string {
  return `${ES_INDEX_PREFIX}-${entity}-${ES_INDEX_SUFFIX}`;
}

async function deleteIndex(client: any, indexName: string): Promise<boolean> {
  try {
    const exists = await client.indices.exists({ index: indexName });
    if (exists) {
      console.log(`  Deleting index: ${indexName}`);
      await client.indices.delete({ index: indexName });
      console.log(`  ✓ Deleted: ${indexName}`);
      return true;
    } else {
      console.log(`  Index does not exist: ${indexName}`);
      return false;
    }
  } catch (error) {
    console.error(`  ✗ Failed to delete ${indexName}:`, error);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Elasticsearch Full Reindex - Denormalization Migration');
  console.log('='.repeat(60));
  console.log('');

  // Check if ES is enabled
  if (!isElasticsearchEnabled()) {
    console.error('ERROR: Elasticsearch is not enabled. Check your environment variables.');
    process.exit(1);
  }

  // Get ES client
  const client = await getOptionalElasticsearchClient();
  if (!client) {
    console.error('ERROR: Could not connect to Elasticsearch.');
    process.exit(1);
  }

  console.log('✓ Connected to Elasticsearch');
  console.log('');

  // Step 1: Delete existing indices
  console.log('Step 1: Deleting existing indices...');
  for (const entity of INDICES_TO_RECREATE) {
    const indexName = await buildIndexName(entity);
    await deleteIndex(client, indexName);
  }
  console.log('');

  // Step 2: Wait for index manager to recreate indices
  console.log('Step 2: Indices will be recreated automatically by the index manager');
  console.log('        when the sync process starts. Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('');

  // Step 3: Run full sync
  console.log('Step 3: Running full sync with denormalized data...');
  console.log('');
  
  const startTime = Date.now();
  
  try {
    const result = await syncService.reindexAll();
    
    const duration = Date.now() - startTime;
    
    console.log('');
    console.log('='.repeat(60));
    console.log('Reindex Complete');
    console.log('='.repeat(60));
    console.log(`Total documents indexed: ${result.documentsIndexed}`);
    console.log(`Duration: ${(duration / 1000).toFixed(1)} seconds`);
    console.log(`Success: ${result.success ? 'Yes' : 'No'}`);
    
    if (result.errors.length > 0) {
      console.log(`Errors: ${result.errors.length}`);
      console.log('');
      console.log('Error details:');
      for (const err of result.errors.slice(0, 10)) {
        console.log(`  - ${err.entity}/${err.id}: ${err.error}`);
      }
      if (result.errors.length > 10) {
        console.log(`  ... and ${result.errors.length - 10} more errors`);
      }
    }
    
    console.log('');
    console.log('Next steps:');
    console.log('1. Verify data in Kibana or via API');
    console.log('2. Test the engagement dashboard');
    console.log('3. Check that event names and categories display correctly');
    
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('');
    console.error('ERROR: Reindex failed:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
