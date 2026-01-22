# Analytics: Events Dashboard

## Type
Feature / Analytics

## Priority
🟠 High

## Estimated Effort
8-10 hours

## Description
Build a comprehensive events analytics dashboard with calendar heatmaps, event timelines, category breakdowns, and trend analysis. Provides deep insights into event patterns and performance.

## Requirements

### Dashboard Features
- Calendar heatmap showing event density
- Interactive event timeline
- Category and type distribution charts
- Location/venue analytics
- Attendance tracking metrics
- Year-over-year comparisons

---

## Complete Implementation

### Backend Events Analytics Service (`server/services/events-analytics.service.ts`)
```typescript
import { db } from '../db';
import { events, eventAttendees, departments, eventMedia } from '@shared/schema';
import { sql, eq, gte, lte, and, count, desc, asc } from 'drizzle-orm';
import { elasticsearchService } from './elasticsearch.service';

export interface EventsAnalyticsData {
  summary: EventsSummary;
  calendarHeatmap: HeatmapData[];
  categoryBreakdown: CategoryData[];
  typeBreakdown: TypeData[];
  timeline: TimelineEvent[];
  locationStats: LocationStat[];
  attendanceMetrics: AttendanceMetrics;
  monthlyTrends: MonthlyTrend[];
  departmentComparison: DepartmentEventStats[];
}

export interface EventsSummary {
  totalEvents: number;
  activeEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  archivedEvents: number;
  avgEventsPerMonth: number;
  totalAttendees: number;
  avgAttendeesPerEvent: number;
}

export interface HeatmapData {
  date: string;
  count: number;
  events: { id: number; title: string }[];
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
  id: number;
  title: string;
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

export interface AttendanceMetrics {
  totalInvited: number;
  totalConfirmed: number;
  totalAttended: number;
  avgConfirmationRate: number;
  avgAttendanceRate: number;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  eventCount: number;
  attendeeCount: number;
  previousYearCount: number;
}

export interface DepartmentEventStats {
  departmentId: number;
  departmentName: string;
  eventCount: number;
  upcomingCount: number;
  completedCount: number;
}

export class EventsAnalyticsService {
  async getEventsAnalytics(
    startDate?: Date,
    endDate?: Date,
    departmentId?: number
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
      attendanceMetrics,
      monthlyTrends,
      departmentComparison,
    ] = await Promise.all([
      this.getSummary(start, end, departmentId),
      this.getCalendarHeatmap(start, end, departmentId),
      this.getCategoryBreakdown(start, end, departmentId),
      this.getTypeBreakdown(start, end, departmentId),
      this.getTimeline(start, end, departmentId),
      this.getLocationStats(start, end, departmentId),
      this.getAttendanceMetrics(start, end, departmentId),
      this.getMonthlyTrends(start, end, departmentId),
      this.getDepartmentComparison(start, end),
    ]);

    return {
      summary,
      calendarHeatmap,
      categoryBreakdown,
      typeBreakdown,
      timeline,
      locationStats,
      attendanceMetrics,
      monthlyTrends,
      departmentComparison,
    };
  }

  private async getSummary(
    startDate: Date,
    endDate: Date,
    departmentId?: number
  ): Promise<EventsSummary> {
    const now = new Date();
    const baseFilter = and(
      gte(events.startDate, startDate),
      lte(events.startDate, endDate),
      departmentId ? eq(events.departmentId, departmentId) : undefined
    );

    const [total, active, upcoming, completed, archived] = await Promise.all([
      db.select({ count: count() }).from(events).where(baseFilter),
      db.select({ count: count() }).from(events).where(and(
        baseFilter,
        eq(events.isArchived, false),
        lte(events.startDate, now),
        gte(events.endDate, now)
      )),
      db.select({ count: count() }).from(events).where(and(
        baseFilter,
        eq(events.isArchived, false),
        gte(events.startDate, now)
      )),
      db.select({ count: count() }).from(events).where(and(
        baseFilter,
        eq(events.isArchived, false),
        lte(events.endDate, now)
      )),
      db.select({ count: count() }).from(events).where(and(
        baseFilter,
        eq(events.isArchived, true)
      )),
    ]);

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
      avgEventsPerMonth: Math.round((total[0]?.count || 0) / months * 10) / 10,
      totalAttendees,
      avgAttendeesPerEvent: attendeeCounts.length > 0
        ? Math.round(totalAttendees / attendeeCounts.length * 10) / 10
        : 0,
    };
  }

  private async getCalendarHeatmap(
    startDate: Date,
    endDate: Date,
    departmentId?: number
  ): Promise<HeatmapData[]> {
    const result = await db.select({
      date: sql<string>`DATE(${events.startDate})`,
      count: count(),
    })
      .from(events)
      .where(and(
        gte(events.startDate, startDate),
        lte(events.startDate, endDate),
        departmentId ? eq(events.departmentId, departmentId) : undefined
      ))
      .groupBy(sql`DATE(${events.startDate})`)
      .orderBy(sql`DATE(${events.startDate})`);

    // Get event details for each date
    const heatmapData: HeatmapData[] = [];
    for (const row of result) {
      const dayEvents = await db.select({
        id: events.id,
        title: events.title,
      })
        .from(events)
        .where(and(
          sql`DATE(${events.startDate}) = ${row.date}`,
          departmentId ? eq(events.departmentId, departmentId) : undefined
        ))
        .limit(5);

      heatmapData.push({
        date: row.date,
        count: row.count,
        events: dayEvents,
      });
    }

    return heatmapData;
  }

  private async getCategoryBreakdown(
    startDate: Date,
    endDate: Date,
    departmentId?: number
  ): Promise<CategoryData[]> {
    const result = await db.select({
      category: events.category,
      count: count(),
    })
      .from(events)
      .where(and(
        gte(events.startDate, startDate),
        lte(events.startDate, endDate),
        departmentId ? eq(events.departmentId, departmentId) : undefined
      ))
      .groupBy(events.category)
      .orderBy(desc(count()));

    const total = result.reduce((sum, r) => sum + r.count, 0);

    return result.map(r => ({
      category: r.category || 'Uncategorized',
      count: r.count,
      percentage: total > 0 ? Math.round(r.count / total * 1000) / 10 : 0,
      trend: 0, // Calculate YoY trend
    }));
  }

  private async getTypeBreakdown(
    startDate: Date,
    endDate: Date,
    departmentId?: number
  ): Promise<TypeData[]> {
    const result = await db.select({
      type: events.eventType,
      count: count(),
      avgDuration: sql<number>`AVG(EXTRACT(EPOCH FROM (${events.endDate} - ${events.startDate})) / 3600)`,
    })
      .from(events)
      .where(and(
        gte(events.startDate, startDate),
        lte(events.startDate, endDate),
        departmentId ? eq(events.departmentId, departmentId) : undefined
      ))
      .groupBy(events.eventType)
      .orderBy(desc(count()));

    return result.map(r => ({
      type: r.type || 'Other',
      count: r.count,
      avgDuration: Math.round((r.avgDuration || 0) * 10) / 10,
      avgAttendees: 0, // Calculate from attendees table
    }));
  }

  private async getTimeline(
    startDate: Date,
    endDate: Date,
    departmentId?: number
  ): Promise<TimelineEvent[]> {
    const now = new Date();

    const result = await db.select({
      id: events.id,
      title: events.title,
      startDate: events.startDate,
      endDate: events.endDate,
      category: events.category,
      type: events.eventType,
      isArchived: events.isArchived,
    })
      .from(events)
      .where(and(
        gte(events.startDate, startDate),
        lte(events.startDate, endDate),
        departmentId ? eq(events.departmentId, departmentId) : undefined
      ))
      .orderBy(asc(events.startDate))
      .limit(100);

    return result.map(e => ({
      id: e.id,
      title: e.title,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
      category: e.category || 'Uncategorized',
      type: e.type || 'Other',
      status: e.isArchived ? 'completed' as const :
        e.startDate > now ? 'upcoming' as const :
        e.endDate < now ? 'completed' as const : 'active' as const,
      attendeeCount: 0,
    }));
  }

  private async getLocationStats(
    startDate: Date,
    endDate: Date,
    departmentId?: number
  ): Promise<LocationStat[]> {
    const result = await db.select({
      location: events.location,
      count: count(),
    })
      .from(events)
      .where(and(
        gte(events.startDate, startDate),
        lte(events.startDate, endDate),
        sql`${events.location} IS NOT NULL AND ${events.location} != ''`,
        departmentId ? eq(events.departmentId, departmentId) : undefined
      ))
      .groupBy(events.location)
      .orderBy(desc(count()))
      .limit(10);

    return result.map(r => ({
      location: r.location || 'Unknown',
      eventCount: r.count,
      totalAttendees: 0,
    }));
  }

  private async getAttendanceMetrics(
    startDate: Date,
    endDate: Date,
    departmentId?: number
  ): Promise<AttendanceMetrics> {
    // Placeholder - implement based on your attendee tracking system
    return {
      totalInvited: 0,
      totalConfirmed: 0,
      totalAttended: 0,
      avgConfirmationRate: 0,
      avgAttendanceRate: 0,
    };
  }

  private async getMonthlyTrends(
    startDate: Date,
    endDate: Date,
    departmentId?: number
  ): Promise<MonthlyTrend[]> {
    const result = await db.select({
      month: sql<string>`TO_CHAR(${events.startDate}, 'MM')`,
      year: sql<number>`EXTRACT(YEAR FROM ${events.startDate})`,
      count: count(),
    })
      .from(events)
      .where(and(
        gte(events.startDate, startDate),
        lte(events.startDate, endDate),
        departmentId ? eq(events.departmentId, departmentId) : undefined
      ))
      .groupBy(
        sql`TO_CHAR(${events.startDate}, 'MM')`,
        sql`EXTRACT(YEAR FROM ${events.startDate})`
      )
      .orderBy(
        sql`EXTRACT(YEAR FROM ${events.startDate})`,
        sql`TO_CHAR(${events.startDate}, 'MM')`
      );

    return result.map(r => ({
      month: r.month,
      year: Number(r.year),
      eventCount: r.count,
      attendeeCount: 0,
      previousYearCount: 0,
    }));
  }

  private async getDepartmentComparison(
    startDate: Date,
    endDate: Date
  ): Promise<DepartmentEventStats[]> {
    const now = new Date();

    const result = await db.select({
      departmentId: events.departmentId,
      departmentName: departments.name,
      count: count(),
    })
      .from(events)
      .leftJoin(departments, eq(events.departmentId, departments.id))
      .where(and(
        gte(events.startDate, startDate),
        lte(events.startDate, endDate)
      ))
      .groupBy(events.departmentId, departments.name)
      .orderBy(desc(count()));

    return result.map(r => ({
      departmentId: r.departmentId || 0,
      departmentName: r.departmentName || 'Unknown',
      eventCount: r.count,
      upcomingCount: 0,
      completedCount: 0,
    }));
  }

  // Elasticsearch-powered search analytics
  async getSearchAnalytics(query: string): Promise<any> {
    try {
      const result = await elasticsearchService.search('events', {
        query: {
          multi_match: {
            query,
            fields: ['title^3', 'description', 'category', 'location'],
          },
        },
        aggs: {
          by_category: { terms: { field: 'category.keyword' } },
          by_month: {
            date_histogram: {
              field: 'startDate',
              calendar_interval: 'month',
            },
          },
          avg_duration: { avg: { field: 'duration' } },
        },
        size: 0,
      });
      return result.aggregations;
    } catch (error) {
      console.error('ES search analytics error:', error);
      return null;
    }
  }
}

export const eventsAnalyticsService = new EventsAnalyticsService();
```

