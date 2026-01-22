/**
 * Executive Dashboard Page
 * 
 * Analytics dashboard with KPIs, charts, and department performance metrics.
 * 
 * @module pages/analytics/ExecutiveDashboard
 */

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { 
  Calendar, 
  CheckSquare, 
  Users, 
  Building2, 
  Handshake, 
  Target,
  AlertTriangle,
  TrendingUp,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  KPICard, 
  KPICardSkeleton,
  TrendsChart,
  TrendsChartSkeleton,
  EventsChart,
  TasksChart,
  DepartmentTable,
  DepartmentTableSkeleton
} from "@/components/analytics";
import { apiRequest } from "@/lib/queryClient";
import type { 
  DashboardSummary, 
  ActivityTrends, 
  CategoryStats, 
  EventTypeStats,
  StatusStats,
  PriorityStats,
  DepartmentStats,
  CompletionRate,
  OverdueStats
} from "@/types/analytics";
import { useState } from "react";

/**
 * Time period options for filtering
 */
const TIME_PERIODS = [
  { value: "week", label: "Last 7 Days" },
  { value: "month", label: "Last 30 Days" },
  { value: "quarter", label: "Last 90 Days" },
  { value: "year", label: "Last Year" },
];

/**
 * Executive Dashboard Page Component
 */
