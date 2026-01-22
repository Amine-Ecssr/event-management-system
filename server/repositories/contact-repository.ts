/**
 * Contact Repository
 * Handles contacts, speakers, organizations, positions, and related operations
 */
import { BaseRepository } from './base';
import { 
  contacts, organizations, positions, countries, eventSpeakers, eventAttendees, eventInvitees,
  archivedEvents, archivedEventSpeakers, events, categories,
  type Contact, type InsertContact, type UpdateContact,
  type Organization, type InsertOrganization,
  type Position, type InsertPosition,
  type Country,
  type EventSpeaker, type InsertEventSpeaker, type UpdateEventSpeaker,
  type EventAttendee, type InsertEventAttendee,
  type Event, type ArchivedEvent
} from '@shared/schema';
import { eq, and, or, like, desc, asc, count, sql, isNotNull, inArray } from 'drizzle-orm';

export class ContactRepository extends BaseRepository {
  // Organization operations
  async getAllOrganizations(): Promise<Array<Organization & { country?: Country }>> {
    const results = await this.db
      .select({
        organization: organizations,
        country: countries,
      })
      .from(organizations)
      .leftJoin(countries, eq(organizations.countryId, countries.id))
      .orderBy(organizations.nameEn);
    
    return results.map(({ organization, country }) => ({
      ...organization,
      country: country || undefined,
    }));
  }

  async getOrganization(id: number): Promise<(Organization & { country?: Country }) | undefined> {
    const results = await this.db
      .select({
        organization: organizations,
        country: countries,
      })
      .from(organizations)
      .leftJoin(countries, eq(organizations.countryId, countries.id))
      .where(eq(organizations.id, id));
    
    if (results.length === 0) return undefined;
    
    const { organization, country } = results[0];
    return { ...organization, country: country || undefined };
  }

  async createOrganization(data: InsertOrganization): Promise<Organization> {
    const [organization] = await this.db.insert(organizations).values(data).returning();
    return organization;
  }

  async updateOrganization(id: number, data: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [organization] = await this.db
      .update(organizations)
      .set(data)
      .where(eq(organizations.id, id))
      .returning();
    return organization || undefined;
  }

  async deleteOrganization(id: number): Promise<boolean> {
    const result = await this.db
      .delete(organizations)
      .where(eq(organizations.id, id))
      .returning();
    return result.length > 0;
  }