### Events Analytics Routes (`server/routes/events-analytics.routes.ts`)
```typescript
import { Router } from 'express';
import { eventsAnalyticsService } from '../services/events-analytics.service';
import { isAuthenticated, isAdminOrSuperAdmin } from '../auth';

const router = Router();

// Get events analytics dashboard data
router.get('/api/analytics/events', isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate, departmentId } = req.query;

    const data = await eventsAnalyticsService.getEventsAnalytics(
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined,
      departmentId ? Number(departmentId) : undefined
    );

    res.json(data);
  } catch (error) {
    console.error('Events analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch events analytics' });
  }
});

// Get calendar heatmap data
router.get('/api/analytics/events/heatmap', isAuthenticated, async (req, res) => {
  try {
    const { year, departmentId } = req.query;
    const startDate = new Date(Number(year) || new Date().getFullYear(), 0, 1);
    const endDate = new Date(Number(year) || new Date().getFullYear(), 11, 31);

    const data = await eventsAnalyticsService.getEventsAnalytics(
      startDate,
      endDate,
      departmentId ? Number(departmentId) : undefined
    );

    res.json(data.calendarHeatmap);
  } catch (error) {
    console.error('Heatmap error:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

// Get event timeline
router.get('/api/analytics/events/timeline', isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate, departmentId } = req.query;

    const data = await eventsAnalyticsService.getEventsAnalytics(
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined,
      departmentId ? Number(departmentId) : undefined
    );

    res.json(data.timeline);
  } catch (error) {
    console.error('Timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch timeline data' });
  }
});

export default router;
```

