/**
 * Events Dashboard Page
 * 
 * Comprehensive events analytics dashboard with calendar heatmaps,
 * timelines, and category breakdowns.
 * 
 * @module pages/analytics/EventsDashboard
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Calendar, 
  Users, 
  MapPin, 
  TrendingUp, 
  Clock, 
  Archive,
  CalendarCheck,
  CalendarX,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  KPICard,
  KPICardSkeleton,
  CalendarHeatmap,
  CalendarHeatmapSkeleton,
  EventTimeline,
  EventTimelineSkeleton,
  EventsChart,
  LocationBarChart,
  DepartmentTable,
  DepartmentTableSkeleton,
} from '@/components/analytics';
import { apiRequest } from '@/lib/queryClient';

// Type definitions matching backend
interface EventsSummary {
  totalEvents: number;
  activeEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  archivedEvents: number;
  totalArchivedEvents: number;
  avgEventsPerMonth: number;
  totalAttendees: number;
  avgAttendeesPerEvent: number;
}

interface HeatmapData {
  date: string;
  count: number;
  events: { id: number; title: string }[];
}

interface CategoryData {
  category: string;
  count: number;
  percentage: number;
  trend: number;
}

interface TypeData {
  type: string;
  count: number;
  avgDuration: number;
  avgAttendees: number;
}

interface TimelineEvent {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  category: string;
  type: string;
  status: 'upcoming' | 'active' | 'completed';
  attendeeCount: number;
}

interface LocationStat {
  location: string;
  eventCount: number;
  totalAttendees: number;
}

interface MonthlyTrend {
  month: string;
  year: number;
  eventCount: number;
  attendeeCount: number;
  previousYearCount: number;
}

interface DepartmentEventStats {
  departmentId: number;
  departmentName: string;
  eventCount: number;
  upcomingCount: number;
  completedCount: number;
}

interface EventsAnalyticsData {
  summary: EventsSummary;
  calendarHeatmap: HeatmapData[];
  categoryBreakdown: CategoryData[];
  typeBreakdown: TypeData[];
  timeline: TimelineEvent[];
  locationStats: LocationStat[];
  monthlyTrends: MonthlyTrend[];
  departmentComparison: DepartmentEventStats[];
}

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

/**
 * Events Dashboard Page Component
 */
