import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
  Users, 
  UserCheck, 
  TrendingUp, 
  RefreshCw, 
  Download,
  Mail,
  Calendar,
  Award,
  Globe,
  BarChart3,
  Building2,
  User,
  AlertTriangle
} from 'lucide-react';
import { ContactStatistics } from '@/components/contacts/ContactStatistics';
import { OrganizationStatistics } from '@/components/contacts/OrganizationStatistics';
import { KPICard } from '@/components/analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState, DashboardCardSkeleton } from '@/components/ui/loading-state';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

// Color palette matching other dashboards
const COLORS = {
  primary: '#BC9F6D',
  secondary: '#8B7355',
  accent: '#D4AF37',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  muted: '#6b7280',
  chart: ['#BC9F6D', '#8B7355', '#D4AF37', '#C9A961', '#A0826D', '#B8956A', '#9CA3AF'],
};

interface EngagementData {
  conversionFunnel: {
    invited: number;
    emailsSent: number;
    registered: number;
    rsvped: number;
    attended: number;
    registrationRate: number;
    attendanceRate: number;
    overallConversion: number;
  };
  engagementByCategory: Array<{
    categoryId: number;
    categoryNameEn: string;
    categoryNameAr: string | null;
    totalEvents: number;
    totalInvitees: number;
    totalAttendees: number;
    attendanceRate: number;
  }>;
  engagementByMonth: Array<{
    month: number;
    year: number;
    totalEvents: number;
    totalInvitees: number;
    totalAttendees: number;
  }>;
  engagementTiers: {
    highly_engaged: number;
    moderately_engaged: number;
    low_engaged: number;
    not_engaged: number;
  };
  topPerformingEvents: Array<{
    eventId: string;
    eventName: string;
    eventNameAr: string | null;
    eventDate: string;
    categoryName: string | null;
    totalInvitees: number;
    totalAttendees: number;
    attendanceRate: number;
  }>;
  eventTypeEngagement: Array<{
    eventType: string | null;
    eventScope: string | null;
    totalEvents: number;
    totalInvitees: number;
    totalAttendees: number;
    attendanceRate: number;
  }>;
  geographicEngagement: Array<{
    countryCode: string;
    countryNameEn: string;
    countryNameAr: string | null;
    uniqueContacts: number;
    totalInvitations: number;
    totalAttendances: number;
  }>;
}