### Frontend Events Dashboard (`client/src/pages/analytics/EventsDashboard.tsx`)
```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarHeatmap } from '@/components/analytics/CalendarHeatmap';
import { EventTimeline } from '@/components/analytics/EventTimeline';
import { CategoryPieChart } from '@/components/analytics/CategoryPieChart';
import { MonthlyTrendsChart } from '@/components/analytics/MonthlyTrendsChart';
import { LocationBarChart } from '@/components/analytics/LocationBarChart';
import { DepartmentComparisonTable } from '@/components/analytics/DepartmentComparisonTable';
import { KPICard } from '@/components/analytics/KPICard';
import { 
  Calendar, Users, MapPin, TrendingUp, 
  Clock, Archive, CalendarCheck, CalendarX 
} from 'lucide-react';
import type { EventsAnalyticsData } from '@/types/analytics';

export default function EventsDashboard() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [departmentId, setDepartmentId] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data, isLoading, error } = useQuery<EventsAnalyticsData>({
    queryKey: ['analytics', 'events', dateRange, departmentId],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });
      if (departmentId !== 'all') params.set('departmentId', departmentId);

      const response = await fetch(`/api/analytics/events?${params}`);
      if (!response.ok) throw new Error('Failed to fetch events analytics');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <EventsDashboardSkeleton />;
  if (error) return <div className="text-destructive">Error loading dashboard</div>;
  if (!data) return null;

  const { summary } = data;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold">{t('analytics.eventsDashboard')}</h1>
        <div className="flex gap-4 flex-wrap">
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('analytics.allDepartments')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('analytics.allDepartments')}</SelectItem>
            </SelectContent>
          </Select>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t('analytics.totalEvents')}
          value={summary.totalEvents}
          icon={Calendar}
          color="blue"
        />
        <KPICard
          title={t('analytics.upcomingEvents')}
          value={summary.upcomingEvents}
          icon={CalendarCheck}
          color="green"
        />
        <KPICard
          title={t('analytics.activeEvents')}
          value={summary.activeEvents}
          icon={Clock}
          color="orange"
        />
        <KPICard
          title={t('analytics.avgAttendeesPerEvent')}
          value={summary.avgAttendeesPerEvent}
          icon={Users}
          color="purple"
        />
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <KPICard
          title={t('analytics.avgEventsPerMonth')}
          value={summary.avgEventsPerMonth}
          icon={TrendingUp}
          color="blue"
        />
        <KPICard
          title={t('analytics.completedEvents')}
          value={summary.completedEvents}
          icon={CalendarX}
          color="gray"
        />
        <KPICard
          title={t('analytics.archivedEvents')}
          value={summary.archivedEvents}
          icon={Archive}
          color="gray"
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('analytics.overview')}</TabsTrigger>
          <TabsTrigger value="calendar">{t('analytics.calendar')}</TabsTrigger>
          <TabsTrigger value="timeline">{t('analytics.timeline')}</TabsTrigger>
          <TabsTrigger value="departments">{t('analytics.departments')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.eventsByCategory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryPieChart data={data.categoryBreakdown} />
              </CardContent>
            </Card>

            {/* Monthly Trends */}
            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.monthlyTrends')}</CardTitle>
              </CardHeader>
              <CardContent>
                <MonthlyTrendsChart data={data.monthlyTrends} />
              </CardContent>
            </Card>
          </div>

          {/* Location Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {t('analytics.topLocations')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LocationBarChart data={data.locationStats} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('analytics.eventCalendarHeatmap')}</CardTitle>
                <Select
                  value={String(selectedYear)}
                  onValueChange={(v) => setSelectedYear(Number(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2023, 2024, 2025, 2026].map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <CalendarHeatmap
                data={data.calendarHeatmap}
                year={selectedYear}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.eventTimeline')}</CardTitle>
            </CardHeader>
            <CardContent>
              <EventTimeline events={data.timeline} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments">
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.departmentComparison')}</CardTitle>
            </CardHeader>
            <CardContent>
              <DepartmentComparisonTable data={data.departmentComparison} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EventsDashboardSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
```

