/**
 * Script to recreate Elasticsearch indices with fixed mappings
 * Run with: tsx scripts/recreate-es-indices.ts
 */

import { getElasticsearchClient } from '../server/elasticsearch/client';
import { IndexManager } from '../server/elasticsearch/indices/index-manager';
import { syncService } from '../server/services/elasticsearch-sync.service';

async function main() {
  console.log('🔧 Recreating Elasticsearch indices with fixed mappings...\n');
  
  try {
    const client = await getElasticsearchClient();
    const indexManager = new IndexManager(client);
    
    // Delete and recreate indices
    console.log('1️⃣  Deleting old indices...');
    const indices = [
      'eventcal-events-dev',
      'eventcal-archived-events-dev',
      'eventcal-tasks-dev',
    ];
    
    for (const indexName of indices) {
      try {
        const exists = await client.indices.exists({ index: indexName });
        if (exists) {
          await client.indices.delete({ index: indexName });
          console.log(`   ✓ Deleted ${indexName}`);
        }
      } catch (error) {
        console.log(`   ℹ ${indexName} doesn't exist, skipping`);
      }
    }
    
    // Recreate indices
    console.log('\n2️⃣  Creating indices with new mappings...');
    await indexManager.createAllIndices();
    console.log('   ✓ All indices created\n');
    
    // Sync data
    console.log('3️⃣  Syncing data from PostgreSQL...');
    const result = await syncService.reindexAll();
    
    console.log('\n✅ Migration completed successfully!');
    console.log(`📊 Documents indexed: ${result.documentsIndexed}`);
    console.log(`⏱️  Duration: ${result.duration_ms}ms`);
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${result.errors.length}`);
      result.errors.slice(0, 10).forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.entity} (${err.id}): ${err.error}`);
      });
      if (result.errors.length > 10) {
        console.log(`  ... and ${result.errors.length - 10} more`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
