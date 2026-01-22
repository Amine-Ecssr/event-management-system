/**
 * Tasks Analytics Dashboard Page
 * 
 * Comprehensive dashboard for task analytics including:
 * - KPI summary cards
 * - Status and priority breakdowns
 * - Department performance
 * - Overdue tasks list
 * - Monthly trends
 * - Workload distribution
 * 
 * @module pages/analytics/TasksDashboard
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  KPICard,
  TaskStatusChart,
  TaskPriorityChart,
  TaskTrendsChart,
  DepartmentPerformanceTable,
  OverdueTasksList,
  WorkloadChart,
} from '@/components/analytics';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  ListTodo,
  RefreshCw,
  BarChart3,
  Building2,
  LineChart,
  Loader2,
  Timer,
} from 'lucide-react';
import type { TasksAnalyticsData } from '@/types/analytics';

export default function TasksDashboard() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  // Calculate date range based on selected year
  const dateRange = {
    from: new Date(selectedYear, 0, 1),
    to: selectedYear === currentYear ? new Date() : new Date(selectedYear, 11, 31),
  };

  const { data, isLoading, error, refetch } = useQuery<TasksAnalyticsData>({
    queryKey: ['analytics', 'tasks', selectedYear, selectedDepartment],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });
      if (selectedDepartment !== 'all') {
        params.append('departmentId', selectedDepartment);
      }
      const response = await fetch(`/api/analytics/tasks?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch tasks analytics');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) return <TasksDashboardSkeleton />;
  
  if (error) {
    return (
      <div className="container mx-auto px-6 py-6">
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive font-medium">
              {t('tasksAnalytics.error', 'Error loading dashboard')}
            </p>
            <Button onClick={() => refetch()} variant="outline" className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('common.retry', 'Retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!data) return null;

  const { summary } = data;

  // Generate year options (last 5 years)
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Get unique departments from workload data for filter
  const departments = data.workloadDistribution.map(d => ({
    id: d.departmentId.toString(),
    name: d.departmentName,
  }));

  return (
    <div className="container mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {t('tasksAnalytics.title', 'Tasks Analytics')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('tasksAnalytics.subtitle', 'Track task performance and department efficiency')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select 
            value={selectedDepartment} 
            onValueChange={setSelectedDepartment}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('tasksAnalytics.allDepartments', 'All Departments')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('tasksAnalytics.allDepartments', 'All Departments')}
              </SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select 
            value={selectedYear.toString()} 
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder={t('common.year', 'Year')} />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year.toString()}>
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
        <KPICard
          title={t('tasksAnalytics.totalTasks', 'Total Tasks')}
          value={summary.totalTasks}
          icon={ListTodo}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100 dark:bg-blue-900/30"
          subtitle={`${summary.completedTasks} ${t('tasksAnalytics.completed', 'completed')}`}
        />
        <KPICard
          title={t('tasksAnalytics.completionRate', 'Completion Rate')}
          value={`${summary.completionRate}%`}
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBgColor="bg-green-100 dark:bg-green-900/30"
        />
        <KPICard
          title={t('tasksAnalytics.overdueTasks', 'Overdue Tasks')}
          value={summary.overdueTasks}
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBgColor="bg-red-100 dark:bg-red-900/30"
          subtitle={`${summary.highPriorityPending} ${t('tasksAnalytics.highPriority', 'high priority')}`}
        />
        <KPICard
          title={t('tasksAnalytics.avgCompletionTime', 'Avg Completion Time')}
          value={`${summary.avgCompletionTime}`}
          icon={Timer}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100 dark:bg-purple-900/30"
          subtitle={t('tasksAnalytics.days', 'days')}
        />
      </div>

      {/* Overdue Alert Banner */}
      {summary.overdueTasks > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-4 flex-wrap">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <p className="font-medium text-red-800 dark:text-red-200">
                  {summary.overdueTasks} {t('tasksAnalytics.tasksOverdue', 'tasks are overdue')}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {t('tasksAnalytics.reviewOverdue', 'Review and update task status or deadlines')}
                </p>
              </div>
              <Badge variant="outline" className="border-red-600 text-red-600">
                {t('tasksAnalytics.urgent', 'Urgent')}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4 hidden sm:inline" />
            {t('tasksAnalytics.overview', 'Overview')}
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-2">
            <Building2 className="h-4 w-4 hidden sm:inline" />
            {t('tasksAnalytics.departments', 'Departments')}
          </TabsTrigger>
          <TabsTrigger value="overdue" className="gap-2">
            <AlertTriangle className="h-4 w-4 hidden sm:inline" />
            {t('tasksAnalytics.overdueTab', 'Overdue')}
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-2">
            <LineChart className="h-4 w-4 hidden sm:inline" />
            {t('tasksAnalytics.trends', 'Trends')}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  {t('tasksAnalytics.tasksByStatus', 'Tasks by Status')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TaskStatusChart data={data.byStatus} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {t('tasksAnalytics.tasksByPriority', 'Tasks by Priority')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TaskPriorityChart data={data.byPriority} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                {t('tasksAnalytics.workloadDistribution', 'Workload Distribution')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkloadChart data={data.workloadDistribution} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments">
          <Card>
            <CardHeader>
              <CardTitle>
                {t('tasksAnalytics.departmentPerformance', 'Department Performance')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DepartmentPerformanceTable data={data.departmentPerformance} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Overdue Tab */}
        <TabsContent value="overdue">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                {t('tasksAnalytics.overdueTasks', 'Overdue Tasks')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OverdueTasksList tasks={data.overdueTasks} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>
                {t('tasksAnalytics.taskTrends', 'Task Trends')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TaskTrendsChart data={data.monthlyTrends} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Loading skeleton for tasks dashboard
 */
function TasksDashboardSkeleton() {
  return (
    <div className="container mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-64 mt-2" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-[120px]" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>

      {/* Main Content */}
      <Skeleton className="h-12 w-96" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[350px]" />
        <Skeleton className="h-[350px]" />
      </div>
    </div>
  );
}
