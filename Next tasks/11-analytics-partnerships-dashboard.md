# Analytics: Partnerships Dashboard

## Type
Feature / Analytics

## Priority
🟠 High

## Estimated Effort
8-10 hours

## Description
Build a comprehensive partnerships analytics dashboard with agreement pipeline visualization, renewal tracking, partner performance metrics, and financial summaries. Enables strategic partnership management decisions.

## Requirements

### Dashboard Features
- Partnership agreement pipeline (Kanban-style)
- Renewal calendar and alerts
- Partner organization performance
- Agreement type distribution
- Financial metrics and projections
- Partner engagement timeline

---

## Complete Implementation

### Backend Partnerships Analytics Service (`server/services/partnerships-analytics.service.ts`)
```typescript
import { db } from '../db';
import { 
  partnershipAgreements, organizations, contacts, 
  agreementTypes, events 
} from '@shared/schema.mssql';
import { sql, eq, gte, lte, and, count, sum, desc, asc } from 'drizzle-orm';

export interface PartnershipsAnalyticsData {
  summary: PartnershipsSummary;
  pipeline: PipelineData;
  renewalCalendar: RenewalItem[];
  agreementTypeBreakdown: AgreementTypeData[];
  partnerPerformance: PartnerPerformanceData[];
  financialMetrics: FinancialMetrics;
  monthlyTrends: PartnershipTrend[];
  recentActivity: PartnershipActivity[];
}

export interface PartnershipsSummary {
  totalPartnerships: number;
  activeAgreements: number;
  pendingAgreements: number;
  expiringThisMonth: number;
  expiringThisQuarter: number;
  newThisMonth: number;
  totalPartnerOrganizations: number;
  avgAgreementDuration: number;
}

export interface PipelineData {
  draft: PipelineStage;
  pending: PipelineStage;
  active: PipelineStage;
  expiring: PipelineStage;
  expired: PipelineStage;
  renewed: PipelineStage;
}

export interface PipelineStage {
  count: number;
  value: number;
  agreements: PipelineAgreement[];
}

export interface PipelineAgreement {
  id: number;
  organizationName: string;
  agreementType: string;
  startDate: string;
  endDate: string;
  value: number;
  status: string;
}

export interface RenewalItem {
  id: number;
  organizationName: string;
  agreementType: string;
  endDate: string;
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
}

export interface PartnershipActivity {
  id: number;
  type: 'created' | 'renewed' | 'expired' | 'updated';
  organizationName: string;
  agreementType: string;
  date: string;
  description: string;
}

export class PartnershipsAnalyticsService {
  async getPartnershipsAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Promise<PartnershipsAnalyticsData> {
    const start = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const [
      summary,
      pipeline,
      renewalCalendar,
      agreementTypeBreakdown,
      partnerPerformance,
      financialMetrics,
      monthlyTrends,
      recentActivity,
    ] = await Promise.all([
      this.getSummary(),
      this.getPipeline(),
      this.getRenewalCalendar(),
      this.getAgreementTypeBreakdown(),
      this.getPartnerPerformance(),
      this.getFinancialMetrics(start, end),
      this.getMonthlyTrends(start, end),
      this.getRecentActivity(),
    ]);

    return {
      summary,
      pipeline,
      renewalCalendar,
      agreementTypeBreakdown,
      partnerPerformance,
      financialMetrics,
      monthlyTrends,
      recentActivity,
    };
  }

  private async getSummary(): Promise<PartnershipsSummary> {
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const quarterEnd = new Date(now.getFullYear(), Math.ceil((now.getMonth() + 1) / 3) * 3, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      total,
      active,
      pending,
      expiringMonth,
      expiringQuarter,
      newMonth,
      partners,
    ] = await Promise.all([
      db.select({ count: count() }).from(partnershipAgreements),
      db.select({ count: count() })
        .from(partnershipAgreements)
        .where(eq(partnershipAgreements.status, 'active')),
      db.select({ count: count() })
        .from(partnershipAgreements)
        .where(eq(partnershipAgreements.status, 'pending')),
      db.select({ count: count() })
        .from(partnershipAgreements)
        .where(and(
          eq(partnershipAgreements.status, 'active'),
          lte(partnershipAgreements.endDate, monthEnd),
          gte(partnershipAgreements.endDate, now)
        )),
      db.select({ count: count() })
        .from(partnershipAgreements)
        .where(and(
          eq(partnershipAgreements.status, 'active'),
          lte(partnershipAgreements.endDate, quarterEnd),
          gte(partnershipAgreements.endDate, now)
        )),
      db.select({ count: count() })
        .from(partnershipAgreements)
        .where(gte(partnershipAgreements.createdAt, monthStart)),
      db.select({ count: sql<number>`count(DISTINCT ${partnershipAgreements.organizationId})` })
        .from(partnershipAgreements),
    ]);

    // Calculate average agreement duration
    const durationResult = await db.select({
      avgDuration: sql<number>`AVG(EXTRACT(EPOCH FROM (${partnershipAgreements.endDate} - ${partnershipAgreements.startDate})) / 86400)`,
    }).from(partnershipAgreements);

    return {
      totalPartnerships: total[0]?.count || 0,
      activeAgreements: active[0]?.count || 0,
      pendingAgreements: pending[0]?.count || 0,
      expiringThisMonth: expiringMonth[0]?.count || 0,
      expiringThisQuarter: expiringQuarter[0]?.count || 0,
      newThisMonth: newMonth[0]?.count || 0,
      totalPartnerOrganizations: partners[0]?.count || 0,
      avgAgreementDuration: Math.round(durationResult[0]?.avgDuration || 0),
    };
  }

  private async getPipeline(): Promise<PipelineData> {
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const statuses = ['draft', 'pending', 'active', 'expired'];
    const pipeline: PipelineData = {
      draft: { count: 0, value: 0, agreements: [] },
      pending: { count: 0, value: 0, agreements: [] },
      active: { count: 0, value: 0, agreements: [] },
      expiring: { count: 0, value: 0, agreements: [] },
      expired: { count: 0, value: 0, agreements: [] },
      renewed: { count: 0, value: 0, agreements: [] },
    };

    for (const status of statuses) {
      const agreements = await db.select({
        id: partnershipAgreements.id,
        organizationName: organizations.name,
        agreementType: agreementTypes.name,
        startDate: partnershipAgreements.startDate,
        endDate: partnershipAgreements.endDate,
        status: partnershipAgreements.status,
      })
        .from(partnershipAgreements)
        .leftJoin(organizations, eq(partnershipAgreements.organizationId, organizations.id))
        .leftJoin(agreementTypes, eq(partnershipAgreements.agreementTypeId, agreementTypes.id))
        .where(eq(partnershipAgreements.status, status))
        .offset(20);

      const stage = status as keyof PipelineData;
      if (pipeline[stage]) {
        pipeline[stage] = {
          count: agreements.length,
          value: 0, // Calculate if you have value field
          agreements: agreements.map(a => ({
            id: a.id,
            organizationName: a.organizationName || 'Unknown',
            agreementType: a.agreementType || 'General',
            startDate: a.startDate?.toISOString() || '',
            endDate: a.endDate?.toISOString() || '',
            value: 0,
            status: a.status,
          })),
        };
      }
    }

    // Get expiring soon (active but ending within 30 days)
    const expiring = await db.select({
      id: partnershipAgreements.id,
      organizationName: organizations.name,
      agreementType: agreementTypes.name,
      startDate: partnershipAgreements.startDate,
      endDate: partnershipAgreements.endDate,
      status: partnershipAgreements.status,
    })
      .from(partnershipAgreements)
      .leftJoin(organizations, eq(partnershipAgreements.organizationId, organizations.id))
      .leftJoin(agreementTypes, eq(partnershipAgreements.agreementTypeId, agreementTypes.id))
      .where(and(
        eq(partnershipAgreements.status, 'active'),
        lte(partnershipAgreements.endDate, thirtyDaysFromNow),
        gte(partnershipAgreements.endDate, now)
      ))
      .offset(20);

    pipeline.expiring = {
      count: expiring.length,
      value: 0,
      agreements: expiring.map(a => ({
        id: a.id,
        organizationName: a.organizationName || 'Unknown',
        agreementType: a.agreementType || 'General',
        startDate: a.startDate?.toISOString() || '',
        endDate: a.endDate?.toISOString() || '',
        value: 0,
        status: 'expiring',
      })),
    };

    return pipeline;
  }

  private async getRenewalCalendar(): Promise<RenewalItem[]> {
    const now = new Date();
    const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const expiringAgreements = await db.select({
      id: partnershipAgreements.id,
      organizationName: organizations.name,
      agreementType: agreementTypes.name,
      endDate: partnershipAgreements.endDate,
    })
      .from(partnershipAgreements)
      .leftJoin(organizations, eq(partnershipAgreements.organizationId, organizations.id))
      .leftJoin(agreementTypes, eq(partnershipAgreements.agreementTypeId, agreementTypes.id))
      .where(and(
        eq(partnershipAgreements.status, 'active'),
        lte(partnershipAgreements.endDate, ninetyDaysFromNow),
        gte(partnershipAgreements.endDate, now)
      ))
      .orderBy(asc(partnershipAgreements.endDate));

    return expiringAgreements.map(a => {
      const daysUntilExpiry = Math.ceil(
        (new Date(a.endDate!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      return {
        id: a.id,
        organizationName: a.organizationName || 'Unknown',
        agreementType: a.agreementType || 'General',
        endDate: a.endDate?.toISOString() || '',
        daysUntilExpiry,
        value: 0,
        priority: daysUntilExpiry <= 14 ? 'high' as const :
          daysUntilExpiry <= 30 ? 'medium' as const : 'low' as const,
      };
    });
  }

  private async getAgreementTypeBreakdown(): Promise<AgreementTypeData[]> {
    const result = await db.select({
      type: agreementTypes.name,
      count: count(),
    })
      .from(partnershipAgreements)
      .leftJoin(agreementTypes, eq(partnershipAgreements.agreementTypeId, agreementTypes.id))
      .groupBy(agreementTypes.name)
      .orderBy(desc(count()));

    const total = result.reduce((sum, r) => sum + r.count, 0);

    return result.map(r => ({
      type: r.type || 'Other',
      count: r.count,
      percentage: total > 0 ? Math.round(r.count / total * 1000) / 10 : 0,
      totalValue: 0,
      avgDuration: 0,
    }));
  }

  private async getPartnerPerformance(): Promise<PartnerPerformanceData[]> {
    const result = await db.select({
      organizationId: partnershipAgreements.organizationId,
      organizationName: organizations.name,
      totalAgreements: count(),
      minCreatedAt: sql<Date>`MIN(${partnershipAgreements.createdAt})`,
    })
      .from(partnershipAgreements)
      .leftJoin(organizations, eq(partnershipAgreements.organizationId, organizations.id))
      .groupBy(partnershipAgreements.organizationId, organizations.name)
      .orderBy(desc(count()))
      .offset(20);

    return result.map(r => ({
      organizationId: r.organizationId || 0,
      organizationName: r.organizationName || 'Unknown',
      totalAgreements: r.totalAgreements,
      activeAgreements: 0, // Would need subquery
      totalValue: 0,
      eventsSponsored: 0,
      partnerSince: r.minCreatedAt?.toISOString() || '',
      renewalRate: 0,
    }));
  }

  private async getFinancialMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<FinancialMetrics> {
    // Placeholder - implement based on your financial tracking
    return {
      totalActiveValue: 0,
      projectedRenewalValue: 0,
      avgAgreementValue: 0,
      valueByType: [],
      monthlyRevenue: [],
      yearOverYearGrowth: 0,
    };
  }

  private async getMonthlyTrends(
    startDate: Date,
    endDate: Date
  ): Promise<PartnershipTrend[]> {
    const newAgreements = await db.select({
      month: sql<string>`TO_CHAR(${partnershipAgreements.createdAt}, 'YYYY-MM')`,
      count: count(),
    })
      .from(partnershipAgreements)
      .where(and(
        gte(partnershipAgreements.createdAt, startDate),
        lte(partnershipAgreements.createdAt, endDate)
      ))
      .groupBy(sql`TO_CHAR(${partnershipAgreements.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${partnershipAgreements.createdAt}, 'YYYY-MM')`);

    return newAgreements.map(n => ({
      month: n.month,
      newAgreements: n.count,
      renewals: 0,
      expirations: 0,
      netChange: n.count,
    }));
  }

  private async getRecentActivity(): Promise<PartnershipActivity[]> {
    const recent = await db.select({
      id: partnershipAgreements.id,
      organizationName: organizations.name,
      agreementType: agreementTypes.name,
      createdAt: partnershipAgreements.createdAt,
      status: partnershipAgreements.status,
    })
      .from(partnershipAgreements)
      .leftJoin(organizations, eq(partnershipAgreements.organizationId, organizations.id))
      .leftJoin(agreementTypes, eq(partnershipAgreements.agreementTypeId, agreementTypes.id))
      .orderBy(desc(partnershipAgreements.createdAt))
      .offset(10);

    return recent.map(r => ({
      id: r.id,
      type: 'created' as const,
      organizationName: r.organizationName || 'Unknown',
      agreementType: r.agreementType || 'General',
      date: r.createdAt?.toISOString() || '',
      description: `New ${r.agreementType || 'agreement'} created with ${r.organizationName}`,
    }));
  }
}

export const partnershipsAnalyticsService = new PartnershipsAnalyticsService();
```

### Partnerships Analytics Routes (`server/routes/partnerships-analytics.routes.ts`)
```typescript
import { Router } from 'express';
import { partnershipsAnalyticsService } from '../services/partnerships-analytics.service';
import { isAuthenticated, isAdminOrSuperAdmin } from '../auth';

const router = Router();

// Get partnerships analytics dashboard
router.get('/api/analytics/partnerships', isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const data = await partnershipsAnalyticsService.getPartnershipsAnalytics(
      startDate ? new Date(String(startDate)) : undefined,
      endDate ? new Date(String(endDate)) : undefined
    );

    res.json(data);
  } catch (error) {
    console.error('Partnerships analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch partnerships analytics' });
  }
});

// Get renewal calendar
router.get('/api/analytics/partnerships/renewals', isAuthenticated, async (req, res) => {
  try {
    const data = await partnershipsAnalyticsService.getPartnershipsAnalytics();
    res.json(data.renewalCalendar);
  } catch (error) {
    console.error('Renewals error:', error);
    res.status(500).json({ error: 'Failed to fetch renewal calendar' });
  }
});

// Get pipeline data
router.get('/api/analytics/partnerships/pipeline', isAuthenticated, async (req, res) => {
  try {
    const data = await partnershipsAnalyticsService.getPartnershipsAnalytics();
    res.json(data.pipeline);
  } catch (error) {
    console.error('Pipeline error:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline data' });
  }
});

export default router;
```

### Frontend Partnerships Dashboard (`client/src/pages/analytics/PartnershipsDashboard.tsx`)
```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { KPICard } from '@/components/analytics/KPICard';
import { PartnershipPipeline } from '@/components/analytics/PartnershipPipeline';
import { RenewalCalendar } from '@/components/analytics/RenewalCalendar';
import { AgreementTypesChart } from '@/components/analytics/AgreementTypesChart';
import { PartnerPerformanceTable } from '@/components/analytics/PartnerPerformanceTable';
import { PartnershipTrendsChart } from '@/components/analytics/PartnershipTrendsChart';
import { ActivityTimeline } from '@/components/analytics/ActivityTimeline';
import { 
  Handshake, FileText, AlertTriangle, CalendarClock, 
  Building2, TrendingUp, DollarSign, RefreshCw 
} from 'lucide-react';
import type { PartnershipsAnalyticsData } from '@/types/analytics';

export default function PartnershipsDashboard() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  const { data, isLoading, error } = useQuery<PartnershipsAnalyticsData>({
    queryKey: ['analytics', 'partnerships', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });
      const response = await fetch(`/api/analytics/partnerships?${params}`);
      if (!response.ok) throw new Error('Failed to fetch partnerships analytics');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <PartnershipsDashboardSkeleton />;
  if (error) return <div className="text-destructive">Error loading dashboard</div>;
  if (!data) return null;

  const { summary } = data;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold">{t('analytics.partnershipsDashboard')}</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t('analytics.activeAgreements')}
          value={summary.activeAgreements}
          icon={FileText}
          color="green"
          subValue={`${summary.totalPartnerships} total`}
        />
        <KPICard
          title={t('analytics.partnerOrganizations')}
          value={summary.totalPartnerOrganizations}
          icon={Building2}
          color="blue"
        />
        <KPICard
          title={t('analytics.expiringThisMonth')}
          value={summary.expiringThisMonth}
          icon={AlertTriangle}
          color="orange"
        />
        <KPICard
          title={t('analytics.newThisMonth')}
          value={summary.newThisMonth}
          icon={TrendingUp}
          color="purple"
          trend={{ value: 15, direction: 'up' }}
        />
      </div>

      {/* Renewal Alert Bar */}
      {summary.expiringThisQuarter > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <CalendarClock className="h-8 w-8 text-orange-600" />
              <div className="flex-1">
                <p className="font-medium text-orange-800 dark:text-orange-200">
                  {summary.expiringThisQuarter} agreements expiring this quarter
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  Review and initiate renewal conversations
                </p>
              </div>
              <Badge variant="outline" className="border-orange-600 text-orange-600">
                Action Required
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">{t('analytics.pipeline')}</TabsTrigger>
          <TabsTrigger value="renewals">{t('analytics.renewals')}</TabsTrigger>
          <TabsTrigger value="partners">{t('analytics.partners')}</TabsTrigger>
          <TabsTrigger value="trends">{t('analytics.trends')}</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <PartnershipPipeline pipeline={data.pipeline} />
        </TabsContent>

        <TabsContent value="renewals" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  {t('analytics.upcomingRenewals')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RenewalCalendar renewals={data.renewalCalendar} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.agreementTypes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <AgreementTypesChart data={data.agreementTypeBreakdown} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="partners">
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.partnerPerformance')}</CardTitle>
            </CardHeader>
            <CardContent>
              <PartnerPerformanceTable data={data.partnerPerformance} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.partnershipTrends')}</CardTitle>
            </CardHeader>
            <CardContent>
              <PartnershipTrendsChart data={data.monthlyTrends} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.recentActivity')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline activities={data.recentActivity} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PartnershipsDashboardSkeleton() {
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

### Partnership Pipeline Component (`client/src/components/analytics/PartnershipPipeline.tsx`)
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Building2, Calendar } from 'lucide-react';

interface PipelineAgreement {
  id: number;
  organizationName: string;
  agreementType: string;
  startDate: string;
  endDate: string;
  value: number;
  status: string;
}

interface PipelineStage {
  count: number;
  value: number;
  agreements: PipelineAgreement[];
}

interface PipelineData {
  draft: PipelineStage;
  pending: PipelineStage;
  active: PipelineStage;
  expiring: PipelineStage;
  expired: PipelineStage;
  renewed: PipelineStage;
}

interface PartnershipPipelineProps {
  pipeline: PipelineData;
}

const stageConfig = {
  draft: { label: 'Draft', color: 'bg-gray-100 border-gray-300', badge: 'secondary' as const },
  pending: { label: 'Pending Approval', color: 'bg-yellow-50 border-yellow-300', badge: 'warning' as const },
  active: { label: 'Active', color: 'bg-green-50 border-green-300', badge: 'success' as const },
  expiring: { label: 'Expiring Soon', color: 'bg-orange-50 border-orange-300', badge: 'warning' as const },
  expired: { label: 'Expired', color: 'bg-red-50 border-red-300', badge: 'destructive' as const },
  renewed: { label: 'Renewed', color: 'bg-blue-50 border-blue-300', badge: 'default' as const },
};

export function PartnershipPipeline({ pipeline }: PartnershipPipelineProps) {
  const stages = ['draft', 'pending', 'active', 'expiring', 'expired'] as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {stages.map((stage) => {
        const config = stageConfig[stage];
        const stageData = pipeline[stage];

        return (
          <Card key={stage} className={cn('border-2', config.color)}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
                <Badge variant={config.badge}>{stageData.count}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {stageData.agreements.map((agreement) => (
                    <div
                      key={agreement.id}
                      className="p-3 bg-background rounded-lg border cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {agreement.organizationName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {agreement.agreementType}
                          </p>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(agreement.endDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {stageData.agreements.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No agreements
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

### Renewal Calendar Component (`client/src/components/analytics/RenewalCalendar.tsx`)
```tsx
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Calendar, AlertTriangle, Clock, Mail } from 'lucide-react';

