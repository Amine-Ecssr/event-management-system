import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseISO, format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ArchivedEvent, Event, Category } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ListLoadingSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calendar,
  Users,
  Image,
  Video,
  Search,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Archive,
  RotateCcw,
  CheckCircle,
  XCircle,
  ExternalLink,
  FileSpreadsheet,
  Download,
  AlertCircle,
  PlusCircle,
  Trophy,
  Mic,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { PageHeader } from '@/components/PageHeader';
import ArchivedEventSpeakersManager from '@/components/ArchivedEventSpeakersManager';
import { useAuth } from '@/hooks/use-auth';

export default function AdminArchive() {
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if not admin or superadmin
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    setLocation('/');
    return null;
  }
  const isArabic = i18n.language === 'ar' || language === 'ar';
  const locale = isArabic ? ar : undefined;
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const limit = 20;

  // Dialogs state
  const [archiveEventDialogOpen, setArchiveEventDialogOpen] = useState(false);
  const [selectedEventToArchive, setSelectedEventToArchive] = useState<Event | null>(null);
  const [editingArchive, setEditingArchive] = useState<ArchivedEvent | null>(null);
  const [deletingArchive, setDeletingArchive] = useState<ArchivedEvent | null>(null);
  const [photoUploadArchive, setPhotoUploadArchive] = useState<ArchivedEvent | null>(null);
  const [createDirectDialogOpen, setCreateDirectDialogOpen] = useState(false);
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const [csvImportResult, setCsvImportResult] = useState<{ imported: number; errors?: string[] } | null>(null);

  // Archive form data
  const [archiveFormData, setArchiveFormData] = useState({
    actualAttendees: '',
    highlights: '',
    highlightsAr: '',
    impact: '',
    impactAr: '',
    keyTakeaways: '',
    keyTakeawaysAr: '',
  });

  // Direct create form data
  const [createFormData, setCreateFormData] = useState({
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    location: '',
    locationAr: '',
    organizers: '',
    organizersAr: '',
    categoryId: '',
    actualAttendees: '',
    highlights: '',
    highlightsAr: '',
    impact: '',
    impactAr: '',
    keyTakeaways: '',
    keyTakeawaysAr: '',
    url: '',
    youtubeVideoIds: '',
  });

  // Edit form data
  const [editFormData, setEditFormData] = useState({
    actualAttendees: '',
    highlights: '',
    highlightsAr: '',
    impact: '',
    impactAr: '',
    keyTakeaways: '',
    keyTakeawaysAr: '',
    youtubeVideoIds: '',
  });

  // Initialize edit form when editingArchive changes
  const initializeEditForm = useCallback((archive: ArchivedEvent | null) => {
    if (archive) {
      setEditFormData({
        actualAttendees: archive.actualAttendees?.toString() || '',
        highlights: archive.highlights || '',
        highlightsAr: archive.highlightsAr || '',
        impact: archive.impact || '',
        impactAr: archive.impactAr || '',
        keyTakeaways: archive.keyTakeaways || '',
        keyTakeawaysAr: archive.keyTakeawaysAr || '',
        youtubeVideoIds: archive.youtubeVideoIds?.join(', ') || '',
      });
    }
  }, []);

  // Fetch archived events
  const { data: archiveData, isLoading } = useQuery<{
    events: ArchivedEvent[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: ['/api/archive', { page, search, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));
      if (search) params.append('search', search);
      const response = await fetch(`/api/archive?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch archive');
      return response.json();
    },
  });

  // Fetch archive detail with signed media URLs when editing
  const { data: editingArchiveDetail } = useQuery<ArchivedEvent>({
    queryKey: ['/api/archive', editingArchive?.id],
    queryFn: async () => {
      const response = await fetch(`/api/archive/${editingArchive!.id}`);
      if (!response.ok) throw new Error('Failed to fetch archive detail');
      return response.json();
    },
    enabled: !!editingArchive,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  // Fetch internal events (non-scraped, non-archived) for archiving
  const { data: internalEvents = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    select: (events) => events.filter(e => !e.isScraped && !e.isArchived),
    enabled: archiveEventDialogOpen,
  });

  // Fetch MinIO status
  const { data: minioStatus } = useQuery<{ available: boolean; config: any }>({
    queryKey: ['/api/archive/minio-status'],
  });

  // Archive event mutation
  const archiveEventMutation = useMutation({
    mutationFn: async ({ eventId, data }: { eventId: string; data: any }) => {
      return await apiRequest('POST', `/api/archive/from-event/${eventId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/archive'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setArchiveEventDialogOpen(false);
      setSelectedEventToArchive(null);
      resetArchiveForm();
      toast({
        title: t('archive.messages.eventArchived'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('messages.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update archive mutation
  const updateArchiveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest('PATCH', `/api/archive/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/archive'] });
      setEditingArchive(null);
      toast({
        title: t('archive.messages.archiveUpdated'),
      });
    },
    onError: () => {
      toast({
        title: t('messages.error'),
        variant: 'destructive',
      });
    },
  });

  // Handle edit archive submission
  const handleEditArchive = () => {
    if (!editingArchive) return;
    const data: any = {};
    
    if (editFormData.actualAttendees) {
      data.actualAttendees = parseInt(editFormData.actualAttendees);
    }
    if (editFormData.highlights !== editingArchive.highlights) {
      data.highlights = editFormData.highlights || null;
    }
    if (editFormData.highlightsAr !== editingArchive.highlightsAr) {
      data.highlightsAr = editFormData.highlightsAr || null;
    }
    if (editFormData.impact !== editingArchive.impact) {
      data.impact = editFormData.impact || null;
    }
    if (editFormData.impactAr !== editingArchive.impactAr) {
      data.impactAr = editFormData.impactAr || null;
    }
    if (editFormData.keyTakeaways !== editingArchive.keyTakeaways) {
      data.keyTakeaways = editFormData.keyTakeaways || null;
    }
    if (editFormData.keyTakeawaysAr !== editingArchive.keyTakeawaysAr) {
      data.keyTakeawaysAr = editFormData.keyTakeawaysAr || null;
    }
    
    const newVideoIds = editFormData.youtubeVideoIds
      ? editFormData.youtubeVideoIds.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const currentVideoIds = editingArchive.youtubeVideoIds || [];
    if (JSON.stringify(newVideoIds) !== JSON.stringify(currentVideoIds)) {
      data.youtubeVideoIds = newVideoIds;
    }

    updateArchiveMutation.mutate({ id: editingArchive.id, data });
  };

  // Delete archive mutation
  const deleteArchiveMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/archive/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/archive'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setDeletingArchive(null);
      toast({
        title: t('archive.messages.archiveDeleted'),
      });
    },
    onError: () => {
      toast({
        title: t('messages.error'),
        variant: 'destructive',
      });
    },
  });

  // Photo upload mutation
  const uploadPhotosMutation = useMutation({
    mutationFn: async ({ id, files }: { id: number; files: FileList }) => {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('photos', file);
      });
      const response = await fetch(`/api/archive/${id}/photos`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate both archive list and the specific archive detail for signed URLs
      queryClient.invalidateQueries({ queryKey: ['/api/archive'] });
      queryClient.invalidateQueries({ queryKey: ['/api/archive', variables.id] });
      setPhotoUploadArchive(null);
      toast({
        title: t('archive.messages.photosUploaded', { count: data.uploaded }),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('messages.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Photo delete mutation
  const deletePhotoMutation = useMutation({
    mutationFn: async ({ archiveId, mediaId }: { archiveId: number; mediaId: number }) => {
      const response = await fetch(`/api/archive/${archiveId}/photos/${mediaId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(error.error || 'Delete failed');
      }
      // DELETE returns 204 No Content, so don't try to parse JSON
      return { success: true };
    },
    onSuccess: (_, variables) => {
      // Invalidate both archive list and the specific archive detail
      queryClient.invalidateQueries({ queryKey: ['/api/archive'] });
      queryClient.invalidateQueries({ queryKey: ['/api/archive', variables.archiveId] });
      toast({
        title: t('archive.messages.photoDeleted'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('messages.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Create directly mutation
  const createDirectMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/archive', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/archive'] });
      setCreateDirectDialogOpen(false);
      resetCreateForm();
      toast({
        title: t('archive.messages.archiveCreated'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('messages.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Unarchive mutation - restore event from archive back to events
  const unarchiveMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('POST', `/api/archive/${id}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/archive'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast({
        title: t('archive.messages.eventRestored'),
        description: t('archive.messages.eventRestoredDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('messages.error'),
        description: error.message || t('archive.messages.restoreFailed'),
        variant: 'destructive',
      });
    },
  });

  // CSV import mutation
  const csvImportMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/archive/import-csv', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/archive'] });
      setCsvImportResult({ imported: data.imported, errors: data.errors });
      toast({
        title: t('archive.archiveImported'),
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: t('messages.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetArchiveForm = () => {
    setArchiveFormData({
      actualAttendees: '',
      highlights: '',
      highlightsAr: '',
      impact: '',
      impactAr: '',
      keyTakeaways: '',
      keyTakeawaysAr: '',
    });
  };

  const resetCreateForm = () => {
    setCreateFormData({
      name: '',
      nameAr: '',
      description: '',
      descriptionAr: '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      location: '',
      locationAr: '',
      organizers: '',
      organizersAr: '',
      categoryId: '',
      actualAttendees: '',
      highlights: '',
      highlightsAr: '',
      impact: '',
      impactAr: '',
      keyTakeaways: '',
      keyTakeawaysAr: '',
      url: '',
      youtubeVideoIds: '',
    });
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleArchiveEvent = () => {
    if (!selectedEventToArchive) return;
    const data: any = {};
    if (archiveFormData.actualAttendees) {
      data.actualAttendees = parseInt(archiveFormData.actualAttendees);
    }
    if (archiveFormData.highlights) data.highlights = archiveFormData.highlights;
    if (archiveFormData.highlightsAr) data.highlightsAr = archiveFormData.highlightsAr;
    if (archiveFormData.impact) data.impact = archiveFormData.impact;
    if (archiveFormData.impactAr) data.impactAr = archiveFormData.impactAr;
    if (archiveFormData.keyTakeaways) data.keyTakeaways = archiveFormData.keyTakeaways;
    if (archiveFormData.keyTakeawaysAr) data.keyTakeawaysAr = archiveFormData.keyTakeawaysAr;

    archiveEventMutation.mutate({ eventId: selectedEventToArchive.id, data });
  };

  const handleCreateDirect = () => {
    const data: any = {
      name: createFormData.name || undefined,
      nameAr: createFormData.nameAr || undefined,
      description: createFormData.description || undefined,
      descriptionAr: createFormData.descriptionAr || undefined,
      startDate: createFormData.startDate,
      endDate: createFormData.endDate || createFormData.startDate,
      startTime: createFormData.startTime || undefined,
      endTime: createFormData.endTime || undefined,
      location: createFormData.location || undefined,
      locationAr: createFormData.locationAr || undefined,
      organizers: createFormData.organizers || undefined,
      organizersAr: createFormData.organizersAr || undefined,
      categoryId: createFormData.categoryId ? parseInt(createFormData.categoryId) : undefined,
      actualAttendees: createFormData.actualAttendees ? parseInt(createFormData.actualAttendees) : undefined,
      highlights: createFormData.highlights || undefined,
      highlightsAr: createFormData.highlightsAr || undefined,
      impact: createFormData.impact || undefined,
      impactAr: createFormData.impactAr || undefined,
      keyTakeaways: createFormData.keyTakeaways || undefined,
      keyTakeawaysAr: createFormData.keyTakeawaysAr || undefined,
      url: createFormData.url || undefined,
      youtubeVideoIds: createFormData.youtubeVideoIds 
        ? createFormData.youtubeVideoIds.split(',').map(s => s.trim()).filter(Boolean)
        : undefined,
    };

    createDirectMutation.mutate(data);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvImportResult(null);
      csvImportMutation.mutate(file);
    }
    if (csvInputRef.current) {
      csvInputRef.current.value = '';
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!photoUploadArchive || !e.target.files?.length) return;
    uploadPhotosMutation.mutate({ id: photoUploadArchive.id, files: e.target.files });
  };

  const getBilingualContent = (en: string | null | undefined, ar: string | null | undefined) => {
    if (isArabic && ar) return ar;
    return en || '';
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), isArabic ? 'd/M/yyyy' : 'MMM d, yyyy', { locale });
    } catch {
      return dateStr;
    }
  };

  const totalPages = archiveData ? Math.ceil(archiveData.total / limit) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Hidden CSV input */}
      <input
        type="file"
        ref={csvInputRef}
        accept=".csv"
        className="hidden"
        onChange={handleCsvUpload}
      />

      {/* Header */}
      <PageHeader
        title={t('archive.admin.title')}
        subtitle={t('archive.admin.subtitle')}
        icon={Archive}
        iconColor="text-amber-500"
      >
        <Link href="/archive">
          <Button variant="outline" className="gap-2 border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-500/20">
            <Trophy className="h-4 w-4" />
            {t('archive.alHasad')}
          </Button>
        </Link>
        <Button variant="outline" onClick={() => setCsvImportDialogOpen(true)}>
          <FileSpreadsheet className="h-4 w-4 me-2" />
          {t('archive.actions.importCsv')}
        </Button>
        <Button variant="outline" onClick={() => setCreateDirectDialogOpen(true)}>
          <PlusCircle className="h-4 w-4 me-2" />
          {t('archive.actions.createNew')}
        </Button>
        <Button onClick={() => setArchiveEventDialogOpen(true)}>
          <Plus className="h-4 w-4 me-2" />
          {t('archive.actions.archiveEvent')}
        </Button>
      </PageHeader>

      {/* MinIO Status */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            {minioStatus?.available ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <div>
              <span className="font-medium">{t('archive.admin.minioStatus')}: </span>
              <span className={minioStatus?.available ? 'text-green-600' : 'text-red-600'}>
                {minioStatus?.available ? t('archive.admin.minioAvailable') : t('archive.admin.minioUnavailable')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          placeholder={t('archive.filters.searchPlaceholder')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="max-w-md"
        />
        <Button variant="secondary" onClick={handleSearch}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Archives Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <ListLoadingSkeleton count={5} />
            </div>
          ) : archiveData?.events.length === 0 ? (
            <EmptyState
              icon={<Archive className="h-16 w-16" />}
              title={t('archive.emptyStates.noArchives')}
              description={t('archive.emptyStates.noArchivesDesc')}
            />
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('events.name')}</TableHead>
                  <TableHead>{t('events.date')}</TableHead>
                  <TableHead>{t('archive.fields.actualAttendees')}</TableHead>
                  <TableHead>{t('archive.fields.speakers')}</TableHead>
                  <TableHead>{t('archive.fields.photos')}</TableHead>
                  <TableHead>{t('archive.fields.videos')}</TableHead>
                  <TableHead className="text-end">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archiveData?.events.map((archive) => (
                  <TableRow key={archive.id}>
                    <TableCell>
                      <div className="font-medium">
                        {getBilingualContent(archive.name, archive.nameAr)}
                      </div>
                      {archive.createdDirectly && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {t('archive.actions.createDirectly')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(archive.startDate)}</TableCell>
                    <TableCell>
                      {archive.actualAttendees?.toLocaleString() || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <Mic className="h-3 w-3" />
                        {archive.speakers?.length || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <Image className="h-3 w-3" />
                        {archive.photoKeys?.length || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <Video className="h-3 w-3" />
                        {archive.youtubeVideoIds?.length || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Link href={`/archive/${archive.id}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPhotoUploadArchive(archive)}
                          disabled={!minioStatus?.available}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingArchive(archive);
                            initializeEditForm(archive);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {/* Only show unarchive if it has an original event */}
                        {archive.originalEventId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unarchiveMutation.mutate(archive.id)}
                            disabled={unarchiveMutation.isPending}
                            title={t('archive.restoreToCalendar')}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingArchive(archive)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            {t('common.previous')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            {t('common.next')}
          </Button>
        </div>
      )}

      {/* Archive Event Dialog */}
      <Dialog open={archiveEventDialogOpen} onOpenChange={setArchiveEventDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('archive.dialog.archiveEventTitle')}</DialogTitle>
            <DialogDescription>{t('archive.dialog.archiveEventDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t('events.selectEvent')}</Label>
              <Select
                value={selectedEventToArchive?.id || ''}
                onValueChange={(id) => {
                  const event = internalEvents.find(e => e.id === id);
                  setSelectedEventToArchive(event || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('events.selectEvent')} />
                </SelectTrigger>
                <SelectContent>
                  {internalEvents.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {getBilingualContent(event.name, event.nameAr)} ({formatDate(event.startDate)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {t('archive.admin.internalEventsOnlyDesc')}
              </p>
            </div>

            {selectedEventToArchive && (
              <>
                <div>
                  <Label>{t('archive.fields.actualAttendees')}</Label>
                  <Input
                    type="number"
                    value={archiveFormData.actualAttendees}
                    onChange={(e) => setArchiveFormData(prev => ({ ...prev, actualAttendees: e.target.value }))}
                    placeholder={selectedEventToArchive.expectedAttendance?.toString() || ''}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>{t('archive.fields.highlights')}</Label>
                    <Textarea
                      value={archiveFormData.highlights}
                      onChange={(e) => setArchiveFormData(prev => ({ ...prev, highlights: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>{t('archive.fields.highlightsAr')}</Label>
                    <Textarea
                      value={archiveFormData.highlightsAr}
                      onChange={(e) => setArchiveFormData(prev => ({ ...prev, highlightsAr: e.target.value }))}
                      rows={3}
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>{t('archive.fields.impact')}</Label>
                    <Textarea
                      value={archiveFormData.impact}
                      onChange={(e) => setArchiveFormData(prev => ({ ...prev, impact: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>{t('archive.fields.impactAr')}</Label>
                    <Textarea
                      value={archiveFormData.impactAr}
                      onChange={(e) => setArchiveFormData(prev => ({ ...prev, impactAr: e.target.value }))}
                      rows={3}
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>{t('archive.fields.keyTakeaways')}</Label>
                    <Textarea
                      value={archiveFormData.keyTakeaways}
                      onChange={(e) => setArchiveFormData(prev => ({ ...prev, keyTakeaways: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>{t('archive.fields.keyTakeawaysAr')}</Label>
                    <Textarea
                      value={archiveFormData.keyTakeawaysAr}
                      onChange={(e) => setArchiveFormData(prev => ({ ...prev, keyTakeawaysAr: e.target.value }))}
                      rows={3}
                      dir="rtl"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setArchiveEventDialogOpen(false);
              setSelectedEventToArchive(null);
              resetArchiveForm();
            }}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleArchiveEvent}
              disabled={!selectedEventToArchive || archiveEventMutation.isPending}
            >
              {archiveEventMutation.isPending ? t('common.saving') : t('archive.actions.archiveEvent')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Upload Dialog */}
      <Dialog open={!!photoUploadArchive} onOpenChange={(open) => !open && setPhotoUploadArchive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('archive.dialog.uploadPhotosTitle')}</DialogTitle>
            <DialogDescription>
              {t('archive.dialog.uploadPhotosDesc', {
                remaining: 20 - (photoUploadArchive?.photoKeys?.length || 0),
                current: photoUploadArchive?.photoKeys?.length || 0,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleFileUpload}
              disabled={uploadPhotosMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Max 5MB per photo. Supported formats: JPEG, PNG, WebP, GIF
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPhotoUploadArchive(null)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Archive Dialog */}
      <Dialog open={!!editingArchive} onOpenChange={(open) => !open && setEditingArchive(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-amber-500" />
              {t('archive.editArchiveTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('archive.editArchiveDesc')}
            </DialogDescription>
          </DialogHeader>

          {editingArchive && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">{t('archive.tabs.details')}</TabsTrigger>
                <TabsTrigger value="speakers">{t('archive.tabs.speakers')}</TabsTrigger>
                <TabsTrigger value="highlights">{t('archive.tabs.highlights')}</TabsTrigger>
                <TabsTrigger value="media">{t('archive.tabs.media')}</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                {/* Event Info (read-only) */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="font-medium text-lg">
                    {getBilingualContent(editingArchive.name, editingArchive.nameAr)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(editingArchive.startDate)}
                    {editingArchive.location && ` • ${getBilingualContent(editingArchive.location, editingArchive.locationAr)}`}
                  </div>
                </div>

                <div>
                  <Label>{t('archive.fields.actualAttendees')}</Label>
                  <Input
                    type="number"
                    value={editFormData.actualAttendees}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, actualAttendees: e.target.value }))}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label>{t('archive.fields.youtubeVideoIds')}</Label>
                  <Input
                    value={editFormData.youtubeVideoIds}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, youtubeVideoIds: e.target.value }))}
                    placeholder="dQw4w9WgXcQ, abc123xyz"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('archive.separateWithCommas')}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="speakers" className="space-y-4 mt-4">
                <ArchivedEventSpeakersManager
                  archivedEventId={editingArchive.id}
                  disabled={updateArchiveMutation.isPending}
                />
              </TabsContent>

              <TabsContent value="highlights" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>{t('archive.fields.highlights')}</Label>
                    <Textarea
                      value={editFormData.highlights}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, highlights: e.target.value }))}
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label>{t('archive.fields.highlightsAr')}</Label>
                    <Textarea
                      value={editFormData.highlightsAr}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, highlightsAr: e.target.value }))}
                      rows={4}
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>{t('archive.fields.impact')}</Label>
                    <Textarea
                      value={editFormData.impact}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, impact: e.target.value }))}
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label>{t('archive.fields.impactAr')}</Label>
                    <Textarea
                      value={editFormData.impactAr}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, impactAr: e.target.value }))}
                      rows={4}
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>{t('archive.fields.keyTakeaways')}</Label>
                    <Textarea
                      value={editFormData.keyTakeaways}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, keyTakeaways: e.target.value }))}
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label>{t('archive.fields.keyTakeawaysAr')}</Label>
                    <Textarea
                      value={editFormData.keyTakeawaysAr}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, keyTakeawaysAr: e.target.value }))}
                      rows={4}
                      dir="rtl"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="media" className="space-y-4 mt-4">
                {/* Current Photos */}
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <Image className="h-4 w-4" />
                    {t('archive.currentPhotos')}
                    <Badge variant="secondary">{editingArchiveDetail?.media?.length || editingArchive.photoKeys?.length || 0} / 20</Badge>
                  </Label>
                  {editingArchiveDetail?.media && editingArchiveDetail.media.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {editingArchiveDetail.media.map((media, idx) => (
                        <div key={media.id || idx} className="aspect-square bg-muted rounded-md overflow-hidden relative group">
                          <img
                            src={media.thumbnailUrl || media.imageUrl || ''}
                            alt={media.caption || `Photo ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {/* Delete button overlay */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                if (media.id && editingArchive) {
                                  deletePhotoMutation.mutate({ 
                                    archiveId: editingArchive.id, 
                                    mediaId: media.id 
                                  });
                                }
                              }}
                              disabled={deletePhotoMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : editingArchive.photoKeys && editingArchive.photoKeys.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t('archive.loadingPhotos')}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('archive.noPhotosYet')}
                    </p>
                  )}
                </div>

                {/* Upload New Photos */}
                <div className="p-4 border-2 border-dashed rounded-lg space-y-3">
                  <Label className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    {t('archive.uploadNewPhotos')}
                  </Label>
                  {minioStatus?.available ? (
                    <>
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple
                        onChange={(e) => {
                          if (e.target.files?.length && editingArchive) {
                            uploadPhotosMutation.mutate({ id: editingArchive.id, files: e.target.files });
                          }
                        }}
                        disabled={uploadPhotosMutation.isPending || (editingArchiveDetail?.media?.length || editingArchive.photoKeys?.length || 0) >= 20}
                      />
                      <p className="text-xs text-muted-foreground">
                        {isArabic 
                          ? `الحد الأقصى 5 ميغابايت للصورة. الأنواع المدعومة: JPEG, PNG, WebP, GIF. متبقي ${20 - (editingArchiveDetail?.media?.length || editingArchive.photoKeys?.length || 0)} صور.`
                          : `Max 5MB per photo. Supported: JPEG, PNG, WebP, GIF. ${20 - (editingArchiveDetail?.media?.length || editingArchive.photoKeys?.length || 0)} slots remaining.`
                        }
                      </p>
                      {uploadPhotosMutation.isPending && (
                        <p className="text-sm text-amber-600">
                          {t('archive.uploading')}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-red-500">
                      {t('archive.photoStorageUnavailable')}
                    </p>
                  )}
                </div>

                {/* Current Videos */}
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <Video className="h-4 w-4" />
                    {t('archive.tabs.videos')}
                    <Badge variant="secondary">{editingArchive.youtubeVideoIds?.length || 0}</Badge>
                  </Label>
                  {editingArchive.youtubeVideoIds && editingArchive.youtubeVideoIds.length > 0 ? (
                    <div className="space-y-2">
                      {editingArchive.youtubeVideoIds.map((videoId, idx) => (
                        <a
                          key={idx}
                          href={`https://www.youtube.com/watch?v=${videoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                        >
                          <Video className="h-4 w-4" />
                          {videoId}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('archive.noVideosYet')}
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingArchive(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleEditArchive}
              disabled={updateArchiveMutation.isPending}
            >
              {updateArchiveMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingArchive} onOpenChange={(open) => !open && setDeletingArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('archive.dialog.deleteArchiveTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('archive.messages.confirmDelete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingArchive && deleteArchiveMutation.mutate(deletingArchive.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Import Dialog */}
      <Dialog open={csvImportDialogOpen} onOpenChange={setCsvImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-amber-500" />
              {t('archive.dialog.csvImportTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('archive.dialog.csvImportDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open('/api/archive/csv-template', '_blank')}
              >
                <Download className="h-4 w-4 me-2" />
                {t('archive.dialog.downloadTemplate')}
              </Button>
              <Button
                className="flex-1"
                onClick={() => csvInputRef.current?.click()}
                disabled={csvImportMutation.isPending}
              >
                <Upload className="h-4 w-4 me-2" />
                {csvImportMutation.isPending 
                  ? t('archive.dialog.importing')
                  : t('archive.dialog.selectCsvFile')
                }
              </Button>
            </div>

            {csvImportResult && (
              <Card className={csvImportResult.errors ? 'border-amber-500' : 'border-green-500'}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    {csvImportResult.errors ? (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    <span className="font-medium">
                      {t('archive.csvImportSuccess', { count: csvImportResult.imported })}
                    </span>
                  </div>
                  {csvImportResult.errors && csvImportResult.errors.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium text-amber-600 mb-1">
                        {t('archive.csvImportErrors')}
                      </p>
                      <ul className="list-disc list-inside max-h-32 overflow-y-auto">
                        {csvImportResult.errors.slice(0, 10).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                        {csvImportResult.errors.length > 10 && (
                          <li>...and {csvImportResult.errors.length - 10} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-muted-foreground">
              {isArabic 
                ? 'الأعمدة المطلوبة: name أو name_ar, start_date. الأعمدة الاختيارية: description, location, actual_attendees, highlights, impact, والمزيد.'
                : 'Required columns: name or name_ar, start_date. Optional columns: description, location, actual_attendees, highlights, impact, and more.'
              }
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCsvImportDialogOpen(false);
              setCsvImportResult(null);
            }}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Direct Dialog */}
      <Dialog open={createDirectDialogOpen} onOpenChange={setCreateDirectDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-amber-500" />
              {t('archive.dialog.createArchiveTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('archive.dialog.createArchiveDesc')}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">{t('archive.tabs.basicInfo')}</TabsTrigger>
              <TabsTrigger value="details">{t('archive.tabs.details')}</TabsTrigger>
              <TabsTrigger value="highlights">{t('archive.tabs.highlights')}</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t('archive.form.nameEnglish')} *</Label>
                  <Input
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Event name"
                  />
                </div>
                <div>
                  <Label>{t('archive.form.nameArabic')}</Label>
                  <Input
                    value={createFormData.nameAr}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, nameAr: e.target.value }))}
                    placeholder="اسم الفعالية"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t('events.startDate')} *</Label>
                  <Input
                    type="date"
                    value={createFormData.startDate}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t('events.endDate')}</Label>
                  <Input
                    type="date"
                    value={createFormData.endDate}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t('archive.form.startTime')}</Label>
                  <Input
                    type="time"
                    value={createFormData.startTime}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t('archive.form.endTime')}</Label>
                  <Input
                    type="time"
                    value={createFormData.endTime}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>{t('events.category')}</Label>
                <Select 
                  value={createFormData.categoryId || '__none__'} 
                  onValueChange={(v) => setCreateFormData(prev => ({ ...prev, categoryId: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('archive.form.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('archive.form.noCategory')}</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {getBilingualContent(cat.nameEn, cat.nameAr)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t('events.location')}</Label>
                  <Input
                    value={createFormData.location}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Location"
                  />
                </div>
                <div>
                  <Label>{t('archive.form.locationArabic')}</Label>
                  <Input
                    value={createFormData.locationAr}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, locationAr: e.target.value }))}
                    placeholder="الموقع"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t('archive.form.organizers')}</Label>
                  <Input
                    value={createFormData.organizers}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, organizers: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t('archive.form.organizersArabic')}</Label>
                  <Input
                    value={createFormData.organizersAr}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, organizersAr: e.target.value }))}
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t('archive.fields.actualAttendees')}</Label>
                  <Input
                    type="number"
                    value={createFormData.actualAttendees}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, actualAttendees: e.target.value }))}
                    placeholder="500"
                  />
                </div>
                <div>
                  <Label>{t('archive.form.eventUrl')}</Label>
                  <Input
                    type="url"
                    value={createFormData.url}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t('events.description')}</Label>
                  <Textarea
                    value={createFormData.description}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>{t('archive.form.descriptionArabic')}</Label>
                  <Textarea
                    value={createFormData.descriptionAr}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, descriptionAr: e.target.value }))}
                    rows={3}
                    dir="rtl"
                  />
                </div>
              </div>

              <div>
                <Label>{t('archive.fields.youtubeVideoIds')}</Label>
                <Input
                  value={createFormData.youtubeVideoIds}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, youtubeVideoIds: e.target.value }))}
                  placeholder="dQw4w9WgXcQ, abc123xyz"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('archive.separateWithCommas')}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="highlights" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t('archive.fields.highlights')}</Label>
                  <Textarea
                    value={createFormData.highlights}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, highlights: e.target.value }))}
                    rows={4}
                  />
                </div>
                <div>
                  <Label>{t('archive.fields.highlightsAr')}</Label>
                  <Textarea
                    value={createFormData.highlightsAr}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, highlightsAr: e.target.value }))}
                    rows={4}
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t('archive.fields.impact')}</Label>
                  <Textarea
                    value={createFormData.impact}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, impact: e.target.value }))}
                    rows={4}
                  />
                </div>
                <div>
                  <Label>{t('archive.fields.impactAr')}</Label>
                  <Textarea
                    value={createFormData.impactAr}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, impactAr: e.target.value }))}
                    rows={4}
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t('archive.fields.keyTakeaways')}</Label>
                  <Textarea
                    value={createFormData.keyTakeaways}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, keyTakeaways: e.target.value }))}
                    rows={4}
                  />
                </div>
                <div>
                  <Label>{t('archive.fields.keyTakeawaysAr')}</Label>
                  <Textarea
                    value={createFormData.keyTakeawaysAr}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, keyTakeawaysAr: e.target.value }))}
                    rows={4}
                    dir="rtl"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateDirectDialogOpen(false);
              resetCreateForm();
            }}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreateDirect}
              disabled={!createFormData.startDate || (!createFormData.name && !createFormData.nameAr) || createDirectMutation.isPending}
            >
              {createDirectMutation.isPending ? t('common.saving') : t('archive.form.createArchive')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
