/**
 * Event Repository (MSSQL version)
 * Handles all event-related database operations
 */
import { BaseRepository } from './base';
import { 
  events, categories, eventAttendees, contacts, organizations, positions, countries,
  type Event, type InsertEvent, type EventAttendee, type Contact, type Organization, type Position, type Country
} from '@shared/schema.mssql';
import { eq } from 'drizzle-orm';

export class EventRepository extends BaseRepository {

  async getAllEvents(): Promise<Event[]> {
    const rows = await this.db
      .select({
        event: events,
        category: categories,
      })
      .from(events)
      .leftJoin(categories, eq(events.categoryId, categories.id))
      .orderBy(events.startDate);

    return rows.map(({ event, category }: { event: Event; category: typeof categories.$inferSelect | null }) => ({
      ...event,
      category: category?.nameEn || event.category,
      categoryAr: category?.nameAr || event.categoryAr,
    }));
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const rows = await this.db
      .select({
        event: events,
        category: categories,
      })
      .from(events)
      .leftJoin(categories, eq(events.categoryId, categories.id))
      .where(eq(events.id, id))
      .offset(1);

    if (rows.length === 0) return undefined;

    const { event, category }: { event: Event; category: typeof categories.$inferSelect | null } = rows[0];
    return {
      ...event,
      category: category?.nameEn || event.category,
      categoryAr: category?.nameAr || event.categoryAr,
    };
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    // INSERT returning works on MSSQL
    const [event] = await this.db
      .insert(events)
      .values(insertEvent)
      .returning();

    return event;
  }

  async updateEvent(id: string, updateData: Partial<InsertEvent>): Promise<Event | undefined> {
    // MSSQL: update().returning() is not supported
    await this.db
      .update(events)
      .set(updateData)
      .where(eq(events.id, id));

    // Re-select updated row
    const [event] = await this.db
      .select()
      .from(events)
      .where(eq(events.id, id));

    return event;
  }

  async deleteEvent(id: string): Promise<boolean> {
    // MSSQL: delete().returning() is not supported
    const result = await this.db
      .delete(events)
      .where(eq(events.id, id));

    return result.rowsAffected > 0;
  }

  async deleteAllEvents(): Promise<void> {
    await this.db.delete(events);
  }

  async markEventAsArchived(eventId: string): Promise<void> {
    await this.db
      .update(events)
      .set({ isArchived: true, archivedAt: new Date() })
      .where(eq(events.id, eventId));
  }

  async getEventAttendees(eventId: string): Promise<
    Array<EventAttendee & { 
      contact: Contact & { 
        organization?: Organization; 
        position?: Position; 
        country?: Country 
      } 
    }>
  > {
    const rows = await this.db
      .select({
        attendee: eventAttendees,
        contact: contacts,
        organization: organizations,
        position: positions,
        country: countries,
      })
      .from(eventAttendees)
      .innerJoin(contacts, eq(eventAttendees.contactId, contacts.id))
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .leftJoin(positions, eq(contacts.positionId, positions.id))
      .leftJoin(countries, eq(contacts.countryId, countries.id))
      .where(eq(eventAttendees.eventId, eventId))
      .orderBy(contacts.nameEn);

    return rows.map((record: { attendee: any; contact: any; organization: any; position: any; country: any; }) => ({
      ...record.attendee,
      contact: {
        ...record.contact,
        organization: record.organization || undefined,
        position: record.position || undefined,
        country: record.country || undefined,
      },
    }));
  }
}
