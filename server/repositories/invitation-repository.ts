/**
 * Invitation Repository (MSSQL version)
 * Handles event invitees and email templates
 */
import { BaseRepository } from './base';
import { 
  eventInvitees, contacts, organizations, positions, countries, events,
  emailTemplates, eventCustomEmails,
  type EventInvitee, type InsertEventInvitee, type UpdateEventInvitee,
  type Contact, type Organization, type Position, type Country, type Event,
  type EmailTemplate,
  type EventCustomEmail, type InsertEventCustomEmail, type UpdateEventCustomEmail
} from '@shared/schema.mssql';
import { eq, and, desc } from 'drizzle-orm';

export class InvitationRepository extends BaseRepository {

  /* ---------------------------------------------------------
   * EVENT INVITEES
   * --------------------------------------------------------- */

  async getEventInvitees(eventId: string) {
    const rows = await this.db
      .select({
        eventInvitee: eventInvitees,
        contact: contacts,
        organization: organizations,
        position: positions,
        country: countries,
      })
      .from(eventInvitees)
      .innerJoin(contacts, eq(eventInvitees.contactId, contacts.id))
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .leftJoin(positions, eq(contacts.positionId, positions.id))
      .leftJoin(countries, eq(contacts.countryId, countries.id))
      .where(eq(eventInvitees.eventId, eventId))
      .orderBy(desc(eventInvitees.invitedAt));

    return rows.map(({ eventInvitee, contact, organization, position, country }: {
      eventInvitee: EventInvitee;
      contact: Contact;
      organization: Organization | null;
      position: Position | null;
      country: Country | null;
    }) => ({
      ...eventInvitee,
      contact: {
        ...contact,
        organization: organization || undefined,
        position: position || undefined,
        country: country || undefined,
      },
    }));
  }

  async addEventInvitee(data: InsertEventInvitee): Promise<EventInvitee> {
    const [invitee] = await this.db.insert(eventInvitees).values(data).returning();
    return invitee;
  }

  async updateEventInvitee(eventId: string, contactId: number, data: UpdateEventInvitee) {
    // MSSQL: update().returning() not supported
    await this.db
      .update(eventInvitees)
      .set(data)
      .where(and(eq(eventInvitees.eventId, eventId), eq(eventInvitees.contactId, contactId)));

    const [invitee] = await this.db
      .select()
      .from(eventInvitees)
      .where(and(eq(eventInvitees.eventId, eventId), eq(eventInvitees.contactId, contactId)));

    return invitee;
  }

  async removeEventInvitee(eventId: string, contactId: number): Promise<boolean> {
    // MSSQL: delete().returning() not supported
    const result = await this.db
      .delete(eventInvitees)
      .where(and(eq(eventInvitees.eventId, eventId), eq(eventInvitees.contactId, contactId)));

    return result.rowsAffected > 0;
  }

  async getContactInvitedEvents(contactId: number): Promise<Event[]> {
    const rows = await this.db
      .select({ event: events })
      .from(eventInvitees)
      .innerJoin(events, eq(eventInvitees.eventId, events.id))
      .where(eq(eventInvitees.contactId, contactId))
      .orderBy(desc(events.startDate));

    return rows.map((r: { event: any; }) => r.event);
  }

  /* ---------------------------------------------------------
   * EMAIL TEMPLATES
   * --------------------------------------------------------- */

  async getEmailTemplate(type: string, language: string): Promise<EmailTemplate | undefined> {
    const [template] = await this.db
      .select()
      .from(emailTemplates)
      .where(and(eq(emailTemplates.type, type), eq(emailTemplates.language, language)))
      .limit(1);

    return template;
  }

  /* ---------------------------------------------------------
   * EVENT CUSTOM EMAILS
   * --------------------------------------------------------- */

  async getEventCustomEmail(eventId: string): Promise<EventCustomEmail | undefined> {
    const [customEmail] = await this.db
      .select()
      .from(eventCustomEmails)
      .where(and(eq(eventCustomEmails.eventId, eventId), eq(eventCustomEmails.isActive, true)))
      .limit(1);

    return customEmail;
  }

  async createEventCustomEmail(data: InsertEventCustomEmail): Promise<EventCustomEmail> {
    // Deactivate existing active custom emails
    await this.db
      .update(eventCustomEmails)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(eventCustomEmails.eventId, data.eventId), eq(eventCustomEmails.isActive, true)));

    // Insert new custom email (INSERT returning works)
    const [customEmail] = await this.db.insert(eventCustomEmails).values(data).returning();
    return customEmail;
  }

  async updateEventCustomEmail(id: number, data: UpdateEventCustomEmail) {
    // MSSQL: update().returning() not supported
    await this.db
      .update(eventCustomEmails)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(eventCustomEmails.id, id));

    const [updated] = await this.db
      .select()
      .from(eventCustomEmails)
      .where(eq(eventCustomEmails.id, id));

    return updated;
  }

  async deleteEventCustomEmail(id: number): Promise<boolean> {
    // MSSQL: delete().returning() not supported
    const result = await this.db
      .delete(eventCustomEmails)
      .where(eq(eventCustomEmails.id, id));

    return result.rowsAffected > 0;
  }
}