export default function EngagementDashboard() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Month names from i18n
  const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const getMonthName = (monthIndex: number) => t(`engagement.months.${monthKeys[monthIndex]}`);


  const { data, isLoading, error } = useQuery<EngagementData>({
    queryKey: ['/api/analytics/engagement'],
    staleTime: 60000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['/api/analytics/engagement'] });
    setIsRefreshing(false);
  };

  // Filter monthly data by year
  const monthlyData = data?.engagementByMonth
    ?.filter(m => m.year === selectedYear)
    ?.map(m => ({
      name: getMonthName(m.month - 1),
      events: m.totalEvents,
      invitees: m.totalInvitees,
      attendees: m.totalAttendees,
    })) || [];

  // Category chart data
  const categoryData = data?.engagementByCategory?.slice(0, 8).map(c => ({
    name: isRTL && c.categoryNameAr ? c.categoryNameAr : c.categoryNameEn,
    invitees: c.totalInvitees,
    attendees: c.totalAttendees,
    rate: c.attendanceRate,
  })) || [];

  // Engagement tiers for pie chart
  const tierData = data?.engagementTiers ? [
    { name: t('engagement.tiers.highlyEngaged', 'Highly Engaged (5+)'), value: data.engagementTiers.highly_engaged, color: COLORS.success },
    { name: t('engagement.tiers.moderatelyEngaged', 'Moderately Engaged (2-4)'), value: data.engagementTiers.moderately_engaged, color: COLORS.primary },
    { name: t('engagement.tiers.lowEngaged', 'Low Engaged (1)'), value: data.engagementTiers.low_engaged, color: COLORS.warning },
    { name: t('engagement.tiers.notEngaged', 'Not Engaged'), value: data.engagementTiers.not_engaged, color: COLORS.muted },
  ] : [];

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-6 space-y-6">
        <LoadingState fullPage text="Loading engagement data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-6 py-6">
        <Card className="border-destructive">
          <CardContent className="p-6 text-center">
            <p className="text-destructive">{t('common.error', 'Failed to load data')}</p>
            <Button onClick={handleRefresh} className="mt-4">
              <RefreshCw className="h-4 w-4 me-2" />
              {t('common.retry', 'Retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const funnel = data?.conversionFunnel;
  const totalContacts = tierData.reduce((sum, t) => sum + t.value, 0);

  return (
    <div className="container mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('engagement.title', 'Engagement Analytics')}
          </h1>
          <p className="text-muted-foreground">
            {t('engagement.description', 'Track invitation-to-attendance conversion and contact engagement patterns')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2027, 2026, 2025, 2024, 2023, 2022, 2021].map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Stats Row - 4 Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t('engagement.stats.totalInvitations', 'Total Invitations')}
          value={funnel?.invited || 0}
          subtitle={t('engagement.stats.emailsSentCount', '{{count}} emails sent', { count: funnel?.emailsSent || 0 })}
          icon={Mail}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBgColor="bg-blue-100 dark:bg-blue-900/30"
        />
        <KPICard
          title={t('engagement.stats.registrations', 'Registrations')}
          value={funnel?.registered || 0}
          subtitle={t('engagement.stats.conversionRate', '{{rate}}% conversion', { rate: (funnel?.registrationRate || 0).toFixed(1) })}
          icon={UserCheck}
          iconColor="text-purple-600 dark:text-purple-400"
          iconBgColor="bg-purple-100 dark:bg-purple-900/30"
        />
        <KPICard
          title={t('engagement.stats.attendance', 'Total Attendance')}
          value={funnel?.attended || 0}
          subtitle={t('engagement.stats.ofRegistered', '{{rate}}% of registered', { rate: (funnel?.attendanceRate || 0).toFixed(1) })}
          icon={Users}
          iconColor="text-green-600 dark:text-green-400"
          iconBgColor="bg-green-100 dark:bg-green-900/30"
        />
        <KPICard
          title={t('engagement.stats.activeContacts', 'Active Contacts')}
          value={totalContacts - (data?.engagementTiers?.not_engaged || 0)}
          subtitle={t('engagement.stats.ofTotal', 'of {{total}} total', { total: totalContacts })}
          icon={TrendingUp}
          iconColor="text-orange-600 dark:text-orange-400"
          iconBgColor="bg-orange-100 dark:bg-orange-900/30"
        />
      </div>

      {/* Low Engagement Alert Banner */}
      {data?.engagementTiers && data.engagementTiers.not_engaged > 50 && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-4 flex-wrap">
              <AlertTriangle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              <div className="flex-1">
                <p className="font-medium text-orange-800 dark:text-orange-200">
                  {data.engagementTiers.not_engaged} {t('engagement.alerts.contactsNotEngaged', 'contacts have not attended any events')}
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  {t('engagement.alerts.considerReEngagement', 'Consider targeted re-engagement campaigns')}
                </p>
              </div>
              <Badge variant="outline" className="border-orange-600 text-orange-600 dark:border-orange-400 dark:text-orange-400">
                {t('engagement.alerts.needsAttention', 'Needs Attention')}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {t('engagement.trends.title', 'Monthly Engagement Trends')}
            </CardTitle>
            <CardDescription>
              {selectedYear} {t('engagement.trends.subtitle', 'invitations vs attendance')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="inviteesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.info} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.info} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="attendeesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.success} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="invitees" 
                    stroke={COLORS.info} 
                    fill="url(#inviteesGradient)"
                    name={t('engagement.chart.invitees', 'Invitees')}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="attendees" 
                    stroke={COLORS.success} 
                    fill="url(#attendeesGradient)"
                    name={t('engagement.chart.attendees', 'Attendees')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                {t('common.noData', 'No data available for this period')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Engagement Distribution Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {t('engagement.distribution.title', 'Contact Engagement Distribution')}
            </CardTitle>
            <CardDescription>
              {t('engagement.distribution.subtitle', 'Breakdown by engagement level')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={tierData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {tierData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [value.toLocaleString(), 'Contacts']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {t('engagement.category.title', 'Engagement by Event Category')}
          </CardTitle>
          <CardDescription>
            {t('engagement.category.subtitle', 'Compare invitations and attendance across categories')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={categoryData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" className="text-xs" />
              <YAxis type="category" dataKey="name" width={150} className="text-xs" />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar 
                dataKey="invitees" 
                fill={COLORS.info} 
                name={t('engagement.chart.invitees', 'Invitees')}
                radius={[0, 4, 4, 0]}
              />
              <Bar 
                dataKey="attendees" 
                fill={COLORS.success} 
                name={t('engagement.chart.attendees', 'Attendees')}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Events - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            {t('engagement.topEvents.title', 'Top Performing Events')}
          </CardTitle>
          <CardDescription>
            {t('engagement.topEvents.subtitle', 'Ranked by attendance rate')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data?.topPerformingEvents?.slice(0, 6).map((event, idx) => (
              <div 
                key={event.eventId} 
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                    idx === 0 ? "bg-yellow-500 text-white" :
                    idx === 1 ? "bg-gray-400 text-white" :
                    idx === 2 ? "bg-amber-600 text-white" :
                    "bg-muted-foreground/20"
                  )}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate max-w-[200px]">
                      {isRTL && event.eventNameAr ? event.eventNameAr : event.eventName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('engagement.topEvents.attendedCount', '{{attended}} / {{invited}} attended', { attended: event.totalAttendees, invited: event.totalInvitees })}
                    </p>
                  </div>
                </div>
                <Badge variant={event.attendanceRate >= 30 ? 'default' : 'secondary'}>
                  {event.attendanceRate.toFixed(1)}%
                </Badge>
              </div>
            ))}
            {(!data?.topPerformingEvents || data.topPerformingEvents.length === 0) && (
              <p className="text-center text-muted-foreground py-8 col-span-full">
                {t('common.noData', 'No events data available')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Geographic Distribution - Full Width */}
      {data?.geographicEngagement && data.geographicEngagement.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              {t('engagement.geographic.title', 'Geographic Engagement')}
            </CardTitle>
            <CardDescription>
              {t('engagement.geographic.subtitle', 'Contact engagement by country')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.geographicEngagement.slice(0, 8).map((country) => (
                <div 
                  key={country.countryCode}
                  className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">
                      {isRTL && country.countryNameAr ? country.countryNameAr : country.countryNameEn}
                    </span>
                    <Badge variant="outline">{country.countryCode}</Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('engagement.geographicDistribution.contacts', 'Contacts')}:</span>
                      <span>{country.uniqueContacts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('engagement.geographicDistribution.attendances', 'Attendances')}:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {country.totalAttendances}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Organization & Contact Analytics Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t('engagement.detailedAnalytics.title', 'Detailed Engagement Analytics')}
          </CardTitle>
          <CardDescription>
            {t('engagement.detailedAnalytics.subtitle', 'Organization and individual-level conversion and attendance insights')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="organizations" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="organizations" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {t('engagement.tabs.organizations', 'Organizations')}
              </TabsTrigger>
              <TabsTrigger value="contacts" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {t('engagement.tabs.contacts', 'Individual Contacts')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="organizations" className="mt-0">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t('engagement.sections.organizationEngagementDesc', 'View which organizations have higher conversion and attendance rates, ranked by engagement metrics.')}
                </p>
                <OrganizationStatistics />
              </div>
            </TabsContent>

            <TabsContent value="contacts" className="mt-0">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t('engagement.sections.individualContactStatisticsDesc', 'Track individual contact engagement, including top attendees and personal conversion rates.')}
                </p>
                <ContactStatistics />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
