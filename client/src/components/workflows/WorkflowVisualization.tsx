import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { 
  List, 
  GitBranch, 
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Network,
  Calendar,
} from 'lucide-react';
import { WorkflowTaskCard } from './WorkflowTaskCard';
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
  orderIndex: number;
  commentsCount?: number;
  isOwnDepartment?: boolean;
}

// Represents a dependency chain: prerequisite -> dependent task
interface DependencyChain {
  prerequisite: WorkflowTask;
  dependent: WorkflowTask;
}

interface Workflow {
  id: number;
  eventId: string;
  eventName?: string;
  eventNameAr?: string | null;
  eventStartDate?: string | null;
  createdAt: string;
  createdByUserId?: number | null;
  createdByUserName?: string;
  tasks: WorkflowTask[];
}

interface WorkflowVisualizationProps {
  workflow: Workflow;
  userDepartmentId?: number;
  onViewTask?: (taskId: number) => void;
  onAddComment?: (taskId: number) => void;
  defaultCollapsed?: boolean;
}

export function WorkflowVisualization({
  workflow,
  userDepartmentId,
  onViewTask,
  onAddComment,
  defaultCollapsed = false,
}: WorkflowVisualizationProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [viewMode, setViewMode] = useState<'list' | 'diagram'>('list');
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);
  
  // Sort tasks by order index
  const sortedTasks = [...workflow.tasks].sort((a, b) => a.orderIndex - b.orderIndex);
  
  // Enhance tasks with isOwnDepartment flag
  const enhancedTasks = sortedTasks.map(task => ({
    ...task,
    isOwnDepartment: userDepartmentId ? task.departmentId === userDepartmentId : false,
  }));

  // Build dependency chains - each chain is prerequisite -> dependent
  const dependencyChains = useMemo((): DependencyChain[] => {
    const chains: DependencyChain[] = [];
    const taskMap = new Map(enhancedTasks.map(t => [t.taskId, t]));
    
    for (const task of enhancedTasks) {
      if (task.prerequisiteTaskId) {
        const prereq = taskMap.get(task.prerequisiteTaskId);
        if (prereq) {
          chains.push({ prerequisite: prereq, dependent: task });
        }
      }
    }
    
    return chains;
  }, [enhancedTasks]);

  // Find root tasks (tasks with no prerequisites)
  const rootTasks = useMemo(() => {
    return enhancedTasks.filter(t => !t.prerequisiteTaskId);
  }, [enhancedTasks]);

  // Build full chains starting from root tasks
  const fullChains = useMemo((): WorkflowTask[][] => {
    const taskMap = new Map(enhancedTasks.map(t => [t.taskId, t]));
    // Build a map of taskId -> dependent tasks
    const dependentsMap = new Map<number, WorkflowTask[]>();
    for (const task of enhancedTasks) {
      if (task.prerequisiteTaskId) {
        const deps = dependentsMap.get(task.prerequisiteTaskId) || [];
        deps.push(task);
        dependentsMap.set(task.prerequisiteTaskId, deps);
      }
    }

    const chains: WorkflowTask[][] = [];

    // For each root task, build all possible chains to leaf nodes
    const buildChains = (current: WorkflowTask, currentChain: WorkflowTask[]) => {
      const newChain = [...currentChain, current];
      const dependents = dependentsMap.get(current.taskId) || [];
      
      if (dependents.length === 0) {
        // Leaf node - save the chain
        chains.push(newChain);
      } else {
        // Continue building for each dependent
        for (const dep of dependents) {
          buildChains(dep, newChain);
        }
      }
    };

    for (const root of rootTasks) {
      buildChains(root, []);
    }

    return chains;
  }, [enhancedTasks, rootTasks]);
  
  // Calculate progress
  const completedCount = workflow.tasks.filter(t => t.status === 'completed').length;
  const totalCount = workflow.tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  
  // Count by status
  const waitingCount = workflow.tasks.filter(t => t.status === 'waiting').length;
  const pendingCount = workflow.tasks.filter(t => t.status === 'pending').length;
  const inProgressCount = workflow.tasks.filter(t => t.status === 'in_progress').length;

  const eventTitle = isArabic && workflow.eventNameAr ? workflow.eventNameAr : workflow.eventName;

  // Format dates if available
  const eventDate = workflow.eventStartDate ? format(new Date(workflow.eventStartDate), 'MMM d, yyyy') : null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(
        "overflow-hidden transition-all duration-200 hover:shadow-md",
        isOpen && "ring-1 ring-primary/10"
      )}>
        <CardHeader className="pb-4">
          <div className="flex items-start gap-4">
            {/* Event Icon */}
            <div className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
              progress === 100 
                ? "bg-green-500/10 text-green-500" 
                : "bg-gradient-to-br from-primary/10 to-primary/5 text-primary"
            )}>
              {progress === 100 ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : (
                <GitBranch className="h-6 w-6" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <CollapsibleTrigger asChild>
                <button className="w-full text-start hover:opacity-80 transition-opacity group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg truncate">
                          {eventTitle || t('workflows.workflow')}
                        </CardTitle>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          #{workflow.id}
                        </span>
                        <span className="flex items-center gap-1">
                          <Network className="h-3 w-3" />
                          {totalCount} {t('workflows.tasks')}
                        </span>
                        {eventDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {eventDate}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Status Badge */}
                    <div className="shrink-0">
                      {completedCount === totalCount && totalCount > 0 ? (
                        <Badge className="gap-1.5 bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20">
                          <Sparkles className="h-3 w-3" />
                          {t('workflows.complete')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1.5 font-medium">
                          <div className="flex items-center gap-1">
                            <span className="text-green-500">{completedCount}</span>
                            <span className="text-muted-foreground">/</span>
                            <span>{totalCount}</span>
                          </div>
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              </CollapsibleTrigger>
            </div>
          </div>
          
          {/* Progress bar with animation */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('common.progress')}</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress 
              value={progress} 
              className={cn(
                "h-2 transition-all",
                progress === 100 && "[&>div]:bg-green-500"
              )} 
            />
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <Separator />
          <CardContent className="pt-4">
            {/* Status Summary Pills */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div className="flex flex-wrap gap-2">
                {completedCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="font-medium">{completedCount}</span>
                    <span className="text-green-600/70">{t('tasks.completed')}</span>
                  </div>
                )}
                {inProgressCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-600 text-sm">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="font-medium">{inProgressCount}</span>
                    <span className="text-yellow-600/70">{t('tasks.inProgress')}</span>
                  </div>
                )}
                {pendingCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 text-sm">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span className="font-medium">{pendingCount}</span>
                    <span className="text-blue-600/70">{t('tasks.pending')}</span>
                  </div>
                )}
                {waitingCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-600 text-sm">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="font-medium">{waitingCount}</span>
                    <span className="text-orange-600/70">{t('workflows.waitingTasks')}</span>
                  </div>
                )}
              </div>
              
              {/* View toggle */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "h-8 px-3 rounded-md",
                    viewMode === 'list' && "shadow-sm"
                  )}
                >
                  <List className="h-4 w-4 me-1.5" />
                  {t('workflows.listView')}
                </Button>
                <Button
                  variant={viewMode === 'diagram' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('diagram')}
                  className={cn(
                    "h-8 px-3 rounded-md",
                    viewMode === 'diagram' && "shadow-sm"
                  )}
                >
                  <GitBranch className="h-4 w-4 me-1.5" />
                  {t('workflows.diagramView')}
                </Button>
              </div>
            </div>

            {viewMode === 'list' ? (
          // List view - show each full chain vertically
          <div className="space-y-8">
            {fullChains.length > 0 ? (
              // Show each full chain
              fullChains.map((chain, chainIndex) => (
                <div key={`chain-${chainIndex}`} className="space-y-3">
                  {/* Chain header */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <GitBranch className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{t('workflows.dependencyChain')} {chainIndex + 1}</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {chain.length} {t('workflows.tasks')}
                      </Badge>
                    </div>
                    <Separator className="flex-1" />
                  </div>
                  
                  {/* Chain tasks - vertical list with connection lines */}
                  <div className="space-y-0 ps-4">
                    {chain.map((task, taskIndex) => (
                      <WorkflowTaskCard
                        key={task.id}
                        task={task}
                        isFirst={taskIndex === 0}
                        isLast={taskIndex === chain.length - 1}
                        onViewTask={onViewTask}
                        onAddComment={onAddComment}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              // Fallback: show all tasks if no chains (shouldn't happen for workflows)
              <div className="space-y-0">
                {enhancedTasks.map((task, index) => (
                  <WorkflowTaskCard
                    key={task.id}
                    task={task}
                    isFirst={index === 0}
                    isLast={index === enhancedTasks.length - 1}
                    onViewTask={onViewTask}
                    onAddComment={onAddComment}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          // Diagram view - show each full chain as a row
          <div className="space-y-6 overflow-x-auto pb-4">
            {fullChains.length > 0 ? (
              fullChains.map((chain, chainIndex) => (
                <div key={`diagram-chain-${chainIndex}`} className="space-y-2">
                  {/* Chain label */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">{t('workflows.dependencyChain')} {chainIndex + 1}</span>
                    <span>•</span>
                    <span>{chain.length} {t('workflows.tasks')}</span>
                  </div>
                  {/* Chain visualization */}
                  <div className="flex items-center gap-3 py-3 px-2 rounded-xl bg-muted/30">
                    {chain.map((task, taskIndex) => (
                      <div key={task.id} className="flex items-center shrink-0">
                        {/* Task node */}
                        <TaskNode task={task} isArabic={isArabic} />
                        
                        {/* Arrow to next */}
                        {taskIndex < chain.length - 1 && (
                          <div className="flex items-center px-2">
                            <div className="w-8 h-0.5 bg-border rounded-full" />
                            <ArrowRight className="h-4 w-4 text-muted-foreground -ms-1" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              // Fallback horizontal view
              <div className="flex items-center gap-3 py-4 px-2 rounded-xl bg-muted/30">
                {enhancedTasks.map((task, index) => (
                  <div key={task.id} className="flex items-center">
                    <TaskNode task={task} isArabic={isArabic} />
                    {index < enhancedTasks.length - 1 && (
                      <div className="flex items-center px-2">
                        <div className="w-8 h-0.5 bg-border rounded-full" />
                        <ArrowRight className="h-4 w-4 text-muted-foreground -ms-1" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Task node component for diagram view
function TaskNode({ task, isArabic }: { task: WorkflowTask; isArabic: boolean }) {
  const statusStyles = {
    completed: {
      border: "border-green-500/50",
      bg: "bg-gradient-to-br from-green-500/5 to-green-500/10",
      iconBg: "bg-green-500",
      icon: CheckCircle2,
    },
    in_progress: {
      border: "border-yellow-500/50",
      bg: "bg-gradient-to-br from-yellow-500/5 to-yellow-500/10",
      iconBg: "bg-yellow-500",
      icon: Clock,
    },
    pending: {
      border: "border-blue-500/50",
      bg: "bg-gradient-to-br from-blue-500/5 to-blue-500/10",
      iconBg: "bg-blue-500",
      icon: AlertCircle,
    },
    waiting: {
      border: "border-orange-500/50",
      bg: "bg-gradient-to-br from-orange-500/5 to-orange-500/10 opacity-80",
      iconBg: "bg-orange-500",
      icon: Clock,
    },
    cancelled: {
      border: "border-gray-400/50",
      bg: "bg-gradient-to-br from-gray-400/5 to-gray-400/10 opacity-60",
      iconBg: "bg-gray-400",
      icon: AlertCircle,
    },
  };

  const style = statusStyles[task.status] || statusStyles.pending;
  const StatusIcon = style.icon;

  return (
    <div 
      className={cn(
        "flex flex-col items-center p-4 rounded-xl border-2 min-w-[160px] max-w-[200px] transition-all hover:scale-[1.02] hover:shadow-lg",
        style.border,
        style.bg,
        task.isOwnDepartment && "ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
      )}
    >
      {/* Status icon */}
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center mb-3 text-white shadow-lg",
        style.iconBg
      )}>
        <StatusIcon className="h-5 w-5" />
      </div>
      
      {/* Task title */}
      <p className="text-sm font-medium text-center line-clamp-2 mb-1">
        {isArabic && task.titleAr ? task.titleAr : task.title}
      </p>
      
      {/* Department */}
      <p className="text-xs text-muted-foreground text-center line-clamp-1">
        {isArabic && task.departmentNameAr ? task.departmentNameAr : task.departmentName}
      </p>
    </div>
  );
}