  async getOrganizationByName(nameEn: string): Promise<Organization | undefined> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.nameEn, nameEn))
      .limit(1);
    return org || undefined;
  }

  // Position operations
  async getAllPositions(): Promise<Position[]> {
    return await this.db.select().from(positions).orderBy(positions.nameEn);
  }

  async getPosition(id: number): Promise<Position | undefined> {
    const [position] = await this.db.select().from(positions).where(eq(positions.id, id));
    return position || undefined;
  }

  async createPosition(data: InsertPosition): Promise<Position> {
    const [position] = await this.db.insert(positions).values(data).returning();
    return position;
  }

  async updatePosition(id: number, data: Partial<InsertPosition>): Promise<Position | undefined> {
    const [position] = await this.db
      .update(positions)
      .set(data)
      .where(eq(positions.id, id))
      .returning();
    return position || undefined;
  }

  async deletePosition(id: number): Promise<boolean> {
    const result = await this.db
      .delete(positions)
      .where(eq(positions.id, id))
      .returning();
    return result.length > 0;
  }

  async getPositionByName(nameEn: string): Promise<Position | undefined> {
    const [pos] = await this.db
      .select()
      .from(positions)
      .where(eq(positions.nameEn, nameEn))
      .limit(1);
    return pos || undefined;
  }

  // Country operations (read-only)
  async getAllCountries(): Promise<Country[]> {
    return await this.db.select().from(countries).orderBy(countries.nameEn);
  }

  async getCountry(id: number): Promise<Country | undefined> {
    const [country] = await this.db.select().from(countries).where(eq(countries.id, id));
    return country || undefined;
  }

  async getCountryByCode(code: string): Promise<Country | undefined> {
    const [country] = await this.db
      .select()
      .from(countries)
      .where(eq(countries.code, code.toUpperCase()))
      .limit(1);
    return country || undefined;
  }

  // Contact operations
  async getAllContacts(options?: {
    page?: number;
    limit?: number;
    search?: string;
    organizationId?: number;
    positionId?: number;
    countryId?: number;
    isEligibleSpeaker?: boolean;
  }): Promise<{ contacts: Array<Contact & { organization?: Organization; position?: Position; country?: Country }>; total: number; page: number; limit: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const offset = (page - 1) * limit;

    const conditions = [];
    
    if (options?.search) {
      const searchPattern = `%${options.search}%`;
      conditions.push(
        or(
          like(contacts.nameEn, searchPattern),
          like(contacts.nameAr, searchPattern),
          like(contacts.email, searchPattern)
        )
      );
    }
    
    if (options?.organizationId) {
      conditions.push(eq(contacts.organizationId, options.organizationId));
    }
    
    if (options?.positionId) {
      conditions.push(eq(contacts.positionId, options.positionId));
    }
    
    if (options?.countryId) {
      conditions.push(eq(contacts.countryId, options.countryId));
    }
    
    if (options?.isEligibleSpeaker !== undefined) {
      conditions.push(eq(contacts.isEligibleSpeaker, options.isEligibleSpeaker));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ totalCount }] = await this.db
      .select({ totalCount: count() })
      .from(contacts)
      .where(whereClause);

    const results = await this.db
      .select({
        contact: contacts,
        organization: organizations,
        position: positions,
        country: countries,
      })
      .from(contacts)
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .leftJoin(positions, eq(contacts.positionId, positions.id))
      .leftJoin(countries, eq(contacts.countryId, countries.id))
      .where(whereClause)
      .orderBy(desc(contacts.createdAt))
      .limit(limit)
      .offset(offset);

    const contactsList = results.map(({ contact, organization, position, country }) => ({
      ...contact,
      organization: organization || undefined,
      position: position || undefined,
      country: country || undefined,
    }));

    return { contacts: contactsList, total: Number(totalCount), page, limit };
  }

  async getContact(id: number): Promise<(Contact & { organization?: Organization; position?: Position; country?: Country }) | undefined> {
    const results = await this.db
      .select({
        contact: contacts,
        organization: organizations,
        position: positions,
        country: countries,
      })
      .from(contacts)
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .leftJoin(positions, eq(contacts.positionId, positions.id))
      .leftJoin(countries, eq(contacts.countryId, countries.id))
      .where(eq(contacts.id, id))
      .limit(1);

    if (results.length === 0) return undefined;

    const { contact, organization, position, country } = results[0];
    return {
      ...contact,
      organization: organization || undefined,
      position: position || undefined,
      country: country || undefined,
    };
  }

  async getEligibleSpeakers(): Promise<Array<Contact & { organization?: Organization; position?: Position; country?: Country }>> {
    const results = await this.db
      .select({
        contact: contacts,
        organization: organizations,
        position: positions,
        country: countries,
      })
      .from(contacts)
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .leftJoin(positions, eq(contacts.positionId, positions.id))
      .leftJoin(countries, eq(contacts.countryId, countries.id))
      .where(eq(contacts.isEligibleSpeaker, true))
      .orderBy(contacts.nameEn);

    return results.map(({ contact, organization, position, country }) => ({
      ...contact,
      organization: organization || undefined,
      position: position || undefined,
      country: country || undefined,
    }));
  }

  async createContact(data: InsertContact): Promise<Contact> {
    const [contact] = await this.db.insert(contacts).values(data).returning();
    return contact;
  }

  async updateContact(id: number, data: UpdateContact): Promise<Contact | undefined> {
    const [contact] = await this.db
      .update(contacts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return contact || undefined;
  }

  async deleteContact(id: number): Promise<boolean> {
    const result = await this.db
      .delete(contacts)
      .where(eq(contacts.id, id))
      .returning();
    return result.length > 0;
  }

  async getContactByEmail(email: string): Promise<Contact | undefined> {
    const [contact] = await this.db
      .select()
      .from(contacts)
      .where(eq(contacts.email, email))
      .limit(1);
    return contact || undefined;
  }

  async getContactByName(nameEn: string, organizationId?: number | null): Promise<Contact | undefined> {
    const conditions = [eq(contacts.nameEn, nameEn)];
    if (organizationId) {
      conditions.push(eq(contacts.organizationId, organizationId));
    }
    const [contact] = await this.db
      .select()
      .from(contacts)
      .where(and(...conditions))
      .limit(1);
    return contact || undefined;
  }

  // Event Speaker operations
  async getEventSpeakers(eventId: string): Promise<Array<EventSpeaker & { contact: Contact & { organization?: Organization; position?: Position; country?: Country } }>> {
    const results = await this.db
      .select({
        eventSpeaker: eventSpeakers,
        contact: contacts,
        organization: organizations,
        position: positions,
        country: countries,
      })
      .from(eventSpeakers)
      .innerJoin(contacts, eq(eventSpeakers.contactId, contacts.id))
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .leftJoin(positions, eq(contacts.positionId, positions.id))
      .leftJoin(countries, eq(contacts.countryId, countries.id))
      .where(eq(eventSpeakers.eventId, eventId))
      .orderBy(asc(eventSpeakers.displayOrder));

    return results.map(({ eventSpeaker, contact, organization, position, country }) => ({
      ...eventSpeaker,
      contact: {
        ...contact,
        organization: organization || undefined,
        position: position || undefined,
        country: country || undefined,
      },
    }));
  }

  async addEventSpeaker(data: InsertEventSpeaker): Promise<EventSpeaker> {
    const [speaker] = await this.db.insert(eventSpeakers).values(data).returning();
    return speaker;
  }

  async updateEventSpeaker(id: number, data: UpdateEventSpeaker): Promise<EventSpeaker | undefined> {
    const [speaker] = await this.db
      .update(eventSpeakers)
      .set(data)
      .where(eq(eventSpeakers.id, id))
      .returning();
    return speaker || undefined;
  }

  async removeEventSpeaker(id: number): Promise<boolean> {
    const result = await this.db
      .delete(eventSpeakers)
      .where(eq(eventSpeakers.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteEventSpeakers(eventId: string): Promise<boolean> {
    await this.db
      .delete(eventSpeakers)
      .where(eq(eventSpeakers.eventId, eventId));
    return true;
  }

  async getContactEvents(contactId: number): Promise<{ events: Event[]; archivedEvents: ArchivedEvent[] }> {
    const activeEventResults = await this.db
      .select({ event: events })
      .from(eventSpeakers)
      .innerJoin(events, eq(eventSpeakers.eventId, events.id))
      .where(eq(eventSpeakers.contactId, contactId))
      .orderBy(desc(events.startDate));

    const archivedEventResults = await this.db
      .select({ archivedEvent: archivedEvents })
      .from(archivedEventSpeakers)
      .innerJoin(archivedEvents, eq(archivedEventSpeakers.archivedEventId, archivedEvents.id))
      .where(eq(archivedEventSpeakers.contactId, contactId))
      .orderBy(desc(archivedEvents.startDate));

    return {
      events: activeEventResults.map(r => r.event),
      archivedEvents: archivedEventResults.map(r => r.archivedEvent),
    };
  }

  // Event Attendee operations
  async getEventAttendees(eventId: string): Promise<Array<EventAttendee & { contact: Contact & { organization?: Organization; position?: Position; country?: Country } }>> {
    const results = await this.db
      .select({
        eventAttendee: eventAttendees,
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
      .orderBy(desc(eventAttendees.attendedAt));

    return results.map(({ eventAttendee, contact, organization, position, country }) => ({
      ...eventAttendee,
      contact: {
        ...contact,
        organization: organization || undefined,
        position: position || undefined,
        country: country || undefined,
      },
    }));
  }

  async addEventAttendee(data: InsertEventAttendee): Promise<EventAttendee> {
    const [attendee] = await this.db.insert(eventAttendees).values(data).returning();
    return attendee;
  }

  async removeEventAttendee(eventId: string, contactId: number): Promise<boolean> {
    const result = await this.db
      .delete(eventAttendees)
      .where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.contactId, contactId)))
      .returning();
    return result.length > 0;
  }

  async getContactAttendedEvents(contactId: number): Promise<Event[]> {
    const results = await this.db
      .select({ event: events })
      .from(eventAttendees)
      .innerJoin(events, eq(eventAttendees.eventId, events.id))
      .where(eq(eventAttendees.contactId, contactId))
      .orderBy(desc(events.startDate));

    return results.map(r => r.event);
  }

  // Contact Statistics
  async getContactsStatistics(limit: number): Promise<{
    totalContacts: number;
    contactsWithEvents: number;
    contactsWithoutEvents: number;
    totalEventAttendances: number;
    averageAttendancePerContact: number;
    totalInvitations: number;
    totalRSVPs: number;
    totalRegistrations: number;
    overallConversionRate: number;
    overallRegistrationRate: number;
    topAttendees: Array<{
      leadId: number;
      nameEn: string;
      nameAr: string;
      organization: string | null;
      eventsAttended: number;
      speakerAppearances: number;
      invitationsReceived: number;
      rsvpConfirmed: number;
      registrations: number;
    }>;
  }> {
    const totalContactsResult = await this.db.select({ count: sql<number>`count(*)::int` }).from(contacts);
    const totalContacts = totalContactsResult[0]?.count || 0;

    const contactsWithEventsResult = await this.db
      .select({ count: sql<number>`count(distinct ${contacts.id})::int` })
      .from(contacts)
      .leftJoin(eventAttendees, eq(contacts.id, eventAttendees.contactId))
      .leftJoin(eventSpeakers, eq(contacts.id, eventSpeakers.contactId))
      .leftJoin(eventInvitees, eq(contacts.id, eventInvitees.contactId))
      .where(or(
        isNotNull(eventAttendees.id), 
        isNotNull(eventSpeakers.id),
        isNotNull(eventInvitees.id)
      ));
    
    const contactsWithEvents = contactsWithEventsResult[0]?.count || 0;
    const contactsWithoutEvents = totalContacts - contactsWithEvents;

    const totalAttendancesResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventAttendees);
    const totalEventAttendances = totalAttendancesResult[0]?.count || 0;

    const invitationStatsResult = await this.db
      .select({ 
        totalInvitations: sql<number>`count(*)::int`,
        totalRSVPs: sql<number>`count(*) filter (where ${eventInvitees.rsvp} = true)::int`,
        totalRegistrations: sql<number>`count(*) filter (where ${eventInvitees.registered} = true)::int`
      })
      .from(eventInvitees);
    
    const totalInvitations = invitationStatsResult[0]?.totalInvitations || 0;
    const totalRSVPs = invitationStatsResult[0]?.totalRSVPs || 0;
    const totalRegistrations = invitationStatsResult[0]?.totalRegistrations || 0;
    const overallConversionRate = totalInvitations > 0 
      ? (totalRSVPs / totalInvitations) * 100 
      : 0;
    const overallRegistrationRate = totalInvitations > 0 
      ? (totalRegistrations / totalInvitations) * 100 
      : 0;

    const averageAttendancePerContact = contactsWithEvents > 0 
      ? totalEventAttendances / contactsWithEvents 
      : 0;

    const topAttendeesQuery = await this.db
      .select({
        leadId: contacts.id,
        nameEn: contacts.nameEn,
        nameAr: contacts.nameAr,
        organizationNameEn: organizations.nameEn,
        eventsAttended: sql<number>`count(distinct ${eventAttendees.id})::int`,
        speakerAppearances: sql<number>`count(distinct ${eventSpeakers.id})::int`,
        invitationsReceived: sql<number>`count(distinct ${eventInvitees.id})::int`,
        rsvpConfirmed: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.rsvp} = true)::int`,
        registrations: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.registered} = true)::int`,
      })
      .from(contacts)
      .leftJoin(eventAttendees, eq(contacts.id, eventAttendees.contactId))
      .leftJoin(eventSpeakers, eq(contacts.id, eventSpeakers.contactId))
      .leftJoin(eventInvitees, eq(contacts.id, eventInvitees.contactId))
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .groupBy(contacts.id, organizations.nameEn)
      .having(sql`count(distinct ${eventAttendees.id}) > 0`)
      .orderBy(desc(sql`count(distinct ${eventAttendees.id})`))
      .limit(limit);

    const topAttendees = topAttendeesQuery.map(row => ({
      leadId: row.leadId,
      nameEn: row.nameEn,
      nameAr: row.nameAr || '',
      organization: row.organizationNameEn || null,
      eventsAttended: row.eventsAttended,
      speakerAppearances: row.speakerAppearances,
      invitationsReceived: row.invitationsReceived,
      rsvpConfirmed: row.rsvpConfirmed,
      registrations: row.registrations,
    }));

    return {
      totalContacts,
      contactsWithEvents,
      contactsWithoutEvents,
      totalEventAttendances,
      averageAttendancePerContact,
      totalInvitations,
      totalRSVPs,
      totalRegistrations,
      overallConversionRate,
      overallRegistrationRate,
      topAttendees,
    };
  }

  // Comprehensive engagement analytics for the engagement analytics page
  async getEngagementAnalytics(): Promise<{
    engagementByCategory: Array<{
      categoryId: number;
      categoryNameEn: string;
      categoryNameAr: string | null;
      totalEvents: number;
      totalInvitees: number;
      totalRegistrations: number;
      totalRSVPs: number;
      totalAttendees: number;
      totalSpeakers: number;
      registrationRate: number;
      rsvpRate: number;
      attendanceRate: number;
      conversionRate: number;
    }>;
    engagementByMonth: Array<{
      month: number;
      year: number;
      totalEvents: number;
      totalInvitees: number;
      totalRegistrations: number;
      totalRSVPs: number;
      totalAttendees: number;
    }>;
    conversionFunnel: {
      invited: number;
      emailsSent: number;
      registered: number;
      rsvped: number;
      attended: number;
      emailSentRate: number;
      registrationRate: number;
      rsvpRate: number;
      attendanceRate: number;
      overallConversion: number;
    };
    topPerformingEvents: Array<{
      eventId: string;
      eventName: string;
      eventNameAr: string | null;
      eventDate: string;
      categoryName: string | null;
      categoryNameAr: string | null;
      totalInvitees: number;
      totalAttendees: number;
      attendanceRate: number;
    }>;
    engagementTiers: {
      highly_engaged: number;
      moderately_engaged: number;
      low_engaged: number;
      not_engaged: number;
    };
    geographicEngagement: Array<{
      countryCode: string;
      countryNameEn: string;
      countryNameAr: string | null;
      uniqueContacts: number;
      totalInvitations: number;
      totalAttendances: number;
    }>;
    eventTypeEngagement: Array<{
      eventType: string | null;
      eventScope: string | null;
      totalEvents: number;
      totalInvitees: number;
      totalAttendees: number;
      averageAttendance: number;
      attendanceRate: number;
    }>;
  }> {
    // 1. Engagement by Category
    const engagementByCategory = await this.db
      .select({
        categoryId: categories.id,
        categoryNameEn: categories.nameEn,
        categoryNameAr: categories.nameAr,
        totalEvents: sql<number>`count(distinct ${events.id})::int`,
        totalInvitees: sql<number>`count(distinct ${eventInvitees.id})::int`,
        totalRegistrations: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.registered} = true)::int`,
        totalRSVPs: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.rsvp} = true)::int`,
        totalAttendees: sql<number>`count(distinct ${eventAttendees.id})::int`,
        totalSpeakers: sql<number>`count(distinct ${eventSpeakers.id})::int`,
      })
      .from(categories)
      .leftJoin(events, eq(categories.id, events.categoryId))
      .leftJoin(eventInvitees, eq(events.id, eventInvitees.eventId))
      .leftJoin(eventAttendees, eq(events.id, eventAttendees.eventId))
      .leftJoin(eventSpeakers, eq(events.id, eventSpeakers.eventId))
      .groupBy(categories.id, categories.nameEn, categories.nameAr)
      .having(sql`count(distinct ${events.id}) > 0`)
      .orderBy(desc(sql`count(distinct ${eventAttendees.id})`));

    const categoryMetrics = engagementByCategory.map(cat => ({
      ...cat,
      registrationRate: cat.totalInvitees > 0 ? (cat.totalRegistrations / cat.totalInvitees) * 100 : 0,
      rsvpRate: cat.totalInvitees > 0 ? (cat.totalRSVPs / cat.totalInvitees) * 100 : 0,
      attendanceRate: cat.totalInvitees > 0 ? (cat.totalAttendees / cat.totalInvitees) * 100 : 0,
      conversionRate: cat.totalRegistrations > 0 ? (cat.totalAttendees / cat.totalRegistrations) * 100 : 0,
    }));

    // 2. Engagement by Month (Seasonal Trends)
    const engagementByMonth = await this.db
      .select({
        month: sql<number>`extract(month from ${events.startDate})::int`,
        year: sql<number>`extract(year from ${events.startDate})::int`,
        totalEvents: sql<number>`count(distinct ${events.id})::int`,
        totalInvitees: sql<number>`count(distinct ${eventInvitees.id})::int`,
        totalRegistrations: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.registered} = true)::int`,
        totalRSVPs: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.rsvp} = true)::int`,
        totalAttendees: sql<number>`count(distinct ${eventAttendees.id})::int`,
      })
      .from(events)
      .leftJoin(eventInvitees, eq(events.id, eventInvitees.eventId))
      .leftJoin(eventAttendees, eq(events.id, eventAttendees.eventId))
      .where(sql`${events.startDate} >= current_date - interval '12 months'`)
      .groupBy(sql`extract(month from ${events.startDate})`, sql`extract(year from ${events.startDate})`)
      .orderBy(sql`extract(year from ${events.startDate})`, sql`extract(month from ${events.startDate})`);

    // 3. Conversion Funnel (Overall)
    const conversionFunnel = await this.db
      .select({
        totalInvited: sql<number>`count(distinct ${eventInvitees.id})::int`,
        totalEmailsSent: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.inviteEmailSent} = true)::int`,
        totalRegistered: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.registered} = true)::int`,
        totalRSVPed: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.rsvp} = true)::int`,
      })
      .from(eventInvitees);

    const totalAttendedResult = await this.db
      .select({
        totalAttended: sql<number>`count(distinct ${eventAttendees.id})::int`,
      })
      .from(eventAttendees);

    const funnel = {
      invited: conversionFunnel[0]?.totalInvited ?? 0,
      emailsSent: conversionFunnel[0]?.totalEmailsSent ?? 0,
      registered: conversionFunnel[0]?.totalRegistered ?? 0,
      rsvped: conversionFunnel[0]?.totalRSVPed ?? 0,
      attended: totalAttendedResult[0]?.totalAttended ?? 0,
      emailSentRate: 0,
      registrationRate: 0,
      rsvpRate: 0,
      attendanceRate: 0,
      overallConversion: 0,
    };

    const invited = funnel.invited ?? 0;
    const emailsSent = funnel.emailsSent ?? 0;
    const registered = funnel.registered ?? 0;
    funnel.emailSentRate = invited > 0 ? (emailsSent / invited) * 100 : 0;
    funnel.registrationRate = invited > 0 ? (registered / invited) * 100 : 0;
    funnel.rsvpRate = invited > 0 ? (funnel.rsvped / invited) * 100 : 0;
    funnel.attendanceRate = registered > 0 ? (funnel.attended / registered) * 100 : 0;
    funnel.overallConversion = invited > 0 ? (funnel.attended / invited) * 100 : 0;

    // 4. Top Performing Events
    const topEvents = await this.db
      .select({
        eventId: events.id,
        eventName: events.name,
        eventNameAr: events.nameAr,
        eventDate: events.startDate,
        categoryName: categories.nameEn,
        categoryNameAr: categories.nameAr,
        totalInvitees: sql<number>`count(distinct ${eventInvitees.id})::int`,
        totalAttendees: sql<number>`count(distinct ${eventAttendees.id})::int`,
      })
      .from(events)
      .leftJoin(categories, eq(events.categoryId, categories.id))
      .leftJoin(eventInvitees, eq(events.id, eventInvitees.eventId))
      .leftJoin(eventAttendees, eq(events.id, eventAttendees.eventId))
      .groupBy(events.id, events.name, events.nameAr, events.startDate, categories.nameEn, categories.nameAr)
      .having(sql`count(distinct ${eventAttendees.id}) > 0`)
      .orderBy(desc(sql`count(distinct ${eventAttendees.id})`))
      .limit(10);

    const topPerformingEvents = topEvents.map(evt => ({
      ...evt,
      attendanceRate: evt.totalInvitees > 0 ? (evt.totalAttendees / evt.totalInvitees) * 100 : 0,
    }));

    // 5. Contact Engagement Tiers
    const contactEngagementQuery = await this.db
      .select({
        leadId: contacts.id,
        eventsAttended: sql<number>`count(distinct ${eventAttendees.id})::int`,
      })
      .from(contacts)
      .leftJoin(eventAttendees, eq(contacts.id, eventAttendees.contactId))
      .groupBy(contacts.id);

    const engagementTiers = {
      highly_engaged: contactEngagementQuery.filter(c => c.eventsAttended >= 5).length,
      moderately_engaged: contactEngagementQuery.filter(c => c.eventsAttended >= 2 && c.eventsAttended < 5).length,
      low_engaged: contactEngagementQuery.filter(c => c.eventsAttended === 1).length,
      not_engaged: contactEngagementQuery.filter(c => c.eventsAttended === 0).length,
    };

    // 6. Geographic Distribution
    const geographicEngagement = await this.db
      .select({
        countryCode: countries.code,
        countryNameEn: countries.nameEn,
        countryNameAr: countries.nameAr,
        uniqueContacts: sql<number>`count(distinct ${contacts.id})::int`,
        totalInvitations: sql<number>`count(distinct ${eventInvitees.id})::int`,
        totalAttendances: sql<number>`count(distinct ${eventAttendees.id})::int`,
      })
      .from(countries)
      .leftJoin(contacts, eq(countries.id, contacts.countryId))
      .leftJoin(eventInvitees, eq(contacts.id, eventInvitees.contactId))
      .leftJoin(eventAttendees, eq(contacts.id, eventAttendees.contactId))
      .groupBy(countries.code, countries.nameEn, countries.nameAr)
      .having(sql`count(distinct ${contacts.id}) > 0`)
      .orderBy(desc(sql`count(distinct ${eventAttendees.id})`))
      .limit(15);

    // 7. Event Type Performance
    const eventTypeEngagement = await this.db
      .select({
        eventType: events.eventType,
        eventScope: events.eventScope,
        totalEvents: sql<number>`count(distinct ${events.id})::int`,
        totalInvitees: sql<number>`count(distinct ${eventInvitees.id})::int`,
        totalAttendees: sql<number>`count(distinct ${eventAttendees.id})::int`,
        averageAttendance: sql<number>`avg(${events.expectedAttendance})::int`,
      })
      .from(events)
      .leftJoin(eventInvitees, eq(events.id, eventInvitees.eventId))
      .leftJoin(eventAttendees, eq(events.id, eventAttendees.eventId))
      .groupBy(events.eventType, events.eventScope)
      .orderBy(desc(sql`count(distinct ${eventAttendees.id})`));

    const eventTypeMetrics = eventTypeEngagement.map(evt => ({
      ...evt,
      attendanceRate: evt.totalInvitees > 0 ? (evt.totalAttendees / evt.totalInvitees) * 100 : 0,
    }));

    return {
      engagementByCategory: categoryMetrics,
      engagementByMonth,
      conversionFunnel: funnel,
      topPerformingEvents,
      engagementTiers,
      geographicEngagement,
      eventTypeEngagement: eventTypeMetrics,
    };
  }

  // Organization Statistics
  async getOrganizationStatistics(options: {
    limit: number;
    sortBy: string;
    sortOrder: string;
  }): Promise<{
    totalOrganizations: number;
    organizationsWithAttendance: number;
    organizationStatistics: Array<{
      organizationId: number;
      organizationNameEn: string;
      organizationNameAr: string | null;
      totalContacts: number;
      activeContacts: number;
      totalEventAttendances: number;
      uniqueEventsAttended: number;
      averageAttendancePerContact: number;
      attendanceRate: number;
      speakerAppearances: number;
      topAttendee: {
        leadId: number;
        nameEn: string;
        eventsAttended: number;
      } | null;
    }>;
    overallAverageAttendanceRate: number;
  }> {
    const { limit, sortBy, sortOrder } = options;

    const totalOrgsResult = await this.db.select({ count: sql<number>`count(*)::int` }).from(organizations);
    const totalOrganizations = totalOrgsResult[0]?.count || 0;

    const orgStatsQuery = await this.db
      .select({
        organizationId: organizations.id,
        organizationNameEn: organizations.nameEn,
        organizationNameAr: organizations.nameAr,
        totalContacts: sql<number>`count(distinct ${contacts.id})::int`,
        activeContacts: sql<number>`count(distinct case when ${eventAttendees.id} is not null then ${contacts.id} end)::int`,
        totalEventAttendances: sql<number>`count(distinct ${eventAttendees.id})::int`,
        uniqueEventsAttended: sql<number>`count(distinct ${eventAttendees.eventId})::int`,
        speakerAppearances: sql<number>`count(distinct ${eventSpeakers.id})::int`,
      })
      .from(organizations)
      .leftJoin(contacts, eq(organizations.id, contacts.organizationId))
      .leftJoin(eventAttendees, eq(contacts.id, eventAttendees.contactId))
      .leftJoin(eventSpeakers, eq(contacts.id, eventSpeakers.contactId))
      .groupBy(organizations.id);

    const organizationStatistics = await Promise.all(
      orgStatsQuery.map(async (org) => {
        const attendanceRate = org.totalContacts > 0 
          ? (org.activeContacts / org.totalContacts) * 100 
          : 0;
        
        const averageAttendancePerContact = org.activeContacts > 0
          ? org.totalEventAttendances / org.activeContacts
          : 0;

        let topAttendee = null;
        if (org.activeContacts > 0) {
          const topAttendeeQuery = await this.db
            .select({
              leadId: contacts.id,
              nameEn: contacts.nameEn,
              eventsAttended: sql<number>`count(distinct ${eventAttendees.id})::int`,
            })
            .from(contacts)
            .innerJoin(eventAttendees, eq(contacts.id, eventAttendees.contactId))
            .where(eq(contacts.organizationId, org.organizationId))
            .groupBy(contacts.id)
            .orderBy(desc(sql`count(distinct ${eventAttendees.id})`))
            .limit(1);

          if (topAttendeeQuery.length > 0) {
            topAttendee = {
              leadId: topAttendeeQuery[0].leadId,
              nameEn: topAttendeeQuery[0].nameEn,
              eventsAttended: topAttendeeQuery[0].eventsAttended,
            };
          }
        }

        return {
          organizationId: org.organizationId,
          organizationNameEn: org.organizationNameEn,
          organizationNameAr: org.organizationNameAr,
          totalContacts: org.totalContacts,
          activeContacts: org.activeContacts,
          totalEventAttendances: org.totalEventAttendances,
          uniqueEventsAttended: org.uniqueEventsAttended,
          averageAttendancePerContact,
          attendanceRate,
          speakerAppearances: org.speakerAppearances,
          topAttendee,
        };
      })
    );

    const orgsWithAttendance = organizationStatistics.filter(org => org.activeContacts > 0);
    const organizationsWithAttendance = orgsWithAttendance.length;

    const sortedStats = [...orgsWithAttendance].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortBy) {
        case 'attendanceRate':
          aVal = a.attendanceRate;
          bVal = b.attendanceRate;
          break;
        case 'uniqueContacts':
        case 'activeContacts':
          aVal = a.activeContacts;
          bVal = b.activeContacts;
          break;
        case 'averagePerContact':
          aVal = a.averageAttendancePerContact;
          bVal = b.averageAttendancePerContact;
          break;
        case 'totalAttendances':
        default:
          aVal = a.totalEventAttendances;
          bVal = b.totalEventAttendances;
          break;
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    const overallAverageAttendanceRate = organizationsWithAttendance > 0
      ? orgsWithAttendance.reduce((acc, org) => acc + org.attendanceRate, 0) / organizationsWithAttendance
      : 0;

    return {
      totalOrganizations,
      organizationsWithAttendance,
      organizationStatistics: sortedStats.slice(0, limit),
      overallAverageAttendanceRate,
    };
  }

  // Grouped Contacts
  async getGroupedContacts(options: {
    groupBy: 'organization' | 'position' | 'country';
    groupId?: number;
    page?: number;
    limit?: number;
    search?: string;
    isEligibleSpeaker?: boolean;
  }): Promise<{
    groups: Array<{
      id: number;
      nameEn: string;
      nameAr: string | null;
      totalContacts: number;
      contacts: Array<Contact & { organization?: Organization; position?: Position; country?: Country }>;
    }>;
    totalGroups: number;
  }> {
    const contactsPerGroup = options.limit || 5;
    const groupPage = options.page || 1;
    
    const contactConditions: any[] = [];
    
    if (options.search) {
      const searchPattern = `%${options.search}%`;
      contactConditions.push(
        or(
          like(contacts.nameEn, searchPattern),
          like(contacts.nameAr, searchPattern),
          like(contacts.email, searchPattern)
        )
      );
    }
    
    if (options.isEligibleSpeaker !== undefined) {
      contactConditions.push(eq(contacts.isEligibleSpeaker, options.isEligibleSpeaker));
    }

    let groupTable: typeof organizations | typeof positions | typeof countries;
    let groupForeignKey: typeof contacts.organizationId | typeof contacts.positionId | typeof contacts.countryId;
    
    switch (options.groupBy) {
      case 'organization':
        groupTable = organizations;
        groupForeignKey = contacts.organizationId;
        break;
      case 'position':
        groupTable = positions;
        groupForeignKey = contacts.positionId;
        break;
      case 'country':
        groupTable = countries;
        groupForeignKey = contacts.countryId;
        break;
    }

    if (options.groupId) {
      const groupConditions = [...contactConditions, eq(groupForeignKey, options.groupId)];
      const whereClause = groupConditions.length > 0 ? and(...groupConditions) : undefined;
      
      const [groupInfo] = await this.db
        .select()
        .from(groupTable)
        .where(eq(groupTable.id, options.groupId))
        .limit(1);
      
      if (!groupInfo) {
        return { groups: [], totalGroups: 0 };
      }
      
      const [{ totalCount }] = await this.db
        .select({ totalCount: count() })
        .from(contacts)
        .where(whereClause);
      
      const offset = (groupPage - 1) * contactsPerGroup;
      const contactResults = await this.db
        .select({
          contact: contacts,
          organization: organizations,
          position: positions,
          country: countries,
        })
        .from(contacts)
        .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
        .leftJoin(positions, eq(contacts.positionId, positions.id))
        .leftJoin(countries, eq(contacts.countryId, countries.id))
        .where(whereClause)
        .orderBy(contacts.nameEn)
        .limit(contactsPerGroup)
        .offset(offset);
      
      const contactsList = contactResults.map(({ contact, organization, position, country }) => ({
        ...contact,
        organization: organization || undefined,
        position: position || undefined,
        country: country || undefined,
      }));
      
      return {
        groups: [{
          id: groupInfo.id,
          nameEn: groupInfo.nameEn,
          nameAr: groupInfo.nameAr,
          totalContacts: Number(totalCount),
          contacts: contactsList,
        }],
        totalGroups: 1,
      };
    }

    const baseWhereClause = contactConditions.length > 0 ? and(...contactConditions) : undefined;
    
    const groupsWithCounts = await this.db
      .select({
        groupId: groupForeignKey,
        contactCount: count(),
      })
      .from(contacts)
      .where(baseWhereClause)
      .groupBy(groupForeignKey)
      .orderBy(desc(count()));

    const validGroupIds = groupsWithCounts
      .filter(g => g.groupId !== null)
      .map(g => ({ id: g.groupId!, count: Number(g.contactCount) }));
    
    if (validGroupIds.length === 0) {
      return { groups: [], totalGroups: 0 };
    }

    const groupDetails = await this.db
      .select()
      .from(groupTable)
      .where(inArray(groupTable.id, validGroupIds.map(g => g.id)));

    const groupDetailsMap = new Map(groupDetails.map(g => [g.id, g]));

    const result: Array<{
      id: number;
      nameEn: string;
      nameAr: string | null;
      totalContacts: number;
      contacts: Array<Contact & { organization?: Organization; position?: Position; country?: Country }>;
    }> = [];

    for (const { id: groupId, count: totalContacts } of validGroupIds) {
      const groupDetail = groupDetailsMap.get(groupId);
      if (!groupDetail) continue;

      const groupContactConditions = [...contactConditions, eq(groupForeignKey, groupId)];
      const groupWhereClause = and(...groupContactConditions);

      const contactResults = await this.db
        .select({
          contact: contacts,
          organization: organizations,
          position: positions,
          country: countries,
        })
        .from(contacts)
        .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
        .leftJoin(positions, eq(contacts.positionId, positions.id))
        .leftJoin(countries, eq(contacts.countryId, countries.id))
        .where(groupWhereClause)
        .orderBy(contacts.nameEn)
        .limit(contactsPerGroup);

      const contactsList = contactResults.map(({ contact, organization, position, country }) => ({
        ...contact,
        organization: organization || undefined,
        position: position || undefined,
        country: country || undefined,
      }));

      result.push({
        id: groupDetail.id,
        nameEn: groupDetail.nameEn,
        nameAr: groupDetail.nameAr,
        totalContacts,
        contacts: contactsList,
      });
    }

    return {
      groups: result,
      totalGroups: validGroupIds.length,
    };
  }

  // Helper method for exports - get contact by ID without full details
  async getContactById(id: number): Promise<Contact | undefined> {
    const [contact] = await this.db
      .select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);
    return contact || undefined;
  }

  // Helper method for exports - get contact counts per organization
  async getOrganizationContactCounts(): Promise<Array<{ organizationId: number; count: number }>> {
    const results = await this.db
      .select({
        organizationId: contacts.organizationId,
        count: sql<number>`count(*)::int`,
      })
      .from(contacts)
      .where(isNotNull(contacts.organizationId))
      .groupBy(contacts.organizationId);

    return results.map(r => ({
      organizationId: r.organizationId!,
      count: r.count,
    }));
  }
}
