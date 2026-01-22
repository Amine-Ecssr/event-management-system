/**
 * Partnerships Analytics Service
 * 
 * Provides analytics data for partnerships dashboard including:
 * - Partnership summary KPIs
 * - Partners by country/region
 * - Most active partners (by activities)
 * - Activity type breakdown
 * - Agreement type distribution
 * - Partner performance metrics
 * - Monthly trends
 * - Recent activity feed
 * 
 * UPDATED: Now uses Elasticsearch for all aggregations (SQL fallback DISABLED for testing)
 */

import { db } from "../db";
import {
  partnershipAgreements,
  organizations,
  agreementTypes,
  partnershipActivities,
  countries,
} from "@shared/schema";
import { eq, and, gte, lte, desc, asc, count, sql, isNotNull } from "drizzle-orm";
import { getOptionalElasticsearchClient, isElasticsearchEnabled } from '../elasticsearch/client';
import { ES_INDEX_PREFIX, ES_INDEX_SUFFIX } from '../elasticsearch/config';

// TEMPORARY: Set to false to disable SQL fallback and force ES-only
const ENABLE_SQL_FALLBACK = false;

// ============================================================================
// Types
// ============================================================================

export interface PartnershipsSummary {
  totalPartnerships: number;
  activeAgreements: number;
  pendingAgreements: number;
  expiringThisMonth: number;
  expiringThisQuarter: number;
  newThisMonth: number;
  totalPartnerOrganizations: number;
  avgAgreementDuration: number;
  totalActivities: number;
  activitiesThisMonth: number;
}

// Partners by Country
export interface PartnersByCountry {
  countryId: number | null;
  countryNameEn: string;
  countryNameAr: string | null;
  partnerCount: number;
  activeAgreements: number;
  totalActivities: number;
}

// Most Active Partners (by activity count)
export interface MostActivePartner {
  organizationId: number;
  organizationName: string;
  organizationNameAr: string | null;
  countryName: string | null;
  totalActivities: number;
  lastActivityDate: string | null;
  activityBreakdown: { type: string; count: number }[];
  activeAgreements: number;
  partnerSince: string | null;
}

// Activity Type Breakdown
export interface ActivityTypeBreakdown {
  activityType: string;
  count: number;
  percentage: number;
  avgImpactScore: number | null;
}

export interface PipelineAgreement {
  id: number;
  organizationName: string;
  agreementType: string;
  signedDate: string;
  expiryDate: string;
  value: number;
  status: string;
}

export interface PipelineStage {
  count: number;
  value: number;
  agreements: PipelineAgreement[];
}

export interface PipelineData {
  draft: PipelineStage;
  pending: PipelineStage;
  active: PipelineStage;
  expiring: PipelineStage;
  expired: PipelineStage;
  renewed: PipelineStage;
}

export interface RenewalItem {
  id: number;
  organizationName: string;
  agreementType: string;
  expiryDate: string;
  daysUntilExpiry: number;
  value: number;
  priority: 'high' | 'medium' | 'low';
}

export interface AgreementTypeData {
  type: string;
  count: number;
  percentage: number;
  totalValue: number;
  avgDuration: number;
}

export interface PartnerPerformanceData {
  organizationId: number;
  organizationName: string;
  totalAgreements: number;
  activeAgreements: number;
  totalValue: number;
  eventsSponsored: number;
  partnerSince: string;
  renewalRate: number;
}

export interface FinancialMetrics {
  totalActiveValue: number;
  projectedRenewalValue: number;
  avgAgreementValue: number;
  valueByType: { type: string; value: number }[];
  monthlyRevenue: { month: string; value: number }[];
  yearOverYearGrowth: number;
}

export interface PartnershipTrend {
  month: string;
  newAgreements: number;
  renewals: number;
  expirations: number;
  netChange: number;
  activities: number;
}

export interface PartnershipActivity {
  id: number;
  type: 'created' | 'renewed' | 'expired' | 'updated' | 'activity';
  organizationName: string;
  agreementType: string;
  date: string;
  description: string;
}

export interface PartnershipsAnalyticsData {
  summary: PartnershipsSummary;
  partnersByCountry: PartnersByCountry[];
  mostActivePartners: MostActivePartner[];
  activityTypeBreakdown: ActivityTypeBreakdown[];
  pipeline: PipelineData;
  renewalCalendar: RenewalItem[];
  agreementTypeBreakdown: AgreementTypeData[];
  partnerPerformance: PartnerPerformanceData[];
  financialMetrics: FinancialMetrics;
  monthlyTrends: PartnershipTrend[];
  recentActivity: PartnershipActivity[];
}

// ============================================================================
// Service Class
// ============================================================================

class PartnershipsAnalyticsService {
  private buildIndexName(entity: string): string {
    return `${ES_INDEX_PREFIX}-${entity}-${ES_INDEX_SUFFIX}`;
  }

  /**
   * Get comprehensive partnerships analytics dashboard data
   * Now uses Elasticsearch for all aggregations
   */
  async getPartnershipsAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Promise<PartnershipsAnalyticsData> {
    const start = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
    const end = endDate || new Date();

    // Try ES first
    if (isElasticsearchEnabled()) {
      console.log('[PartnershipsAnalytics] Using Elasticsearch for aggregations');
      const esData = await this.getPartnershipsAnalyticsFromES(start, end);
      if (esData) return esData;
    }

    // SQL fallback (disabled for testing)
    if (!ENABLE_SQL_FALLBACK) {
      console.warn('[PartnershipsAnalytics] SQL fallback is DISABLED - returning empty data');
      return this.getEmptyAnalyticsData();
    }

    console.log('[PartnershipsAnalytics] Falling back to SQL queries');
    return this.getPartnershipsAnalyticsFromSQL(start, end);
  }