### Calendar Heatmap Component (`client/src/components/analytics/CalendarHeatmap.tsx`)
```tsx
import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface HeatmapData {
  date: string;
  count: number;
  events: { id: number; title: string }[];
}

interface CalendarHeatmapProps {
  data: HeatmapData[];
  year: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarHeatmap({ data, year }: CalendarHeatmapProps) {
  const dataMap = useMemo(() => {
    const map = new Map<string, HeatmapData>();
    data.forEach((d) => map.set(d.date, d));
    return map;
  }, [data]);

  const weeks = useMemo(() => {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const weeksArray: Date[][] = [];
    let currentWeek: Date[] = [];

    // Pad first week
    const firstDay = startDate.getDay();
    for (let i = 0; i < firstDay; i++) {
      currentWeek.push(null as any);
    }

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      currentWeek.push(new Date(d));

      if (currentWeek.length === 7) {
        weeksArray.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      weeksArray.push(currentWeek);
    }

    return weeksArray;
  }, [year]);

  const getColor = (count: number): string => {
    if (count === 0) return 'bg-muted';
    if (count === 1) return 'bg-green-200 dark:bg-green-900';
    if (count <= 3) return 'bg-green-400 dark:bg-green-700';
    if (count <= 5) return 'bg-green-600 dark:bg-green-500';
    return 'bg-green-800 dark:bg-green-300';
  };

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <div className="inline-flex gap-1">
          {/* Day labels */}
          <div className="flex flex-col gap-1 mr-2">
            {DAYS.map((day) => (
              <div
                key={day}
                className="h-3 w-8 text-xs text-muted-foreground flex items-center"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Weeks */}
          <div className="flex gap-1">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1">
                {week.map((date, dayIndex) => {
                  if (!date) {
                    return <div key={dayIndex} className="h-3 w-3" />;
                  }

                  const dateStr = date.toISOString().split('T')[0];
                  const dayData = dataMap.get(dateStr);
                  const count = dayData?.count || 0;

                  return (
                    <Tooltip key={dayIndex}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'h-3 w-3 rounded-sm cursor-pointer hover:ring-2 hover:ring-primary',
                            getColor(count)
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm">
                          <p className="font-medium">{date.toLocaleDateString()}</p>
                          <p>{count} event{count !== 1 ? 's' : ''}</p>
                          {dayData?.events.slice(0, 3).map((e) => (
                            <p key={e.id} className="text-xs text-muted-foreground">
                              • {e.title}
                            </p>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Month labels */}
        <div className="flex mt-2 ml-10">
          {MONTHS.map((month) => (
            <div key={month} className="flex-1 text-xs text-muted-foreground">
              {month}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4">
          <span className="text-xs text-muted-foreground">Less</span>
          <div className="flex gap-1">
            {[0, 1, 3, 5, 7].map((count) => (
              <div key={count} className={cn('h-3 w-3 rounded-sm', getColor(count))} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">More</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
```