interface RenewalItem {
  id: number;
  organizationName: string;
  agreementType: string;
  endDate: string;
  daysUntilExpiry: number;
  value: number;
  priority: 'high' | 'medium' | 'low';
}

interface RenewalCalendarProps {
  renewals: RenewalItem[];
}

const priorityConfig = {
  high: { color: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle },
  medium: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: Clock },
  low: { color: 'bg-green-100 text-green-800 border-green-200', icon: Calendar },
};

export function RenewalCalendar({ renewals }: RenewalCalendarProps) {
  return (
    <div className="space-y-3">
      {renewals.map((renewal) => {
        const config = priorityConfig[renewal.priority];
        const Icon = config.icon;

        return (
          <div
            key={renewal.id}
            className={cn(
              'flex items-center gap-4 p-4 rounded-lg border',
              renewal.priority === 'high' && 'border-red-200 bg-red-50/50',
              renewal.priority === 'medium' && 'border-orange-200 bg-orange-50/50',
              renewal.priority === 'low' && 'border-green-200 bg-green-50/50'
            )}
          >
            <div className={cn('p-2 rounded-full', config.color)}>
              <Icon className="h-4 w-4" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{renewal.organizationName}</p>
              <p className="text-sm text-muted-foreground">{renewal.agreementType}</p>
            </div>

            <div className="text-right">
              <Badge variant="outline" className={config.color}>
                {renewal.daysUntilExpiry} days
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(renewal.endDate).toLocaleDateString()}
              </p>
            </div>

            <Button size="sm" variant="outline">
              <Mail className="h-3.5 w-3.5 mr-1" />
              Contact
            </Button>
          </div>
        );
      })}

      {renewals.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No upcoming renewals in the next 90 days
        </div>
      )}
    </div>
  );
}
```

### Types (`client/src/types/analytics.ts` - additions)
```typescript
// Add to existing analytics types

