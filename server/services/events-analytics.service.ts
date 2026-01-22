/**
 * Events Analytics Service
 * 
 * Provides detailed analytics for events including calendar heatmaps,
 * timelines, category breakdowns, and scope comparisons.
 * Uses Elasticsearch for fast aggregations when available, falls back to SQL.
 * 
 * @module services/events-analytics.service
 */

import { db } from '../db';
import { events, eventAttendees, eventDepartments, departments, categories, archivedEvents } from '@shared/schema';
import { sql, eq, gte, lte, and, count, desc, asc, isNull, not, inArray } from 'drizzle-orm';
import { ElasticsearchAggregationsService } from './elasticsearch-aggregations.service';
import { isElasticsearchEnabled } from '../elasticsearch/client';

export interface EventsSummary {
  totalEvents: number;
  activeEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  archivedEvents: number;
  totalArchivedEvents: number; // All-time archived count
  avgEventsPerMonth: number;
  totalAttendees: number;
  avgAttendeesPerEvent: number;
}

export interface HeatmapData {
  date: string;
  count: number;
  events: { id: string; name: string }[];
}

export interface CategoryData {
  category: string;
  count: number;
  percentage: number;
  trend: number;
}

export interface TypeData {
  type: string;
  count: number;
  avgDuration: number;
  avgAttendees: number;
}

export interface TimelineEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  category: string;
  type: string;
  status: 'upcoming' | 'active' | 'completed';
  attendeeCount: number;
}

export interface LocationStat {
  location: string;
  eventCount: number;
  totalAttendees: number;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  eventCount: number;
  attendeeCount: number;
  previousYearCount: number;
}

export interface EventScopeStats {
  scope: string;
  eventCount: number;
  upcomingCount: number;
  completedCount: number;
}

export interface DepartmentEventStats {
  departmentId: number;
  departmentName: string;
  eventCount: number;
  upcomingCount: number;
  completedCount: number;
}

export interface EventsAnalyticsData {
  summary: EventsSummary;
  calendarHeatmap: HeatmapData[];
  categoryBreakdown: CategoryData[];
  typeBreakdown: TypeData[];
  timeline: TimelineEvent[];
  locationStats: LocationStat[];
  monthlyTrends: MonthlyTrend[];
  scopeComparison: EventScopeStats[];
  departmentComparison: DepartmentEventStats[];
}

export class EventsAnalyticsService {
  private elasticsearchAggregations: ElasticsearchAggregationsService;
  
  constructor() {
    this.elasticsearchAggregations = new ElasticsearchAggregationsService();
  }

  /**
   * Get comprehensive events analytics data
   */
  async getEventsAnalytics(
    startDate?: Date,
    endDate?: Date,
    scope?: string
  ): Promise<EventsAnalyticsData> {
    const start = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const [
      summary,
      calendarHeatmap,
      categoryBreakdown,
      typeBreakdown,
      timeline,
      locationStats,
      monthlyTrends,
      scopeComparison,
      departmentComparison,
    ] = await Promise.all([
      this.getSummary(start, end, scope),
      this.getCalendarHeatmap(start, end, scope),
      this.getCategoryBreakdown(start, end, scope),
      this.getTypeBreakdown(start, end, scope),
      this.getTimeline(start, end, scope),
      this.getLocationStats(start, end, scope),
      this.getMonthlyTrends(start, end, scope),
      this.getScopeComparison(start, end),
      this.getDepartmentComparison(start, end, scope),
    ]);

    return {
      summary,
      calendarHeatmap,
      categoryBreakdown,
      typeBreakdown,
      timeline,
      locationStats,
      monthlyTrends,
      scopeComparison,
      departmentComparison,
    };
  }

