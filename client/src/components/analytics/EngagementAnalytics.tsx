import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TrendingUp, Users, Calendar, Globe, Target, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface EngagementAnalytics {
  engagementByCategory: Array<{
    categoryId: number;
    categoryNameEn: string;
    categoryNameAr: string | null;
    totalEvents: number;
    totalInvitees: number;
    totalRegistrations: number;
    totalRSVPs: number;
    totalAttendees: number;
    totalSpeakers: number;
    registrationRate: number;
    rsvpRate: number;
    attendanceRate: number;
    conversionRate: number;
  }>;
  engagementByMonth: Array<{
    month: number;
    year: number;
    totalEvents: number;
    totalInvitees: number;
    totalRegistrations: number;
    totalRSVPs: number;
    totalAttendees: number;
  }>;
  conversionFunnel: {
    invited: number;
    emailsSent: number;
    registered: number;
    rsvped: number;
    attended: number;
    emailSentRate: number;
    registrationRate: number;
    rsvpRate: number;
    attendanceRate: number;
    overallConversion: number;
  };
  topPerformingEvents: Array<{
    eventId: string;
    eventName: string;
    eventNameAr: string | null;
    eventDate: string;
    categoryName: string | null;
    categoryNameAr: string | null;
    totalInvitees: number;
    totalAttendees: number;
    attendanceRate: number;
  }>;
  engagementTiers: {
    highly_engaged: number;
    moderately_engaged: number;
    low_engaged: number;
    not_engaged: number;
  };
  geographicEngagement: Array<{
    countryCode: string;
    countryNameEn: string;
    countryNameAr: string | null;
    uniqueContacts: number;
    totalInvitations: number;
    totalAttendances: number;
  }>;
  eventTypeEngagement: Array<{
    eventType: string;
    eventScope: string;
    totalEvents: number;
    totalInvitees: number;
    totalAttendees: number;
    averageAttendance: number;
    attendanceRate: number;
  }>;
}

const COLORS = ['#BC9F6D', '#8B7355', '#D4AF37', '#C9A961', '#A0826D', '#B8956A'];

