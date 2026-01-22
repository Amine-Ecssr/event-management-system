/**
 * Contacts Analytics Dashboard Page
 * 
 * Displays comprehensive analytics for contacts database, speakers, leads, and interactions.
 * 
 * @module pages/analytics/ContactsDashboard
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  KPICard,
  ContactGrowthChart,
  SpeakerUtilizationChart,
  LeadFunnelChart,
  InteractionsChart,
  DataQualityCard,
  ContactsDistributionChart,
} from '@/components/analytics';
import {
  Users,
  UserPlus,
  TrendingUp,
  Target,
  RefreshCw,
  AlertCircle,
  Mic,
  Building2,
} from 'lucide-react';
import type { ContactsAnalyticsData } from '@/types/analytics';

export default function ContactsDashboard() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());

  // Generate year options (current year and 2 previous years)
  const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - i);

  // Fetch contacts analytics data
  const {
    data: analyticsData,
    isLoading,
    error,
    refetch,
  } = useQuery<ContactsAnalyticsData>({
    queryKey: ['/api/analytics/contacts', selectedYear],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/contacts?year=${selectedYear}`);
      if (!response.ok) throw new Error('Failed to fetch contacts analytics');
      return response.json();
    },
  });

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('common.error', 'Error')}</AlertTitle>
          <AlertDescription>
            {t('contactsAnalytics.error', 'Error loading contacts analytics dashboard')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const summary = analyticsData?.summary || {
    totalContacts: 0,
    eligibleSpeakers: 0,
    contactsWithEmail: 0,
    contactsWithPhone: 0,
    contactsWithOrganization: 0,
    dataCompletenessScore: 0,
    newContactsThisMonth: 0,
    growthRate: 0,
  };

  const leadsSummary = analyticsData?.leadsSummary || {
    totalLeads: 0,
    activeLeads: 0,
    inProgressLeads: 0,
    inactiveLeads: 0,
    leadsByType: [],
    conversionRate: 0,
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('contactsAnalytics.title', 'Contacts Analytics')}
          </h1>
          <p className="text-muted-foreground">
            {t('contactsAnalytics.subtitle', 'Insights into your contacts database, speakers, and lead management')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder={t('contactsAnalytics.selectYear', 'Year')} />
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
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title={t('contactsAnalytics.totalContacts', 'Total Contacts')}
            value={summary.totalContacts}
            icon={Users}
            iconColor="text-blue-600"
            iconBgColor="bg-blue-100 dark:bg-blue-900/30"
            subtitle={`+${summary.newContactsThisMonth} ${t('contactsAnalytics.thisMonth', 'this month')}`}
          />
          <KPICard
            title={t('contactsAnalytics.eligibleSpeakers', 'Eligible Speakers')}
            value={summary.eligibleSpeakers}
            icon={Mic}
            iconColor="text-amber-600"
            iconBgColor="bg-amber-100 dark:bg-amber-900/30"
            subtitle={`${summary.totalContacts > 0 ? ((summary.eligibleSpeakers / summary.totalContacts) * 100).toFixed(1) : 0}% ${t('contactsAnalytics.ofContacts', 'of contacts')}`}
          />
          <KPICard
            title={t('contactsAnalytics.totalLeads', 'Total Leads')}
            value={leadsSummary.totalLeads}
            icon={Target}
            iconColor="text-purple-600"
            iconBgColor="bg-purple-100 dark:bg-purple-900/30"
            subtitle={`${leadsSummary.activeLeads} ${t('contactsAnalytics.active', 'active')}`}
          />
          <KPICard
            title={t('contactsAnalytics.dataQuality', 'Data Quality')}
            value={`${summary.dataCompletenessScore}%`}
            icon={Building2}
            iconColor="text-green-600"
            iconBgColor="bg-green-100 dark:bg-green-900/30"
            subtitle={t('contactsAnalytics.completeness', 'completeness score')}
          />
        </div>
      )}

      {/* Growth Alert */}
      {summary.growthRate !== 0 && (
        <Alert variant={summary.growthRate > 0 ? 'default' : 'destructive'}>
          <TrendingUp className="h-4 w-4" />
          <AlertTitle>
            {summary.growthRate > 0
              ? t('contactsAnalytics.growthPositive', 'Contact Growth')
              : t('contactsAnalytics.growthNegative', 'Contact Decline')}
          </AlertTitle>
          <AlertDescription>
            {summary.growthRate > 0
              ? t('contactsAnalytics.growthPositiveDesc', 'Your contact database grew {{rate}}% compared to last month', { rate: Math.abs(summary.growthRate) })
              : t('contactsAnalytics.growthNegativeDesc', 'Contact additions decreased by {{rate}}% compared to last month', { rate: Math.abs(summary.growthRate) })}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            {t('contactsAnalytics.overview', 'Overview')}
          </TabsTrigger>
          <TabsTrigger value="speakers">
            {t('contactsAnalytics.speakers', 'Speakers')}
          </TabsTrigger>
          <TabsTrigger value="leads">
            {t('contactsAnalytics.leads', 'Leads')}
          </TabsTrigger>
          <TabsTrigger value="interactions">
            {t('contactsAnalytics.interactions', 'Interactions')}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-[300px] w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <ContactGrowthChart data={analyticsData?.growthTrends || []} />
                </div>
                <DataQualityCard data={summary} />
              </div>
              <ContactsDistributionChart
                byOrganization={analyticsData?.byOrganization || []}
                byCountry={analyticsData?.byCountry || []}
                byPosition={analyticsData?.byPosition || []}
              />
            </>
          )}
        </TabsContent>

        {/* Speakers Tab */}
        <TabsContent value="speakers" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-[400px] w-full" />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <SpeakerUtilizationChart
                data={analyticsData?.speakerMetrics || {
                  totalSpeakers: 0,
                  averageEventsPerSpeaker: 0,
                  mostActiveSpeakers: [],
                  speakerUtilizationRate: 0,
                }}
              />
              <Card>
                <CardHeader>
                  <CardTitle>{t('contactsAnalytics.speakerStats', 'Speaker Statistics')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <p className="text-3xl font-bold text-primary">
                        {analyticsData?.speakerMetrics?.totalSpeakers || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('contactsAnalytics.totalEligible', 'Total Eligible')}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <p className="text-3xl font-bold text-green-600">
                        {analyticsData?.speakerMetrics?.speakerUtilizationRate || 0}%
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('contactsAnalytics.utilized', 'Utilized')}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg text-center col-span-2">
                      <p className="text-3xl font-bold text-blue-600">
                        {analyticsData?.speakerMetrics?.averageEventsPerSpeaker || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('contactsAnalytics.avgEventsPerSpeaker', 'Avg Events per Speaker')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Leads Tab */}
        <TabsContent value="leads" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-[400px] w-full" />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <LeadFunnelChart data={leadsSummary} />
              <Card>
                <CardHeader>
                  <CardTitle>{t('contactsAnalytics.leadStats', 'Lead Statistics')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
                      <p className="text-3xl font-bold text-green-600">
                        {leadsSummary.activeLeads}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('contactsAnalytics.leadStatus.active', 'Active')}
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center">
                      <p className="text-3xl font-bold text-blue-600">
                        {leadsSummary.inProgressLeads}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('contactsAnalytics.leadStatus.inProgress', 'In Progress')}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-950/30 rounded-lg text-center">
                      <p className="text-3xl font-bold text-gray-600">
                        {leadsSummary.inactiveLeads}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('contactsAnalytics.leadStatus.inactive', 'Inactive')}
                      </p>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-center">
                      <p className="text-3xl font-bold text-purple-600">
                        {leadsSummary.conversionRate}%
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('contactsAnalytics.conversionRate', 'Conversion Rate')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Interactions Tab */}
        <TabsContent value="interactions" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-[400px] w-full" />
              </CardContent>
            </Card>
          ) : (
            <InteractionsChart
              data={analyticsData?.interactionMetrics || {
                totalInteractions: 0,
                interactionsByType: [],
                monthlyTrends: [],
                averageInteractionsPerLead: 0,
              }}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
