import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { LoadingState, ListLoadingSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  User as UserIcon,
  Users,
  FileText,
  ChevronDown,
  Eye,
  Paperclip,
  Download,
  X,
  Image,
  Archive,
  File,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { InteractionTimeline, InteractionDialog, type BaseInteraction } from '@/components/interactions';

interface Lead {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  type: 'lead' | 'partner' | 'customer';
  status: 'active' | 'in_progress' | 'inactive';
  createdAt: string;
}

// LeadInteraction extends BaseInteraction with leadId
type LeadInteraction = BaseInteraction & {
  leadId: number;
};

interface LeadTask {
  id: number;
  leadId: number;
  title: string;
  titleAr?: string | null;
  description: string | null;
  descriptionAr?: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: string | null;
  departmentId: number | null;
  department?: { id: number; name: string; nameAr: string | null } | null;
  commentCount?: number;
  createdAt: string;
}

interface TaskComment {
  id: number;
  contactTaskId: number;
  authorUserId: number;
  body: string;
  createdAt: string;
  authorUsername?: string;
  attachments?: Array<{
    id: number;
    commentId: number;
    fileName: string;
    storedFileName: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
    uploadedByUserId: number | null;
  }>;
}

interface Department {
  id: number;
  name: string;
  nameAr: string | null;
}

const TASK_STATUSES = ['pending', 'in_progress', 'completed'] as const;
const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

export default function LeadDetail() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/admin/leads/:id');
  const leadId = params?.id ? parseInt(params.id) : null;

  // Redirect if not admin or superadmin
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    setLocation('/');
    return null;
  }

  const [activeTab, setActiveTab] = useState('interactions');
  
  // Interaction dialog state
  const [isInteractionDialogOpen, setIsInteractionDialogOpen] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<BaseInteraction | null>(null);
  const [deletingInteraction, setDeletingInteraction] = useState<BaseInteraction | null>(null);

  // Task dialog state
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<LeadTask | null>(null);
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    status: 'pending' as typeof TASK_STATUSES[number],
    priority: 'medium' as typeof TASK_PRIORITIES[number],
    dueDate: '',
    departmentId: null as number | null,
    notificationEmails: [] as string[],
  });
  const [emailInput, setEmailInput] = useState('');
  const [deletingTask, setDeletingTask] = useState<LeadTask | null>(null);
  
  // Task detail view state
  const [viewingTask, setViewingTask] = useState<LeadTask | null>(null);
  const [taskCommentText, setTaskCommentText] = useState('');
  const [selectedTaskFile, setSelectedTaskFile] = useState<File | null>(null);
  const taskFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch lead
  const { data: lead, isLoading: leadLoading, error: leadError } = useQuery<Lead>({
    queryKey: ['/api/leads', leadId],
    queryFn: async () => {
      return apiRequest('GET', `/api/leads/${leadId}`);
    },
    enabled: !!leadId,
  });

  // Fetch interactions
  const { data: interactions = [], isLoading: interactionsLoading } = useQuery<LeadInteraction[]>({
    queryKey: [`/api/leads/${leadId}/interactions`],
    queryFn: async () => {
      return apiRequest('GET', `/api/leads/${leadId}/interactions`);
    },
    enabled: !!leadId,
  });

  // Fetch tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<LeadTask[]>({
    queryKey: [`/api/leads/${leadId}/tasks`],
    queryFn: async () => {
      return apiRequest('GET', `/api/leads/${leadId}/tasks`);
    },
    enabled: !!leadId,
  });

  // Fetch departments for task assignment
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['/api/stakeholders'],
    queryFn: async () => {
      return apiRequest('GET', '/api/stakeholders');
    },
  });

  // Interaction delete mutation
  const deleteInteractionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/lead-interactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}/interactions`] });
      toast({ title: t('leads.messages.interactionDeleted') });
      setDeletingInteraction(null);
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  // Task mutations
  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof taskFormData) => {
      return apiRequest('POST', `/api/leads/${leadId}/tasks`, {
        ...data,
        description: data.description || null,
        dueDate: data.dueDate || null,
        departmentId: data.departmentId || null,
        notificationEmails: data.notificationEmails || [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}/tasks`] });
      toast({ title: t('leads.messages.taskCreated') });
      closeTaskDialog();
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof taskFormData }) => {
      return apiRequest('PUT', `/api/lead-tasks/${id}`, {
        ...data,
        description: data.description || null,
        dueDate: data.dueDate || null,
        departmentId: data.departmentId || null,
        notificationEmails: data.notificationEmails || [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}/tasks`] });
      toast({ title: t('leads.messages.taskUpdated') });
      closeTaskDialog();
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PUT', `/api/lead-tasks/${id}/complete`);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}/tasks`] });
      toast({ 
        title: data.status === 'completed' 
          ? t('leads.messages.taskCompleted') 
          : t('leads.messages.taskReopened') 
      });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/lead-tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}/tasks`] });
      toast({ title: t('leads.messages.taskDeleted') });
      setDeletingTask(null);
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  // Task comments query
  const { data: taskComments = [], isLoading: isLoadingTaskComments } = useQuery<TaskComment[]>({
    queryKey: ['/api/lead-tasks', viewingTask?.id, 'comments'],
    queryFn: async () => {
      if (!viewingTask?.id) return [];
      const response = await apiRequest('GET', `/api/lead-tasks/${viewingTask.id}/comments`);
      return response;
    },
    enabled: !!viewingTask?.id,
  });

  // Task comment mutations
  const createTaskCommentMutation = useMutation({
    mutationFn: async ({ taskId, content, file }: { taskId: number; content: string; file?: File }) => {
      const formData = new FormData();
      formData.append('content', content);
      if (file) {
        formData.append('attachment', file);
      }
      const response = await fetch(`/api/lead-tasks/${taskId}/comments`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add comment');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-tasks', viewingTask?.id, 'comments'] });
      queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}/tasks`] });
      setTaskCommentText('');
      setSelectedTaskFile(null);
      if (taskFileInputRef.current) {
        taskFileInputRef.current.value = '';
      }
      toast({ title: t('tasks.messages.commentAdded') });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const deleteTaskCommentMutation = useMutation({
    mutationFn: async ({ taskId, commentId }: { taskId: number; commentId: number }) => {
      await apiRequest('DELETE', `/api/lead-tasks/${taskId}/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-tasks', viewingTask?.id, 'comments'] });
      queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}/tasks`] });
      toast({ title: t('tasks.messages.commentDeleted') });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  // Helper functions for task comments
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return <Archive className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const handleTaskFileDownload = async (attachmentId: number, fileName: string) => {
    try {
      const response = await fetch(`/api/lead-task-comment-attachments/${attachmentId}/download`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({ title: t('tasks.messages.downloadFailed'), variant: 'destructive' });
    }
  };

  const handleSubmitTaskComment = () => {
    if (!viewingTask?.id || (!taskCommentText.trim() && !selectedTaskFile)) return;
    createTaskCommentMutation.mutate({
      taskId: viewingTask.id,
      content: taskCommentText.trim(),
      file: selectedTaskFile || undefined,
    });
  };

  // Dialog helpers
  const openInteractionDialog = (interaction?: BaseInteraction) => {
    setEditingInteraction(interaction || null);
    setIsInteractionDialogOpen(true);
  };

  const openTaskDialog = (task?: LeadTask) => {
    if (task) {
      setEditingTask(task);
      setTaskFormData({
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
        departmentId: task.departmentId,
        notificationEmails: (task as any).notificationEmails || [],
      });
    } else {
      setEditingTask(null);
      setTaskFormData({
        title: '',
        description: '',
        status: 'pending',
        priority: 'medium',
        dueDate: '',
        departmentId: null,
        notificationEmails: [],
      });
    }
    setEmailInput('');
    setIsTaskDialogOpen(true);
  };

  const closeTaskDialog = () => {
    setIsTaskDialogOpen(false);
    setEditingTask(null);
    setTaskFormData({
      title: '',
      description: '',
      status: 'pending',
      priority: 'medium',
      dueDate: '',
      departmentId: null,
      notificationEmails: [],
    });
    setEmailInput('');
  };

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, data: taskFormData });
    } else {
      createTaskMutation.mutate(taskFormData);
    }
  };

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'phone_call': return <Phone className="h-4 w-4" />;
      case 'meeting': return <Users className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'lead': return 'default';
      case 'partner': return 'secondary';
      case 'customer': return 'outline';
      default: return 'default';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'in_progress': return 'secondary';
      case 'inactive': return 'outline';
      default: return 'default';
    }
  };

  if (leadLoading) {
    return (
      <div className="container mx-auto p-6">
        <LoadingState fullPage text="Loading lead details..." />
      </div>
    );
  }

  if (leadError || !lead) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" onClick={() => setLocation('/admin/leads')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back')}
        </Button>
        <div className="text-center text-red-500">
          {t('common.error')}: {leadError ? (leadError as Error).message : t('leads.noLeadsFound')}
        </div>
      </div>
    );
  }

  const pendingTasks = tasks.filter(t => t.status !== 'completed').length;

  return (
    <div className="container mx-auto p-6">
      <Button variant="ghost" onClick={() => setLocation('/admin/leads')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('common.back')}
      </Button>

      <PageHeader
        title={lead.name}
        subtitle={t('leads.overview.contactDetails')}
        icon={UserIcon}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t('leads.overview.summary')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Badge variant={getTypeBadgeVariant(lead.type)}>
                {t(`leads.types.${lead.type}`)}
              </Badge>
              <Badge variant={getStatusBadgeVariant(lead.status)}>
                {t(`leads.statuses.${lead.status}`)}
              </Badge>
            </div>

            {lead.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{lead.email}</span>
              </div>
            )}

            {lead.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{lead.phone}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{format(parseISO(lead.createdAt), 'PPP')}</span>
            </div>

            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('leads.overview.totalInteractions')}</span>
                <span className="font-medium">{interactions.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('leads.overview.pendingTasks')}</span>
                <span className="font-medium">{pendingTasks}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Interactions and Tasks */}
        <Card className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <CardHeader className="pb-0">
              <TabsList>
                <TabsTrigger value="interactions">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {t('leads.tabs.interactions')} ({interactions.length})
                </TabsTrigger>
                <TabsTrigger value="tasks">
                  <FileText className="h-4 w-4 mr-2" />
                  {t('leads.tabs.tasks')} ({tasks.length})
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-4">
              {/* Interactions Tab */}
              <TabsContent value="interactions" className="m-0">
                <InteractionTimeline
                  interactions={interactions}
                  entityType="lead"
                  entityId={leadId!}
                  isLoading={interactionsLoading}
                  onAddInteraction={() => openInteractionDialog()}
                  onEditInteraction={(interaction) => openInteractionDialog(interaction)}
                  onDeleteInteraction={(interaction) => setDeletingInteraction(interaction)}
                />
              </TabsContent>

              {/* Tasks Tab */}
              <TabsContent value="tasks" className="m-0">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">{t('leads.tasks.title')}</h3>
                  <Button size="sm" onClick={() => openTaskDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('leads.tasks.addTask')}
                  </Button>
                </div>

                {tasksLoading ? (
                  <ListLoadingSkeleton count={3} />
                ) : tasks.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title={t('leads.tasks.noTasks')}
                  />
                ) : (
                  <div className="space-y-2">
                    {tasks.map(task => (
                      <Card key={task.id} className={cn("p-4", task.status === 'completed' && "opacity-60")}>
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={task.status === 'completed'}
                            onCheckedChange={() => toggleTaskMutation.mutate(task.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "font-medium",
                                task.status === 'completed' && "line-through"
                              )}>
                                {task.title}
                              </span>
                              <Badge variant={getPriorityBadgeVariant(task.priority)}>
                                {t(`leads.tasks.priorities.${task.priority}`)}
                              </Badge>
                              <Badge variant="outline">
                                {t(`leads.tasks.taskStatuses.${task.status}`)}
                              </Badge>
                            </div>
                            {task.description && (
                              task.description.length > 100 ? (
                                <Collapsible className="mt-1">
                                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {task.description.slice(0, 100)}...
                                  </div>
                                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                                    <span>{t('common.showMore')}</span>
                                    <ChevronDown className="h-3 w-3" />
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                                      {task.description.slice(100)}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              ) : (
                                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{task.description}</p>
                              )
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {task.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(parseISO(task.dueDate), 'PP')}
                                </span>
                              )}
                              {task.department && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {i18n.language === 'ar' && task.department.nameAr ? task.department.nameAr : task.department.name}
                                </span>
                              )}
                              {task.commentCount !== undefined && task.commentCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {task.commentCount} {t('tasks.commentsCount')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setViewingTask(task)}
                              title={t('tasks.viewDetails')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openTaskDialog(task)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => setDeletingTask(task)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      {/* Interaction Dialog */}
      <InteractionDialog
        open={isInteractionDialogOpen}
        onOpenChange={(open) => {
          setIsInteractionDialogOpen(open);
          if (!open) setEditingInteraction(null);
        }}
        entityType="lead"
        entityId={leadId || 0}
        interaction={editingInteraction}
      />

      {/* Task Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTask ? t('leads.tasks.editTask') : t('leads.tasks.addTask')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTaskSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="taskTitle">{t('leads.tasks.taskTitle')} *</Label>
                <Input
                  id="taskTitle"
                  name="notASearchField"
                  autoComplete="new-password"
                  data-form-type="other"
                  data-lpignore="true"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                  placeholder={t('leads.placeholders.taskTitle')}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taskDescription">{t('leads.tasks.description')}</Label>
                <Textarea
                  id="taskDescription"
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                  placeholder={t('leads.placeholders.taskDescription')}
                  rows={4}
                  className="resize-y min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('leads.tasks.priority')}</Label>
                  <Select
                    value={taskFormData.priority}
                    onValueChange={(value) => setTaskFormData({ ...taskFormData, priority: value as typeof TASK_PRIORITIES[number] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITIES.map(priority => (
                        <SelectItem key={priority} value={priority}>
                          {t(`leads.tasks.priorities.${priority}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('leads.tasks.status')}</Label>
                  <Select
                    value={taskFormData.status}
                    onValueChange={(value) => setTaskFormData({ ...taskFormData, status: value as typeof TASK_STATUSES[number] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map(status => (
                        <SelectItem key={status} value={status}>
                          {t(`leads.tasks.taskStatuses.${status}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">{t('leads.tasks.dueDate')}</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={taskFormData.dueDate}
                  onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('leads.tasks.assignedDepartment')}</Label>
                <Select
                  value={taskFormData.departmentId?.toString() || 'none'}
                  onValueChange={(value) => setTaskFormData({ ...taskFormData, departmentId: value === 'none' ? null : parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('leads.tasks.selectDepartment')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('leads.tasks.unassigned')}</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id.toString()}>
                        {i18n.language === 'ar' && dept.nameAr ? dept.nameAr : dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notification Emails */}
              <div className="space-y-2">
                <Label>{t('tasks.completionNotificationEmails')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('tasks.notificationEmailsDesc')}
                </p>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      const trimmedEmail = emailInput.trim();
                      if (!trimmedEmail) return;
                      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                      if (!emailRegex.test(trimmedEmail)) {
                        toast({ title: t('tasks.invalidEmail'), description: t('tasks.invalidEmailDesc'), variant: 'destructive' });
                        return;
                      }
                      if (taskFormData.notificationEmails.includes(trimmedEmail)) {
                        toast({ title: t('tasks.duplicateEmail'), description: t('tasks.duplicateEmailDesc'), variant: 'destructive' });
                        return;
                      }
                      setTaskFormData({ ...taskFormData, notificationEmails: [...taskFormData.notificationEmails, trimmedEmail] });
                      setEmailInput('');
                    }
                  }}
                />
                {taskFormData.notificationEmails.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {taskFormData.notificationEmails.map((email, index) => (
                      <Badge key={index} variant="secondary" className="gap-1 pr-1">
                        {email}
                        <button
                          type="button"
                          onClick={() => {
                            setTaskFormData({
                              ...taskFormData,
                              notificationEmails: taskFormData.notificationEmails.filter((_, i) => i !== index)
                            });
                          }}
                          className="ml-1 hover:bg-secondary-foreground/20 rounded p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeTaskDialog}>
                {t('common.cancel')}
              </Button>
              <Button 
                type="submit" 
                disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
              >
                {editingTask ? t('common.save') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Interaction Confirmation */}
      <AlertDialog open={!!deletingInteraction} onOpenChange={(open) => !open && setDeletingInteraction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('leads.interactions.editInteraction')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('leads.confirmations.deleteInteraction')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingInteraction && deleteInteractionMutation.mutate(deletingInteraction.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Task Detail Dialog with Comments */}
      <Dialog open={!!viewingTask} onOpenChange={(open) => !open && setViewingTask(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('tasks.taskDetails')}</DialogTitle>
            <DialogDescription>{t('tasks.viewTaskDetailsAndComments')}</DialogDescription>
          </DialogHeader>
          
          {viewingTask && (
            <div className="space-y-4">
              {/* Task Info */}
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {i18n.language === 'ar' && viewingTask.titleAr ? viewingTask.titleAr : viewingTask.title}
                    </h3>
                    {viewingTask.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {i18n.language === 'ar' && viewingTask.descriptionAr ? viewingTask.descriptionAr : viewingTask.description}
                      </p>
                    )}
                  </div>
                  <Badge variant={
                    viewingTask.status === 'completed' ? 'default' : 
                    viewingTask.status === 'in_progress' ? 'secondary' : 'outline'
                  }>
                    {t(`leads.tasks.taskStatuses.${viewingTask.status}`)}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{viewingTask.dueDate ? new Date(viewingTask.dueDate).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US') : t('tasks.noDueDate')}</span>
                  </div>
                  <Badge variant={
                    viewingTask.priority === 'high' ? 'destructive' :
                    viewingTask.priority === 'medium' ? 'secondary' : 'outline'
                  } className={
                    viewingTask.priority === 'high' ? 'bg-orange-500' : ''
                  }>
                    {t(`leads.tasks.priorities.${viewingTask.priority}`)}
                  </Badge>
                </div>
              </div>

              {/* Comments Section */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {t('tasks.comments')} ({taskComments.length})
                </h4>
                
                {/* Comment Input */}
                <div className="space-y-2 border rounded-lg p-3">
                  <Textarea
                    placeholder={t('tasks.addComment')}
                    value={taskCommentText}
                    onChange={(e) => setTaskCommentText(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        ref={taskFileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => setSelectedTaskFile(e.target.files?.[0] || null)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => taskFileInputRef.current?.click()}
                      >
                        <Paperclip className="h-4 w-4 mr-1" />
                        {t('tasks.attachFile')}
                      </Button>
                      {selectedTaskFile && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <span className="truncate max-w-[150px]">{selectedTaskFile.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => {
                              setSelectedTaskFile(null);
                              if (taskFileInputRef.current) taskFileInputRef.current.value = '';
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSubmitTaskComment}
                      disabled={createTaskCommentMutation.isPending || (!taskCommentText.trim() && !selectedTaskFile)}
                    >
                      {createTaskCommentMutation.isPending ? t('common.sending') : t('tasks.addCommentButton')}
                    </Button>
                  </div>
                </div>

                {/* Comments List */}
                {isLoadingTaskComments ? (
                  <div className="text-center py-4 text-muted-foreground">
                    {t('common.loading')}
                  </div>
                ) : taskComments.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    {t('tasks.noComments')}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {taskComments.map((comment) => (
                      <div key={comment.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <UserIcon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{comment.authorUsername || t('tasks.unknownUser')}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(comment.createdAt).toLocaleString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteTaskCommentMutation.mutate({ taskId: viewingTask.id, commentId: comment.id })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {comment.body && (
                          <p className="text-sm pl-10">{comment.body}</p>
                        )}
                        {comment.attachments && comment.attachments.length > 0 && (
                          <div className="pl-10 space-y-1">
                            {comment.attachments.map((attachment) => (
                              <div
                                key={attachment.id}
                                className="flex items-center gap-2 p-2 bg-muted rounded text-sm cursor-pointer hover:bg-muted/80"
                                onClick={() => handleTaskFileDownload(attachment.id, attachment.fileName)}
                              >
                                {getFileIcon(attachment.mimeType)}
                                <span className="truncate flex-1">{attachment.fileName}</span>
                                <span className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</span>
                                <Download className="h-4 w-4 text-muted-foreground" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Task Confirmation */}
      <AlertDialog open={!!deletingTask} onOpenChange={(open) => !open && setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('leads.tasks.editTask')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('leads.confirmations.deleteTask')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTask && deleteTaskMutation.mutate(deletingTask.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