export default function EventsDashboard() {
  const { t } = useTranslation();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [departmentId, setDepartmentId] = useState<string>('all');

  // Calculate date range based on selected year
  const dateRange = {
    from: new Date(selectedYear, 0, 1),
    to: new Date(selectedYear, 11, 31),
  };

  // Fetch events analytics data
  const { 
    data, 
    isLoading, 
    error,
    refetch 
  } = useQuery<EventsAnalyticsData>({
    queryKey: ['analytics', 'events', 'dashboard', selectedYear, departmentId],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });
      if (departmentId !== 'all') {
        params.set('departmentId', departmentId);
      }
      return apiRequest('GET', `/api/analytics/events/dashboard?${params}`);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Error state
  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('eventsAnalytics.errors.title')}</AlertTitle>
          <AlertDescription>
            {t('eventsAnalytics.errors.loadFailed')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="container mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('eventsAnalytics.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('eventsAnalytics.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('eventsAnalytics.filters.allDepartments')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('eventsAnalytics.filters.allDepartments')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              title={t('eventsAnalytics.kpis.totalEvents')}
              value={summary?.totalEvents || 0}
              icon={Calendar}
              iconColor="text-blue-600"
              iconBgColor="bg-blue-100 dark:bg-blue-900"
            />
            <KPICard
              title={t('eventsAnalytics.kpis.upcomingEvents')}
              value={summary?.upcomingEvents || 0}
              icon={CalendarCheck}
              iconColor="text-green-600"
              iconBgColor="bg-green-100 dark:bg-green-900"
            />
            <KPICard
              title={t('eventsAnalytics.kpis.activeEvents')}
              value={summary?.activeEvents || 0}
              icon={Clock}
              iconColor="text-amber-600"
              iconBgColor="bg-amber-100 dark:bg-amber-900"
            />
            <KPICard
              title={t('eventsAnalytics.kpis.avgAttendeesPerEvent')}
              value={summary?.avgAttendeesPerEvent || 0}
              icon={Users}
              iconColor="text-violet-600"
              iconBgColor="bg-violet-100 dark:bg-violet-900"
            />
          </>
        )}
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {isLoading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              title={t('eventsAnalytics.kpis.avgEventsPerMonth')}
              value={summary?.avgEventsPerMonth || 0}
              icon={TrendingUp}
              iconColor="text-cyan-600"
              iconBgColor="bg-cyan-100 dark:bg-cyan-900"
            />
            <KPICard
              title={t('eventsAnalytics.kpis.completedEvents')}
              value={summary?.completedEvents || 0}
              icon={CalendarX}
              iconColor="text-gray-600"
              iconBgColor="bg-gray-100 dark:bg-gray-800"
            />
            <KPICard
              title={t('eventsAnalytics.kpis.archivedEvents')}
              value={summary?.archivedEvents || 0}
              icon={Archive}
              iconColor="text-gray-600"
              iconBgColor="bg-gray-100 dark:bg-gray-800"
              subtitle={summary?.totalArchivedEvents ? `${summary.totalArchivedEvents} ${t('eventsAnalytics.kpis.totalArchived', 'total')}` : undefined}
            />
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('eventsAnalytics.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="calendar">{t('eventsAnalytics.tabs.calendar')}</TabsTrigger>
          <TabsTrigger value="timeline">{t('eventsAnalytics.tabs.timeline')}</TabsTrigger>
          <TabsTrigger value="departments">{t('eventsAnalytics.tabs.departments')}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Category Breakdown */}
            {data?.categoryBreakdown && (
              <EventsChart
                categoryData={data.categoryBreakdown.map(c => ({
                  category: c.category,
                  count: c.count,
                  percentage: c.percentage,
                }))}
                typeData={data.typeBreakdown?.map(t => ({
                  eventType: t.type,
                  count: t.count,
                  percentage: 0,
                }))}
                defaultTab="category"
                height={300}
              />
            )}

            {/* Monthly Trends */}
            <Card>
              <CardHeader>
                <CardTitle>{t('eventsAnalytics.charts.monthlyTrends')}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-64 bg-muted animate-pulse rounded" />
                ) : data?.monthlyTrends ? (
                  <EventsChart
                    monthlyData={data.monthlyTrends.map(m => ({
                      month: m.month,
                      year: m.year,
                      count: m.eventCount,
                      previousYearCount: m.previousYearCount,
                    }))}
                    defaultTab="monthly"
                    height={250}
                  />
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Location Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {t('eventsAnalytics.charts.topLocations')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-64 bg-muted animate-pulse rounded" />
              ) : data?.locationStats ? (
                <LocationBarChart data={data.locationStats} />
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  {t('eventsAnalytics.charts.noLocationData')}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>{t('eventsAnalytics.charts.calendarHeatmap')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <CalendarHeatmapSkeleton />
              ) : data?.calendarHeatmap ? (
                <CalendarHeatmap
                  data={data.calendarHeatmap}
                  year={selectedYear}
                />
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>{t('eventsAnalytics.charts.eventTimeline')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <EventTimelineSkeleton />
              ) : data?.timeline ? (
                <EventTimeline events={data.timeline} maxItems={20} />
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments">
          {isLoading ? (
            <DepartmentTableSkeleton />
          ) : data?.departmentComparison ? (
            <DepartmentTable
              data={data.departmentComparison.map(d => ({
                departmentId: d.departmentId,
                departmentName: d.departmentName,
                eventsCount: d.eventCount,
                tasksCompleted: d.completedCount,
                tasksPending: d.upcomingCount,
                completionRate: d.eventCount > 0 
                  ? (d.completedCount / d.eventCount) * 100 
                  : 0,
              }))}
              title={t('eventsAnalytics.charts.departmentComparison')}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
