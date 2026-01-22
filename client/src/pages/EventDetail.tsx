import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Globe,
  Users,
  Download,
  Upload,
  Trash2,
  FileText,
  CheckSquare,
  Mic,
  UserPlus,
  Pencil,
  Archive,
  Mail,
  UserCircle,
  Check,
  X,
  Search,
  Image,
  Handshake,
  Building,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingState, ListLoadingSkeleton, DashboardCardSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Event, Contact, EventSpeaker } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/PageHeader';
import EventForm from '@/components/EventForm';
import EventFileManager from '@/components/events/EventFileManager';
import InvitationEmailManager from '@/components/InvitationEmailManager';

interface EventAttendee {
  id: number;
  eventId: string;
  contactId: number;
  attendedAt: string;
  notes: string | null;
  contact: Contact & {
    organization?: { id: number; nameEn: string; nameAr: string | null };
    position?: { id: number; nameEn: string; nameAr: string | null };
    country?: { id: number; code: string; nameEn: string; nameAr: string | null };
  };
}

interface EventInvitee {
  id: number;
  eventId: string;
  contactId: number;
  rsvp: boolean;
  registered: boolean;
  invitedAt: string;
  rsvpAt: string | null;
  registeredAt: string | null;
  notes: string | null;
  contact: Contact & {
    organization?: { id: number; nameEn: string; nameAr: string | null };
    position?: { id: number; nameEn: string; nameAr: string | null };
    country?: { id: number; code: string; nameEn: string; nameAr: string | null };
  };
}

interface AttendeesResponse {
  eventId: string;
  eventName: string;
  attendees: EventAttendee[];
  totalAttendees: number;
  speakers: number;
  regularAttendees: number;
}

interface InviteesResponse {
  eventId: string;
  eventName: string;
  invitees: EventInvitee[];
  totalInvitees: number;
  rsvpConfirmed: number;
  registered: number;
  rsvpPending: number;
  rsvpConversionRate: number;
  registrationRate: number;
}

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueDate: string | null;
}

interface EventStakeholder {
  id: number;
  eventId: string;
  stakeholderId: number;
  stakeholder: {
    id: number;
    name: string;
    nameAr?: string | null;
    active: boolean;
    ccList: string[] | null;
    createdAt: string;
  };
  emails: Array<{
    id: number;
    stakeholderId: number;
    email: string;
  }>;
  requirements: Array<{
    id: number;
    stakeholderId: number;
    requirementText: string;
  }>;
  selectedRequirementIds: string[] | null;
  customRequirements: string | null;
  tasks: Task[];
}

