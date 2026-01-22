import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CardLoadingState, TableLoadingSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  MoreVertical,
  Eye,
  Users,
  Phone,
  Mail,
  User as UserIcon,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { ExportButton } from '@/components/ExportButton';

interface Lead {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  type: 'lead' | 'partner' | 'customer';
  status: 'active' | 'in_progress' | 'inactive';
  createdAt: string;
  interactionsCount?: number;
  tasksCount?: number;
  pendingTasksCount?: number;
}

const LEAD_TYPES = ['lead', 'partner', 'customer'] as const;
const LEAD_STATUSES = ['active', 'in_progress', 'inactive'] as const;

export default function LeadManagement() {
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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    type: 'lead' as typeof LEAD_TYPES[number],
    status: 'active' as typeof LEAD_STATUSES[number],
  });

  // Fetch leads
  const { data: leads = [], isLoading, error } = useQuery<Lead[]>({
    queryKey: ['/api/leads', { search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      return apiRequest('GET', `/api/leads?${params.toString()}`);
    },
  });

  // Create lead mutation
  const createLeadMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/leads', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({ title: t('leads.messages.leadCreated') });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  // Update lead mutation
  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      return apiRequest('PUT', `/api/leads/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({ title: t('leads.messages.leadUpdated') });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  // Delete lead mutation
  const deleteLeadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({ title: t('leads.messages.leadDeleted') });
      setIsDeleteDialogOpen(false);
      setDeletingLead(null);
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const openCreateDialog = () => {
    setEditingLead(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      type: 'lead',
      status: 'active',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name,
      email: lead.email || '',
      phone: lead.phone || '',
      type: lead.type,
      status: lead.status,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingLead(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      type: 'lead',
      status: 'active',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      email: formData.email || null,
      phone: formData.phone || null,
    };

    if (editingLead) {
      updateLeadMutation.mutate({ id: editingLead.id, data: data as any });
    } else {
      createLeadMutation.mutate(data as any);
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'lead': return 'default';
      case 'partner': return 'secondary';
      case 'customer': return 'outline';
      default: return 'default';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'in_progress': return 'secondary';
      case 'inactive': return 'outline';
      default: return 'default';
    }
  };

  // Filter leads
  const filteredLeads = leads.filter(lead => {
    if (selectedType !== 'all' && lead.type !== selectedType) return false;
    if (selectedStatus !== 'all' && lead.status !== selectedStatus) return false;
    return true;
  });

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-500">
          {t('common.error')}: {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <PageHeader
        title={t('leads.title')}
        subtitle={t('leads.subtitle')}
        icon={Users}
      >
        <ExportButton
          entityType="leads"
          variant="ghost"
          size="sm"
        />
      </PageHeader>

      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('leads.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('leads.filters.allTypes')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('leads.filters.allTypes')}</SelectItem>
            {LEAD_TYPES.map(type => (
              <SelectItem key={type} value={type}>
                {t(`leads.types.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('leads.filters.allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('leads.filters.allStatuses')}</SelectItem>
            {LEAD_STATUSES.map(status => (
              <SelectItem key={status} value={status}>
                {t(`leads.statuses.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
            title={t('leads.viewModes.grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('table')}
            title={t('leads.viewModes.table')}
          >
            <TableIcon className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {t('leads.addLead')}
        </Button>
      </div>

      {/* Leads Grid/Table */}
      {isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <CardLoadingState key={i} showHeader />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <TableLoadingSkeleton rows={5} columns={6} />
            </CardContent>
          </Card>
        )
      ) : filteredLeads.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title={searchQuery ? t('leads.noLeadsFound') : t('leads.noLeadsYet')}
          action={!searchQuery && (
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t('leads.addLead')}
            </Button>
          )}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map(lead => (
            <Card
              key={lead.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setLocation(`/admin/leads/${lead.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{lead.name}</CardTitle>
                    <div className="flex gap-2 mt-1">
                      <Badge variant={getTypeBadgeVariant(lead.type)}>
                        {t(`leads.types.${lead.type}`)}
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(lead.status)}>
                        {t(`leads.statuses.${lead.status}`)}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/admin/leads/${lead.id}`);
                      }}>
                        <Eye className="h-4 w-4 mr-2" />
                        {t('leads.viewLead')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(lead);
                      }}>
                        <Pencil className="h-4 w-4 mr-2" />
                        {t('leads.editLead')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingLead(lead);
                          setIsDeleteDialogOpen(true);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('leads.deleteLead')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {lead.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{lead.email}</span>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{lead.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs">
                      {t('leads.overview.totalInteractions')}: {lead.interactionsCount || 0}
                    </span>
                    <span className="text-xs">
                      {t('leads.overview.pendingTasks')}: {lead.pendingTasksCount || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">{t('leads.fields.name')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('leads.fields.type')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('leads.fields.status')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('leads.fields.email')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('leads.fields.phone')}</TableHead>
                  <TableHead className="hidden xl:table-cell text-center">{t('leads.overview.totalInteractions')}</TableHead>
                  <TableHead className="hidden xl:table-cell text-center">{t('leads.overview.pendingTasks')}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map(lead => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() => setLocation(`/admin/leads/${lead.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                        <span>{lead.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={getTypeBadgeVariant(lead.type)}>
                        {t(`leads.types.${lead.type}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={getStatusBadgeVariant(lead.status)}>
                        {t(`leads.statuses.${lead.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {lead.email ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          <span className="truncate max-w-[200px]">{lead.email}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {lead.phone ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span>{lead.phone}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-center">
                      <Badge variant="outline">{lead.interactionsCount || 0}</Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-center">
                      <Badge variant="outline">{lead.pendingTasksCount || 0}</Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/admin/leads/${lead.id}`);
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            {t('leads.viewLead')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(lead);
                          }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            {t('leads.editLead')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingLead(lead);
                              setIsDeleteDialogOpen(true);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('leads.deleteLead')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Lead Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLead ? t('leads.editLead') : t('leads.newLead')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('leads.fields.name')} *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('leads.placeholders.namePlaceholder')}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('leads.fields.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={t('leads.placeholders.emailPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('leads.fields.phone')}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={t('leads.placeholders.phonePlaceholder')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('leads.fields.type')}</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value as typeof LEAD_TYPES[number] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_TYPES.map(type => (
                        <SelectItem key={type} value={type}>
                          {t(`leads.types.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('leads.fields.status')}</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as typeof LEAD_STATUSES[number] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map(status => (
                        <SelectItem key={status} value={status}>
                          {t(`leads.statuses.${status}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                {t('common.cancel')}
              </Button>
              <Button 
                type="submit" 
                disabled={createLeadMutation.isPending || updateLeadMutation.isPending}
              >
                {editingLead ? t('common.save') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('leads.deleteLead')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('leads.confirmations.deleteLead')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingLead && deleteLeadMutation.mutate(deletingLead.id)}
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
