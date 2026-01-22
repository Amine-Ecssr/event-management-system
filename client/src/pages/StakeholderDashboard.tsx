import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, parseISO } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { LoadingState, DashboardCardSkeleton, ListLoadingSkeleton } from '@/components/ui/loading-state';
import {
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquare,
  AlertCircle,
  Filter,
  MapPin,
  Paperclip,
  Download,
  Trash2,
  X,
  Image,
  FileText,
  Archive,
  File,
  ChevronDown,
  ChevronUp,
  Target,
  ArrowUpRight,
  Hourglass,
  Users,
  LayoutDashboard,
  Handshake,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

interface Task {
  id: number;
  eventStakeholderId: number;
  title: string;
  titleAr?: string | null;
  description: string | null;
  descriptionAr?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'waiting';
  dueDate: string | null;
  createdByUserId: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  notificationEmails: string[] | null;
  commentCount?: number;
}

type PendingTask = Task & { effectiveDate: string };

// Lead Task interface - from lead management
interface ContactTask {
  id: number;
  contactId: number;
  title: string;
  titleAr?: string | null;
  description: string | null;
  descriptionAr?: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  dueDate: string | null;
  departmentId: number | null;
  completedAt: string | null;
  notificationEmails: string[] | null;
  createdAt: string;
  updatedAt: string;
  commentCount?: number;
  contact?: {
    id: number;
    name: string;
    status: string;
  } | null;
}

// Partnership Task interface - from partnership management
interface PartnershipTask {
  id: number;
  partnershipId: number;
  title: string;
  titleAr?: string | null;
  description: string | null;
  descriptionAr?: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  dueDate: string | null;
  departmentId: number | null;
  completedAt: string | null;
  notificationEmails: string[] | null;
  createdAt: string;
  updatedAt: string;
  commentCount?: number;
  partnership?: {
    id: number;
    nameEn: string;
    nameAr: string | null;
  } | null;
}

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

interface EventStakeholder {
  id: number;
  eventId: string;
  stakeholderId: number;
  selectedRequirementIds: string[] | null;
  customRequirements: string | null;
  notifyOnCreate: boolean;
  notifyOnUpdate: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  lastReminderSentAt: string | null;
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
  organizers?: string;
  organizersAr?: string | null;
  url?: string;
  category?: string;
  categoryAr?: string | null;
  eventType: 'local' | 'international';
  eventScope: 'internal' | 'external';
  expectedAttendance?: number;
}

interface Stakeholder {
  id: number;
  name: string;
  active: boolean;
  ccList: string | null;
  createdAt: string;
}

interface DashboardEvent {
  eventStakeholder: EventStakeholder;
  event: Event;
  tasks: Task[];
}

interface PendingEventGroup {
  event: Event;
  eventDepartment: EventStakeholder;
  tasks: PendingTask[];
}

interface PendingDepartmentGroup {
  department: Stakeholder;
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

type FilterStatus = 'all' | 'pending' | 'in_progress' | 'completed';
type SortOption = 'event_date' | 'task_due_date';

export default function StakeholderDashboard() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const isArabic = i18n.language === 'ar' || language === 'ar';

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortOption>('event_date');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [openEvents, setOpenEvents] = useState<string[]>([]);
  const [commentText, setCommentText] = useState('');
  const [taskPendingCompletion, setTaskPendingCompletion] = useState<{ taskId: number; emails: string[] } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingRange, setPendingRange] = useState<'day' | 'week'>('day');
  const [referenceDate, setReferenceDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));

  // Redirect if not authenticated
  if (!user) {
    setLocation('/login');
    return <div />;
  }

  const { data: dashboardData, isLoading, error } = useQuery<{ stakeholder: Stakeholder, events: DashboardEvent[] }>({
    queryKey: ['/api/stakeholder-dashboard', user.id], // Include user ID to prevent cache sharing between users
    queryFn: async () => apiRequest('GET', '/api/stakeholder-dashboard'),
  });

  const { data: pendingTasksData, isLoading: pendingTasksLoading } = useQuery<PendingTasksResponse>({
    queryKey: ['/api/tasks/pending-range', user.id, pendingRange, referenceDate], // Include user ID
    queryFn: async () =>
      apiRequest('GET', `/api/tasks/pending-range?range=${pendingRange}&referenceDate=${referenceDate}`),
  });

  // Fetch contact tasks assigned to this department
  const { data: contactTasks = [], isLoading: contactTasksLoading } = useQuery<ContactTask[]>({
    queryKey: ['/api/stakeholder-dashboard/contact-tasks', user.id],
    queryFn: async () => apiRequest('GET', '/api/stakeholder-dashboard/contact-tasks'),
  });

  // Fetch partnership tasks assigned to this department
  const { data: partnershipTasks = [], isLoading: partnershipTasksLoading } = useQuery<PartnershipTask[]>({
    queryKey: ['/api/stakeholder-dashboard/partnership-tasks', user.id],
    queryFn: async () => apiRequest('GET', '/api/stakeholder-dashboard/partnership-tasks'),
  });

  // State for selected contact task (separate from event tasks)
  const [selectedContactTask, setSelectedContactTask] = useState<ContactTask | null>(null);
  const [contactTaskCommentText, setContactTaskCommentText] = useState('');
  const [selectedContactTaskFile, setSelectedContactTaskFile] = useState<File | null>(null);
  const contactTaskFileInputRef = useRef<HTMLInputElement>(null);
  const [contactTaskPendingCompletion, setContactTaskPendingCompletion] = useState<{ taskId: number; emails: string[] } | null>(null);
  const [collapsedContacts, setCollapsedContacts] = useState<Record<number, boolean>>({});

  // State for selected partnership task
  const [selectedPartnershipTask, setSelectedPartnershipTask] = useState<PartnershipTask | null>(null);
  const [partnershipTaskCommentText, setPartnershipTaskCommentText] = useState('');
  const [collapsedPartnerships, setCollapsedPartnerships] = useState<Record<number, boolean>>({});
  const [partnershipTaskPendingCompletion, setPartnershipTaskPendingCompletion] = useState<{ taskId: number; emails: string[] } | null>(null);
  // If user doesn't have access (no department account), redirect to home
  if (error && (error as any).response?.status === 403) {
    setLocation('/');
    return <div />;
  }

  const { data: comments = [] } = useQuery<TaskComment[]>({
    queryKey: ['/api/tasks', selectedTask?.id, 'comments'],
    enabled: !!selectedTask,
  });

  // Fetch comments for selected contact task
  const { data: contactTaskComments = [] } = useQuery<TaskComment[]>({
    queryKey: ['/api/stakeholder-dashboard/contact-tasks', selectedContactTask?.id, 'comments'],
    queryFn: async () => apiRequest('GET', `/api/stakeholder-dashboard/contact-tasks/${selectedContactTask?.id}/comments`),
    enabled: !!selectedContactTask,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      return await apiRequest('PATCH', `/api/tasks/${taskId}`, { status });
    },
    onSuccess: (data, variables) => {
      // Update the selected task state immediately for instant UI feedback
      if (selectedTask && selectedTask.id === variables.taskId) {
        setSelectedTask({ ...selectedTask, status: variables.status as Task['status'] });
      }
      
      // Invalidate queries to refresh data in the background
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholder-dashboard', user.id] });
      
      // Show specific toast with the new status
      toast({
        title: t('common.success'),
        description: t('tasks.taskUpdated'),
      });
      
      // Auto-close dialog after marking as completed (provides closure)
      if (variables.status === 'completed') {
        setTimeout(() => {
          setSelectedTask(null);
        }, 1500);
      }
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('tasks.taskUpdateError'),
        variant: 'destructive',
      });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ taskId, body }: { taskId: number; body: string }) => {
      return await apiRequest('POST', `/api/tasks/${taskId}/comments`, { body });
    },
    // Success handling moved to handleAddComment after file upload completes
  });

  // Mutation for updating contact task status
  const updateContactTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      return await apiRequest('PATCH', `/api/stakeholder-dashboard/contact-tasks/${taskId}`, { status });
    },
    onSuccess: (data, variables) => {
      // Update the selected contact task state immediately for instant UI feedback
      if (selectedContactTask && selectedContactTask.id === variables.taskId) {
        setSelectedContactTask({ ...selectedContactTask, status: variables.status as ContactTask['status'] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholder-dashboard/contact-tasks', user.id] });
      toast({
        title: t('common.success'),
        description: t('tasks.taskUpdated'),
      });
      // Auto-close dialog after marking as completed
      if (variables.status === 'completed') {
        setTimeout(() => {
          setSelectedContactTask(null);
        }, 1500);
      }
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('tasks.taskUpdateError'),
        variant: 'destructive',
      });
    },
  });

  // Mutation for adding comments to contact tasks
  const addContactTaskCommentMutation = useMutation({
    mutationFn: async ({ taskId, body }: { taskId: number; body: string }) => {
      return await apiRequest('POST', `/api/stakeholder-dashboard/contact-tasks/${taskId}/comments`, { body });
    },
  });

  // Mutation for uploading attachments to contact task comments
  const uploadContactTaskFileMutation = useMutation({
    mutationFn: async ({ commentId, file }: { commentId: number; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`/api/contact-task-comments/${commentId}/attachments`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload file');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholder-dashboard/contact-tasks', selectedContactTask?.id, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholder-dashboard/contact-tasks', user.id] });
    },
  });

  // Mutation for deleting contact task comment attachments
  const deleteContactTaskAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: number) => {
      const response = await fetch(`/api/contact-task-comment-attachments/${attachmentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Delete failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholder-dashboard/contact-tasks', selectedContactTask?.id, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholder-dashboard/contact-tasks', user.id] });
      toast({ 
        title: t('common.success'), 
        description: t('files.fileDeleted') 
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('files.fileDeleteError'),
        variant: 'destructive',
      });
    },
  });

  // Mutation for updating partnership task status
  const updatePartnershipTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      return await apiRequest('PATCH', `/api/stakeholder-dashboard/partnership-tasks/${taskId}`, { status });
    },
    onSuccess: (data, variables) => {
      // Update the selected partnership task state immediately for instant UI feedback
      if (selectedPartnershipTask && selectedPartnershipTask.id === variables.taskId) {
        setSelectedPartnershipTask({ ...selectedPartnershipTask, status: variables.status as PartnershipTask['status'] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholder-dashboard/partnership-tasks', user.id] });
      toast({
        title: t('common.success'),
        description: t('tasks.taskUpdated'),
      });
      // Auto-close dialog after marking as completed
      if (variables.status === 'completed') {
        setTimeout(() => {
          setSelectedPartnershipTask(null);
        }, 1500);
      }
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('tasks.taskUpdateError'),
        variant: 'destructive',
      });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ commentId, file }: { commentId: number; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`/api/task-comments/${commentId}/attachments`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload file');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', selectedTask?.id, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholder-dashboard', user.id] });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: number) => {
      const response = await fetch(`/api/task-comment-attachments/${attachmentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Delete failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', selectedTask?.id, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholder-dashboard', user.id] });
      toast({ 
        title: t('common.success'), 
        description: t('files.fileDeleted') 
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('files.fileDeleteError'),
        variant: 'destructive',
      });
    },
  });

  const handleStatusUpdate = (taskId: number, newStatus: string) => {
    if (newStatus === 'completed') {
      const task = dashboardData?.events.flatMap(e => e.tasks).find(t => t.id === taskId);
      if (task && task.notificationEmails && task.notificationEmails.length > 0) {
        setTaskPendingCompletion({ taskId, emails: task.notificationEmails });
        return;
      }
    }
    updateTaskMutation.mutate({ taskId, status: newStatus });
  };

  const handleConfirmCompletion = () => {
    if (taskPendingCompletion) {
      updateTaskMutation.mutate({ taskId: taskPendingCompletion.taskId, status: 'completed' });
      setTaskPendingCompletion(null);
    }
  };

  const handleAddComment = async () => {
    if (!selectedTask || !commentText.trim()) return;
    
    try {
      const comment: any = await addCommentMutation.mutateAsync({ 
        taskId: selectedTask.id, 
        body: commentText.trim() 
      });
      
      // Upload file if one is selected
      if (selectedFile && comment?.id) {
        await uploadFileMutation.mutateAsync({
          commentId: comment.id,
          file: selectedFile,
        });
        setSelectedFile(null);
      }
      
      // Only invalidate and clear after everything succeeds
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', selectedTask.id, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholder-dashboard', user.id] });
      setCommentText('');
      
      toast({
        title: t('tasks.commentAdded'),
        description: selectedFile ? t('tasks.commentAndAttachmentPosted') : t('tasks.commentPosted'),
      });
    } catch (error: any) {
      toast({ 
        title: t('common.error'), 
        description: error.message || t('tasks.commentPostError'),
        variant: 'destructive',
      });
    }
  };

  // Contact task handlers
  const handleContactTaskStatusUpdate = (taskId: number, newStatus: string) => {
    if (newStatus === 'completed') {
      const task = contactTasks.find(t => t.id === taskId);
      if (task && task.notificationEmails && task.notificationEmails.length > 0) {
        setContactTaskPendingCompletion({ taskId, emails: task.notificationEmails });
        return;
      }
    }
    updateContactTaskMutation.mutate({ taskId, status: newStatus });
  };

  const handleConfirmContactTaskCompletion = () => {
    if (contactTaskPendingCompletion) {
      updateContactTaskMutation.mutate({ taskId: contactTaskPendingCompletion.taskId, status: 'completed' });
      setContactTaskPendingCompletion(null);
    }
  };

  const handleAddContactTaskComment = async () => {
    if (!selectedContactTask || !contactTaskCommentText.trim()) return;
    
    try {
      const comment: any = await addContactTaskCommentMutation.mutateAsync({ 
        taskId: selectedContactTask.id, 
        body: contactTaskCommentText.trim() 
      });
      
      // Upload file if one is selected
      if (selectedContactTaskFile && comment?.id) {
        await uploadContactTaskFileMutation.mutateAsync({
          commentId: comment.id,
          file: selectedContactTaskFile,
        });
        setSelectedContactTaskFile(null);
      }
      
      // Only invalidate and clear after everything succeeds
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholder-dashboard/contact-tasks', selectedContactTask.id, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholder-dashboard/contact-tasks', user.id] });
      setContactTaskCommentText('');
      
      toast({
        title: t('tasks.commentAdded'),
        description: selectedContactTaskFile ? t('tasks.commentAndAttachmentPosted') : t('tasks.commentPosted'),
      });
    } catch (error: any) {
      toast({ 
        title: t('common.error'), 
        description: error.message || t('tasks.commentPostError'),
        variant: 'destructive',
      });
    }
  };

  const handleContactTaskFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/zip', 'application/x-zip-compressed'];

    if (file.size > maxSize) {
      toast({
        title: t('common.error'),
        description: t('tasks.fileSizeError'),
        variant: 'destructive',
      });
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: t('common.error'),
        description: t('tasks.fileTypeError'),
        variant: 'destructive',
      });
      return;
    }

    setSelectedContactTaskFile(file);
    if (contactTaskFileInputRef.current) {
      contactTaskFileInputRef.current.value = '';
    }
  };

  const handleContactTaskDownload = async (attachmentId: number, fileName: string) => {
    try {
      const response = await fetch(`/api/contact-task-comment-attachments/${attachmentId}`, {
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
        description: t('tasks.downloadError') 
      });
    }
  };

  const handleDeleteContactTaskAttachment = (attachmentId: number) => {
    deleteContactTaskAttachmentMutation.mutate(attachmentId);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/zip', 'application/x-zip-compressed'];

    if (file.size > maxSize) {
      toast({
        title: t('common.error'),
        description: t('tasks.fileSizeError'),
        variant: 'destructive',
      });
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: t('common.error'),
        description: t('tasks.fileTypeError'),
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
        description: t('tasks.downloadError') 
      });
    }
  };

  const handleDeleteAttachment = (attachmentId: number) => {
    deleteAttachmentMutation.mutate(attachmentId);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (mimeType === 'application/pdf') return <FileText className="h-4 w-4" />;
    if (mimeType.includes('zip')) return <Archive className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const canDeleteAttachment = (attachment: any): boolean => {
    return attachment.uploadedByUserId === user?.id || user?.role === 'admin' || user?.role === 'superadmin';
  };

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

  const getTaskCountByStatus = (tasks: Task[]) => {
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    return { pending, inProgress, completed };
  };

  const getCommentCount = (task: Task) => task.commentCount ?? 0;

  // Filter and sort events
  const filteredAndSortedEvents = useMemo(() => {
    if (!dashboardData?.events) return [];

    return [...dashboardData.events]
      .filter(de => {
        if (filterStatus === 'all') return true;
        return de.tasks.some(task => task.status === filterStatus);
      })
      .sort((a, b) => {
        if (sortBy === 'event_date') {
          return new Date(a.event.startDate).getTime() - new Date(b.event.startDate).getTime();
        } else {
          const aEarliestDue = a.tasks
            .filter(t => t.dueDate)
            .map(t => new Date(t.dueDate!).getTime())
            .sort()[0] || Infinity;
          const bEarliestDue = b.tasks
            .filter(t => t.dueDate)
            .map(t => new Date(t.dueDate!).getTime())
            .sort()[0] || Infinity;
          return aEarliestDue - bEarliestDue;
        }
      });
  }, [dashboardData?.events, filterStatus, sortBy]);

  useEffect(() => {
    setOpenEvents((current) => current.filter((id) =>
      filteredAndSortedEvents.some((de) => de.event.id === id)
    ));
  }, [filteredAndSortedEvents]);

  const handleExpandAll = () => setOpenEvents(filteredAndSortedEvents.map((de) => de.event.id));
  const handleCollapseAll = () => setOpenEvents([]);

  // Group contact tasks by contact
  const groupedContactTasks = useMemo(() => {
    if (!contactTasks || contactTasks.length === 0) return [];

    const grouped = new Map<number, { contact: ContactTask['contact'], tasks: ContactTask[] }>();

    contactTasks.forEach(task => {
      if (!task.contact) return;
      
      const contactId = task.contact.id;
      if (!grouped.has(contactId)) {
        grouped.set(contactId, {
          contact: task.contact,
          tasks: []
        });
      }
      grouped.get(contactId)!.tasks.push(task);
    });

    return Array.from(grouped.values());
  }, [contactTasks]);

  // Group partnership tasks by partnership
  const groupedPartnershipTasks = useMemo(() => {
    if (!partnershipTasks || partnershipTasks.length === 0) return [];

    const grouped = new Map<number, { partnership: PartnershipTask['partnership'], tasks: PartnershipTask[] }>();

    partnershipTasks.forEach(task => {
      if (!task.partnership) return;
      
      const partnershipId = task.partnership.id;
      if (!grouped.has(partnershipId)) {
        grouped.set(partnershipId, {
          partnership: task.partnership,
          tasks: []
        });
      }
      grouped.get(partnershipId)!.tasks.push(task);
    });

    return Array.from(grouped.values());
  }, [partnershipTasks]);

  const toggleContactCollapse = (contactId: number) => {
    setCollapsedContacts(prev => ({
      ...prev,
      [contactId]: !prev[contactId]
    }));
  };

  const togglePartnershipCollapse = (partnershipId: number) => {
    setCollapsedPartnerships(prev => ({
      ...prev,
      [partnershipId]: !prev[partnershipId]
    }));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingState fullPage text="Loading dashboard..." />
      </div>
    );
  }

  // Calculate totals for stats cards
  const allTasks = dashboardData?.events.flatMap(e => e.tasks) || [];
  const totalTasks = allTasks.length + contactTasks.length + partnershipTasks.length;
  const pendingTasks = allTasks.filter(t => t.status === 'pending').length + contactTasks.filter(t => t.status === 'pending').length + partnershipTasks.filter(t => t.status === 'pending').length;
  const inProgressTasks = allTasks.filter(t => t.status === 'in_progress').length + contactTasks.filter(t => t.status === 'in_progress').length + partnershipTasks.filter(t => t.status === 'in_progress').length;
  const completedTasks = allTasks.filter(t => t.status === 'completed').length + contactTasks.filter(t => t.status === 'completed').length + partnershipTasks.filter(t => t.status === 'completed').length;

  return (
    <div className="p-6">
      <PageHeader
        title={t('dashboard.stakeholder.dashboard.title')}
        subtitle={dashboardData?.stakeholder?.name ? t('dashboard.stakeholder.dashboard.welcomeSubtitle', { name: dashboardData.stakeholder.name }) : t('dashboard.stakeholder.dashboard.subtitle')}
        icon={LayoutDashboard}
        iconColor="text-primary"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card data-testid="card-total-tasks">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('tasks.totalTasks')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-pending-tasks">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('tasks.pendingTasks')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pendingTasks}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-in-progress-tasks">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('tasks.inProgressTasks')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgressTasks}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-completed-tasks">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('tasks.completedTasks')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending tasks by date range */}
      <Card className="mb-6">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>{t('tasks.pending')}</CardTitle>
            <CardDescription>
              {pendingRange === 'day'
                ? t('tasks.pendingRangeDescriptionDay')
                : t('tasks.pendingRangeDescriptionWeek')}
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
          {pendingTasksLoading ? (
            <ListLoadingSkeleton count={3} />
          ) : !pendingTasksData || (pendingTasksData.departments?.[0]?.events?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{t('tasks.noTasksForEvent')}</p>
          ) : (
            <div className="space-y-4">
              {pendingTasksData.departments[0].events.map((eventGroup) => (
                <div key={eventGroup.event.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">
                      {isArabic && eventGroup.event.nameAr ? eventGroup.event.nameAr : eventGroup.event.name}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {eventGroup.tasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between rounded-md border p-3">
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
          )}
        </CardContent>
      </Card>

      {/* Filters Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <CardTitle>{t('tasks.filters')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
            <div className="flex flex-col sm:flex-row gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  {t('tasks.taskStatus')}
                </label>
                <Select
                  value={filterStatus}
                  onValueChange={(value: FilterStatus) => setFilterStatus(value)}
                >
                  <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
                    <SelectValue placeholder={t('tasks.filters')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('tasks.allTasks')}</SelectItem>
                    <SelectItem value="pending">{t('tasks.status.pending')}</SelectItem>
                    <SelectItem value="in_progress">{t('tasks.status.in_progress')}</SelectItem>
                    <SelectItem value="completed">{t('tasks.status.completed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  {t('tasks.sortBy')}
                </label>
                <Select
                  value={sortBy}
                  onValueChange={(value: SortOption) => setSortBy(value)}
                >
                  <SelectTrigger className="w-[180px]" data-testid="select-sort-by">
                    <SelectValue placeholder={t('tasks.sortBy')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="event_date">{t('tasks.sortOptions.event_date')}</SelectItem>
                    <SelectItem value="task_due_date">{t('tasks.sortOptions.task_due_date')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className="text-sm font-medium" data-testid="text-event-count">
                {t('tasks.eventsCount', { count: filteredAndSortedEvents.length })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={handleExpandAll}
                  data-testid="button-expand-all-stakeholder"
                >
                  <ChevronDown className="h-4 w-4" />
                  {t('tasks.expandAll')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-2"
                  onClick={handleCollapseAll}
                  data-testid="button-collapse-all-stakeholder"
                >
                  <ChevronUp className="h-4 w-4" />
                  {t('tasks.collapseAll')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Tasks Section - Grouped by Contact */}
      {groupedContactTasks.length > 0 && (
        <div className="space-y-4 mb-6">
          {groupedContactTasks.map(({ contact, tasks }) => {
            if (!contact) return null;
            
            const isCollapsed = collapsedContacts[contact.id] ?? false;
            const pendingCount = tasks.filter(task => task.status === 'pending').length;
            const inProgressCount = tasks.filter(task => task.status === 'in_progress').length;
            const completedCount = tasks.filter(task => task.status === 'completed').length;

            return (
              <Card key={contact.id} data-testid={`card-contact-${contact.id}`}>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Users className="h-3 w-3" />
                          {t('tasks.contactTasksLabel')}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl font-heading text-secondary">
                        {contact.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 text-sm">
                        <Target className="h-4 w-4" />
                        {t(`contacts.status.${contact.status}`)}
                      </CardDescription>
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
                      {tasks.map((task) => (
                        <Card 
                          key={task.id} 
                          className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => setSelectedContactTask(task)}
                          data-testid={`card-contact-task-${task.id}`}
                        >
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div className="flex-1 space-y-2">
                              <h5 className="font-semibold text-base">
                                {isArabic && task.titleAr ? task.titleAr : task.title}
                              </h5>
                              {(task.description || task.descriptionAr) && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {isArabic && task.descriptionAr ? task.descriptionAr : task.description}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-2 items-center">
                                <Badge className={getStatusBadgeColor(task.status)} data-testid={`badge-status-${task.id}`}>
                                  {getStatusIcon(task.status)}
                                  <span className="ml-1">{t(`tasks.status.${task.status}`)}</span>
                                </Badge>
                                {task.priority && (
                                  <Badge 
                                    variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'secondary' : 'outline'}
                                    className="gap-1 text-xs"
                                  >
                                    {t(`tasks.priority.${task.priority}`)}
                                  </Badge>
                                )}
                                {task.dueDate && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {t('tasks.dueOn', { date: format(parseISO(task.dueDate), 'MMM d, yyyy') })}
                                  </span>
                                )}
                                <Badge variant="outline" className="gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {t('tasks.commentsCount', { count: task.commentCount ?? 0 })}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedContactTask(task);
                                }}
                                data-testid={`button-view-contact-task-${task.id}`}
                              >
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
        </div>
      )}

      {/* Partnership Tasks Section - Grouped by Partnership */}
      {groupedPartnershipTasks.length > 0 && (
        <div className="space-y-4 mb-6">
          {groupedPartnershipTasks.map(({ partnership, tasks }) => {
            if (!partnership) return null;
            
            const isCollapsed = collapsedPartnerships[partnership.id] ?? false;
            const pendingCount = tasks.filter(task => task.status === 'pending').length;
            const inProgressCount = tasks.filter(task => task.status === 'in_progress').length;
            const completedCount = tasks.filter(task => task.status === 'completed').length;

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
                      {tasks.map((task) => (
                        <Card 
                          key={task.id} 
                          className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => setSelectedPartnershipTask(task)}
                          data-testid={`card-partnership-task-${task.id}`}
                        >
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div className="flex-1 space-y-2">
                              <h5 className="font-semibold text-base">
                                {isArabic && task.titleAr ? task.titleAr : task.title}
                              </h5>
                              {(task.description || task.descriptionAr) && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {isArabic && task.descriptionAr ? task.descriptionAr : task.description}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-2 items-center">
                                <Badge className={getStatusBadgeColor(task.status)} data-testid={`badge-partnership-status-${task.id}`}>
                                  {getStatusIcon(task.status)}
                                  <span className="ml-1">{t(`tasks.status.${task.status}`)}</span>
                                </Badge>
                                {task.priority && (
                                  <Badge 
                                    variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'secondary' : 'outline'}
                                    className="gap-1 text-xs"
                                  >
                                    {t(`tasks.priority.${task.priority}`)}
                                  </Badge>
                                )}
                                {task.dueDate && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {t('tasks.dueOn', { date: format(parseISO(task.dueDate), 'MMM d, yyyy') })}
                                  </span>
                                )}
                                <Badge variant="outline" className="gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {t('tasks.commentsCount', { count: task.commentCount ?? 0 })}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPartnershipTask(task);
                                }}
                                data-testid={`button-view-partnership-task-${task.id}`}
                              >
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
        </div>
      )}

      {/* Events List */}
      {filteredAndSortedEvents.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-semibold text-muted-foreground" data-testid="text-no-events">
            {t('tasks.noAssignedEvents')}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedEvents.map((de) => {
            const { pending, inProgress, completed } = getTaskCountByStatus(de.tasks);
            const totalTasksForEvent = de.tasks.length;
            const isExpanded = openEvents.includes(de.event.id);

            return (
              <Card key={de.event.id} data-testid={`card-event-${de.event.id}`}>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{t('tasks.eventTask')}</Badge>
                      </div>
                      <CardTitle className="text-xl font-heading text-secondary">
                        {isArabic && de.event.nameAr ? de.event.nameAr : de.event.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        {format(parseISO(de.event.startDate), 'MMM d, yyyy')}
                        {de.event.startDate !== de.event.endDate && (
                          <> - {format(parseISO(de.event.endDate), 'MMM d, yyyy')}</>
                        )}
                      </CardDescription>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {de.event.location && (
                          <Badge variant="outline" className="gap-1">
                            <MapPin className="h-3 w-3" />
                            {isArabic && de.event.locationAr ? de.event.locationAr : de.event.location}
                          </Badge>
                        )}
                        {de.event.category && (
                          <Badge variant="secondary">
                            {isArabic && de.event.categoryAr ? de.event.categoryAr : de.event.category}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="gap-1">
                          <FileText className="h-3 w-3" />
                          {t('tasks.taskCountLabel', { count: totalTasksForEvent })}
                        </Badge>
                        <Badge variant="outline" className="gap-1 text-orange-600 border-orange-300">
                          {t('tasks.status.pending')}: {pending}
                        </Badge>
                        <Badge variant="outline" className="gap-1 text-blue-600 border-blue-300">
                          {t('tasks.status.in_progress')}: {inProgress}
                        </Badge>
                        <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
                          {t('tasks.status.completed')}: {completed}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-2"
                      onClick={() => {
                        if (isExpanded) {
                          setOpenEvents(openEvents.filter(id => id !== de.event.id));
                        } else {
                          setOpenEvents([...openEvents, de.event.id]);
                        }
                      }}
                      data-testid={`button-expand-tasks-${de.event.id}`}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {isExpanded ? t('tasks.collapseEvent') : t('tasks.expandEvent')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!isExpanded ? (
                    <p className="text-sm text-muted-foreground text-center py-4" data-testid={`text-collapsed-${de.event.id}`}>
                      {t('tasks.eventCollapsed')}
                    </p>
                  ) : de.tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-tasks">
                      {t('tasks.noTasksForEvent')}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {de.tasks
                        .filter(task => filterStatus === 'all' || task.status === filterStatus)
                        .map((task) => (
                          <Card
                            key={task.id}
                            className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => {
                              setSelectedTask(task);
                              setSelectedEvent(de.event);
                            }}
                            data-testid={`card-task-${task.id}`}
                          >
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-start gap-3 mb-2">
                                  {getStatusIcon(task.status)}
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-base mb-1">
                                      {isArabic && task.titleAr ? task.titleAr : task.title}
                                    </h4>
                                    {(task.description || task.descriptionAr) && (
                                      <p className="text-sm text-muted-foreground line-clamp-2">
                                        {isArabic && task.descriptionAr ? task.descriptionAr : task.description}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2 mt-3">
                                  <Badge className={getStatusBadgeColor(task.status)}>
                                    {t(`tasks.status.${task.status}`)}
                                  </Badge>

                                  {task.dueDate && (
                                    <Badge variant="outline" className="gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {t('tasks.dueOn', { date: format(parseISO(task.dueDate), 'MMM d, yyyy') })}
                                    </Badge>
                                  )}

                                  <Badge variant="outline" className="gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    {t('tasks.commentsCount', { count: getCommentCount(task) })}
                                  </Badge>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTask(task);
                                    setSelectedEvent(de.event);
                                  }}
                                  data-testid={`button-view-task-${task.id}`}
                                >
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
        </div>
      )}

      {/* Task Detail Modal */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-task-details">
          {selectedTask && selectedEvent && (
            <>
                  <DialogHeader>
                    <DialogTitle className="text-2xl">
                      {isArabic && selectedTask.titleAr ? selectedTask.titleAr : selectedTask.title}
                    </DialogTitle>
                    <DialogDescription>
                  {t('tasks.eventLabel')} {isArabic && selectedEvent.nameAr ? selectedEvent.nameAr : selectedEvent.name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Task Details */}
                <div>
                  <h3 className="font-semibold mb-2">{t('tasks.fields.description')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {isArabic && selectedTask.descriptionAr ? selectedTask.descriptionAr : selectedTask.description || t('tasks.noDescription')}
                  </p>
                </div>

                {/* Status Update */}
                <div>
                  <h3 className="font-semibold mb-2">{t('tasks.updateStatus')}</h3>
                  {selectedTask.status === 'waiting' ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Select
                              value={selectedTask.status}
                              disabled={true}
                            >
                              <SelectTrigger data-testid={`select-task-status-${selectedTask.id}`} className="opacity-60 cursor-not-allowed">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="waiting">{t('tasks.status.waiting')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[250px]">
                          <p>{t('tasks.waitingDescription')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Select
                      value={selectedTask.status}
                      onValueChange={(value) => handleStatusUpdate(selectedTask.id, value)}
                      disabled={updateTaskMutation.isPending}
                    >
                      <SelectTrigger data-testid={`select-task-status-${selectedTask.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">{t('tasks.status.pending')}</SelectItem>
                        <SelectItem value="in_progress">{t('tasks.status.in_progress')}</SelectItem>
                        <SelectItem value="completed">{t('tasks.status.completed')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Task Metadata */}
                <div className="flex flex-wrap gap-2">
                  <Badge className={getStatusBadgeColor(selectedTask.status)}>
                    {t(`tasks.status.${selectedTask.status}`)}
                  </Badge>
                  {selectedTask.dueDate && (
                    <Badge variant="outline" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      {t('tasks.dueOn', { date: format(parseISO(selectedTask.dueDate), 'MMM d, yyyy') })}
                    </Badge>
                  )}
                </div>

                {/* Comments Section */}
                <div>
                  <h3 className="font-semibold mb-4">{t('tasks.comments')}</h3>

                  {comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8 bg-muted rounded-md" data-testid="text-no-comments">
                      {t('tasks.noComments')}
                    </p>
                  ) : (
                    <div className="space-y-4 mb-4">
                      {comments.map((comment) => (
                        <Card key={comment.id} className="p-4" data-testid={`card-comment-${comment.id}`}>
                          <div className="flex items-start justify-between mb-2">
                            <span className="font-semibold text-sm">
                              {comment.authorUsername || t('tasks.unknownUser')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(comment.createdAt), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {comment.body}
                          </p>
                          
                          {comment.attachments && comment.attachments.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {comment.attachments.map((attachment) => (
                                <div 
                                  key={attachment.id}
                                  className="flex items-center gap-2 text-xs bg-muted/50 p-2 rounded-md hover-elevate"
                                >
                                  {getFileIcon(attachment.mimeType)}
                                  <span className="flex-1 truncate" title={attachment.fileName}>
                                    {attachment.fileName}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {formatFileSize(attachment.fileSize)}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDownload(attachment.id, attachment.fileName)}
                                    data-testid={`button-download-${attachment.id}`}
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  {canDeleteAttachment(attachment) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteAttachment(attachment.id)}
                                      data-testid={`button-delete-attachment-${attachment.id}`}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3">
                    <Textarea
                      placeholder={t('tasks.writeComment')}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      data-testid={`textarea-comment-${selectedTask.id}`}
                      rows={3}
                    />
                    
                    {!selectedFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="button-attach-file"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        {t('tasks.attachFile')}
                      </Button>
                    )}
                    
                    {selectedFile && (
                      <div className="flex items-center gap-2 text-sm bg-muted p-2 rounded-md">
                        <Paperclip className="h-4 w-4" />
                        <span className="flex-1 truncate">{selectedFile.name}</span>
                        <span className="text-muted-foreground">{formatFileSize(selectedFile.size)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedFile(null)}
                          data-testid="button-remove-file"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.zip"
                      onChange={handleFileSelect}
                    />
                    
                    <Button
                      variant="default"
                      onClick={handleAddComment}
                      disabled={!commentText.trim() || addCommentMutation.isPending || uploadFileMutation.isPending}
                      data-testid={`button-submit-comment-${selectedTask.id}`}
                    >
                      {addCommentMutation.isPending || uploadFileMutation.isPending ? t('tasks.posting') : t('tasks.postComment')}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Task Completion Confirmation Dialog */}
      <AlertDialog open={!!taskPendingCompletion} onOpenChange={(open) => !open && setTaskPendingCompletion(null)}>
        <AlertDialogContent data-testid="dialog-confirm-task-completion">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-dialog-title">{t('tasks.confirmCompletionTitle')}</AlertDialogTitle>
            <AlertDialogDescription data-testid="text-dialog-description">
              {t('tasks.confirmCompletionMessage', { count: taskPendingCompletion?.emails.length ?? 0 })}
              <div className="mt-3 space-y-1 hidden md:block">
                {taskPendingCompletion?.emails.map((email, idx) => (
                  <div key={idx} className="text-sm font-medium text-foreground" data-testid={`text-recipient-${idx}`}>
                    • {email}
                  </div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-completion">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCompletion} data-testid="button-confirm-completion">
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Contact Task Detail Modal */}
      <Dialog open={!!selectedContactTask} onOpenChange={(open) => !open && setSelectedContactTask(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-contact-task-details">
          {selectedContactTask && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {isArabic && selectedContactTask.titleAr ? selectedContactTask.titleAr : selectedContactTask.title}
                </DialogTitle>
                <DialogDescription>
                  {selectedContactTask.contact && (
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {t('tasks.contactTasks.contactLabel')} {selectedContactTask.contact.name}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Task Details */}
                <div>
                  <h3 className="font-semibold mb-2">{t('tasks.fields.description')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {isArabic && selectedContactTask.descriptionAr ? selectedContactTask.descriptionAr : selectedContactTask.description || t('tasks.noDescription')}
                  </p>
                </div>

                {/* Status Update */}
                <div>
                  <h3 className="font-semibold mb-2">{t('tasks.updateStatus')}</h3>
                  <Select
                    value={selectedContactTask.status}
                    onValueChange={(value) => handleContactTaskStatusUpdate(selectedContactTask.id, value)}
                    disabled={updateContactTaskMutation.isPending}
                  >
                    <SelectTrigger data-testid={`select-contact-task-status-${selectedContactTask.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">{t('tasks.status.pending')}</SelectItem>
                      <SelectItem value="in_progress">{t('tasks.status.in_progress')}</SelectItem>
                      <SelectItem value="completed">{t('tasks.status.completed')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Task Metadata */}
                <div className="flex flex-wrap gap-2">
                  <Badge className={getStatusBadgeColor(selectedContactTask.status)}>
                    {t(`tasks.status.${selectedContactTask.status}`)}
                  </Badge>
                  <Badge 
                    variant="outline"
                    className={
                      selectedContactTask.priority === 'high' 
                        ? 'border-red-500 text-red-600' 
                        : selectedContactTask.priority === 'low'
                        ? 'border-gray-400 text-gray-500'
                        : 'border-yellow-500 text-yellow-600'
                    }
                  >
                    {t(`tasks.priority.${selectedContactTask.priority}`)}
                  </Badge>
                  {selectedContactTask.dueDate && (
                    <Badge variant="outline" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      {t('tasks.dueOn', { date: format(parseISO(selectedContactTask.dueDate), 'MMM d, yyyy') })}
                    </Badge>
                  )}
                </div>

                {/* Comments Section */}
                <div>
                  <h3 className="font-semibold mb-4">{t('tasks.comments')}</h3>

                  {contactTaskComments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8 bg-muted rounded-md" data-testid="text-no-contact-task-comments">
                      {t('tasks.noComments')}
                    </p>
                  ) : (
                    <div className="space-y-4 mb-4">
                      {contactTaskComments.map((comment) => (
                        <Card key={comment.id} className="p-4" data-testid={`card-contact-task-comment-${comment.id}`}>
                          <div className="flex items-start justify-between mb-2">
                            <span className="font-semibold text-sm">
                              {comment.authorUsername || t('tasks.unknownUser')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(comment.createdAt), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {comment.body}
                          </p>
                          
                          {comment.attachments && comment.attachments.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {comment.attachments.map((attachment) => (
                                <div 
                                  key={attachment.id}
                                  className="flex items-center gap-2 text-xs bg-muted/50 p-2 rounded-md hover-elevate"
                                >
                                  {getFileIcon(attachment.mimeType)}
                                  <span className="flex-1 truncate" title={attachment.fileName}>
                                    {attachment.fileName}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {formatFileSize(attachment.fileSize)}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleContactTaskDownload(attachment.id, attachment.fileName)}
                                    data-testid={`button-download-contact-${attachment.id}`}
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  {canDeleteAttachment(attachment) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteContactTaskAttachment(attachment.id)}
                                      data-testid={`button-delete-contact-attachment-${attachment.id}`}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3">
                    <Textarea
                      placeholder={t('tasks.writeComment')}
                      value={contactTaskCommentText}
                      onChange={(e) => setContactTaskCommentText(e.target.value)}
                      data-testid={`textarea-contact-task-comment-${selectedContactTask.id}`}
                      rows={3}
                    />
                    
                    {!selectedContactTaskFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => contactTaskFileInputRef.current?.click()}
                        data-testid="button-attach-contact-task-file"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        {t('tasks.attachFile')}
                      </Button>
                    )}
                    
                    {selectedContactTaskFile && (
                      <div className="flex items-center gap-2 text-sm bg-muted p-2 rounded-md">
                        <Paperclip className="h-4 w-4" />
                        <span className="flex-1 truncate">{selectedContactTaskFile.name}</span>
                        <span className="text-muted-foreground">{formatFileSize(selectedContactTaskFile.size)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedContactTaskFile(null)}
                          data-testid="button-remove-contact-task-file"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    <input
                      ref={contactTaskFileInputRef}
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.zip"
                      onChange={handleContactTaskFileSelect}
                    />
                    
                    <Button
                      variant="default"
                      onClick={handleAddContactTaskComment}
                      disabled={!contactTaskCommentText.trim() || addContactTaskCommentMutation.isPending || uploadContactTaskFileMutation.isPending}
                      data-testid={`button-submit-contact-task-comment-${selectedContactTask.id}`}
                    >
                      {addContactTaskCommentMutation.isPending || uploadContactTaskFileMutation.isPending ? t('tasks.posting') : t('tasks.postComment')}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Contact Task Completion Confirmation Dialog */}
      <AlertDialog open={!!contactTaskPendingCompletion} onOpenChange={(open) => !open && setContactTaskPendingCompletion(null)}>
        <AlertDialogContent data-testid="dialog-confirm-contact-task-completion">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tasks.confirmCompletionTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('tasks.confirmCompletionMessage', { count: contactTaskPendingCompletion?.emails.length ?? 0 })}
              <div className="mt-3 space-y-1 hidden md:block">
                {contactTaskPendingCompletion?.emails.map((email, idx) => (
                  <div key={idx} className="text-sm font-medium text-foreground">
                    • {email}
                  </div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmContactTaskCompletion}>
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Partnership Task Dialog */}
      <Dialog open={!!selectedPartnershipTask} onOpenChange={(open) => !open && setSelectedPartnershipTask(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-partnership-task">
          {selectedPartnershipTask && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Handshake className="h-3 w-3" />
                    {t('tasks.partnershipTasksLabel')}
                  </Badge>
                </div>
                <DialogTitle className="text-xl">
                  {isArabic && selectedPartnershipTask.titleAr ? selectedPartnershipTask.titleAr : selectedPartnershipTask.title}
                </DialogTitle>
                <DialogDescription>
                  {selectedPartnershipTask.partnership && (
                    <span className="text-sm">
                      {t('partnerships.partnership')}: {isArabic && selectedPartnershipTask.partnership.nameAr ? selectedPartnershipTask.partnership.nameAr : selectedPartnershipTask.partnership.nameEn}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Description */}
                {(selectedPartnershipTask.description || selectedPartnershipTask.descriptionAr) && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">{t('tasks.description')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {isArabic && selectedPartnershipTask.descriptionAr ? selectedPartnershipTask.descriptionAr : selectedPartnershipTask.description}
                    </p>
                  </div>
                )}

                {/* Status Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('tasks.updateStatus')}</label>
                  <Select
                    value={selectedPartnershipTask.status}
                    onValueChange={(value) => {
                      // Check if completing and has notification emails
                      if (value === 'completed' && selectedPartnershipTask.notificationEmails && selectedPartnershipTask.notificationEmails.length > 0) {
                        setPartnershipTaskPendingCompletion({
                          taskId: selectedPartnershipTask.id,
                          emails: selectedPartnershipTask.notificationEmails
                        });
                        return;
                      }
                      updatePartnershipTaskMutation.mutate({ taskId: selectedPartnershipTask.id, status: value });
                    }}
                    disabled={updatePartnershipTaskMutation.isPending}
                  >
                    <SelectTrigger data-testid="select-partnership-task-status">
                      <SelectValue placeholder={t('tasks.selectStatus')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">{t('tasks.status.pending')}</SelectItem>
                      <SelectItem value="in_progress">{t('tasks.status.in_progress')}</SelectItem>
                      <SelectItem value="completed">{t('tasks.status.completed')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Task Metadata */}
                <div className="flex flex-wrap gap-2">
                  <Badge className={getStatusBadgeColor(selectedPartnershipTask.status)}>
                    {t(`tasks.status.${selectedPartnershipTask.status}`)}
                  </Badge>
                  <Badge 
                    variant="outline"
                    className={
                      selectedPartnershipTask.priority === 'high' 
                        ? 'border-red-500 text-red-600' 
                        : selectedPartnershipTask.priority === 'low'
                        ? 'border-gray-400 text-gray-500'
                        : 'border-yellow-500 text-yellow-600'
                    }
                  >
                    {t(`tasks.priority.${selectedPartnershipTask.priority}`)}
                  </Badge>
                  {selectedPartnershipTask.dueDate && (
                    <Badge variant="outline" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      {t('tasks.dueOn', { date: format(parseISO(selectedPartnershipTask.dueDate), 'MMM d, yyyy') })}
                    </Badge>
                  )}
                </div>

                {/* Note: Comments for partnership tasks can be added later if needed */}
                <p className="text-sm text-muted-foreground text-center py-4 bg-muted rounded-md">
                  {t('tasks.noComments')}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Partnership Task Completion Confirmation Dialog */}
      <AlertDialog open={!!partnershipTaskPendingCompletion} onOpenChange={(open) => !open && setPartnershipTaskPendingCompletion(null)}>
        <AlertDialogContent data-testid="dialog-confirm-partnership-task-completion">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tasks.confirmCompletionTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('tasks.confirmCompletionMessage', { count: partnershipTaskPendingCompletion?.emails.length ?? 0 })}
              <div className="mt-3 space-y-1 hidden md:block">
                {partnershipTaskPendingCompletion?.emails.map((email, idx) => (
                  <div key={idx} className="text-sm font-medium text-foreground">
                    • {email}
                  </div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (partnershipTaskPendingCompletion) {
                updatePartnershipTaskMutation.mutate({ 
                  taskId: partnershipTaskPendingCompletion.taskId, 
                  status: 'completed' 
                });
                setPartnershipTaskPendingCompletion(null);
              }
            }}>
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