export function EngagementAnalytics({ selectedYear }: { selectedYear?: number }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const MONTH_NAMES = [
    t('engagement.months.jan'),
    t('engagement.months.feb'),
    t('engagement.months.mar'),
    t('engagement.months.apr'),
    t('engagement.months.may'),
    t('engagement.months.jun'),
    t('engagement.months.jul'),
    t('engagement.months.aug'),
    t('engagement.months.sep'),
    t('engagement.months.oct'),
    t('engagement.months.nov'),
    t('engagement.months.dec'),
  ];

  const { data: analytics, isLoading, error } = useQuery<EngagementAnalytics>({
    queryKey: ["/api/analytics/engagement"],
    retry: 1,
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('engagement.errors.failedToLoadEngagement')}
        </AlertDescription>
      </Alert>
    );
  }

  if (!analytics) {
    return null;
  }

  // Prepare data for monthly trend chart
  // Filter monthly data by selected year when provided
  const monthlyData = analytics.engagementByMonth
    .filter(m => !selectedYear || m.year === selectedYear)
    .map(m => ({
    month: `${MONTH_NAMES[m.month - 1]} ${m.year}`,
    [t('engagement.chart.events')]: m.totalEvents,
    [t('engagement.chart.invitees')]: m.totalInvitees,
    [t('engagement.chart.attendees')]: m.totalAttendees,
  }));

  // Prepare funnel data
  const funnelData = [
    { name: t('engagement.conversionFunnel.emailSent'), value: analytics.conversionFunnel.emailsSent, percentage: 100 },
    { name: t('engagement.conversionFunnel.registered'), value: analytics.conversionFunnel.registered, percentage: analytics.conversionFunnel.registrationRate },
    // { name: 'RSVP', value: analytics.conversionFunnel.rsvped, percentage: analytics.conversionFunnel.rsvpRate },
    { name: t('engagement.conversionFunnel.attended'), value: analytics.conversionFunnel.attended, percentage: analytics.conversionFunnel.overallConversion },
  ];

  // Prepare engagement tiers pie chart
  const tierData = [
    { name: t('engagement.contactEngagementLevels.highlyEngaged'), value: analytics.engagementTiers.highly_engaged },
    { name: t('engagement.contactEngagementLevels.moderatelyEngaged'), value: analytics.engagementTiers.moderately_engaged },
    { name: t('engagement.contactEngagementLevels.lowEngaged'), value: analytics.engagementTiers.low_engaged },
    { name: t('engagement.contactEngagementLevels.notEngaged'), value: analytics.engagementTiers.not_engaged },
  ].filter(tier => tier.value > 0);

  return (
    <div className="space-y-6">
      {/* Conversion Funnel */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{t('engagement.conversionFunnel.title')}</CardTitle>
          </div>
          <CardDescription>{t('engagement.conversionFunnel.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {funnelData.map((stage, idx) => (
              <div key={stage.name} className="relative">
                <div className="text-center p-6 border rounded-lg bg-gradient-to-b from-muted/50 to-background">
                  <div className="text-sm font-medium text-muted-foreground mb-2">{stage.name}</div>
                  <div className="text-3xl font-bold mb-1">
                    {(stage.value ?? 0).toLocaleString()}
                  </div>
                  <Badge variant="secondary" className="mt-2">
                    {(stage.percentage ?? 0).toFixed(1)}%
                  </Badge>
                </div>
                {idx < funnelData.length - 1 && (
                  <div className={`hidden md:block absolute ${isRTL ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'} top-1/2 -translate-y-1/2 z-10`}>
                    <div className="text-2xl text-muted-foreground">{isRTL ? '←' : '→'}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Engagement by Category */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{t('engagement.engagementByCategory.title')}</CardTitle>
          </div>
          <CardDescription>{t('engagement.engagementByCategory.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={analytics.engagementByCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={isRTL ? "categoryNameAr" : "categoryNameEn"} angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalInvitees" name={t('engagement.chart.invitees')} fill="#8B7355" />
              <Bar dataKey="totalAttendees" name={t('engagement.chart.attendees')} fill="#D4AF37" />
            </BarChart>
          </ResponsiveContainer>
          
          {/* Category Performance Table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-start py-2 px-2">{t('engagement.engagementByCategory.tableHeaders.category')}</th>
                  <th className="text-end py-2 px-2">{t('engagement.engagementByCategory.tableHeaders.events')}</th>
                  <th className="text-end py-2 px-2">{t('engagement.engagementByCategory.tableHeaders.registrationRate')}</th>
                  <th className="text-end py-2 px-2">{t('engagement.engagementByCategory.tableHeaders.rsvpRate')}</th>
                  <th className="text-end py-2 px-2">{t('engagement.engagementByCategory.tableHeaders.attendanceRate')}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.engagementByCategory.map(cat => (
                  <tr key={cat.categoryId} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-medium">{isRTL ? cat.categoryNameAr || cat.categoryNameEn : cat.categoryNameEn}</td>
                    <td className="text-end py-2 px-2">{cat.totalEvents}</td>
                    <td className="text-end py-2 px-2">
                      <Badge variant="outline">{(cat.registrationRate ?? 0).toFixed(1)}%</Badge>
                    </td>
                    <td className="text-end py-2 px-2">
                      <Badge variant="outline">{(cat.rsvpRate ?? 0).toFixed(1)}%</Badge>
                    </td>
                    <td className="text-end py-2 px-2">
                      <Badge variant="outline">{(cat.attendanceRate ?? 0).toFixed(1)}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Seasonal Trends */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{t('engagement.seasonalTrends.title')}</CardTitle>
          </div>
          <CardDescription>{t('engagement.seasonalTrends.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={t('engagement.chart.events')} stroke="#BC9F6D" strokeWidth={2} />
              <Line type="monotone" dataKey={t('engagement.chart.invitees')} stroke="#8B7355" strokeWidth={2} />
              <Line type="monotone" dataKey={t('engagement.chart.attendees')} stroke="#D4AF37" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Engagement Tiers */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle>{t('engagement.contactEngagementLevels.title')}</CardTitle>
            </div>
            <CardDescription>{t('engagement.contactEngagementLevels.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={tierData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {tierData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Geographic Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <CardTitle>{t('engagement.geographicDistribution.title')}</CardTitle>
            </div>
            <CardDescription>{t('engagement.geographicDistribution.description')}</CardDescription>
          </CardHeader>
          <CardContent>
              {analytics.geographicEngagement && analytics.geographicEngagement.length > 0 ? (
                <div className="space-y-3">
                  {analytics.geographicEngagement.slice(0, 8).map((country, idx) => (
                    <div key={country.countryCode} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Badge variant="outline" className="shrink-0">#{idx + 1}</Badge>
                        <span className="font-medium truncate">{isRTL ? country.countryNameAr || country.countryNameEn : country.countryNameEn}</span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-sm text-muted-foreground">
                          {country.uniqueContacts} {t('engagement.geographicDistribution.contacts')}
                        </div>
                        <Badge>{country.totalAttendances} {t('engagement.geographicDistribution.attendances')}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  {t('engagement.geographicDistribution.empty', 'No geographic engagement data available')}
                </div>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Events */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{t('engagement.topPerformingEvents.title')}</CardTitle>
          </div>
          <CardDescription>{t('engagement.topPerformingEvents.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-start py-2 px-2">{t('engagement.topPerformingEvents.tableHeaders.event')}</th>
                  <th className="text-start py-2 px-2">{t('engagement.topPerformingEvents.tableHeaders.category')}</th>
                  <th className="text-start py-2 px-2">{t('engagement.topPerformingEvents.tableHeaders.date')}</th>
                  <th className="text-end py-2 px-2">{t('engagement.topPerformingEvents.tableHeaders.invitees')}</th>
                  <th className="text-end py-2 px-2">{t('engagement.topPerformingEvents.tableHeaders.attendees')}</th>
                  <th className="text-end py-2 px-2">{t('engagement.topPerformingEvents.tableHeaders.rate')}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topPerformingEvents.map((event, idx) => (
                  <tr key={event.eventId} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="shrink-0">#{idx + 1}</Badge>
                        <span className="font-medium">{isRTL ? event.eventNameAr || event.eventName : event.eventName}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2">{isRTL ? (event.categoryNameAr || event.categoryName || '-') : (event.categoryName || '-')}</td>
                    <td className="py-2 px-2">{new Date(event.eventDate).toLocaleDateString(isRTL ? 'ar-AE' : 'en-US')}</td>
                    <td className="text-end py-2 px-2">{event.totalInvitees}</td>
                    <td className="text-end py-2 px-2">{event.totalAttendees}</td>
                    <td className="text-end py-2 px-2">
                      <Badge variant="outline">{(event.attendanceRate ?? 0).toFixed(1)}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Event Type Performance */}
      <Card>
        <CardHeader>
          <CardTitle>{t('engagement.eventTypePerformance.title')}</CardTitle>
          <CardDescription>{t('engagement.eventTypePerformance.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-start py-2 px-2">{t('engagement.eventTypePerformance.tableHeaders.type')}</th>
                  <th className="text-start py-2 px-2">{t('engagement.eventTypePerformance.tableHeaders.scope')}</th>
                  <th className="text-end py-2 px-2">{t('engagement.eventTypePerformance.tableHeaders.events')}</th>
                  <th className="text-end py-2 px-2">{t('engagement.eventTypePerformance.tableHeaders.invitees')}</th>
                  <th className="text-end py-2 px-2">{t('engagement.eventTypePerformance.tableHeaders.attendees')}</th>
                  <th className="text-end py-2 px-2">{t('engagement.eventTypePerformance.tableHeaders.attendanceRate')}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.eventTypeEngagement.map((type, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2">{t(`events.eventTypes.${type.eventType}`)}</td>
                    <td className="py-2 px-2">{t(`events.eventScopes.${type.eventScope}`)}</td>
                    <td className="text-end py-2 px-2">{type.totalEvents}</td>
                    <td className="text-end py-2 px-2">{type.totalInvitees}</td>
                    <td className="text-end py-2 px-2">{type.totalAttendees}</td>
                    <td className="text-end py-2 px-2">
                      <Badge variant="outline">{(type.attendanceRate ?? 0).toFixed(1)}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
