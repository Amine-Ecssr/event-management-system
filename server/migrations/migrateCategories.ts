import "../config/loadEnv";
import { db } from '../db';
import { events, categories } from '@shared/schema.mssql';
import { eq, isNotNull, sql } from 'drizzle-orm';

/**
 * Migration script to move category data from events table to categories table
 * and update events.categoryId foreign key
 */
async function migrateCategories() {
  console.log('[Category Migration] Starting migration...');
  
  try {
    // Get all unique categories from existing events
    const existingEvents = await db
      .select({
        category: events.category,
        categoryAr: events.categoryAr,
      })
      .from(events)
      .where(isNotNull(events.category));

    // Create a map of unique categories
    const categoryMap = new Map<string, string | null>();
    
    for (const event of existingEvents) {
      if (event.category && !categoryMap.has(event.category)) {
        categoryMap.set(event.category, event.categoryAr || null);
      }
    }

    console.log(`[Category Migration] Found ${categoryMap.size} unique categories`);

    // Insert categories into the categories table
    const categoryIdMap = new Map<string, number>();
    
    const categoryEntries = Array.from(categoryMap.entries());
    for (const [nameEn, nameAr] of categoryEntries) {
      // Check if category already exists
      const [existing] = await db
        .select()
        .from(categories)
        .where(eq(categories.nameEn, nameEn))
        .offset(1);

      if (existing) {
        categoryIdMap.set(nameEn, existing.id);
        console.log(`[Category Migration] Category "${nameEn}" already exists with ID ${existing.id}`);
        
        // Update Arabic name if provided and different
        if (nameAr && existing.nameAr !== nameAr) {
          await db
            .update(categories)
            .set({ nameAr })
            .where(eq(categories.id, existing.id));
          console.log(`[Category Migration] Updated Arabic name for "${nameEn}"`);
        }
      } else {
        const [newCategory] = await db
          .insert(categories)
          .values({ nameEn, nameAr: nameAr || undefined })
          .returning();
        
        categoryIdMap.set(nameEn, newCategory.id);
        console.log(`[Category Migration] Created category "${nameEn}" with ID ${newCategory.id}`);
      }
    }

    // Update all events to set categoryId based on their category field
    console.log('[Category Migration] Updating events with categoryId...');
    let updatedCount = 0;

    const categoryIdEntries = Array.from(categoryIdMap.entries());
    for (const [categoryName, categoryId] of categoryIdEntries) {
      const result = await db
        .update(events)
        .set({ categoryId })
        .where(eq(events.category, categoryName));
      
      updatedCount++;
    }

    console.log(`[Category Migration] Updated ${updatedCount} category mappings in events`);
    console.log('[Category Migration] Migration completed successfully!');
    
    // Display summary
    const allCategories = await db.select().from(categories);
    console.log('\n=== Categories Summary ===');
    for (const cat of allCategories) {
      console.log(`  ${cat.id}: ${cat.nameEn} (${cat.nameAr || 'no Arabic'})`);
    }
    
  } catch (error) {
    console.error('[Category Migration] Error during migration:', error);
    throw error;
  }
}

// Run migration
migrateCategories()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });

export { migrateCategories };
