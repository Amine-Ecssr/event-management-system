/**
 * Partnership Repository
 * Handles partnership management operations
 */
import { BaseRepository } from './base';
import { 
  organizations, countries, partnershipAgreements, agreementAttachments, partnershipActivities, events,
  partnershipContacts, contacts, partnershipComments, users, partnershipTypes, agreementTypes,
  partnershipInteractions,
  type Organization, type InsertOrganization, type Country,
  type PartnershipAgreement, type InsertPartnershipAgreement, type UpdatePartnershipAgreement,
  type PartnershipActivity, type InsertPartnershipActivity, type UpdatePartnershipActivity,
  type PartnershipContact, type InsertPartnershipContact, type UpdatePartnershipContact, type Contact,
  type PartnershipComment, type InsertPartnershipComment, type UpdatePartnershipComment,
  type AgreementAttachment, type InsertAgreementAttachment,
  type PartnershipType, type InsertPartnershipType,
  type AgreementType, type InsertAgreementType,
  type PartnershipInteraction, type InsertPartnershipInteraction, type UpdatePartnershipInteraction,
  type Event
} from '@shared/schema';
import { eq, and, or, like, desc, asc, lte, isNotNull, sql } from 'drizzle-orm';

// Helper function to classify partnership scope based on country
function classifyPartnershipScope(countryCode: string | null): 'local' | 'regional' | 'international' {
  if (!countryCode) return 'local';
  const gccCountries = ['AE', 'SA', 'KW', 'QA', 'BH', 'OM'];
  if (countryCode === 'AE') return 'local';
  if (gccCountries.includes(countryCode)) return 'regional';
  return 'international';
}

export class PartnershipRepository extends BaseRepository {
  // Partnership Type operations
  async getAllPartnershipTypes(): Promise<PartnershipType[]> {
    return await this.db.select().from(partnershipTypes).orderBy(partnershipTypes.nameEn);
  }

  async getPartnershipType(id: number): Promise<PartnershipType | undefined> {
    const [type] = await this.db.select().from(partnershipTypes).where(eq(partnershipTypes.id, id));
    return type || undefined;
  }

  async createPartnershipType(data: InsertPartnershipType): Promise<PartnershipType> {
    const [type] = await this.db.insert(partnershipTypes).values(data).returning();
    return type;
  }

  async updatePartnershipType(id: number, data: Partial<InsertPartnershipType>): Promise<PartnershipType | undefined> {
    const [type] = await this.db
      .update(partnershipTypes)
      .set(data)
      .where(eq(partnershipTypes.id, id))
      .returning();
    return type || undefined;
  }

  async deletePartnershipType(id: number): Promise<boolean> {
    const result = await this.db
      .delete(partnershipTypes)
      .where(eq(partnershipTypes.id, id))
      .returning();
    return result.length > 0;
  }

  // Agreement Type operations
  async getAllAgreementTypes(): Promise<AgreementType[]> {
    return await this.db.select().from(agreementTypes).orderBy(agreementTypes.nameEn);
  }

  async getAgreementType(id: number): Promise<AgreementType | undefined> {
    const [type] = await this.db.select().from(agreementTypes).where(eq(agreementTypes.id, id));
    return type || undefined;
  }

  async createAgreementType(data: InsertAgreementType): Promise<AgreementType> {
    const [type] = await this.db.insert(agreementTypes).values(data).returning();
    return type;
  }

  async updateAgreementType(id: number, data: Partial<InsertAgreementType>): Promise<AgreementType | undefined> {
    const [type] = await this.db
      .update(agreementTypes)
      .set(data)
      .where(eq(agreementTypes.id, id))
      .returning();
    return type || undefined;
  }

  async deleteAgreementType(id: number): Promise<boolean> {
    const result = await this.db
      .delete(agreementTypes)
      .where(eq(agreementTypes.id, id))
      .returning();
    return result.length > 0;
  }