export interface PartnershipsAnalyticsData {
  summary: PartnershipsSummary;
  pipeline: PipelineData;
  renewalCalendar: RenewalItem[];
  agreementTypeBreakdown: AgreementTypeData[];
  partnerPerformance: PartnerPerformanceData[];
  financialMetrics: FinancialMetrics;
  monthlyTrends: PartnershipTrend[];
  recentActivity: PartnershipActivity[];
}

export interface PartnershipsSummary {
  totalPartnerships: number;
  activeAgreements: number;
  pendingAgreements: number;
  expiringThisMonth: number;
  expiringThisQuarter: number;
  newThisMonth: number;
  totalPartnerOrganizations: number;
  avgAgreementDuration: number;
}

export interface PipelineData {
  draft: PipelineStage;
  pending: PipelineStage;
  active: PipelineStage;
  expiring: PipelineStage;
  expired: PipelineStage;
  renewed: PipelineStage;
}

export interface PipelineStage {
  count: number;
  value: number;
  agreements: PipelineAgreement[];
}

export interface PipelineAgreement {
  id: number;
  organizationName: string;
  agreementType: string;
  startDate: string;
  endDate: string;
  value: number;
  status: string;
}

export interface RenewalItem {
  id: number;
  organizationName: string;
  agreementType: string;
  endDate: string;
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
}

