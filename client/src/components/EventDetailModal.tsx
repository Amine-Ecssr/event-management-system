import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Event, EventSpeaker } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Calendar, Mail, FileText, Pencil, Trash2, Archive, Trophy, Loader2, Mic, UserCircle, FolderOpen, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { queryClient, apiRequest } from '@/lib/queryClient';
import EventFileManager from '@/components/events/EventFileManager';

interface EventDetailModalProps {
  event: Event | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (event: Event) => void;
  onDelete?: (event: Event) => void;
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

export default function EventDetailModal({ event, open, onClose, onEdit, onDelete }: EventDetailModalProps) {
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const isArabic = i18n.language === 'ar' || language === 'ar';
  const locale = isArabic ? ar : undefined;
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Archive dialog state
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveFormData, setArchiveFormData] = useState({
    actualAttendees: '',
    highlights: '',
    highlightsAr: '',
  });
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperAdmin = user?.role === 'superadmin';

  // Archive event mutation
  const archiveEventMutation = useMutation({
    mutationFn: async ({ eventId, data }: { eventId: string; data: any }) => {
      return await apiRequest('POST', `/api/archive/from-event/${eventId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/archive'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setArchiveDialogOpen(false);
      setArchiveFormData({ actualAttendees: '', highlights: '', highlightsAr: '' });
      toast({
        title: t('archive.archiveDialog.archived'),
        description: t('archive.archiveDialog.archivedDesc'),
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: t('messages.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleArchiveEvent = () => {
    if (!event) return;
    const data: any = {};
    if (archiveFormData.actualAttendees) {
      data.actualAttendees = parseInt(archiveFormData.actualAttendees);
    }
    if (archiveFormData.highlights) data.highlights = archiveFormData.highlights;
    if (archiveFormData.highlightsAr) data.highlightsAr = archiveFormData.highlightsAr;
    archiveEventMutation.mutate({ eventId: event.id, data });
  };

  const handleDownloadIcs = async () => {
    if (!event) return;

    try {
      const response = await fetch(`/api/events/${event.id}/ics`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download calendar file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${event.name}.ics`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: t('events.calendarExportSuccess'),
        description: t('events.calendarExportSuccessDescription'),
      });
    } catch (error) {
      console.error('Failed to download ICS file', error);
      toast({
        title: t('events.calendarExportError'),
        description: t('events.calendarExportErrorDescription'),
        variant: 'destructive',
      });
    }
  };

  // Helper function to format date range with optional times
  const formatDateRange = (event: Event) => {
    const startDate = parseISO(event.startDate);
    const endDate = parseISO(event.endDate);
    const isSameDay = event.startDate === event.endDate;
    const dateFormat = isArabic ? 'MMMM d yyyy' : 'MMMM d, yyyy';
    
    if (isSameDay) {
      if (event.startTime || event.endTime) {
        const startTimeStr = event.startTime || '';
        const endTimeStr = event.endTime || '';
        if (startTimeStr && endTimeStr) {
          return `${format(startDate, dateFormat, { locale })} ${startTimeStr} - ${endTimeStr}`;
        } else if (startTimeStr) {
          return `${format(startDate, dateFormat, { locale })} ${startTimeStr}`;
        } else {
          return `${format(startDate, dateFormat, { locale })} - ${endTimeStr}`;
        }
      } else {
        return format(startDate, dateFormat, { locale });
      }
    } else {
      const startTimeStr = event.startTime ? ` ${event.startTime}` : '';
      const endTimeStr = event.endTime ? ` ${event.endTime}` : '';
      return `${format(startDate, dateFormat, { locale })}${startTimeStr} – ${format(endDate, dateFormat, { locale })}${endTimeStr}`;
    }
  };