  /**
   * Get partnerships analytics from Elasticsearch
   */
  private async getPartnershipsAnalyticsFromES(
    startDate: Date,
    endDate: Date
  ): Promise<PartnershipsAnalyticsData | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) {
      console.warn('[PartnershipsAnalytics] ES client not available');
      return null;
    }

    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const quarterEnd = new Date(now.getFullYear(), Math.ceil((now.getMonth() + 1) / 3) * 3, 0);

      // Fetch organization and country names for lookup
      const [allOrganizations, allCountries] = await Promise.all([
        db.select({ id: organizations.id, name: organizations.nameEn, countryId: organizations.countryId }).from(organizations),
        db.select({ id: countries.id, name: countries.nameEn }).from(countries),
      ]);
      const orgMap = new Map(allOrganizations.map(o => [o.id, { name: o.name, countryId: o.countryId }]));
      const countryMap = new Map(allCountries.map(c => [c.id, c.name]));

      // Execute ES queries in parallel
      const [
        agreementsResponse,
        activitiesResponse,
        organizationsResponse,
        trendsResponse
      ] = await Promise.all([
        // Agreements summary and breakdowns
        client.search({
          index: this.buildIndexName('agreements'),
          body: {
            size: 0,
            track_total_hits: true,
            aggs: {
              by_status: {
                terms: { field: 'status', size: 20 }
              },
              by_agreement_type: {
                terms: { field: 'agreementTypeName', size: 20 }
              },
              active: {
                filter: { term: { 'status': 'active' } }
              },
              pending: {
                filter: { term: { 'status': 'pending_approval' } }
              },
              expiring_this_month: {
                filter: {
                  bool: {
                    must: [
                      { term: { 'status': 'active' } },
                      { range: { endDate: { gte: now.toISOString(), lte: monthEnd.toISOString() } } }
                    ]
                  }
                }
              },
              expiring_this_quarter: {
                filter: {
                  bool: {
                    must: [
                      { term: { 'status': 'active' } },
                      { range: { endDate: { gte: now.toISOString(), lte: quarterEnd.toISOString() } } }
                    ]
                  }
                }
              },
              new_this_month: {
                filter: {
                  range: { startDate: { gte: monthStart.toISOString() } }
                }
              },
              unique_partners: {
                cardinality: { field: 'organizationId' }
              },
              avg_duration: {
                avg: { field: 'durationDays' }
              },
              // Pipeline stages
              pipeline_draft: { filter: { term: { 'status': 'draft' } } },
              pipeline_pending: { filter: { term: { 'status': 'pending_approval' } } },
              pipeline_active: { filter: { term: { 'status': 'active' } } },
              pipeline_expired: { filter: { term: { 'status': 'expired' } } },
              pipeline_renewed: { filter: { term: { 'status': 'renewed' } } },
              // Renewal calendar - agreements expiring in next 90 days
              renewal_candidates: {
                filter: {
                  bool: {
                    must: [
                      { term: { 'status': 'active' } },
                      { range: { endDate: { gte: now.toISOString(), lte: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString() } } }
                    ]
                  }
                },
                aggs: {
                  items: {
                    top_hits: {
                      size: 20,
                      sort: [{ endDate: 'asc' }],
                      _source: ['id', 'organizationName', 'agreementTypeName', 'endDate', 'value', 'status']
                    }
                  }
                }
              }
            }
          }
        }),

        // Activities summary and breakdowns
        client.search({
          index: this.buildIndexName('partnership-activities'),
          body: {
            size: 0,
            track_total_hits: true,
            aggs: {
              by_type: {
                terms: { field: 'activityType', size: 20 },
                aggs: {
                  avg_impact: { avg: { field: 'impactScore' } }
                }
              },
              this_month: {
                filter: {
                  range: { startDate: { gte: monthStart.toISOString() } }
                }
              },
              by_organization: {
                terms: { field: 'organizationId', size: 20 },
                aggs: {
                  org_name: { terms: { field: 'organizationName', size: 1 } },
                  last_activity: { max: { field: 'startDate' } },
                  by_type: { terms: { field: 'activityType', size: 10 } }
                }
              },
              recent: {
                top_hits: {
                  size: 10,
                  sort: [{ startDate: 'desc' }],
                  _source: ['id', 'organizationName', 'activityType', 'title', 'startDate', 'description']
                }
              }
            }
          }
        }),

        // Organizations by country
        client.search({
          index: this.buildIndexName('organizations'),
          body: {
            size: 0,
            query: { term: { isPartner: true } },
            aggs: {
              by_country: {
                terms: { field: 'country', size: 50, missing: 'Unknown' },
                aggs: {
                  country_name: { terms: { field: 'countryName', size: 1 } }
                }
              }
            }
          }
        }),

        // Monthly trends - uses startDate (mapped from effectiveDate in transform)
        client.search({
          index: this.buildIndexName('agreements'),
          body: {
            size: 0,
            query: {
              range: { startDate: { gte: startDate.toISOString(), lte: endDate.toISOString() } }
            },
            aggs: {
              by_month: {
                date_histogram: {
                  field: 'startDate',
                  calendar_interval: 'month',
                  format: 'yyyy-MM'
                },
                aggs: {
                  new_agreements: { value_count: { field: 'id' } },
                  expirations: {
                    filter: {
                      range: { endDate: { gte: 'now/M', lt: 'now+1M/M' } }
                    }
                  }
                }
              }
            }
          }
        })
      ]);

      // Parse agreements response
      const agreementsTotal = (agreementsResponse.hits.total as { value: number }).value;
      const aggsAgreements = agreementsResponse.aggregations as any;

      // Parse activities response
      const activitiesTotal = (activitiesResponse.hits.total as { value: number }).value;
      const aggsActivities = activitiesResponse.aggregations as any;

      // Parse organizations response
      const aggsOrgs = organizationsResponse.aggregations as any;

      // Parse trends response
      const aggsTrends = trendsResponse.aggregations as any;

      // Build summary
      const summary: PartnershipsSummary = {
        totalPartnerships: agreementsTotal,
        activeAgreements: aggsAgreements.active?.doc_count || 0,
        pendingAgreements: aggsAgreements.pending?.doc_count || 0,
        expiringThisMonth: aggsAgreements.expiring_this_month?.doc_count || 0,
        expiringThisQuarter: aggsAgreements.expiring_this_quarter?.doc_count || 0,
        newThisMonth: aggsAgreements.new_this_month?.doc_count || 0,
        totalPartnerOrganizations: aggsAgreements.unique_partners?.value || 0,
        avgAgreementDuration: Math.round(aggsAgreements.avg_duration?.value || 0),
        totalActivities: activitiesTotal,
        activitiesThisMonth: aggsActivities.this_month?.doc_count || 0,
      };

      // Build partners by country (aggregate from organizations data)
      // Group organizations by country
      const countryPartnerCounts = new Map<number, number>();
      for (const org of allOrganizations) {
        if (org.countryId) {
          countryPartnerCounts.set(org.countryId, (countryPartnerCounts.get(org.countryId) || 0) + 1);
        }
      }
      const partnersByCountry: PartnersByCountry[] = Array.from(countryPartnerCounts.entries())
        .map(([countryId, count]) => ({
          countryId,
          countryNameEn: countryMap.get(countryId) || 'Unknown',
          countryNameAr: null,
          partnerCount: count,
          activeAgreements: 0,
          totalActivities: 0,
        }))
        .sort((a, b) => b.partnerCount - a.partnerCount)
        .slice(0, 10);

      // Build most active partners (using PostgreSQL lookup for names)
      const orgBuckets = aggsActivities.by_organization?.buckets || [];
      const mostActivePartners: MostActivePartner[] = orgBuckets.slice(0, 10).map((b: any) => {
        const orgInfo = orgMap.get(b.key);
        const countryName = orgInfo?.countryId ? countryMap.get(orgInfo.countryId) : null;
        return {
          organizationId: b.key,
          organizationName: orgInfo?.name || `Unknown Partner`,
          organizationNameAr: null,
          countryName: countryName || null,
          totalActivities: b.doc_count,
          lastActivityDate: b.last_activity?.value_as_string || null,
          activityBreakdown: (b.by_type?.buckets || []).map((t: any) => ({
            type: t.key,
            count: t.doc_count
          })),
          activeAgreements: 0,
          partnerSince: null,
        };
      });

      // Build activity type breakdown
      const activityTypeBuckets = aggsActivities.by_type?.buckets || [];
      const activityTypeBreakdown: ActivityTypeBreakdown[] = activityTypeBuckets.map((b: any) => ({
        activityType: b.key,
        count: b.doc_count,
        percentage: activitiesTotal > 0 ? Math.round(b.doc_count / activitiesTotal * 1000) / 10 : 0,
        avgImpactScore: b.avg_impact?.value || null,
      }));

      // Build agreement type breakdown
      const agreementTypeBuckets = aggsAgreements.by_agreement_type?.buckets || [];
      const agreementTypeBreakdown: AgreementTypeData[] = agreementTypeBuckets.map((b: any) => ({
        type: b.key,
        count: b.doc_count,
        percentage: agreementsTotal > 0 ? Math.round(b.doc_count / agreementsTotal * 1000) / 10 : 0,
        totalValue: 0,
        avgDuration: 0,
      }));

      // Build pipeline
      const pipeline: PipelineData = {
        draft: { count: aggsAgreements.pipeline_draft?.doc_count || 0, value: 0, agreements: [] },
        pending: { count: aggsAgreements.pipeline_pending?.doc_count || 0, value: 0, agreements: [] },
        active: { count: aggsAgreements.pipeline_active?.doc_count || 0, value: 0, agreements: [] },
        expiring: { count: aggsAgreements.expiring_this_quarter?.doc_count || 0, value: 0, agreements: [] },
        expired: { count: aggsAgreements.pipeline_expired?.doc_count || 0, value: 0, agreements: [] },
        renewed: { count: aggsAgreements.pipeline_renewed?.doc_count || 0, value: 0, agreements: [] },
      };

      // Build renewal calendar
      const renewalHits = aggsAgreements.renewal_candidates?.items?.hits?.hits || [];
      const renewalCalendar: RenewalItem[] = renewalHits.map((hit: any) => {
        const source = hit._source;
        const endDateValue = new Date(source.endDate);
        const daysUntilExpiry = Math.ceil((endDateValue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: source.id,
          organizationName: source.organizationName,
          agreementType: source.agreementTypeName,
          expiryDate: source.endDate, // Map endDate from ES to expiryDate for API response
          value: source.value || 0,
          daysUntilExpiry,
          status: source.status,
          priority: daysUntilExpiry <= 30 ? 'high' : daysUntilExpiry <= 60 ? 'medium' : 'low',
        };
      });

      // Build monthly trends
      const monthBuckets = aggsTrends.by_month?.buckets || [];
      const monthlyTrends: PartnershipTrend[] = monthBuckets.map((b: any) => ({
        month: b.key_as_string,
        newAgreements: b.new_agreements?.value || b.doc_count,
        expirations: b.expirations?.doc_count || 0,
        activities: 0, // Would need separate query
        renewals: 0,
      }));

      // Build recent activity
      const recentHits = aggsActivities.recent?.hits?.hits || [];
      const recentActivity: PartnershipActivity[] = recentHits.map((hit: any) => {
        const source = hit._source;
        return {
          id: source.id,
          type: 'activity' as const,
          organizationName: source.organizationName,
          agreementType: source.activityType || 'Activity',
          date: source.startDate,
          description: source.description || source.title,
        };
      });

      console.log('[PartnershipsAnalytics] ES aggregation successful');
      return {
        summary,
        partnersByCountry,
        mostActivePartners,
        activityTypeBreakdown,
        pipeline,
        renewalCalendar,
        agreementTypeBreakdown,
        partnerPerformance: [], // Empty for now - complex metric
        financialMetrics: { totalActiveValue: 0, projectedRenewalValue: 0, avgAgreementValue: 0, valueByType: [], monthlyRevenue: [], yearOverYearGrowth: 0 },
        monthlyTrends,
        recentActivity,
      };
    } catch (error) {
      console.error('[PartnershipsAnalytics] ES aggregation error:', error);
      return null;
    }
  }

  /**
   * Return empty analytics data structure
   */
  private getEmptyAnalyticsData(): PartnershipsAnalyticsData {
    return {
      summary: {
        totalPartnerships: 0,
        activeAgreements: 0,
        pendingAgreements: 0,
        expiringThisMonth: 0,
        expiringThisQuarter: 0,
        newThisMonth: 0,
        totalPartnerOrganizations: 0,
        avgAgreementDuration: 0,
        totalActivities: 0,
        activitiesThisMonth: 0,
      },
      partnersByCountry: [],
      mostActivePartners: [],
      activityTypeBreakdown: [],
      pipeline: {
        draft: { count: 0, value: 0, agreements: [] },
        pending: { count: 0, value: 0, agreements: [] },
        active: { count: 0, value: 0, agreements: [] },
        expiring: { count: 0, value: 0, agreements: [] },
        expired: { count: 0, value: 0, agreements: [] },
        renewed: { count: 0, value: 0, agreements: [] },
      },
      renewalCalendar: [],
      agreementTypeBreakdown: [],
      partnerPerformance: [],
      financialMetrics: { totalActiveValue: 0, projectedRenewalValue: 0, avgAgreementValue: 0, valueByType: [], monthlyRevenue: [], yearOverYearGrowth: 0 },
      monthlyTrends: [],
      recentActivity: [],
    };
  }

  /**
   * Get partnerships analytics from SQL (fallback)
   */
  private async getPartnershipsAnalyticsFromSQL(
    startDate: Date,
    endDate: Date
  ): Promise<PartnershipsAnalyticsData> {
    const [
      summary,
      partnersByCountry,
      mostActivePartners,
      activityTypeBreakdown,
      pipeline,
      renewalCalendar,
      agreementTypeBreakdown,
      partnerPerformance,
      financialMetrics,
      monthlyTrends,
      recentActivity,
    ] = await Promise.all([
      this.getSummary(),
      this.getPartnersByCountry(),
      this.getMostActivePartners(),
      this.getActivityTypeBreakdown(),
      this.getPipeline(),
      this.getRenewalCalendar(),
      this.getAgreementTypeBreakdown(),
      this.getPartnerPerformance(),
      this.getFinancialMetrics(startDate, endDate),
      this.getMonthlyTrends(startDate, endDate),
      this.getRecentActivity(),
    ]);

    return {
      summary,
      partnersByCountry,
      mostActivePartners,
      activityTypeBreakdown,
      pipeline,
      renewalCalendar,
      agreementTypeBreakdown,
      partnerPerformance,
      financialMetrics,
      monthlyTrends,
      recentActivity,
    };
  }

  /**
   * Get summary statistics for partnerships
   */
  private async getSummary(): Promise<PartnershipsSummary> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const quarterEnd = new Date(now.getFullYear(), Math.ceil((now.getMonth() + 1) / 3) * 3, 0);

    const [
      totalResult,
      activeResult,
      pendingResult,
      expiringMonthResult,
      expiringQuarterResult,
      newMonthResult,
      partnersResult,
      totalActivitiesResult,
      activitiesThisMonthResult,
    ] = await Promise.all([
      // Total partnerships
      db.select({ count: count() }).from(partnershipAgreements),
      
      // Active agreements
      db.select({ count: count() })
        .from(partnershipAgreements)
        .where(eq(partnershipAgreements.status, 'active')),
      
      // Pending agreements
      db.select({ count: count() })
        .from(partnershipAgreements)
        .where(eq(partnershipAgreements.status, 'pending_approval')),
      
      // Expiring this month (active agreements with expiry date within this month)
      db.select({ count: count() })
        .from(partnershipAgreements)
        .where(and(
          eq(partnershipAgreements.status, 'active'),
          sql`${partnershipAgreements.expiryDate}::date <= ${monthEnd.toISOString().split('T')[0]}::date`,
          sql`${partnershipAgreements.expiryDate}::date >= ${now.toISOString().split('T')[0]}::date`
        )),
      
      // Expiring this quarter
      db.select({ count: count() })
        .from(partnershipAgreements)
        .where(and(
          eq(partnershipAgreements.status, 'active'),
          sql`${partnershipAgreements.expiryDate}::date <= ${quarterEnd.toISOString().split('T')[0]}::date`,
          sql`${partnershipAgreements.expiryDate}::date >= ${now.toISOString().split('T')[0]}::date`
        )),
      
      // New this month - use effectiveDate for historical accuracy, fallback to createdAt if not set
      db.select({ count: count() })
        .from(partnershipAgreements)
        .where(
          sql`COALESCE(${partnershipAgreements.effectiveDate}, ${partnershipAgreements.createdAt}::date) >= ${monthStart.toISOString().split('T')[0]}::date`
        ),
      
      // Unique partner organizations
      db.select({ count: sql<number>`count(DISTINCT ${partnershipAgreements.organizationId})` })
        .from(partnershipAgreements),
      
      // Total partnership activities
      db.select({ count: count() }).from(partnershipActivities),
      
      // Activities this month
      db.select({ count: count() })
        .from(partnershipActivities)
        .where(sql`${partnershipActivities.startDate}::date >= ${monthStart.toISOString().split('T')[0]}::date`),
    ]);

    // Calculate average agreement duration in days
    const durationResult = await db.select({
      avgDuration: sql<number>`AVG(
        CASE 
          WHEN ${partnershipAgreements.expiryDate} IS NOT NULL AND ${partnershipAgreements.effectiveDate} IS NOT NULL
          THEN (${partnershipAgreements.expiryDate}::date - ${partnershipAgreements.effectiveDate}::date)
          ELSE NULL
        END
      )`,
    }).from(partnershipAgreements);

    return {
      totalPartnerships: totalResult[0]?.count || 0,
      activeAgreements: activeResult[0]?.count || 0,
      pendingAgreements: pendingResult[0]?.count || 0,
      expiringThisMonth: expiringMonthResult[0]?.count || 0,
      expiringThisQuarter: expiringQuarterResult[0]?.count || 0,
      newThisMonth: newMonthResult[0]?.count || 0,
      totalPartnerOrganizations: partnersResult[0]?.count || 0,
      avgAgreementDuration: Math.round(durationResult[0]?.avgDuration || 0),
      totalActivities: totalActivitiesResult[0]?.count || 0,
      activitiesThisMonth: activitiesThisMonthResult[0]?.count || 0,
    };
  }

  /**
   * Get partners grouped by country with activity counts
   */
  private async getPartnersByCountry(): Promise<PartnersByCountry[]> {
    // Get partner organizations with their countries
    const result = await db.select({
      countryId: organizations.countryId,
      countryName: countries.nameEn,
      countryNameAr: countries.nameAr,
      partnerCount: sql<number>`count(DISTINCT ${organizations.id})::int`,
    })
      .from(organizations)
      .leftJoin(countries, eq(organizations.countryId, countries.id))
      .where(eq(organizations.isPartner, true))
      .groupBy(organizations.countryId, countries.nameEn, countries.nameAr)
      .orderBy(desc(sql`count(DISTINCT ${organizations.id})`));

    // Get active agreements per country
    const activeByCountry = await db.select({
      countryId: organizations.countryId,
      activeCount: count(),
    })
      .from(partnershipAgreements)
      .innerJoin(organizations, eq(partnershipAgreements.organizationId, organizations.id))
      .where(eq(partnershipAgreements.status, 'active'))
      .groupBy(organizations.countryId);

    // Get activities per country
    const activitiesByCountry = await db.select({
      countryId: organizations.countryId,
      activityCount: count(),
    })
      .from(partnershipActivities)
      .innerJoin(organizations, eq(partnershipActivities.organizationId, organizations.id))
      .groupBy(organizations.countryId);

    const activeMap = new Map(activeByCountry.map(a => [a.countryId, a.activeCount]));
    const activityMap = new Map(activitiesByCountry.map(a => [a.countryId, a.activityCount]));

    return result.map(r => ({
      countryId: r.countryId,
      countryNameEn: r.countryName || 'Unspecified',
      countryNameAr: r.countryNameAr,
      partnerCount: r.partnerCount,
      activeAgreements: activeMap.get(r.countryId) || 0,
      totalActivities: activityMap.get(r.countryId) || 0,
    }));
  }

  /**
   * Get most active partners ranked by activity count
   */
  private async getMostActivePartners(): Promise<MostActivePartner[]> {
    // Get organizations with their activity counts
    const result = await db.select({
      organizationId: organizations.id,
      organizationName: organizations.nameEn,
      organizationNameAr: organizations.nameAr,
      countryName: countries.nameEn,
      totalActivities: count(partnershipActivities.id),
      lastActivityDate: sql<Date>`MAX(${partnershipActivities.startDate})`,
      partnerSince: organizations.partnershipStartDate,
    })
      .from(organizations)
      .leftJoin(partnershipActivities, eq(partnershipActivities.organizationId, organizations.id))
      .leftJoin(countries, eq(organizations.countryId, countries.id))
      .where(eq(organizations.isPartner, true))
      .groupBy(
        organizations.id, 
        organizations.nameEn, 
        organizations.nameAr, 
        countries.nameEn,
        organizations.partnershipStartDate
      )
      .orderBy(desc(count(partnershipActivities.id)))
      .limit(10);

    // Get activity types per organization
    const activityTypesByOrg = await db.select({
      organizationId: partnershipActivities.organizationId,
      activityType: partnershipActivities.activityType,
      count: count(),
    })
      .from(partnershipActivities)
      .groupBy(partnershipActivities.organizationId, partnershipActivities.activityType);

    // Get active agreements per organization
    const activeByOrg = await db.select({
      organizationId: partnershipAgreements.organizationId,
      activeCount: count(),
    })
      .from(partnershipAgreements)
      .where(eq(partnershipAgreements.status, 'active'))
      .groupBy(partnershipAgreements.organizationId);

    // Build lookup maps
    const activityTypesMap = new Map<number, { type: string; count: number }[]>();
    for (const row of activityTypesByOrg) {
      const orgId = row.organizationId;
      if (!activityTypesMap.has(orgId)) {
        activityTypesMap.set(orgId, []);
      }
      activityTypesMap.get(orgId)!.push({ type: row.activityType, count: row.count });
    }

    const activeMap = new Map(activeByOrg.map(a => [a.organizationId, a.activeCount]));

    return result.map(r => ({
      organizationId: r.organizationId,
      organizationName: r.organizationName,
      organizationNameAr: r.organizationNameAr,
      countryName: r.countryName,
      totalActivities: r.totalActivities,
      lastActivityDate: r.lastActivityDate ? (typeof r.lastActivityDate === 'string' ? r.lastActivityDate : new Date(r.lastActivityDate).toISOString().split('T')[0]) : null,
      activityBreakdown: activityTypesMap.get(r.organizationId) || [],
      activeAgreements: activeMap.get(r.organizationId) || 0,
      partnerSince: r.partnerSince || null,
    }));
  }

  /**
   * Get activity type breakdown with percentages
   */
  private async getActivityTypeBreakdown(): Promise<ActivityTypeBreakdown[]> {
    const result = await db.select({
      activityType: partnershipActivities.activityType,
      count: count(),
      avgImpactScore: sql<number>`AVG(${partnershipActivities.impactScore})`,
    })
      .from(partnershipActivities)
      .groupBy(partnershipActivities.activityType)
      .orderBy(desc(count()));

    const total = result.reduce((sum, r) => sum + r.count, 0);

    // Activity type labels
    const typeLabels: Record<string, string> = {
      'joint_event': 'Joint Events',
      'sponsorship': 'Sponsorships',
      'collaboration': 'Collaborations',
      'training': 'Training Programs',
      'exchange': 'Exchanges',
      'meeting': 'Meetings',
      'other': 'Other',
    };

    return result.map(r => ({
      activityType: typeLabels[r.activityType] || r.activityType,
      count: r.count,
      percentage: total > 0 ? Math.round(r.count / total * 1000) / 10 : 0,
      avgImpactScore: r.avgImpactScore ? Math.round(r.avgImpactScore * 10) / 10 : null,
    }));
  }

  /**
   * Get pipeline data showing agreements by status (Kanban view)
   */
  private async getPipeline(): Promise<PipelineData> {
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const pipeline: PipelineData = {
      draft: { count: 0, value: 0, agreements: [] },
      pending: { count: 0, value: 0, agreements: [] },
      active: { count: 0, value: 0, agreements: [] },
      expiring: { count: 0, value: 0, agreements: [] },
      expired: { count: 0, value: 0, agreements: [] },
      renewed: { count: 0, value: 0, agreements: [] },
    };

    // Map database statuses to pipeline stages
    const statusMap = {
      'draft': 'draft',
      'pending_approval': 'pending',
      'active': 'active',
      'expired': 'expired',
      'terminated': 'expired', // Include terminated in expired column
    };

    // Fetch all agreements grouped by status
    for (const [dbStatus, pipelineStage] of Object.entries(statusMap)) {
      const agreements = await db.select({
        id: partnershipAgreements.id,
        organizationName: organizations.nameEn,
        agreementType: agreementTypes.nameEn,
        signedDate: partnershipAgreements.signedDate,
        expiryDate: partnershipAgreements.expiryDate,
        status: partnershipAgreements.status,
      })
        .from(partnershipAgreements)
        .leftJoin(organizations, eq(partnershipAgreements.organizationId, organizations.id))
        .leftJoin(agreementTypes, eq(partnershipAgreements.agreementTypeId, agreementTypes.id))
        .where(eq(partnershipAgreements.status, dbStatus))
        .orderBy(desc(partnershipAgreements.createdAt))
        .limit(20);

      const stage = pipelineStage as keyof PipelineData;
      if (pipeline[stage]) {
        pipeline[stage] = {
          count: agreements.length,
          value: 0, // Financial value tracking - placeholder
          agreements: agreements.map(a => ({
            id: a.id,
            organizationName: a.organizationName || 'Unknown Organization',
            agreementType: a.agreementType || 'General',
            signedDate: a.signedDate || '',
            expiryDate: a.expiryDate || '',
            value: 0,
            status: a.status,
          })),
        };
      }
    }

    // Get expiring soon (active but ending within 30 days) - separate category
    const expiringAgreements = await db.select({
      id: partnershipAgreements.id,
      organizationName: organizations.nameEn,
      agreementType: agreementTypes.nameEn,
      signedDate: partnershipAgreements.signedDate,
      expiryDate: partnershipAgreements.expiryDate,
      status: partnershipAgreements.status,
    })
      .from(partnershipAgreements)
      .leftJoin(organizations, eq(partnershipAgreements.organizationId, organizations.id))
      .leftJoin(agreementTypes, eq(partnershipAgreements.agreementTypeId, agreementTypes.id))
      .where(and(
        eq(partnershipAgreements.status, 'active'),
        sql`${partnershipAgreements.expiryDate}::date <= ${thirtyDaysFromNow.toISOString().split('T')[0]}::date`,
        sql`${partnershipAgreements.expiryDate}::date >= ${now.toISOString().split('T')[0]}::date`
      ))
      .orderBy(asc(partnershipAgreements.expiryDate))
      .limit(20);

    pipeline.expiring = {
      count: expiringAgreements.length,
      value: 0,
      agreements: expiringAgreements.map(a => ({
        id: a.id,
        organizationName: a.organizationName || 'Unknown Organization',
        agreementType: a.agreementType || 'General',
        signedDate: a.signedDate || '',
        expiryDate: a.expiryDate || '',
        value: 0,
        status: 'expiring',
      })),
    };

    // Update counts to be actual total counts (not limited)
    for (const [dbStatus, pipelineStage] of Object.entries(statusMap)) {
      const countResult = await db.select({ count: count() })
        .from(partnershipAgreements)
        .where(eq(partnershipAgreements.status, dbStatus));
      
      const stage = pipelineStage as keyof PipelineData;
      if (pipeline[stage]) {
        pipeline[stage].count = countResult[0]?.count || 0;
      }
    }

    // Get expiring count
    const expiringCount = await db.select({ count: count() })
      .from(partnershipAgreements)
      .where(and(
        eq(partnershipAgreements.status, 'active'),
        sql`${partnershipAgreements.expiryDate}::date <= ${thirtyDaysFromNow.toISOString().split('T')[0]}::date`,
        sql`${partnershipAgreements.expiryDate}::date >= ${now.toISOString().split('T')[0]}::date`
      ));
    pipeline.expiring.count = expiringCount[0]?.count || 0;

    return pipeline;
  }

  /**
   * Get renewal calendar - agreements expiring in next 90 days with priority
   */
  private async getRenewalCalendar(): Promise<RenewalItem[]> {
    const now = new Date();
    const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const expiringAgreements = await db.select({
      id: partnershipAgreements.id,
      organizationName: organizations.nameEn,
      agreementType: agreementTypes.nameEn,
      expiryDate: partnershipAgreements.expiryDate,
    })
      .from(partnershipAgreements)
      .leftJoin(organizations, eq(partnershipAgreements.organizationId, organizations.id))
      .leftJoin(agreementTypes, eq(partnershipAgreements.agreementTypeId, agreementTypes.id))
      .where(and(
        eq(partnershipAgreements.status, 'active'),
        sql`${partnershipAgreements.expiryDate}::date <= ${ninetyDaysFromNow.toISOString().split('T')[0]}::date`,
        sql`${partnershipAgreements.expiryDate}::date >= ${now.toISOString().split('T')[0]}::date`
      ))
      .orderBy(asc(partnershipAgreements.expiryDate));

    return expiringAgreements.map(a => {
      const expiryDate = a.expiryDate ? new Date(a.expiryDate) : now;
      const daysUntilExpiry = Math.max(0, Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      ));

      // Priority: high = <=14 days, medium = 15-30 days, low = >30 days
      const priority: 'high' | 'medium' | 'low' = 
        daysUntilExpiry <= 14 ? 'high' :
        daysUntilExpiry <= 30 ? 'medium' : 'low';

      return {
        id: a.id,
        organizationName: a.organizationName || 'Unknown Organization',
        agreementType: a.agreementType || 'General',
        expiryDate: a.expiryDate || '',
        daysUntilExpiry,
        value: 0, // Financial value placeholder
        priority,
      };
    });
  }

  /**
   * Get agreement type breakdown with percentages
   */
  private async getAgreementTypeBreakdown(): Promise<AgreementTypeData[]> {
    const result = await db.select({
      type: agreementTypes.nameEn,
      count: count(),
    })
      .from(partnershipAgreements)
      .leftJoin(agreementTypes, eq(partnershipAgreements.agreementTypeId, agreementTypes.id))
      .groupBy(agreementTypes.nameEn)
      .orderBy(desc(count()));

    const total = result.reduce((sum, r) => sum + r.count, 0);

    return result.map(r => ({
      type: r.type || 'Unspecified',
      count: r.count,
      percentage: total > 0 ? Math.round(r.count / total * 1000) / 10 : 0,
      totalValue: 0, // Placeholder
      avgDuration: 0, // Placeholder
    }));
  }

  /**
   * Get partner performance rankings
   */
  private async getPartnerPerformance(): Promise<PartnerPerformanceData[]> {
    // Get total agreements per organization
    const result = await db.select({
      organizationId: partnershipAgreements.organizationId,
      organizationName: organizations.nameEn,
      totalAgreements: count(),
      firstAgreement: sql<Date>`MIN(${partnershipAgreements.createdAt})`,
    })
      .from(partnershipAgreements)
      .leftJoin(organizations, eq(partnershipAgreements.organizationId, organizations.id))
      .groupBy(partnershipAgreements.organizationId, organizations.nameEn)
      .orderBy(desc(count()))
      .limit(20);

    // Get active count per org
    const activeByOrg = await db.select({
      organizationId: partnershipAgreements.organizationId,
      activeCount: count(),
    })
      .from(partnershipAgreements)
      .where(eq(partnershipAgreements.status, 'active'))
      .groupBy(partnershipAgreements.organizationId);

    const activeMap = new Map(activeByOrg.map(a => [a.organizationId, a.activeCount]));

    return result.map(r => ({
      organizationId: r.organizationId || 0,
      organizationName: r.organizationName || 'Unknown Organization',
      totalAgreements: r.totalAgreements,
      activeAgreements: activeMap.get(r.organizationId || 0) || 0,
      totalValue: 0, // Placeholder
      eventsSponsored: 0, // Would need to query events table
      partnerSince: r.firstAgreement ? (typeof r.firstAgreement === 'string' ? r.firstAgreement : new Date(r.firstAgreement).toISOString()) : '',
      renewalRate: 0, // Would need renewal tracking
    }));
  }

  /**
   * Get financial metrics (placeholder implementation)
   */
  private async getFinancialMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<FinancialMetrics> {
    // This is a placeholder - implement based on your financial tracking fields
    // The schema doesn't have a financial value field, so returning zeros
    return {
      totalActiveValue: 0,
      projectedRenewalValue: 0,
      avgAgreementValue: 0,
      valueByType: [],
      monthlyRevenue: [],
      yearOverYearGrowth: 0,
    };
  }

  /**
   * Get monthly partnership trends
   * Uses effectiveDate for historical accuracy, falls back to createdAt
   */
  private async getMonthlyTrends(
    startDate: Date,
    endDate: Date
  ): Promise<PartnershipTrend[]> {
    // New agreements by month - use effectiveDate when available, otherwise createdAt
    const newAgreements = await db.select({
      month: sql<string>`TO_CHAR(COALESCE(${partnershipAgreements.effectiveDate}, ${partnershipAgreements.createdAt}::date), 'YYYY-MM')`,
      count: count(),
    })
      .from(partnershipAgreements)
      .where(and(
        sql`COALESCE(${partnershipAgreements.effectiveDate}, ${partnershipAgreements.createdAt}::date) >= ${startDate.toISOString().split('T')[0]}::date`,
        sql`COALESCE(${partnershipAgreements.effectiveDate}, ${partnershipAgreements.createdAt}::date) <= ${endDate.toISOString().split('T')[0]}::date`
      ))
      .groupBy(sql`TO_CHAR(COALESCE(${partnershipAgreements.effectiveDate}, ${partnershipAgreements.createdAt}::date), 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(COALESCE(${partnershipAgreements.effectiveDate}, ${partnershipAgreements.createdAt}::date), 'YYYY-MM')`);

    // Expirations by month (based on expiryDate)
    const expirations = await db.select({
      month: sql<string>`TO_CHAR(${partnershipAgreements.expiryDate}::date, 'YYYY-MM')`,
      count: count(),
    })
      .from(partnershipAgreements)
      .where(and(
        sql`${partnershipAgreements.expiryDate}::date >= ${startDate.toISOString().split('T')[0]}::date`,
        sql`${partnershipAgreements.expiryDate}::date <= ${endDate.toISOString().split('T')[0]}::date`
      ))
      .groupBy(sql`TO_CHAR(${partnershipAgreements.expiryDate}::date, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${partnershipAgreements.expiryDate}::date, 'YYYY-MM')`);

    // Activities by month
    const activitiesByMonth = await db.select({
      month: sql<string>`TO_CHAR(${partnershipActivities.startDate}::date, 'YYYY-MM')`,
      count: count(),
    })
      .from(partnershipActivities)
      .where(and(
        sql`${partnershipActivities.startDate}::date >= ${startDate.toISOString().split('T')[0]}::date`,
        sql`${partnershipActivities.startDate}::date <= ${endDate.toISOString().split('T')[0]}::date`
      ))
      .groupBy(sql`TO_CHAR(${partnershipActivities.startDate}::date, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${partnershipActivities.startDate}::date, 'YYYY-MM')`);

    // Create maps
    const expirationMap = new Map(expirations.map(e => [e.month, e.count]));
    const activitiesMap = new Map(activitiesByMonth.map(a => [a.month, a.count]));

    // Get all unique months from all sources
    const allMonths = new Set([
      ...newAgreements.map(n => n.month),
      ...expirations.map(e => e.month),
      ...activitiesByMonth.map(a => a.month),
    ]);

    // Create agreement map
    const agreementMap = new Map(newAgreements.map(n => [n.month, n.count]));

    return Array.from(allMonths).sort().map(month => ({
      month,
      newAgreements: agreementMap.get(month) || 0,
      renewals: 0, // Would need renewal tracking field
      expirations: expirationMap.get(month) || 0,
      netChange: (agreementMap.get(month) || 0) - (expirationMap.get(month) || 0),
      activities: activitiesMap.get(month) || 0,
    }));
  }

  /**
   * Get recent partnership activity
   * Uses effectiveDate for display (historical accuracy), falls back to createdAt
   */
  private async getRecentActivity(): Promise<PartnershipActivity[]> {
    const recent = await db.select({
      id: partnershipAgreements.id,
      organizationName: organizations.nameEn,
      agreementType: agreementTypes.nameEn,
      effectiveDate: partnershipAgreements.effectiveDate,
      createdAt: partnershipAgreements.createdAt,
      status: partnershipAgreements.status,
    })
      .from(partnershipAgreements)
      .leftJoin(organizations, eq(partnershipAgreements.organizationId, organizations.id))
      .leftJoin(agreementTypes, eq(partnershipAgreements.agreementTypeId, agreementTypes.id))
      .orderBy(desc(sql`COALESCE(${partnershipAgreements.effectiveDate}, ${partnershipAgreements.createdAt}::date)`))
      .limit(10);

    return recent.map(r => {
      // Use effectiveDate if available, otherwise fall back to createdAt
      const displayDate = r.effectiveDate 
        ? new Date(r.effectiveDate).toISOString() 
        : r.createdAt?.toISOString() || '';
      
      return {
        id: r.id,
        type: 'created' as const,
        organizationName: r.organizationName || 'Unknown Organization',
        agreementType: r.agreementType || 'General',
        date: displayDate,
        description: `New ${r.agreementType || 'agreement'} created with ${r.organizationName}`,
      };
    });
  }
}

export const partnershipsAnalyticsService = new PartnershipsAnalyticsService();
