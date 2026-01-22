import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, ArrowLeft, Search, LucideIcon } from 'lucide-react';

// Field configuration for additional fields beyond nameEn/nameAr
export interface FieldConfig {
  key: string;
  labelEn: string;
  labelAr: string;
  type: 'text' | 'url' | 'select';
  required?: boolean;
  // For select fields
  options?: { value: string | number; labelEn: string; labelAr: string }[];
  optionsQueryKey?: string[];
  optionsEndpoint?: string;
  optionValueKey?: string;
  optionLabelEnKey?: string;
  optionLabelArKey?: string;
  placeholder?: string;
  placeholderAr?: string;
  helperText?: string;
  helperTextAr?: string;
}

// Configuration for a dropdown type
export interface DropdownConfig {
  // Basic info
  key: string;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
  icon: LucideIcon;
  
  // API endpoints
  apiEndpoint: string;
  queryKey: string[];
  
  // Column display - which fields to show in table
  tableColumns?: {
    key: string;
    headerEn: string;
    headerAr: string;
    render?: (item: any, isArabic: boolean) => React.ReactNode;
  }[];
  
  // Additional form fields beyond nameEn/nameAr
  additionalFields?: FieldConfig[];
  
  // Messages
  messages: {
    createSuccessEn: string;
    createSuccessAr: string;
    updateSuccessEn: string;
    updateSuccessAr: string;
    deleteSuccessEn: string;
    deleteSuccessAr: string;
    deleteConfirmEn: string;
    deleteConfirmAr: string;
    noItemsEn: string;
    noItemsAr: string;
    addButtonEn: string;
    addButtonAr: string;
    dialogTitleAddEn: string;
    dialogTitleAddAr: string;
    dialogTitleEditEn: string;
    dialogTitleEditAr: string;
  };
}

interface GenericDropdownManagementProps {
  config: DropdownConfig;
}

