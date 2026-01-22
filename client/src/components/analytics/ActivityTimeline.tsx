/**
 * Activity Timeline Component
 * 
 * Displays recent partnership activity in a vertical timeline.
 * 
 * @module components/analytics/ActivityTimeline
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { 
  PlusCircle, 
  RefreshCw, 
  XCircle, 
  Edit, 
  Building2,
  FileText 
} from 'lucide-react';
import type { PartnershipActivity } from '@/types/analytics';

interface ActivityTimelineProps {
  activities: PartnershipActivity[];
}

const activityConfig: Record<string, {
  icon: typeof PlusCircle;
  color: string;
  labelKey: string;
  label: string;
}> = {
  created: {
    icon: PlusCircle,
    color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-950',
    labelKey: 'partnershipsAnalytics.activity.created',
    label: 'Created',
  },
  renewed: {
    icon: RefreshCw,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950',
    labelKey: 'partnershipsAnalytics.activity.renewed',
    label: 'Renewed',
  },
  expired: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950',
    labelKey: 'partnershipsAnalytics.activity.expired',
    label: 'Expired',
  },
  updated: {
    icon: Edit,
    color: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950',
    labelKey: 'partnershipsAnalytics.activity.updated',
    label: 'Updated',
  },
  activity: {
    icon: FileText,
    color: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950',
    labelKey: 'partnershipsAnalytics.activity.activity',
    label: 'Activity',
  },
};

const defaultConfig = {
  icon: FileText,
  color: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-950',
  labelKey: 'partnershipsAnalytics.activity.unknown',
  label: 'Activity',
};

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const { t } = useTranslation();

  if (!activities || activities.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        {t('partnershipsAnalytics.noActivity', 'No recent activity')}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />

      <div className="space-y-4">
        {activities.map((activity) => {
          const config = activityConfig[activity.type] || defaultConfig;
          const Icon = config.icon;
          const formattedDate = activity.date
            ? new Date(activity.date).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '';

          return (
            <div key={activity.id} className="relative flex gap-4 pl-2">
              {/* Icon */}
              <div className={cn(
                'relative z-10 flex items-center justify-center w-6 h-6 rounded-full',
                config.color
              )}>
                <Icon className="h-3.5 w-3.5" />
              </div>

              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">
                    {t(config.labelKey, config.label)}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">{formattedDate}</span>
                </div>

                <div className="mt-1 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{activity.organizationName}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        {activity.agreementType}
                      </div>
                    </div>
                  </div>
                  {activity.description && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {activity.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
