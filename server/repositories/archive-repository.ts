/**
 * Archive Repository
 * Handles all archive-related database operations
 */
import { BaseRepository } from './base';
import { 
  archivedEvents, archiveMedia, events, archivedEventSpeakers, eventMedia,
  type ArchivedEvent, type InsertArchivedEvent, type UpdateArchivedEvent,
  type ArchiveMedia, type InsertArchiveMedia,
  type ArchivedEventSpeaker, type InsertArchivedEventSpeaker
} from '@shared/schema';
import { eq, and, gte, lte, or, like, desc, asc, count, inArray } from 'drizzle-orm';

export class ArchiveRepository extends BaseRepository {
  async getAllArchivedEvents(options?: {
    page?: number;
    limit?: number;
    year?: number;
    categoryId?: number;
    search?: string;
    speakerId?: number;
  }): Promise<{ events: ArchivedEvent[]; total: number; page: number; limit: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 12;
    const offset = (page - 1) * limit;

    const buildWhereCondition = () => {
      const conditions = [];
      
      if (options?.year) {
        const yearStart = `${options.year}-01-01`;
        const yearEnd = `${options.year}-12-31`;
        conditions.push(and(
          gte(archivedEvents.startDate, yearStart),
          lte(archivedEvents.startDate, yearEnd)
        ));
      }

      if (options?.categoryId) {
        conditions.push(eq(archivedEvents.categoryId, options.categoryId));
      }

      if (options?.speakerId) {
        conditions.push(inArray(archivedEvents.id, 
          this.db.select({ id: archivedEventSpeakers.archivedEventId })
            .from(archivedEventSpeakers)
            .where(eq(archivedEventSpeakers.contactId, options.speakerId))
        ));
      }

      if (options?.search) {
        const searchPattern = `%${options.search}%`;
        conditions.push(or(
          like(archivedEvents.name, searchPattern),
          like(archivedEvents.nameAr, searchPattern),
          like(archivedEvents.description, searchPattern),
          like(archivedEvents.descriptionAr, searchPattern),
          like(archivedEvents.highlights, searchPattern),
          like(archivedEvents.highlightsAr, searchPattern)
        ));
      }

      if (conditions.length === 0) return undefined;
      if (conditions.length === 1) return conditions[0];
      return and(...conditions);
    };

    const whereCondition = buildWhereCondition();

    const eventsResult = whereCondition 
      ? await this.db.select().from(archivedEvents).where(whereCondition).orderBy(desc(archivedEvents.startDate)).limit(limit).offset(offset)
      : await this.db.select().from(archivedEvents).orderBy(desc(archivedEvents.startDate)).limit(limit).offset(offset);
    
    const countResult = whereCondition
      ? await this.db.select({ count: count() }).from(archivedEvents).where(whereCondition)
      : await this.db.select({ count: count() }).from(archivedEvents);

    const eventIds = eventsResult.map(e => e.id);
    const allSpeakers = eventIds.length > 0 
      ? await this.db.select().from(archivedEventSpeakers).where(inArray(archivedEventSpeakers.archivedEventId, eventIds))
      : [];

    const speakersByEventId = allSpeakers.reduce((acc, speaker) => {
      if (!acc[speaker.archivedEventId]) {
        acc[speaker.archivedEventId] = [];
      }
      acc[speaker.archivedEventId].push(speaker);
      return acc;
    }, {} as Record<number, typeof allSpeakers>);

    const eventsWithSpeakers = eventsResult.map(event => ({
      ...event,
      speakers: speakersByEventId[event.id] || [],
    }));

    return {
      events: eventsWithSpeakers,
      total: countResult[0]?.count || 0,
      page,
      limit,
    };
  }

  async getArchivedEvent(id: number): Promise<ArchivedEvent | undefined> {
    const [event] = await this.db
      .select()
      .from(archivedEvents)
      .where(eq(archivedEvents.id, id));
    return event || undefined;
  }

  async getArchivedEventByOriginalId(eventId: string): Promise<ArchivedEvent | undefined> {
    const [event] = await this.db
      .select()
      .from(archivedEvents)
      .where(eq(archivedEvents.originalEventId, eventId));
    return event || undefined;
  }

  async createArchivedEvent(data: InsertArchivedEvent): Promise<ArchivedEvent> {
    const [event] = await this.db
      .insert(archivedEvents)
      .values(data)
      .returning();
    return event;
  }

  async updateArchivedEvent(id: number, data: UpdateArchivedEvent): Promise<ArchivedEvent | undefined> {
    const [event] = await this.db
      .update(archivedEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(archivedEvents.id, id))
      .returning();
    return event || undefined;
  }

  async deleteArchivedEvent(id: number): Promise<boolean> {
    const archivedEvent = await this.db
      .select()
      .from(archivedEvents)
      .where(eq(archivedEvents.id, id))
      .limit(1);
    
    if (archivedEvent.length === 0) {
      return false;
    }

    if (archivedEvent[0].originalEventId) {
      await this.db
        .update(events)
        .set({ isArchived: false })
        .where(eq(events.id, archivedEvent[0].originalEventId));
    }

    const result = await this.db
      .delete(archivedEvents)
      .where(eq(archivedEvents.id, id))
      .returning();
    return result.length > 0;
  }

  async getArchivedEventsByYear(year: number): Promise<ArchivedEvent[]> {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    return await this.db
      .select()
      .from(archivedEvents)
      .where(and(
        gte(archivedEvents.startDate, yearStart),
        lte(archivedEvents.startDate, yearEnd)
      ))
      .orderBy(desc(archivedEvents.startDate));
  }

