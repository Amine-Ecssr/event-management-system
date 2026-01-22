import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Event } from '@/lib/types';
import EventForm from '@/components/EventForm';
import EventDetailModal from '@/components/EventDetailModal';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Plus, Calendar, ChevronLeft, ChevronRight, Globe, MapPin, Upload, Trash, Download, LogOut, Key, UserPlus, Bell, Eye, Filter } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { format, parseISO, isSameMonth, setMonth, setYear, getYear } from 'date-fns';
import { useLocation } from 'wouter';
import { parseCSV, validateEventRow, csvRowToEvent } from '@/lib/csvImport';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';
import { LoadingState, ListLoadingSkeleton } from '@/components/ui/loading-state';
import { NoEventsEmptyState } from '@/components/ui/empty-state';
import { PageContainer, PageContent, PageSection } from '@/components/ui/page-container';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ExportButton } from '@/components/ExportButton';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function Events() {
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
  const [viewingEvent, setViewingEvent] = useState<Event | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<string | null>(null);
  const [selectedEventScope, setSelectedEventScope] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  
  const isSuperAdmin = user?.role === 'superadmin';

  // Redirect department users to their dashboard - they shouldn't access admin page
  useEffect(() => {
    if (user && (user.role === 'department' || user.role === 'stakeholder' || user.role === 'department_admin')) {
      setLocation('/stakeholder-dashboard');
    }
  }, [user, setLocation]);

  // Block rendering if stakeholder or department
  if (user && (user.role === 'department' || user.role === 'stakeholder' || user.role === 'department_admin')) {
    return <div>Redirecting...</div>;
  }

  const { data: allEvents = [], isLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  const { data: settings } = useQuery<{
    publicCsvExport: boolean;
  }>({
    queryKey: ['/api/settings/admin'],
  });


  const updateSettingsMutation = useMutation({
    mutationFn: async (data: {
      publicCsvExport?: boolean;
    }) => {
      return await apiRequest('PATCH', '/api/settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/admin'] });
      toast({
        title: t('common.success'),
        description: t('events.settingsUpdated'),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('events.failedToUpdateSettings'),
        variant: 'destructive',
      });
    },
  });



  // Get unique categories from events
  const categories = Array.from(
    new Set(
      allEvents
        .map(event => event.category)
        .filter(Boolean)
    )
  ).sort();

  // Filter events by selected month, year, category, event type, and event scope
  const events = allEvents.filter((event) => {
    const eventStart = parseISO(event.startDate);
    const eventEnd = parseISO(event.endDate);
    
    // Filter by year first
    const eventStartYear = getYear(eventStart);
    const eventEndYear = getYear(eventEnd);
    const yearMatches = eventStartYear === selectedYear || eventEndYear === selectedYear;
    
    if (!yearMatches) return false;
    
    // Filter by month
    if (selectedMonth !== null) {
      const filterDate = setMonth(setYear(new Date(), selectedYear), selectedMonth);
      const monthMatches = isSameMonth(eventStart, filterDate) || 
                          isSameMonth(eventEnd, filterDate) ||
                          (eventStart < filterDate && eventEnd > filterDate);
      if (!monthMatches) return false;
    }
    
    // Filter by category
    if (selectedCategory !== null && event.category !== selectedCategory) {
      return false;
    }
    
    // Filter by event type
    if (selectedEventType !== null && event.eventType !== selectedEventType) {
      return false;
    }
    
    // Filter by event scope
    if (selectedEventScope !== null && event.eventScope !== selectedEventScope) {
      return false;
    }
    
    // Filter by source
    if (selectedSource !== null && event.source !== selectedSource) {
      return false;
    }
    
    return true;
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest('POST', '/api/events', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setShowForm(false);
      toast({
        title: t('common.success'),
        description: t('events.eventCreatedSuccess'),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('events.failedToCreateEvent'),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      return await apiRequest('PATCH', `/api/events/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setEditingEvent(null);
      toast({
        title: t('common.success'),
        description: t('events.eventUpdatedSuccess'),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('events.failedToUpdateEvent'),
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
        title: t('common.success'),
        description: t('events.eventDeletedSuccess'),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('events.failedToDeleteEvent'),
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
      toast({
        title: t('events.allEventsDeleted'),
        description: t('events.allEventsDeletedSuccess'),
      });
      setShowDeleteAllDialog(false);
      setDeleteConfirmText('');
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('events.failedToDeleteAllEvents'),
      });
    },
  });

  const handleSubmit = (data: FormData) => {
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (deletingEvent) {
      deleteMutation.mutate(deletingEvent.id);
    }
  };

  const handleDeleteAll = () => {
    if (deleteConfirmText === 'delete') {
      deleteAllMutation.mutate();
    }
  };

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        let csvText = e.target?.result as string;
        
        // Remove UTF-8 BOM if present
        if (csvText.charCodeAt(0) === 0xFEFF) {
          csvText = csvText.slice(1);
        }
        
        const rows = parseCSV(csvText);
        
        if (rows.length === 0) {
          toast({
            variant: 'destructive',
            title: t('events.emptyFile'),
            description: t('events.emptyFileDesc'),
          });
          setIsImporting(false);
          event.target.value = '';
          return;
        }
        
        const errors: string[] = [];
        const validEvents: any[] = [];

        rows.forEach((row, index) => {
          const validation = validateEventRow(row, index + 2); // +2 because row 1 is headers
          if (!validation.valid) {
            errors.push(...validation.errors);
          } else {
            validEvents.push(csvRowToEvent(row));
          }
        });

        if (errors.length > 0) {
          // Show detailed errors in console
          console.error('CSV Validation Errors:');
          errors.forEach(error => console.error('  - ' + error));
          
          // Show first few errors in toast
          const errorPreview = errors.slice(0, 3).join('\n');
          const moreErrors = errors.length > 3 ? `\n...and ${errors.length - 3} more` : '';
          
          toast({
            variant: 'destructive',
            title: t('events.validationFailed', { count: errors.length, plural: errors.length > 1 ? 's' : '' }),
            description: errorPreview + moreErrors + '\n\n' + t('events.checkConsole'),
            duration: 10000, // Show for 10 seconds
          });
          setIsImporting(false);
          event.target.value = '';
          return;
        }

        // Import all valid events
        let successCount = 0;
        let failCount = 0;
        const importErrors: string[] = [];

        for (const eventData of validEvents) {
          try {
            await apiRequest('POST', '/api/events', eventData);
            successCount++;
          } catch (error: any) {
            failCount++;
            const errorMsg = `Failed to import "${eventData.name}": ${error.message || 'Unknown error'}`;
            importErrors.push(errorMsg);
            console.error(errorMsg, error);
          }
        }

        queryClient.invalidateQueries({ queryKey: ['/api/events'] });

        if (failCount > 0) {
          console.error('Import Errors:', importErrors);
        }

        toast({
          title: failCount === 0 ? t('events.importSuccessful') : t('events.importCompletedWithErrors'),
          description: t('events.importedCount', { successCount, failCount: failCount > 0 ? `. ${failCount} ${t('events.failed')} - ${t('events.checkConsoleForDetails')}` : '.' }),
          variant: failCount > 0 ? 'destructive' : 'default',
        });

      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        toast({
          variant: 'destructive',
          title: t('events.importFailed'),
          description: t('events.importFailedDesc', { errorMessage }),
          duration: 10000,
        });
        console.error('CSV Import Error:', error);
      } finally {
        setIsImporting(false);
        event.target.value = ''; // Reset file input
      }
    };

    reader.onerror = () => {
      toast({
        variant: 'destructive',
        title: t('events.fileReadError'),
        description: t('events.fileReadErrorDesc'),
      });
      setIsImporting(false);
      event.target.value = '';
    };

    // Read as UTF-8 text
    reader.readAsText(file, 'UTF-8');
  };

  const handleDownloadTemplate = () => {
    // Use the same headers as the export function for consistency
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
      title: t('events.templateDownloaded'),
      description: t('events.templateDownloadedDesc'),
    });
  };

  return (
    <div className="p-6">
      <PageHeader
        title={t('events.eventManagement')}
        subtitle={t('events.eventManagementDesc')}
        icon={Calendar}
        iconColor="text-primary"
      >
        <ExportButton
          entityType="events"
          variant="ghost"
          size="sm"
        />
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={handleDownloadTemplate}
          data-testid="button-download-template"
          title="Download a blank CSV template to fill in"
        >
          <Download className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">{t('events.template')}</span>
        </Button>
        <label htmlFor="csv-upload">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            disabled={isImporting}
            data-testid="button-import-csv"
            asChild
            title="Import events from CSV file (UTF-8 encoding). Press F12 to see detailed error messages if import fails."
          >
            <span>
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">{isImporting ? t('events.importing') : t('events.importCSV')}</span>
            </span>
          </Button>
        </label>
        <Input
          id="csv-upload"
          type="file"
          accept=".csv"
          onChange={handleCSVImport}
          className="hidden"
          data-testid="input-csv-upload"
        />
        {isSuperAdmin && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setShowDeleteAllDialog(true)}
            data-testid="button-delete-all"
          >
            <Trash className="h-4 w-4" />
            <span className="hidden sm:inline">{t('events.deleteAll')}</span>
          </Button>
        )}
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            setEditingEvent(null);
            setShowForm(true);
          }}
          data-testid="button-add-event"
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">{t('events.addEvent')}</span>
        </Button>
      </PageHeader>

      {/* Month/Year Filter */}
      <div className="border rounded-lg p-4 mb-6 bg-card">
        <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground">{t('filters.filterByMonth')}</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedYear(selectedYear - 1)}
                data-testid="button-prev-year"
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold min-w-[4rem] text-center" data-testid="text-selected-year">
                {selectedYear}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedYear(selectedYear + 1)}
                data-testid="button-next-year"
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
            <Button
              variant={selectedMonth === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMonth(null)}
              className="col-span-6 md:col-span-12"
              data-testid="button-month-all"
            >
              All Months
            </Button>
            {MONTHS.map((month, index) => (
              <Button
                key={month}
                variant={selectedMonth === index ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedMonth(index)}
                data-testid={`button-month-${index}`}
              >
                {month}
              </Button>
            ))}
          </div>
          
          {/* Category, Event Type, and Event Scope Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('filters.filterByCategory')}</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  data-testid="button-category-all"
                >
                  {t('events.allCategories')}
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category || null)}
                    data-testid={`button-category-${category?.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('filters.filterByEventType')}</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedEventType === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedEventType(null)}
                  data-testid="button-eventtype-all"
                >
                  {t('events.allTypes')}
                </Button>
                <Button
                  variant={selectedEventType === 'local' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedEventType('local')}
                  data-testid="button-eventtype-local"
                >
                  {t('events.localEvents')}
                </Button>
                <Button
                  variant={selectedEventType === 'international' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedEventType('international')}
                  data-testid="button-eventtype-international"
                >
                  {t('events.internationalEvents')}
                </Button>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('filters.filterByEventScope')}</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedEventScope === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedEventScope(null)}
                  data-testid="button-eventscope-all"
                >
                  {t('events.allEvents')}
                </Button>
                <Button
                  variant={selectedEventScope === 'internal' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedEventScope('internal')}
                  data-testid="button-eventscope-internal"
                >
                  {t('events.internalEvents')}
                </Button>
                <Button
                  variant={selectedEventScope === 'external' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedEventScope('external')}
                  data-testid="button-eventscope-external"
                >
                  {t('events.externalEvents')}
                </Button>
              </div>
            </div>
          </div>
        </div>

      {/* Main Content */}
      <div>
        {isLoading ? (
          <LoadingState
            fullPage
            size="lg"
            text={t('common.loading')}
          />
        ) : events.length === 0 ? (
          <div className="py-12">
            <NoEventsEmptyState
              onAction={() => {
                setEditingEvent(null);
                setShowForm(true);
              }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="event-management-list">
            {events.map((event) => (
              <Card key={event.id} className="group hover:shadow-md hover:border-primary/20 transition-all duration-200">
                <CardContent className="p-5">
                  <div className="flex-1 mb-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 
                        className="text-base font-semibold text-foreground cursor-pointer hover:text-primary transition-colors line-clamp-2"
                        onClick={() => setLocation(`/admin/events/${event.id}`)}
                        title="View event details"
                      >
                        {event.name}
                      </h3>
                      <Badge
                        variant="secondary"
                        className={`shrink-0 text-xs ${
                          event.eventType === 'international'
                            ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                            : 'bg-green-500/10 text-green-600 border-green-500/20'
                        }`}
                      >
                        {event.eventType === 'international' ? (
                          <><Globe className="h-3 w-3 mr-1" />{t('events.intl')}</>
                        ) : (
                          <><MapPin className="h-3 w-3 mr-1" />{t('events.local')}</>
                        )}
                      </Badge>
                    </div>
                    <div className="space-y-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {format(parseISO(event.startDate), 'MMM d, yyyy')} - {format(parseISO(event.endDate), 'MMM d, yyyy')}
                        </span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="line-clamp-1">{event.location}</span>
                        </div>
                      )}
                      {event.category && (
                        <Badge variant="outline" className="text-xs mt-2">
                          {event.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-3 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation(`/admin/events/${event.id}`)}
                      data-testid={`button-view-event-${event.id}`}
                      className="h-8"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      {t('common.view')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingEvent(event)}
                      data-testid={`button-edit-${event.id}`}
                      className="h-8"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingEvent(event)}
                      data-testid={`button-delete-${event.id}`}
                      className="h-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm || editingEvent !== null} onOpenChange={(open) => {
        if (!open) {
          setShowForm(false);
          setEditingEvent(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-event-form">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold font-heading">
              {editingEvent ? t('events.editEvent') : t('events.createNewEvent')}
            </DialogTitle>
            <DialogDescription>
              {editingEvent ? t('events.editEventDesc') : t('events.createNewEventDesc')}
            </DialogDescription>
          </DialogHeader>
          <EventForm
            event={editingEvent || undefined}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingEvent(null);
            }}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deletingEvent !== null} onOpenChange={(open) => {
        if (!open) setDeletingEvent(null);
      }}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('events.areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('events.deleteEventConfirm', { name: deletingEvent?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={showDeleteAllDialog} onOpenChange={(open) => {
        if (!open) {
          setShowDeleteAllDialog(false);
          setDeleteConfirmText('');
        }
      }}>
        <AlertDialogContent data-testid="dialog-delete-all-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('events.deleteAllTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('events.deleteAllDescription', { count: allEvents.length })}
              <br /><br />
              {t('events.deleteAllConfirmPrompt')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={t('events.deleteAllPlaceholder')}
            data-testid="input-delete-confirm"
            className="my-4"
          />
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-all">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deleteConfirmText !== 'delete'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-confirm-delete-all"
            >
              {t('events.deleteAllButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Event Detail Modal */}
      <EventDetailModal
        event={viewingEvent}
        open={viewingEvent !== null}
        onClose={() => setViewingEvent(null)}
        onEdit={(event) => setEditingEvent(event)}
        onDelete={(event) => setDeletingEvent(event)}
      />
    </div>
  );
}
