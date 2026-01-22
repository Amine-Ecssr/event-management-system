/**
 * Test script for Elasticsearch analyzers
 * 
 * Run with: npm run test:analyzers
 * Or in Docker: docker compose -f docker-compose.dev.yml --env-file .env.development exec app npm run test:analyzers
 * 
 * @module scripts/test-analyzers
 */

import { getElasticsearchClient, isElasticsearchEnabled, waitForElasticsearch } from '../server/elasticsearch/client';
import { ANALYZER_SETTINGS } from '../server/elasticsearch/analyzers';

const TEST_INDEX = 'analyzer-test-temp';

interface TestCase {
  text: string;
  analyzer: string;
  description: string;
  expectedTokens?: string[];
}

const testCases: TestCase[] = [
  // Arabic text tests
  {
    text: 'مُؤْتَمَر',
    analyzer: 'arabic_analyzer',
    description: 'Arabic with diacritics should be normalized',
    // Arabic stemmer normalizes and stems, result varies based on stemmer
  },
  {
    text: 'الإمارات العربية المتحدة',
    analyzer: 'arabic_analyzer',
    description: 'Arabic with alef variations and stop words',
  },
  {
    text: 'مرحبا',
    analyzer: 'arabic_analyzer',
    description: 'Simple Arabic word',
  },
  {
    text: 'القاهرة',
    analyzer: 'arabic_analyzer',
    description: 'Arabic with definite article',
  },
  
  // English text tests
  {
    text: 'conferences',
    analyzer: 'english_analyzer',
    description: 'English word with stemming',
    expectedTokens: ['confer'],
  },
  {
    text: "John's running quickly",
    analyzer: 'english_analyzer',
    description: 'English with possessive and adverb',
  },
  {
    text: 'The quick brown fox',
    analyzer: 'english_analyzer',
    description: 'English with stop words',
  },
  
  // Bilingual text tests
  {
    text: 'مؤتمر Conference',
    analyzer: 'bilingual_analyzer',
    description: 'Mixed Arabic and English text',
  },
  {
    text: 'ECSSR مركز الإمارات للدراسات',
    analyzer: 'bilingual_analyzer',
    description: 'Organization name in both languages',
  },
  
  // Autocomplete tests
  {
    text: 'conference',
    analyzer: 'autocomplete_analyzer',
    description: 'Autocomplete edge n-grams',
    expectedTokens: ['co', 'con', 'conf', 'confe', 'confer', 'confere', 'conferen', 'conferenc', 'conference'],
  },
  
  // Exact match tests
  {
    text: 'Abu Dhabi',
    analyzer: 'exact_analyzer',
    description: 'Exact match (no stemming)',
    expectedTokens: ['abu dhabi'],
  },
  
  // Identifier tests
  {
    text: 'test@example.com',
    analyzer: 'identifier_analyzer',
    description: 'Email address preservation',
    expectedTokens: ['test@example.com'],
  },
  {
    text: '+971501234567',
    analyzer: 'identifier_analyzer',
    description: 'Phone number preservation',
    expectedTokens: ['+971501234567'],
  },
];

async function createTestIndex(client: any): Promise<boolean> {
  try {
    // Delete if exists
    const exists = await client.indices.exists({ index: TEST_INDEX });
    if (exists) {
      await client.indices.delete({ index: TEST_INDEX });
    }
    
    // Create with analyzer settings
    await client.indices.create({
      index: TEST_INDEX,
      settings: ANALYZER_SETTINGS,
    });
    
    console.log(`✅ Created test index: ${TEST_INDEX}\n`);
    return true;
  } catch (error) {
    console.error('❌ Failed to create test index:', error);
    return false;
  }
}

async function deleteTestIndex(client: any): Promise<void> {
  try {
    await client.indices.delete({ index: TEST_INDEX });
    console.log(`\n🧹 Cleaned up test index: ${TEST_INDEX}`);
  } catch {
    // Ignore if not exists
  }
}

async function testAnalyzer(client: any, testCase: TestCase): Promise<boolean> {
  try {
    const result = await client.indices.analyze({
      index: TEST_INDEX,
      body: {
        analyzer: testCase.analyzer,
        text: testCase.text,
      },
    });
    
    const tokens = result.tokens?.map((t: any) => t.token) || [];
    
    console.log(`📝 ${testCase.description}`);
    console.log(`   Analyzer: ${testCase.analyzer}`);
    console.log(`   Input:    "${testCase.text}"`);
    console.log(`   Tokens:   [${tokens.join(', ')}]`);
    
    if (testCase.expectedTokens) {
      const matches = JSON.stringify(tokens) === JSON.stringify(testCase.expectedTokens);
      if (matches) {
        console.log(`   ✅ Matches expected tokens`);
      } else {
        console.log(`   ❌ Expected: [${testCase.expectedTokens.join(', ')}]`);
        return false;
      }
    }
    
    console.log('');
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to test "${testCase.text}" with ${testCase.analyzer}:`, error.message);
    return false;
  }
}

async function testICUPluginDirectly(client: any): Promise<boolean> {
  console.log('🔍 Testing ICU Plugin Directly...\n');
  
  try {
    // Test ICU tokenizer without index
    const result = await client.indices.analyze({
      body: {
        tokenizer: 'icu_tokenizer',
        text: 'مرحبا بكم في مؤتمر الإمارات',
      },
    });
    
    const tokens = result.tokens?.map((t: any) => t.token) || [];
    console.log('   ICU Tokenizer test:');
    console.log(`   Input:  "مرحبا بكم في مؤتمر الإمارات"`);
    console.log(`   Tokens: [${tokens.join(', ')}]`);
    
    if (tokens.length > 1) {
      console.log('   ✅ ICU tokenizer is working correctly\n');
      return true;
    } else {
      console.log('   ❌ ICU tokenizer not producing expected output\n');
      return false;
    }
  } catch (error: any) {
    console.error('   ❌ ICU plugin test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('        EventVue Elasticsearch Analyzer Tests');
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Check if ES is enabled
  if (!isElasticsearchEnabled()) {
    console.error('❌ Elasticsearch is not enabled. Set ELASTICSEARCH_ENABLED=true');
    process.exit(1);
  }
  
  // Wait for ES to be ready
  console.log('⏳ Waiting for Elasticsearch...');
  const ready = await waitForElasticsearch(30000);
  if (!ready) {
    console.error('❌ Elasticsearch is not available');
    process.exit(1);
  }
  console.log('✅ Elasticsearch is ready\n');
  
  const client = await getElasticsearchClient();
  
  // Test ICU plugin first
  const icuWorks = await testICUPluginDirectly(client);
  if (!icuWorks) {
    console.error('❌ ICU plugin is not working. Make sure it is installed.');
    process.exit(1);
  }
  
  // Create test index with our analyzers
  const indexCreated = await createTestIndex(client);
  if (!indexCreated) {
    process.exit(1);
  }
  
  // Run all test cases
  console.log('═══════════════════════════════════════════════════════');
  console.log('                  Running Analyzer Tests');
  console.log('═══════════════════════════════════════════════════════\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    const success = await testAnalyzer(client, testCase);
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }
  
  // Cleanup
  await deleteTestIndex(client);
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                      Test Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Total:  ${testCases.length}`);
  console.log('═══════════════════════════════════════════════════════\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