export default function ExecutiveDashboard() {
  const { t } = useTranslation();
  const [timePeriod, setTimePeriod] = useState("month");

  // Fetch dashboard summary
  const { 
    data: summary, 
    isLoading: summaryLoading, 
    error: summaryError,
    refetch: refetchSummary
  } = useQuery<DashboardSummary>({
    queryKey: ["/api/analytics/dashboard/summary"],
    queryFn: () => apiRequest("GET", "/api/analytics/dashboard/summary"),
  });

  // Fetch activity trends
  const { data: trends, isLoading: trendsLoading } = useQuery<ActivityTrends>({
    queryKey: ["/api/analytics/overview/trends", timePeriod],
    queryFn: () => apiRequest("GET", `/api/analytics/overview/trends?period=${timePeriod}`),
  });

  // Fetch events by category
  const { data: eventsByCategory } = useQuery<CategoryStats[]>({
    queryKey: ["/api/analytics/events/by-category"],
    queryFn: () => apiRequest("GET", "/api/analytics/events/by-category"),
  });

  // Fetch events by type
  const { data: eventsByType } = useQuery<EventTypeStats[]>({
    queryKey: ["/api/analytics/events/by-type"],
    queryFn: () => apiRequest("GET", "/api/analytics/events/by-type"),
  });

  // Fetch tasks by status
  const { data: tasksByStatus } = useQuery<StatusStats[]>({
    queryKey: ["/api/analytics/tasks/by-status"],
    queryFn: () => apiRequest("GET", "/api/analytics/tasks/by-status"),
  });

  // Fetch tasks by priority
  const { data: tasksByPriority } = useQuery<PriorityStats[]>({
    queryKey: ["/api/analytics/tasks/by-priority"],
    queryFn: () => apiRequest("GET", "/api/analytics/tasks/by-priority"),
  });

  // Fetch tasks by department
  const { data: tasksByDepartment } = useQuery<DepartmentStats[]>({
    queryKey: ["/api/analytics/tasks/by-department"],
    queryFn: () => apiRequest("GET", "/api/analytics/tasks/by-department"),
  });

  // Fetch task completion rate
  const { data: completionRate } = useQuery<CompletionRate>({
    queryKey: ["/api/analytics/tasks/completion-rate"],
    queryFn: () => apiRequest("GET", "/api/analytics/tasks/completion-rate"),
  });

  // Fetch overdue tasks
  const { data: overdueTasks } = useQuery<OverdueStats>({
    queryKey: ["/api/analytics/tasks/overdue"],
    queryFn: () => apiRequest("GET", "/api/analytics/tasks/overdue"),
  });

  // Handle refresh
  const handleRefresh = () => {
    refetchSummary();
  };

  // Error state
  if (summaryError) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("analytics.errors.title")}</AlertTitle>
          <AlertDescription>
            {t("analytics.errors.loadFailed")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("analytics.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("analytics.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("analytics.filters.selectPeriod")} />
            </SelectTrigger>
            <SelectContent>
              {TIME_PERIODS.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {t(`filters.${period.value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryLoading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              title={t("analytics.kpis.totalEvents")}
              value={summary?.totalEvents || 0}
              icon={Calendar}
              iconColor="text-blue-600"
              iconBgColor="bg-blue-100 dark:bg-blue-900"
              subtitle={t("analytics.kpis.activeEvents", { count: summary?.activeEvents || 0 })}
            />
            <KPICard
              title={t("analytics.kpis.totalTasks")}
              value={summary?.totalTasks || 0}
              icon={CheckSquare}
              iconColor="text-green-600"
              iconBgColor="bg-green-100 dark:bg-green-900"
              subtitle={t("analytics.kpis.completedTasks", { count: summary?.completedTasks || 0 })}
              trend={completionRate ? {
                value: completionRate.rate,
                direction: completionRate.rate >= 70 ? 'up' : completionRate.rate >= 50 ? 'neutral' : 'down'
              } : undefined}
            />
            <KPICard
              title={t("analytics.kpis.overdueTasks")}
              value={summary?.overdueTasks || 0}
              icon={AlertTriangle}
              iconColor="text-red-600"
              iconBgColor="bg-red-100 dark:bg-red-900"
              subtitle={t("analytics.kpis.requireAttention")}
            />
            <KPICard
              title={t("analytics.kpis.totalPartners")}
              value={summary?.totalPartners || 0}
              icon={Handshake}
              iconColor="text-amber-600"
              iconBgColor="bg-amber-100 dark:bg-amber-900"
              subtitle={t("analytics.kpis.activeAgreements", { count: summary?.activeAgreements || 0 })}
            />
          </>
        )}
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryLoading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              title={t("analytics.kpis.upcomingEvents")}
              value={summary?.upcomingEvents || 0}
              icon={TrendingUp}
              iconColor="text-indigo-600"
              iconBgColor="bg-indigo-100 dark:bg-indigo-900"
            />
            <KPICard
              title={t("analytics.kpis.totalContacts")}
              value={summary?.totalContacts || 0}
              icon={Users}
              iconColor="text-violet-600"
              iconBgColor="bg-violet-100 dark:bg-violet-900"
            />
            <KPICard
              title={t("analytics.kpis.totalOrganizations")}
              value={summary?.totalOrganizations || 0}
              icon={Building2}
              iconColor="text-cyan-600"
              iconBgColor="bg-cyan-100 dark:bg-cyan-900"
            />
            <KPICard
              title={t("analytics.kpis.openLeads")}
              value={summary?.openLeads || 0}
              icon={Target}
              iconColor="text-pink-600"
              iconBgColor="bg-pink-100 dark:bg-pink-900"
              subtitle={t("analytics.kpis.totalLeads", { count: summary?.totalLeads || 0 })}
            />
          </>
        )}
      </div>

      {/* Activity Trends */}
      {trendsLoading ? (
        <TrendsChartSkeleton height={350} />
      ) : trends ? (
        <TrendsChart data={trends} height={350} />
      ) : null}

      {/* Charts Tabs */}
      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">{t("analytics.tabs.events")}</TabsTrigger>
          <TabsTrigger value="tasks">{t("analytics.tabs.tasks")}</TabsTrigger>
          <TabsTrigger value="departments">{t("analytics.tabs.departments")}</TabsTrigger>
        </TabsList>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {eventsByCategory && (
              <EventsChart
                categoryData={eventsByCategory}
                typeData={eventsByType || []}
                defaultTab="category"
                height={300}
              />
            )}
            {eventsByType && eventsByType.length > 0 && (
              <EventsChart
                typeData={eventsByType}
                defaultTab="type"
                height={300}
              />
            )}
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <TasksChart
              statusData={tasksByStatus || []}
              priorityData={tasksByPriority || []}
              defaultTab="status"
              height={300}
            />
            <TasksChart
              completionData={completionRate}
              departmentData={tasksByDepartment || []}
              defaultTab="completion"
              height={300}
            />
          </div>
          
          {/* Overdue Tasks Breakdown */}
          {overdueTasks && overdueTasks.total > 0 && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t("analytics.overdue.title")}</AlertTitle>
              <AlertDescription>
                {t("analytics.overdue.description", { count: overdueTasks.total })}
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="space-y-4">
          {tasksByDepartment && tasksByDepartment.length > 0 ? (
            <DepartmentTable
              data={tasksByDepartment.map(d => ({
                departmentId: d.departmentId,
                departmentName: d.departmentName,
                eventsCount: 0, // Would need separate query
                tasksCompleted: Math.round(d.count * (d.completionRate || 0) / 100),
                tasksPending: Math.round(d.count * (1 - (d.completionRate || 0) / 100)),
                completionRate: d.completionRate || 0,
              }))}
            />
          ) : (
            <DepartmentTableSkeleton />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
