/**
 * Partnerships Analytics Dashboard Page
 * 
 * Comprehensive dashboard for partnership analytics including:
 * - KPI summary cards (agreements, activities, partners)
 * - Partners by country distribution
 * - Most active partners ranking
 * - Activity type breakdown
 * - Agreement type distribution
 * - Monthly trends
 * - Renewal alerts
 * 
 * @module pages/analytics/PartnershipsDashboard
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  RenewalCalendar,
  AgreementTypesChart,
  PartnershipTrendsChart,
  ActivityTimeline,
  PartnersByCountryChart,
  ActivityTypeChart,
  MostActivePartnersTable,
} from '@/components/analytics';
import { 
  FileText, 
  Building2, 
  AlertTriangle, 
  TrendingUp, 
  CalendarClock,
  RefreshCw,
  Globe,
  Activity,
  BarChart3,
  Clock,
  Users,
  Zap,
} from 'lucide-react';
import type { PartnershipsAnalyticsData } from '@/types/analytics';

export default function PartnershipsDashboard() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Calculate date range based on selected year
  const dateRange = {
    from: new Date(selectedYear, 0, 1),
    to: selectedYear === currentYear ? new Date() : new Date(selectedYear, 11, 31),
  };

  const { data, isLoading, error, refetch } = useQuery<PartnershipsAnalyticsData>({
    queryKey: ['analytics', 'partnerships', selectedYear],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });
      const response = await fetch(`/api/analytics/partnerships?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch partnerships analytics');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) return <PartnershipsDashboardSkeleton />;
  
  if (error) {
    return (
      <div className="container mx-auto px-6 py-6">
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive font-medium">
              {t('partnershipsAnalytics.error', 'Error loading dashboard')}
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

  return (
    <div className="container mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {t('partnershipsAnalytics.title', 'Partnerships Analytics')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('partnershipsAnalytics.subtitle', 'Track and analyze partnership performance')}
          </p>
        </div>
        <div className="flex items-center gap-3">
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

      {/* KPI Cards - 2 rows */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t('partnershipsAnalytics.activeAgreements', 'Active Agreements')}
          value={summary.activeAgreements}
          icon={FileText}
          iconColor="text-green-600 dark:text-green-400"
          iconBgColor="bg-green-100 dark:bg-green-900/30"
          subtitle={`${summary.totalPartnerships} ${t('partnershipsAnalytics.total', 'total')}`}
        />
        <KPICard
          title={t('partnershipsAnalytics.partnerOrganizations', 'Partner Organizations')}
          value={summary.totalPartnerOrganizations}
          icon={Building2}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBgColor="bg-blue-100 dark:bg-blue-900/30"
        />
        <KPICard
          title={t('partnershipsAnalytics.totalActivities', 'Total Activities')}
          value={summary.totalActivities || 0}
          icon={Activity}
          iconColor="text-purple-600 dark:text-purple-400"
          iconBgColor="bg-purple-100 dark:bg-purple-900/30"
          subtitle={`${summary.activitiesThisMonth || 0} ${t('partnershipsAnalytics.thisMonth', 'this month')}`}
        />
        <KPICard
          title={t('partnershipsAnalytics.newThisMonth', 'New This Month')}
          value={summary.newThisMonth}
          icon={TrendingUp}
          iconColor="text-cyan-600 dark:text-cyan-400"
          iconBgColor="bg-cyan-100 dark:bg-cyan-900/30"
        />
      </div>

      {/* Renewal Alert Banner */}
      {summary.expiringThisQuarter > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-4 flex-wrap">
              <CalendarClock className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              <div className="flex-1">
                <p className="font-medium text-orange-800 dark:text-orange-200">
                  {summary.expiringThisQuarter} {t('partnershipsAnalytics.agreementsExpiringQuarter', 'agreements expiring this quarter')}
                  {summary.expiringThisMonth > 0 && (
                    <span className="text-orange-600 dark:text-orange-400 ml-2">
                      ({summary.expiringThisMonth} {t('partnershipsAnalytics.thisMonth', 'this month')})
                    </span>
                  )}
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  {t('partnershipsAnalytics.reviewRenewals', 'Review and initiate renewal conversations')}
                </p>
              </div>
              <Badge variant="outline" className="border-orange-600 text-orange-600 dark:border-orange-400 dark:text-orange-400">
                {t('partnershipsAnalytics.actionRequired', 'Action Required')}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="insights" className="gap-2">
            <BarChart3 className="h-4 w-4 hidden sm:inline" />
            {t('partnershipsAnalytics.insights', 'Insights')}
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Zap className="h-4 w-4 hidden sm:inline" />
            {t('partnershipsAnalytics.activityTab', 'Activity')}
          </TabsTrigger>
          <TabsTrigger value="renewals" className="gap-2">
            <Clock className="h-4 w-4 hidden sm:inline" />
            {t('partnershipsAnalytics.renewals', 'Renewals')}
          </TabsTrigger>
        </TabsList>

        {/* Insights Tab - Geographic & Performance Analysis */}
        <TabsContent value="insights" className="space-y-6">
          {/* Partners by Country & Activity Types */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  {t('partnershipsAnalytics.partnersByCountry', 'Partners by Country')}
                </CardTitle>
                <CardDescription>
                  {t('partnershipsAnalytics.partnersByCountryDesc', 'Geographic distribution of partner organizations')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PartnersByCountryChart data={data.partnersByCountry || []} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  {t('partnershipsAnalytics.activityTypesTitle', 'Activity Types')}
                </CardTitle>
                <CardDescription>
                  {t('partnershipsAnalytics.activityTypesDesc', 'Breakdown of partnership activities by type')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityTypeChart data={data.activityTypeBreakdown || []} />
              </CardContent>
            </Card>
          </div>

          {/* Most Active Partners */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('partnershipsAnalytics.mostActivePartners', 'Most Active Partners')}
              </CardTitle>
              <CardDescription>
                {t('partnershipsAnalytics.mostActivePartnersDesc', 'Partners ranked by activity level')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MostActivePartnersTable data={data.mostActivePartners || []} />
            </CardContent>
          </Card>

          {/* Agreement Type Distribution */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  {t('partnershipsAnalytics.agreementTypes', 'Agreement Types')}
                </CardTitle>
                <CardDescription>
                  {t('partnershipsAnalytics.agreementTypesDesc', 'Distribution of agreements by type')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AgreementTypesChart data={data.agreementTypeBreakdown} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {t('partnershipsAnalytics.partnershipTrends', 'Partnership Trends')}
                </CardTitle>
                <CardDescription>
                  {t('partnershipsAnalytics.trendsDesc', 'Monthly new agreements, expirations, and activities')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PartnershipTrendsChart data={data.monthlyTrends} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activity Tab - Recent Activity & Timeline */}
        <TabsContent value="activity" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {t('partnershipsAnalytics.recentActivity', 'Recent Activity')}
                </CardTitle>
                <CardDescription>
                  {t('partnershipsAnalytics.recentActivityDesc', 'Latest partnership events and updates')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityTimeline activities={data.recentActivity} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Renewals Tab */}
        <TabsContent value="renewals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                {t('partnershipsAnalytics.upcomingRenewals', 'Upcoming Renewals')}
              </CardTitle>
              <CardDescription>
                {t('partnershipsAnalytics.renewalsDesc', 'Agreements expiring soon that need attention')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RenewalCalendar renewals={data.renewalCalendar} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Loading skeleton for partnerships dashboard
 */
function PartnershipsDashboardSkeleton() {
  return (
    <div className="container mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-48 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>

      {/* Tabs */}
      <Skeleton className="h-12 w-96" />

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[400px]" />
        <Skeleton className="h-[400px]" />
      </div>
      
      <Skeleton className="h-[300px]" />
    </div>
  );
}
