/**
 * Archive Repository (MSSQL version)
 * Handles all archive-related database operations
 */
import { BaseRepository } from './base';
import { 
  archivedEvents, archiveMedia, events, archivedEventSpeakers, eventMedia,
  type ArchivedEvent, type InsertArchivedEvent, type UpdateArchivedEvent,
  type ArchiveMedia, type InsertArchiveMedia,
  type ArchivedEventSpeaker, type InsertArchivedEventSpeaker
} from '@shared/schema.mssql';
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
        const yearStart = new Date(`${options.year}-01-01`);
        const yearEnd = new Date(`${options.year}-12-31`);
        conditions.push(and(
          gte(archivedEvents.startDate, yearStart),
          lte(archivedEvents.startDate, yearEnd)
        ));
      }

      if (options?.categoryId) {
        conditions.push(eq(archivedEvents.categoryId, options.categoryId));
      }

      if (options?.speakerId) {
        conditions.push(
          inArray(
            archivedEvents.id,
            this.db
              .select({ id: archivedEventSpeakers.archivedEventId })
              .from(archivedEventSpeakers)
              .where(eq(archivedEventSpeakers.contactId, options.speakerId))
          )
        );
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

    const eventIds = eventsResult.map((e: { id: any; }) => e.id);

    const allSpeakers = eventIds.length > 0
      ? await this.db.select().from(archivedEventSpeakers).where(inArray(archivedEventSpeakers.archivedEventId, eventIds))
      : [];

    const speakersByEventId = allSpeakers.reduce((acc: { [x: string]: any[]; }, speaker: { archivedEventId: string | number; }) => {
      if (!acc[speaker.archivedEventId]) acc[speaker.archivedEventId] = [];
      acc[speaker.archivedEventId].push(speaker);
      return acc;
    }, {} as Record<number, typeof allSpeakers>);

    const eventsWithSpeakers = eventsResult.map((event: { id: string | number; }) => ({
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
    return event;
  }

  async getArchivedEventByOriginalId(eventId: string): Promise<ArchivedEvent | undefined> {
    const [event] = await this.db
      .select()
      .from(archivedEvents)
      .where(eq(archivedEvents.originalEventId, eventId));
    return event;
  }

  async createArchivedEvent(data: InsertArchivedEvent): Promise<ArchivedEvent> {
    const [event] = await this.db
      .insert(archivedEvents)
      .values(data)
      .returning(); // INSERT returning works in MSSQL
    return event;
  }

  async updateArchivedEvent(id: number, data: UpdateArchivedEvent): Promise<ArchivedEvent | undefined> {
    await this.db
      .update(archivedEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(archivedEvents.id, id));

    return this.getArchivedEvent(id);
  }

  async deleteArchivedEvent(id: number): Promise<boolean> {
    const existing = await this.getArchivedEvent(id);
    if (!existing) return false;

    if (existing.originalEventId) {
      await this.db
        .update(events)
        .set({ isArchived: false })
        .where(eq(events.id, existing.originalEventId));
    }

    const result = await this.db
      .delete(archivedEvents)
      .where(eq(archivedEvents.id, id));

    return result.rowsAffected > 0;
  }

  async getArchivedEventsByYear(year: number): Promise<ArchivedEvent[]> {
    const yearStart = new Date(`${year}-01-01`);
    const yearEnd = new Date(`${year}-12-31`);

    return this.db
      .select()
      .from(archivedEvents)
      .where(and(
        gte(archivedEvents.startDate, yearStart),
        lte(archivedEvents.startDate, yearEnd)
      ))
      .orderBy(desc(archivedEvents.startDate));
  }

  async getArchivedEventsByCategory(categoryId: number): Promise<ArchivedEvent[]> {
    return this.db
      .select()
      .from(archivedEvents)
      .where(eq(archivedEvents.categoryId, categoryId))
      .orderBy(desc(archivedEvents.startDate));
  }

  async searchArchivedEvents(query: string): Promise<ArchivedEvent[]> {
    const searchPattern = `%${query}%`;

    return this.db
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

  async getArchiveStats() {
    const allEvents = await this.db.select().from(archivedEvents);

    const totalEvents = allEvents.length;
    const totalAttendees = allEvents.reduce((sum: any, e: { actualAttendees: any; }) => sum + (e.actualAttendees || 0), 0);

    const yearsActive = Array.from(
      new Set(allEvents.map((e: { startDate: string | number | Date; }) => new Date(e.startDate).getFullYear()))
    ).sort((a: any, b: any) => b - a);

    const categoriesUsed = new Set(
      allEvents.map((e: { categoryId: any; }) => e.categoryId).filter(Boolean)
    ).size;

    const eventsWithPhotos = allEvents.filter((e: { photoKeys: string | any[]; }) => e.photoKeys?.length).length;
    const eventsWithVideos = allEvents.filter((e: { youtubeVideoIds: any[]; }) => e.youtubeVideoIds?.length).length;

    return {
      totalEvents,
      totalAttendees,
      yearsActive,
      categoriesUsed,
      eventsWithPhotos,
      eventsWithVideos,
    };
  }

  async getArchiveTimeline() {
    const allEvents = await this.db.select().from(archivedEvents);

    const timeline = new Map<string, number>();

    allEvents.forEach((e: { startDate: string | number | Date; }) => {
      const d = new Date(e.startDate);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      timeline.set(key, (timeline.get(key) || 0) + 1);
    });

    return Array.from(timeline.entries())
      .map(([key, count]) => {
        const [year, month] = key.split('-').map(Number);
        return { year, month, count };
      })
      .sort((a, b) => a.year === b.year ? a.month - b.month : a.year - b.year);
  }

  async getArchiveYears(): Promise<number[] | unknown[]> {
    const allEvents = await this.db.select().from(archivedEvents);

    return Array.from(
      new Set(allEvents.map((e: { startDate: string | number | Date; }) => new Date(e.startDate).getFullYear()))
    ).sort((a, b) => (b as number) - (a as number));
  }

  async unarchiveEvent(archivedEventId: number): Promise<boolean> {
    const archivedEvent = await this.getArchivedEvent(archivedEventId);
    if (!archivedEvent) return false;

    if (archivedEvent.originalEventId) {
      await this.db
        .update(events)
        .set({ isArchived: false, archivedAt: null })
        .where(eq(events.id, archivedEvent.originalEventId));
    }

    return this.deleteArchivedEvent(archivedEventId);
  }

  // Archive Media operations
  async getArchiveMedia(archivedEventId: number): Promise<ArchiveMedia[]> {
    return this.db
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
    await this.db
      .update(archiveMedia)
      .set(data)
      .where(eq(archiveMedia.id, id));

    const [media] = await this.db
      .select()
      .from(archiveMedia)
      .where(eq(archiveMedia.id, id));

    return media;
  }

  async deleteArchiveMedia(id: number): Promise<boolean> {
    const result = await this.db
      .delete(archiveMedia)
      .where(eq(archiveMedia.id, id));

    return result.rowsAffected > 0;
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
    return this.db
      .select()
      .from(archivedEventSpeakers)
      .where(eq(archivedEventSpeakers.archivedEventId, archivedEventId))
      .orderBy(asc(archivedEventSpeakers.displayOrder));
  }

  async addArchivedEventSpeaker(data: InsertArchivedEventSpeaker): Promise<ArchivedEventSpeaker> {
    const [speaker] = await this.db
      .insert(archivedEventSpeakers)
      .values(data)
      .returning();
    return speaker;
  }

  async removeArchivedEventSpeaker(id: number): Promise<boolean> {
    const result = await this.db
      .delete(archivedEventSpeakers)
      .where(eq(archivedEventSpeakers.id, id));

    return result.rowsAffected > 0;
  }
}
