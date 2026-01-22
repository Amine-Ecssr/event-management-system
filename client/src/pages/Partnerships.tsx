import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'wouter';
import { ExportButton } from '@/components/ExportButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  Search,
  Building,
  Calendar,
  FileText,
  Users,
  TrendingUp,
  ExternalLink,
  Handshake,
  Eye,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { LoadingState, TableLoadingSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard, StatsGrid } from '@/components/ui/stat-card';

interface Partner {
  id: number;
  nameEn: string;
  nameAr: string | null;
  isPartner: boolean;
  partnershipStatus: string | null;
  partnershipTypeId: number | null;
  partnershipStartDate: string | null;
  partnershipEndDate: string | null;
  partnershipNotes: string | null;
  agreementSignedBy: string | null;
  agreementSignedByUs: string | null;
  website: string | null;
  logoKey: string | null;
  primaryContactId: number | null;
  countryId: number | null;
  country?: {
    id: number;
    code: string;
    nameEn: string;
    nameAr: string | null;
  };
  latestActivityDate?: string | null;
  lastActivityDate?: string | null;
  daysSinceLastActivity?: number | null;
  inactivityThresholdMonths?: number | null;
  notifyOnInactivity?: boolean;
  scope?: 'local' | 'regional' | 'international';
  createdAt: string;
}

interface PartnershipType {
  id: number;
  nameEn: string;
  nameAr: string | null;
}

interface PartnersResponse {
  partners: Partner[];
  total: number;
  page: number;
  limit: number;
}

interface Organization {
  id: number;
  nameEn: string;
  nameAr: string | null;
  isPartner: boolean;
  countryId?: number | null;
  country?: {
    id: number;
    code: string;
    nameEn: string;
    nameAr: string | null;
  };
}

interface PartnershipAnalytics {
  totalPartners: number;
  activePartners: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byScope: {
    local: number;
    regional: number;
    international: number;
  };
}

interface Country {
  id: number;
  code: string;
  nameEn: string;
  nameAr: string | null;
}

