import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/PageHeader';
import { ContactStatistics } from '@/components/contacts/ContactStatistics';
import { OrganizationStatistics } from '@/components/contacts/OrganizationStatistics';
import { EngagementAnalytics } from '@/components/analytics/EngagementAnalytics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Users, TrendingUp, RefreshCw, Calendar as CalendarIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { KPICard } from '@/components/analytics/KPICard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Engagement() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Fetch analytics once here to power KPI row (query is shared/deduped with child component)
  const { data: analytics, refetch } = useQuery<any>({
    queryKey: ['/api/analytics/engagement'],
  });

  return (
    <div className="container mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {t('engagement.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('engagement.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder={t('common.year', 'Year')} />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => currentYear - i).map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} aria-label={t('common.refresh', 'Refresh')}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title={t('engagement.kpis.totalInvitees', 'Total Invitees')}
            value={analytics.conversionFunnel?.invited ?? 0}
            icon={Users}
            iconColor="text-blue-600 dark:text-blue-400"
            iconBgColor="bg-blue-100 dark:bg-blue-900/30"
          />
          <KPICard
            title={t('engagement.kpis.totalRegistered', 'Total Registered')}
            value={analytics.conversionFunnel?.registered ?? 0}
            icon={CalendarIcon}
            iconColor="text-teal-600 dark:text-teal-400"
            iconBgColor="bg-teal-100 dark:bg-teal-900/30"
            subtitle={`${(analytics.conversionFunnel?.registrationRate ?? 0).toFixed(1)}% ${t('engagement.kpis.registrationRate', 'reg. rate')}`}
          />
          <KPICard
            title={t('engagement.kpis.totalAttendees', 'Total Attendees')}
            value={analytics.conversionFunnel?.attended ?? 0}
            icon={TrendingUp}
            iconColor="text-green-600 dark:text-green-400"
            iconBgColor="bg-green-100 dark:bg-green-900/30"
            subtitle={`${(analytics.conversionFunnel?.attendanceRate ?? 0).toFixed(1)}% ${t('engagement.kpis.attendanceRate', 'att. rate')}`}
          />
          <KPICard
            title={t('engagement.kpis.avgAttendanceRate', 'Avg Attendance Rate')}
            value={`${(analytics.conversionFunnel?.overallConversion ?? 0).toFixed(1)}%`}
            icon={BarChart3}
            iconColor="text-purple-600 dark:text-purple-400"
            iconBgColor="bg-purple-100 dark:bg-purple-900/30"
          />
        </div>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 me-2" />
            {t('engagement.tabs.overview')}
          </TabsTrigger>
          <TabsTrigger value="contacts">
            <Users className="h-4 w-4 me-2" />
            {t('engagement.tabs.contacts')}
          </TabsTrigger>
          <TabsTrigger value="organizations">
            <TrendingUp className="h-4 w-4 me-2" />
            {t('engagement.tabs.organizations')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <EngagementAnalytics selectedYear={selectedYear} />
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6 mt-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">{t('engagement.sections.individualContactStatistics')}</h3>
            <ContactStatistics />
          </div>
        </TabsContent>

        <TabsContent value="organizations" className="space-y-6 mt-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">{t('engagement.sections.organizationEngagement')}</h3>
            <OrganizationStatistics />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
