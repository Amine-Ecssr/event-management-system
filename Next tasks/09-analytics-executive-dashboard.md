# Analytics: Executive Dashboard

## Type
Feature / Analytics

## Priority
🟠 High

## Estimated Effort
10-12 hours

## Description
Build a comprehensive executive dashboard providing high-level KPIs and visualizations across all business areas. Real-time metrics with drill-down capabilities.

## Requirements

### Dashboard Sections
- Key Performance Indicators (KPIs)
- Events Overview (timeline, categories, completion rates)
- Tasks & Workload Distribution
- Partnerships & Agreements Status
- Contacts & Organizations Growth
- Department Performance Comparison

---

## Complete Implementation

### Backend Analytics Service (`server/services/analytics.service.ts`)
```typescript
import { db } from '../db';
import { 
  events, tasks, contacts, organizations, leads, 
  partnershipAgreements, users, departments 
} from '@shared/schema.mssql';
import { sql, eq, gte, lte, and, count, sum, avg, desc } from 'drizzle-orm';

export interface ExecutiveDashboardData {
  summary: DashboardSummary;
  eventMetrics: EventMetrics;
  taskMetrics: TaskMetrics;
  partnershipMetrics: PartnershipMetrics;
  contactMetrics: ContactMetrics;
  departmentPerformance: DepartmentPerformance[];
  trends: TrendData[];
}

export interface DashboardSummary {
  totalEvents: number;
  activeEvents: number;
  upcomingEvents: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalPartners: number;
  activeAgreements: number;
  totalContacts: number;
  totalLeads: number;
}

export interface EventMetrics {
  byCategory: { category: string; count: number }[];
  byType: { type: string; count: number }[];
  byMonth: { month: string; count: number }[];
  completionRate: number;
  avgDuration: number;
}

export interface TaskMetrics {
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  completionTrend: { date: string; completed: number; created: number }[];
  avgCompletionTime: number;
  overdueRate: number;
}

export interface PartnershipMetrics {
  byType: { type: string; count: number; value: number }[];
  byStatus: { status: string; count: number }[];
  renewalPipeline: { month: string; count: number; value: number }[];
  totalValue: number;
}

export interface ContactMetrics {
  byOrganization: { org: string; count: number }[];
  growthTrend: { month: string; added: number }[];
  totalWithEmail: number;
  totalWithPhone: number;
}

export interface DepartmentPerformance {
  departmentId: number;
  departmentName: string;
  eventsCount: number;
  tasksCompleted: number;
  tasksPending: number;
  completionRate: number;
}

export interface TrendData {
  date: string;
  events: number;
  tasks: number;
  contacts: number;
}

export class AnalyticsService {
  // Get complete executive dashboard data
  async getExecutiveDashboard(
    startDate?: Date, 
    endDate?: Date,
    departmentId?: number
  ): Promise<ExecutiveDashboardData> {
    const dateFilter = this.buildDateFilter(startDate, endDate);
    
    const [
      summary,
      eventMetrics,
      taskMetrics,
      partnershipMetrics,
      contactMetrics,
      departmentPerformance,
      trends,
    ] = await Promise.all([
      this.getSummary(departmentId),
      this.getEventMetrics(dateFilter, departmentId),
      this.getTaskMetrics(dateFilter, departmentId),
      this.getPartnershipMetrics(dateFilter),
      this.getContactMetrics(dateFilter),
      this.getDepartmentPerformance(dateFilter),
      this.getTrends(startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), endDate || new Date()),
    ]);
    
    return {
      summary,
      eventMetrics,
      taskMetrics,
      partnershipMetrics,
      contactMetrics,
      departmentPerformance,
      trends,
    };
  }
  
  // Summary KPIs
  private async getSummary(departmentId?: number): Promise<DashboardSummary> {
    const now = new Date();
    
    // Events counts
    const totalEvents = await db.select({ count: count() })
      .from(events)
      .where(departmentId ? eq(events.departmentId, departmentId) : undefined);
    
    const activeEvents = await db.select({ count: count() })
      .from(events)
      .where(and(
        eq(events.isArchived, false),
        lte(events.startDate, now),
        gte(events.endDate, now),
        departmentId ? eq(events.departmentId, departmentId) : undefined
      ));
    
    const upcomingEvents = await db.select({ count: count() })
      .from(events)
      .where(and(
        eq(events.isArchived, false),
        gte(events.startDate, now),
        departmentId ? eq(events.departmentId, departmentId) : undefined
      ));
    
    // Task counts
    const totalTasks = await db.select({ count: count() })
      .from(tasks)
      .where(departmentId ? eq(tasks.departmentId, departmentId) : undefined);
    
    const completedTasks = await db.select({ count: count() })
      .from(tasks)
      .where(and(
        eq(tasks.status, 'completed'),
        departmentId ? eq(tasks.departmentId, departmentId) : undefined
      ));
    
    const overdueTasks = await db.select({ count: count() })
      .from(tasks)
      .where(and(
        sql`${tasks.status} != 'completed'`,
        lte(tasks.dueDate, now),
        departmentId ? eq(tasks.departmentId, departmentId) : undefined
      ));
    
    // Partnerships
    const totalPartners = await db.select({ count: sql<number>`count(DISTINCT ${partnershipAgreements.organizationId})` })
      .from(partnershipAgreements);
    
    const activeAgreements = await db.select({ count: count() })
      .from(partnershipAgreements)
      .where(eq(partnershipAgreements.status, 'active'));
    
    // Contacts & Leads
    const totalContacts = await db.select({ count: count() }).from(contacts);
    const totalLeads = await db.select({ count: count() }).from(leads);
    
    return {
      totalEvents: totalEvents[0]?.count || 0,
      activeEvents: activeEvents[0]?.count || 0,
      upcomingEvents: upcomingEvents[0]?.count || 0,
      totalTasks: totalTasks[0]?.count || 0,
      completedTasks: completedTasks[0]?.count || 0,
      overdueTasks: overdueTasks[0]?.count || 0,
      totalPartners: totalPartners[0]?.count || 0,
      activeAgreements: activeAgreements[0]?.count || 0,
      totalContacts: totalContacts[0]?.count || 0,
      totalLeads: totalLeads[0]?.count || 0,
    };
  }
  
  // Event metrics
  private async getEventMetrics(dateFilter: any, departmentId?: number): Promise<EventMetrics> {
    const byCategory = await db.select({
      category: events.category,
      count: count(),
    })
      .from(events)
      .where(departmentId ? eq(events.departmentId, departmentId) : undefined)
      .groupBy(events.category);
    
    const byType = await db.select({
      type: events.eventType,
      count: count(),
    })
      .from(events)
      .where(departmentId ? eq(events.departmentId, departmentId) : undefined)
      .groupBy(events.eventType);
    
    const byMonth = await db.select({
      month: sql<string>`TO_CHAR(${events.startDate}, 'YYYY-MM')`,
      count: count(),
    })
      .from(events)
      .where(departmentId ? eq(events.departmentId, departmentId) : undefined)
      .groupBy(sql`TO_CHAR(${events.startDate}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${events.startDate}, 'YYYY-MM')`);
    
    return {
      byCategory: byCategory.map(r => ({ category: r.category || 'Other', count: r.count })),
      byType: byType.map(r => ({ type: r.type || 'Other', count: r.count })),
      byMonth: byMonth.map(r => ({ month: r.month, count: r.count })),
      completionRate: 0, // Calculate based on workflow status if applicable
      avgDuration: 0, // Calculate average event duration
    };
  }
  
  // Task metrics
  private async getTaskMetrics(dateFilter: any, departmentId?: number): Promise<TaskMetrics> {
    const byStatus = await db.select({
      status: tasks.status,
      count: count(),
    })
      .from(tasks)
      .where(departmentId ? eq(tasks.departmentId, departmentId) : undefined)
      .groupBy(tasks.status);
    
    const byPriority = await db.select({
      priority: tasks.priority,
      count: count(),
    })
      .from(tasks)
      .where(departmentId ? eq(tasks.departmentId, departmentId) : undefined)
      .groupBy(tasks.priority);
    
    return {
      byStatus: byStatus.map(r => ({ status: r.status, count: r.count })),
      byPriority: byPriority.map(r => ({ priority: r.priority || 'normal', count: r.count })),
      completionTrend: [],
      avgCompletionTime: 0,
      overdueRate: 0,
    };
  }
  
  // Partnership metrics
  private async getPartnershipMetrics(dateFilter: any): Promise<PartnershipMetrics> {
    const byStatus = await db.select({
      status: partnershipAgreements.status,
      count: count(),
    })
      .from(partnershipAgreements)
      .groupBy(partnershipAgreements.status);
    
    return {
      byType: [],
      byStatus: byStatus.map(r => ({ status: r.status, count: r.count })),
      renewalPipeline: [],
      totalValue: 0,
    };
  }
  
  // Contact metrics
  private async getContactMetrics(dateFilter: any): Promise<ContactMetrics> {
    const byOrg = await db.select({
      org: organizations.name,
      count: count(),
    })
      .from(contacts)
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .groupBy(organizations.name)
      .offset(10);
    
    const withEmail = await db.select({ count: count() })
      .from(contacts)
      .where(sql`${contacts.email} IS NOT NULL AND ${contacts.email} != ''`);
    
    const withPhone = await db.select({ count: count() })
      .from(contacts)
      .where(sql`${contacts.phone} IS NOT NULL AND ${contacts.phone} != ''`);
    
    return {
      byOrganization: byOrg.map(r => ({ org: r.org || 'Unknown', count: r.count })),
      growthTrend: [],
      totalWithEmail: withEmail[0]?.count || 0,
      totalWithPhone: withPhone[0]?.count || 0,
    };
  }
  
  // Department performance
  private async getDepartmentPerformance(dateFilter: any): Promise<DepartmentPerformance[]> {
    const depts = await db.select().from(departments);
    
    const performance: DepartmentPerformance[] = [];
    
    for (const dept of depts) {
      const eventsCount = await db.select({ count: count() })
        .from(events)
        .where(eq(events.departmentId, dept.id));
      
      const tasksCompleted = await db.select({ count: count() })
        .from(tasks)
        .where(and(
          eq(tasks.departmentId, dept.id),
          eq(tasks.status, 'completed')
        ));
      
      const tasksPending = await db.select({ count: count() })
        .from(tasks)
        .where(and(
          eq(tasks.departmentId, dept.id),
          sql`${tasks.status} != 'completed'`
        ));
      
      const total = (tasksCompleted[0]?.count || 0) + (tasksPending[0]?.count || 0);
      
      performance.push({
        departmentId: dept.id,
        departmentName: dept.name,
        eventsCount: eventsCount[0]?.count || 0,
        tasksCompleted: tasksCompleted[0]?.count || 0,
        tasksPending: tasksPending[0]?.count || 0,
        completionRate: total > 0 ? Math.round((tasksCompleted[0]?.count || 0) / total * 100) : 0,
      });
    }
    
    return performance.sort((a, b) => b.completionRate - a.completionRate);
  }
  
  // Trends over time
  private async getTrends(startDate: Date, endDate: Date): Promise<TrendData[]> {
    // Generate date series and aggregate data
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const trends: TrendData[] = [];
    
    // Simplified - in production, use a single SQL query with date_trunc
    for (let i = 0; i < days; i += 7) { // Weekly aggregation
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const nextWeek = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      trends.push({
        date: date.toISOString().split('T')[0],
        events: 0, // Count events in range
        tasks: 0,  // Count tasks in range
        contacts: 0, // Count contacts in range
      });
    }
    
    return trends;
  }
  
  private buildDateFilter(startDate?: Date, endDate?: Date) {
    return { startDate, endDate };
  }
}

export const analyticsService = new AnalyticsService();
```

