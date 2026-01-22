/**
 * Contacts Analytics Service
 * 
 * Provides analytics for contacts database, speakers, leads, and interactions.
 * 
 * UPDATED: Now uses Elasticsearch for all aggregations (SQL fallback DISABLED for testing)
 * 
 * @module services/contacts-analytics
 */

import { db } from "../db";
import {
  contacts,
  organizations,
  countries,
  positions,
  eventSpeakers,
  leads,
  leadInteractions,
  events,
} from "@shared/schema";
import { eq, and, sql, count, desc, asc, isNotNull, gte, lte } from "drizzle-orm";
import { getOptionalElasticsearchClient, isElasticsearchEnabled } from '../elasticsearch/client';
import { ES_INDEX_PREFIX, ES_INDEX_SUFFIX } from '../elasticsearch/config';

// TEMPORARY: Set to false to disable SQL fallback and force ES-only
const ENABLE_SQL_FALLBACK = false;

// Types for contacts analytics
export interface ContactsSummary {
  totalContacts: number;
  eligibleSpeakers: number;
  contactsWithEmail: number;
  contactsWithPhone: number;
  contactsWithOrganization: number;
  dataCompletenessScore: number; // Percentage
  newContactsThisMonth: number;
  growthRate: number; // Percentage vs previous month
}

export interface ContactsByOrganization {
  organizationId: number | null;
  organizationName: string;
  count: number;
  percentage: number;
}

export interface ContactsByCountry {
  countryId: number | null;
  countryName: string;
  countryCode: string;
  count: number;
  percentage: number;
}

export interface ContactsByPosition {
  positionId: number | null;
  positionName: string;
  count: number;
  percentage: number;
}

export interface SpeakerMetrics {
  totalSpeakers: number;
  averageEventsPerSpeaker: number;
  mostActiveSpeakers: ActiveSpeaker[];
  speakerUtilizationRate: number; // Percentage of eligible speakers used
}

export interface ActiveSpeaker {
  contactId: number;
  name: string;
  eventCount: number;
  roles: string[];
}

export interface LeadsSummary {
  totalLeads: number;
  activeLeads: number;
  inProgressLeads: number;
  inactiveLeads: number;
  leadsByType: LeadsByType[];
  conversionRate: number; // Leads that became inactive (completed)
}

export interface LeadsByType {
  type: string;
  count: number;
  percentage: number;
}

export interface InteractionMetrics {
  totalInteractions: number;
  interactionsByType: InteractionByType[];
  monthlyTrends: InteractionTrend[];
  averageInteractionsPerLead: number;
}

export interface InteractionByType {
  type: string;
  count: number;
  percentage: number;
}

export interface InteractionTrend {
  month: string;
  emailCount: number;
  phoneCount: number;
  meetingCount: number;
  otherCount: number;
  total: number;
}

export interface ContactGrowthTrend {
  month: string;
  totalContacts: number;
  newContacts: number;
  speakersAdded: number;
}

export interface ContactsAnalyticsData {
  summary: ContactsSummary;
  byOrganization: ContactsByOrganization[];
  byCountry: ContactsByCountry[];
  byPosition: ContactsByPosition[];
  speakerMetrics: SpeakerMetrics;
  leadsSummary: LeadsSummary;
  interactionMetrics: InteractionMetrics;
  growthTrends: ContactGrowthTrend[];
}

class ContactsAnalyticsService {
  private buildIndexName(entity: string): string {
    return `${ES_INDEX_PREFIX}-${entity}-${ES_INDEX_SUFFIX}`;
  }

  /**
   * Get comprehensive contacts analytics data
   * Now uses Elasticsearch for all aggregations
   */
  async getContactsAnalytics(year?: number): Promise<ContactsAnalyticsData> {
    const targetYear = year || new Date().getFullYear();

    // Try ES first
    if (isElasticsearchEnabled()) {
      console.log('[ContactsAnalytics] Using Elasticsearch for aggregations');
      const esData = await this.getContactsAnalyticsFromES(targetYear);
      if (esData) return esData;
    }

    // SQL fallback (disabled for testing)
    if (!ENABLE_SQL_FALLBACK) {
      console.warn('[ContactsAnalytics] SQL fallback is DISABLED - returning empty data');
      return this.getEmptyAnalyticsData();
    }

    console.log('[ContactsAnalytics] Falling back to SQL queries');
    return this.getContactsAnalyticsFromSQL(targetYear);
  }