  private formatDateForQuery(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get events summary statistics
   */
  private async getSummary(
    startDate: Date,
    endDate: Date,
    scope?: string
  ): Promise<EventsSummary> {
    const nowStr = this.formatDateForQuery(new Date());
    const startStr = this.formatDateForQuery(startDate);
    const endStr = this.formatDateForQuery(endDate);
    
    const baseConditions: ReturnType<typeof gte>[] = [
      gte(events.startDate, startStr),
      lte(events.startDate, endStr),
    ];
    if (scope) {
      baseConditions.push(eq(events.eventScope, scope));
    }

    // Build archive conditions for separate archived_events table
    const archiveConditions: ReturnType<typeof gte>[] = [
      gte(archivedEvents.startDate, startStr),
      lte(archivedEvents.startDate, endStr),
    ];
    if (scope) {
      archiveConditions.push(eq(archivedEvents.eventScope, scope));
    }

    const [total, active, upcoming, completed, archived, totalArchived] = await Promise.all([
      db.select({ count: count() })
        .from(events)
        .where(and(...baseConditions)),
      db.select({ count: count() })
        .from(events)
        .where(and(
          ...baseConditions,
          eq(events.isArchived, false),
          lte(events.startDate, nowStr),
          gte(events.endDate, nowStr)
        )),
      db.select({ count: count() })
        .from(events)
        .where(and(
          ...baseConditions,
          eq(events.isArchived, false),
          gte(events.startDate, nowStr)
        )),
      db.select({ count: count() })
        .from(events)
        .where(and(
          ...baseConditions,
          eq(events.isArchived, false),
          lte(events.endDate, nowStr)
        )),
      // Query archived_events table with date filter
      db.select({ count: count() })
        .from(archivedEvents)
        .where(and(...archiveConditions)),
      // Query ALL archived events (no date filter) for total count
      scope
        ? db.select({ count: count() })
            .from(archivedEvents)
            .where(eq(archivedEvents.eventScope, scope))
        : db.select({ count: count() })
            .from(archivedEvents),
    ]);

    // Get attendee counts per event
    const attendeeCounts = await db.select({
      eventId: eventAttendees.eventId,
      count: count(),
    })
      .from(eventAttendees)
      .groupBy(eventAttendees.eventId);

    const totalAttendees = attendeeCounts.reduce((sum, e) => sum + e.count, 0);
    const months = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)));

    return {
      totalEvents: total[0]?.count || 0,
      activeEvents: active[0]?.count || 0,
      upcomingEvents: upcoming[0]?.count || 0,
      completedEvents: completed[0]?.count || 0,
      archivedEvents: archived[0]?.count || 0,
      totalArchivedEvents: totalArchived[0]?.count || 0,
      avgEventsPerMonth: Math.round((total[0]?.count || 0) / months * 10) / 10,
      totalAttendees,
      avgAttendeesPerEvent: attendeeCounts.length > 0
        ? Math.round(totalAttendees / attendeeCounts.length * 10) / 10
        : 0,
    };
  }

  /**
   * Get calendar heatmap data for year view
   */
  private async getCalendarHeatmap(
    startDate: Date,
    endDate: Date,
    scope?: string
  ): Promise<HeatmapData[]> {
    const startStr = this.formatDateForQuery(startDate);
    const endStr = this.formatDateForQuery(endDate);
    
    const conditions: ReturnType<typeof gte>[] = [
      gte(events.startDate, startStr),
      lte(events.startDate, endStr),
    ];
    if (scope) {
      conditions.push(eq(events.eventScope, scope));
    }

    const result = await db.select({
      date: sql<string>`${events.startDate}::text`,
      count: count(),
    })
      .from(events)
      .where(and(...conditions))
      .groupBy(events.startDate)
      .orderBy(events.startDate);

    // Get event details for each date (limited to 5 per day)
    const heatmapData: HeatmapData[] = [];
    for (const row of result) {
      const dayConditions: ReturnType<typeof eq>[] = [
        eq(events.startDate, row.date),
      ];
      if (scope) {
        dayConditions.push(eq(events.eventScope, scope));
      }

      const dayEvents = await db.select({
        id: events.id,
        name: events.name,
      })
        .from(events)
        .where(and(...dayConditions))
        .limit(5);

      heatmapData.push({
        date: row.date,
        count: row.count,
        events: dayEvents,
      });
    }

    return heatmapData;
  }

  /**
   * Get events breakdown by category
   */
  private async getCategoryBreakdown(
    startDate: Date,
    endDate: Date,
    scope?: string
  ): Promise<CategoryData[]> {
    // Use Elasticsearch if available
    if (isElasticsearchEnabled()) {
      const esResults = await this.elasticsearchAggregations.getEventsByCategory({
        startDate,
        endDate,
      });
      
      return esResults.map(r => ({
        category: r.category,
        count: r.count,
        percentage: r.percentage,
        trend: 0, // Would need previous period data for trend
      }));
    }

    // Fallback to SQL
    const startStr = this.formatDateForQuery(startDate);
    const endStr = this.formatDateForQuery(endDate);
    
    const conditions: ReturnType<typeof gte>[] = [
      gte(events.startDate, startStr),
      lte(events.startDate, endStr),
    ];
    if (scope) {
      conditions.push(eq(events.eventScope, scope));
    }

    const result = await db.select({
      category: events.category,
      count: count(),
    })
      .from(events)
      .where(and(...conditions))
      .groupBy(events.category)
      .orderBy(desc(count()));

    const total = result.reduce((sum, r) => sum + r.count, 0);

    return result.map(r => ({
      category: r.category || 'Uncategorized',
      count: r.count,
      percentage: total > 0 ? Math.round(r.count / total * 1000) / 10 : 0,
      trend: 0, // Would need previous period data for trend
    }));
  }

  /**
   * Get events breakdown by type
   */
  private async getTypeBreakdown(
    startDate: Date,
    endDate: Date,
    scope?: string
  ): Promise<TypeData[]> {
    // Use Elasticsearch if available
    if (isElasticsearchEnabled()) {
      const esResults = await this.elasticsearchAggregations.getEventsByType({
        startDate,
        endDate,
      });
      
      return esResults.map(r => ({
        type: r.eventType,
        count: r.count,
        avgDuration: 0, // Would need additional ES aggregation
        avgAttendees: 0, // Would need join with attendees
      }));
    }

    // Fallback to SQL
    const startStr = this.formatDateForQuery(startDate);
    const endStr = this.formatDateForQuery(endDate);
    
    const conditions: ReturnType<typeof gte>[] = [
      gte(events.startDate, startStr),
      lte(events.startDate, endStr),
    ];
    if (scope) {
      conditions.push(eq(events.eventScope, scope));
    }

    const result = await db.select({
      type: events.eventType,
      count: count(),
      avgDuration: sql<number>`AVG(EXTRACT(EPOCH FROM (end_date::date - start_date::date)) / 3600)`,
    })
      .from(events)
      .where(and(...conditions))
      .groupBy(events.eventType)
      .orderBy(desc(count()));

    return result.map(r => ({
      type: r.type || 'Other',
      count: r.count,
      avgDuration: Math.round((r.avgDuration || 0) * 10) / 10,
      avgAttendees: 0, // Would need join with attendees
    }));
  }

  /**
   * Get event timeline data
   */
  private async getTimeline(
    startDate: Date,
    endDate: Date,
    scope?: string
  ): Promise<TimelineEvent[]> {
    const nowStr = this.formatDateForQuery(new Date());
    const startStr = this.formatDateForQuery(startDate);
    const endStr = this.formatDateForQuery(endDate);
    
    const conditions: ReturnType<typeof gte>[] = [
      gte(events.startDate, startStr),
      lte(events.startDate, endStr),
    ];
    if (scope) {
      conditions.push(eq(events.eventScope, scope));
    }

    // Get events with category names from the categories table
    const result = await db.select({
      id: events.id,
      name: events.name,
      startDate: events.startDate,
      endDate: events.endDate,
      categoryName: categories.nameEn,
      type: events.eventType,
      isArchived: events.isArchived,
    })
      .from(events)
      .leftJoin(categories, eq(events.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(asc(events.startDate))
      .limit(100);

    // Get department names for events
    const eventIds = result.map(e => e.id);
    const deptData = eventIds.length > 0 ? await db.select({
      eventId: eventDepartments.eventId,
      departmentName: departments.name,
    })
      .from(eventDepartments)
      .innerJoin(departments, eq(eventDepartments.departmentId, departments.id))
      .where(inArray(eventDepartments.eventId, eventIds)) : [];
    
    // Group departments by event
    const eventDeptMap = new Map<string, string[]>();
    for (const d of deptData) {
      const existing = eventDeptMap.get(d.eventId) || [];
      existing.push(d.departmentName);
      eventDeptMap.set(d.eventId, existing);
    }

    return result.map(e => {
      const depts = eventDeptMap.get(e.id) || [];
      return {
        id: e.id,
        name: e.name,
        startDate: e.startDate,
        endDate: e.endDate,
        // Use category name from categories table, or department name, or type
        category: e.categoryName || (depts.length > 0 ? depts[0] : e.type || 'General'),
        type: e.type || 'local',
        status: e.isArchived ? 'completed' as const :
          e.startDate > nowStr ? 'upcoming' as const :
          e.endDate < nowStr ? 'completed' as const : 'active' as const,
        attendeeCount: 0,
      };
    });
  }

  /**
   * Get location statistics
   */
  private async getLocationStats(
    startDate: Date,
    endDate: Date,
    scope?: string
  ): Promise<LocationStat[]> {
    const startStr = this.formatDateForQuery(startDate);
    const endStr = this.formatDateForQuery(endDate);
    
    const conditions: ReturnType<typeof gte>[] = [
      gte(events.startDate, startStr),
      lte(events.startDate, endStr),
      not(isNull(events.location)),
      sql`${events.location} != ''`,
    ];
    if (scope) {
      conditions.push(eq(events.eventScope, scope));
    }

    const result = await db.select({
      location: events.location,
      count: count(),
    })
      .from(events)
      .where(and(...conditions))
      .groupBy(events.location)
      .orderBy(desc(count()))
      .limit(10);

    return result.map(r => ({
      location: r.location || 'Unknown',
      eventCount: r.count,
      totalAttendees: 0, // Would need join
    }));
  }

  /**
   * Get monthly trends
   */
  private async getMonthlyTrends(
    startDate: Date,
    endDate: Date,
    scope?: string
  ): Promise<MonthlyTrend[]> {
    const startStr = this.formatDateForQuery(startDate);
    const endStr = this.formatDateForQuery(endDate);
    
    const conditions: ReturnType<typeof gte>[] = [
      gte(events.startDate, startStr),
      lte(events.startDate, endStr),
    ];
    if (scope) {
      conditions.push(eq(events.eventScope, scope));
    }

    const result = await db.select({
      month: sql<string>`TO_CHAR(${events.startDate}::date, 'Mon')`,
      monthNum: sql<number>`EXTRACT(MONTH FROM ${events.startDate}::date)`,
      year: sql<number>`EXTRACT(YEAR FROM ${events.startDate}::date)`,
      count: count(),
    })
      .from(events)
      .where(and(...conditions))
      .groupBy(
        sql`TO_CHAR(${events.startDate}::date, 'Mon')`,
        sql`EXTRACT(MONTH FROM ${events.startDate}::date)`,
        sql`EXTRACT(YEAR FROM ${events.startDate}::date)`
      )
      .orderBy(
        sql`EXTRACT(YEAR FROM ${events.startDate}::date)`,
        sql`EXTRACT(MONTH FROM ${events.startDate}::date)`
      );

    return result.map(r => ({
      month: r.month,
      year: Number(r.year),
      eventCount: r.count,
      attendeeCount: 0,
      previousYearCount: 0, // Would need separate query
    }));
  }

  /**
   * Get event scope comparison stats (internal vs external)
   */
  private async getScopeComparison(
    startDate: Date,
    endDate: Date
  ): Promise<EventScopeStats[]> {
    const startStr = this.formatDateForQuery(startDate);
    const endStr = this.formatDateForQuery(endDate);

    const result = await db.select({
      scope: events.eventScope,
      count: count(),
    })
      .from(events)
      .where(and(
        gte(events.startDate, startStr),
        lte(events.startDate, endStr)
      ))
      .groupBy(events.eventScope)
      .orderBy(desc(count()));

    return result.map(r => ({
      scope: r.scope || 'external',
      eventCount: r.count,
      upcomingCount: 0, // Would need separate counts
      completedCount: 0,
    }));
  }

  /**
   * Get department comparison data
   */
  private async getDepartmentComparison(
    startDate: Date,
    endDate: Date,
    scope?: string
  ): Promise<DepartmentEventStats[]> {
    const nowStr = this.formatDateForQuery(new Date());
    const startStr = this.formatDateForQuery(startDate);
    const endStr = this.formatDateForQuery(endDate);

    // Get all events in the date range grouped by department
    const result = await db
      .select({
        departmentId: departments.id,
        departmentName: departments.name,
        eventCount: count(events.id),
        upcomingCount: count(sql`CASE WHEN ${events.startDate} > ${nowStr} AND ${events.isArchived} = false THEN 1 END`),
        completedCount: count(sql`CASE WHEN ${events.endDate} < ${nowStr} OR ${events.isArchived} = true THEN 1 END`),
      })
      .from(departments)
      .leftJoin(eventDepartments, eq(eventDepartments.departmentId, departments.id))
      .leftJoin(
        events,
        and(
          eq(events.id, eventDepartments.eventId),
          gte(events.startDate, startStr),
          lte(events.startDate, endStr),
          ...(scope ? [eq(events.eventScope, scope)] : [])
        )
      )
      .groupBy(departments.id, departments.name)
      .orderBy(desc(count(events.id)));

    return result.map(r => ({
      departmentId: r.departmentId,
      departmentName: r.departmentName,
      eventCount: Number(r.eventCount) || 0,
      upcomingCount: Number(r.upcomingCount) || 0,
      completedCount: Number(r.completedCount) || 0,
    }));
  }
}

export const eventsAnalyticsService = new EventsAnalyticsService();
