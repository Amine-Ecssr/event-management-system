import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, TrendingUp, BarChart3, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";

interface ContactStatistics {
  totalContacts: number;
  contactsWithEvents: number;
  contactsWithoutEvents: number;
  totalEventAttendances: number;
  averageAttendancePerContact: number;
  totalInvitations: number;
  totalRSVPs: number;
  totalRegistrations: number;
  overallConversionRate: number;
  overallRegistrationRate: number;
  topAttendees: Array<{
    contactId: number;
    nameEn: string;
    nameAr: string;
    organization: string | null;
    eventsAttended: number;
    speakerAppearances: number;
    invitationsReceived: number;
    rsvpConfirmed: number;
    registrations: number;
  }>;
}

export function ContactStatistics() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const { data: statistics, isLoading, error } = useQuery<ContactStatistics>({
    queryKey: ["/api/contacts/statistics"],
    retry: 1,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('engagement.errors.failedToLoadContacts')}
        </AlertDescription>
      </Alert>
    );
  }

  if (!statistics) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Total Contacts Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('engagement.contactStatistics.totalContacts')}</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{statistics.totalContacts}</div>
          <div className="text-xs text-muted-foreground mt-1">
            <span className="text-green-600">{statistics.contactsWithEvents}</span> {t('engagement.contactStatistics.withEvents')} •{" "}
            <span className="text-gray-500">{statistics.contactsWithoutEvents}</span> {t('engagement.contactStatistics.withoutEvents')}
          </div>
        </CardContent>
      </Card>

      {/* Average Attendance Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('engagement.contactStatistics.averageAttendance')}</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {statistics.averageAttendancePerContact.toFixed(1)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t('engagement.contactStatistics.eventsPerActiveContact')}
          </p>
        </CardContent>
      </Card>

      {/* Registration Rate Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('engagement.contactStatistics.registrationRate')}</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {statistics.overallRegistrationRate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t('engagement.contactStatistics.ofInvitees', { total: statistics.totalInvitations })}
          </p>
        </CardContent>
      </Card>

      {/* RSVP Conversion Rate Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('engagement.contactStatistics.rsvpConversion')}</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {statistics.overallConversionRate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {statistics.totalRSVPs} {t('engagement.contactStatistics.confirmedRsvps')}
          </p>
        </CardContent>
      </Card>

      {/* Top Attendees Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('engagement.contactStatistics.topAttendees')}</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {statistics.topAttendees.slice(0, 3).map((contact, idx) => (
              <div key={contact.contactId} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Badge variant="secondary" className="shrink-0">
                    {idx + 1}
                  </Badge>
                  <span className="font-medium truncate">{isRTL ? contact.nameAr || contact.nameEn : contact.nameEn}</span>
                </div>
                <Badge variant="outline" className="ms-2 shrink-0">
                  {contact.eventsAttended}
                </Badge>
              </div>
            ))}
            {statistics.topAttendees.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('engagement.contactStatistics.noAttendeesYet')}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