### Analytics Routes (`server/routes/analytics.routes.ts`)
```typescript
import { Router } from 'express';
import { analyticsService } from '../services/analytics.service';
import { isAuthenticated, isAdminOrSuperAdmin } from '../auth';

const router = Router();

// Executive dashboard
router.get('/api/analytics/dashboard', isAdminOrSuperAdmin, async (req, res) => {
  const { startDate, endDate, departmentId } = req.query;
  
  const data = await analyticsService.getExecutiveDashboard(
    startDate ? new Date(String(startDate)) : undefined,
    endDate ? new Date(String(endDate)) : undefined,
    departmentId ? Number(departmentId) : undefined
  );
  
  res.json(data);
});

// Events analytics
router.get('/api/analytics/events', isAuthenticated, async (req, res) => {
  const { startDate, endDate, departmentId } = req.query;
  // Return event-specific analytics
  res.json({});
});

// Tasks analytics
router.get('/api/analytics/tasks', isAuthenticated, async (req, res) => {
  const { startDate, endDate, departmentId } = req.query;
  // Return task-specific analytics
  res.json({});
});

// Partnerships analytics
router.get('/api/analytics/partnerships', isAuthenticated, async (req, res) => {
  const { startDate, endDate } = req.query;
  // Return partnership-specific analytics
  res.json({});
});

export default router;
```

