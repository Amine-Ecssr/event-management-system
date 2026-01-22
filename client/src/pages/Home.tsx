import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { addMonths, subMonths, addQuarters, subQuarters, addYears, subYears, parseISO, isSameMonth, setMonth, setYear, getYear, startOfMonth, endOfMonth } from 'date-fns';
import { Event, ViewMode, CalendarViewMode } from '@/lib/types';
import MonthNavigation from '@/components/MonthNavigation';
import { ShadcnMultiMonthCalendar, ShadcnEventList } from '@/components/calendar';
import EventDetailModal from '@/components/EventDetailModal';
import EventForm from '@/components/EventForm';
import ViewModeSelector from '@/components/ViewModeSelector';
import FilterPanel from '@/components/FilterPanel';
import FilterChips from '@/components/FilterChips';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
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
import { Settings, Download, Filter, ChevronLeft, ChevronRight, LogIn, ClipboardList, Plus, Upload, Trash, Pencil, Trash2, Archive, Home as HomeIcon } from 'lucide-react';
import { Link, useLocation, useSearch } from 'wouter';
import { exportEventsToCSV } from '@/lib/csvExport';
import { parseCSV, validateEventRow, csvRowToEvent } from '@/lib/csvImport';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useFilters } from '@/hooks/use-filters';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { queryClient, apiRequest } from '@/lib/queryClient';
import ecssrLogo from '@assets/ecssr-logo.png';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function Home() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>('calendar');
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>('monthly');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [eventListCollapsed, setEventListCollapsed] = useState(() => {
    const saved = localStorage.getItem('eventListCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  
  // Admin state
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { filters, hasActiveFilters } = useFilters();
  const { t } = useTranslation();
  const searchParams = useSearch();
  const [, navigate] = useLocation();
  
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  
  // Check URL params to auto-open event form
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (params.get('new') === 'true' && isAdmin && !showForm) {
      setShowForm(true);
      // Remove the param from URL without adding to history
      navigate('/calendar', { replace: true });
    }
  }, [searchParams, isAdmin, showForm, navigate]);
  const isSuperAdmin = user?.role === 'superadmin';
  
  const { data: allEvents = [], isLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });
  
  const { data: settings } = useQuery<{ publicCsvExport: boolean; archiveEnabled?: boolean }>({
    queryKey: ['/api/settings'],
  });

  // Show export button if user is authenticated OR public export is enabled
  const showExportButton = user || settings?.publicCsvExport;
  const archiveEnabled = settings?.archiveEnabled !== false;

  // Admin mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/events', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setShowForm(false);
      toast({
        title: t('messages.success'),
        description: t('events.eventCreated'),
      });
    },
    onError: () => {
      toast({
        title: t('messages.error'),
        description: t('events.eventCreateError'),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest('PATCH', `/api/events/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setEditingEvent(null);
      toast({
        title: t('messages.success'),
        description: t('events.eventUpdated'),
      });
    },
    onError: () => {
      toast({
        title: t('messages.error'),
        description: t('events.eventUpdateError'),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setDeletingEvent(null);
      toast({
        title: t('messages.success'),
        description: t('events.eventDeleted'),
      });
    },
    onError: () => {
      toast({
        title: t('messages.error'),
        description: t('events.eventDeleteError'),
        variant: 'destructive',
      });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', '/api/events');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setShowDeleteAllDialog(false);
      setDeleteConfirmText('');
      toast({
        title: t('messages.success'),
        description: t('events.allEventsDeletedDesc'),
      });
    },
    onError: () => {
      toast({
        title: t('messages.error'),
        description: t('events.allEventsDeleteError'),
        variant: 'destructive',
      });
    },
  });

  // Filter events using the new filter system
  const events = allEvents.filter((event) => {
    const eventStart = parseISO(event.startDate);
    const eventEnd = parseISO(event.endDate);
    
    // Filter by categories (now using categoryId)
    if (filters.selectedCategories.length > 0) {
      if (!event.categoryId || !filters.selectedCategories.includes(String(event.categoryId))) {
        return false;
      }
    }
    
    // Filter by event types
    if (filters.selectedEventTypes.length > 0) {
      if (!filters.selectedEventTypes.includes(event.eventType)) {
        return false;
      }
    }
    
    // Filter by event scopes
    if (filters.selectedEventScopes.length > 0) {
      if (!filters.selectedEventScopes.includes(event.eventScope)) {
        return false;
      }
    }
    
    // Filter by source
    if (filters.selectedSources.length > 0) {
      const eventSource = event.source || 'manual';
      if (!filters.selectedSources.includes(eventSource)) {
        return false;
      }
    }
    
    // Filter by date (if a specific date is selected, show events that overlap with that date)
    if (filters.selectedDate) {
      const filterDate = parseISO(filters.selectedDate);
      const eventOverlapsDate = eventStart <= filterDate && eventEnd >= filterDate;
      if (!eventOverlapsDate) return false;
    }
    
    return true;
  });
  
  // Debug logging
  console.log('[Home] Active filters:', filters);
  console.log('[Home] Total events:', allEvents.length);
  console.log('[Home] Filtered events:', events.length);
  if (allEvents.length > 0) {
    console.log('[Home] Sample event:', allEvents[0]);
  }

  const handlePreviousMonth = () => {
    setCurrentDate(prev => {
      switch (calendarViewMode) {
        case 'monthly':
          return subMonths(prev, 1);
        case 'quarterly':
          return subQuarters(prev, 1);
        case 'bi-annually':
          return subMonths(prev, 6);
        case 'yearly':
          return subYears(prev, 1);
        default:
          return subMonths(prev, 1);
      }
    });
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => {
      switch (calendarViewMode) {
        case 'monthly':
          return addMonths(prev, 1);
        case 'quarterly':
          return addQuarters(prev, 1);
        case 'bi-annually':
          return addMonths(prev, 6);
        case 'yearly':
          return addYears(prev, 1);
        default:
          return addMonths(prev, 1);
      }
    });
  };

  const handleExportCSV = () => {
    try {
      exportEventsToCSV(events);
      toast({
        title: t('csvExport.exportSuccessful'),
        description: t('csvExport.exportSuccessfulDesc'),
      });
    } catch (error) {
      toast({
        title: t('csvExport.exportFailed'),
        description: t('csvExport.exportFailedDesc'),
        variant: "destructive",
      });
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'Name', 'Name (Arabic)',
      'Description', 'Description (Arabic)',
      'Start Date', 'Start Time',
      'End Date', 'End Time',
      'Location', 'Location (Arabic)',
      'Organizers', 'Organizers (Arabic)',
      'Category', 'Category (Arabic)',
      'URL', 'Event Type', 'Event Scope'
    ];
    const csvContent = headers.join(',') + '\n';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'events-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: t('messages.templateDownloaded'),
      description: t('messages.templateDownloadedDesc'),
    });
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
  };

  // Admin handlers
  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      const errors: string[] = [];
      const validEvents: any[] = [];
      
      rows.forEach((row, index) => {
        const validation = validateEventRow(row, index + 2);
        if (!validation.valid) {
          errors.push(...validation.errors);
        } else {
          validEvents.push(csvRowToEvent(row));
        }
      });
      
      if (errors.length > 0) {
        toast({
          title: t('csvImport.errors'),
          description: errors.slice(0, 5).join('\n'),
          variant: 'destructive',
        });
        setIsImporting(false);
        return;
      }
      
      for (const eventData of validEvents) {
        await apiRequest('POST', '/api/events', eventData);
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast({
        title: t('csvImport.successfullyImported'),
        description: t('csvImport.importedCount', { count: validEvents.length }),
      });
    } catch (error) {
      toast({
        title: t('csvImport.failed'),
        description: t('csvImport.failedDesc'),
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
  };

  const handleDelete = (event: Event) => {
    setDeletingEvent(event);
  };

  const handleDeleteAll = () => {
    if (deleteConfirmText === t('home.deleteAllEventsPhrase')) {
      deleteAllMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - only show for non-authenticated users */}
      {!user && (
        <header className="border-b bg-card sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img 
                  src={ecssrLogo} 
                  alt="ECSSR Logo" 
                  className="h-10 w-auto flex-shrink-0"
                  data-testid="img-ecssr-logo"
                />
                <div className="hidden md:block">
                  <h1 className="text-lg md:text-xl font-semibold">
                    {t('navigation.eventsCalendar')}
                  </h1>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href="/">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    data-testid="link-home"
                  >
                    <HomeIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('navigation.home')}</span>
                  </Button>
                </Link>
                {archiveEnabled && (
                  <Link href="/archive">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      data-testid="link-archive"
                    >
                      <Archive className="h-4 w-4" />
                      <span className="hidden sm:inline">{t('navigation.archive')}</span>
                    </Button>
                  </Link>
                )}
                <LanguageSwitcher />
                <ThemeToggle />
                {showExportButton && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={handleExportCSV}
                    data-testid="button-export-csv"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('common.export')}</span>
                  </Button>
                )}
                <Link href="/login">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2"
                    data-testid="link-login"
                  >
                    <LogIn className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('auth.signIn')}</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Admin Action Bar */}
        {isAdmin && (
          <div className="mb-6 p-4 bg-card rounded-lg border">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={() => setShowForm(true)}
                data-testid="button-add-event"
              >
                <Plus className="h-4 w-4" />
                {t('events.addEvent')}
              </Button>
              {showExportButton && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleExportCSV}
                  data-testid="button-export-csv-admin"
                >
                  <Download className="h-4 w-4" />
                  {t('common.export')} CSV
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleDownloadTemplate}
                data-testid="button-download-template"
              >
                <Download className="h-4 w-4" />
                {t('csvImport.template')}
              </Button>
              <label htmlFor="csv-import">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  asChild
                  data-testid="button-import-csv"
                >
                  <span>
                    <Upload className="h-4 w-4" />
                    {t('csvImport.importCSV')}
                  </span>
                </Button>
                <input
                  id="csv-import"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCSVImport}
                  disabled={isImporting}
                />
              </label>
              {isSuperAdmin && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowDeleteAllDialog(true)}
                  data-testid="button-bulk-delete"
                >
                  <Trash className="h-4 w-4" />
                  {t('events.deleteAllEvents')}
                </Button>
              )}
            </div>
          </div>
        )}
        
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <MonthNavigation
            currentDate={currentDate}
            onPreviousMonth={handlePreviousMonth}
            onNextMonth={handleNextMonth}
            viewMode={calendarViewMode}
          />
          <ViewModeSelector
            currentMode={calendarViewMode}
            onModeChange={setCalendarViewMode}
          />
        </div>

        {/* Filter Section */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">{t('events.events')}</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  console.log('[Home] FILTER button clicked, showFilters:', !showFilters);
                  setShowFilters(!showFilters);
                }}
                data-testid="button-toggle-filters"
              >
                <Filter className="h-4 w-4" />
                <span>{t('common.filter').toUpperCase()}</span>
              </Button>
              
              {/* Toggle Event List Button - Desktop only */}
              <Button
                variant="outline"
                size="sm"
                className="hidden lg:flex gap-2"
                onClick={() => {
                  const newState = !eventListCollapsed;
                  setEventListCollapsed(newState);
                  localStorage.setItem('eventListCollapsed', String(newState));
                }}
                data-testid="button-toggle-event-list"
              >
                {eventListCollapsed ? (
                  <>
                    <ChevronLeft className="h-4 w-4" />
                    <span>{t('home.showList')}</span>
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-4 w-4" />
                    <span>{t('home.hideList')}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* Filter Chips - show when filters are active */}
          {hasActiveFilters && (
            <div className="py-2">
              <FilterChips />
            </div>
          )}
          
          {/* Filter Panel - show when toggled */}
          {showFilters && (
            <div className="py-2">
              <FilterPanel events={allEvents} />
            </div>
          )}
        </div>

        {/* Side-by-side Layout */}
        <div className="mt-6">
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground font-body">{t('events.loadingEvents')}</p>
            </div>
          ) : (
            <div className={`flex flex-col gap-6 ${eventListCollapsed ? 'lg:grid lg:grid-cols-1' : 'lg:grid lg:grid-cols-[1fr,400px]'}`}>
              {/* Calendar View - Modern (Shadcn) */}
              <div className="w-full">
                <ShadcnMultiMonthCalendar
                  currentDate={currentDate}
                  events={events}
                  onEventClick={handleEventClick}
                  hoveredEventId={hoveredEventId}
                  onEventHover={setHoveredEventId}
                  viewMode={calendarViewMode}
                />
              </div>
              
              {/* Event List - Modern (Shadcn) */}
              {!eventListCollapsed && (
                <div className="w-full lg:sticky lg:top-24 lg:self-start">
                  <div className="lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto">
                    <ShadcnEventList
                      events={events}
                      onEventClick={handleEventClick}
                      onEventHover={setHoveredEventId}
                      hoveredEventId={hoveredEventId}
                      currentDate={currentDate}
                      viewMode={calendarViewMode}
                      showAdminActions={isAdmin}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        open={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Admin Modals */}
      {isAdmin && (
        <>
          {/* Add/Edit Event Form Dialog */}
          <Dialog open={showForm || editingEvent !== null} onOpenChange={(open) => {
            if (!open) {
              setShowForm(false);
              setEditingEvent(null);
            }
          }}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEvent ? t('events.editEvent') : t('events.createEvent')}</DialogTitle>
              </DialogHeader>
              <EventForm
                event={editingEvent || undefined}
                onSubmit={(data) => {
                  if (editingEvent) {
                    updateMutation.mutate({ id: editingEvent.id, data });
                  } else {
                    createMutation.mutate(data);
                  }
                }}
                onCancel={() => {
                  setShowForm(false);
                  setEditingEvent(null);
                }}
                isSubmitting={createMutation.isPending || updateMutation.isPending}
              />
            </DialogContent>
          </Dialog>

          {/* Delete Event Dialog */}
          <AlertDialog open={deletingEvent !== null} onOpenChange={(open) => {
            if (!open) setDeletingEvent(null);
          }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('events.deleteEvent')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('home.deleteEventConfirm', { eventName: deletingEvent?.name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (deletingEvent) {
                      deleteMutation.mutate(deletingEvent.id);
                    }
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Bulk Delete All Dialog */}
          {isSuperAdmin && (
            <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('home.deleteAllEventsTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('home.deleteAllEventsWarning')}
                    <br /><br />
                    {t('home.deleteAllEventsConfirm')} <strong>{t('home.deleteAllEventsPhrase')}</strong>:
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={t('home.deleteAllEventsPlaceholder')}
                  data-testid="input-delete-confirm"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => {
                    setDeleteConfirmText('');
                  }}>
                    {t('common.cancel')}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAll}
                    disabled={deleteConfirmText !== t('home.deleteAllEventsPhrase')}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t('events.deleteAllEvents')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </>
      )}
    </div>
  );
}