export function GenericDropdownManagement({ config }: GenericDropdownManagementProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isArabic = i18n.language === 'ar';

  // Access control
  const isAdminOrSuperAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  
  if (!isAdminOrSuperAdmin) {
    setLocation('/');
    return null;
  }

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: number }>({ open: false });
  
  // Form state
  const [formData, setFormData] = useState<Record<string, any>>({
    nameEn: '',
    nameAr: '',
  });

  // Fetch main data
  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: config.queryKey,
    queryFn: async () => {
      const response = await fetch(config.apiEndpoint, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch data');
      return response.json();
    },
  });

  // Fetch options for select fields
  const selectFieldsWithEndpoints = config.additionalFields?.filter(
    f => f.type === 'select' && f.optionsEndpoint
  ) || [];
  
  const optionsQueries = selectFieldsWithEndpoints.map(field => {
    return useQuery({
      queryKey: field.optionsQueryKey || [field.key + '-options'],
      queryFn: async () => {
        const response = await fetch(field.optionsEndpoint!, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch options');
        return response.json();
      },
      enabled: !!field.optionsEndpoint,
    });
  });

  // Build options map for select fields
  const optionsMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    selectFieldsWithEndpoints.forEach((field, index) => {
      map[field.key] = optionsQueries[index]?.data || [];
    });
    return map;
  }, [selectFieldsWithEndpoints, optionsQueries]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => 
      item.nameEn?.toLowerCase().includes(query) ||
      item.nameAr?.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  // Reset form
  const resetForm = () => {
    const initial: Record<string, any> = { nameEn: '', nameAr: '' };
    config.additionalFields?.forEach(field => {
      initial[field.key] = field.type === 'select' ? null : '';
    });
    setFormData(initial);
    setEditingItem(null);
  };

  // Open dialog for editing
  const openEditDialog = (item: any) => {
    const data: Record<string, any> = {
      nameEn: item.nameEn || '',
      nameAr: item.nameAr || '',
    };
    config.additionalFields?.forEach(field => {
      data[field.key] = item[field.key] ?? (field.type === 'select' ? null : '');
    });
    setFormData(data);
    setEditingItem(item);
    setDialogOpen(true);
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', config.apiEndpoint, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: config.queryKey });
      toast({
        title: t('messages.success'),
        description: isArabic ? config.messages.createSuccessAr : config.messages.createSuccessEn,
      });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: t('messages.error'), description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest('PUT', `${config.apiEndpoint}/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: config.queryKey });
      toast({
        title: t('messages.success'),
        description: isArabic ? config.messages.updateSuccessAr : config.messages.updateSuccessEn,
      });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: t('messages.error'), description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`${config.apiEndpoint}/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: config.queryKey });
      toast({
        title: t('messages.success'),
        description: isArabic ? config.messages.deleteSuccessAr : config.messages.deleteSuccessEn,
      });
      setDeleteDialog({ open: false });
    },
    onError: (error: any) => {
      toast({ title: t('messages.error'), description: error.message, variant: 'destructive' });
    },
  });

  // Handle form submission
  const handleSubmit = () => {
    if (!formData.nameEn?.trim()) {
      toast({
        title: t('messages.error'),
        description: isArabic ? 'الاسم الإنجليزي مطلوب' : 'English name is required',
        variant: 'destructive',
      });
      return;
    }

    // Check required additional fields
    for (const field of config.additionalFields || []) {
      if (field.required && !formData[field.key]) {
        toast({
          title: t('messages.error'),
          description: isArabic ? `${field.labelAr} مطلوب` : `${field.labelEn} is required`,
          variant: 'destructive',
        });
        return;
      }
    }

    const data: Record<string, any> = {
      nameEn: formData.nameEn.trim(),
      nameAr: formData.nameAr?.trim() || undefined,
    };

    // Add additional fields
    config.additionalFields?.forEach(field => {
      if (field.type === 'select') {
        data[field.key] = formData[field.key] || null;
      } else if (field.type === 'url') {
        data[field.key] = formData[field.key]?.trim() || null;
      } else {
        data[field.key] = formData[field.key]?.trim() || undefined;
      }
    });

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Default table columns if not specified
  const tableColumns = config.tableColumns || [
    { key: 'nameEn', headerEn: 'English Name', headerAr: 'الاسم بالإنجليزية' },
    { key: 'nameAr', headerEn: 'Arabic Name', headerAr: 'الاسم بالعربية' },
  ];

  const Icon = config.icon;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation('/admin/dropdowns')}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader
          title={isArabic ? config.titleAr : config.titleEn}
          subtitle={isArabic ? config.subtitleAr : config.subtitleEn}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle>
              {isArabic ? config.titleAr : config.titleEn}
              <span className="ms-2 text-sm font-normal text-muted-foreground">
                ({filteredItems.length})
              </span>
            </CardTitle>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 me-2" />
            {isArabic ? config.messages.addButtonAr : config.messages.addButtonEn}
          </Button>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isArabic ? 'بحث...' : 'Search...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9"
              />
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {searchQuery
                ? (isArabic ? 'لا توجد نتائج' : 'No results found')
                : (isArabic ? config.messages.noItemsAr : config.messages.noItemsEn)}
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    {tableColumns.map(col => (
                      <TableHead key={col.key}>
                        {isArabic ? col.headerAr : col.headerEn}
                      </TableHead>
                    ))}
                    <TableHead className="text-end w-24">
                      {isArabic ? 'الإجراءات' : 'Actions'}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      {tableColumns.map(col => (
                        <TableCell key={col.key} dir={col.key === 'nameAr' ? 'rtl' : undefined}>
                          {col.render
                            ? col.render(item, isArabic)
                            : (item[col.key] || '-')}
                        </TableCell>
                      ))}
                      <TableCell className="text-end">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDeleteDialog({ open: true, id: item.id })}
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
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem
                ? (isArabic ? config.messages.dialogTitleEditAr : config.messages.dialogTitleEditEn)
                : (isArabic ? config.messages.dialogTitleAddAr : config.messages.dialogTitleAddEn)}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* English Name */}
            <div className="space-y-2">
              <Label>{isArabic ? 'الاسم بالإنجليزية' : 'English Name'} *</Label>
              <Input
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                placeholder={isArabic ? 'أدخل الاسم بالإنجليزية' : 'Enter English name'}
              />
            </div>

            {/* Arabic Name */}
            <div className="space-y-2">
              <Label>{isArabic ? 'الاسم بالعربية' : 'Arabic Name'}</Label>
              <Input
                dir="rtl"
                value={formData.nameAr}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                placeholder={isArabic ? 'أدخل الاسم بالعربية' : 'Enter Arabic name'}
              />
            </div>

            {/* Additional Fields */}
            {config.additionalFields?.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>
                  {isArabic ? field.labelAr : field.labelEn}
                  {field.required && ' *'}
                </Label>
                
                {field.type === 'select' ? (
                  <Select
                    value={formData[field.key]?.toString() || undefined}
                    onValueChange={(v) => setFormData({
                      ...formData,
                      [field.key]: v ? (isNaN(Number(v)) ? v : parseInt(v)) : null,
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={isArabic
                          ? (field.placeholderAr || 'اختر...')
                          : (field.placeholder || 'Select...')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options || optionsMap[field.key] || []).map((opt: any) => {
                        const value = field.optionValueKey ? opt[field.optionValueKey] : opt.value;
                        const labelEn = field.optionLabelEnKey ? opt[field.optionLabelEnKey] : opt.labelEn;
                        const labelAr = field.optionLabelArKey ? opt[field.optionLabelArKey] : opt.labelAr;
                        return (
                          <SelectItem key={value} value={value.toString()}>
                            {isArabic && labelAr ? labelAr : labelEn}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={field.type}
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    placeholder={isArabic
                      ? (field.placeholderAr || '')
                      : (field.placeholder || '')}
                  />
                )}
                
                {(field.helperText || field.helperTextAr) && (
                  <p className="text-xs text-muted-foreground">
                    {isArabic ? (field.helperTextAr || field.helperText) : field.helperText}
                  </p>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingItem ? t('common.save') : t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isArabic ? 'تأكيد الحذف' : 'Confirm Delete'}</DialogTitle>
          </DialogHeader>
          <p>
            {isArabic ? config.messages.deleteConfirmAr : config.messages.deleteConfirmEn}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false })}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialog.id && deleteMutation.mutate(deleteDialog.id)}
              disabled={deleteMutation.isPending}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