  // Fetch stakeholders and tasks for admins
  const { data: stakeholders = [], isLoading: isLoadingStakeholders } = useQuery<EventStakeholder[]>({
    queryKey: ['/api/events', event?.id, 'stakeholders'],
    queryFn: async () => {
      const response = await fetch(`/api/events/${event?.id}/stakeholders`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch stakeholders');
      return response.json();
    },
    enabled: !!event && isAdmin && open,
  });

  // Fetch speakers for the event
  const { data: speakers = [], isLoading: isLoadingSpeakers } = useQuery<EventSpeaker[]>({
    queryKey: ['/api/events', event?.id, 'speakers'],
    queryFn: async () => {
      const response = await fetch(`/api/events/${event?.id}/speakers`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch speakers');
      return response.json();
    },
    enabled: !!event && open,
  });

  const getStatusBadgeColor = (status: string) => {
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

  // Helper function for bilingual content display
  const getBilingualContent = (content: string | null, contentAr: string | null | undefined) => {
    if (i18n.language === 'ar' && contentAr) {
      return contentAr;
    }
    return content || '';
  };

  // Helper function for speaker display name
  const getSpeakerDisplayName = (speaker: EventSpeaker) => {
    const contact = speaker.contact;
    const name = isArabic && contact.nameAr ? contact.nameAr : contact.nameEn;
    const title = isArabic && contact.titleAr ? contact.titleAr : contact.title;
    return title ? `${title} ${name}` : name;
  };

  // Speakers section component
  const SpeakersSection = () => {
    if (isLoadingSpeakers) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }
    
    if (speakers.length === 0) {
      return null;
    }

    return (
      <div className="space-y-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Mic className="h-4 w-4" />
          {t('archive.fields.speakers')}
        </h3>
        <div className="space-y-2">
          {speakers.map((speaker) => (
            <div 
              key={speaker.id} 
              className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
            >
              <UserCircle className="h-8 w-8 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {getSpeakerDisplayName(speaker)}
                </div>
                <div className="text-xs text-muted-foreground truncate">
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
              </div>
              {speaker.role && (
                <Badge variant="secondary" className="flex-shrink-0">
                  {isArabic && speaker.roleAr ? speaker.roleAr : speaker.role}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!event) {
    return (
      <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent
          data-testid="dialog-event-details"
          className="sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>{t('events.eventNotFound')}</DialogTitle>
            <DialogDescription>{t('events.eventNotFoundDescription')}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }
  
  // Helper function to get source label
  const getSourceLabel = () => {
    if (!event.source || event.source === 'manual') return null;
    if (event.source === 'abu-dhabi-media-office') return t('events.sourceAbuDhabiMedia');
    if (event.source === 'adnec') return t('events.sourceAdnec');
    return t('events.sourceScraped');
  };
  
  const sourceLabel = getSourceLabel();

  // Content shared between Dialog and Drawer for public/stakeholder users
  const PublicEventContent = () => (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleDownloadIcs}
          data-testid="button-export-ics"
        >
          <Calendar className="h-4 w-4" />
          <span className="hidden xs:inline">{t('events.downloadIcs')}</span>
        </Button>
        {event.agendaEnFileName && (
          <Button variant="outline" size="sm" className="gap-1.5" asChild data-testid="button-download-agenda-en">
            <a href={`/api/events/${event.id}/agenda/en`} target="_blank" rel="noreferrer">
              <FileText className="h-4 w-4" />
              <span className="hidden xs:inline">{t('events.downloadAgendaEn')}</span>
            </a>
          </Button>
        )}
        {event.agendaArFileName && (
          <Button variant="outline" size="sm" className="gap-1.5" asChild data-testid="button-download-agenda-ar">
            <a href={`/api/events/${event.id}/agenda/ar`} target="_blank" rel="noreferrer">
              <FileText className="h-4 w-4" />
              <span className="hidden xs:inline">{t('events.downloadAgendaAr')}</span>
            </a>
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {event.category && (
          <Badge data-testid="badge-event-category">
            {getBilingualContent(event.category, event.categoryAr)}
          </Badge>
        )}
        {sourceLabel && (
          <Badge variant="outline" data-testid="badge-event-source">{sourceLabel}</Badge>
        )}
        {event.isArchived && (
          <Link href={`/archive/${event.id}`}>
            <Badge 
              className="cursor-pointer bg-amber-500 hover:bg-amber-600 text-white gap-1"
              data-testid="badge-event-archived"
            >
              <Archive className="h-3 w-3" />
              {t('archive.badge')}
            </Badge>
          </Link>
        )}
      </div>
      {(event.description || event.descriptionAr) && (
        <p className="text-sm text-muted-foreground" data-testid="text-event-description">
          {getBilingualContent(event.description, event.descriptionAr)}
        </p>
      )}
      <div className="grid gap-3 text-sm">
        <div data-testid="text-event-location">
          <span className="font-medium">{t('events.location')}:</span>{' '}
          {getBilingualContent(event.location, event.locationAr)}
        </div>
        {event.url && (
          <div className="break-all">
            <span className="font-medium">{t('events.details')}:</span>{' '}
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
              data-testid="link-event-url"
            >
              {event.url}
            </a>
          </div>
        )}
      </div>
      {/* Speakers Section for public view */}
      <SpeakersSection />
    </>
  );

  // Simple view for public/stakeholder users - uses Drawer on mobile, Dialog on desktop
  if (!isAdmin) {
    if (isMobile) {
      return (
        <Drawer open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
          <DrawerContent data-testid="dialog-event-details" className="max-h-[85vh] overflow-y-auto">
            <DrawerHeader className="text-left">
              <DrawerTitle className="text-lg leading-tight" data-testid="text-event-name">
                {getBilingualContent(event.name, event.nameAr)}
              </DrawerTitle>
              <DrawerDescription className="mt-1">
                {formatDateRange(event)}
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6 space-y-4">
              <PublicEventContent />
            </div>
          </DrawerContent>
        </Drawer>
      );
    }

    return (
      <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent data-testid="dialog-event-details" className="w-[calc(100vw-2rem)] max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden flex flex-col gap-4">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-lg leading-tight" data-testid="text-event-name">
              {getBilingualContent(event.name, event.nameAr)}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {formatDateRange(event)}
            </DialogDescription>
          </DialogHeader>
          <PublicEventContent />
        </DialogContent>
      </Dialog>
    );
  }

  // Enhanced view for admins with tabs
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden" data-testid="dialog-event-details">
        <DialogHeader className="space-y-3">
          <div>
            <DialogTitle className="text-lg leading-tight" data-testid="text-event-name">
              {getBilingualContent(event.name, event.nameAr)}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {formatDateRange(event)}
            </DialogDescription>
          </div>
          {/* Admin-only: View Full Details button */}
          {isAdmin && (
            <Button
              variant="default"
              className="w-full gap-2"
              onClick={() => {
                onClose();
                setLocation(`/admin/events/${event.id}`);
              }}
              data-testid="button-view-full-details"
            >
              <ExternalLink className="h-4 w-4" />
              {t('events.viewFullDetails', 'View Full Details & Manage Attendees')}
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={handleDownloadIcs}
                data-testid="button-export-ics"
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">{t('events.downloadIcs')}</span>
              </Button>
              {event.agendaEnFileName && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  asChild
                  data-testid="button-download-agenda-en"
                >
                  <a href={`/api/events/${event.id}/agenda/en`} target="_blank" rel="noreferrer">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('events.downloadAgendaEn')}</span>
                  </a>
                </Button>
              )}
              {event.agendaArFileName && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  asChild
                  data-testid="button-download-agenda-ar"
                >
                  <a href={`/api/events/${event.id}/agenda/ar`} target="_blank" rel="noreferrer">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('events.downloadAgendaAr')}</span>
                  </a>
                </Button>
              )}
              {/* Archive button for admins - only show for internal (non-scraped), non-archived events */}
              {isAdmin && !event.isScraped && !event.isArchived && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                  onClick={() => setArchiveDialogOpen(true)}
                  data-testid="button-archive-event"
                >
                  <Trophy className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('archive.alHasad')}</span>
                </Button>
              )}
              {isSuperAdmin && onEdit && onDelete && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      onEdit(event);
                      onClose();
                    }}
                    data-testid="button-edit-event"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('common.edit')}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      onDelete(event);
                      onClose();
                    }}
                    data-testid="button-delete-event"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('common.delete')}</span>
                  </Button>
                </>
              )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details" data-testid="tab-details">{t('events.details')}</TabsTrigger>
            <TabsTrigger value="stakeholders" data-testid="tab-stakeholders-tasks">{t('events.stakeholdersAndTasks')}</TabsTrigger>
            <TabsTrigger value="files" data-testid="tab-files">
              <FolderOpen className="h-4 w-4 mr-1" />
              {t('files.title', 'Files')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 overflow-hidden">
            <div className="flex flex-wrap gap-2">
              {event.category && (
                <Badge data-testid="badge-event-category">
                  {getBilingualContent(event.category, event.categoryAr)}
                </Badge>
              )}
              {sourceLabel && (
                <Badge variant="outline" data-testid="badge-event-source">{sourceLabel}</Badge>
              )}
              {event.isArchived && (
                <Link href={`/archive/${event.id}`}>
                  <Badge 
                    className="cursor-pointer bg-amber-500 hover:bg-amber-600 text-white gap-1"
                    data-testid="badge-event-archived"
                  >
                    <Archive className="h-3 w-3" />
                    {t('archive.badge')}
                  </Badge>
                </Link>
              )}
            </div>
            {(event.description || event.descriptionAr) && (
              <div className="overflow-hidden">
                <h3 className="font-semibold mb-2">{t('events.description')}</h3>
                <p className="text-sm text-muted-foreground break-words" data-testid="text-event-description">
                  {getBilingualContent(event.description, event.descriptionAr)}
                </p>
              </div>
            )}
            <div className="grid gap-3 text-sm overflow-hidden">
              <div data-testid="text-event-location" className="break-words">
                <span className="font-medium">{t('events.location')}:</span>{' '}
                {getBilingualContent(event.location, event.locationAr)}
              </div>
              {event.url && (
                <div className="break-all">
                  <span className="font-medium">{t('events.details')}:</span>{' '}
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                    data-testid="link-event-url"
                  >
                    {event.url}
                  </a>
                </div>
              )}
            </div>
            {/* Speakers Section */}
            <SpeakersSection />
          </TabsContent>

          <TabsContent value="stakeholders" className="space-y-4">
            {isLoadingStakeholders ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : stakeholders.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">{t('events.noStakeholders')}</p>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {stakeholders.map((es) => (
                  <AccordionItem key={es.id} value={`stakeholder-${es.id}`} data-testid={`accordion-stakeholder-${es.id}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex flex-col items-start text-start">
                        <span className="font-semibold" data-testid={`text-stakeholder-name-${es.id}`}>
                          {isArabic && es.stakeholder.nameAr ? es.stakeholder.nameAr : es.stakeholder.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t('tasks.taskCountLabel', { count: es.tasks.length })}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        {/* Stakeholder Info */}
                        <Card>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start gap-2">
                              <Mail className="h-4 w-4 text-primary mt-0.5" />
                              <div className="flex-1">
                                <label className="text-xs font-medium text-muted-foreground">{t('departments.emailAddresses')}</label>
                                <p className="text-sm mt-1" data-testid={`text-stakeholder-emails-${es.id}`}>
                                  {es.emails.map(e => e.email).join(', ')}
                                </p>
                              </div>
                            </div>
                            
                            {es.selectedRequirementIds && es.selectedRequirementIds.length > 0 && (
                              <div className="flex items-start gap-2">
                                <FileText className="h-4 w-4 text-primary mt-0.5" />
                                <div className="flex-1">
                                  <label className="text-xs font-medium text-muted-foreground">{t('departments.selectedRequirements')}</label>
                                  <p className="text-sm mt-1" data-testid={`text-stakeholder-requirements-${es.id}`}>
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
                                  <label className="text-xs font-medium text-muted-foreground">{t('departments.customRequirements')}</label>
                                  <p className="text-sm mt-1 whitespace-pre-wrap" data-testid={`text-stakeholder-custom-requirements-${es.id}`}>
                                    {es.customRequirements}
                                  </p>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Tasks */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2">{t('tasks.tasks')}</h4>
                          {es.tasks.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4 bg-muted rounded-md">
                              {t('tasks.noTasks')}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {es.tasks.map((task) => (
                                <Card key={task.id} data-testid={`card-task-${task.id}`} className="hover-elevate">
                                  <CardContent className="p-3">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div className="flex-1">
                                        <h5 className="font-semibold text-sm mb-1" data-testid={`text-task-title-${task.id}`}>
                                          {task.title}
                                        </h5>
                                        {task.description && (
                                          <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-task-description-${task.id}`}>
                                            {task.description}
                                          </p>
                                        )}
                                      </div>
                                      <Badge 
                                        className={getStatusBadgeColor(task.status)}
                                        data-testid={`badge-task-status-${task.id}`}
                                      >
                                        {t(`tasks.status.${task.status}`)}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t">
                                      {task.dueDate && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <Calendar className="h-3 w-3" />
                                          <span data-testid={`text-task-due-date-${task.id}`}>
                                            {t('tasks.due')}: {format(parseISO(task.dueDate), isArabic ? 'MMM d yyyy' : 'MMM d, yyyy', { locale })}
                                          </span>
                                        </div>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          console.log('[EventDetailModal] Navigating to task:', task.id);
                                          setLocation(`/admin/tasks?taskId=${task.id}`);
                                          onClose();
                                        }}
                                        data-testid={`button-view-task-${task.id}`}
                                        className="ms-auto"
                                      >
                                        {t('tasks.viewDetails')} →
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t('files.quickAccess', 'Quick File Management')}</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  setLocation(`/admin/events/${event.id}/files`);
                }}
                className="gap-2"
              >
                <FolderOpen className="h-4 w-4" />
                {t('files.viewAllFiles', 'View All Files')}
              </Button>
            </div>
            <EventFileManager 
              eventId={event.id} 
              eventName={isArabic ? event.nameAr || event.name : event.name}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Archive Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              {t('archive.archiveDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('archive.archiveDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t('archive.archiveDialog.actualAttendees')}</Label>
              <Input
                type="number"
                value={archiveFormData.actualAttendees}
                onChange={(e) => setArchiveFormData(prev => ({ ...prev, actualAttendees: e.target.value }))}
                placeholder={event?.expectedAttendance?.toString() || '500'}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('archive.archiveDialog.highlightsEn')}</Label>
                <Textarea
                  value={archiveFormData.highlights}
                  onChange={(e) => setArchiveFormData(prev => ({ ...prev, highlights: e.target.value }))}
                  rows={3}
                  placeholder={t('archive.archiveDialog.highlightsEnPlaceholder')}
                />
              </div>
              <div>
                <Label>{t('archive.archiveDialog.highlightsAr')}</Label>
                <Textarea
                  value={archiveFormData.highlightsAr}
                  onChange={(e) => setArchiveFormData(prev => ({ ...prev, highlightsAr: e.target.value }))}
                  rows={3}
                  dir="rtl"
                  placeholder={t('archive.archiveDialog.highlightsArPlaceholder')}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('archive.archiveDialog.addMoreLater')}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setArchiveDialogOpen(false);
              setArchiveFormData({ actualAttendees: '', highlights: '', highlightsAr: '' });
            }}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleArchiveEvent}
              disabled={archiveEventMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {archiveEventMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                  {t('archive.archiveDialog.archiving')}
                </>
              ) : (
                <>
                  <Trophy className="h-4 w-4 me-2" />
                  {t('archive.archiveDialog.archiveToAlHasad')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
