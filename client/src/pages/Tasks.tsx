import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation, Link } from 'wouter';
import { format, parseISO } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ExportButton } from '@/components/ExportButton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useTranslation } from 'react-i18next';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  FileText,
  Users,
  Mail,
  Plus,
  Pencil,
  X,
  Eye,
  Download,
  Image,
  Archive,
  File,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Hourglass,
  Handshake,
  ListTodo,
} from 'lucide-react';
import TaskCommentsView from '@/components/TaskCommentsView';
import { PageHeader } from '@/components/PageHeader';
import { StatCard, StatsGrid } from '@/components/ui/stat-card';
import { LoadingState, ListLoadingSkeleton } from '@/components/ui/loading-state';
import { NoTasksEmptyState } from '@/components/ui/empty-state';

interface Task {
  id: number;
  eventDepartmentId: number | null;
  contactId?: number | null;
  departmentId?: number | null;
  title: string;
  titleAr?: string | null;
  description: string | null;
  descriptionAr?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'waiting';
  priority?: 'high' | 'medium' | 'low';
  dueDate: string | null;
  createdByUserId: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  notificationEmails: string[] | null;
}

type PendingTask = Task & { effectiveDate: string };

interface TaskComment {
  id: number;
  taskId: number;
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

interface EventDepartment {
  id: number;
  eventId: string;
  departmentId: number;
}

interface Department {
  id: number;
  name: string;
  nameAr?: string | null;
  active: boolean;
  ccList: string[] | null;
  createdAt: string;
}

interface Event {
  id: string;
  name: string;
  nameAr?: string | null;
  description: string;
  descriptionAr?: string | null;
  startDate: string;
  endDate: string;
  location: string;
  locationAr?: string | null;
  category?: string;
  categoryAr?: string | null;
}

interface Contact {
  id: number;
  name: string;
  nameAr?: string | null;
  status: string;
}

interface Partnership {
  id: number;
  nameEn: string;
  nameAr?: string | null;
}

interface TaskWithDetails {
  task: Task;
  eventDepartment?: EventDepartment;
  department: Department;
  event?: Event;
  contact?: Contact;
  partnership?: Partnership;
  taskType: 'event' | 'contact' | 'partnership';
}

interface PendingEventGroup {
  event: Event;
  eventDepartment: EventDepartment;
  tasks: PendingTask[];
}

interface PendingDepartmentGroup {
  department: Department;
  events: PendingEventGroup[];
}

interface PendingTasksResponse {
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  rules: {
    dueDateFallback: string;
    overlappingEvents: string;
    timezone: string;
  };
  departments: PendingDepartmentGroup[];
}

type FilterStatus = 'all' | 'pending' | 'in_progress' | 'completed' | 'waiting';
type FilterTaskType = 'all' | 'event' | 'contact' | 'partnership';

// Form schema for task creation/editing
const taskFormSchema = z.object({
  eventId: z.string({ required_error: 'Please select an event' }).min(1, 'Please select an event'),
  departmentId: z.number({ required_error: 'Please select a department' }).min(1, 'Please select a department'),
  title: z.string().min(1, 'Title is required'),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled', 'waiting']),
  dueDate: z
    .string({ required_error: 'Please select a due date' })
    .min(1, 'Please select a due date'),
  notificationEmails: z.array(z.string().email()).default([]),
  eventDepartmentId: z.number().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

export default function Tasks() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const isArabic = i18n.language === 'ar' || language === 'ar';

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterTaskType, setFilterTaskType] = useState<FilterTaskType>('all');
  const [filterDepartment, setFilterDepartment] = useState<string | null>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [savedTaskSnapshot, setSavedTaskSnapshot] = useState<Task | null>(null);
  const [collapsedEvents, setCollapsedEvents] = useState<Record<string, boolean>>({});
  const [collapsedContacts, setCollapsedContacts] = useState<Record<number, boolean>>({});
  const [collapsedPartnerships, setCollapsedPartnerships] = useState<Record<number, boolean>>({});
  const [pendingRange, setPendingRange] = useState<'day' | 'week'>('day');
  const [referenceDate, setReferenceDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));

  // Redirect if not admin/superadmin
  if (user && user.role !== 'admin' && user.role !== 'superadmin') {
    setLocation('/');
    return <div />;
  }

  // Fetch all tasks
  const { data: tasksData = [], isLoading } = useQuery<TaskWithDetails[]>({
    queryKey: ['/api/admin/tasks'],
  });

  const { data: pendingTasksData, isLoading: pendingLoading } = useQuery<PendingTasksResponse>({
    queryKey: ['/api/tasks/pending-range', pendingRange, referenceDate],
    queryFn: async () => apiRequest('GET', `/api/tasks/pending-range?range=${pendingRange}&referenceDate=${referenceDate}`),
  });