export default function EventDetail() {
  const params = useParams();
  const eventId = params.eventId;
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isArabic = i18n.language === 'ar';

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingAttendee, setDeletingAttendee] = useState<EventAttendee | null>(null);
  const [showInviteesUploadDialog, setShowInviteesUploadDialog] = useState(false);
  const [inviteesUploadFile, setInviteesUploadFile] = useState<File | null>(null);
  const [isUploadingInvitees, setIsUploadingInvitees] = useState(false);
  const [deletingInvitee, setDeletingInvitee] = useState<EventInvitee | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddInviteesDialog, setShowAddInviteesDialog] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());
  const [contactSearchQuery, setContactSearchQuery] = useState('');

  // Redirect if not authorized
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    setLocation('/');
    return null;
  }

  // Fetch event details
  const { data: event, isLoading: eventLoading } = useQuery<Event>({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch event');
      return response.json();
    },
    enabled: !!eventId,
  });

  // Fetch attendees
  const {
    data: attendeesData,
    isLoading: attendeesLoading,
    refetch: refetchAttendees,
  } = useQuery<AttendeesResponse>({
    queryKey: ['event-attendees', eventId],
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}/attendees`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch attendees');
      return response.json();
    },
    enabled: !!eventId,
  });

  // Fetch invitees
  const {
    data: inviteesData,
    isLoading: inviteesLoading,
    refetch: refetchInvitees,
  } = useQuery<InviteesResponse>({
    queryKey: ['event-invitees', eventId],
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}/invitees`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch invitees');
      return response.json();
    },
    enabled: !!eventId,
  });

  // Fetch all contacts for add invitees dialog
  const { data: contactsResponse, isLoading: contactsLoading } = useQuery<{ contacts: Contact[]; total: number; page: number; limit: number }>({
    queryKey: ['/api/contacts', { limit: 1000 }], // Fetch large number for dialog
    queryFn: async () => {
      const response = await fetch('/api/contacts?limit=1000', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch contacts');
      return response.json();
    },
    enabled: showAddInviteesDialog,
  });

  const allContacts = contactsResponse?.contacts || [];

  // Fetch stakeholders and tasks
  const { data: stakeholders = [], isLoading: isLoadingStakeholders } = useQuery<EventStakeholder[]>({
    queryKey: ['/api/events', eventId, 'stakeholders'],
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}/stakeholders`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch stakeholders');
      return response.json();
    },
    enabled: !!eventId,
  });

  // Fetch speakers
  const { data: speakers = [], isLoading: isLoadingSpeakers } = useQuery<EventSpeaker[]>({
    queryKey: ['/api/events', eventId, 'speakers'],
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}/speakers`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch speakers');
      return response.json();
    },
    enabled: !!eventId,
  });

  // Fetch partnership activities linked to this event
  const { data: partnershipActivities = [], isLoading: isLoadingPartnershipActivities } = useQuery<any[]>({
    queryKey: ['/api/events', eventId, 'partnership-activities'],
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}/partnership-activities`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch partnership activities');
      return response.json();
    },
    enabled: !!eventId,
  });

  // Delete attendee mutation
  const deleteAttendeeMutation = useMutation({
    mutationFn: async (contactId: number) => {
      const response = await fetch(`/api/events/${eventId}/attendees/${contactId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to remove attendee');
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Attendee removed from event',
      });
      refetchAttendees();
      setDeletingAttendee(null);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to remove attendee',
      });
    },
  });

  // Add contacts as invitees mutation
  const addInviteesMutation = useMutation({
    mutationFn: async (contactIds: number[]) => {
      const response = await fetch(`/api/events/${eventId}/invitees/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contactIds }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add invitees');
      }
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: 'Success',
        description: `Added ${result.added} invitees (${result.skipped} already invited)`,
      });
      refetchInvitees();
      setShowAddInviteesDialog(false);
      setSelectedContactIds(new Set());
      setContactSearchQuery('');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to add invitees',
      });
    },
  });

  // Delete invitee mutation
  const deleteInviteeMutation = useMutation({
    mutationFn: async (contactId: number) => {
      const response = await fetch(`/api/events/${eventId}/invitees/${contactId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to remove invitee');
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Invitee removed from event',
      });
      refetchInvitees();
      setDeletingInvitee(null);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to remove invitee',
      });
    },
  });

  // Toggle RSVP mutation
  const toggleRSVPMutation = useMutation({
    mutationFn: async ({ contactId, rsvp }: { contactId: number; rsvp: boolean }) => {
      const response = await fetch(`/api/events/${eventId}/invitees/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rsvp }),
      });
      if (!response.ok) throw new Error('Failed to update RSVP');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'RSVP status updated',
      });
      refetchInvitees();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update RSVP',
      });
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PATCH', `/api/events/${eventId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast({
        title: 'Success',
        description: 'Event updated successfully',
      });
      setShowEditDialog(false);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update event',
      });
    },
  });

  const handleDownloadTemplate = () => {
    window.open('/api/events/attendees/csv-template', '_blank');
  };

  const handleDownloadAttendees = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/attendees/download`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to download attendees');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendees-${event?.name.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: 'Attendees list downloaded',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to download attendees',
      });
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await fetch(`/api/events/${eventId}/attendees/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload attendees');
      }

      const result = await response.json();

      toast({
        title: 'Upload Complete',
        description: `Processed ${result.processed} rows: ${result.newContacts} new, ${result.existingContacts} existing, ${result.errors.length} errors`,
      });

      if (result.errors.length > 0) {
        console.error('Upload errors:', result.errors);
      }

      setShowUploadDialog(false);
      setUploadFile(null);
      refetchAttendees();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: error.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadInviteesTemplate = () => {
    window.open('/api/events/invitees/csv-template', '_blank');
  };

  const handleDownloadInvitees = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/invitees/download`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to download invitees');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invitees-${event?.name.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: 'Invitees list downloaded',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to download invitees',
      });
    }
  };

  const handleUploadInviteesSubmit = async () => {
    if (!inviteesUploadFile) return;

    setIsUploadingInvitees(true);
    try {
      const formData = new FormData();
      formData.append('file', inviteesUploadFile);

      const response = await fetch(`/api/events/${eventId}/invitees/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload invitees');
      }

      const result = await response.json();

      toast({
        title: 'Upload Complete',
        description: `Success: ${result.success}, Created: ${result.created}, Existing: ${result.existing}, Errors: ${result.errors.length}`,
      });

      if (result.errors.length > 0) {
        console.error('Upload errors:', result.errors);
      }

      setShowInviteesUploadDialog(false);
      setInviteesUploadFile(null);
      refetchInvitees();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: error.message,
      });
    } finally {
      setIsUploadingInvitees(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  const getTaskStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-orange-500 hover:bg-orange-600 text-white';
      case 'in_progress':
        return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'completed':
        return 'bg-green-500 hover:bg-green-600 text-white';
      default:
        return '';
    }
  };

  const getDisplayName = (contact: Contact) => {
    const name = isArabic && contact.nameAr ? contact.nameAr : contact.nameEn;
    const titlePrefix = isArabic && contact.titleAr ? contact.titleAr : contact.title;
    return titlePrefix ? `${titlePrefix} ${name}` : name;
  };

  // Filter contacts based on search query
  const filteredContacts = allContacts.filter((contact) => {
    if (!contactSearchQuery) return true;
    const query = contactSearchQuery.toLowerCase();
    const name = getDisplayName(contact).toLowerCase();
    const email = contact.email?.toLowerCase() || '';
    const org = isArabic && contact.organization?.nameAr
      ? contact.organization.nameAr.toLowerCase()
      : contact.organization?.nameEn?.toLowerCase() || '';
    const position = isArabic && contact.position?.nameAr
      ? contact.position.nameAr.toLowerCase()
      : contact.position?.nameEn?.toLowerCase() || '';
    
    return name.includes(query) || email.includes(query) || org.includes(query) || position.includes(query);
  });

  if (eventLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <LoadingState fullPage text="Loading event..." />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="p-6">
            <p>Event not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            title="Back to Events"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <PageHeader
            title={isArabic && event.nameAr ? event.nameAr : event.name}
            subtitle={`${formatDate(event.startDate)}${event.endDate !== event.startDate ? ' - ' + formatDate(event.endDate) : ''}`}
          />
        </div>
        <Button onClick={() => setShowEditDialog(true)}>
          <Pencil className="h-4 w-4 me-2" />
          Edit Event
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview">
            <FileText className="h-4 w-4 me-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="stakeholders">
            <CheckSquare className="h-4 w-4 me-2" />
            Stakeholders
          </TabsTrigger>
          <TabsTrigger value="speakers">
            <Mic className="h-4 w-4 me-2" />
            Speakers
          </TabsTrigger>
          <TabsTrigger value="media">
            <Image className="h-4 w-4 me-2" />
            Media ({event?.media?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="invitees">
            <Mail className="h-4 w-4 me-2" />
            Invitees ({inviteesData?.totalInvitees || 0})
          </TabsTrigger>
          <TabsTrigger value="attendees">
            <Users className="h-4 w-4 me-2" />
            Attendees ({attendeesData?.totalAttendees || 0})
          </TabsTrigger>
          <TabsTrigger value="partnerships">
            <Handshake className="h-4 w-4 me-2" />
            Partnerships ({partnershipActivities?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="files">
            <FileText className="h-4 w-4 me-2" />
            Files
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Date</span>
                  </div>
                  <p className="text-sm font-medium">
                    {formatDate(event.startDate)}
                    {event.endDate !== event.startDate && ` - ${formatDate(event.endDate)}`}
                  </p>
                </div>

                {event.location && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>Location</span>
                    </div>
                    <p className="text-sm font-medium">
                      {isArabic && event.locationAr ? event.locationAr : event.location}
                    </p>
                  </div>
                )}

                {event.url && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      <span>URL</span>
                    </div>
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {event.url}
                    </a>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Category</span>
                  </div>
                  <p className="text-sm font-medium">{event.category || '-'}</p>
                </div>
              </div>

              {event.description && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-sm">
                    {isArabic && event.descriptionAr ? event.descriptionAr : event.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stakeholders Tab */}
        <TabsContent value="stakeholders" className="space-y-4">
          {isLoadingStakeholders ? (
            <Card>
              <CardContent className="p-6">
                <ListLoadingSkeleton count={2} />
              </CardContent>
            </Card>
          ) : stakeholders.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Stakeholders & Tasks</CardTitle>
                <CardDescription>
                  View stakeholders assigned to this event
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-4">
                  No stakeholders assigned to this event.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {stakeholders.map((es) => (
                <Card key={es.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {isArabic && es.stakeholder.nameAr ? es.stakeholder.nameAr : es.stakeholder.name}
                    </CardTitle>
                    <CardDescription>
                      {t('tasks.taskCountLabel', { count: es.tasks.length })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Stakeholder Info */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 text-primary mt-0.5" />
                        <div className="flex-1">
                          <label className="text-xs font-medium text-muted-foreground">
                            {t('departments.emailAddresses')}
                          </label>
                          <p className="text-sm mt-1">
                            {es.emails.map(e => e.email).join(', ')}
                          </p>
                        </div>
                      </div>
                      
                      {es.selectedRequirementIds && es.selectedRequirementIds.length > 0 && (
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-primary mt-0.5" />
                          <div className="flex-1">
                            <label className="text-xs font-medium text-muted-foreground">
                              {t('departments.selectedRequirements')}
                            </label>
                            <p className="text-sm mt-1">
                              {es.requirements
                                .filter(r => es.selectedRequirementIds?.includes(r.id.toString()))
                                .map(r => r.requirementText)
                                .filter(text => text && text.trim())
                                .join(', ') || t('departments.noRequirementsSpecified')}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {es.customRequirements && (
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-primary mt-0.5" />
                          <div className="flex-1">
                            <label className="text-xs font-medium text-muted-foreground">
                              {t('departments.customRequirements')}
                            </label>
                            <p className="text-sm mt-1 whitespace-pre-wrap">
                              {es.customRequirements}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tasks - Collapsible */}
                    {es.tasks.length > 0 && (
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="tasks" className="border-0">
                          <AccordionTrigger className="py-2 hover:no-underline">
                            <h4 className="text-sm font-semibold">
                              {t('tasks.tasks')} ({es.tasks.length})
                            </h4>
                          </AccordionTrigger>
                          <AccordionContent className="pt-2">
                            <div className="space-y-2">
                              {es.tasks.map((task) => (
                                <Card key={task.id}>
                                  <CardContent className="p-3">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <h5 className="font-semibold text-sm mb-1">
                                          {task.title}
                                        </h5>
                                        {task.description && (
                                          <p className="text-xs text-muted-foreground line-clamp-2">
                                            {task.description}
                                          </p>
                                        )}
                                      </div>
                                      <Badge className={getTaskStatusBadgeColor(task.status)}>
                                        {t(`tasks.status.${task.status}`)}
                                      </Badge>
                                    </div>
                                    {task.dueDate && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                                        <Calendar className="h-3 w-3" />
                                        <span>
                                          {t('tasks.due')}: {format(parseISO(task.dueDate), 'MMM d, yyyy')}
                                        </span>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Speakers Tab */}
        <TabsContent value="speakers">
          <Card>
            <CardHeader>
              <CardTitle>Event Speakers</CardTitle>
              <CardDescription>
                Speakers assigned to this event
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSpeakers ? (
                <ListLoadingSkeleton count={2} />
              ) : speakers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No speakers assigned to this event.
                </p>
              ) : (
                <div className="space-y-3">
                  {speakers.map((speaker) => {
                    const contact = speaker.contact;
                    const name = isArabic && contact.nameAr ? contact.nameAr : contact.nameEn;
                    const title = isArabic && contact.titleAr ? contact.titleAr : contact.title;
                    const displayName = title ? `${title} ${name}` : name;
                    
                    return (
                      <div 
                        key={speaker.id} 
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                      >
                        <UserCircle className="h-10 w-10 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {displayName}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {speaker.contact.position && (
                              <span>
                                {isArabic && speaker.contact.position.nameAr 
                                  ? speaker.contact.position.nameAr 
                                  : speaker.contact.position.nameEn}
                              </span>
                            )}
                            {speaker.contact.position && speaker.contact.organization && ' • '}
                            {speaker.contact.organization && (
                              <span>
                                {isArabic && speaker.contact.organization.nameAr 
                                  ? speaker.contact.organization.nameAr 
                                  : speaker.contact.organization.nameEn}
                              </span>
                            )}
                          </div>
                          {contact.email && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {contact.email}
                            </div>
                          )}
                        </div>
                        {speaker.role && (
                          <Badge variant="secondary" className="flex-shrink-0">
                            {isArabic && speaker.roleAr ? speaker.roleAr : speaker.role}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Media Tab */}
        <TabsContent value="media">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Event Photos
              </CardTitle>
              <CardDescription>
                Upload and manage photos for this event (max 20 photos, 5MB each)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload Section */}
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files || files.length === 0) return;
                      
                      const currentCount = event?.media?.length || 0;
                      if (currentCount + files.length > 20) {
                        toast({
                          title: 'Too many photos',
                          description: `Maximum 20 photos allowed. You have ${currentCount} and tried to add ${files.length}.`,
                          variant: 'destructive',
                        });
                        return;
                      }

                      const formData = new FormData();
                      Array.from(files).forEach(file => {
                        formData.append('photos', file);
                      });

                      try {
                        const response = await fetch(`/api/events/${event.id}/media`, {
                          method: 'POST',
                          body: formData,
                          credentials: 'include',
                        });
                        if (!response.ok) throw new Error('Upload failed');
                        queryClient.invalidateQueries({ queryKey: ['/api/events', event.id] });
                        queryClient.invalidateQueries({ queryKey: ['/api/events'] });
                        toast({ title: 'Photos uploaded successfully' });
                      } catch (error) {
                        toast({ title: 'Upload failed', variant: 'destructive' });
                      }
                      e.target.value = '';
                    }}
                    disabled={(event?.media?.length || 0) >= 20}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    {20 - (event?.media?.length || 0)} photos remaining
                  </p>
                </div>
              )}

              {/* Photos Grid */}
              {event?.media && event.media.length > 0 ? (
                <div className="grid grid-cols-4 gap-4">
                  {event.media.map((media) => (
                    <div key={media.id} className="aspect-square bg-muted rounded-md overflow-hidden relative group">
                      <img
                        src={media.thumbnailUrl || media.imageUrl || ''}
                        alt={media.caption || media.originalFileName}
                        className="w-full h-full object-cover"
                      />
                      {(user?.role === 'admin' || user?.role === 'superadmin') && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8"
                            onClick={async () => {
                              if (!confirm('Delete this photo?')) return;
                              try {
                                await fetch(`/api/events/${event.id}/media/${media.id}`, {
                                  method: 'DELETE',
                                  credentials: 'include',
                                });
                                queryClient.invalidateQueries({ queryKey: ['/api/events', event.id] });
                                queryClient.invalidateQueries({ queryKey: ['/api/events'] });
                                toast({ title: 'Photo deleted' });
                              } catch (error) {
                                toast({ title: 'Delete failed', variant: 'destructive' });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No photos uploaded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invitees Tab */}
        <TabsContent value="invitees">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Event Invitees ({inviteesData?.totalInvitees || 0})</CardTitle>
                  <CardDescription>
                    Full invitee list with RSVP and registration tracking.
                    <br />
                    <span className="text-xs text-muted-foreground">
                      RSVP Confirmed: {inviteesData?.rsvpConfirmed || 0} | Registered: {inviteesData?.registered || 0}
                    </span>
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setShowAddInviteesDialog(true)}
                  >
                    <UserPlus className="h-4 w-4 me-2" />
                    Add from Contacts
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTemplate}
                  >
                    <Download className="h-4 w-4 me-2" />
                    Template
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInviteesUploadDialog(true)}
                  >
                    <Upload className="h-4 w-4 me-2" />
                    Upload CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {inviteesLoading ? (
                <ListLoadingSkeleton count={3} />
              ) : !inviteesData?.invitees.length ? (
                <EmptyState
                  icon={Mail}
                  title="No invitees yet"
                  description="Upload a CSV file to add invitees."
                />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>RSVP</TableHead>
                        <TableHead>Registered</TableHead>
                        <TableHead>Invited At</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inviteesData.invitees.map((invitee) => (
                        <TableRow key={invitee.id}>
                          <TableCell className="font-medium">
                            {getDisplayName(invitee.contact)}
                          </TableCell>
                          <TableCell>
                            {invitee.contact.organization
                              ? isArabic && invitee.contact.organization.nameAr
                                ? invitee.contact.organization.nameAr
                                : invitee.contact.organization.nameEn
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {invitee.contact.position
                              ? isArabic && invitee.contact.position.nameAr
                                ? invitee.contact.position.nameAr
                                : invitee.contact.position.nameEn
                              : '-'}
                          </TableCell>
                          <TableCell>{invitee.contact.email || '-'}</TableCell>
                          <TableCell>{invitee.contact.phone || '-'}</TableCell>
                          <TableCell>
                            {invitee.rsvp ? (
                              <Badge variant="default" className="gap-1">
                                <Check className="h-3 w-3" />
                                Confirmed
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <X className="h-3 w-3" />
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {invitee.registered ? (
                              <Badge variant="default" className="gap-1">
                                <Check className="h-3 w-3" />
                                Yes
                              </Badge>
                            ) : (
                              <Badge variant="outline">No</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(invitee.invitedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingInvitee(invitee)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invitation Email Manager */}
          {inviteesData && inviteesData.totalInvitees > 0 && eventId && (
            <div className="mt-6">
              <InvitationEmailManager 
                eventId={eventId} 
                eventName={isArabic && event.nameAr ? event.nameAr : event.name}
              />
            </div>
          )}
        </TabsContent>

        {/* Attendees Tab */}
        <TabsContent value="attendees">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Event Attendees ({attendeesData?.totalAttendees || 0})</CardTitle>
                  <CardDescription>
                    Full attendee list with contact information.
                    <br />
                    <span className="text-xs text-amber-600">
                      Note: Only the total count is transferred to archives for privacy.
                    </span>
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTemplate}
                  >
                    <Download className="h-4 w-4 me-2" />
                    Template
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUploadDialog(true)}
                  >
                    <Upload className="h-4 w-4 me-2" />
                    Upload CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadAttendees}
                    disabled={!attendeesData?.attendees.length}
                  >
                    <Download className="h-4 w-4 me-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {attendeesLoading ? (
                <ListLoadingSkeleton count={3} />
              ) : !attendeesData?.attendees.length ? (
                <EmptyState
                  icon={UserPlus}
                  title="No attendees yet"
                  description="Upload a CSV file to add attendees."
                />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Attended At</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendeesData.attendees.map((attendee) => (
                        <TableRow key={attendee.id}>
                          <TableCell className="font-medium">
                            {getDisplayName(attendee.contact)}
                          </TableCell>
                          <TableCell>
                            {attendee.contact.organization
                              ? isArabic && attendee.contact.organization.nameAr
                                ? attendee.contact.organization.nameAr
                                : attendee.contact.organization.nameEn
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {attendee.contact.position
                              ? isArabic && attendee.contact.position.nameAr
                                ? attendee.contact.position.nameAr
                                : attendee.contact.position.nameEn
                              : '-'}
                          </TableCell>
                          <TableCell>{attendee.contact.email || '-'}</TableCell>
                          <TableCell>{attendee.contact.phone || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(attendee.attendedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingAttendee(attendee)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Files Tab */}
        {/* Partnerships Tab */}
        <TabsContent value="partnerships" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('events.partnerships.title')}</CardTitle>
              <CardDescription>
                {t('events.partnerships.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPartnershipActivities ? (
                <ListLoadingSkeleton count={2} />
              ) : partnershipActivities && partnershipActivities.length > 0 ? (
                <div className="space-y-4">
                  {partnershipActivities.map((activity: any) => (
                    <Card key={activity.id} className="border-l-4 border-l-primary">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="p-2 bg-muted rounded-full">
                              <Building className="h-4 w-4" />
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold">{activity.title}</h4>
                                <Badge variant="outline">
                                  {t(`partnerships.activities.types.${activity.activityType}`)}
                                </Badge>
                                {activity.organization && (
                                  <Badge variant="secondary">
                                    {isArabic ? activity.organization.nameAr || activity.organization.nameEn : activity.organization.nameEn}
                                  </Badge>
                                )}
                              </div>
                              {activity.startDate && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  <span>{format(parseISO(activity.startDate), 'PPP')}</span>
                                </div>
                              )}
                              {activity.description && (
                                <p className="text-sm text-muted-foreground">
                                  {activity.description}
                                </p>
                              )}
                              {activity.outcome && (
                                <div className="mt-2">
                                  <p className="text-xs font-medium text-muted-foreground">
                                    {t('partnerships.activities.outcome')}
                                  </p>
                                  <p className="text-sm">{activity.outcome}</p>
                                </div>
                              )}
                              {activity.createdByUser && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                                  <UserCircle className="h-3 w-3" />
                                  <span>{t('events.partnerships.createdBy', { user: activity.createdByUser.username })}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Handshake className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {t('events.partnerships.noActivities')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Event Files & Agendas</CardTitle>
              <CardDescription>
                Upload and manage files, documents, and agendas for this event
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EventFileManager 
                eventId={eventId!} 
                eventName={isArabic && event.nameAr ? event.nameAr : event.name}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Attendees List</DialogTitle>
            <DialogDescription>
              Upload a CSV file with attendee information. New contacts will be added automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>CSV File</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setUploadFile(file || null);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Upload a CSV file with attendee data. Download the template for the correct format.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowUploadDialog(false);
                setUploadFile(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 me-2" />
              Download Template
            </Button>
            <Button
              onClick={handleUploadSubmit}
              disabled={!uploadFile || isUploading}
            >
              <Upload className="h-4 w-4 me-2" />
              {isUploading ? 'Uploading...' : 'Upload & Process'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Attendee Confirmation */}
      <AlertDialog
        open={!!deletingAttendee}
        onOpenChange={(open) => !open && setDeletingAttendee(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Attendee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              {deletingAttendee && getDisplayName(deletingAttendee.contact)} from this event's
              attendee list? This will not delete the contact from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deletingAttendee && deleteAttendeeMutation.mutate(deletingAttendee.contactId)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Invitees Dialog */}
      <Dialog open={showInviteesUploadDialog} onOpenChange={setShowInviteesUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Invitees List</DialogTitle>
            <DialogDescription>
              Upload a CSV file with invitee information. New contacts will be added automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>CSV File</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setInviteesUploadFile(file || null);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Upload a CSV file with invitee data. Download the template for the correct format.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowInviteesUploadDialog(false);
                setInviteesUploadFile(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 me-2" />
              Download Template
            </Button>
            <Button
              onClick={handleUploadInviteesSubmit}
              disabled={!inviteesUploadFile || isUploadingInvitees}
            >
              <Upload className="h-4 w-4 me-2" />
              {isUploadingInvitees ? 'Uploading...' : 'Upload & Process'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Invitee Confirmation */}
      <AlertDialog
        open={!!deletingInvitee}
        onOpenChange={(open) => !open && setDeletingInvitee(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Invitee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              {deletingInvitee && getDisplayName(deletingInvitee.contact)} from this event's
              invitee list? This will not delete the contact from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deletingInvitee && deleteInviteeMutation.mutate(deletingInvitee.contactId)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Invitees from Contacts Dialog */}
      <Dialog open={showAddInviteesDialog} onOpenChange={(open) => {
        setShowAddInviteesDialog(open);
        if (!open) {
          setSelectedContactIds(new Set());
          setContactSearchQuery('');
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Invitees from Contacts</DialogTitle>
            <DialogDescription>
              Select contacts to invite to this event. You can search and filter the list.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Search and Select All */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, organization..."
                  value={contactSearchQuery}
                  onChange={(e) => setContactSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedContactIds.size === filteredContacts.length && filteredContacts.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
                      } else {
                        setSelectedContactIds(new Set());
                      }
                    }}
                  />
                  <Label htmlFor="select-all" className="cursor-pointer">
                    Select All ({filteredContacts.length})
                  </Label>
                </div>
                <Badge variant="secondary">
                  {selectedContactIds.size} selected
                </Badge>
              </div>
            </div>

            {/* Contacts List */}
            <div className="flex-1 overflow-y-auto border rounded-md">
              {contactsLoading ? (
                <div className="p-4">
                  <ListLoadingSkeleton count={5} />
                </div>
              ) : filteredContacts.length === 0 ? (
                <EmptyState
                  icon={UserCircle}
                  title={contactSearchQuery ? 'No contacts found matching your search' : 'No contacts available'}
                  className="p-8"
                />
              ) : (
                <div className="divide-y">
                  {filteredContacts.map((contact) => {
                    const isAlreadyInvited = inviteesData?.invitees.some(
                      inv => inv.contactId === contact.id
                    );
                    const isSelected = selectedContactIds.has(contact.id);
                    
                    return (
                      <div
                        key={contact.id}
                        className={`p-3 flex items-start gap-3 hover:bg-accent/50 transition-colors ${
                          isAlreadyInvited ? 'opacity-50' : ''
                        }`}
                      >
                        <Checkbox
                          id={`contact-${contact.id}`}
                          checked={isSelected}
                          disabled={isAlreadyInvited}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedContactIds);
                            if (checked) {
                              newSet.add(contact.id);
                            } else {
                              newSet.delete(contact.id);
                            }
                            setSelectedContactIds(newSet);
                          }}
                          className="mt-1"
                        />
                        <Label
                          htmlFor={`contact-${contact.id}`}
                          className={`flex-1 cursor-pointer ${isAlreadyInvited ? 'cursor-not-allowed' : ''}`}
                        >
                          <div className="font-medium">
                            {getDisplayName(contact)}
                            {isAlreadyInvited && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Already Invited
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                            {contact.email && <div>{contact.email}</div>}
                            <div className="flex gap-2 flex-wrap">
                              {contact.organization && (
                                <span>
                                  {isArabic && contact.organization.nameAr
                                    ? contact.organization.nameAr
                                    : contact.organization.nameEn}
                                </span>
                              )}
                              {contact.organization && contact.position && '•'}
                              {contact.position && (
                                <span>
                                  {isArabic && contact.position.nameAr
                                    ? contact.position.nameAr
                                    : contact.position.nameEn}
                                </span>
                              )}
                            </div>
                          </div>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddInviteesDialog(false);
                setSelectedContactIds(new Set());
                setContactSearchQuery('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const contactIds = Array.from(selectedContactIds);
                addInviteesMutation.mutate(contactIds);
              }}
              disabled={selectedContactIds.size === 0 || addInviteesMutation.isPending}
            >
              <UserPlus className="h-4 w-4 me-2" />
              {addInviteesMutation.isPending
                ? 'Adding...'
                : `Add ${selectedContactIds.size} Invitee${selectedContactIds.size !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>
              Update event information and details
            </DialogDescription>
          </DialogHeader>
          <EventForm
            event={event}
            onSubmit={(data) => updateEventMutation.mutate(data)}
            onCancel={() => setShowEditDialog(false)}
            isSubmitting={updateEventMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