### Event Timeline Component (`client/src/components/analytics/EventTimeline.tsx`)
```tsx
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Calendar, Clock, Users } from 'lucide-react';

interface TimelineEvent {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  category: string;
  type: string;
  status: 'upcoming' | 'active' | 'completed';
  attendeeCount: number;
}

interface EventTimelineProps {
  events: TimelineEvent[];
}

const statusColors = {
  upcoming: 'bg-blue-100 text-blue-800 border-blue-200',
  active: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-gray-100 text-gray-800 border-gray-200',
};

export function EventTimeline({ events }: EventTimelineProps) {
  return (
    <div className="relative space-y-0">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      {events.map((event, index) => (
        <div key={event.id} className="relative pl-10 pb-8 last:pb-0">
          {/* Timeline dot */}
          <div
            className={cn(
              'absolute left-2.5 w-3 h-3 rounded-full border-2 bg-background',
              event.status === 'active' ? 'border-green-500' :
              event.status === 'upcoming' ? 'border-blue-500' : 'border-gray-400'
            )}
          />

          {/* Event card */}
          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">{event.title}</h4>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(event.startDate).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(event.startDate).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {event.attendeeCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {event.attendeeCount}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <Badge variant="outline" className={statusColors[event.status]}>
                  {event.status}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {event.category}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      ))}

      {events.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No events in the selected time range
        </div>
      )}
    </div>
  );
}
```

