/**
 * Most Active Partners Table
 * 
 * Displays a ranked list of the most active partner organizations
 * with their activity breakdown and metrics.
 * 
 * @module components/analytics/MostActivePartnersTable
 */

import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Building2, Activity, FileText, MapPin } from 'lucide-react';
import type { MostActivePartner } from '@/types/analytics';
import { formatDistanceToNow } from 'date-fns';

interface MostActivePartnersTableProps {
  data: MostActivePartner[];
}

// Map activity types to colors
const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  joint_event: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  sponsorship: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  collaboration: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  training: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  exchange: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  meeting: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  other: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
};

export function MostActivePartnersTable({ data }: MostActivePartnersTableProps) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Building2 className="h-12 w-12 mb-4 opacity-50" />
        <p>{t('common.noData', 'No data available')}</p>
      </div>
    );
  }

  // Find max activities for progress bar scaling
  const maxActivities = Math.max(...data.map(p => p.totalActivities));

  return (
    <div className="relative overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>{t('partnershipsAnalytics.organization', 'Organization')}</TableHead>
            <TableHead>{t('partnershipsAnalytics.country', 'Country')}</TableHead>
            <TableHead className="text-center">{t('partnershipsAnalytics.activities', 'Activities')}</TableHead>
            <TableHead className="text-center">{t('partnershipsAnalytics.agreements', 'Agreements')}</TableHead>
            <TableHead>{t('partnershipsAnalytics.activityBreakdown', 'Activity Types')}</TableHead>
            <TableHead>{t('partnershipsAnalytics.lastActivity', 'Last Activity')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((partner, index) => (
            <TableRow key={partner.organizationId}>
              {/* Rank */}
              <TableCell className="font-bold text-muted-foreground">
                {index + 1}
              </TableCell>
              
              {/* Organization Name */}
              <TableCell>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{partner.organizationName}</span>
                </div>
              </TableCell>
              
              {/* Country */}
              <TableCell>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {partner.countryName || '-'}
                </div>
              </TableCell>
              
              {/* Activities with Progress */}
              <TableCell>
                <div className="flex flex-col items-center gap-1 min-w-[100px]">
                  <span className="font-semibold text-lg">{partner.totalActivities}</span>
                  <Progress 
                    value={(partner.totalActivities / maxActivities) * 100} 
                    className="h-2 w-full"
                  />
                </div>
              </TableCell>
              
              {/* Active Agreements */}
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{partner.activeAgreements}</span>
                </div>
              </TableCell>
              
              {/* Activity Type Breakdown */}
              <TableCell>
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {(partner.activityBreakdown || []).slice(0, 3).map((activity, i) => (
                    <Badge 
                      key={i}
                      variant="outline"
                      className={ACTIVITY_TYPE_COLORS[activity.type] || ACTIVITY_TYPE_COLORS.other}
                    >
                      {activity.count}x {activity.type.replace('_', ' ')}
                    </Badge>
                  ))}
                  {(partner.activityBreakdown?.length || 0) > 3 && (
                    <Badge variant="outline" className="bg-muted">
                      +{partner.activityBreakdown.length - 3}
                    </Badge>
                  )}
                </div>
              </TableCell>
              
              {/* Last Activity */}
              <TableCell className="text-sm text-muted-foreground">
                {partner.lastActivityDate ? (
                  formatDistanceToNow(new Date(partner.lastActivityDate), { addSuffix: true })
                ) : (
                  '-'
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
