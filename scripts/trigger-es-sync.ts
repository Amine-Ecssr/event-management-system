/**
 * Script to trigger Elasticsearch full reindex
 * Run with: tsx scripts/trigger-es-sync.ts
 */

import { syncService } from '../server/services/elasticsearch-sync.service';

async function main() {
  console.log('Starting Elasticsearch full reindex...');
  
  try {
    const result = await syncService.reindexAll();
    
    console.log('\n✅ Sync completed successfully!');
    console.log(`📊 Documents indexed: ${result.documentsIndexed}`);
    console.log(`⏱️  Duration: ${result.duration_ms}ms`);
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${result.errors.length}`);
      result.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.entity} (${err.id}): ${err.error}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  }
}

main();