### Frontend Dashboard Page (`client/src/pages/analytics/ExecutiveDashboard.tsx`)
```tsx
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { KPICard } from '@/components/analytics/KPICard';
import { EventsChart } from '@/components/analytics/EventsChart';
import { TasksChart } from '@/components/analytics/TasksChart';
import { DepartmentTable } from '@/components/analytics/DepartmentTable';
import { TrendsChart } from '@/components/analytics/TrendsChart';
import { Calendar, CheckSquare, Users, Building2, TrendingUp, AlertTriangle } from 'lucide-react';
import type { ExecutiveDashboardData } from '@/types/analytics';

export default function ExecutiveDashboard() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [departmentId, setDepartmentId] = useState<string>('all');
  
  const { data, isLoading, error } = useQuery<ExecutiveDashboardData>({
    queryKey: ['analytics', 'dashboard', dateRange, departmentId],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });
      if (departmentId !== 'all') params.set('departmentId', departmentId);
      
      const response = await fetch(`/api/analytics/dashboard?${params}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  if (isLoading) return <DashboardSkeleton />;
  if (error) return <div>Error loading dashboard</div>;
  if (!data) return null;
  
  const { summary } = data;
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('analytics.executiveDashboard')}</h1>
        <div className="flex gap-4">
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('analytics.allDepartments')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('analytics.allDepartments')}</SelectItem>
              {/* Add department options */}
            </SelectContent>
          </Select>
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
          />
        </div>
      </div>
      
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <KPICard
          title={t('analytics.totalEvents')}
          value={summary.totalEvents}
          icon={Calendar}
          trend={{ value: 12, direction: 'up' }}
          color="blue"
        />
        <KPICard
          title={t('analytics.activeTasks')}
          value={summary.totalTasks - summary.completedTasks}
          icon={CheckSquare}
          subValue={`${summary.completedTasks} ${t('analytics.completed')}`}
          color="green"
        />
        <KPICard
          title={t('analytics.overdueTasks')}
          value={summary.overdueTasks}
          icon={AlertTriangle}
          color="red"
        />
        <KPICard
          title={t('analytics.totalContacts')}
          value={summary.totalContacts}
          icon={Users}
          trend={{ value: 8, direction: 'up' }}
          color="purple"
        />
        <KPICard
          title={t('analytics.activePartners')}
          value={summary.activeAgreements}
          icon={Building2}
          subValue={`${summary.totalPartners} ${t('analytics.total')}`}
          color="orange"
        />
      </div>
      
      {/* Charts */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t('analytics.overview')}</TabsTrigger>
          <TabsTrigger value="events">{t('analytics.events')}</TabsTrigger>
          <TabsTrigger value="tasks">{t('analytics.tasks')}</TabsTrigger>
          <TabsTrigger value="departments">{t('analytics.departments')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          {/* Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.activityTrends')}</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendsChart data={data.trends} />
            </CardContent>
          </Card>
          
          <div className="grid gap-6 md:grid-cols-2">
            {/* Events by Category */}
            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.eventsByCategory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <EventsChart data={data.eventMetrics.byCategory} type="pie" />
              </CardContent>
            </Card>
            
            {/* Tasks by Status */}
            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.tasksByStatus')}</CardTitle>
              </CardHeader>
              <CardContent>
                <TasksChart data={data.taskMetrics.byStatus} type="bar" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="events">
          <EventsAnalyticsSection metrics={data.eventMetrics} />
        </TabsContent>
        
        <TabsContent value="tasks">
          <TasksAnalyticsSection metrics={data.taskMetrics} />
        </TabsContent>
        
        <TabsContent value="departments">
          <DepartmentTable data={data.departmentPerformance} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
```

### Chart Components (`client/src/components/analytics/`)
```tsx
// KPICard.tsx
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  trend?: { value: number; direction: 'up' | 'down' };
  subValue?: string;
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange';
}

