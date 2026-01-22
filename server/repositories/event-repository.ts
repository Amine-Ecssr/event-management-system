/**
 * Event Repository
 * Handles all event-related database operations
 */
import { BaseRepository } from './base';
import { 
  events, categories, eventAttendees, contacts, organizations, positions, countries,
  type Event, type InsertEvent, type EventAttendee, type Contact, type Organization, type Position, type Country
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export class EventRepository extends BaseRepository {
  async getAllEvents(): Promise<Event[]> {
    const eventsWithCategories = await this.db
      .select({
        event: events,
        category: categories,
      })
      .from(events)
      .leftJoin(categories, eq(events.categoryId, categories.id))
      .orderBy(events.startDate);

    // Map the results to include category names
    return eventsWithCategories.map(({ event, category }) => ({
      ...event,
      category: category?.nameEn || event.category,
      categoryAr: category?.nameAr || event.categoryAr,
    }));
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const result = await this.db
      .select({
        event: events,
        category: categories,
      })
      .from(events)
      .leftJoin(categories, eq(events.categoryId, categories.id))
      .where(eq(events.id, id))
      .limit(1);

    if (result.length === 0) return undefined;

    const { event, category } = result[0];
    return {
      ...event,
      category: category?.nameEn || event.category,
      categoryAr: category?.nameAr || event.categoryAr,
    };
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await this.db
      .insert(events)
      .values(insertEvent)
      .returning();
    return event;
  }

  async updateEvent(id: string, updateData: Partial<InsertEvent>): Promise<Event | undefined> {
    const [event] = await this.db
      .update(events)
      .set(updateData)
      .where(eq(events.id, id))
      .returning();
    return event || undefined;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const result = await this.db
      .delete(events)
      .where(eq(events.id, id))
      .returning();
    return result.length > 0;
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

  async getEventAttendees(eventId: string): Promise<Array<EventAttendee & { contact: Contact & { organization?: Organization; position?: Position; country?: Country } }>> {
    const attendeeRecords = await this.db
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

    return attendeeRecords.map(record => ({
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