  // Partner operations
  async getAllPartners(options?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    search?: string;
    sortBy?: string;
  }): Promise<{ partners: (Organization & { latestActivityDate?: string | null; daysSinceLastActivity?: number | null })[]; total: number; page: number; limit: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(organizations.isPartner, true)];
    
    if (options?.status) {
      conditions.push(eq(organizations.partnershipStatus, options.status));
    }
    if (options?.type) {
      const typeId = typeof options.type === 'string' ? parseInt(options.type, 10) : options.type;
      conditions.push(eq(organizations.partnershipTypeId, typeId));
    }
    if (options?.search) {
      const searchCondition = or(
        like(organizations.nameEn, `%${options.search}%`),
        like(organizations.nameAr, `%${options.search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(organizations)
      .where(whereClause);

    let orderByClause;
    switch (options?.sortBy) {
      case 'latestActivity':
        orderByClause = desc(organizations.lastActivityDate);
        break;
      case 'oldestActivity':
        orderByClause = asc(sql`COALESCE(${organizations.lastActivityDate}, '1970-01-01'::timestamp)`);
        break;
      case 'name':
        orderByClause = asc(organizations.nameEn);
        break;
      case 'status':
        orderByClause = asc(organizations.partnershipStatus);
        break;
      default:
        orderByClause = desc(organizations.partnershipStartDate);
    }

    const partners = await this.db
      .select({
        id: organizations.id,
        nameEn: organizations.nameEn,
        nameAr: organizations.nameAr,
        createdAt: organizations.createdAt,
        isPartner: organizations.isPartner,
        partnershipStatus: organizations.partnershipStatus,
        partnershipTypeId: organizations.partnershipTypeId,
        partnershipStartDate: organizations.partnershipStartDate,
        partnershipEndDate: organizations.partnershipEndDate,
        countryId: organizations.countryId,
        country: countries,
        agreementSignedBy: organizations.agreementSignedBy,
        agreementSignedByUs: organizations.agreementSignedByUs,
        partnershipNotes: organizations.partnershipNotes,
        logoKey: organizations.logoKey,
        website: organizations.website,
        primaryContactId: organizations.primaryContactId,
        inactivityThresholdMonths: organizations.inactivityThresholdMonths,
        lastActivityDate: organizations.lastActivityDate,
        notifyOnInactivity: organizations.notifyOnInactivity,
        lastInactivityNotificationSent: organizations.lastInactivityNotificationSent,
        latestActivityDate: sql<string | null>`(
          SELECT MAX(start_date)::text
          FROM partnership_activities
          WHERE partnership_activities.organization_id = ${organizations.id}
        )`,
      })
      .from(organizations)
      .leftJoin(countries, eq(organizations.countryId, countries.id))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const now = new Date();
    const partnersWithScope = partners.map(partner => {
      const lastActivity = partner.lastActivityDate;
      const daysSinceLastActivity = lastActivity 
        ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      return {
        ...partner,
        scope: classifyPartnershipScope(partner.country?.code || null),
        daysSinceLastActivity,
      };
    });

    return { partners: partnersWithScope, total: countResult.count, page, limit };
  }

  async updatePartnership(id: number, data: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [updated] = await this.db
      .update(organizations)
      .set(data)
      .where(eq(organizations.id, id))
      .returning();
    return updated;
  }

  async getPartnerStats(): Promise<{
    totalPartners: number;
    activePartnerships: number;
    pendingAgreements: number;
    expiringSoon: number;
  }> {
    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(organizations)
      .where(eq(organizations.isPartner, true));

    const [activeResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(organizations)
      .where(and(
        eq(organizations.isPartner, true),
        eq(organizations.partnershipStatus, 'active')
      ));

    const [pendingResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(partnershipAgreements)
      .where(eq(partnershipAgreements.status, 'pending_approval'));

    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    const [expiringResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(partnershipAgreements)
      .where(and(
        eq(partnershipAgreements.status, 'active'),
        lte(partnershipAgreements.expiryDate, ninetyDaysFromNow.toISOString().split('T')[0])
      ));

    return {
      totalPartners: totalResult.count,
      activePartnerships: activeResult.count,
      pendingAgreements: pendingResult.count,
      expiringSoon: expiringResult.count,
    };
  }

  // Partnership Agreement operations
  async getPartnershipAgreements(organizationId: number): Promise<any[]> {
    return this.db
      .select({
        id: partnershipAgreements.id,
        organizationId: partnershipAgreements.organizationId,
        title: partnershipAgreements.title,
        titleAr: partnershipAgreements.titleAr,
        description: partnershipAgreements.description,
        descriptionAr: partnershipAgreements.descriptionAr,
        agreementTypeId: partnershipAgreements.agreementTypeId,
        agreementType: {
          id: agreementTypes.id,
          nameEn: agreementTypes.nameEn,
          nameAr: agreementTypes.nameAr,
        },
        signedDate: partnershipAgreements.signedDate,
        effectiveDate: partnershipAgreements.effectiveDate,
        expiryDate: partnershipAgreements.expiryDate,
        partnerSignatory: partnershipAgreements.partnerSignatory,
        partnerSignatoryTitle: partnershipAgreements.partnerSignatoryTitle,
        ourSignatory: partnershipAgreements.ourSignatory,
        ourSignatoryTitle: partnershipAgreements.ourSignatoryTitle,
        documentKey: partnershipAgreements.documentKey,
        documentFileName: partnershipAgreements.documentFileName,
        status: partnershipAgreements.status,
        legalStatus: partnershipAgreements.legalStatus,
        languages: partnershipAgreements.languages,
        terminationClause: partnershipAgreements.terminationClause,
        terminationClauseAr: partnershipAgreements.terminationClauseAr,
        createdByUserId: partnershipAgreements.createdByUserId,
        createdAt: partnershipAgreements.createdAt,
        updatedAt: partnershipAgreements.updatedAt,
      })
      .from(partnershipAgreements)
      .leftJoin(agreementTypes, eq(partnershipAgreements.agreementTypeId, agreementTypes.id))
      .where(eq(partnershipAgreements.organizationId, organizationId))
      .orderBy(desc(partnershipAgreements.signedDate));
  }

  async getPartnershipAgreement(id: number): Promise<PartnershipAgreement | undefined> {
    const [agreement] = await this.db
      .select()
      .from(partnershipAgreements)
      .where(eq(partnershipAgreements.id, id))
      .limit(1);
    return agreement;
  }

  async createPartnershipAgreement(data: InsertPartnershipAgreement): Promise<PartnershipAgreement> {
    const [agreement] = await this.db
      .insert(partnershipAgreements)
      .values(data)
      .returning();
    return agreement;
  }

  async updatePartnershipAgreement(id: number, data: UpdatePartnershipAgreement): Promise<PartnershipAgreement | undefined> {
    const [updated] = await this.db
      .update(partnershipAgreements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(partnershipAgreements.id, id))
      .returning();
    return updated;
  }

  async deletePartnershipAgreement(id: number): Promise<boolean> {
    await this.db
      .delete(partnershipAgreements)
      .where(eq(partnershipAgreements.id, id));
    return true;
  }

  // Partnership Activity operations
  async getPartnershipActivities(organizationId: number): Promise<any[]> {
    const results = await this.db
      .select({
        activity: partnershipActivities,
        event: events,
      })
      .from(partnershipActivities)
      .leftJoin(events, eq(partnershipActivities.eventId, events.id))
      .where(eq(partnershipActivities.organizationId, organizationId))
      .orderBy(desc(partnershipActivities.startDate));
    
    return results.map(row => ({
      ...row.activity,
      linkedEventId: row.activity.eventId,
      linkedEvent: row.event ? {
        id: row.event.id,
        titleEn: row.event.name,
        titleAr: row.event.nameAr,
      } : null,
    }));
  }

  async getActivitiesByEventId(eventId: string): Promise<any[]> {
    const results = await this.db
      .select({
        activity: partnershipActivities,
        organization: organizations,
        createdBy: users,
      })
      .from(partnershipActivities)
      .leftJoin(organizations, eq(partnershipActivities.organizationId, organizations.id))
      .leftJoin(users, eq(partnershipActivities.createdByUserId, users.id))
      .where(eq(partnershipActivities.eventId, eventId))
      .orderBy(desc(partnershipActivities.startDate));
    
    return results.map(row => ({
      ...row.activity,
      organization: row.organization ? {
        id: row.organization.id,
        nameEn: row.organization.nameEn,
        nameAr: row.organization.nameAr,
      } : null,
      createdByUser: row.createdBy ? {
        id: row.createdBy.id,
        username: row.createdBy.username,
      } : null,
    }));
  }

  async getPartnershipActivity(id: number): Promise<PartnershipActivity | undefined> {
    const [activity] = await this.db
      .select()
      .from(partnershipActivities)
      .where(eq(partnershipActivities.id, id))
      .limit(1);
    return activity;
  }

  async createPartnershipActivity(data: InsertPartnershipActivity): Promise<PartnershipActivity> {
    const [activity] = await this.db
      .insert(partnershipActivities)
      .values(data)
      .returning();
    
    const activityDate = data.startDate ? new Date(data.startDate) : new Date();
    await this.updatePartnershipLastActivity(data.organizationId, activityDate);
    
    return activity;
  }

  async updatePartnershipActivity(id: number, data: UpdatePartnershipActivity): Promise<PartnershipActivity | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };

    const [updated] = await this.db
      .update(partnershipActivities)
      .set(updateData)
      .where(eq(partnershipActivities.id, id))
      .returning();
    
    if (updated && data.startDate) {
      await this.updatePartnershipLastActivity(updated.organizationId, new Date(data.startDate));
    }
    
    return updated;
  }

  async deletePartnershipActivity(id: number): Promise<boolean> {
    const activity = await this.getPartnershipActivity(id);
    
    await this.db
      .delete(partnershipActivities)
      .where(eq(partnershipActivities.id, id));
    
    if (activity) {
      await this.updatePartnershipLastActivity(activity.organizationId);
    }
    
    return true;
  }

  async getPartnerEvents(organizationId: number): Promise<Event[]> {
    const linkedEvents = await this.db
      .select({ event: events })
      .from(partnershipActivities)
      .innerJoin(events, eq(partnershipActivities.eventId, events.id))
      .where(eq(partnershipActivities.organizationId, organizationId));

    return linkedEvents.map(le => le.event);
  }

  // Partnership Contact operations
  async getPartnershipContacts(organizationId: number): Promise<Array<PartnershipContact & { contact: Contact }>> {
    const result = await this.db
      .select({
        partnershipContact: partnershipContacts,
        contact: contacts,
      })
      .from(partnershipContacts)
      .innerJoin(contacts, eq(partnershipContacts.contactId, contacts.id))
      .where(eq(partnershipContacts.organizationId, organizationId))
      .orderBy(desc(partnershipContacts.isPrimary));

    return result.map(r => ({
      ...r.partnershipContact,
      contact: r.contact,
    }));
  }

  async addPartnershipContact(data: InsertPartnershipContact): Promise<PartnershipContact> {
    const [contact] = await this.db
      .insert(partnershipContacts)
      .values(data)
      .returning();
    return contact;
  }

  async updatePartnershipContact(id: number, data: UpdatePartnershipContact): Promise<PartnershipContact | undefined> {
    const [updated] = await this.db
      .update(partnershipContacts)
      .set(data)
      .where(eq(partnershipContacts.id, id))
      .returning();
    return updated;
  }

  async removePartnershipContact(id: number): Promise<boolean> {
    await this.db
      .delete(partnershipContacts)
      .where(eq(partnershipContacts.id, id));
    return true;
  }

  // Partnership Comment operations
  async getPartnershipComments(organizationId: number): Promise<Array<PartnershipComment & { authorUsername: string | null }>> {
    const results = await this.db
      .select({
        id: partnershipComments.id,
        organizationId: partnershipComments.organizationId,
        body: partnershipComments.body,
        bodyAr: partnershipComments.bodyAr,
        authorUserId: partnershipComments.authorUserId,
        createdAt: partnershipComments.createdAt,
        updatedAt: partnershipComments.updatedAt,
        authorUsername: users.username,
      })
      .from(partnershipComments)
      .leftJoin(users, eq(partnershipComments.authorUserId, users.id))
      .where(eq(partnershipComments.organizationId, organizationId))
      .orderBy(desc(partnershipComments.createdAt));

    return results.map(row => ({
      id: row.id,
      organizationId: row.organizationId,
      body: row.body,
      bodyAr: row.bodyAr,
      authorUserId: row.authorUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      authorUsername: row.authorUsername,
    }));
  }

  async getPartnershipComment(id: number): Promise<PartnershipComment | undefined> {
    const [comment] = await this.db
      .select()
      .from(partnershipComments)
      .where(eq(partnershipComments.id, id));
    return comment;
  }

  async createPartnershipComment(data: InsertPartnershipComment): Promise<PartnershipComment> {
    const [comment] = await this.db
      .insert(partnershipComments)
      .values(data)
      .returning();
    return comment;
  }

  async updatePartnershipComment(id: number, data: UpdatePartnershipComment): Promise<PartnershipComment | undefined> {
    const [updated] = await this.db
      .update(partnershipComments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(partnershipComments.id, id))
      .returning();
    return updated;
  }

  async deletePartnershipComment(id: number): Promise<boolean> {
    await this.db
      .delete(partnershipComments)
      .where(eq(partnershipComments.id, id));
    return true;
  }

  // Agreement Attachment operations
  async getAgreementAttachments(agreementId: number): Promise<AgreementAttachment[]> {
    return this.db
      .select()
      .from(agreementAttachments)
      .where(eq(agreementAttachments.agreementId, agreementId))
      .orderBy(desc(agreementAttachments.uploadedAt));
  }

  async getAgreementAttachment(id: number): Promise<AgreementAttachment | undefined> {
    const [attachment] = await this.db
      .select()
      .from(agreementAttachments)
      .where(eq(agreementAttachments.id, id))
      .limit(1);
    return attachment;
  }

  async getAgreementAttachmentByObjectKey(objectKey: string): Promise<AgreementAttachment | undefined> {
    const [attachment] = await this.db
      .select()
      .from(agreementAttachments)
      .where(eq(agreementAttachments.objectKey, objectKey))
      .limit(1);
    return attachment;
  }

  async createAgreementAttachment(data: InsertAgreementAttachment): Promise<AgreementAttachment> {
    const [attachment] = await this.db
      .insert(agreementAttachments)
      .values(data)
      .returning();
    return attachment;
  }

  async deleteAgreementAttachment(id: number): Promise<boolean> {
    await this.db
      .delete(agreementAttachments)
      .where(eq(agreementAttachments.id, id));
    return true;
  }

  // Partnership Inactivity Monitoring
  async getInactivePartnerships(thresholdDate: Date): Promise<Array<Organization & { daysSinceLastActivity: number }>> {
    const now = new Date();
    
    const partners = await this.db
      .select()
      .from(organizations)
      .where(
        and(
          eq(organizations.isPartner, true),
          eq(organizations.notifyOnInactivity, true),
          isNotNull(organizations.lastActivityDate)
        )
      );
    
    const inactivePartners = partners.filter(partner => {
      if (!partner.lastActivityDate) return false;
      
      const thresholdMonths = partner.inactivityThresholdMonths || 6;
      const partnerThresholdDate = new Date();
      partnerThresholdDate.setMonth(partnerThresholdDate.getMonth() - thresholdMonths);
      
      return partner.lastActivityDate < partnerThresholdDate;
    });
    
    return inactivePartners.map(partner => ({
      ...partner,
      daysSinceLastActivity: Math.floor((now.getTime() - (partner.lastActivityDate?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24))
    }));
  }

  async updatePartnershipLastActivity(organizationId: number, activityDate?: Date): Promise<void> {
    if (activityDate) {
      const [org] = await this.db
        .select({ lastActivityDate: organizations.lastActivityDate })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
      
      const currentLastActivity = org?.lastActivityDate;
      const newLastActivity = activityDate > (currentLastActivity || new Date(0)) ? activityDate : currentLastActivity;
      
      await this.db
        .update(organizations)
        .set({ lastActivityDate: newLastActivity })
        .where(eq(organizations.id, organizationId));
    } else {
      const [latestActivity] = await this.db
        .select({ maxDate: sql<Date>`MAX(start_date::timestamp)` })
        .from(partnershipActivities)
        .where(eq(partnershipActivities.organizationId, organizationId));
      
      const lastActivityDate = latestActivity?.maxDate || null;
      
      await this.db
        .update(organizations)
        .set({ lastActivityDate })
        .where(eq(organizations.id, organizationId));
    }
  }

  async updatePartnershipInactivitySettings(
    organizationId: number, 
    settings: { inactivityThresholdMonths?: number; notifyOnInactivity?: boolean }
  ): Promise<Organization | undefined> {
    const [updated] = await this.db
      .update(organizations)
      .set(settings)
      .where(eq(organizations.id, organizationId))
      .returning();
    return updated;
  }

  async markInactivityNotificationSent(organizationId: number): Promise<void> {
    await this.db
      .update(organizations)
      .set({ lastInactivityNotificationSent: new Date() })
      .where(eq(organizations.id, organizationId));
  }

  // Partnership Interaction operations
  async getPartnershipInteractions(organizationId: number): Promise<PartnershipInteraction[]> {
    return this.db
      .select()
      .from(partnershipInteractions)
      .where(eq(partnershipInteractions.organizationId, organizationId))
      .orderBy(desc(partnershipInteractions.interactionDate));
  }

  async getPartnershipInteraction(id: number): Promise<PartnershipInteraction | undefined> {
    const [interaction] = await this.db
      .select()
      .from(partnershipInteractions)
      .where(eq(partnershipInteractions.id, id))
      .limit(1);
    return interaction;
  }

  async createPartnershipInteraction(data: InsertPartnershipInteraction): Promise<PartnershipInteraction> {
    const [interaction] = await this.db
      .insert(partnershipInteractions)
      .values(data)
      .returning();
    return interaction;
  }

  async updatePartnershipInteraction(id: number, data: UpdatePartnershipInteraction): Promise<PartnershipInteraction | undefined> {
    const [updated] = await this.db
      .update(partnershipInteractions)
      .set(data)
      .where(eq(partnershipInteractions.id, id))
      .returning();
    return updated;
  }

  async deletePartnershipInteraction(id: number): Promise<boolean> {
    await this.db
      .delete(partnershipInteractions)
      .where(eq(partnershipInteractions.id, id));
    return true;
  }
}
