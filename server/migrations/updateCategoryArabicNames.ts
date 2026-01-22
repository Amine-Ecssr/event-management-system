import "../config/loadEnv";
import { drizzle } from 'drizzle-orm/node-postgres';
import { categories } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import pg from 'pg';

const { Pool } = pg;

async function updateCategoryArabicNames() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  console.log('[Category Arabic Names] Starting update...');

  // Define category mappings with Arabic translations
  const categoryMappings = [
    { nameEn: 'Social Development', nameAr: 'التنمية الاجتماعية' },
    { nameEn: 'Energy and Environment', nameAr: 'الطاقة والبيئة' },
    { nameEn: 'Culture and Heritage', nameAr: 'الثقافة والتراث' },
    { nameEn: 'General', nameAr: 'عام' },
  ];

  for (const mapping of categoryMappings) {
    try {
      const result = await db
        .update(categories)
        .set({ nameAr: mapping.nameAr })
        .where(eq(categories.nameEn, mapping.nameEn))
        .returning();

      if (result.length > 0) {
        console.log(`✓ Updated category '${mapping.nameEn}' with Arabic name '${mapping.nameAr}'`);
      } else {
        console.log(`⚠ Category '${mapping.nameEn}' not found`);
      }
    } catch (error) {
      console.error(`✗ Error updating category '${mapping.nameEn}':`, error);
    }
  }

  console.log('[Category Arabic Names] Update completed!');
  await pool.end();
  process.exit(0);
}

updateCategoryArabicNames().catch((error) => {
  console.error('Failed to update category Arabic names:', error);
  process.exit(1);
});
