/**
 * Overdue Tasks List Component
 * 
 * Displays a list of overdue tasks with priority indicators.
 * 
 * @module components/analytics/OverdueTasksList
 */

import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  AlertTriangle, 
  Calendar, 
  Building2, 
  FileText,
  Briefcase,
  Handshake,
  ExternalLink
} from 'lucide-react';
import type { OverdueTaskItem } from '@/types/analytics';
import { Link } from 'wouter';

interface OverdueTasksListProps {
  tasks: OverdueTaskItem[];
}

const priorityConfig = {
  high: {
    color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200',
    label: 'High',
    labelKey: 'tasksAnalytics.priority.high',
  },
  medium: {
    color: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-200',
    label: 'Medium',
    labelKey: 'tasksAnalytics.priority.medium',
  },
  low: {
    color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200',
    label: 'Low',
    labelKey: 'tasksAnalytics.priority.low',
  },
};

const entityIcons = {
  event: FileText,
  lead: Briefcase,
  partnership: Handshake,
};

export function OverdueTasksList({ tasks }: OverdueTasksListProps) {
  const { t } = useTranslation();

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{t('tasksAnalytics.noOverdueTasks', 'No overdue tasks')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const config = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.medium;
        const EntityIcon = entityIcons[task.entityType] || FileText;
        const formattedDate = task.dueDate
          ? new Date(task.dueDate).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '—';

        return (
          <div
            key={task.id}
            className={cn(
              'flex items-center gap-4 p-4 rounded-lg border transition-colors hover:bg-muted/50',
              task.priority === 'high' && 'border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20',
              task.priority === 'medium' && 'border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-950/20',
              task.priority === 'low' && 'border-border'
            )}
          >
            {/* Priority Badge */}
            <Badge variant="outline" className={config.color}>
              {t(config.labelKey, config.label)}
            </Badge>

            {/* Entity Type Icon */}
            <div className="p-2 rounded-full bg-muted">
              <EntityIcon className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Task Info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{task.title}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {task.departmentName && (
                  <>
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{task.departmentName}</span>
                  </>
                )}
              </div>
            </div>

            {/* Days Overdue */}
            <div className="text-right">
              <Badge 
                variant="destructive"
                className={cn(
                  task.daysOverdue > 7 && 'animate-pulse'
                )}
              >
                {task.daysOverdue} {t('tasksAnalytics.daysOverdue', 'days overdue')}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                <Calendar className="h-3 w-3 inline mr-1" />
                {formattedDate}
              </p>
            </div>

            {/* View Link */}
            <Link href="/admin/tasks">
              <Button size="sm" variant="ghost">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
