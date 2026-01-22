/**
 * Renewal Calendar Component
 * 
 * Displays upcoming agreement renewals with priority indicators.
 * High priority = <=14 days, Medium = 15-30 days, Low = >30 days.
 * 
 * @module components/analytics/RenewalCalendar
 */

import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Calendar, AlertTriangle, Clock, Mail, Building2 } from 'lucide-react';
import type { RenewalItem } from '@/types/analytics';

interface RenewalCalendarProps {
  renewals: RenewalItem[];
}

const priorityConfig = {
  high: {
    color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200',
    bgColor: 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30',
    icon: AlertTriangle,
    labelKey: 'partnershipsAnalytics.priority.high',
    label: 'Urgent',
  },
  medium: {
    color: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-200',
    bgColor: 'border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/30',
    icon: Clock,
    labelKey: 'partnershipsAnalytics.priority.medium',
    label: 'Soon',
  },
  low: {
    color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200',
    bgColor: 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30',
    icon: Calendar,
    labelKey: 'partnershipsAnalytics.priority.low',
    label: 'Upcoming',
  },
};

export function RenewalCalendar({ renewals }: RenewalCalendarProps) {
  const { t } = useTranslation();

  if (renewals.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{t('partnershipsAnalytics.noUpcomingRenewals', 'No upcoming renewals in the next 90 days')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {renewals.map((renewal) => {
        const config = priorityConfig[renewal.priority];
        const Icon = config.icon;
        const formattedDate = new Date(renewal.expiryDate).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });

        return (
          <div
            key={renewal.id}
            className={cn(
              'flex items-center gap-4 p-4 rounded-lg border transition-colors hover:bg-muted/50',
              config.bgColor
            )}
          >
            {/* Priority Icon */}
            <div className={cn('p-2 rounded-full', config.color)}>
              <Icon className="h-4 w-4" />
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium truncate">{renewal.organizationName}</p>
              </div>
              <p className="text-sm text-muted-foreground">{renewal.agreementType}</p>
            </div>

            {/* Days Until Expiry */}
            <div className="text-right">
              <Badge variant="outline" className={config.color}>
                {renewal.daysUntilExpiry} {t('partnershipsAnalytics.days', 'days')}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                {formattedDate}
              </p>
            </div>

            {/* Contact Button */}
            <Button size="sm" variant="outline" className="hidden sm:flex">
              <Mail className="h-3.5 w-3.5 mr-1" />
              {t('partnershipsAnalytics.contact', 'Contact')}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
