import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ExportButton } from '@/components/ExportButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  Search,
  ChevronsUpDown,
  Check,
  UserCircle,
  Building,
  Briefcase,
  Mail,
  Phone,
  Globe,
  Mic,
  X,
  ChevronLeft,
  ChevronRight,
  Camera,
  Loader2,
  Download,
  Upload,
  Filter,
  Calendar,
  ExternalLink,
  MapPin,
  Archive,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Contact, Organization, Position, Country } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { format, parseISO } from 'date-fns';
import { LoadingState, TableLoadingSkeleton } from '@/components/ui/loading-state';
import { NoContactsEmptyState } from '@/components/ui/empty-state';
import { StatCard, StatsGrid } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/skeleton';

interface ContactsResponse {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
}

interface GroupedContactsResponse {
  groups: Array<{
    id: number;
    nameEn: string;
    nameAr: string | null;
    totalContacts: number;
    contacts: Contact[];
  }>;
  totalGroups: number;
}

export default function Contacts() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if not admin or superadmin
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    setLocation('/');
    return null;
  }
  const isArabic = i18n.language === 'ar';

  // State for list and pagination
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const limit = 20;
  
  // Filter state
  const [filterOrgId, setFilterOrgId] = useState<number | undefined>(undefined);
  const [filterPosId, setFilterPosId] = useState<number | undefined>(undefined);
  const [filterCountryId, setFilterCountryId] = useState<number | undefined>(undefined);
  const [filterSpeaker, setFilterSpeaker] = useState<boolean | undefined>(undefined);

  // State for import
  const [importFile, setImportFile] = useState<File | null>(null);
  
  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'by-organization' | 'by-position' | 'by-country'>('list');
  
  // State for expanded groups (for "Show more" functionality)
  const [expandedGroups, setExpandedGroups] = useState<Map<number, { page: number; contacts: Contact[] }>>(new Map());

  // State for dialogs
  const [showDialog, setShowDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [viewingContactEvents, setViewingContactEvents] = useState<Contact | null>(null);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [showPosDialog, setShowPosDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Form state
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [positionId, setPositionId] = useState<number | null>(null);
  const [countryId, setCountryId] = useState<number | null>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isEligibleSpeaker, setIsEligibleSpeaker] = useState(false);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Dropdown open states
  const [orgOpen, setOrgOpen] = useState(false);
  const [posOpen, setPosOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);

  // New organization/position form
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgNameAr, setNewOrgNameAr] = useState('');
  const [newPosName, setNewPosName] = useState('');
  const [newPosNameAr, setNewPosNameAr] = useState('');

  // Data queries
  const { data: contactsData, isLoading: contactsLoading } = useQuery<ContactsResponse>({
    queryKey: ['contacts', 'list', { page, search: searchQuery, limit, organizationId: filterOrgId, positionId: filterPosId, countryId: filterCountryId, isEligibleSpeaker: filterSpeaker }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));
      if (searchQuery) params.append('search', searchQuery);
      if (filterOrgId) params.append('organizationId', String(filterOrgId));
      if (filterPosId) params.append('positionId', String(filterPosId));
      if (filterCountryId) params.append('countryId', String(filterCountryId));
      if (filterSpeaker !== undefined) params.append('isEligibleSpeaker', String(filterSpeaker));
      const response = await fetch(`/api/contacts?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch contacts');
      return response.json();
    },
    enabled: viewMode === 'list',
  });

  // Query for grouped contacts (organization, position, country views)
  const groupByMapping = {
    'by-organization': 'organization',
    'by-position': 'position',
    'by-country': 'country',
  } as const;
  
  const { data: groupedContactsData, isLoading: groupedContactsLoading } = useQuery<GroupedContactsResponse>({
    queryKey: ['contacts', 'grouped', viewMode, { search: searchQuery, isEligibleSpeaker: filterSpeaker }],
    queryFn: async () => {
      const groupBy = groupByMapping[viewMode as keyof typeof groupByMapping];
      const params = new URLSearchParams();
      params.append('groupBy', groupBy);
      params.append('limit', '5'); // Top 5 contacts per group
      if (searchQuery) params.append('search', searchQuery);
      if (filterSpeaker !== undefined) params.append('isEligibleSpeaker', String(filterSpeaker));
      const response = await fetch(`/api/contacts/grouped?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch grouped contacts');
      return response.json();
    },
    enabled: viewMode !== 'list',
  });

  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await fetch('/api/organizations', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch organizations');
      return response.json();
    },
  });

  const { data: positions = [] } = useQuery<Position[]>({
    queryKey: ['positions'],
    queryFn: async () => {
      const response = await fetch('/api/positions', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch positions');
      return response.json();
    },
  });

  const { data: countries = [] } = useQuery<Country[]>({
    queryKey: ['countries'],
    queryFn: async () => {
      const response = await fetch('/api/countries', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch countries');
      return response.json();
    },
  });

  // Fetch contact events when viewing event history
  const { data: contactEventsData, isLoading: eventsLoading } = useQuery<{
    contact: Contact;
    events: any[];
    archivedEvents: any[];
  }>({
    queryKey: ['contact-events', viewingContactEvents?.id || editingContact?.id],
    queryFn: async () => {
      const contactId = viewingContactEvents?.id || editingContact?.id;
      if (!contactId) return null;
      const response = await fetch(`/api/contacts/${contactId}/events`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch contact events');
      return response.json();
    },
    enabled: !!(viewingContactEvents?.id || editingContact?.id),
  });

  // Mutations
  const createContactMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/contacts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({ title: t('messages.success'), description: t('contacts.messages.contactCreated') });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: t('messages.error'), description: error.message, variant: 'destructive' });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest('PATCH', `/api/contacts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({ title: t('messages.success'), description: t('contacts.messages.contactUpdated') });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: t('messages.error'), description: error.message, variant: 'destructive' });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({ title: t('messages.success'), description: t('contacts.messages.contactDeleted') });
      setDeletingContact(null);
    },
    onError: (error: any) => {
      toast({ title: t('messages.error'), description: error.message, variant: 'destructive' });
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ contactId, file }: { contactId: number; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/contacts/${contactId}/profile-picture`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to upload photo');
      }

      return (await response.json()) as Contact;
    },
    onSuccess: (contact) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setPhotoPreview(
        contact.profilePictureThumbnailKey
          ? `/api/contacts/profile-picture/${contact.id}?thumbnail=true&v=${Date.now()}`
          : null
      );
      setProfilePhotoFile(null);
      toast({
        title: t('messages.success'),
        description: isArabic ? 'تم تحديث صورة الملف الشخصي' : 'Profile photo updated',
      });
    },
    onError: (error: any) => {
      toast({ title: t('messages.error'), description: error.message, variant: 'destructive' });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (contactId: number) => {
      await apiRequest('DELETE', `/api/contacts/${contactId}/profile-picture`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setPhotoPreview(null);
      setProfilePhotoFile(null);
      toast({
        title: t('messages.success'),
        description: isArabic ? 'تم حذف صورة الملف الشخصي' : 'Profile photo removed',
      });
    },
    onError: (error: any) => {
      toast({ title: t('messages.error'), description: error.message, variant: 'destructive' });
    },
  });

  const createOrgMutation = useMutation({
    mutationFn: async (data: { nameEn: string; nameAr?: string }) => {
      return await apiRequest('POST', '/api/organizations', data);
    },
    onSuccess: (org: Organization) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setOrganizationId(org.id);
      setShowOrgDialog(false);
      setNewOrgName('');
      setNewOrgNameAr('');
      toast({ title: t('messages.success'), description: t('contacts.messages.organizationCreated') });
    },
    onError: (error: any) => {
      toast({ title: t('messages.error'), description: error.message, variant: 'destructive' });
    },
  });

  const createPosMutation = useMutation({
    mutationFn: async (data: { nameEn: string; nameAr?: string }) => {
      return await apiRequest('POST', '/api/positions', data);
    },
    onSuccess: (pos: Position) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      setPositionId(pos.id);
      setShowPosDialog(false);
      setNewPosName('');
      setNewPosNameAr('');
      toast({ title: t('messages.success'), description: t('contacts.messages.positionCreated') });
    },
    onError: (error: any) => {
      toast({ title: t('messages.error'), description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setShowDialog(false);
    setEditingContact(null);
    setNameEn('');
    setNameAr('');
    setTitle('');
    setTitleAr('');
    setOrganizationId(null);
    setPositionId(null);
    setCountryId(null);
    setPhone('');
    setEmail('');
    setIsEligibleSpeaker(false);
    setProfilePhotoFile(null);
    setPhotoPreview(null);
  };

  const openEditDialog = (contact: Contact) => {
    setEditingContact(contact);
    setNameEn(contact.nameEn);
    setNameAr(contact.nameAr || '');
    setTitle(contact.title || '');
    setTitleAr(contact.titleAr || '');
    setOrganizationId(contact.organizationId || null);
    setPositionId(contact.positionId || null);
    setCountryId(contact.countryId || null);
    setPhone(contact.phone || '');
    setEmail(contact.email || '');
    setIsEligibleSpeaker(contact.isEligibleSpeaker);
    setPhotoPreview(
      contact.profilePictureThumbnailKey
        ? `/api/contacts/profile-picture/${contact.id}?thumbnail=true&v=${Date.now()}`
        : null
    );
    setProfilePhotoFile(null);
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!nameEn.trim()) {
      toast({ title: t('messages.error'), description: t('contacts.messages.nameRequired'), variant: 'destructive' });
      return;
    }

    const data = {
      nameEn: nameEn.trim(),
      nameAr: nameAr.trim() || null,
      title: title.trim() || null,
      titleAr: titleAr.trim() || null,
      organizationId,
      positionId,
      countryId,
      phone: phone.trim() || null,
      email: email.trim() || null,
      isEligibleSpeaker,
    };

    try {
      let contact: Contact;

      if (editingContact) {
        contact = await updateContactMutation.mutateAsync({ id: editingContact.id, data });
      } else {
        contact = await createContactMutation.mutateAsync(data);
      }

      if (profilePhotoFile && contact?.id) {
        await uploadPhotoMutation.mutateAsync({ contactId: contact.id, file: profilePhotoFile });
      }

      resetForm();
    } catch {
      // Errors are handled by the mutations and toasts
    }
  };

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setPage(1);
    // Reset expanded groups when searching
    setExpandedGroups(new Map());
  };

  // Load more contacts for a specific group
  const loadMoreForGroup = async (groupId: number, currentPage: number, groupBy: string) => {
    try {
      const nextPage = currentPage + 1;
      const params = new URLSearchParams();
      params.append('groupBy', groupBy);
      params.append('groupId', String(groupId));
      params.append('page', String(nextPage));
      params.append('limit', '10'); // Load 10 more at a time
      if (searchQuery) params.append('search', searchQuery);
      if (filterSpeaker !== undefined) params.append('isEligibleSpeaker', String(filterSpeaker));
      
      const response = await fetch(`/api/contacts/grouped?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to load more contacts');
      
      const data: GroupedContactsResponse = await response.json();
      if (data.groups.length > 0 && data.groups[0].contacts.length > 0) {
        setExpandedGroups(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(groupId);
          const existingContacts = existing?.contacts || [];
          newMap.set(groupId, {
            page: nextPage,
            contacts: [...existingContacts, ...data.groups[0].contacts],
          });
          return newMap;
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('messages.error'),
        description: 'Failed to load more contacts',
      });
    }
  };

  const handlePhotoFileChange = (file: File | null) => {
    if (!file) return;

    setProfilePhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadTemplate = () => {
    window.open('/api/contacts/csv-template', '_blank');
  };

  const handleImportSubmit = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import contacts');
      }

      const result = await response.json();
      
      toast({
        title: t('contacts.importSuccess'),
        description: `${result.imported} imported, ${result.updated} updated, ${result.skipped} skipped`,
      });

      setShowImportDialog(false);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('contacts.importError'),
        description: error.message,
      });
    }
  };

  const totalPages = contactsData ? Math.ceil(contactsData.total / limit) : 0;
  const isSaving = createContactMutation.isPending || updateContactMutation.isPending || uploadPhotoMutation.isPending;

  const getDisplayName = (contact: Contact) => {
    const name = isArabic && contact.nameAr ? contact.nameAr : contact.nameEn;
    const titlePrefix = isArabic && contact.titleAr ? contact.titleAr : contact.title;
    return titlePrefix ? `${titlePrefix} ${name}` : name;
  };

  const getOrganizationName = (org?: Organization) => {
    if (!org) return '-';
    return isArabic && org.nameAr ? org.nameAr : org.nameEn;
  };

  const getPositionName = (pos?: Position) => {
    if (!pos) return '-';
    return isArabic && pos.nameAr ? pos.nameAr : pos.nameEn;
  };

  const getCountryName = (country?: Country) => {
    if (!country) return '-';
    return isArabic && country.nameAr ? country.nameAr : country.nameEn;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={t('contacts.title')}
        subtitle={t('contacts.subtitle')}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              {t('contacts.contactsList')}
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex gap-2">
                <Input
                  placeholder={t('contacts.searchPlaceholder')}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="max-w-xs"
                />
                <Button variant="secondary" onClick={handleSearch} size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="me-2 h-4 w-4" />
                  {t('contacts.buttons.template')}
                </Button>
                <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                  <Upload className="me-2 h-4 w-4" />
                  {t('contacts.buttons.import')}
                </Button>
                <ExportButton 
                  entityType="contacts"
                  filters={{
                    ...(searchQuery && { search: searchQuery }),
                    ...(filterOrgId && { organizationId: filterOrgId }),
                    ...(filterPosId && { positionId: filterPosId }),
                    ...(filterCountryId && { countryId: filterCountryId }),
                    ...(filterSpeaker !== undefined && { isEligibleSpeaker: filterSpeaker }),
                  }}
                  variant="outline"
                />
                <Button onClick={() => setShowDialog(true)}>
                  <Plus className="me-2 h-4 w-4" />
                  {t('contacts.addContact')}
                </Button>
              </div>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Select
              value={filterOrgId?.toString() || 'all'}
              onValueChange={(value) => {
                setFilterOrgId(value === 'all' ? undefined : parseInt(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('contacts.filters.allOrganizations')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('contacts.filters.allOrganizations')}</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id.toString()}>
                    {isArabic && org.nameAr ? org.nameAr : org.nameEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterPosId?.toString() || 'all'}
              onValueChange={(value) => {
                setFilterPosId(value === 'all' ? undefined : parseInt(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('contacts.filters.allPositions')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('contacts.filters.allPositions')}</SelectItem>
                {positions.map((pos) => (
                  <SelectItem key={pos.id} value={pos.id.toString()}>
                    {isArabic && pos.nameAr ? pos.nameAr : pos.nameEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterCountryId?.toString() || 'all'}
              onValueChange={(value) => {
                setFilterCountryId(value === 'all' ? undefined : parseInt(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('contacts.filters.allCountries')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('contacts.filters.allCountries')}</SelectItem>
                {countries.map((country) => (
                  <SelectItem key={country.id} value={country.id.toString()}>
                    {isArabic && country.nameAr ? country.nameAr : country.nameEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={
                filterSpeaker === undefined ? 'all' : filterSpeaker ? 'true' : 'false'
              }
              onValueChange={(value) => {
                setFilterSpeaker(
                  value === 'all' ? undefined : value === 'true'
                );
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('contacts.filters.allContacts')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('contacts.filters.allContacts')}</SelectItem>
                <SelectItem value="true">{t('contacts.filters.eligibleSpeakersOnly')}</SelectItem>
                <SelectItem value="false">{t('contacts.filters.nonSpeakersOnly')}</SelectItem>
              </SelectContent>
            </Select>

            {(filterOrgId || filterPosId || filterCountryId || filterSpeaker !== undefined) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterOrgId(undefined);
                  setFilterPosId(undefined);
                  setFilterCountryId(undefined);
                  setFilterSpeaker(undefined);
                  setPage(1);
                }}
              >
                <X className="h-4 w-4 me-2" />
                {t('contacts.filters.clearFilters')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* View Mode Tabs */}
          <Tabs value={viewMode} onValueChange={(value: any) => {
            setViewMode(value);
            setExpandedGroups(new Map()); // Reset expanded groups when changing view
          }} className="mb-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="list">
                <UserCircle className="h-4 w-4 me-2" />
                {t('contacts.views.allContacts')}
              </TabsTrigger>
              <TabsTrigger value="by-organization">
                <Building className="h-4 w-4 me-2" />
                {t('contacts.views.byOrganization')}
              </TabsTrigger>
              <TabsTrigger value="by-position">
                <Briefcase className="h-4 w-4 me-2" />
                {t('contacts.views.byPosition')}
              </TabsTrigger>
              <TabsTrigger value="by-country">
                <Globe className="h-4 w-4 me-2" />
                {t('contacts.views.byCountry')}
              </TabsTrigger>
            </TabsList>

            {/* List View */}
            <TabsContent value="list" className="mt-4">
              {contactsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : contactsData?.contacts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <UserCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('contacts.noContactsFound')}</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('contacts.name')}</TableHead>
                      <TableHead className="hidden md:table-cell">{t('contacts.organization')}</TableHead>
                      <TableHead className="hidden md:table-cell">{t('contacts.position')}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t('contacts.email')}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t('contacts.phone')}</TableHead>
                      <TableHead>{t('contacts.speaker')}</TableHead>
                      <TableHead className="text-end">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contactsData?.contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-9 w-9">
                              <AvatarImage
                                src={contact.profilePictureThumbnailKey ? `/api/contacts/profile-picture/${contact.id}?thumbnail=true` : undefined}
                                alt=""
                              />
                              <AvatarFallback>{getInitials(getDisplayName(contact)) || <UserCircle className="h-4 w-4" />}</AvatarFallback>
                            </Avatar>
                            <span>{getDisplayName(contact)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {getOrganizationName(contact.organization)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {getPositionName(contact.position)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {contact.email || '-'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {contact.phone || '-'}
                        </TableCell>
                        <TableCell>
                          {contact.isEligibleSpeaker ? (
                            <Badge variant="default" className="gap-1">
                              <Mic className="h-3 w-3" />
                              {t('common.yes')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">{t('common.no')}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => setViewingContactEvents(contact)} title="View Events">
                              <Calendar className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(contact)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeletingContact(contact)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4 me-1" />
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
                    <ChevronRight className="h-4 w-4 ms-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* By Organization View */}
        <TabsContent value="by-organization" className="mt-4">
          {groupedContactsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : groupedContactsData?.groups.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('contacts.noContactsInOrganization')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedContactsData?.groups.map(group => {
                const expanded = expandedGroups.get(group.id);
                const displayContacts = expanded ? [...group.contacts, ...expanded.contacts] : group.contacts;
                const shownCount = displayContacts.length;
                const hasMore = shownCount < group.totalContacts;
                
                return (
                  <Card key={group.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Building className="h-5 w-5" />
                        {isArabic && group.nameAr ? group.nameAr : group.nameEn}
                        <Badge variant="secondary">{group.totalContacts}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2">
                        {displayContacts.map(contact => (
                          <div key={contact.id} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={contact.profilePictureThumbnailKey ? `/api/contacts/profile-picture/${contact.id}?thumbnail=true` : undefined} />
                                <AvatarFallback>{getInitials(getDisplayName(contact))}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{getDisplayName(contact)}</div>
                                <div className="text-sm text-muted-foreground">{getPositionName(contact.position)}</div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {contact.isEligibleSpeaker && <Badge variant="default"><Mic className="h-3 w-3" /></Badge>}
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(contact)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {hasMore && (
                        <div className="mt-3 pt-3 border-t flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {t('contacts.buttons.showingOf', { shown: shownCount, total: group.totalContacts })}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadMoreForGroup(group.id, expanded?.page || 1, 'organization')}
                          >
                            {t('contacts.buttons.showMore')}
                            <ChevronRight className="h-4 w-4 ms-1" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* By Position View */}
        <TabsContent value="by-position" className="mt-4">
          {groupedContactsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : groupedContactsData?.groups.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('contacts.noContactsInPosition')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedContactsData?.groups.map(group => {
                const expanded = expandedGroups.get(group.id);
                const displayContacts = expanded ? [...group.contacts, ...expanded.contacts] : group.contacts;
                const shownCount = displayContacts.length;
                const hasMore = shownCount < group.totalContacts;
                
                return (
                  <Card key={group.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Briefcase className="h-5 w-5" />
                        {isArabic && group.nameAr ? group.nameAr : group.nameEn}
                        <Badge variant="secondary">{group.totalContacts}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2">
                        {displayContacts.map(contact => (
                          <div key={contact.id} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={contact.profilePictureThumbnailKey ? `/api/contacts/profile-picture/${contact.id}?thumbnail=true` : undefined} />
                                <AvatarFallback>{getInitials(getDisplayName(contact))}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{getDisplayName(contact)}</div>
                                <div className="text-sm text-muted-foreground">{getOrganizationName(contact.organization)}</div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {contact.isEligibleSpeaker && <Badge variant="default"><Mic className="h-3 w-3" /></Badge>}
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(contact)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {hasMore && (
                        <div className="mt-3 pt-3 border-t flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {t('contacts.buttons.showingOf', { shown: shownCount, total: group.totalContacts })}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadMoreForGroup(group.id, expanded?.page || 1, 'position')}
                          >
                            {t('contacts.buttons.showMore')}
                            <ChevronRight className="h-4 w-4 ms-1" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* By Country View */}
        <TabsContent value="by-country" className="mt-4">
          {groupedContactsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : groupedContactsData?.groups.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('contacts.noContactsInCountry')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedContactsData?.groups.map(group => {
                const expanded = expandedGroups.get(group.id);
                const displayContacts = expanded ? [...group.contacts, ...expanded.contacts] : group.contacts;
                const shownCount = displayContacts.length;
                const hasMore = shownCount < group.totalContacts;
                
                return (
                  <Card key={group.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Globe className="h-5 w-5" />
                        {isArabic && group.nameAr ? group.nameAr : group.nameEn}
                        <Badge variant="secondary">{group.totalContacts}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2">
                        {displayContacts.map(contact => (
                          <div key={contact.id} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={contact.profilePictureThumbnailKey ? `/api/contacts/profile-picture/${contact.id}?thumbnail=true` : undefined} />
                                <AvatarFallback>{getInitials(getDisplayName(contact))}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{getDisplayName(contact)}</div>
                                <div className="text-sm text-muted-foreground">
                                  {getOrganizationName(contact.organization)} • {getPositionName(contact.position)}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {contact.isEligibleSpeaker && <Badge variant="default"><Mic className="h-3 w-3" /></Badge>}
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(contact)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {hasMore && (
                        <div className="mt-3 pt-3 border-t flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {t('contacts.buttons.showingOf', { shown: shownCount, total: group.totalContacts })}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadMoreForGroup(group.id, expanded?.page || 1, 'country')}
                          >
                            {t('contacts.buttons.showMore')}
                            <ChevronRight className="h-4 w-4 ms-1" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </CardContent>
      </Card>

      {/* Create/Edit Contact Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContact
                ? t('contacts.editContact')
                : t('contacts.addNewContact')}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">
                <UserCircle className="h-4 w-4 me-2" />
                {t('contacts.contactDetails')}
              </TabsTrigger>
              {editingContact && (
                <TabsTrigger value="events">
                  <Calendar className="h-4 w-4 me-2" />
                  {t('contacts.eventsAttended')} ({(contactEventsData?.events?.length || 0) + (contactEventsData?.archivedEvents?.length || 0)})
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div className="grid gap-4 py-4">
            {/* Name fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('contacts.nameEnglish')} *</Label>
                <Input
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder={t('contacts.placeholders.nameEnglish')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('contacts.nameArabic')}</Label>
                <Input
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder={t('contacts.placeholders.nameArabic')}
                  dir="rtl"
                />
              </div>
            </div>

            {/* Title fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('contacts.titleEnglish')}</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('contacts.placeholders.titleEnglish')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('contacts.titleArabic')}</Label>
                <Input
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  placeholder={t('contacts.placeholders.titleArabic')}
                  dir="rtl"
                />
              </div>
            </div>

            {/* Organization dropdown */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                {t('contacts.organization')}
              </Label>
              <Popover open={orgOpen} onOpenChange={setOrgOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    {organizationId
                      ? getOrganizationName(organizations.find((o) => o.id === organizationId))
                      : t('contacts.selectOrganization')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('common.search')} />
                    <CommandList>
                      <CommandEmpty>{t('contacts.noResultsFound')}</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setOrganizationId(null);
                            setOrgOpen(false);
                          }}
                        >
                          <X className="me-2 h-4 w-4" />
                          {t('contacts.noOrganization')}
                        </CommandItem>
                        {organizations.map((org) => (
                          <CommandItem
                            key={org.id}
                            onSelect={() => {
                              setOrganizationId(org.id);
                              setOrgOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "me-2 h-4 w-4",
                                organizationId === org.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {getOrganizationName(org)}
                          </CommandItem>
                        ))}
                        <CommandItem
                          onSelect={() => {
                            setOrgOpen(false);
                            setShowOrgDialog(true);
                          }}
                          className="text-primary"
                        >
                          <Plus className="me-2 h-4 w-4" />
                          {t('contacts.addNewOrganization')}
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Position dropdown */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                {t('contacts.position')}
              </Label>
              <Popover open={posOpen} onOpenChange={setPosOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    {positionId
                      ? getPositionName(positions.find((p) => p.id === positionId))
                      : t('contacts.selectPosition')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('common.search')} />
                    <CommandList>
                      <CommandEmpty>{t('contacts.noResultsFound')}</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setPositionId(null);
                            setPosOpen(false);
                          }}
                        >
                          <X className="me-2 h-4 w-4" />
                          {t('contacts.noPosition')}
                        </CommandItem>
                        {positions.map((pos) => (
                          <CommandItem
                            key={pos.id}
                            onSelect={() => {
                              setPositionId(pos.id);
                              setPosOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "me-2 h-4 w-4",
                                positionId === pos.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {getPositionName(pos)}
                          </CommandItem>
                        ))}
                        <CommandItem
                          onSelect={() => {
                            setPosOpen(false);
                            setShowPosDialog(true);
                          }}
                          className="text-primary"
                        >
                          <Plus className="me-2 h-4 w-4" />
                          {t('contacts.addNewPosition')}
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Country dropdown */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t('contacts.country')}
              </Label>
              <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    {countryId
                      ? getCountryName(countries.find((c) => c.id === countryId))
                      : t('contacts.selectCountry')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('common.search')} />
                    <CommandList>
                      <CommandEmpty>{t('contacts.noResultsFound')}</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setCountryId(null);
                            setCountryOpen(false);
                          }}
                        >
                          <X className="me-2 h-4 w-4" />
                          {t('contacts.noCountry')}
                        </CommandItem>
                        {countries.map((country) => (
                          <CommandItem
                            key={country.id}
                            onSelect={() => {
                              setCountryId(country.id);
                              setCountryOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "me-2 h-4 w-4",
                                countryId === country.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {getCountryName(country)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Contact info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {t('contacts.email')}
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {t('contacts.phone')}
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+971 XX XXX XXXX"
                />
              </div>
            </div>

            {/* Profile photo */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                {t('contacts.profilePhoto')}
              </Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Avatar className="h-16 w-16 shadow-sm">
                  <AvatarImage
                    src={photoPreview || (editingContact?.id ? `/api/contacts/profile-picture/${editingContact.id}?thumbnail=true` : undefined)}
                    alt=""
                  />
                  <AvatarFallback className="bg-muted text-base">
                    {editingContact ? getInitials(getDisplayName(editingContact)) : <UserCircle className="h-5 w-5" />}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoFileChange(e.target.files?.[0] || null)}
                    disabled={uploadPhotoMutation.isPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('contacts.profilePhotoHelp')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => editingContact && profilePhotoFile && uploadPhotoMutation.mutate({ contactId: editingContact.id, file: profilePhotoFile })}
                      disabled={!editingContact || !profilePhotoFile || uploadPhotoMutation.isPending}
                      className="gap-2"
                    >
                      {uploadPhotoMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      {t('contacts.buttons.uploadPhoto')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => editingContact && deletePhotoMutation.mutate(editingContact.id)}
                      disabled={!editingContact || deletePhotoMutation.isPending}
                    >
                      {deletePhotoMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      {t('contacts.buttons.removePhoto')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Eligible speaker checkbox */}
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <Checkbox
                id="eligible-speaker"
                checked={isEligibleSpeaker}
                onCheckedChange={(checked) => setIsEligibleSpeaker(checked === true)}
              />
              <Label htmlFor="eligible-speaker" className="flex items-center gap-2 cursor-pointer">
                <Mic className="h-4 w-4" />
                {t('contacts.eligibleSpeaker')}
              </Label>
            </div>
          </div>
        </TabsContent>

        {editingContact && (
          <TabsContent value="events" className="space-y-4">
            {eventsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active Events */}
                {contactEventsData?.events && contactEventsData.events.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">{t('contacts.activeEvents')} ({contactEventsData.events.length})</h3>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('contacts.eventName')}</TableHead>
                            <TableHead>{t('contacts.eventDate')}</TableHead>
                            <TableHead>{t('contacts.eventLocation')}</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contactEventsData.events.map((event: any) => (
                            <TableRow key={event.id}>
                              <TableCell className="font-medium">
                                {isArabic && event.nameAr ? event.nameAr : event.name}
                              </TableCell>
                              <TableCell>{new Date(event.startDate).toLocaleDateString()}</TableCell>
                              <TableCell>{isArabic && event.locationAr ? event.locationAr : event.location || '-'}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setLocation(`/admin/events/${event.id}`);
                                    resetForm();
                                  }}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Archived Events */}
                {contactEventsData?.archivedEvents && contactEventsData.archivedEvents.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">{t('contacts.pastEvents')} ({contactEventsData.archivedEvents.length})</h3>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('contacts.eventName')}</TableHead>
                            <TableHead>{t('contacts.eventDate')}</TableHead>
                            <TableHead>{t('contacts.eventLocation')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contactEventsData.archivedEvents.map((event: any) => (
                            <TableRow key={event.id}>
                              <TableCell className="font-medium">
                                {isArabic && event.nameAr ? event.nameAr : event.name}
                              </TableCell>
                              <TableCell>{new Date(event.startDate).toLocaleDateString()}</TableCell>
                              <TableCell>{isArabic && event.locationAr ? event.locationAr : event.location || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {(!contactEventsData?.events?.length && !contactEventsData?.archivedEvents?.length) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>{t('contacts.noEventsAttended')}</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {editingContact ? t('contacts.saveChanges') : t('contacts.createContact')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Organization Dialog */}
      <Dialog open={showOrgDialog} onOpenChange={setShowOrgDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('contacts.addOrganization')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{t('contacts.nameEnglish')} *</Label>
              <Input
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder={t('contacts.placeholders.organizationEnglish')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('contacts.nameArabic')}</Label>
              <Input
                value={newOrgNameAr}
                onChange={(e) => setNewOrgNameAr(e.target.value)}
                placeholder={t('contacts.placeholders.organizationArabic')}
                dir="rtl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrgDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => createOrgMutation.mutate({ nameEn: newOrgName, nameAr: newOrgNameAr || undefined })}
              disabled={!newOrgName.trim() || createOrgMutation.isPending}
            >
              {t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Position Dialog */}
      <Dialog open={showPosDialog} onOpenChange={setShowPosDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('contacts.addPosition')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{t('contacts.nameEnglish')} *</Label>
              <Input
                value={newPosName}
                onChange={(e) => setNewPosName(e.target.value)}
                placeholder={t('contacts.placeholders.positionEnglish')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('contacts.nameArabic')}</Label>
              <Input
                value={newPosNameAr}
                onChange={(e) => setNewPosNameAr(e.target.value)}
                placeholder={t('contacts.placeholders.positionArabic')}
                dir="rtl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPosDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => createPosMutation.mutate({ nameEn: newPosName, nameAr: newPosNameAr || undefined })}
              disabled={!newPosName.trim() || createPosMutation.isPending}
            >
              {t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingContact} onOpenChange={(open) => !open && setDeletingContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('contacts.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingContact && t('contacts.deleteContactConfirm', { name: getDisplayName(deletingContact) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingContact && deleteContactMutation.mutate(deletingContact.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Contact Events Dialog */}
      <Dialog open={!!viewingContactEvents} onOpenChange={(open) => !open && setViewingContactEvents(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('contacts.eventHistory')} - {viewingContactEvents && getDisplayName(viewingContactEvents)}
            </DialogTitle>
          </DialogHeader>
          
          {eventsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : contactEventsData ? (
            <div className="space-y-6">
              {/* Active Events */}
              {contactEventsData.events.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {t('contacts.activeEvents')} ({contactEventsData.events.length})
                  </h4>
                  <div className="space-y-2">
                    {contactEventsData.events.map((event: any) => (
                      <Card key={event.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h5 className="font-medium">{isArabic && event.nameAr ? event.nameAr : event.name}</h5>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(parseISO(event.startDate), 'MMM dd, yyyy')}
                              </span>
                              {event.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {isArabic && event.locationAr ? event.locationAr : event.location}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setLocation(`/admin/events/${event.id}`)}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Archived Events */}
              {contactEventsData.archivedEvents.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Archive className="h-4 w-4" />
                    {t('contacts.archivedEvents')} ({contactEventsData.archivedEvents.length})
                  </h4>
                  <div className="space-y-2">
                    {contactEventsData.archivedEvents.map((event: any) => (
                      <Card key={event.id} className="p-4 bg-muted/50">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h5 className="font-medium">{isArabic && event.nameAr ? event.nameAr : event.name}</h5>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(parseISO(event.startDate), 'MMM dd, yyyy')}
                              </span>
                              {event.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {isArabic && event.locationAr ? event.locationAr : event.location}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge variant="secondary">{t('contacts.archived')}</Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {contactEventsData.events.length === 0 && contactEventsData.archivedEvents.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t('contacts.noEventsFound')}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Import Contacts Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('contacts.importContacts')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{t('contacts.csvFile')}</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setImportFile(file || null);
                }}
              />
              <p className="text-sm text-muted-foreground">
                {t('contacts.importHelp')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowImportDialog(false);
              setImportFile(null);
            }}>
              {t('common.cancel')}
            </Button>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="me-2 h-4 w-4" />
              {t('contacts.buttons.downloadTemplate')}
            </Button>
            <Button 
              onClick={() => {
                if (importFile) {
                  handleImportSubmit(importFile);
                }
              }}
              disabled={!importFile}
            >
              <Upload className="me-2 h-4 w-4" />
              {t('contacts.buttons.import')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