export default function Partnerships() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isArabic = i18n.language === 'ar';

  // Redirect if not admin or superadmin
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    setLocation('/');
    return null;
  }

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [filterType, setFilterType] = useState<string | undefined>(undefined);
  const [filterScope, setFilterScope] = useState<'local' | 'regional' | 'international' | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>('startDate');
  const [showDialog, setShowDialog] = useState(false);
  const [editingPartnership, setEditingPartnership] = useState<Partner | null>(null);
  const [deletingPartnership, setDeletingPartnership] = useState<Partner | null>(null);

  // Form state
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<number | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('active');
  const [signedDate, setSignedDate] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [agreementSignedBy, setAgreementSignedBy] = useState<string>('');
  const [agreementSignedByUs, setAgreementSignedByUs] = useState<string>('');

  // Queries
  const { data: partnersResponse, isLoading: isLoadingPartnerships } = useQuery<PartnersResponse>({
    queryKey: ['/api/partnerships', searchQuery, filterStatus, filterType, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filterStatus) params.set('status', filterStatus);
      if (filterType) params.set('type', filterType);
      if (sortBy) params.set('sortBy', sortBy);
      const url = params.toString() ? `/api/partnerships?${params.toString()}` : '/api/partnerships';
      return apiRequest('GET', url);
    },
  });
  
  // Filter partnerships by scope on the client side
  const partnerships = (partnersResponse?.partners || []).filter(partner => {
    if (filterScope && partner.scope !== filterScope) return false;
    return true;
  });

  const { data: partnershipTypes } = useQuery<PartnershipType[]>({
    queryKey: ['/api/partnership-types'],
    queryFn: async () => {
      return apiRequest('GET', '/api/partnership-types');
    },
  });

  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
  });

  const { data: countries } = useQuery<Country[]>({
    queryKey: ['/api/countries'],
    queryFn: async () => {
      return apiRequest('GET', '/api/countries');
    },
  });

  const { data: analytics } = useQuery<PartnershipAnalytics>({
    queryKey: ['/api/partnerships/analytics'],
    queryFn: async () => {
      return apiRequest('GET', '/api/partnerships/analytics');
    },
  });

  // Filter non-partner organizations for the dropdown
  const availableOrganizations = organizations?.filter(org => !org.isPartner) || [];

  // Mutations
  const createPartnershipMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/partnerships', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships'] });
      queryClient.invalidateQueries({ queryKey: ['/api/organizations'] });
      toast({ description: t('partnerships.messages.partnershipCreated') });
      resetForm();
      setShowDialog(false);
    },
    onError: (error: any) => {
      toast({ 
        description: error.message || t('common.error'), 
        variant: 'destructive' 
      });
    },
  });

  const updatePartnershipMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest('PUT', `/api/partnerships/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships'] });
      toast({ description: t('partnerships.messages.partnershipUpdated') });
      resetForm();
      setShowDialog(false);
    },
    onError: (error: any) => {
      toast({ 
        description: error.message || t('common.error'), 
        variant: 'destructive' 
      });
    },
  });

  const deletePartnershipMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/partnerships/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships'] });
      queryClient.invalidateQueries({ queryKey: ['/api/organizations'] });
      toast({ description: t('partnerships.messages.partnershipDeleted') });
      setDeletingPartnership(null);
    },
    onError: (error: any) => {
      toast({ 
        description: error.message || t('common.error'), 
        variant: 'destructive' 
      });
    },
  });

  // Helper functions
  const resetForm = () => {
    setSelectedOrganizationId(null);
    setSelectedTypeId(null);
    setSelectedCountryId(null);
    setStatus('active');
    setSignedDate('');
    setStartDate('');
    setEndDate('');
    setNotes('');
    setAgreementSignedBy('');
    setAgreementSignedByUs('');
    setEditingPartnership(null);
  };

  const handleOpenDialog = (partnership?: Partner) => {
    if (partnership) {
      setEditingPartnership(partnership);
      setSelectedOrganizationId(partnership.id);
      setSelectedTypeId(partnership.partnershipTypeId || null);
      setSelectedCountryId(partnership.countryId || null);
      setStatus(partnership.partnershipStatus || 'active');
      setSignedDate('');
      setStartDate(partnership.partnershipStartDate ? partnership.partnershipStartDate.split('T')[0] : '');
      setEndDate(partnership.partnershipEndDate ? partnership.partnershipEndDate.split('T')[0] : '');
      setNotes(partnership.partnershipNotes || '');
      setAgreementSignedBy(partnership.agreementSignedBy || '');
      setAgreementSignedByUs(partnership.agreementSignedByUs || '');
    } else {
      resetForm();
    }
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!selectedOrganizationId && !editingPartnership) {
      toast({ description: t('common.required'), variant: 'destructive' });
      return;
    }

    const data = {
      organizationId: selectedOrganizationId || editingPartnership?.id,
      partnershipTypeId: selectedTypeId,
      countryId: selectedCountryId,
      partnershipStatus: status,
      partnershipSignedDate: signedDate || null,
      partnershipStartDate: startDate || null,
      partnershipEndDate: endDate || null,
      partnershipNotes: notes || null,
      agreementSignedBy: agreementSignedBy || null,
      agreementSignedByUs: agreementSignedByUs || null,
    };

    if (editingPartnership) {
      updatePartnershipMutation.mutate({ id: editingPartnership.id, data });
    } else {
      createPartnershipMutation.mutate(data);
    }
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
      case 'terminated':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCountryName = (country?: { nameEn: string; nameAr: string | null }) => {
    if (!country) return '-';
    return isArabic && country.nameAr ? country.nameAr : country.nameEn;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title={t('partnerships.title')}
        subtitle={t('partnerships.subtitle')}
      >
        <ExportButton 
          entityType="partnerships"
          filters={{
            ...(filterStatus && { status: filterStatus }),
            ...(filterType && { type: filterType }),
            ...(filterScope && { scope: filterScope }),
          }}
          variant="outline"
        />
      </PageHeader>

      {/* Analytics Cards */}
      <StatsGrid columns={4}>
        <StatCard
          title={t('partnerships.analytics.totalPartners')}
          value={analytics?.totalPartners || 0}
          icon={Handshake}
        />
        <StatCard
          title={isArabic ? 'محلي (الإمارات)' : 'Local (UAE)'}
          value={analytics?.byScope?.local || 0}
          icon={Building}
          variant="success"
          onClick={() => setFilterScope(filterScope === 'local' ? undefined : 'local')}
          className="cursor-pointer"
        />
        <StatCard
          title={isArabic ? 'إقليمي (الخليج والشرق الأوسط)' : 'Regional (GCC & MENA)'}
          value={analytics?.byScope?.regional || 0}
          icon={Users}
          variant="info"
          onClick={() => setFilterScope(filterScope === 'regional' ? undefined : 'regional')}
          className="cursor-pointer"
        />
        <StatCard
          title={isArabic ? 'دولي' : 'International'}
          value={analytics?.byScope?.international || 0}
          icon={ExternalLink}
          variant="warning"
          onClick={() => setFilterScope(filterScope === 'international' ? undefined : 'international')}
          className="cursor-pointer"
        />
      </StatsGrid>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>{t('partnerships.partnersList')}</CardTitle>
            <Button onClick={() => handleOpenDialog()} data-testid="btn-add-partnership">
              <Plus className="me-2 h-4 w-4" />
              {t('partnerships.addPartnership')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('partnerships.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9"
                data-testid="input-search"
              />
            </div>
            <Select
              value={filterStatus || 'all'}
              onValueChange={(v) => setFilterStatus(v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-full md:w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder={t('partnerships.filters.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('partnerships.filters.allStatuses')}</SelectItem>
                <SelectItem value="active">{t('partnerships.statuses.active')}</SelectItem>
                <SelectItem value="inactive">{t('partnerships.statuses.inactive')}</SelectItem>
                <SelectItem value="pending">{t('partnerships.statuses.pending')}</SelectItem>
                <SelectItem value="expired">{t('partnerships.statuses.expired')}</SelectItem>
                <SelectItem value="terminated">{t('partnerships.statuses.terminated')}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterType || 'all'}
              onValueChange={(v) => setFilterType(v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-full md:w-[180px]" data-testid="select-type-filter">
                <SelectValue placeholder={t('partnerships.filters.allTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('partnerships.filters.allTypes')}</SelectItem>
                {partnershipTypes?.map((type) => (
                  <SelectItem key={type.id} value={type.id.toString()}>
                    {isArabic ? type.nameAr || type.nameEn : type.nameEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sortBy}
              onValueChange={setSortBy}
            >
              <SelectTrigger className="w-full md:w-[180px]" data-testid="select-sort">
                <SelectValue placeholder={t('partnerships.filters.sortBy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="startDate">{t('partnerships.filters.sortByStartDate')}</SelectItem>
                <SelectItem value="latestActivity">{t('partnerships.filters.sortByLatestActivity')}</SelectItem>
                <SelectItem value="oldestActivity">{t('partnerships.filters.sortByOldestActivity')}</SelectItem>
                <SelectItem value="name">{t('partnerships.filters.sortByName')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Partnerships Table */}
          {isLoadingPartnerships ? (
            <TableLoadingSkeleton rows={5} columns={6} />
          ) : partnerships.length === 0 ? (
            <EmptyState
              icon={<Handshake className="h-12 w-12" />}
              title={t('partnerships.noPartnershipsFound')}
              description={t('partnerships.noPartnersYet')}
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('partnerships.fields.organization')}</TableHead>
                    <TableHead>{t('partnerships.fields.partnershipType')}</TableHead>
                    <TableHead>{t('partnerships.fields.status')}</TableHead>
                    <TableHead>{t('partnerships.fields.startDate')}</TableHead>
                    <TableHead>{t('partnerships.fields.latestActivity')}</TableHead>
                    <TableHead className="text-end">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partnerships.map((partnership) => (
                    <TableRow key={partnership.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col gap-1">
                            <Link 
                              href={`/admin/partnerships/${partnership.id}`}
                              className="font-medium hover:underline hover:text-primary transition-colors cursor-pointer"
                              data-testid={`link-partnership-${partnership.id}`}
                            >
                              {isArabic ? partnership.nameAr || partnership.nameEn : partnership.nameEn}
                            </Link>
                            {partnership.scope && (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "w-fit text-xs",
                                  partnership.scope === 'local' && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
                                  partnership.scope === 'regional' && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
                                  partnership.scope === 'international' && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                                )}
                              >
                                {partnership.scope === 'local' && (isArabic ? 'محلي' : 'Local')}
                                {partnership.scope === 'regional' && (isArabic ? 'إقليمي' : 'Regional')}
                                {partnership.scope === 'international' && (isArabic ? 'دولي' : 'International')}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {partnership.partnershipTypeId ? (
                          <Badge variant="outline">
                            {(() => {
                              const type = partnershipTypes?.find(t => t.id === partnership.partnershipTypeId);
                              return type ? (isArabic ? type.nameAr || type.nameEn : type.nameEn) : '-';
                            })()}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(partnership.partnershipStatus || 'active')}>
                          {t(`partnerships.statuses.${partnership.partnershipStatus || 'active'}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {partnership.partnershipStartDate
                          ? format(parseISO(partnership.partnershipStartDate), 'PP')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {partnership.latestActivityDate ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>{format(parseISO(partnership.latestActivityDate), 'PP')}</span>
                            </div>
                            {/* Show inactivity warning if applicable */}
                            {partnership.daysSinceLastActivity !== null && partnership.daysSinceLastActivity !== undefined && (
                              (() => {
                                const threshold = (partnership.inactivityThresholdMonths || 6) * 30; // approx days
                                const isStale = partnership.daysSinceLastActivity >= threshold;
                                const isNearStale = partnership.daysSinceLastActivity >= threshold * 0.75;
                                
                                if (isStale) {
                                  return (
                                    <Badge variant="outline" className="w-fit text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
                                      ⚠️ {isArabic ? `${partnership.daysSinceLastActivity} يوم بدون نشاط` : `${partnership.daysSinceLastActivity} days inactive`}
                                    </Badge>
                                  );
                                } else if (isNearStale) {
                                  return (
                                    <Badge variant="outline" className="w-fit text-xs bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800">
                                      {isArabic ? `${partnership.daysSinceLastActivity} يوم منذ آخر نشاط` : `${partnership.daysSinceLastActivity} days ago`}
                                    </Badge>
                                  );
                                }
                                return null;
                              })()
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="text-muted-foreground italic">{t('partnerships.noActivitiesYet')}</span>
                            <Badge variant="outline" className="w-fit text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
                              ⚠️ {isArabic ? 'لا يوجد أي نشاط' : 'No activity recorded'}
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLocation(`/admin/partnerships/${partnership.id}`)}
                            data-testid={`btn-view-${partnership.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(partnership)}
                            data-testid={`btn-edit-${partnership.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingPartnership(partnership)}
                            data-testid={`btn-delete-${partnership.id}`}
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
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPartnership ? t('partnerships.editPartnership') : t('partnerships.newPartnership')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!editingPartnership && (
              <div className="space-y-2">
                <Label>{t('partnerships.fields.organization')} *</Label>
                <Select
                  value={selectedOrganizationId?.toString() || ''}
                  onValueChange={(v) => setSelectedOrganizationId(parseInt(v))}
                >
                  <SelectTrigger data-testid="select-organization">
                    <SelectValue placeholder={t('partnerships.placeholders.selectOrganization')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOrganizations.map((org) => (
                      <SelectItem key={org.id} value={org.id.toString()}>
                        {isArabic ? org.nameAr || org.nameEn : org.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('partnerships.fields.partnershipType')}</Label>
              <Select
                value={selectedTypeId?.toString() || ''}
                onValueChange={(v) => setSelectedTypeId(v ? parseInt(v) : null)}
              >
                <SelectTrigger data-testid="select-type">
                  <SelectValue placeholder={t('partnerships.placeholders.selectType')} />
                </SelectTrigger>
                <SelectContent>
                  {partnershipTypes?.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {isArabic ? type.nameAr || type.nameEn : type.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('partnerships.fields.country')}</Label>
              <Select
                value={selectedCountryId?.toString() || ''}
                onValueChange={(v) => setSelectedCountryId(v ? parseInt(v) : null)}
              >
                <SelectTrigger data-testid="select-country">
                  <SelectValue placeholder={t('partnerships.placeholders.selectCountry')} />
                </SelectTrigger>
                <SelectContent>
                  {countries?.map((country) => (
                    <SelectItem key={country.id} value={country.id.toString()}>
                      {getCountryName(country)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('partnerships.fields.status')}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('partnerships.statuses.active')}</SelectItem>
                  <SelectItem value="inactive">{t('partnerships.statuses.inactive')}</SelectItem>
                  <SelectItem value="pending">{t('partnerships.statuses.pending')}</SelectItem>
                  <SelectItem value="expired">{t('partnerships.statuses.expired')}</SelectItem>
                  <SelectItem value="terminated">{t('partnerships.statuses.terminated')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('partnerships.fields.signedDate')}</Label>
                <Input
                  type="date"
                  value={signedDate}
                  onChange={(e) => setSignedDate(e.target.value)}
                  data-testid="input-signed-date"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('partnerships.fields.startDate')}</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('partnerships.fields.endDate')}</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isArabic ? 'موقع من قبل (الشريك)' : 'Signed By (Partner)'}</Label>
                <Input
                  value={agreementSignedBy}
                  onChange={(e) => setAgreementSignedBy(e.target.value)}
                  placeholder={isArabic ? 'اسم الموقع من جانب الشريك' : 'Name of signatory from partner side'}
                  data-testid="input-signed-by"
                />
              </div>
              <div className="space-y-2">
                <Label>{isArabic ? 'موقع من قبل (المركز)' : 'Signed By (ECSSR)'}</Label>
                <Input
                  value={agreementSignedByUs}
                  onChange={(e) => setAgreementSignedByUs(e.target.value)}
                  placeholder={isArabic ? 'اسم الموقع من جانب المركز' : 'Name of ECSSR signatory'}
                  data-testid="input-signed-by-us"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('partnerships.fields.notes')}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('partnerships.placeholders.notesPlaceholder')}
                rows={3}
                data-testid="textarea-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createPartnershipMutation.isPending || updatePartnershipMutation.isPending}
              data-testid="btn-submit"
            >
              {editingPartnership ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingPartnership} onOpenChange={() => setDeletingPartnership(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('partnerships.confirmations.deletePartnership')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPartnership && deletePartnershipMutation.mutate(deletingPartnership.id)}
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