  async getArchivedEventsByCategory(categoryId: number): Promise<ArchivedEvent[]> {
    return await this.db
      .select()
      .from(archivedEvents)
      .where(eq(archivedEvents.categoryId, categoryId))
      .orderBy(desc(archivedEvents.startDate));
  }

  async searchArchivedEvents(query: string): Promise<ArchivedEvent[]> {
    const searchPattern = `%${query}%`;
    return await this.db
      .select()
      .from(archivedEvents)
      .where(or(
        like(archivedEvents.name, searchPattern),
        like(archivedEvents.nameAr, searchPattern),
        like(archivedEvents.description, searchPattern),
        like(archivedEvents.descriptionAr, searchPattern),
        like(archivedEvents.highlights, searchPattern),
        like(archivedEvents.highlightsAr, searchPattern)
      ))
      .orderBy(desc(archivedEvents.startDate))
      .limit(50);
  }

  async getArchiveStats(): Promise<{
    totalEvents: number;
    totalAttendees: number;
    yearsActive: number[];
    categoriesUsed: number;
    eventsWithPhotos: number;
    eventsWithVideos: number;
  }> {
    const allEvents = await this.db.select().from(archivedEvents);
    
    const totalEvents = allEvents.length;
    const totalAttendees = allEvents.reduce((sum, e) => sum + (e.actualAttendees || 0), 0);
    
    const yearsSet = new Set<number>();
    allEvents.forEach(e => {
      const year = new Date(e.startDate).getFullYear();
      yearsSet.add(year);
    });
    const yearsActive = Array.from(yearsSet).sort((a, b) => b - a);
    
    const categoriesSet = new Set<number>();
    allEvents.forEach(e => {
      if (e.categoryId) categoriesSet.add(e.categoryId);
    });
    const categoriesUsed = categoriesSet.size;
    
    const eventsWithPhotos = allEvents.filter(e => e.photoKeys && e.photoKeys.length > 0).length;
    const eventsWithVideos = allEvents.filter(e => e.youtubeVideoIds && e.youtubeVideoIds.length > 0).length;
    
    return {
      totalEvents,
      totalAttendees,
      yearsActive,
      categoriesUsed,
      eventsWithPhotos,
      eventsWithVideos,
    };
  }

  async getArchiveTimeline(): Promise<Array<{ year: number; month: number; count: number }>> {
    const allEvents = await this.db.select().from(archivedEvents);
    
    const timeline = new Map<string, number>();
    allEvents.forEach(e => {
      const date = new Date(e.startDate);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      timeline.set(key, (timeline.get(key) || 0) + 1);
    });
    
    return Array.from(timeline.entries())
      .map(([key, count]) => {
        const [year, month] = key.split('-').map(Number);
        return { year, month, count };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
  }

  async getArchiveYears(): Promise<number[]> {
    const allEvents = await this.db.select().from(archivedEvents);
    const yearsSet = new Set<number>();
    allEvents.forEach(e => {
      const year = new Date(e.startDate).getFullYear();
      yearsSet.add(year);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }

  async unarchiveEvent(archivedEventId: number): Promise<boolean> {
    const archivedEvent = await this.getArchivedEvent(archivedEventId);
    if (!archivedEvent) {
      return false;
    }
    
    if (archivedEvent.originalEventId) {
      await this.db
        .update(events)
        .set({ isArchived: false, archivedAt: null })
        .where(eq(events.id, archivedEvent.originalEventId));
    }
    
    return await this.deleteArchivedEvent(archivedEventId);
  }

  // Archive Media operations
  async getArchiveMedia(archivedEventId: number): Promise<ArchiveMedia[]> {
    return await this.db
      .select()
      .from(archiveMedia)
      .where(eq(archiveMedia.archivedEventId, archivedEventId))
      .orderBy(asc(archiveMedia.displayOrder));
  }

  async createArchiveMedia(data: InsertArchiveMedia): Promise<ArchiveMedia> {
    const [media] = await this.db
      .insert(archiveMedia)
      .values(data)
      .returning();
    return media;
  }

  async updateArchiveMedia(id: number, data: Partial<InsertArchiveMedia>): Promise<ArchiveMedia | undefined> {
    const [media] = await this.db
      .update(archiveMedia)
      .set(data)
      .where(eq(archiveMedia.id, id))
      .returning();
    return media || undefined;
  }

  async deleteArchiveMedia(id: number): Promise<boolean> {
    const result = await this.db
      .delete(archiveMedia)
      .where(eq(archiveMedia.id, id))
      .returning();
    return result.length > 0;
  }

  async reorderArchiveMedia(archivedEventId: number, mediaIds: number[]): Promise<void> {
    for (let i = 0; i < mediaIds.length; i++) {
      await this.db
        .update(archiveMedia)
        .set({ displayOrder: i })
        .where(and(
          eq(archiveMedia.id, mediaIds[i]),
          eq(archiveMedia.archivedEventId, archivedEventId)
        ));
    }
  }

  // Archived Event Speaker operations
  async getArchivedEventSpeakers(archivedEventId: number): Promise<ArchivedEventSpeaker[]> {
    return await this.db
      .select()
      .from(archivedEventSpeakers)
      .where(eq(archivedEventSpeakers.archivedEventId, archivedEventId))
      .orderBy(asc(archivedEventSpeakers.displayOrder));
  }

  async addArchivedEventSpeaker(data: InsertArchivedEventSpeaker): Promise<ArchivedEventSpeaker> {
    const [speaker] = await this.db.insert(archivedEventSpeakers).values(data).returning();
    return speaker;
  }

  async removeArchivedEventSpeaker(id: number): Promise<boolean> {
    const result = await this.db
      .delete(archivedEventSpeakers)
      .where(eq(archivedEventSpeakers.id, id))
      .returning();
    return result.length > 0;
  }
}
