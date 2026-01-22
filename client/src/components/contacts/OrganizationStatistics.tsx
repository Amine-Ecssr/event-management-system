import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, TrendingUp, Users, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface OrganizationStatisticsData {
  totalOrganizations: number;
  organizationsWithAttendance: number;
  organizationStatistics: Array<{
    organizationId: number;
    organizationNameEn: string;
    organizationNameAr: string | null;
    totalContacts: number;
    activeContacts: number;
    totalEventAttendances: number;
    uniqueEventsAttended: number;
    averageAttendancePerContact: number;
    attendanceRate: number;
    speakerAppearances: number;
    topAttendee: {
      contactId: number;
      nameEn: string;
      nameAr: string | null;
      eventsAttended: number;
    } | null;
  }>;
  overallAverageAttendanceRate: number;
}

export function OrganizationStatistics() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const { data: statistics, isLoading, error } = useQuery<OrganizationStatisticsData>({
    queryKey: ["/api/contacts/organizations/statistics"],
    retry: 1,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('engagement.errors.failedToLoadOrganizations')}
        </AlertDescription>
      </Alert>
    );
  }

  if (!statistics) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('engagement.organizationStatistics.totalOrganizations')}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalOrganizations}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {statistics.organizationsWithAttendance} {t('engagement.organizationStatistics.withEventAttendance')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('engagement.organizationStatistics.avgAttendanceRate')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics.overallAverageAttendanceRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('engagement.organizationStatistics.acrossAllOrganizations')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('engagement.organizationStatistics.topOrganization')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statistics.organizationStatistics.length > 0 ? (
              <>
                <div className="text-lg font-bold truncate">
                  {isRTL 
                    ? statistics.organizationStatistics[0].organizationNameAr || statistics.organizationStatistics[0].organizationNameEn 
                    : statistics.organizationStatistics[0].organizationNameEn}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {statistics.organizationStatistics[0].totalEventAttendances} {t('engagement.organizationStatistics.totalAttendances')}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Organization Rankings Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('engagement.organizationStatistics.engagementRankings')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">{t('engagement.organizationStatistics.tableHeaders.rank')}</TableHead>
                <TableHead>{t('engagement.organizationStatistics.tableHeaders.organization')}</TableHead>
                <TableHead className="text-end">{t('engagement.organizationStatistics.tableHeaders.contacts')}</TableHead>
                <TableHead className="text-end">{t('engagement.organizationStatistics.tableHeaders.active')}</TableHead>
                <TableHead className="text-end">{t('engagement.organizationStatistics.tableHeaders.attendances')}</TableHead>
                <TableHead className="text-end">{t('engagement.organizationStatistics.tableHeaders.avgPerContact')}</TableHead>
                <TableHead className="text-end">{t('engagement.organizationStatistics.tableHeaders.rate')}</TableHead>
                <TableHead>{t('engagement.organizationStatistics.tableHeaders.topAttendee')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statistics.organizationStatistics.map((org, index) => (
                <TableRow key={org.organizationId}>
                  <TableCell>
                    <Badge variant={index < 3 ? "default" : "secondary"}>
                      {index + 1}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {isRTL ? org.organizationNameAr || org.organizationNameEn : org.organizationNameEn}
                  </TableCell>
                  <TableCell className="text-end">{org.totalContacts}</TableCell>
                  <TableCell className="text-end">
                    <Badge variant="outline">{org.activeContacts}</Badge>
                  </TableCell>
                  <TableCell className="text-end">{org.totalEventAttendances}</TableCell>
                  <TableCell className="text-end">
                    {org.averageAttendancePerContact.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-end">
                    <Badge 
                      variant={org.attendanceRate >= 70 ? "default" : "secondary"}
                    >
                      {org.attendanceRate.toFixed(0)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {org.topAttendee ? (
                      <div className="text-sm">
                        <div className="font-medium">
                          {isRTL && org.topAttendee.nameAr ? org.topAttendee.nameAr : org.topAttendee.nameEn}
                        </div>
                        <div className="text-muted-foreground">
                          {org.topAttendee.eventsAttended} {t('engagement.organizationStatistics.events')}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {statistics.organizationStatistics.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {t('engagement.organizationStatistics.noStatisticsAvailable')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