export interface PartnershipActivity {
  id: number;
  type: 'created' | 'renewed' | 'expired' | 'updated';
  organizationName: string;
  agreementType: string;
  date: string;
  description: string;
}
```

---

## Files to Create
- `server/services/partnerships-analytics.service.ts` - Partnerships data aggregation
- `server/routes/partnerships-analytics.routes.ts` - Partnerships analytics endpoints
- `client/src/pages/analytics/PartnershipsDashboard.tsx` - Partnerships dashboard page
- `client/src/components/analytics/PartnershipPipeline.tsx` - Kanban-style pipeline
- `client/src/components/analytics/RenewalCalendar.tsx` - Renewal tracking list
- `client/src/components/analytics/AgreementTypesChart.tsx` - Agreement type distribution
- `client/src/components/analytics/PartnerPerformanceTable.tsx` - Partner rankings
- `client/src/components/analytics/PartnershipTrendsChart.tsx` - Monthly trends
- `client/src/components/analytics/ActivityTimeline.tsx` - Recent activity feed

## Files to Modify
- `server/routes.ts` - Register partnerships analytics routes
- `client/src/App.tsx` - Add partnerships dashboard route
- `client/src/types/analytics.ts` - Add partnerships analytics types

## Acceptance Criteria
- [ ] Pipeline visualization shows agreements by status
- [ ] Drag-and-drop support for pipeline (optional)
- [ ] Renewal calendar with priority indicators
- [ ] Agreement type distribution pie chart
- [ ] Partner performance ranking table
- [ ] Monthly trends line chart
- [ ] Recent activity timeline
- [ ] Expiring agreements alert banner
- [ ] Date range filtering
- [ ] Export renewal report
- [ ] Email reminder integration

## Dependencies
- Executive Dashboard (09) - shared components
- Partnerships module - data models
