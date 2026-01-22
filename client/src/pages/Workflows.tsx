import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkflowVisualization } from '@/components/workflows/WorkflowVisualization';
import { TaskViewDialog } from '@/components/TaskViewDialog';
import { 
  GitBranch, 
  Search, 
  Filter, 
  Calendar,
  Workflow,
  Loader2,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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
}

interface Workflow {
  id: number;
  eventId: string;
  eventName?: string;
  eventNameAr?: string | null;
  eventStartDate?: string;
  eventEndDate?: string;
  createdAt: string;
  createdByUserId?: number | null;
  createdByUserName?: string;
  tasks: WorkflowTask[];
}

interface Event {
  id: string;
  name: string;
  nameAr?: string | null;
  startDate: string;
  endDate: string;
}

export default function Workflows() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isArabic = i18n.language === 'ar';
  
  // Department users should only see their own workflows
  const isDepartmentUser = user?.role === 'department' || user?.role === 'department_admin' || user?.role === 'stakeholder';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'my'>(isDepartmentUser ? 'my' : 'all');

  // Fetch all workflows
  const { data: allWorkflows = [], isLoading: isLoadingAll } = useQuery<Workflow[]>({
    queryKey: ['/api/workflows'],
    queryFn: () => apiRequest('GET', '/api/workflows'),
  });

  // Fetch user's department workflows (if user has a department)
  const { data: myWorkflows = [], isLoading: isLoadingMy } = useQuery<Workflow[]>({
    queryKey: ['/api/my-workflows'],
    queryFn: () => apiRequest('GET', '/api/my-workflows'),
    enabled: !!user?.departmentId,
  });

  // Fetch events for filter dropdown
  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    queryFn: () => apiRequest('GET', '/api/events'),
  });

  // Get unique events from workflows
  const workflowEvents = Array.from(
    new Map(
      (activeTab === 'my' ? myWorkflows : allWorkflows)
        .filter(w => w.eventId)
        .map(w => [w.eventId, { id: w.eventId, name: w.eventName || w.eventId, nameAr: w.eventNameAr }])
    ).values()
  );

  // Filter workflows
  const filteredWorkflows = (activeTab === 'my' ? myWorkflows : allWorkflows).filter(workflow => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesEvent = workflow.eventName?.toLowerCase().includes(searchLower) ||
                          workflow.eventNameAr?.toLowerCase().includes(searchLower);
      const matchesTasks = workflow.tasks.some(task => 
        task.title.toLowerCase().includes(searchLower) ||
        task.titleAr?.toLowerCase().includes(searchLower) ||
        task.departmentName.toLowerCase().includes(searchLower) ||
        task.departmentNameAr?.toLowerCase().includes(searchLower)
      );
      if (!matchesEvent && !matchesTasks) return false;
    }
    
    // Event filter
    if (eventFilter !== 'all' && workflow.eventId !== eventFilter) {
      return false;
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      const hasStatus = workflow.tasks.some(task => task.status === statusFilter);
      if (!hasStatus) return false;
    }
    
    return true;
  });

  const isLoading = activeTab === 'my' ? isLoadingMy : isLoadingAll;
  
  // State for task view dialog
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [focusComment, setFocusComment] = useState(false);

  const handleViewTask = (taskId: number) => {
    setFocusComment(false);
    setSelectedTaskId(taskId);
  };

  const handleAddComment = (taskId: number) => {
    setFocusComment(true);
    setSelectedTaskId(taskId);
  };

  const handleCloseDialog = (open: boolean) => {
    if (!open) {
      setSelectedTaskId(null);
      setFocusComment(false);
    }
  };

  // Calculate overall stats
  const totalWorkflows = filteredWorkflows.length;
  const totalTasks = filteredWorkflows.reduce((acc, w) => acc + w.tasks.length, 0);
  const completedTasks = filteredWorkflows.reduce((acc, w) => 
    acc + w.tasks.filter(t => t.status === 'completed').length, 0);
  const pendingTasks = filteredWorkflows.reduce((acc, w) => 
    acc + w.tasks.filter(t => t.status === 'pending').length, 0);
  const inProgressTasks = filteredWorkflows.reduce((acc, w) => 
    acc + w.tasks.filter(t => t.status === 'in_progress').length, 0);
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="min-h-screen">
      {/* Modern Hero Header */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-background via-background to-muted/20">
        <div className="absolute inset-0 bg-grid-white/[0.02] [mask-image:radial-gradient(white,transparent_85%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        
        <div className="relative px-6 py-8">
          <div className="flex flex-col gap-6">
            {/* Title Section */}
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
                    <Workflow className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                      {t('workflows.title')}
                      <Badge variant="secondary" className="font-normal text-xs">
                        {totalWorkflows} {t('common.active')}
                      </Badge>
                    </h1>
                    <p className="text-muted-foreground text-sm">
                      {t('workflows.subtitle')}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Quick Stats Cards */}
              <div className="hidden lg:flex items-center gap-3">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border shadow-sm">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold">{completedTasks}</p>
                    <p className="text-xs text-muted-foreground">{t('tasks.completed')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border shadow-sm">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Clock className="h-4 w-4 text-yellow-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold">{inProgressTasks}</p>
                    <p className="text-xs text-muted-foreground">{t('tasks.inProgress')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border shadow-sm">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <AlertCircle className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold">{pendingTasks}</p>
                    <p className="text-xs text-muted-foreground">{t('tasks.pending')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 shadow-sm">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold">{overallProgress}%</p>
                    <p className="text-xs text-muted-foreground">{t('common.progress')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Stats */}
            <div className="lg:hidden grid grid-cols-4 gap-2">
              <div className="text-center p-3 rounded-lg bg-card border">
                <p className="text-lg font-bold text-green-500">{completedTasks}</p>
                <p className="text-[10px] text-muted-foreground">{t('tasks.completed')}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-card border">
                <p className="text-lg font-bold text-yellow-500">{inProgressTasks}</p>
                <p className="text-[10px] text-muted-foreground">{t('tasks.inProgress')}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-card border">
                <p className="text-lg font-bold text-blue-500">{pendingTasks}</p>
                <p className="text-[10px] text-muted-foreground">{t('tasks.pending')}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-lg font-bold text-primary">{overallProgress}%</p>
                <p className="text-[10px] text-muted-foreground">{t('common.progress')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Content */}
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'my')}>
          <div className="flex flex-col gap-4 mb-6">
            {/* Tab Navigation and Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Only show tabs for non-department users */}
              {!isDepartmentUser && (
                <TabsList className="bg-muted/50 p-1">
                  <TabsTrigger value="all" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    {t('workflows.allWorkflows')}
                  </TabsTrigger>
                  {user?.departmentId && (
                    <TabsTrigger value="my" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      {t('workflows.myWorkflows')}
                    </TabsTrigger>
                  )}
                </TabsList>
              )}
              
              {/* Search and filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('common.search')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="ps-9 w-[200px] bg-background"
                  />
                </div>
              
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-[180px] bg-background">
                  <Calendar className="h-4 w-4 me-2 text-muted-foreground" />
                  <SelectValue placeholder={t('events.title')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')} {t('events.title')}</SelectItem>
                  {workflowEvents.map(event => (
                    <SelectItem key={event.id} value={event.id}>
                      {isArabic && event.nameAr ? event.nameAr : event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] bg-background">
                  <Filter className="h-4 w-4 me-2 text-muted-foreground" />
                  <SelectValue placeholder={t('common.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="waiting">{t('workflows.waitingStatus')}</SelectItem>
                  <SelectItem value="pending">{t('tasks.pending')}</SelectItem>
                  <SelectItem value="in_progress">{t('tasks.inProgress')}</SelectItem>
                  <SelectItem value="completed">{t('tasks.completed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          </div>

          <TabsContent value="all" className="mt-0">
            {renderWorkflowsList()}
          </TabsContent>
          
          <TabsContent value="my" className="mt-0">
            {renderWorkflowsList()}
          </TabsContent>
        </Tabs>
      </div>

      {/* Task View Dialog */}
      <TaskViewDialog
        taskId={selectedTaskId}
        open={selectedTaskId !== null}
        onOpenChange={handleCloseDialog}
        focusComment={focusComment}
      />
    </div>
  );

  function renderWorkflowsList() {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-[200px]" />
                    <Skeleton className="h-3 w-[150px]" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-full" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      );
    }

    if (filteredWorkflows.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-16">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {t('workflows.noWorkflows')}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {t('workflows.noWorkflowsDescription')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {filteredWorkflows.map((workflow, index) => (
          <div
            key={workflow.id}
            className="animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
          >
            <WorkflowVisualization
              workflow={workflow}
              userDepartmentId={user?.departmentId || undefined}
              onViewTask={handleViewTask}
              onAddComment={handleAddComment}
            />
          </div>
        ))}
      </div>
    );
  }
}