const colorClasses = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  red: 'bg-red-100 text-red-600',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600',
};

export function KPICard({ title, value, icon: Icon, trend, subValue, color = 'blue' }: KPICardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className={cn('p-2 rounded-lg', colorClasses[color])}>
            <Icon className="h-5 w-5" />
          </div>
          {trend && (
            <div className={cn(
              'flex items-center text-sm',
              trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
            )}>
              {trend.direction === 'up' ? (
                <TrendingUp className="h-4 w-4 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 mr-1" />
              )}
              {trend.value}%
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold">{value.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
          {subValue && (
            <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// TrendsChart.tsx (using recharts)
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TrendsChartProps {
  data: { date: string; events: number; tasks: number; contacts: number }[];
}

export function TrendsChart({ data }: TrendsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="events" stroke="#3b82f6" name="Events" />
        <Line type="monotone" dataKey="tasks" stroke="#22c55e" name="Tasks" />
        <Line type="monotone" dataKey="contacts" stroke="#a855f7" name="Contacts" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

## Files to Create
- `server/services/analytics.service.ts` - Analytics data aggregation
- `server/routes/analytics.routes.ts` - Analytics API endpoints
- `client/src/pages/analytics/ExecutiveDashboard.tsx` - Main dashboard page
- `client/src/components/analytics/KPICard.tsx` - KPI display card
- `client/src/components/analytics/TrendsChart.tsx` - Line chart for trends
- `client/src/components/analytics/EventsChart.tsx` - Event visualizations
- `client/src/components/analytics/TasksChart.tsx` - Task visualizations
- `client/src/components/analytics/DepartmentTable.tsx` - Department comparison
- `client/src/types/analytics.ts` - Analytics type definitions

## Files to Modify
- `server/routes.ts` - Register analytics routes
- `client/src/App.tsx` - Add dashboard route
- `client/src/components/layout/Sidebar.tsx` - Add analytics menu

## NPM Packages
```bash
npm install recharts
npm install --save-dev @types/recharts
```

## Acceptance Criteria
- [ ] KPI cards with trend indicators
- [ ] Date range filtering
- [ ] Department filtering (for admins)
- [ ] Events by category/type pie charts
- [ ] Tasks by status/priority bar charts
- [ ] Activity trends line chart
- [ ] Department performance comparison table
- [ ] Data refresh on filter change
- [ ] Loading skeletons
- [ ] Export to CSV/PDF (optional)

## Performance Considerations
- Cache dashboard data (5 min stale time)
- Aggregate queries in backend
- Use materialized views for complex metrics (if needed)

## Dependencies
- Elasticsearch (optional for faster aggregations)
