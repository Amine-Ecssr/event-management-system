/**
 * Media Repository (MSSQL version)
 * Handles event media operations
 */
import { BaseRepository } from './base';
import { eventMedia, type EventMedia, type InsertEventMedia } from '@shared/schema.mssql';
import { eq, and, asc } from 'drizzle-orm';

export class MediaRepository extends BaseRepository {

  async getEventMedia(eventId: string): Promise<EventMedia[]> {
    return this.db
      .select()
      .from(eventMedia)
      .where(eq(eventMedia.eventId, eventId))
      .orderBy(asc(eventMedia.displayOrder));
  }

  async createEventMedia(data: InsertEventMedia): Promise<EventMedia> {
    // INSERT returning works on MSSQL
    const [media] = await this.db
      .insert(eventMedia)
      .values(data)
      .returning();

    return media;
  }

  async updateEventMedia(id: number, data: Partial<InsertEventMedia>): Promise<EventMedia | undefined> {
    // MSSQL: update().returning() is not supported
    await this.db
      .update(eventMedia)
      .set(data)
      .where(eq(eventMedia.id, id));

    // Re-select updated row
    const [media] = await this.db
      .select()
      .from(eventMedia)
      .where(eq(eventMedia.id, id));

    return media;
  }

  async deleteEventMedia(id: number): Promise<boolean> {
    // MSSQL: delete().returning() is not supported
    const result = await this.db
      .delete(eventMedia)
      .where(eq(eventMedia.id, id));

    return result.rowsAffected > 0;
  }

  async reorderEventMedia(eventId: string, mediaIds: number[]): Promise<void> {
    for (let i = 0; i < mediaIds.length; i++) {
      await this.db
        .update(eventMedia)
        .set({ displayOrder: i })
        .where(
          and(
            eq(eventMedia.id, mediaIds[i]),
            eq(eventMedia.eventId, eventId)
          )
        );
    }
  }
}
