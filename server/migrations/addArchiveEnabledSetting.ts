import "../config/loadEnv";
import { db } from "../db";
import { settings } from "@shared/schema";
import { sql } from "drizzle-orm";

async function addArchiveEnabledSetting() {
  console.log('[Migration] Adding archive_enabled column to settings...');

  // Add column with default true if it doesn't exist
  await db.execute(sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS archive_enabled boolean NOT NULL DEFAULT true`);

  // Ensure existing row has archiveEnabled set to true
  const [current] = await db.select().from(settings).limit(1);
  if (current && (current as any).archiveEnabled === null) {
    await db.update(settings).set({ archiveEnabled: true }).where(sql`1=1`);
  }

  console.log('[Migration] archive_enabled column ensured.');
}

addArchiveEnabledSetting()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed', error);
    process.exit(1);
  });