### Types (`client/src/types/analytics.ts`)
```typescript
// Add to existing analytics types file

export interface EventsAnalyticsData {
  summary: EventsSummary;
  calendarHeatmap: HeatmapData[];
  categoryBreakdown: CategoryData[];
  typeBreakdown: TypeData[];
  timeline: TimelineEvent[];
  locationStats: LocationStat[];
  attendanceMetrics: AttendanceMetrics;
  monthlyTrends: MonthlyTrend[];
  departmentComparison: DepartmentEventStats[];
}

export interface EventsSummary {
  totalEvents: number;
  activeEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  archivedEvents: number;
  avgEventsPerMonth: number;
  totalAttendees: number;
  avgAttendeesPerEvent: number;
}

export interface HeatmapData {
  date: string;
  count: number;
  events: { id: number; title: string }[];
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
  id: number;
  title: string;
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

export interface AttendanceMetrics {
  totalInvited: number;
  totalConfirmed: number;
  totalAttended: number;
  avgConfirmationRate: number;
  avgAttendanceRate: number;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  eventCount: number;
  attendeeCount: number;
  previousYearCount: number;
}

export interface DepartmentEventStats {
  departmentId: number;
  departmentName: string;
  eventCount: number;
  upcomingCount: number;
  completedCount: number;
}
```

---

## Files to Create
- `server/services/events-analytics.service.ts` - Events analytics data aggregation
- `server/routes/events-analytics.routes.ts` - Events analytics API endpoints
- `client/src/pages/analytics/EventsDashboard.tsx` - Events analytics dashboard page
- `client/src/components/analytics/CalendarHeatmap.tsx` - GitHub-style calendar heatmap
- `client/src/components/analytics/EventTimeline.tsx` - Interactive event timeline
- `client/src/components/analytics/CategoryPieChart.tsx` - Category distribution chart
- `client/src/components/analytics/MonthlyTrendsChart.tsx` - Monthly trends line chart
- `client/src/components/analytics/LocationBarChart.tsx` - Location statistics chart
- `client/src/components/analytics/DepartmentComparisonTable.tsx` - Department comparison

## Files to Modify
- `server/routes.ts` - Register events analytics routes
- `client/src/App.tsx` - Add events dashboard route
- `client/src/types/analytics.ts` - Add events analytics types

## NPM Packages
```bash
# Already installed from executive dashboard
npm install recharts
```

## Acceptance Criteria
- [ ] Calendar heatmap shows event density per day
- [ ] Clicking heatmap cell shows events for that day
- [ ] Interactive timeline with status indicators
- [ ] Category breakdown pie chart with percentages
- [ ] Monthly trends comparison chart
- [ ] Location/venue statistics bar chart
- [ ] Department performance comparison table
- [ ] Date range filtering works correctly
- [ ] Department filtering for admins
- [ ] Loading skeletons during data fetch
- [ ] Responsive design for mobile/tablet
- [ ] Year selector for calendar view

## Dependencies
- Executive Dashboard (09) - shared components