  /**
   * Get contacts analytics from Elasticsearch
   * 
   * Note: The contacts index has limited fields (id, name, nameAr, title, email, phone, 
   * organizationId, positionId, createdAt). Speaker eligibility and country data need 
   * to come from SQL joins.
   */
  private async getContactsAnalyticsFromES(year: number): Promise<ContactsAnalyticsData | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) {
      console.warn('[ContactsAnalytics] ES client not available');
      return null;
    }

    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31);

      // Fetch organization and position names for lookup
      const [allOrganizations, allPositions] = await Promise.all([
        db.select({ id: organizations.id, name: organizations.nameEn }).from(organizations),
        db.select({ id: positions.id, name: positions.nameEn }).from(positions),
      ]);
      const orgMap = new Map(allOrganizations.map(o => [o.id, o.name]));
      const posMap = new Map(allPositions.map(p => [p.id, p.name]));

      // Execute ES queries in parallel - now includes all indexed fields
      const [contactsResponse, leadsResponse] = await Promise.all([
        // Contacts aggregations - using all indexed fields
        client.search({
          index: this.buildIndexName('contacts'),
          body: {
            size: 0,
            track_total_hits: true,
            aggs: {
              with_email: {
                filter: { 
                  bool: {
                    must: [
                      { exists: { field: 'email' } },
                      { bool: { must_not: { term: { 'email': '' } } } }
                    ]
                  }
                }
              },
              with_phone: {
                filter: { 
                  bool: {
                    must: [
                      { exists: { field: 'phone' } },
                      { bool: { must_not: { term: { 'phone': '' } } } }
                    ]
                  }
                }
              },
              with_organization: {
                filter: { exists: { field: 'organizationId' } }
              },
              eligible_speakers: {
                filter: { term: { isEligibleSpeaker: true } }
              },
              new_this_month: {
                filter: {
                  range: { createdAt: { gte: startOfMonth.toISOString() } }
                }
              },
              by_organization: {
                terms: { field: 'organizationId', size: 20, missing: -1 }
              },
              by_position: {
                terms: { field: 'positionId', size: 50, missing: -1 }
              },
              by_country: {
                terms: { field: 'countryId', size: 20, missing: -1 }
              },
              monthly_growth: {
                date_histogram: {
                  field: 'createdAt',
                  calendar_interval: 'month',
                  format: 'yyyy-MM',
                  min_doc_count: 0,
                  extended_bounds: {
                    min: startOfYear.getTime(),
                    max: endOfYear.getTime()
                  }
                }
              }
            }
          }
        }),

        // Leads aggregations
        client.search({
          index: this.buildIndexName('leads'),
          body: {
            size: 0,
            track_total_hits: true,
            aggs: {
              by_status: {
                terms: { field: 'status', size: 10 }
              },
              by_type: {
                terms: { field: 'type', size: 10 }
              },
              active: {
                filter: { term: { 'status': 'active' } }
              },
              in_progress: {
                filter: { term: { 'status': 'in_progress' } }
              },
              inactive: {
                filter: { term: { 'status': 'inactive' } }
              }
            }
          }
        })
      ]);

      // Parse contacts response
      const contactsTotal = (contactsResponse.hits.total as { value: number }).value;
      const contactsAggs = contactsResponse.aggregations as any;

      // Parse leads response
      const leadsTotal = (leadsResponse.hits.total as { value: number }).value;
      const leadsAggs = leadsResponse.aggregations as any;

      // Build summary
      const withEmail = contactsAggs.with_email?.doc_count || 0;
      const withPhone = contactsAggs.with_phone?.doc_count || 0;
      const withOrg = contactsAggs.with_organization?.doc_count || 0;
      const dataFields = 3; // email, phone, org
      const dataScore = contactsTotal > 0 
        ? Math.round(((withEmail + withPhone + withOrg) / (contactsTotal * dataFields)) * 100) 
        : 0;

      const summary: ContactsSummary = {
        totalContacts: contactsTotal,
        eligibleSpeakers: contactsAggs.eligible_speakers?.doc_count || 0,
        contactsWithEmail: withEmail,
        contactsWithPhone: withPhone,
        contactsWithOrganization: withOrg,
        dataCompletenessScore: dataScore,
        newContactsThisMonth: contactsAggs.new_this_month?.doc_count || 0,
        growthRate: 0, // Would need previous month comparison
      };

      // Build by organization (using PostgreSQL lookup for names)
      const orgBuckets = contactsAggs.by_organization?.buckets || [];
      const byOrganization: ContactsByOrganization[] = orgBuckets
        .filter((b: any) => b.key !== -1)
        .map((b: any) => ({
          organizationId: b.key,
          organizationName: orgMap.get(b.key) || `Unknown Organization`,
          count: b.doc_count,
          percentage: contactsTotal > 0 ? Math.round(b.doc_count / contactsTotal * 1000) / 10 : 0,
        }));

      // Build by position (using PostgreSQL lookup for names)
      const positionBuckets = contactsAggs.by_position?.buckets || [];
      const byPosition: ContactsByPosition[] = positionBuckets
        .filter((b: any) => b.key !== -1)
        .map((b: any) => ({
          positionId: b.key,
          positionName: posMap.get(b.key) || `Unknown Position`,
          count: b.doc_count,
          percentage: contactsTotal > 0 ? Math.round(b.doc_count / contactsTotal * 1000) / 10 : 0,
        }));

      // Build by country (from ES)
      const countryBuckets = contactsAggs.by_country?.buckets || [];
      const byCountry: ContactsByCountry[] = [];
      for (const bucket of countryBuckets) {
        if (bucket.key === -1) continue;
        const [countryData] = await db
          .select({ nameEn: countries.nameEn, code: countries.code })
          .from(countries)
          .where(eq(countries.id, bucket.key))
          .limit(1);
        if (countryData) {
          byCountry.push({
            countryId: bucket.key,
            countryName: countryData.nameEn,
            countryCode: countryData.code,
            count: bucket.doc_count,
            percentage: contactsTotal > 0 ? Math.round(bucket.doc_count / contactsTotal * 1000) / 10 : 0,
          });
        }
      }

      // Build leads summary
      const leadTypeBuckets = leadsAggs.by_type?.buckets || [];
      const leadsSummary: LeadsSummary = {
        totalLeads: leadsTotal,
        activeLeads: leadsAggs.active?.doc_count || 0,
        inProgressLeads: leadsAggs.in_progress?.doc_count || 0,
        inactiveLeads: leadsAggs.inactive?.doc_count || 0,
        leadsByType: leadTypeBuckets.map((b: any) => ({
          type: b.key,
          count: b.doc_count,
          percentage: leadsTotal > 0 ? Math.round(b.doc_count / leadsTotal * 1000) / 10 : 0,
        })),
        conversionRate: leadsTotal > 0 
          ? Math.round((leadsAggs.inactive?.doc_count || 0) / leadsTotal * 1000) / 10 
          : 0,
      };

      // Build growth trends
      const monthBuckets = contactsAggs.monthly_growth?.buckets || [];
      let runningTotal = 0;
      const growthTrends: ContactGrowthTrend[] = monthBuckets.map((b: any) => {
        runningTotal += b.doc_count;
        return {
          month: b.key_as_string,
          totalContacts: runningTotal,
          newContacts: b.doc_count,
          speakersAdded: 0, // Not available in ES index
        };
      });

      // Speaker metrics (not available in ES - contacts index doesn't have isEligibleSpeaker)
      const speakerMetrics: SpeakerMetrics = {
        totalSpeakers: 0,
        averageEventsPerSpeaker: 0,
        mostActiveSpeakers: [],
        speakerUtilizationRate: 0,
      };

      // Interaction metrics (not available in ES - no interactions index)
      const interactionMetrics: InteractionMetrics = {
        totalInteractions: 0,
        interactionsByType: [],
        monthlyTrends: [],
        averageInteractionsPerLead: 0,
      };

      console.log('[ContactsAnalytics] ES aggregation successful');
      return {
        summary,
        byOrganization,
        byCountry,
        byPosition,
        speakerMetrics,
        leadsSummary,
        interactionMetrics,
        growthTrends,
      };
    } catch (error) {
      console.error('[ContactsAnalytics] ES aggregation error:', error);
      return null;
    }
  }

  /**
   * Return empty analytics data structure
   */
  private getEmptyAnalyticsData(): ContactsAnalyticsData {
    return {
      summary: {
        totalContacts: 0,
        eligibleSpeakers: 0,
        contactsWithEmail: 0,
        contactsWithPhone: 0,
        contactsWithOrganization: 0,
        dataCompletenessScore: 0,
        newContactsThisMonth: 0,
        growthRate: 0,
      },
      byOrganization: [],
      byCountry: [],
      byPosition: [],
      speakerMetrics: {
        totalSpeakers: 0,
        averageEventsPerSpeaker: 0,
        mostActiveSpeakers: [],
        speakerUtilizationRate: 0,
      },
      leadsSummary: {
        totalLeads: 0,
        activeLeads: 0,
        inProgressLeads: 0,
        inactiveLeads: 0,
        leadsByType: [],
        conversionRate: 0,
      },
      interactionMetrics: {
        totalInteractions: 0,
        interactionsByType: [],
        monthlyTrends: [],
        averageInteractionsPerLead: 0,
      },
      growthTrends: [],
    };
  }

  /**
   * Get contacts analytics from SQL (fallback)
   */
  private async getContactsAnalyticsFromSQL(year: number): Promise<ContactsAnalyticsData> {
    const [
      summary,
      byOrganization,
      byCountry,
      byPosition,
      speakerMetrics,
      leadsSummary,
      interactionMetrics,
      growthTrends,
    ] = await Promise.all([
      this.getSummary(year),
      this.getByOrganization(),
      this.getByCountry(),
      this.getByPosition(),
      this.getSpeakerMetrics(year),
      this.getLeadsSummary(),
      this.getInteractionMetrics(year),
      this.getGrowthTrends(year),
    ]);

    return {
      summary,
      byOrganization,
      byCountry,
      byPosition,
      speakerMetrics,
      leadsSummary,
      interactionMetrics,
      growthTrends,
    };
  }

  /**
   * Get contacts summary statistics
   */
  async getSummary(year: number): Promise<ContactsSummary> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Total contacts
    const [totalResult] = await db.select({ count: count() }).from(contacts);
    const totalContacts = totalResult?.count || 0;

    // Eligible speakers
    const [speakersResult] = await db
      .select({ count: count() })
      .from(contacts)
      .where(eq(contacts.isEligibleSpeaker, true));
    const eligibleSpeakers = speakersResult?.count || 0;

    // Contacts with email
    const [emailResult] = await db
      .select({ count: count() })
      .from(contacts)
      .where(isNotNull(contacts.email));
    const contactsWithEmail = emailResult?.count || 0;

    // Contacts with phone
    const [phoneResult] = await db
      .select({ count: count() })
      .from(contacts)
      .where(isNotNull(contacts.phone));
    const contactsWithPhone = phoneResult?.count || 0;

    // Contacts with organization
    const [orgResult] = await db
      .select({ count: count() })
      .from(contacts)
      .where(isNotNull(contacts.organizationId));
    const contactsWithOrganization = orgResult?.count || 0;

    // New contacts this month
    const [thisMonthResult] = await db
      .select({ count: count() })
      .from(contacts)
      .where(gte(contacts.createdAt, startOfMonth));
    const newContactsThisMonth = thisMonthResult?.count || 0;

    // Last month contacts for growth rate
    const [lastMonthResult] = await db
      .select({ count: count() })
      .from(contacts)
      .where(
        and(
          gte(contacts.createdAt, startOfLastMonth),
          lte(contacts.createdAt, startOfMonth)
        )
      );
    const lastMonthContacts = lastMonthResult?.count || 0;

    // Calculate growth rate
    const growthRate = lastMonthContacts > 0
      ? Math.round((newContactsThisMonth - lastMonthContacts) / lastMonthContacts * 1000) / 10
      : newContactsThisMonth > 0 ? 100 : 0;

    // Calculate data completeness score
    // Score based on: email (25%), phone (25%), organization (25%), name (25% - always filled)
    const emailScore = totalContacts > 0 ? (contactsWithEmail / totalContacts) * 25 : 0;
    const phoneScore = totalContacts > 0 ? (contactsWithPhone / totalContacts) * 25 : 0;
    const orgScore = totalContacts > 0 ? (contactsWithOrganization / totalContacts) * 25 : 0;
    const nameScore = 25; // Always filled
    const dataCompletenessScore = Math.round(emailScore + phoneScore + orgScore + nameScore);

    return {
      totalContacts,
      eligibleSpeakers,
      contactsWithEmail,
      contactsWithPhone,
      contactsWithOrganization,
      dataCompletenessScore,
      newContactsThisMonth,
      growthRate,
    };
  }

  /**
   * Get contacts grouped by organization
   */
  private async getByOrganization(): Promise<ContactsByOrganization[]> {
    const result = await db
      .select({
        organizationId: contacts.organizationId,
        organizationName: organizations.nameEn,
        count: count(),
      })
      .from(contacts)
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .groupBy(contacts.organizationId, organizations.nameEn)
      .orderBy(desc(count()))
      .limit(15);

    const total = result.reduce((sum: number, r: { count: number }) => sum + r.count, 0);

    return result.map((r) => ({
      organizationId: r.organizationId,
      organizationName: r.organizationName || 'Not Assigned',
      count: r.count,
      percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
    }));
  }

  /**
   * Get contacts grouped by country
   */
  private async getByCountry(): Promise<ContactsByCountry[]> {
    const result = await db
      .select({
        countryId: contacts.countryId,
        countryName: countries.nameEn,
        countryCode: countries.code,
        count: count(),
      })
      .from(contacts)
      .leftJoin(countries, eq(contacts.countryId, countries.id))
      .groupBy(contacts.countryId, countries.nameEn, countries.code)
      .orderBy(desc(count()))
      .limit(15);

    const total = result.reduce((sum: number, r: { count: number }) => sum + r.count, 0);

    return result.map((r) => ({
      countryId: r.countryId,
      countryName: r.countryName || 'Not Specified',
      countryCode: r.countryCode || '--',
      count: r.count,
      percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
    }));
  }

  /**
   * Get contacts grouped by position
   */
  private async getByPosition(): Promise<ContactsByPosition[]> {
    const result = await db
      .select({
        positionId: contacts.positionId,
        positionName: positions.nameEn,
        count: count(),
      })
      .from(contacts)
      .leftJoin(positions, eq(contacts.positionId, positions.id))
      .groupBy(contacts.positionId, positions.nameEn)
      .orderBy(desc(count()))
      .limit(15);

    const total = result.reduce((sum: number, r: { count: number }) => sum + r.count, 0);

    return result.map((r) => ({
      positionId: r.positionId,
      positionName: r.positionName || 'Not Specified',
      count: r.count,
      percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
    }));
  }

  /**
   * Get speaker-related metrics
   */
  private async getSpeakerMetrics(year: number): Promise<SpeakerMetrics> {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);

    // Total eligible speakers
    const [speakersResult] = await db
      .select({ count: count() })
      .from(contacts)
      .where(eq(contacts.isEligibleSpeaker, true));
    const totalSpeakers = speakersResult?.count || 0;

    // Speaker engagement statistics
    const speakerEngagements = await db
      .select({
        contactId: eventSpeakers.contactId,
        eventCount: count(),
      })
      .from(eventSpeakers)
      .innerJoin(events, eq(eventSpeakers.eventId, events.id))
      .where(
        and(
          gte(events.startDate, startOfYear.toISOString().split('T')[0]),
          lte(events.startDate, endOfYear.toISOString().split('T')[0])
        )
      )
      .groupBy(eventSpeakers.contactId);

    // Calculate average events per speaker
    const totalEngagements = speakerEngagements.reduce(
      (sum: number, s: { eventCount: number }) => sum + s.eventCount, 0
    );
    const uniqueSpeakersUsed = speakerEngagements.length;
    const averageEventsPerSpeaker =
      uniqueSpeakersUsed > 0 ? Math.round((totalEngagements / uniqueSpeakersUsed) * 10) / 10 : 0;

    // Speaker utilization rate
    const speakerUtilizationRate =
      totalSpeakers > 0 ? Math.round((uniqueSpeakersUsed / totalSpeakers) * 1000) / 10 : 0;

    // Get most active speakers with details
    const sortedEngagements = [...speakerEngagements].sort(
      (a: { eventCount: number }, b: { eventCount: number }) => b.eventCount - a.eventCount
    );
    const topSpeakerIds = sortedEngagements.slice(0, 10).map((s) => s.contactId);

    const mostActiveSpeakers: ActiveSpeaker[] = [];
    for (const contactId of topSpeakerIds) {
      const [contact] = await db
        .select({ nameEn: contacts.nameEn })
        .from(contacts)
        .where(eq(contacts.id, contactId));

      const roles = await db
        .select({ role: eventSpeakers.role })
        .from(eventSpeakers)
        .innerJoin(events, eq(eventSpeakers.eventId, events.id))
        .where(
          and(
            eq(eventSpeakers.contactId, contactId),
            gte(events.startDate, startOfYear.toISOString().split('T')[0])
          )
        );

      const roleStrings = roles.map((r) => r.role).filter((r): r is string => !!r);
      const uniqueRoles = Array.from(new Set(roleStrings));

      const engagement = speakerEngagements.find(
        (s: { contactId: number }) => s.contactId === contactId
      );
      if (contact && engagement) {
        mostActiveSpeakers.push({
          contactId,
          name: contact.nameEn,
          eventCount: engagement.eventCount,
          roles: uniqueRoles,
        });
      }
    }

    return {
      totalSpeakers,
      averageEventsPerSpeaker,
      mostActiveSpeakers,
      speakerUtilizationRate,
    };
  }

  /**
   * Get leads summary
   */
  async getLeadsSummary(): Promise<LeadsSummary> {
    // Total leads
    const [totalResult] = await db.select({ count: count() }).from(leads);
    const totalLeads = totalResult?.count || 0;

    // By status
    const statusCounts = await db
      .select({
        status: leads.status,
        count: count(),
      })
      .from(leads)
      .groupBy(leads.status);

    const activeLeads = statusCounts.find(
      (s: { status: string; count: number }) => s.status === 'active'
    )?.count || 0;
    const inProgressLeads = statusCounts.find(
      (s: { status: string; count: number }) => s.status === 'in_progress'
    )?.count || 0;
    const inactiveLeads = statusCounts.find(
      (s: { status: string; count: number }) => s.status === 'inactive'
    )?.count || 0;

    // By type
    const typeCounts = await db
      .select({
        type: leads.type,
        count: count(),
      })
      .from(leads)
      .groupBy(leads.type)
      .orderBy(desc(count()));

    const leadsByType: LeadsByType[] = typeCounts.map(
      (t: { type: string; count: number }) => ({
        type: t.type,
        count: t.count,
        percentage: totalLeads > 0 ? Math.round((t.count / totalLeads) * 1000) / 10 : 0,
      })
    );

    // Conversion rate (inactive leads are considered "converted" or completed)
    const conversionRate = totalLeads > 0 ? Math.round((inactiveLeads / totalLeads) * 1000) / 10 : 0;

    return {
      totalLeads,
      activeLeads,
      inProgressLeads,
      inactiveLeads,
      leadsByType,
      conversionRate,
    };
  }

  /**
   * Get interaction metrics
   */
  private async getInteractionMetrics(year: number): Promise<InteractionMetrics> {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);

    // Total interactions this year
    const [totalResult] = await db
      .select({ count: count() })
      .from(leadInteractions)
      .where(
        and(
          gte(leadInteractions.interactionDate, startOfYear),
          lte(leadInteractions.interactionDate, endOfYear)
        )
      );
    const totalInteractions = totalResult?.count || 0;

    // By type
    const typeCounts = await db
      .select({
        type: leadInteractions.type,
        count: count(),
      })
      .from(leadInteractions)
      .where(
        and(
          gte(leadInteractions.interactionDate, startOfYear),
          lte(leadInteractions.interactionDate, endOfYear)
        )
      )
      .groupBy(leadInteractions.type)
      .orderBy(desc(count()));

    const interactionsByType: InteractionByType[] = typeCounts.map(
      (t: { type: string; count: number }) => ({
        type: t.type,
        count: t.count,
        percentage: totalInteractions > 0 ? Math.round((t.count / totalInteractions) * 1000) / 10 : 0,
      })
    );

    // Monthly trends
    const monthlyData = await db
      .select({
        month: sql<string>`TO_CHAR(${leadInteractions.interactionDate}, 'YYYY-MM')`.as('month'),
        type: leadInteractions.type,
        count: count(),
      })
      .from(leadInteractions)
      .where(
        and(
          gte(leadInteractions.interactionDate, startOfYear),
          lte(leadInteractions.interactionDate, endOfYear)
        )
      )
      .groupBy(sql`TO_CHAR(${leadInteractions.interactionDate}, 'YYYY-MM')`, leadInteractions.type)
      .orderBy(sql`TO_CHAR(${leadInteractions.interactionDate}, 'YYYY-MM')`);

    // Group monthly data
    const monthlyMap = new Map<string, InteractionTrend>();
    for (const row of monthlyData) {
      if (!monthlyMap.has(row.month)) {
        monthlyMap.set(row.month, {
          month: row.month,
          emailCount: 0,
          phoneCount: 0,
          meetingCount: 0,
          otherCount: 0,
          total: 0,
        });
      }
      const trend = monthlyMap.get(row.month)!;
      trend.total += row.count;
      switch (row.type) {
        case 'email':
          trend.emailCount = row.count;
          break;
        case 'phone_call':
          trend.phoneCount = row.count;
          break;
        case 'meeting':
          trend.meetingCount = row.count;
          break;
        default:
          trend.otherCount += row.count;
      }
    }

    const monthlyTrends = Array.from(monthlyMap.values());

    // Average interactions per lead
    const [leadsWithInteractions] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${leadInteractions.leadId})` })
      .from(leadInteractions)
      .where(
        and(
          gte(leadInteractions.interactionDate, startOfYear),
          lte(leadInteractions.interactionDate, endOfYear)
        )
      );
    const uniqueLeadsWithInteractions = leadsWithInteractions?.count || 0;
    const averageInteractionsPerLead =
      uniqueLeadsWithInteractions > 0
        ? Math.round((totalInteractions / uniqueLeadsWithInteractions) * 10) / 10
        : 0;

    return {
      totalInteractions,
      interactionsByType,
      monthlyTrends,
      averageInteractionsPerLead,
    };
  }

  /**
   * Get monthly growth trends for contacts
   */
  private async getGrowthTrends(year: number): Promise<ContactGrowthTrend[]> {
    const trends: ContactGrowthTrend[] = [];
    const startOfYear = new Date(year, 0, 1);

    // Get running totals by month
    for (let month = 0; month < 12; month++) {
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 1);

      // If this month is in the future, skip
      if (startOfMonth > new Date()) break;

      // Total contacts up to end of month
      const [totalResult] = await db
        .select({ count: count() })
        .from(contacts)
        .where(lte(contacts.createdAt, endOfMonth));

      // New contacts in this month
      const [newResult] = await db
        .select({ count: count() })
        .from(contacts)
        .where(
          and(
            gte(contacts.createdAt, startOfMonth),
            lte(contacts.createdAt, endOfMonth)
          )
        );

      // New speakers in this month
      const [speakersResult] = await db
        .select({ count: count() })
        .from(contacts)
        .where(
          and(
            eq(contacts.isEligibleSpeaker, true),
            gte(contacts.createdAt, startOfMonth),
            lte(contacts.createdAt, endOfMonth)
          )
        );

      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
      trends.push({
        month: monthStr,
        totalContacts: totalResult?.count || 0,
        newContacts: newResult?.count || 0,
        speakersAdded: speakersResult?.count || 0,
      });
    }

    return trends;
  }
}

export const contactsAnalyticsService = new ContactsAnalyticsService();