  // Fetch events and departments for task assignment
  const { data: eventsList = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  const { data: departmentsList = [] } = useQuery<Department[]>({
    queryKey: ['/api/stakeholders'],
  });

  // Fetch comments for viewing task
  const { data: comments = [] } = useQuery<TaskComment[]>({
    queryKey: ['/api/tasks', viewingTask?.id, 'comments'],
    enabled: !!viewingTask,
  });

  // Handle taskId query parameter for direct navigation
  useEffect(() => {
    // Get full URL including query params
    const fullUrl = window.location.href;
    const urlObj = new URL(fullUrl);
    const taskId = urlObj.searchParams.get('taskId');
    
    console.log('[Tasks Debug]', {
      location,
      fullUrl,
      taskId,
      tasksDataLength: tasksData.length,
      viewingTask: viewingTask?.id,
      allTaskIds: tasksData.map(td => td.task.id)
    });
    
    if (taskId && tasksData.length > 0 && !viewingTask) {
      const task = tasksData.find(td => td.task.id === parseInt(taskId));
      console.log('[Tasks] Found task for id', taskId, ':', task);
      if (task) {
        console.log('[Tasks] Setting viewing task:', task.task);
        setViewingTask(task.task);
        // Clean up URL
        setLocation('/admin/tasks', { replace: true });
      }
    }
  }, [location, tasksData, viewingTask, setLocation]);

  // Initialize form
  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      eventId: '',
      departmentId: 0,
      eventDepartmentId: undefined,
      title: '',
      titleAr: '',
      description: '',
      descriptionAr: '',
      status: 'pending',
      dueDate: '',
      notificationEmails: [],
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const { eventId, departmentId, eventDepartmentId, ...taskData } = data;

      if (!eventId || !departmentId) {
        throw new Error(t('tasks.selectEventDepartmentPlaceholder'));
      }

      const assignment = await apiRequest('POST', '/api/admin/event-stakeholders', {
        eventId,
        departmentId,
      });

      const targetEventDepartmentId = eventDepartmentId || assignment.id;

      return await apiRequest('POST', `/api/event-departments/${targetEventDepartmentId}/tasks`, taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/event-stakeholders'] });
      setShowTaskDialog(false);
      setEditingTask(null);
      form.reset();
      setEmailInput('');
      toast({
        title: t('common.success'),
        description: t('tasks.taskCreated'),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('tasks.taskCreateError'),
        variant: 'destructive',
      });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<TaskFormData> }) => {
      return await apiRequest('PATCH', `/api/tasks/${id}`, data);
    },
    onSuccess: (updatedTask: Task) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tasks'] });
      setSavedTaskSnapshot(updatedTask);
      toast({
        title: t('common.success'),
        description: t('tasks.taskUpdated'),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('tasks.taskUpdateError'),
        variant: 'destructive',
      });
    },
  });

  // Handler functions
  const handleOpenCreateDialog = () => {
    setEditingTask(null);
    setSavedTaskSnapshot(null);
    form.reset({
      eventId: '',
      departmentId: 0,
      eventDepartmentId: undefined,
      title: '',
      titleAr: '',
      description: '',
      descriptionAr: '',
      status: 'pending',
      dueDate: '',
      notificationEmails: [],
    });
    setEmailInput('');
    setShowTaskDialog(true);
  };

  const handleOpenEditDialog = (taskDetails: TaskWithDetails) => {
    // Only allow editing event-based tasks from this dialog
    // Lead tasks should be edited from the lead detail page
    if (taskDetails.taskType === 'contact') {
      toast({
        title: t('common.info'),
        description: t('tasks.editLeadTaskFromLead'),
        variant: 'default',
      });
      return;
    }
    
    const { task, eventDepartment, event, department } = taskDetails;
    if (!event || !eventDepartment) return;
    
    setEditingTask(task);
    setSavedTaskSnapshot(null);
    form.reset({
      eventId: event.id,
      departmentId: department.id,
      eventDepartmentId: eventDepartment.id,
      title: task.title,
      titleAr: task.titleAr || '',
      description: task.description || '',
      descriptionAr: task.descriptionAr || '',
      status: task.status,
      dueDate: task.dueDate || '',
      notificationEmails: task.notificationEmails || [],
    });
    setEmailInput('');
    setShowTaskDialog(true);
  };

  const handleSubmit = (data: TaskFormData) => {
    if (editingTask) {
      const { eventId, departmentId, eventDepartmentId, ...updateData } = data;
      updateTaskMutation.mutate({ id: editingTask.id, data: updateData });
    } else {
      createTaskMutation.mutate(data);
    }
  };

  const handleAddEmail = (email: string, field: any) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast({
        title: t('tasks.invalidEmail'),
        description: t('tasks.invalidEmailDesc'),
        variant: 'destructive',
      });
      return;
    }

    // Check if email already exists
    const currentEmails = field.value || [];
    if (currentEmails.includes(trimmedEmail)) {
      toast({
        title: t('tasks.duplicateEmail'),
        description: t('tasks.duplicateEmailDesc'),
        variant: 'destructive',
      });
      return;
    }

    // Add email to array
    field.onChange([...currentEmails, trimmedEmail]);
    setEmailInput('');
  };

  const handleRemoveEmail = (index: number, field: any) => {
    const currentEmails = field.value || [];
    field.onChange(currentEmails.filter((_: string, i: number) => i !== index));
  };

  // Helper functions for task details view
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-orange-500 hover:bg-orange-600 text-white';
      case 'in_progress':
        return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'completed':
        return 'bg-green-500 hover:bg-green-600 text-white';
      case 'waiting':
        return 'bg-gray-400 hover:bg-gray-500 text-white';
      case 'cancelled':
        return 'bg-red-500 hover:bg-red-600 text-white';
      default:
        return '';
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (mimeType === 'application/pdf') return <FileText className="h-4 w-4" />;
    if (mimeType.includes('zip')) return <Archive className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDownload = async (attachmentId: number, fileName: string) => {
    try {
      const response = await fetch(`/api/task-comment-attachments/${attachmentId}/download`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({ 
        title: t('common.error'), 
        description: t('tasks.downloadError'),
        variant: 'destructive',
      });
    }
  };

  // Get unique departments for filter
  const departments = Array.from(
    new Map(tasksData.map(td => [td.department.id, td.department])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Filter tasks
  const filteredTasks = tasksData.filter((taskData) => {
    if (filterStatus !== 'all' && taskData.task.status !== filterStatus) {
      return false;
    }
    if (filterDepartment && taskData.department.id !== parseInt(filterDepartment)) {
      return false;
    }
    if (filterTaskType !== 'all' && taskData.taskType !== filterTaskType) {
      return false;
    }
    return true;
  });

  // Group event-based tasks by event
  const eventTasks = filteredTasks.filter(td => td.taskType === 'event');
  const tasksByEvent = eventTasks.reduce((acc, taskData) => {
    const eventId = taskData.event!.id;
    if (!acc[eventId]) {
      acc[eventId] = {
        event: taskData.event!,
        tasks: [],
      };
    }
    acc[eventId].tasks.push({
      task: taskData.task,
      department: taskData.department,
    });
    return acc;
  }, {} as Record<string, { event: Event; tasks: Array<{ task: Task; department: Department }> }>);

  // Group contact-based tasks by contact
  const contactTasksList = filteredTasks.filter(td => td.taskType === 'contact');
  const tasksByContact = contactTasksList.reduce((acc, taskData) => {
    const contactId = taskData.contact?.id || 0;
    if (!acc[contactId]) {
      acc[contactId] = {
        contact: taskData.contact!,
        tasks: [],
      };
    }
    acc[contactId].tasks.push({
      task: taskData.task,
      department: taskData.department,
    });
    return acc;
  }, {} as Record<number, { contact: Contact; tasks: Array<{ task: Task; department: Department }> }>);

  // Group partnership-based tasks by partnership
  const partnershipTasksList = filteredTasks.filter(td => td.taskType === 'partnership');
  const tasksByPartnership = partnershipTasksList.reduce((acc, taskData) => {
    const partnershipId = taskData.partnership?.id || 0;
    if (!acc[partnershipId]) {
      acc[partnershipId] = {
        partnership: taskData.partnership!,
        tasks: [],
      };
    }
    acc[partnershipId].tasks.push({
      task: taskData.task,
      department: taskData.department,
    });
    return acc;
  }, {} as Record<number, { partnership: Partnership; tasks: Array<{ task: Task; department: Department }> }>);

  const events = Object.values(tasksByEvent).sort((a, b) =>
    parseISO(a.event.startDate).getTime() - parseISO(b.event.startDate).getTime()
  );

  const contacts = Object.values(tasksByContact).sort((a, b) =>
    a.contact.name.localeCompare(b.contact.name)
  );

  const partnerships = Object.values(tasksByPartnership).sort((a, b) =>
    a.partnership.nameEn.localeCompare(b.partnership.nameEn)
  );

  const toggleContactCollapse = (contactId: number) => {
    setCollapsedContacts(prev => ({
      ...prev,
      [contactId]: !prev[contactId],
    }));
  };

  const setAllContactsCollapsed = (collapse: boolean) => {
    const newState: Record<number, boolean> = {};
    contacts.forEach(({ contact }) => {
      newState[contact.id] = collapse;
    });
    setCollapsedContacts(newState);
  };

  const togglePartnershipCollapse = (partnershipId: number) => {
    setCollapsedPartnerships(prev => ({
      ...prev,
      [partnershipId]: !prev[partnershipId],
    }));
  };

  const setAllPartnershipsCollapsed = (collapse: boolean) => {
    const newState: Record<number, boolean> = {};
    partnerships.forEach(({ partnership }) => {
      newState[partnership.id] = collapse;
    });
    setCollapsedPartnerships(newState);
  };

  const toggleEventCollapse = (eventId: string) => {
    setCollapsedEvents(prev => ({
      ...prev,
      [eventId]: !prev[eventId],
    }));
  };

  const setAllEventsCollapsed = (collapse: boolean) => {
    const newState: Record<string, boolean> = {};
    events.forEach(({ event }) => {
      newState[event.id] = collapse;
    });
    setCollapsedEvents(newState);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'pending':
        return 'outline';
      case 'waiting':
        return 'outline';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="h-3 w-3" />;
      case 'in_progress':
        return <Clock className="h-3 w-3" />;
      case 'completed':
        return <CheckCircle2 className="h-3 w-3" />;
      case 'waiting':
        return <Hourglass className="h-3 w-3" />;
      case 'cancelled':
        return <X className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const totalTasks = filteredTasks.length;
  const pendingTasks = filteredTasks.filter(td => td.task.status === 'pending').length;
  const inProgressTasks = filteredTasks.filter(td => td.task.status === 'in_progress').length;
  const completedTasks = filteredTasks.filter(td => td.task.status === 'completed').length;

  return (
    <div className="p-6">
      <PageHeader
        title={t('tasks.title')}
        subtitle={t('tasks.subtitle')}
        icon={CheckCircle2}
        iconColor="text-primary"
      >
        <div className="flex items-center gap-2">
          <ExportButton 
            entityType="tasks"
            filters={{
              ...(filterStatus !== 'all' && { status: filterStatus }),
              ...(filterTaskType !== 'all' && { taskType: filterTaskType }),
              ...(filterDepartment && { departmentId: filterDepartment }),
            }}
            variant="outline"
          />
          <Button 
            onClick={handleOpenCreateDialog} 
            className="gap-2"
            data-testid="button-create-task"
          >
            <Plus className="h-4 w-4" />
            {t('tasks.createTask')}
          </Button>
        </div>
      </PageHeader>

      {/* Stats Cards */}
      <StatsGrid columns={4} className="mb-6">
        <StatCard
          title={t('tasks.totalTasks')}
          value={totalTasks}
          icon={ListTodo}
          loading={isLoading}
        />
        <StatCard
          title={t('tasks.pendingTasks')}
          value={pendingTasks}
          icon={AlertCircle}
          loading={isLoading}
          iconClassName="bg-orange-500/10 [&_svg]:text-orange-500"
        />
        <StatCard
          title={t('tasks.inProgressTasks')}
          value={inProgressTasks}
          icon={Clock}
          loading={isLoading}
          iconClassName="bg-blue-500/10 [&_svg]:text-blue-500"
        />
        <StatCard
          title={t('tasks.completedTasks')}
          value={completedTasks}
          icon={CheckCircle2}
          loading={isLoading}
          iconClassName="bg-green-500/10 [&_svg]:text-green-500"
        />
      </StatsGrid>

        <Card className="mb-6">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>{t('tasks.pending')}</CardTitle>
                <CardDescription>
                  {pendingRange === 'day'
                    ? t('tasks.pendingRangeDepartmentDay')
                    : t('tasks.pendingRangeDepartmentWeek')}
                </CardDescription>
              </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={pendingRange === 'day' ? 'default' : 'outline'}
                onClick={() => setPendingRange('day')}
              >
                {t('tasks.day')}
              </Button>
              <Button
                size="sm"
                variant={pendingRange === 'week' ? 'default' : 'outline'}
                onClick={() => setPendingRange('week')}
              >
                {t('tasks.week')}
              </Button>
              <Input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
                className="w-auto"
              />
            </div>
          </CardHeader>
          <CardContent>
            {pendingLoading ? (
              <ListLoadingSkeleton count={3} />
            ) : !pendingTasksData || pendingTasksData.departments.length === 0 ? (
              <div className="py-4">
                <NoTasksEmptyState showAction={false} />
              </div>
            ) : (
              <div className="space-y-4">
                {pendingTasksData.departments.map((department) => (
                  <div key={department.department.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">
                        {isArabic && department.department.nameAr ? department.department.nameAr : department.department.name}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {department.events.map((eventGroup) => (
                        <div key={eventGroup.event.id} className="rounded-md border p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {isArabic && eventGroup.event.nameAr ? eventGroup.event.nameAr : eventGroup.event.name}
                              </span>
                            </div>
                            <Badge variant="outline">{t('tasks.pendingCount', { count: eventGroup.tasks.length })}</Badge>
                          </div>
                          <div className="grid gap-2">
                            {eventGroup.tasks.map((task) => (
                              <div key={task.id} className="flex items-center justify-between rounded border px-3 py-2">
                                <div className="space-y-1">
                                  <div className="font-medium">{isArabic && task.titleAr ? task.titleAr : task.title}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {t('tasks.dueOn', { date: format(parseISO(task.effectiveDate), 'MMM d, yyyy') })}
                                  </div>
                                </div>
                                <Badge variant="outline" className="gap-1">
                                  <Clock className="h-3 w-3" />
                                  {t('tasks.pending')}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <CardTitle>{t('tasks.filters')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  {t('tasks.taskStatus')}
                </label>
                <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as FilterStatus)}>
                  <SelectTrigger data-testid="select-filter-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('tasks.allStatuses')}</SelectItem>
                    <SelectItem value="pending">{t('tasks.pending')}</SelectItem>
                    <SelectItem value="in_progress">{t('tasks.inProgress')}</SelectItem>
                    <SelectItem value="completed">{t('tasks.completed')}</SelectItem>
                    <SelectItem value="waiting">{t('tasks.waiting')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  {t('tasks.taskType')}
                </label>
                <Select value={filterTaskType} onValueChange={(value) => setFilterTaskType(value as FilterTaskType)}>
                  <SelectTrigger data-testid="select-filter-task-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('tasks.allTypes')}</SelectItem>
                    <SelectItem value="event">{t('tasks.eventTasksLabel')}</SelectItem>
                    <SelectItem value="contact">{t('tasks.leadTasksLabel')}</SelectItem>
                    <SelectItem value="partnership">{t('tasks.partnershipTasksLabel')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  {t('filters.department')}
                </label>
                <Select value={filterDepartment || 'all'} onValueChange={(value) => setFilterDepartment(value === 'all' ? null : value)}>
                  <SelectTrigger data-testid="select-filter-department">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('tasks.allDepartments')}</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={String(dept.id)}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {events.length > 0 && (
          <div className="flex justify-end gap-2 mb-4">
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => setAllEventsCollapsed(false)}
              data-testid="button-expand-all-events"
            >
              <ChevronDown className="h-4 w-4" />
              {t('tasks.expandAll')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-2"
              onClick={() => setAllEventsCollapsed(true)}
              data-testid="button-collapse-all-events"
            >
              <ChevronUp className="h-4 w-4" />
              {t('tasks.collapseAll')}
            </Button>
          </div>
        )}

        {/* Tasks List */}
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
              <p className="text-lg font-semibold text-muted-foreground">
                {t('tasks.noTasks')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Event-based tasks */}
            {events.length > 0 && (filterTaskType === 'all' || filterTaskType === 'event') && (
              <>
                {events.map(({ event, tasks }) => {
                  const isCollapsed = collapsedEvents[event.id] ?? false;
                  const pendingCount = tasks.filter(({ task }) => task.status === 'pending').length;
                  const inProgressCount = tasks.filter(({ task }) => task.status === 'in_progress').length;
                  const completedCount = tasks.filter(({ task }) => task.status === 'completed').length;

                  return (
                    <Card key={event.id} data-testid={`card-event-${event.id}`}>
                      <CardHeader>
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{t('tasks.eventTask')}</Badge>
                            </div>
                            <CardTitle className="text-xl font-heading text-secondary">
                              {isArabic && event.nameAr ? event.nameAr : event.name}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 text-sm">
                              <CalendarIcon className="h-4 w-4" />
                              {format(parseISO(event.startDate), 'MMM d, yyyy')}
                              {event.startDate !== event.endDate && (
                                <> - {format(parseISO(event.endDate), 'MMM d, yyyy')}</>
                              )}
                            </CardDescription>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <Badge variant="secondary" className="gap-1">
                                <FileText className="h-3 w-3" />
                                {t('tasks.taskCountLabel', { count: tasks.length })}
                              </Badge>
                              <Badge variant="outline" className="gap-1">
                                {t('tasks.status.pending')}: {pendingCount}
                              </Badge>
                              <Badge variant="outline" className="gap-1">
                                {t('tasks.status.in_progress')}: {inProgressCount}
                              </Badge>
                              <Badge variant="outline" className="gap-1">
                                {t('tasks.status.completed')}: {completedCount}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2"
                            onClick={() => toggleEventCollapse(event.id)}
                            data-testid={`button-toggle-event-${event.id}`}
                          >
                            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                            {isCollapsed ? t('tasks.expandEvent') : t('tasks.collapseEvent')}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {isCollapsed ? (
                          <p className="text-sm text-muted-foreground text-center py-4" data-testid={`text-collapsed-${event.id}`}>
                            {t('tasks.eventCollapsed')}
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {tasks.map(({ task, department }) => {
                              const taskData = tasksData.find(td => td.task.id === task.id);

                              return (
                                <Card key={task.id} className="p-4" data-testid={`card-task-${task.id}`}>
                                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                    <div className="flex-1 space-y-2">
                                      <div className="flex items-start gap-2">
                                        <Users className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                        <div className="flex-1">
                                          <p className="text-sm font-semibold text-muted-foreground">
                                            {isArabic && department.nameAr ? department.nameAr : department.name}
                                          </p>
                                          <h5 className="font-semibold text-base mt-1">
                                            {isArabic && task.titleAr ? task.titleAr : task.title}
                                          </h5>
                                          {(task.description || task.descriptionAr) && (
                                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                              {isArabic && task.descriptionAr ? task.descriptionAr : task.description}
                                            </p>
                                          )}
                                          {task.notificationEmails && task.notificationEmails.length > 0 && (
                                            <div className="flex items-start gap-1 mt-2">
                                              <Mail className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                              <div className="flex flex-wrap gap-1">
                                                {task.notificationEmails.map((email, idx) => (
                                                  <Badge key={idx} variant="outline" className="text-xs" data-testid={`badge-notification-email-${idx}`}>
                                                    {email}
                                                  </Badge>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap gap-2 items-center ml-6">
                                        <Badge variant={getStatusBadgeVariant(task.status)} className="gap-1">
                                          {getStatusIcon(task.status)}
                                          {t(`tasks.status.${task.status}`)}
                                        </Badge>
                                        {task.dueDate && (
                                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <CalendarIcon className="h-3 w-3" />
                                            {t('tasks.dueOn', { date: format(parseISO(task.dueDate), 'MMM d, yyyy') })}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          const taskData = tasksData.find(td => td.task.id === task.id);
                                          if (taskData) {
                                            setViewingTask(taskData.task);
                                          }
                                        }}
                                        className="gap-2"
                                        data-testid={`button-view-task-${task.id}`}
                                      >
                                        <Eye className="h-3 w-3" />
                                        {t('tasks.viewDetails')}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => taskData && handleOpenEditDialog(taskData)}
                                        className="gap-2"
                                        data-testid={`button-edit-task-${task.id}`}
                                      >
                                        <Pencil className="h-3 w-3" />
                                        {t('common.edit')}
                                      </Button>
                                    </div>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}

            {/* Contact-based tasks grouped by contact */}
            {contacts.length > 0 && (filterTaskType === 'all' || filterTaskType === 'contact') && (
              <>
                {contacts.map(({ contact, tasks }) => {
                  const isCollapsed = collapsedContacts[contact.id] ?? false;
                  const pendingCount = tasks.filter(({ task }) => task.status === 'pending').length;
                  const inProgressCount = tasks.filter(({ task }) => task.status === 'in_progress').length;
                  const completedCount = tasks.filter(({ task }) => task.status === 'completed').length;

                  return (
                    <Card key={contact.id} data-testid={`card-contact-${contact.id}`}>
                      <CardHeader>
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">{t('tasks.leadTasksLabel')}</Badge>
                            </div>
                            <CardTitle className="text-xl font-heading text-secondary">
                              {isArabic && contact.nameAr ? contact.nameAr : contact.name}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 text-sm">
                              <Users className="h-4 w-4" />
                              {t(`leads.statuses.${contact.status}`)}
                            </CardDescription>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <Badge variant="secondary" className="gap-1">
                                <FileText className="h-3 w-3" />
                                {t('tasks.taskCountLabel', { count: tasks.length })}
                              </Badge>
                              <Badge variant="outline" className="gap-1">
                                {t('tasks.status.pending')}: {pendingCount}
                              </Badge>
                              <Badge variant="outline" className="gap-1">
                                {t('tasks.status.in_progress')}: {inProgressCount}
                              </Badge>
                              <Badge variant="outline" className="gap-1">
                                {t('tasks.status.completed')}: {completedCount}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLocation(`/admin/leads/${contact.id}`)}
                            >
                              {t('tasks.viewLead')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-2"
                              onClick={() => toggleContactCollapse(contact.id)}
                              data-testid={`button-toggle-contact-${contact.id}`}
                            >
                              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                              {isCollapsed ? t('tasks.expandEvent') : t('tasks.collapseEvent')}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {isCollapsed ? (
                          <p className="text-sm text-muted-foreground text-center py-4" data-testid={`text-collapsed-contact-${contact.id}`}>
                            {t('tasks.eventCollapsed')}
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {tasks.map(({ task, department }) => (
                              <Card key={task.id} className="p-4" data-testid={`card-contact-task-${task.id}`}>
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-start gap-2">
                                      <Users className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                      <div className="flex-1">
                                        <p className="text-sm font-semibold text-muted-foreground">
                                          {isArabic && department.nameAr ? department.nameAr : department.name}
                                        </p>
                                        <h5 className="font-semibold text-base mt-1">
                                          {isArabic && task.titleAr ? task.titleAr : task.title}
                                        </h5>
                                        {(task.description || task.descriptionAr) && (
                                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                            {isArabic && task.descriptionAr ? task.descriptionAr : task.description}
                                          </p>
                                        )}
                                        {task.notificationEmails && task.notificationEmails.length > 0 && (
                                          <div className="flex items-start gap-1 mt-2">
                                            <Mail className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                            <div className="flex flex-wrap gap-1">
                                              {task.notificationEmails.map((email, idx) => (
                                                <Badge key={idx} variant="outline" className="text-xs">
                                                  {email}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 items-center ml-6">
                                      <Badge variant={getStatusBadgeVariant(task.status)} className="gap-1">
                                        {getStatusIcon(task.status)}
                                        {t(`tasks.status.${task.status}`)}
                                      </Badge>
                                      {task.priority && (
                                        <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'secondary' : 'outline'} className="gap-1 text-xs">
                                          {t(`tasks.priority.${task.priority}`)}
                                        </Badge>
                                      )}
                                      {task.dueDate && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <CalendarIcon className="h-3 w-3" />
                                          {t('tasks.dueOn', { date: format(parseISO(task.dueDate), 'MMM d, yyyy') })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2 shrink-0">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setViewingTask(task)}
                                      className="gap-2"
                                      data-testid={`button-view-contact-task-${task.id}`}
                                    >
                                      <Eye className="h-3 w-3" />
                                      {t('tasks.viewDetails')}
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}

            {/* Partnership-based tasks grouped by partnership */}
            {partnerships.length > 0 && (filterTaskType === 'all' || filterTaskType === 'partnership') && (
              <>
                {partnerships.map(({ partnership, tasks }) => {
                  const isCollapsed = collapsedPartnerships[partnership.id] ?? false;
                  const pendingCount = tasks.filter(({ task }) => task.status === 'pending').length;
                  const inProgressCount = tasks.filter(({ task }) => task.status === 'in_progress').length;
                  const completedCount = tasks.filter(({ task }) => task.status === 'completed').length;

                  return (
                    <Card key={partnership.id} data-testid={`card-partnership-${partnership.id}`}>
                      <CardHeader>
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Handshake className="h-3 w-3" />
                                {t('tasks.partnershipTasksLabel')}
                              </Badge>
                            </div>
                            <CardTitle className="text-xl font-heading text-secondary">
                              {isArabic && partnership.nameAr ? partnership.nameAr : partnership.nameEn}
                            </CardTitle>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <Badge variant="secondary" className="gap-1">
                                <FileText className="h-3 w-3" />
                                {t('tasks.taskCountLabel', { count: tasks.length })}
                              </Badge>
                              <Badge variant="outline" className="gap-1 text-orange-600 border-orange-300">
                                {t('tasks.status.pending')}: {pendingCount}
                              </Badge>
                              <Badge variant="outline" className="gap-1 text-blue-600 border-blue-300">
                                {t('tasks.status.in_progress')}: {inProgressCount}
                              </Badge>
                              <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
                                {t('tasks.status.completed')}: {completedCount}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLocation(`/admin/partnerships/${partnership.id}`)}
                            >
                              {t('partnerships.viewPartnership')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-2"
                              onClick={() => togglePartnershipCollapse(partnership.id)}
                              data-testid={`button-toggle-partnership-${partnership.id}`}
                            >
                              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                              {isCollapsed ? t('tasks.expandEvent') : t('tasks.collapseEvent')}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {isCollapsed ? (
                          <p className="text-sm text-muted-foreground text-center py-4" data-testid={`text-collapsed-partnership-${partnership.id}`}>
                            {t('tasks.eventCollapsed')}
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {tasks.map(({ task, department }) => (
                              <Card key={task.id} className="p-4" data-testid={`card-partnership-task-${task.id}`}>
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-start gap-2">
                                      <Handshake className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                      <div className="flex-1">
                                        <p className="text-sm font-semibold text-muted-foreground">
                                          {isArabic && department.nameAr ? department.nameAr : department.name}
                                        </p>
                                        <h5 className="font-semibold text-base mt-1">
                                          {isArabic && task.titleAr ? task.titleAr : task.title}
                                        </h5>
                                        {(task.description || task.descriptionAr) && (
                                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                            {isArabic && task.descriptionAr ? task.descriptionAr : task.description}
                                          </p>
                                        )}
                                        {task.notificationEmails && task.notificationEmails.length > 0 && (
                                          <div className="flex items-start gap-1 mt-2">
                                            <Mail className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                            <div className="flex flex-wrap gap-1">
                                              {task.notificationEmails.map((email, idx) => (
                                                <Badge key={idx} variant="outline" className="text-xs">
                                                  {email}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 items-center ml-6">
                                      <Badge variant={getStatusBadgeVariant(task.status)} className="gap-1">
                                        {getStatusIcon(task.status)}
                                        {t(`tasks.status.${task.status}`)}
                                      </Badge>
                                      {task.priority && (
                                        <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'secondary' : 'outline'} className="gap-1 text-xs">
                                          {t(`tasks.priority.${task.priority}`)}
                                        </Badge>
                                      )}
                                      {task.dueDate && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <CalendarIcon className="h-3 w-3" />
                                          {t('tasks.dueOn', { date: format(parseISO(task.dueDate), 'MMM d, yyyy') })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2 shrink-0">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setViewingTask(task)}
                                      className="gap-2"
                                      data-testid={`button-view-partnership-task-${task.id}`}
                                    >
                                      <Eye className="h-3 w-3" />
                                      {t('tasks.viewDetails')}
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Task Dialog */}
        <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTask ? t('tasks.dialog.editTitle') : t('tasks.dialog.createTitle')}
              </DialogTitle>
              <DialogDescription>
                {editingTask 
                  ? t('tasks.dialog.editDescription')
                  : t('tasks.dialog.createDescription')
                }
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Event Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="eventId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          {t('tasks.selection.event')}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={!!editingTask}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-event">
                              <SelectValue placeholder={t('tasks.selection.eventPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {eventsList.map((event) => (
                              <SelectItem key={event.id} value={event.id}>
                                {isArabic && event.nameAr ? event.nameAr : event.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Department Selection */}
                  <FormField
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          {t('tasks.selection.department')}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          value={field.value ? String(field.value) : ''}
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          disabled={!!editingTask}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-department">
                              <SelectValue placeholder={t('tasks.selection.departmentPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {departmentsList.map((department) => (
                              <SelectItem key={department.id} value={String(department.id)}>
                                {isArabic && department.nameAr ? department.nameAr : department.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        {t('tasks.fields.title')}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={t('tasks.placeholders.title')} 
                          {...field} 
                          data-testid="input-task-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Title Arabic */}
                <FormField
                  control={form.control}
                  name="titleAr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tasks.fields.titleAr')}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={t('tasks.placeholders.titleAr')} 
                          {...field}
                          value={field.value || ''}
                          dir="rtl"
                          data-testid="input-task-title-ar"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tasks.fields.description')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={t('tasks.placeholders.description')}
                          rows={4}
                          {...field}
                          data-testid="textarea-task-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description Arabic */}
                <FormField
                  control={form.control}
                  name="descriptionAr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tasks.fields.descriptionAr')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={t('tasks.placeholders.descriptionAr')}
                          rows={4}
                          {...field}
                          value={field.value || ''}
                          dir="rtl"
                          data-testid="textarea-task-description-ar"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Status */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tasks.taskStatus')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-task-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">{t('tasks.pending')}</SelectItem>
                          <SelectItem value="in_progress">{t('tasks.inProgress')}</SelectItem>
                          <SelectItem value="completed">{t('tasks.completed')}</SelectItem>
                          <SelectItem value="cancelled">{t('tasks.cancelled')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Due Date */}
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        {t('tasks.dueDate')}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field}
                          data-testid="input-task-due-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Notification Emails */}
                <FormField
                  control={form.control}
                  name="notificationEmails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tasks.completionNotificationEmails')}</FormLabel>
                      <FormDescription>
                        {t('tasks.notificationEmailsDesc')}
                      </FormDescription>
                      <FormControl>
                        <div className="space-y-3">
                          <Input
                            type="email"
                            placeholder="email@example.com"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault();
                                handleAddEmail(emailInput, field);
                              }
                            }}
                            data-testid="input-notification-emails"
                          />
                          {field.value && field.value.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {field.value.map((email: string, index: number) => (
                                <Badge 
                                  key={index} 
                                  variant="secondary" 
                                  className="gap-1 pr-1"
                                  data-testid={`badge-notification-email-${index}`}
                                >
                                  {email}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEmail(index, field)}
                                    className="ml-1 hover:bg-secondary-foreground/20 rounded p-0.5"
                                    data-testid={`button-remove-email-${index}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Saved Task Confirmation */}
                {editingTask && savedTaskSnapshot && (
                  <Card className="border-2 border-green-500/20 bg-green-50/5 dark:bg-green-900/5" data-testid="panel-saved-task">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                          {t('tasks.savedTaskDetails')}
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs">
                        {t('tasks.lastUpdated')}: {format(parseISO(savedTaskSnapshot.updatedAt), 'MMM d, yyyy h:mm a')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('tasks.fields.title')}</p>
                        <p className="font-medium" data-testid="saved-task-title">{savedTaskSnapshot.title}</p>
                      </div>
                      
                      {savedTaskSnapshot.description && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('tasks.fields.description')}</p>
                          <p className="text-muted-foreground" data-testid="saved-task-description">
                            {savedTaskSnapshot.description}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-2 items-center">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('tasks.taskStatus')}</p>
                          <Badge variant={getStatusBadgeVariant(savedTaskSnapshot.status)} className="gap-1" data-testid="saved-task-status">
                            {getStatusIcon(savedTaskSnapshot.status)}
                            {t(`tasks.status.${savedTaskSnapshot.status}`)}
                          </Badge>
                        </div>
                        
                        {savedTaskSnapshot.dueDate && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('tasks.dueDate')}</p>
                            <Badge variant="outline" className="gap-1" data-testid="saved-task-due-date">
                              <CalendarIcon className="h-3 w-3" />
                              {format(parseISO(savedTaskSnapshot.dueDate), 'MMM d, yyyy')}
                            </Badge>
                          </div>
                        )}
                      </div>
                      
                      {savedTaskSnapshot.notificationEmails && savedTaskSnapshot.notificationEmails.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('tasks.notificationEmails')}</p>
                          <div className="flex flex-wrap gap-1">
                            {savedTaskSnapshot.notificationEmails.map((email, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs" data-testid={`saved-task-email-${idx}`}>
                                {email}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Dialog Footer */}
                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowTaskDialog(false);
                      setEditingTask(null);
                      setSavedTaskSnapshot(null);
                      form.reset();
                      setEmailInput('');
                    }}
                    data-testid="button-cancel-task"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
                    data-testid="button-submit-task"
                  >
                    {editingTask ? t('common.update') : t('common.create')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* View Task Details Dialog - READ-ONLY */}
        <Dialog open={viewingTask !== null} onOpenChange={(open) => {
          if (!open) setViewingTask(null);
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-task-details">
            {viewingTask && (() => {
              const taskData = tasksData.find(td => td.task.id === viewingTask.id);
              if (!taskData) return null;
              
              const { task, event, contact, taskType } = taskData;
              
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-2xl">
                      {isArabic && task.titleAr ? task.titleAr : task.title}
                    </DialogTitle>
                    <DialogDescription>
                      {taskType === 'event' && event ? (
                        <>{t('tasks.eventLabel')} {isArabic && event.nameAr ? event.nameAr : event.name}</>
                      ) : taskType === 'contact' && contact ? (
                        <>{t('tasks.contactLabel')} {isArabic && contact.nameAr ? contact.nameAr : contact.name}</>
                      ) : null}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6">
                    {/* Task Details */}
                    <div>
                      <h3 className="font-semibold mb-2">{t('tasks.taskDescription')}</h3>
                      <p className="text-sm text-muted-foreground">
                        {isArabic && task.descriptionAr ? task.descriptionAr : task.description || t('tasks.noDescription')}
                      </p>
                    </div>

                    {/* Task Metadata */}
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getStatusBadgeColor(task.status)}>
                        {t(`tasks.status.${task.status}`)}
                      </Badge>
                      {task.dueDate && (
                        <Badge variant="outline" className="gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {t('tasks.dueOn', { date: format(parseISO(task.dueDate), 'MMM d, yyyy') })}
                        </Badge>
                      )}
                    </div>

                    {/* Comments Section */}
                    <div>
                      <h3 className="font-semibold mb-4">{t('tasks.comments')}</h3>
                      <TaskCommentsView taskId={task.id} />
                    </div>
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
    </div>
  );
}
