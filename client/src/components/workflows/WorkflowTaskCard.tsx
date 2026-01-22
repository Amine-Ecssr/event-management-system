import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight,
  MessageSquare,
  User,
  Calendar,
  ArrowDown,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface WorkflowTask {
  id: number;
  taskId: number;
  title: string;
  titleAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'waiting';
  deadline?: string | null;
  departmentId: number;
  departmentName: string;
  departmentNameAr?: string | null;
  prerequisiteTaskId?: number | null;
  commentsCount?: number;
  isOwnDepartment?: boolean;
}

interface WorkflowTaskCardProps {
  task: WorkflowTask;
  isFirst?: boolean;
  isLast?: boolean;
  onViewTask?: (taskId: number) => void;
  onAddComment?: (taskId: number) => void;
  compact?: boolean;
}

const statusConfig = {
  waiting: {
    icon: Clock,
    color: 'text-orange-500',
    bgColor: 'bg-gradient-to-br from-orange-500/10 to-orange-500/5',
    borderColor: 'border-orange-200/50 dark:border-orange-800/50',
    badgeClass: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    label: 'workflows.waitingStatus',
    ringColor: 'ring-orange-500/20',
  },
  pending: {
    icon: AlertCircle,
    color: 'text-blue-500',
    bgColor: 'bg-gradient-to-br from-blue-500/10 to-blue-500/5',
    borderColor: 'border-blue-200/50 dark:border-blue-800/50',
    badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    label: 'tasks.pending',
    ringColor: 'ring-blue-500/20',
  },
  in_progress: {
    icon: Clock,
    color: 'text-yellow-500',
    bgColor: 'bg-gradient-to-br from-yellow-500/10 to-yellow-500/5',
    borderColor: 'border-yellow-200/50 dark:border-yellow-800/50',
    badgeClass: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    label: 'tasks.inProgress',
    ringColor: 'ring-yellow-500/20',
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-gradient-to-br from-green-500/10 to-green-500/5',
    borderColor: 'border-green-200/50 dark:border-green-800/50',
    badgeClass: 'bg-green-500/10 text-green-600 border-green-500/20',
    label: 'tasks.completed',
    ringColor: 'ring-green-500/20',
  },
  cancelled: {
    icon: AlertCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gradient-to-br from-gray-500/10 to-gray-500/5',
    borderColor: 'border-gray-200/50 dark:border-gray-800/50',
    badgeClass: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
    label: 'tasks.cancelled',
    ringColor: 'ring-gray-500/20',
  },
};

export function WorkflowTaskCard({
  task,
  isFirst = false,
  isLast = false,
  onViewTask,
  onAddComment,
}: WorkflowTaskCardProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  const config = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  
  const displayTitle = isArabic && task.titleAr ? task.titleAr : task.title;
  const displayDescription = isArabic && task.descriptionAr ? task.descriptionAr : task.description;
  const displayDepartment = isArabic && task.departmentNameAr ? task.departmentNameAr : task.departmentName;

  return (
    <div className="relative flex items-stretch gap-4">
      {/* Timeline connection line */}
      <div className="relative flex flex-col items-center">
        {/* Top line */}
        {!isFirst && (
          <div className="absolute -top-4 w-0.5 h-4 bg-gradient-to-b from-border to-transparent" />
        )}
        
        {/* Status indicator circle */}
        <div className={cn(
          "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all",
          config.bgColor,
          config.borderColor,
          task.status === 'completed' && "ring-2 ring-green-500/20 ring-offset-2 ring-offset-background",
        )}>
          <StatusIcon className={cn("h-5 w-5", config.color)} />
          {task.status === 'completed' && (
            <Sparkles className="absolute -top-1 -end-1 h-3 w-3 text-green-500" />
          )}
        </div>
        
        {/* Bottom line */}
        {!isLast && (
          <div className="flex-1 w-0.5 min-h-[24px] bg-gradient-to-b from-border via-border to-transparent mt-2">
            <ArrowDown className="w-3 h-3 text-muted-foreground/50 -ms-[5px] mt-2" />
          </div>
        )}
      </div>
      
      {/* Task card */}
      <Card className={cn(
        "flex-1 mb-4 transition-all duration-200 hover:shadow-md group",
        task.isOwnDepartment && "ring-2 ring-primary/20 ring-offset-1 ring-offset-background",
        task.status === 'waiting' && "opacity-80",
        task.status === 'completed' && "bg-gradient-to-r from-green-500/5 to-transparent"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Title and status */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h4 className="font-semibold text-base">{displayTitle}</h4>
                <Badge variant="outline" className={cn("text-xs font-medium", config.badgeClass)}>
                  {t(config.label)}
                </Badge>
              </div>
              
              {/* Description */}
              {displayDescription && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {displayDescription}
                </p>
              )}
              
              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-4 text-xs">
                {/* Department */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{displayDepartment}</span>
                  {!task.isOwnDepartment && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                      {t('workflows.viewOnlyAccess')}
                    </Badge>
                  )}
                </div>
                
                {/* Deadline */}
                {task.deadline && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {format(new Date(task.deadline), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                
                {/* Comments count */}
                {task.commentsCount !== undefined && task.commentsCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{task.commentsCount}</span>
                  </div>
                )}
              </div>
              
              {/* Waiting message */}
              {task.status === 'waiting' && (
                <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-orange-500/10 text-orange-600 text-xs">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{t('workflows.waitingDescription')}</span>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex flex-col gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
              {onViewTask && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onViewTask(task.taskId)}
                  className="h-8 px-3 hover:bg-primary/10 hover:text-primary"
                >
                  {t('common.view')}
                  <ChevronRight className="h-4 w-4 ms-1" />
                </Button>
              )}
              {onAddComment && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onAddComment(task.taskId)}
                  className="h-8 px-3 hover:bg-primary/10 hover:text-primary"
                >
                  <MessageSquare className="h-3.5 w-3.5 me-1.5" />
                  {t('workflows.addComment')}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
