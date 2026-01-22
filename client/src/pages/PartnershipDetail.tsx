import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { LoadingState, ListLoadingSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { MultiSelect } from '@/components/ui/multi-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Building,
  Calendar,
  FileText,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  ExternalLink,
  Upload,
  Download,
  Mail,
  Phone,
  Eye,
  Globe,
  MessageSquare,
  AlertTriangle,
  Settings,
  Send,
  ListTodo,
  ChevronDown,
  Paperclip,
  X,
  Image,
  Archive,
  File,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { InteractionTimeline, InteractionDialog, type BaseInteraction } from '@/components/interactions';
import AgreementAttachments from '@/components/partnerships/AgreementAttachments';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface Partnership {
  id: number;
  organizationId: number;
  organization: {
    id: number;
    nameEn: string;
    nameAr: string | null;
    countryId?: number | null;
    website?: string | null;
    country?: {
      id: number;
      code: string;
      nameEn: string;
      nameAr: string | null;
    };
  };
  partnershipType: {
    id: number;
    nameEn: string;
    nameAr: string | null;
  } | null;
  partnershipStatus: string;
  partnershipSignedDate: string | null;
  partnershipSignedByUserId: number | null;
  signedByUser: {
    id: number;
    username: string;
  } | null;
  partnershipStartDate: string | null;
  partnershipEndDate: string | null;
  partnershipNotes: string | null;
}

interface Agreement {
  id: number;
  title: string;
  agreementTypeId: number | null;
  agreementType?: {
    id: number;
    nameEn: string;
    nameAr: string | null;
  };
  signedDate: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  legalStatus: string | null;
  languages: string[] | null;
  description: string | null;
  terminationClause: string | null;
  terminationClauseAr: string | null;
  createdAt: string;
}

interface Activity {
  id: number;
  title: string;
  activityType: string;
  startDate: string | null;
  description: string | null;
  outcome: string | null;
  participants: string | null;
  linkedEventId: string | null;
  linkedEvent: {
    id: string;
    titleEn: string;
    titleAr: string | null;
  } | null;
  createdByUserId: number | null;
  createdByUser: {
    id: number;
    username: string;
  } | null;
  createdAt: string;
}

interface PartnershipContact {
  id: number;
  contactId: number;
  contact: {
    id: number;
    nameEn: string;
    nameAr: string | null;
    email: string | null;
    phone: string | null;
    position: {
      nameEn: string;
      nameAr: string | null;
    } | null;
  };
  role: string | null;
  isPrimary: boolean;
}

interface Event {
  id: string;
  name: string;
  nameAr: string | null;
  startDate: string;
}

interface AgreementType {
  id: number;
  nameEn: string;
  nameAr: string | null;
}

interface PartnershipComment {
  id: number;
  organizationId: number;
  body: string;
  bodyAr: string | null;
  authorUserId: number | null;
  authorUsername: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PartnershipTask {
  id: number;
  partnershipId: number;
  title: string;
  titleAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  departmentId: number | null;
  department?: { id: number; name: string; nameAr: string | null } | null;
  createdByUserId: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  commentCount?: number;
}

interface TaskComment {
  id: number;
  taskId: number;
  body: string;
  authorUserId: number | null;
  authorUsername?: string;
  createdAt: string;
  attachments?: TaskCommentAttachment[];
}

interface TaskCommentAttachment {
  id: number;
  commentId: number;
  objectKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

interface Department {
  id: number;
  name: string;
  nameAr: string | null;
}

const ACTIVITY_TYPES = ['meeting', 'call', 'email', 'event', 'workshop', 'training', 'site_visit', 'conference', 'publication', 'other'];
const CONTACT_ROLES = ['primary', 'secondary', 'technical', 'financial', 'legal', 'other'];

// Language codes for agreements
const LANGUAGE_OPTIONS = [
  { value: 'ar', labelKey: 'partnerships.languages.arabic' },
  { value: 'en', labelKey: 'partnerships.languages.english' },
  { value: 'fr', labelKey: 'partnerships.languages.french' },
  { value: 'es', labelKey: 'partnerships.languages.spanish' },
  { value: 'zh', labelKey: 'partnerships.languages.chinese' },
  { value: 'pt', labelKey: 'partnerships.languages.portuguese' },
  { value: 'de', labelKey: 'partnerships.languages.german' },
  { value: 'ru', labelKey: 'partnerships.languages.russian' },
  { value: 'ur', labelKey: 'partnerships.languages.urdu' },
];

export default function PartnershipDetail() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/admin/partnerships/:id');
  const partnershipId = params?.id ? parseInt(params.id) : null;
  const isArabic = i18n.language === 'ar';

  // Redirect if not admin or superadmin
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    setLocation('/');
    return null;
  }

  // State
  const [activeTab, setActiveTab] = useState('overview');
  
  // Agreement form state
  const [showAgreementDialog, setShowAgreementDialog] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<Agreement | null>(null);
  const [deletingAgreement, setDeletingAgreement] = useState<Agreement | null>(null);
  const [viewingAgreement, setViewingAgreement] = useState<Agreement | null>(null);
  const [agreementTitle, setAgreementTitle] = useState('');
  const [agreementTypeId, setAgreementTypeId] = useState<string>('');
  const [agreementSignedDate, setAgreementSignedDate] = useState('');
  const [agreementEffectiveDate, setAgreementEffectiveDate] = useState('');
  const [agreementExpiryDate, setAgreementExpiryDate] = useState('');
  const [agreementDescription, setAgreementDescription] = useState('');
  const [agreementLegalStatus, setAgreementLegalStatus] = useState<string>('');
  const [agreementLanguages, setAgreementLanguages] = useState<string[]>([]);
  const [agreementTerminationClause, setAgreementTerminationClause] = useState('');
  const [agreementTerminationClauseAr, setAgreementTerminationClauseAr] = useState('');

  // Activity form state
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null);
  const [activityTitle, setActivityTitle] = useState('');
  const [activityType, setActivityType] = useState('meeting');
  const [activityDate, setActivityDate] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityOutcome, setActivityOutcome] = useState('');
  const [activityParticipants, setActivityParticipants] = useState('');
  const [linkedEventId, setLinkedEventId] = useState<string | null>(null);

  // Contact form state
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [deletingContact, setDeletingContact] = useState<PartnershipContact | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [contactRole, setContactRole] = useState('primary');
  const [contactIsPrimary, setContactIsPrimary] = useState(false);

  // Comment state
  const [commentBody, setCommentBody] = useState('');
  const [commentBodyAr, setCommentBodyAr] = useState('');
  const [editingComment, setEditingComment] = useState<PartnershipComment | null>(null);
  const [deletingComment, setDeletingComment] = useState<PartnershipComment | null>(null);

  // Interaction state
  const [showInteractionDialog, setShowInteractionDialog] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<BaseInteraction | null>(null);
  const [deletingInteraction, setDeletingInteraction] = useState<BaseInteraction | null>(null);

  // Task state
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<PartnershipTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<PartnershipTask | null>(null);
  const [viewingTask, setViewingTask] = useState<PartnershipTask | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskTitleAr, setTaskTitleAr] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDescriptionAr, setTaskDescriptionAr] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskDepartmentId, setTaskDepartmentId] = useState<number | null>(null);
  
  // Task comment state
  const [taskCommentText, setTaskCommentText] = useState('');
  const [selectedTaskFile, setSelectedTaskFile] = useState<File | null>(null);
  const taskFileInputRef = useRef<HTMLInputElement>(null);

  // Inactivity settings state
  const [showInactivityDialog, setShowInactivityDialog] = useState(false);
  const [inactivityThreshold, setInactivityThreshold] = useState<number>(6);
  const [notifyOnInactivity, setNotifyOnInactivity] = useState<boolean>(true);

  // Queries
  const { data: partnership, isLoading: isLoadingPartnership } = useQuery<Partnership>({
    queryKey: [`/api/partnerships/${partnershipId}`],
    enabled: !!partnershipId,
  });

  const { data: agreements, isLoading: isLoadingAgreements } = useQuery<Agreement[]>({
    queryKey: [`/api/partnerships/${partnershipId}/agreements`],
    enabled: !!partnershipId,
  });

  const { data: activities, isLoading: isLoadingActivities } = useQuery<Activity[]>({
    queryKey: [`/api/partnerships/${partnershipId}/activities`],
    enabled: !!partnershipId,
  });

  const { data: partnershipContacts, isLoading: isLoadingContacts } = useQuery<PartnershipContact[]>({
    queryKey: [`/api/partnerships/${partnershipId}/contacts`],
    enabled: !!partnershipId,
  });

  // Interactions query
  const { data: interactions, isLoading: isLoadingInteractions } = useQuery<BaseInteraction[]>({
    queryKey: [`/api/partnerships/${partnershipId}/interactions`],
    enabled: !!partnershipId,
  });

  // Tasks query
  const { data: partnershipTasks, isLoading: isLoadingTasks } = useQuery<PartnershipTask[]>({
    queryKey: [`/api/partnerships/${partnershipId}/tasks`],
    enabled: !!partnershipId,
  });

  // Departments query (for task assignment)
  const { data: departments } = useQuery<Department[]>({
    queryKey: ['/api/stakeholders'],
  });

  // Inactivity data query
  interface InactivityData {
    id: number;
    nameEn: string;
    nameAr: string | null;
    lastActivityDate: string | null;
    daysSinceLastActivity: number | null;
    inactivityThresholdMonths: number;
    notifyOnInactivity: boolean;
    lastInactivityNotificationSent: string | null;
    isInactive: boolean;
  }

  const { data: inactivityData, isLoading: isLoadingInactivity } = useQuery<InactivityData>({
    queryKey: [`/api/partnerships/${partnershipId}/inactivity`],
    enabled: !!partnershipId,
  });

  const { data: contactsResponse } = useQuery<{ contacts: any[]; total: number }>({
    queryKey: ['/api/contacts', partnership?.organizationId],
    queryFn: async () => {
      if (!partnership?.organizationId) return { contacts: [], total: 0 };
      const response = await fetch(`/api/contacts?limit=1000&organizationId=${partnership.organizationId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch contacts');
      return response.json();
    },
    enabled: !!partnership?.organizationId,
  });

  const allContacts = contactsResponse?.contacts || [];

  const { data: events } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  const { data: agreementTypes } = useQuery<AgreementType[]>({
    queryKey: ['/api/agreement-types'],
  });

  const { data: comments, isLoading: isLoadingComments } = useQuery<PartnershipComment[]>({
    queryKey: [`/api/partnerships/${partnershipId}/comments`],
    enabled: !!partnershipId,
  });

  // Agreement mutations
  const createAgreementMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/partnerships/${partnershipId}/agreements`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/agreements`] });
      toast({ description: t('partnerships.messages.agreementCreated') });
      resetAgreementForm();
      setShowAgreementDialog(false);
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  const updateAgreementMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest('PUT', `/api/partnerships/${partnershipId}/agreements/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/agreements`] });
      toast({ description: t('partnerships.messages.agreementUpdated') });
      resetAgreementForm();
      setShowAgreementDialog(false);
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  const deleteAgreementMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/partnerships/${partnershipId}/agreements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/agreements`] });
      toast({ description: t('partnerships.messages.agreementDeleted') });
      setDeletingAgreement(null);
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  // Activity mutations
  const createActivityMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/partnerships/${partnershipId}/activities`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/activities`] });
      toast({ description: t('partnerships.messages.activityCreated') });
      resetActivityForm();
      setShowActivityDialog(false);
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest('PUT', `/api/partnerships/${partnershipId}/activities/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/activities`] });
      toast({ description: t('partnerships.messages.activityUpdated') });
      resetActivityForm();
      setShowActivityDialog(false);
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/partnerships/${partnershipId}/activities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/activities`] });
      toast({ description: t('partnerships.messages.activityDeleted') });
      setDeletingActivity(null);
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  // Contact mutations
  const addContactMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/partnerships/${partnershipId}/contacts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/contacts`] });
      toast({ description: t('partnerships.messages.contactAdded') });
      resetContactForm();
      setShowContactDialog(false);
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  const removeContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      return apiRequest('DELETE', `/api/partnerships/${partnershipId}/contacts/${contactId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/contacts`] });
      toast({ description: t('partnerships.messages.contactRemoved') });
      setDeletingContact(null);
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  // Comment mutations
  const createCommentMutation = useMutation({
    mutationFn: async (data: { body: string; bodyAr?: string }) => {
      return apiRequest('POST', `/api/partnerships/${partnershipId}/comments`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/comments`] });
      toast({ description: t('partnerships.messages.commentCreated') });
      setCommentBody('');
      setCommentBodyAr('');
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { body: string; bodyAr?: string } }) => {
      return apiRequest('PUT', `/api/partnerships/${partnershipId}/comments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/comments`] });
      toast({ description: t('partnerships.messages.commentUpdated') });
      setEditingComment(null);
      setCommentBody('');
      setCommentBodyAr('');
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/partnerships/${partnershipId}/comments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/comments`] });
      toast({ description: t('partnerships.messages.commentDeleted') });
      setDeletingComment(null);
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  // Interaction delete mutation
  const deleteInteractionMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/partnership-interactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/interactions`] });
      toast({ description: t('partnerships.messages.interactionDeleted') });
      setDeletingInteraction(null);
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  // Task mutations
  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/partnerships/${partnershipId}/tasks`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/tasks`] });
      toast({ description: t('partnerships.messages.taskCreated') });
      resetTaskForm();
      setShowTaskDialog(false);
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest('PATCH', `/api/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/tasks`] });
      toast({ description: t('partnerships.messages.taskUpdated') });
      resetTaskForm();
      setShowTaskDialog(false);
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/tasks`] });
      toast({ description: t('partnerships.messages.taskDeleted') });
      setDeletingTask(null);
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (task: PartnershipTask) => {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      return apiRequest('PATCH', `/api/tasks/${task.id}`, { status: newStatus });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/tasks`] });
      toast({ 
        description: data.status === 'completed' 
          ? t('partnerships.messages.taskCompleted') 
          : t('partnerships.messages.taskReopened') 
      });
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  // Task comments query
  const { data: taskComments = [], isLoading: isLoadingTaskComments } = useQuery<TaskComment[]>({
    queryKey: ['/api/tasks', viewingTask?.id, 'comments'],
    queryFn: async () => {
      if (!viewingTask?.id) return [];
      const response = await apiRequest('GET', `/api/tasks/${viewingTask.id}/comments`);
      return response;
    },
    enabled: !!viewingTask?.id,
  });

  // Task comment mutations
  const createTaskCommentMutation = useMutation({
    mutationFn: async ({ taskId, content, file }: { taskId: number; content: string; file?: File }) => {
      const formData = new FormData();
      formData.append('body', content);
      if (file) {
        formData.append('attachment', file);
      }
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
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
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', viewingTask?.id, 'comments'] });
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/tasks`] });
      setTaskCommentText('');
      setSelectedTaskFile(null);
      if (taskFileInputRef.current) {
        taskFileInputRef.current.value = '';
      }
      toast({ description: t('tasks.messages.commentAdded') });
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  const deleteTaskCommentMutation = useMutation({
    mutationFn: async ({ taskId, commentId }: { taskId: number; commentId: number }) => {
      await apiRequest('DELETE', `/api/tasks/${taskId}/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', viewingTask?.id, 'comments'] });
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/tasks`] });
      toast({ description: t('tasks.messages.commentDeleted') });
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  // Inactivity settings mutation
  const updateInactivitySettingsMutation = useMutation({
    mutationFn: async (data: { inactivityThresholdMonths?: number; notifyOnInactivity?: boolean }) => {
      return apiRequest('PUT', `/api/partnerships/${partnershipId}/inactivity-settings`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partnerships/${partnershipId}/inactivity`] });
      toast({ description: t('partnerships.messages.inactivitySettingsUpdated') });
      setShowInactivityDialog(false);
    },
    onError: (error: any) => {
      toast({ description: error.message || t('common.error'), variant: 'destructive' });
    },
  });

  // Helper functions
  const resetAgreementForm = () => {
    setAgreementTitle('');
    setAgreementTypeId('');
    setAgreementSignedDate('');
    setAgreementEffectiveDate('');
    setAgreementExpiryDate('');
    setAgreementDescription('');
    setAgreementLegalStatus('');
    setAgreementLanguages([]);
    setAgreementTerminationClause('');
    setAgreementTerminationClauseAr('');
    setEditingAgreement(null);
  };

  const resetActivityForm = () => {
    setActivityTitle('');
    setActivityType('meeting');
    setActivityDate('');
    setActivityDescription('');
    setActivityOutcome('');
    setActivityParticipants('');
    setLinkedEventId(null);
    setEditingActivity(null);
  };

  const resetContactForm = () => {
    setSelectedContactId(null);
    setContactRole('primary');
    setContactIsPrimary(false);
  };

  const resetTaskForm = () => {
    setTaskTitle('');
    setTaskTitleAr('');
    setTaskDescription('');
    setTaskDescriptionAr('');
    setTaskDueDate('');
    setTaskPriority('medium');
    setTaskDepartmentId(null);
    setEditingTask(null);
  };

  const getPriorityBadgeVariant = (priority: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const handleAddTaskComment = () => {
    if (!viewingTask?.id || (!taskCommentText.trim() && !selectedTaskFile)) return;
    createTaskCommentMutation.mutate({
      taskId: viewingTask.id,
      content: taskCommentText.trim(),
      file: selectedTaskFile || undefined,
    });
  };

  const handleOpenTaskDialog = (task?: PartnershipTask) => {
    if (task) {
      setEditingTask(task);
      setTaskTitle(task.title);
      setTaskTitleAr(task.titleAr || '');
      setTaskDescription(task.description || '');
      setTaskDescriptionAr(task.descriptionAr || '');
      setTaskDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
      setTaskPriority(task.priority);
      setTaskDepartmentId(task.departmentId);
    } else {
      resetTaskForm();
    }
    setShowTaskDialog(true);
  };

  const handleSubmitTask = () => {
    if (!taskTitle.trim()) {
      toast({ description: t('common.required'), variant: 'destructive' });
      return;
    }

    const data = {
      title: taskTitle.trim(),
      titleAr: taskTitleAr.trim() || null,
      description: taskDescription.trim() || null,
      descriptionAr: taskDescriptionAr.trim() || null,
      dueDate: taskDueDate || null,
      priority: taskPriority,
      departmentId: taskDepartmentId,
      status: 'pending',
    };

    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, data });
    } else {
      createTaskMutation.mutate(data);
    }
  };

  const handleOpenAgreementDialog = (agreement?: Agreement) => {
    if (agreement) {
      setEditingAgreement(agreement);
      setAgreementTitle(agreement.title);
      setAgreementTypeId(agreement.agreementTypeId ? String(agreement.agreementTypeId) : '');
      setAgreementSignedDate(agreement.signedDate ? agreement.signedDate.split('T')[0] : '');
      setAgreementEffectiveDate(agreement.effectiveDate ? agreement.effectiveDate.split('T')[0] : '');
      setAgreementExpiryDate(agreement.expiryDate ? agreement.expiryDate.split('T')[0] : '');
      setAgreementDescription(agreement.description || '');
      setAgreementLegalStatus(agreement.legalStatus || '');
      setAgreementLanguages(agreement.languages || []);
      setAgreementTerminationClause(agreement.terminationClause || '');
      setAgreementTerminationClauseAr(agreement.terminationClauseAr || '');
    } else {
      resetAgreementForm();
    }
    setShowAgreementDialog(true);
  };

  const handleOpenActivityDialog = (activity?: Activity) => {
    if (activity) {
      setEditingActivity(activity);
      setActivityTitle(activity.title || '');
      setActivityType(activity.activityType);
      setActivityDate(activity.startDate ? activity.startDate.split('T')[0] : '');
      setActivityDescription(activity.description || '');
      setActivityOutcome(activity.outcome || '');
      setActivityParticipants(activity.participants || '');
      setLinkedEventId(activity.linkedEventId);
    } else {
      resetActivityForm();
      setActivityDate(new Date().toISOString().split('T')[0]);
    }
    setShowActivityDialog(true);
  };

  const handleSubmitAgreement = () => {
    if (!agreementTitle) {
      toast({ 
        description: t('partnerships.agreements.agreementTitle') + ': ' + t('common.required'), 
        variant: 'destructive' 
      });
      return;
    }

    const data = {
      title: agreementTitle,
      agreementTypeId: agreementTypeId ? parseInt(agreementTypeId) : null,
      signedDate: agreementSignedDate || null,
      effectiveDate: agreementEffectiveDate || null,
      expiryDate: agreementExpiryDate || null,
      description: agreementDescription || null,
      legalStatus: agreementLegalStatus || null,
      languages: agreementLanguages.length > 0 ? agreementLanguages : null,
      terminationClause: agreementTerminationClause || null,
      terminationClauseAr: agreementTerminationClauseAr || null,
    };

    if (editingAgreement) {
      updateAgreementMutation.mutate({ id: editingAgreement.id, data });
    } else {
      createAgreementMutation.mutate(data);
    }
  };

  const handleSubmitActivity = () => {
    if (!activityDate || !activityTitle.trim()) {
      toast({ description: t('common.required'), variant: 'destructive' });
      return;
    }

    const data = {
      title: activityTitle,
      activityType,
      startDate: activityDate,
      description: activityDescription || null,
      outcome: activityOutcome || null,
      participants: activityParticipants || null,
      eventId: linkedEventId || null,
    };

    if (editingActivity) {
      updateActivityMutation.mutate({ id: editingActivity.id, data });
    } else {
      createActivityMutation.mutate(data);
    }
  };

  const handleSubmitContact = () => {
    if (!selectedContactId) {
      toast({ description: t('common.required'), variant: 'destructive' });
      return;
    }

    addContactMutation.mutate({
      contactId: selectedContactId,
      role: contactRole,
      isPrimary: contactIsPrimary,
    });
  };

  const handleSubmitComment = () => {
    if (!commentBody.trim()) {
      toast({ description: t('common.required'), variant: 'destructive' });
      return;
    }

    if (editingComment) {
      updateCommentMutation.mutate({
        id: editingComment.id,
        data: {
          body: commentBody.trim(),
          bodyAr: commentBodyAr.trim() || undefined,
        },
      });
    } else {
      createCommentMutation.mutate({
        body: commentBody.trim(),
        bodyAr: commentBodyAr.trim() || undefined,
      });
    }
  };

  const handleOpenInactivityDialog = () => {
    if (inactivityData) {
      setInactivityThreshold(inactivityData.inactivityThresholdMonths || 6);
      setNotifyOnInactivity(inactivityData.notifyOnInactivity ?? true);
    }
    setShowInactivityDialog(true);
  };

  const handleSubmitInactivitySettings = () => {
    updateInactivitySettingsMutation.mutate({
      inactivityThresholdMonths: inactivityThreshold,
      notifyOnInactivity,
    });
  };

  const handleEditComment = (comment: PartnershipComment) => {
    setEditingComment(comment);
    setCommentBody(comment.body);
    setCommentBodyAr(comment.bodyAr || '');
  };

  const handleCancelEditComment = () => {
    setEditingComment(null);
    setCommentBody('');
    setCommentBodyAr('');
  };

  const formatCommentDate = (dateString: string) => {
    const date = parseISO(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return t('partnerships.comments.justNow');
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return format(date, 'MMM d, yyyy');
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'expired':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!partnershipId) {
    return <div>Invalid partnership ID</div>;
  }

  if (isLoadingPartnership) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <LoadingState fullPage text="Loading partnership..." />
      </div>
    );
  }

  if (!partnership) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('partnerships.noPartnershipsFound')}</p>
        </div>
      </div>
    );
  }

  const daysActive = partnership.partnershipStartDate
    ? differenceInDays(new Date(), parseISO(partnership.partnershipStartDate))
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/admin/partnerships')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Building className="h-8 w-8 text-muted-foreground" />
            <div>
              <h1 className="text-2xl font-bold">
                {isArabic ? partnership.organization.nameAr || partnership.organization.nameEn : partnership.organization.nameEn}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusBadgeColor(partnership.partnershipStatus)}>
                  {t(`partnerships.statuses.${partnership.partnershipStatus}`)}
                </Badge>
                {partnership.partnershipType && (
                  <Badge variant="outline">
                    {isArabic ? partnership.partnershipType.nameAr || partnership.partnershipType.nameEn : partnership.partnershipType.nameEn}
                  </Badge>
                )}
                {partnership.organization.country && (
                  <Badge variant="outline">
                    {isArabic && partnership.organization.country.nameAr 
                      ? partnership.organization.country.nameAr 
                      : partnership.organization.country.nameEn}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('partnerships.overview.daysActive')}</p>
                <p className="text-2xl font-bold">{daysActive}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('partnerships.overview.activeAgreements')}</p>
                <p className="text-2xl font-bold">{agreements?.length || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('partnerships.overview.totalActivities')}</p>
                <p className="text-2xl font-bold">{activities?.length || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('partnerships.contacts.title')}</p>
                <p className="text-2xl font-bold">{partnershipContacts?.length || 0}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        {/* Activity Status Card */}
        <Card 
          className={cn(
            "cursor-pointer hover:bg-accent/50 transition-colors",
            inactivityData?.isInactive && "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/50"
          )}
          onClick={handleOpenInactivityDialog}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('partnerships.inactivity.activityStatus')}
                </p>
                {inactivityData?.daysSinceLastActivity !== null ? (
                  <div className="flex items-center gap-1">
                    <p className={cn(
                      "text-2xl font-bold",
                      inactivityData?.isInactive ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                    )}>
                      {inactivityData?.daysSinceLastActivity || 0}
                    </p>
                    <span className="text-sm text-muted-foreground">
                      {isArabic ? 'يوم' : 'days'}
                    </span>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">-</p>
                )}
              </div>
              {inactivityData?.isInactive ? (
                <AlertTriangle className="h-8 w-8 text-red-500" />
              ) : (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              )}
            </div>
            {inactivityData?.isInactive && (
              <Badge variant="outline" className="mt-2 w-full justify-center text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
                {t('partnerships.inactivity.inactive')}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">{t('partnerships.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="agreements">{t('partnerships.tabs.agreements')}</TabsTrigger>
          <TabsTrigger value="activities">{t('partnerships.tabs.activities')}</TabsTrigger>
          <TabsTrigger value="interactions">{t('partnerships.tabs.interactions')}</TabsTrigger>
          <TabsTrigger value="tasks">{t('partnerships.tabs.tasks')}</TabsTrigger>
          <TabsTrigger value="contacts">{t('partnerships.tabs.contacts')}</TabsTrigger>
          <TabsTrigger value="comments">{t('partnerships.tabs.comments')}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('partnerships.overview.partnershipDetails')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('partnerships.fields.signedDate')}</p>
                    <p className="font-medium">
                      {partnership.partnershipSignedDate
                        ? format(parseISO(partnership.partnershipSignedDate), 'PPP')
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('partnerships.fields.startDate')}</p>
                    <p className="font-medium">
                      {partnership.partnershipStartDate
                        ? format(parseISO(partnership.partnershipStartDate), 'PPP')
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('partnerships.fields.endDate')}</p>
                    <p className="font-medium">
                      {partnership.partnershipEndDate
                        ? format(parseISO(partnership.partnershipEndDate), 'PPP')
                        : t('partnerships.overview.neverExpires')}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('partnerships.fields.signedBy')}</p>
                    <p className="font-medium">{partnership.signedByUser?.username || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('partnerships.fields.website')}</p>
                    {partnership.organization.website ? (
                      <a
                        href={partnership.organization.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-primary hover:underline font-medium"
                      >
                        <Globe className="h-4 w-4" />
                        {partnership.organization.website.replace(/^https?:\/\//, '')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <p className="font-medium">-</p>
                    )}
                  </div>
                  {partnership.partnershipNotes && (
                    <div>
                      <p className="text-sm text-muted-foreground">{t('partnerships.fields.notes')}</p>
                      <p className="text-sm">{partnership.partnershipNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agreements Tab */}
        <TabsContent value="agreements" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => handleOpenAgreementDialog()}>
              <Plus className="me-2 h-4 w-4" />
              {t('partnerships.agreements.addAgreement')}
            </Button>
          </div>
          
          {isLoadingAgreements ? (
            <ListLoadingSkeleton count={3} />
          ) : agreements?.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t('partnerships.empty.noAgreements')}
              variant="bordered"
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('partnerships.agreements.agreementTitle')}</TableHead>
                    <TableHead>{t('partnerships.agreements.agreementType')}</TableHead>
                    <TableHead>{t('partnerships.agreements.legalStatus')}</TableHead>
                    <TableHead>{t('partnerships.agreements.languages')}</TableHead>
                    <TableHead>{t('partnerships.agreements.effectiveDate')}</TableHead>
                    <TableHead>{t('partnerships.agreements.expiryDate')}</TableHead>
                    <TableHead className="text-end">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agreements?.map((agreement) => (
                    <TableRow key={agreement.id}>
                      <TableCell className="font-medium">{agreement.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {agreement.agreementType 
                            ? (isArabic && agreement.agreementType.nameAr ? agreement.agreementType.nameAr : agreement.agreementType.nameEn)
                            : '-'
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {agreement.legalStatus ? (
                          <Badge variant={agreement.legalStatus === 'binding' ? 'default' : 'secondary'}>
                            {t(`partnerships.agreements.legalStatuses.${agreement.legalStatus}`)}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {agreement.languages && agreement.languages.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {agreement.languages.map((lang) => {
                              const langOption = LANGUAGE_OPTIONS.find(opt => opt.value === lang);
                              return (
                                <Badge key={lang} variant="outline" className="text-xs">
                                  {langOption ? t(langOption.labelKey) : lang.toUpperCase()}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {agreement.effectiveDate
                          ? format(parseISO(agreement.effectiveDate), 'PP')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {agreement.expiryDate
                          ? format(parseISO(agreement.expiryDate), 'PP')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewingAgreement(agreement)}
                            title={t('common.view')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenAgreementDialog(agreement)}
                            title={t('common.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingAgreement(agreement)}
                            title={t('common.delete')}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => handleOpenActivityDialog()}>
              <Plus className="me-2 h-4 w-4" />
              {t('partnerships.activities.addActivity')}
            </Button>
          </div>
          
          {isLoadingActivities ? (
            <ListLoadingSkeleton count={3} />
          ) : activities?.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title={t('partnerships.empty.noActivities')}
              variant="bordered"
            />
          ) : (
            <div className="space-y-4">
              {activities?.map((activity) => (
                <Card key={activity.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-muted rounded-full">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {t(`partnerships.activities.types.${activity.activityType}`)}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {activity.startDate ? format(parseISO(activity.startDate), 'PPP') : '-'}
                            </span>
                          </div>
                          {activity.description && (
                            <p className="mt-2 text-sm">{activity.description}</p>
                          )}
                          {activity.outcome && (
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground">{t('partnerships.activities.outcome')}</p>
                              <p className="text-sm">{activity.outcome}</p>
                            </div>
                          )}
                          {activity.linkedEvent && (
                            <div className="mt-2">
                              <Badge variant="secondary" className="text-xs">
                                <ExternalLink className="me-1 h-3 w-3" />
                                {isArabic ? activity.linkedEvent.titleAr || activity.linkedEvent.titleEn : activity.linkedEvent.titleEn}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenActivityDialog(activity)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingActivity(activity)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Interactions Tab */}
        <TabsContent value="interactions" className="space-y-4">
          <InteractionTimeline
            interactions={interactions || []}
            entityType="partnership"
            entityId={partnershipId}
            isLoading={isLoadingInteractions}
            onAddInteraction={() => setShowInteractionDialog(true)}
            onEditInteraction={(interaction) => {
              setEditingInteraction(interaction);
              setShowInteractionDialog(true);
            }}
            onDeleteInteraction={(interaction) => setDeletingInteraction(interaction)}
          />
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">{t('partnerships.tasks.title')}</h3>
            <Button size="sm" onClick={() => setShowTaskDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('partnerships.tasks.addTask')}
            </Button>
          </div>
          
          {isLoadingTasks ? (
            <ListLoadingSkeleton count={3} />
          ) : partnershipTasks?.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t('partnerships.tasks.noTasks')}
            />
          ) : (
            <div className="space-y-2">
              {partnershipTasks?.map((task) => {
                const taskDescription = isArabic && task.descriptionAr ? task.descriptionAr : task.description;
                return (
                <Card key={task.id} className={cn("p-4", task.status === 'completed' && "opacity-60")}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={task.status === 'completed'}
                      onCheckedChange={() => toggleTaskMutation.mutate(task)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "font-medium",
                          task.status === 'completed' && "line-through"
                        )}>
                          {isArabic && task.titleAr ? task.titleAr : task.title}
                        </span>
                        <Badge variant={getPriorityBadgeVariant(task.priority)}>
                          {t(`partnerships.tasks.priorities.${task.priority}`)}
                        </Badge>
                        <Badge variant="outline">
                          {t(`partnerships.tasks.statuses.${task.status}`)}
                        </Badge>
                      </div>
                      {taskDescription && (
                        taskDescription.length > 100 ? (
                          <Collapsible className="mt-1">
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {taskDescription.slice(0, 100)}...
                            </div>
                            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                              <span>{t('common.showMore')}</span>
                              <ChevronDown className="h-3 w-3" />
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                                {taskDescription.slice(100)}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{taskDescription}</p>
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
                            {isArabic && task.department.nameAr ? task.department.nameAr : task.department.name}
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
                        onClick={() => handleOpenTaskDialog(task)}
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
              )})}
            </div>
          )}
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowContactDialog(true)}>
              <Plus className="me-2 h-4 w-4" />
              {t('partnerships.contacts.addContact')}
            </Button>
          </div>
          
          {isLoadingContacts ? (
            <ListLoadingSkeleton count={3} />
          ) : partnershipContacts?.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t('partnerships.empty.noContacts')}
              variant="bordered"
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('partnerships.contacts.name')}</TableHead>
                      <TableHead>{t('partnerships.contacts.position')}</TableHead>
                      <TableHead>{t('partnerships.contacts.contact')}</TableHead>
                      <TableHead>{t('partnerships.contacts.role')}</TableHead>
                      <TableHead>{t('partnerships.contacts.status')}</TableHead>
                      <TableHead className="text-end">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnershipContacts?.map((pc) => (
                      <TableRow key={pc.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="font-medium">
                              {isArabic ? pc.contact.nameAr || pc.contact.nameEn : pc.contact.nameEn}
                            </div>
                            {pc.isPrimary && (
                              <Badge variant="default" className="text-xs">
                                {t('partnerships.contacts.isPrimary')}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {pc.contact.position ? (
                            <span className="text-sm">
                              {isArabic ? pc.contact.position.nameAr || pc.contact.position.nameEn : pc.contact.position.nameEn}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {pc.contact.email && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                <a href={`mailto:${pc.contact.email}`} className="hover:underline">
                                  {pc.contact.email}
                                </a>
                              </div>
                            )}
                            {pc.contact.phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                <a href={`tel:${pc.contact.phone}`} className="hover:underline">
                                  {pc.contact.phone}
                                </a>
                              </div>
                            )}
                            {!pc.contact.email && !pc.contact.phone && (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {pc.role ? (
                            <Badge variant="outline" className="text-xs">
                              {t(`partnerships.contacts.roles.${pc.role}`)}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {t('common.active')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingContact(pc)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="space-y-4">
          {/* Comment Input */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder={t('partnerships.comments.placeholder')}
                    className="min-h-[100px]"
                  />
                </div>
                {isArabic && (
                  <div className="space-y-2">
                    <Textarea
                      value={commentBodyAr}
                      onChange={(e) => setCommentBodyAr(e.target.value)}
                      placeholder={t('partnerships.comments.placeholderAr')}
                      className="min-h-[80px]"
                      dir="rtl"
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  {editingComment && (
                    <Button variant="outline" onClick={handleCancelEditComment}>
                      {t('common.cancel')}
                    </Button>
                  )}
                  <Button
                    onClick={handleSubmitComment}
                    disabled={!commentBody.trim() || createCommentMutation.isPending || updateCommentMutation.isPending}
                  >
                    <Send className="me-2 h-4 w-4" />
                    {editingComment ? t('common.save') : t('partnerships.comments.addComment')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comments List */}
          {isLoadingComments ? (
            <ListLoadingSkeleton count={3} />
          ) : comments?.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={t('partnerships.empty.noComments')}
              variant="bordered"
            />
          ) : (
            <div className="space-y-4">
              {comments?.map((comment) => (
                <Card key={comment.id} className={cn(
                  editingComment?.id === comment.id && "ring-2 ring-primary"
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <span className="font-medium text-foreground">
                            {comment.authorUsername || t('common.unknown')}
                          </span>
                          <span>•</span>
                          <span title={format(parseISO(comment.createdAt), 'PPpp')}>
                            {formatCommentDate(comment.createdAt)}
                          </span>
                          {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                            <>
                              <span>•</span>
                              <span className="italic">({t('partnerships.comments.edited')})</span>
                            </>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap">{isArabic && comment.bodyAr ? comment.bodyAr : comment.body}</p>
                        {!isArabic && comment.bodyAr && (
                          <p className="mt-2 text-muted-foreground text-sm whitespace-pre-wrap" dir="rtl">
                            {comment.bodyAr}
                          </p>
                        )}
                      </div>
                      {(user?.role === 'superadmin' || comment.authorUserId === user?.id) && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditComment(comment)}
                            disabled={editingComment?.id === comment.id}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingComment(comment)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Agreement Details View Dialog */}
      <Dialog open={!!viewingAgreement} onOpenChange={(open) => !open && setViewingAgreement(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {viewingAgreement?.title}
            </DialogTitle>
          </DialogHeader>

          {viewingAgreement && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('partnerships.agreements.agreementType')}</p>
                  <p className="font-medium">
                    {viewingAgreement.agreementType 
                      ? (isArabic && viewingAgreement.agreementType.nameAr 
                          ? viewingAgreement.agreementType.nameAr 
                          : viewingAgreement.agreementType.nameEn)
                      : '-'
                    }
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('partnerships.agreements.legalStatus')}</p>
                  <p className="font-medium">
                    {viewingAgreement.legalStatus 
                      ? t(`partnerships.agreements.legalStatuses.${viewingAgreement.legalStatus}`)
                      : '-'
                    }
                  </p>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('partnerships.agreements.signedDate')}</p>
                  <p className="font-medium">
                    {viewingAgreement.signedDate 
                      ? format(parseISO(viewingAgreement.signedDate), 'PPP')
                      : '-'
                    }
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('partnerships.agreements.effectiveDate')}</p>
                  <p className="font-medium">
                    {viewingAgreement.effectiveDate 
                      ? format(parseISO(viewingAgreement.effectiveDate), 'PPP')
                      : '-'
                    }
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('partnerships.agreements.expiryDate')}</p>
                  <p className="font-medium">
                    {viewingAgreement.expiryDate 
                      ? format(parseISO(viewingAgreement.expiryDate), 'PPP')
                      : t('partnerships.overview.neverExpires')
                    }
                  </p>
                </div>
              </div>

              {/* Languages */}
              {viewingAgreement.languages && viewingAgreement.languages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{t('partnerships.agreements.languages')}</p>
                  <div className="flex flex-wrap gap-2">
                    {viewingAgreement.languages.map((lang) => {
                      const langOption = LANGUAGE_OPTIONS.find(opt => opt.value === lang);
                      return (
                        <Badge key={lang} variant="secondary">
                          {langOption ? t(langOption.labelKey) : lang.toUpperCase()}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description */}
              {viewingAgreement.description && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{t('partnerships.agreements.description')}</p>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{viewingAgreement.description}</p>
                  </div>
                </div>
              )}

              {/* Termination Clause - English */}
              {viewingAgreement.terminationClause && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{t('partnerships.agreements.terminationClause')}</p>
                  <div className="p-3 bg-muted rounded-md border-l-4 border-amber-500">
                    <p className="text-sm whitespace-pre-wrap">{viewingAgreement.terminationClause}</p>
                  </div>
                </div>
              )}

              {/* Termination Clause - Arabic */}
              {viewingAgreement.terminationClauseAr && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{t('partnerships.agreements.terminationClauseAr')}</p>
                  <div className="p-3 bg-muted rounded-md border-r-4 border-amber-500" dir="rtl">
                    <p className="text-sm whitespace-pre-wrap">{viewingAgreement.terminationClauseAr}</p>
                  </div>
                </div>
              )}

              {/* Attachments */}
              <AgreementAttachments 
                agreementId={viewingAgreement.id} 
                agreementTitle={viewingAgreement.title} 
              />

              {/* Created At */}
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  {t('common.createdAt')}: {format(parseISO(viewingAgreement.createdAt), 'PPP')}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingAgreement(null)}>
              {t('common.close')}
            </Button>
            <Button onClick={() => {
              handleOpenAgreementDialog(viewingAgreement!);
              setViewingAgreement(null);
            }}>
              <Pencil className="me-2 h-4 w-4" />
              {t('common.edit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agreement Dialog */}
      <Dialog open={showAgreementDialog} onOpenChange={setShowAgreementDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAgreement ? t('partnerships.agreements.editAgreement') : t('partnerships.agreements.addAgreement')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('partnerships.agreements.agreementTitle')} *</Label>
              <Input
                value={agreementTitle}
                onChange={(e) => setAgreementTitle(e.target.value)}
                placeholder={t('partnerships.placeholders.agreementTitle')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('partnerships.agreements.agreementType')}</Label>
                <Select value={agreementTypeId} onValueChange={setAgreementTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('partnerships.placeholders.selectAgreementType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {agreementTypes?.map((type) => (
                      <SelectItem key={type.id} value={String(type.id)}>
                        {isArabic && type.nameAr ? type.nameAr : type.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('partnerships.agreements.legalStatus')}</Label>
                <Select value={agreementLegalStatus} onValueChange={setAgreementLegalStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('partnerships.placeholders.selectLegalStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="binding">{t('partnerships.agreements.legalStatuses.binding')}</SelectItem>
                    <SelectItem value="non-binding">{t('partnerships.agreements.legalStatuses.non-binding')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('partnerships.agreements.signedDate')}</Label>
                <Input
                  type="date"
                  value={agreementSignedDate}
                  onChange={(e) => setAgreementSignedDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('partnerships.agreements.effectiveDate')}</Label>
                <Input
                  type="date"
                  value={agreementEffectiveDate}
                  onChange={(e) => setAgreementEffectiveDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('partnerships.agreements.expiryDate')}</Label>
              <Input
                type="date"
                value={agreementExpiryDate}
                onChange={(e) => setAgreementExpiryDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('partnerships.agreements.languages')}</Label>
              <MultiSelect
                options={LANGUAGE_OPTIONS.map(lang => ({
                  value: lang.value,
                  label: t(lang.labelKey)
                }))}
                selected={agreementLanguages}
                onChange={setAgreementLanguages}
                placeholder={t('partnerships.placeholders.selectLanguages')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('partnerships.agreements.description')}</Label>
              <Textarea
                value={agreementDescription}
                onChange={(e) => setAgreementDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('partnerships.agreements.terminationClause')}</Label>
              <Textarea
                value={agreementTerminationClause}
                onChange={(e) => setAgreementTerminationClause(e.target.value)}
                placeholder={t('partnerships.placeholders.terminationClause')}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('partnerships.agreements.terminationClauseAr')}</Label>
              <Textarea
                value={agreementTerminationClauseAr}
                onChange={(e) => setAgreementTerminationClauseAr(e.target.value)}
                placeholder={t('partnerships.placeholders.terminationClauseAr')}
                rows={4}
                dir="rtl"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgreementDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmitAgreement}
              disabled={createAgreementMutation.isPending || updateAgreementMutation.isPending}
            >
              {editingAgreement ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activity Dialog */}
      <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingActivity ? t('partnerships.activities.editActivity') : t('partnerships.activities.addActivity')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('partnerships.activities.activityTitle')} *</Label>
              <Input
                value={activityTitle}
                onChange={(e) => setActivityTitle(e.target.value)}
                placeholder={t('partnerships.activities.titlePlaceholder')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('partnerships.activities.activityType')}</Label>
                <Select value={activityType} onValueChange={setActivityType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`partnerships.activities.types.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('partnerships.activities.activityDate')} *</Label>
                <Input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('partnerships.activities.description')}</Label>
              <Textarea
                value={activityDescription}
                onChange={(e) => setActivityDescription(e.target.value)}
                placeholder={t('partnerships.placeholders.activityDescription')}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('partnerships.activities.outcome')}</Label>
              <Textarea
                value={activityOutcome}
                onChange={(e) => setActivityOutcome(e.target.value)}
                placeholder={t('partnerships.placeholders.outcomeDescription')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('partnerships.activities.participants')}</Label>
              <Input
                value={activityParticipants}
                onChange={(e) => setActivityParticipants(e.target.value)}
                placeholder="John, Jane, Bob"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('partnerships.activities.linkedEvent')}</Label>
              <Select
                value={linkedEventId || 'none'}
                onValueChange={(v) => setLinkedEventId(v === 'none' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('partnerships.activities.selectEvent')} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="none">{t('partnerships.activities.noLinkedEvent')}</SelectItem>
                  {events
                    ?.filter(event => {
                      // Show events from the last 6 months and future events
                      const sixMonthsAgo = new Date();
                      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                      const eventDate = event.startDate ? new Date(event.startDate) : new Date();
                      return eventDate >= sixMonthsAgo;
                    })
                    .sort((a, b) => {
                      // Sort by start date, most recent first
                      const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
                      const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
                      return dateB - dateA;
                    })
                    .map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {isArabic ? event.nameAr || event.name : event.name}
                        {event.startDate && ` (${format(parseISO(event.startDate), 'dd/MM/yyyy')})`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActivityDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmitActivity}
              disabled={createActivityMutation.isPending || updateActivityMutation.isPending}
            >
              {editingActivity ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('partnerships.contacts.addContact')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('partnerships.contacts.selectContact')} *</Label>
              <Select
                value={selectedContactId?.toString() || ''}
                onValueChange={(v) => setSelectedContactId(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('partnerships.contacts.selectContact')} />
                </SelectTrigger>
                <SelectContent>
                  {allContacts?.map((contact: any) => (
                    <SelectItem key={contact.id} value={contact.id.toString()}>
                      {isArabic ? contact.nameAr || contact.nameEn : contact.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('partnerships.contacts.role')}</Label>
              <Select value={contactRole} onValueChange={setContactRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {t(`partnerships.contacts.roles.${role}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmitContact}
              disabled={addContactMutation.isPending}
            >
              {t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Agreement Confirmation */}
      <AlertDialog open={!!deletingAgreement} onOpenChange={() => setDeletingAgreement(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('partnerships.confirmations.deleteAgreement')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAgreement && deleteAgreementMutation.mutate(deletingAgreement.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Activity Confirmation */}
      <AlertDialog open={!!deletingActivity} onOpenChange={() => setDeletingActivity(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('partnerships.confirmations.deleteActivity')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingActivity && deleteActivityMutation.mutate(deletingActivity.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Contact Confirmation */}
      <AlertDialog open={!!deletingContact} onOpenChange={() => setDeletingContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('partnerships.contacts.noContacts')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingContact && removeContactMutation.mutate(deletingContact.contactId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Comment Confirmation */}
      <AlertDialog open={!!deletingComment} onOpenChange={() => setDeletingComment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('partnerships.confirmations.deleteComment')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingComment && deleteCommentMutation.mutate(deletingComment.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Interaction Dialog */}
      <InteractionDialog
        open={showInteractionDialog}
        onOpenChange={(open) => {
          setShowInteractionDialog(open);
          if (!open) setEditingInteraction(null);
        }}
        entityType="partnership"
        entityId={partnershipId || 0}
        interaction={editingInteraction}
      />

      {/* Delete Interaction Confirmation */}
      <AlertDialog open={!!deletingInteraction} onOpenChange={() => setDeletingInteraction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('partnerships.confirmations.deleteInteraction')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingInteraction && deleteInteractionMutation.mutate(deletingInteraction.id)}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={(open) => {
        setShowTaskDialog(open);
        if (!open) resetTaskForm();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTask 
                ? t('partnerships.tasks.editTask') 
                : t('partnerships.tasks.addTask')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label>{t('partnerships.tasks.taskTitle')} *</Label>
              <Input
                placeholder={t('partnerships.placeholders.taskTitle')}
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
            </div>

            {/* Arabic Title */}
            <div className="space-y-2">
              <Label>{t('partnerships.tasks.taskTitle')} ({t('common.arabic')})</Label>
              <Input
                dir="rtl"
                placeholder={t('partnerships.placeholders.taskTitle')}
                value={taskTitleAr}
                onChange={(e) => setTaskTitleAr(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>{t('partnerships.tasks.description')}</Label>
              <Textarea
                placeholder={t('partnerships.placeholders.taskDescription')}
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Arabic Description */}
            <div className="space-y-2">
              <Label>{t('partnerships.tasks.description')} ({t('common.arabic')})</Label>
              <Textarea
                dir="rtl"
                placeholder={t('partnerships.placeholders.taskDescription')}
                value={taskDescriptionAr}
                onChange={(e) => setTaskDescriptionAr(e.target.value)}
                rows={2}
              />
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label>{t('partnerships.tasks.dueDate')}</Label>
              <Input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>{t('partnerships.tasks.priority')}</Label>
              <Select value={taskPriority} onValueChange={setTaskPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('partnerships.tasks.priorities.low')}</SelectItem>
                  <SelectItem value="medium">{t('partnerships.tasks.priorities.medium')}</SelectItem>
                  <SelectItem value="high">{t('partnerships.tasks.priorities.high')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assigned Department */}
            <div className="space-y-2">
              <Label>{t('partnerships.tasks.assignedDepartment')}</Label>
              <Select 
                value={taskDepartmentId?.toString() || ''} 
                onValueChange={(v) => setTaskDepartmentId(v ? parseInt(v) : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('partnerships.tasks.selectDepartment')} />
                </SelectTrigger>
                <SelectContent>
                  {departments?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {isArabic && dept.nameAr ? dept.nameAr : dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleSubmitTask}
              disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
            >
              {(createTaskMutation.isPending || updateTaskMutation.isPending)
                ? t('common.saving')
                : editingTask 
                  ? t('common.save')
                  : t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Task Confirmation */}
      <AlertDialog open={!!deletingTask} onOpenChange={() => setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('partnerships.confirmations.deleteTask')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingTask && deleteTaskMutation.mutate(deletingTask.id)}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Task View Dialog */}
      <Dialog open={!!viewingTask} onOpenChange={(open) => !open && setViewingTask(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('tasks.viewDetails')}</DialogTitle>
          </DialogHeader>
          {viewingTask && (
            <div className="space-y-6">
              {/* Task Details */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-lg">
                    {isArabic && viewingTask.titleAr ? viewingTask.titleAr : viewingTask.title}
                  </h4>
                  {viewingTask.description && (
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                      {isArabic && viewingTask.descriptionAr ? viewingTask.descriptionAr : viewingTask.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getPriorityBadgeVariant(viewingTask.priority)}>
                    {t(`partnerships.tasks.priorities.${viewingTask.priority}`)}
                  </Badge>
                  <Badge variant="outline">
                    {t(`partnerships.tasks.statuses.${viewingTask.status}`)}
                  </Badge>
                  {viewingTask.dueDate && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(parseISO(viewingTask.dueDate), 'PP')}
                    </span>
                  )}
                </div>
              </div>

              {/* Comments Section */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {t('tasks.comments')}
                </h4>

                {/* Comment Input */}
                <div className="space-y-3 mb-4">
                  <Textarea
                    value={taskCommentText}
                    onChange={(e) => setTaskCommentText(e.target.value)}
                    placeholder={t('tasks.addComment')}
                    rows={3}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      ref={taskFileInputRef}
                      type="file"
                      onChange={(e) => setSelectedTaskFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="task-comment-file"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => taskFileInputRef.current?.click()}
                    >
                      <Paperclip className="h-4 w-4 mr-2" />
                      {t('tasks.attachFile')}
                    </Button>
                    {selectedTaskFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{selectedTaskFile.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setSelectedTaskFile(null);
                            if (taskFileInputRef.current) taskFileInputRef.current.value = '';
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <Button
                      size="sm"
                      onClick={handleAddTaskComment}
                      disabled={(!taskCommentText.trim() && !selectedTaskFile) || createTaskCommentMutation.isPending}
                    >
                      {createTaskCommentMutation.isPending ? t('common.saving') : t('tasks.addComment')}
                    </Button>
                  </div>
                </div>

                {/* Comments List */}
                {isLoadingTaskComments ? (
                  <ListLoadingSkeleton count={2} />
                ) : taskComments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('tasks.noComments')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {taskComments.map((comment) => (
                      <div key={comment.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                              <span className="font-medium">{comment.authorUsername || t('common.unknown')}</span>
                              <span>•</span>
                              <span>{format(parseISO(comment.createdAt), 'PPp')}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                            {comment.attachments && comment.attachments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {comment.attachments.map((attachment) => (
                                  <a
                                    key={attachment.id}
                                    href={`/api/task-comment-attachments/${attachment.id}/download`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-xs text-primary hover:underline"
                                  >
                                    {attachment.mimeType.startsWith('image/') ? (
                                      <Image className="h-3 w-3" />
                                    ) : attachment.mimeType.includes('zip') || attachment.mimeType.includes('archive') ? (
                                      <Archive className="h-3 w-3" />
                                    ) : (
                                      <File className="h-3 w-3" />
                                    )}
                                    {attachment.fileName}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => viewingTask && deleteTaskCommentMutation.mutate({
                              taskId: viewingTask.id,
                              commentId: comment.id,
                            })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Inactivity Settings Dialog */}
      <Dialog open={showInactivityDialog} onOpenChange={setShowInactivityDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t('partnerships.inactivity.settings')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Current Status */}
            <div className={cn(
              "p-4 rounded-lg",
              inactivityData?.isInactive 
                ? "bg-red-50 border border-red-200 dark:bg-red-950/50 dark:border-red-800" 
                : "bg-green-50 border border-green-200 dark:bg-green-950/50 dark:border-green-800"
            )}>
              <div className="flex items-center gap-3">
                {inactivityData?.isInactive ? (
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                ) : (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                )}
                <div>
                  <p className={cn(
                    "font-medium",
                    inactivityData?.isInactive ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"
                  )}>
                    {inactivityData?.isInactive 
                      ? t('partnerships.inactivity.statusInactive')
                      : t('partnerships.inactivity.statusActive')
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {inactivityData?.lastActivityDate 
                      ? `${t('partnerships.inactivity.lastActivity')}: ${format(parseISO(inactivityData.lastActivityDate), 'PPP')}`
                      : t('partnerships.inactivity.noActivityRecorded')
                    }
                  </p>
                  {inactivityData?.daysSinceLastActivity !== null && (
                    <p className="text-sm text-muted-foreground">
                      {inactivityData?.daysSinceLastActivity} {t('partnerships.inactivity.daysSinceActivity')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Threshold Setting */}
            <div className="space-y-2">
              <Label htmlFor="inactivity-threshold">
                {t('partnerships.inactivity.thresholdLabel')}
              </Label>
              <Select
                value={inactivityThreshold.toString()}
                onValueChange={(v) => setInactivityThreshold(parseInt(v))}
              >
                <SelectTrigger id="inactivity-threshold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t('partnerships.inactivity.thresholdMonths', { count: 1 })}</SelectItem>
                  <SelectItem value="2">{t('partnerships.inactivity.thresholdMonths', { count: 2 })}</SelectItem>
                  <SelectItem value="3">{t('partnerships.inactivity.thresholdMonths', { count: 3 })}</SelectItem>
                  <SelectItem value="6">{t('partnerships.inactivity.thresholdMonths', { count: 6 })}</SelectItem>
                  <SelectItem value="9">{t('partnerships.inactivity.thresholdMonths', { count: 9 })}</SelectItem>
                  <SelectItem value="12">{t('partnerships.inactivity.thresholdMonths', { count: 12 })}</SelectItem>
                  <SelectItem value="18">{t('partnerships.inactivity.thresholdMonths', { count: 18 })}</SelectItem>
                  <SelectItem value="24">{t('partnerships.inactivity.thresholdMonths', { count: 24 })}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('partnerships.inactivity.thresholdHelp')}
              </p>
            </div>

            {/* Notification Toggle */}
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label htmlFor="notify-inactivity">
                  {t('partnerships.inactivity.notifyLabel')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('partnerships.inactivity.notifyHelp')}
                </p>
              </div>
              <input
                type="checkbox"
                id="notify-inactivity"
                checked={notifyOnInactivity}
                onChange={(e) => setNotifyOnInactivity(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
            </div>

            {/* Last Notification Sent */}
            {inactivityData?.lastInactivityNotificationSent && (
              <p className="text-xs text-muted-foreground">
                {t('partnerships.inactivity.lastNotificationSent')}: {format(parseISO(inactivityData.lastInactivityNotificationSent), 'PPP')}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInactivityDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleSubmitInactivitySettings}
              disabled={updateInactivitySettingsMutation.isPending}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
