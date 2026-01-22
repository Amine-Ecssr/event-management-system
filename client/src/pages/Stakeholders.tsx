import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, Pencil, Trash2, Mail, X, RefreshCw, Users, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useTranslation } from 'react-i18next';
import { PrerequisiteSelector } from '@/components/workflows/PrerequisiteSelector';
import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'wouter';

interface StakeholderEmail {
  id: number;
  stakeholderId: number;
  email: string;
  label: string | null;
  isPrimary: boolean;
}

interface StakeholderRequirement {
  id: number;
  stakeholderId: number;
  title: string;
  titleAr?: string | null;
  description: string | null;
  descriptionAr?: string | null;
  isDefault: boolean;
  notificationEmails?: string[];
  prerequisiteIds?: number[];
  dueDateBasis?: string;
}

interface Stakeholder {
  id: number;
  name: string;
  nameAr?: string | null;
  active: boolean;
  ccList: string | null;
  emails: StakeholderEmail[];
  requirements: StakeholderRequirement[];
}

export default function Stakeholders() {
  const { user } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | null>(null);
  const [deletingStakeholder, setDeletingStakeholder] = useState<Stakeholder | null>(null);
  const [loadingPrerequisites, setLoadingPrerequisites] = useState(false);
  
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [active, setActive] = useState(true);
  const [ccList, setCcList] = useState('');
  const [emails, setEmails] = useState<Array<{id?: number, email: string, label: string, isPrimary: boolean}>>([]);
  const [requirements, setRequirements] = useState<Array<{id?: number, title: string, titleAr?: string, description: string, descriptionAr?: string, isDefault: boolean, notificationEmails?: string[], prerequisiteIds?: number[], dueDateBasis?: string}>>([]);
  
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  // Redirect if not superadmin
  if (user && user.role !== 'superadmin') {
    return <Redirect to="/" />;
  }
  
  const { data: stakeholders = [], isLoading } = useQuery<Stakeholder[]>({
    queryKey: ['/api/stakeholders'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; nameAr?: string; active: boolean; ccList?: string }) => {
      return await apiRequest('POST', '/api/stakeholders', data);
    },
    onSuccess: async (stakeholder: Stakeholder) => {
      try {
        if (!stakeholder || !stakeholder.id) {
          throw new Error('Invalid stakeholder response - missing ID');
        }
        
        for (const email of emails) {
          await apiRequest('POST', `/api/stakeholders/${stakeholder.id}/emails`, email);
        }
        for (const req of requirements) {
          await apiRequest('POST', `/api/stakeholders/${stakeholder.id}/requirements`, req);
        }
        queryClient.invalidateQueries({ queryKey: ['/api/stakeholders'] });
        toast({ title: t('messages.success'), description: t('departments.departmentCreated') });
        resetForm();
      } catch (error: any) {
        console.error('Error in createMutation.onSuccess:', error);
        toast({ 
          title: t('messages.error'), 
          description: error.message || t('departments.departmentCreateError'),
          variant: 'destructive' 
        });
        queryClient.invalidateQueries({ queryKey: ['/api/stakeholders'] });
        resetForm();
      }
    },
    onError: (error: any) => {
      toast({ 
        title: t('messages.error'), 
        description: error.message || t('departments.departmentCreateError'),
        variant: 'destructive' 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest('PATCH', `/api/stakeholders/${id}`, data);
    },
    onSuccess: async (stakeholder: Stakeholder) => {
      try {
        if (!stakeholder || !stakeholder.id) {
          throw new Error('Invalid stakeholder response - missing ID');
        }
        
        const existingEmails = editingStakeholder?.emails || [];
        const existingRequirements = editingStakeholder?.requirements || [];
        
        for (const email of emails) {
          if (email.id) {
            await apiRequest('PATCH', `/api/stakeholder-emails/${email.id}`, {
              email: email.email,
              label: email.label,
              isPrimary: email.isPrimary
            });
          } else {
            await apiRequest('POST', `/api/stakeholders/${stakeholder.id}/emails`, email);
          }
        }
        
        for (const existingEmail of existingEmails) {
          if (!emails.find(e => e.id === existingEmail.id)) {
            await apiRequest('DELETE', `/api/stakeholder-emails/${existingEmail.id}`);
          }
        }
        
        for (const req of requirements) {
          if (req.id) {
            await apiRequest('PATCH', `/api/stakeholder-requirements/${req.id}`, {
              title: req.title,
              titleAr: req.titleAr,
              description: req.description,
              descriptionAr: req.descriptionAr,
              isDefault: req.isDefault,
              notificationEmails: req.notificationEmails || [],
              dueDateBasis: req.dueDateBasis || 'event_end'
            });
            
            // Sync prerequisites - get existing and compare with new
            try {
              const existingPrereqs = await apiRequest('GET', `/api/stakeholders/${stakeholder.id}/requirements/${req.id}/prerequisites`);
              const existingPrereqIds = existingPrereqs.map((p: any) => p.prerequisiteTemplateId);
              const newPrereqIds = req.prerequisiteIds || [];
              
              // Remove prerequisites that are no longer selected
              for (const prereq of existingPrereqs) {
                if (!newPrereqIds.includes(prereq.prerequisiteTemplateId)) {
                  await apiRequest('DELETE', `/api/stakeholders/${stakeholder.id}/requirements/${req.id}/prerequisites/${prereq.prerequisiteTemplateId}`);
                }
              }
              
              // Add new prerequisites
              for (const prereqId of newPrereqIds) {
                if (!existingPrereqIds.includes(prereqId)) {
                  await apiRequest('POST', `/api/stakeholders/${stakeholder.id}/requirements/${req.id}/prerequisites`, {
                    prerequisiteTemplateId: prereqId
                  });
                }
              }
            } catch (prereqError) {
              console.error('Error syncing prerequisites:', prereqError);
            }
          } else {
            await apiRequest('POST', `/api/stakeholders/${stakeholder.id}/requirements`, req);
          }
        }
        
        for (const existingReq of existingRequirements) {
          if (!requirements.find(r => r.id === existingReq.id)) {
            await apiRequest('DELETE', `/api/stakeholder-requirements/${existingReq.id}`);
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ['/api/stakeholders'] });
        toast({ title: t('messages.success'), description: t('departments.departmentUpdated') });
        resetForm();
      } catch (error: any) {
        console.error('Error in updateMutation.onSuccess:', error);
        toast({ 
          title: t('messages.error'), 
          description: error.message || t('departments.departmentUpdateError'),
          variant: 'destructive' 
        });
        queryClient.invalidateQueries({ queryKey: ['/api/stakeholders'] });
        resetForm();
      }
    },
    onError: (error: any) => {
      toast({ 
        title: t('messages.error'), 
        description: error.message || t('departments.departmentUpdateError'),
        variant: 'destructive' 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/stakeholders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholders'] });
      toast({ title: t('messages.success'), description: t('departments.departmentDeleted') });
      setDeletingStakeholder(null);
    },
    onError: (error: any) => {
      toast({ 
        title: t('messages.error'), 
        description: error.message || t('departments.departmentDeleteError'),
        variant: 'destructive' 
      });
    },
  });

  const syncKeycloakMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/keycloak/sync/all', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholders'] });
      toast({ 
        title: t('messages.success'), 
        description: 'Keycloak groups and members synced successfully' 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: t('messages.error'), 
        description: error.message || 'Failed to sync Keycloak groups',
        variant: 'destructive' 
      });
    },
  });

  const resetForm = () => {
    setShowDialog(false);
    setEditingStakeholder(null);
    setName('');
    setNameAr('');
    setActive(true);
    setCcList('');
    setEmails([]);
    setRequirements([]);
  };

  const openCreateDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEditDialog = async (stakeholder: Stakeholder) => {
    setEditingStakeholder(stakeholder);
    setName(stakeholder.name);
    setNameAr(stakeholder.nameAr || '');
    setActive(stakeholder.active);
    setCcList(stakeholder.ccList || '');
    setEmails(stakeholder.emails.map(e => ({
      id: e.id,
      email: e.email,
      label: e.label || '',
      isPrimary: e.isPrimary
    })));
    
    // Set initial requirements without prerequisites, show dialog
    setRequirements(stakeholder.requirements.map(r => ({
      id: r.id,
      title: r.title,
      titleAr: r.titleAr || '',
      description: r.description || '',
      descriptionAr: r.descriptionAr || '',
      isDefault: r.isDefault,
      notificationEmails: r.notificationEmails || [],
      prerequisiteIds: [], // Will be loaded async
      dueDateBasis: r.dueDateBasis || 'event_end'
    })));
    setShowDialog(true);
    setLoadingPrerequisites(true);
    
    // Load prerequisites in background
    try {
      const requirementsWithPrereqs = await Promise.all(
        stakeholder.requirements.map(async r => {
          let prerequisiteIds: number[] = [];
          try {
            const prereqs = await apiRequest('GET', `/api/stakeholders/${stakeholder.id}/requirements/${r.id}/prerequisites`);
            prerequisiteIds = prereqs.map((p: any) => p.prerequisiteTemplateId);
          } catch (error) {
            console.error(`Error loading prerequisites for requirement ${r.id}:`, error);
          }
          return {
            id: r.id,
            title: r.title,
            titleAr: r.titleAr || '',
            description: r.description || '',
            descriptionAr: r.descriptionAr || '',
            isDefault: r.isDefault,
            notificationEmails: r.notificationEmails || [],
            prerequisiteIds,
            dueDateBasis: r.dueDateBasis || 'event_end'
          };
        })
      );
      
      setRequirements(requirementsWithPrereqs);
    } catch (error) {
      console.error('Error loading prerequisites:', error);
    } finally {
      setLoadingPrerequisites(false);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ 
        title: t('messages.error'), 
        description: t('departments.departmentNameRequired'),
        variant: 'destructive' 
      });
      return;
    }

    if (emails.length === 0) {
      toast({ 
        title: t('messages.error'), 
        description: t('departments.atLeastOneEmail'),
        variant: 'destructive' 
      });
      return;
    }

    for (const email of emails) {
      if (!email.email.trim() || !email.email.includes('@')) {
        toast({ 
          title: t('messages.error'), 
          description: t('departments.validEmails'),
          variant: 'destructive' 
        });
        return;
      }
    }

    if (editingStakeholder) {
      updateMutation.mutate({
        id: editingStakeholder.id,
        data: { name, nameAr: nameAr.trim() || undefined, active, ccList: ccList.trim() || undefined }
      });
    } else {
      createMutation.mutate({ name, nameAr: nameAr.trim() || undefined, active, ccList: ccList.trim() || undefined });
    }
  };

  const addEmail = () => {
    setEmails([...emails, { email: '', label: '', isPrimary: emails.length === 0 }]);
  };

  const removeEmail = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, field: string, value: any) => {
    const updated = [...emails];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'isPrimary' && value) {
      updated.forEach((e, i) => {
        if (i !== index) e.isPrimary = false;
      });
    }
    setEmails(updated);
  };

  const addRequirement = () => {
    setRequirements([...requirements, { title: '', titleAr: '', description: '', descriptionAr: '', isDefault: false, notificationEmails: [], prerequisiteIds: [], dueDateBasis: 'event_end' }]);
  };

  const removeRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const updateRequirement = (index: number, field: string, value: any) => {
    const updated = [...requirements];
    updated[index] = { ...updated[index], [field]: value };
    setRequirements(updated);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <p data-testid="text-loading">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title={t('departments.title')}
        subtitle={t('departments.subtitle')}
        icon={Users}
        iconColor="text-primary"
      >
        <Button
          onClick={() => syncKeycloakMutation.mutate()}
          variant="outline"
          disabled={syncKeycloakMutation.isPending}
          data-testid="button-sync-keycloak"
        >
          <RefreshCw className={`w-4 h-4 me-2 ${syncKeycloakMutation.isPending ? 'animate-spin' : ''}`} />
          {t('departments.syncKeycloak')}
        </Button>
        <Button onClick={openCreateDialog} data-testid="button-add-stakeholder">
          <Plus className="w-4 h-4 me-2" />
          {t('departments.addDepartment')}
        </Button>
      </PageHeader>

      <div className="grid gap-4">
          {stakeholders.map((stakeholder) => (
            <Card key={stakeholder.id} data-testid={`card-stakeholder-${stakeholder.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {isArabic && stakeholder.nameAr ? stakeholder.nameAr : stakeholder.name}
                      <Badge variant={stakeholder.active ? 'default' : 'secondary'} data-testid={`badge-status-${stakeholder.id}`}>
                        {stakeholder.active ? t('common.active') : t('common.inactive')}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-2 space-y-1">
                      <div className="flex gap-4">
                        <span data-testid={`text-email-count-${stakeholder.id}`}>
                          <Mail className="w-4 h-4 inline me-1" />
                          {t('departments.emailCount', { count: stakeholder.emails.length })}
                        </span>
                        <span data-testid={`text-requirement-count-${stakeholder.id}`}>
                          {t('departments.requirementCount', { count: stakeholder.requirements.length })}
                        </span>
                      </div>
                      {stakeholder.ccList && (
                        <div className="text-sm" data-testid={`text-cc-list-${stakeholder.id}`}>
                          {t('departments.ccPrefix')}: {stakeholder.ccList}
                        </div>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => openEditDialog(stakeholder)}
                      data-testid={`button-edit-${stakeholder.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setDeletingStakeholder(stakeholder)}
                      data-testid={`button-delete-${stakeholder.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}

          {stakeholders.length === 0 && (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground" data-testid="text-no-stakeholders">
                  {t('departments.noDepartments')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-stakeholder-form">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingStakeholder ? t('departments.editDepartment') : t('departments.addDepartment')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">{t('departments.departmentName')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('departments.enterDepartmentName')}
                data-testid="input-stakeholder-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nameAr">{t('departments.fields.nameAr')}</Label>
              <Input
                id="nameAr"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder={t('departments.placeholders.nameAr')}
                dir="rtl"
                data-testid="input-stakeholder-name-ar"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={active}
                onCheckedChange={setActive}
                data-testid="switch-active"
              />
              <Label>{t('common.active')}</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ccList">{t('departments.ccList')}</Label>
              <Input
                id="ccList"
                value={ccList}
                onChange={(e) => setCcList(e.target.value)}
                placeholder={t('departments.ccListPlaceholder')}
                data-testid="input-stakeholder-cc"
              />
              <p className="text-sm text-muted-foreground">
                {t('departments.ccListDesc')}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t('departments.emailAddresses')}</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addEmail}
                  data-testid="button-add-email"
                >
                  <Plus className="w-4 h-4 me-2" />
                  {t('departments.addEmail')}
                </Button>
              </div>
              
              <div className="space-y-3">
                {emails.map((email, index) => (
                  <Card key={index} data-testid={`card-email-${index}`}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label>{t('departments.emailAddress')}</Label>
                          <Input
                            type="email"
                            value={email.email}
                            onChange={(e) => updateEmail(index, 'email', e.target.value)}
                            placeholder={t('departments.emailPlaceholder')}
                            data-testid={`input-email-address-${index}`}
                          />
                        </div>
                        <div>
                          <Label>{t('departments.emailLabel')}</Label>
                          <Input
                            value={email.label}
                            onChange={(e) => updateEmail(index, 'label', e.target.value)}
                            placeholder={t('departments.emailLabelPlaceholder')}
                            data-testid={`input-email-label-${index}`}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={email.isPrimary}
                            onCheckedChange={(checked) => updateEmail(index, 'isPrimary', checked)}
                            data-testid={`checkbox-email-primary-${index}`}
                          />
                          <Label className="text-sm">{t('departments.primaryEmail')}</Label>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEmail(index)}
                          data-testid={`button-remove-email-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t('departments.requirementTemplates')}</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addRequirement}
                  data-testid="button-add-requirement"
                >
                  <Plus className="w-4 h-4 me-2" />
                  {t('departments.addRequirement')}
                </Button>
              </div>
              
              <div className="space-y-3">
                {requirements.map((req, index) => (
                  <Card key={index} data-testid={`card-requirement-${index}`}>
                    <CardContent className="pt-4 space-y-3">
                      <div>
                        <Label htmlFor={`req-title-${index}`}>{t('departments.requirementTitle')}</Label>
                        <Input
                          id={`req-title-${index}`}
                          value={req.title}
                          onChange={(e) => updateRequirement(index, 'title', e.target.value)}
                          placeholder={t('departments.requirementTitlePlaceholder')}
                          data-testid={`input-requirement-title-${index}`}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`req-title-ar-${index}`}>{t('departments.requirementTitleAr')}</Label>
                        <Input
                          id={`req-title-ar-${index}`}
                          value={req.titleAr || ''}
                          onChange={(e) => updateRequirement(index, 'titleAr', e.target.value)}
                          placeholder={t('departments.requirementTitleArPlaceholder')}
                          dir="rtl"
                          data-testid={`input-requirement-title-ar-${index}`}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`req-desc-${index}`}>{t('departments.requirementDescription')}</Label>
                        <Textarea
                          id={`req-desc-${index}`}
                          value={req.description}
                          onChange={(e) => updateRequirement(index, 'description', e.target.value)}
                          placeholder={t('departments.requirementDescPlaceholder')}
                          rows={2}
                          data-testid={`textarea-requirement-description-${index}`}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`req-desc-ar-${index}`}>{t('departments.requirementDescriptionAr')}</Label>
                        <Textarea
                          id={`req-desc-ar-${index}`}
                          value={req.descriptionAr || ''}
                          onChange={(e) => updateRequirement(index, 'descriptionAr', e.target.value)}
                          placeholder={t('departments.requirementDescArPlaceholder')}
                          dir="rtl"
                          rows={2}
                          data-testid={`textarea-requirement-description-ar-${index}`}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`req-emails-${index}`} className="text-sm font-medium">
                          {t('departments.completionNotificationEmails')}
                        </Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          {t('departments.completionNotificationDesc')}
                        </p>
                        <Input
                          type="email"
                          placeholder={t('departments.emailPlaceholder')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault();
                              const target = e.currentTarget;
                              const email = target.value.trim();
                              if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                                updateRequirement(index, 'notificationEmails', [...(req.notificationEmails || []), email]);
                                target.value = '';
                              }
                            }
                          }}
                          data-testid={`input-requirement-notification-emails-${index}`}
                        />
                        {req.notificationEmails && req.notificationEmails.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {req.notificationEmails.map((email: string, emailIdx: number) => (
                              <Badge 
                                key={emailIdx} 
                                variant="secondary" 
                                className="gap-1 pr-1"
                                data-testid={`badge-requirement-email-${index}-${emailIdx}`}
                              >
                                {email}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...(req.notificationEmails || [])];
                                    updated.splice(emailIdx, 1);
                                    updateRequirement(index, 'notificationEmails', updated);
                                  }}
                                  className="ml-1 hover:bg-secondary-foreground/20 rounded p-0.5"
                                  data-testid={`button-remove-requirement-email-${index}-${emailIdx}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Prerequisites Selector - only show for existing requirements */}
                      {editingStakeholder && req.id && (
                        <div className="pt-2 border-t">
                          {loadingPrerequisites ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {t('common.loading')}
                            </div>
                          ) : (
                            <PrerequisiteSelector
                              currentRequirementId={req.id}
                              currentDepartmentId={editingStakeholder.id}
                              selectedPrerequisites={req.prerequisiteIds || []}
                              onPrerequisitesChange={(prereqIds) => updateRequirement(index, 'prerequisiteIds', prereqIds)}
                              data-testid={`prerequisite-selector-${index}`}
                            />
                          )}
                        </div>
                      )}
                      {!editingStakeholder && (
                        <p className="text-xs text-muted-foreground italic">
                          {t('workflows.prerequisitesDescription')} {t('common.saveFirst')}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`req-default-${index}`}
                          checked={req.isDefault}
                          onCheckedChange={(checked) => updateRequirement(index, 'isDefault', checked)}
                          data-testid={`checkbox-requirement-default-${index}`}
                        />
                        <Label htmlFor={`req-default-${index}`} className="font-normal">
                          {t('departments.autoSelectRequirement')}
                        </Label>
                      </div>
                      
                      <div>
                        <Label htmlFor={`req-due-date-${index}`}>{t('departments.dueDateBasis')}</Label>
                        <Select
                          value={req.dueDateBasis || 'event_end'}
                          onValueChange={(value) => updateRequirement(index, 'dueDateBasis', value)}
                        >
                          <SelectTrigger id={`req-due-date-${index}`} data-testid={`select-due-date-basis-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="event_start">{t('departments.dueDateEventStart')}</SelectItem>
                            <SelectItem value="event_end">{t('departments.dueDateEventEnd')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('departments.dueDateBasisDescription')}
                        </p>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeRequirement(index)}
                        data-testid={`button-remove-requirement-${index}`}
                      >
                        <Trash2 className="h-4 w-4 me-2" />
                        {t('departments.removeRequirement')}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={resetForm}
                data-testid="button-cancel"
              >
                {t('common.cancel')}
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save"
              >
                {createMutation.isPending || updateMutation.isPending ? t('common.saving') : t('departments.saveDepartment')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingStakeholder} onOpenChange={() => setDeletingStakeholder(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('departments.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('departments.deleteDescription', { name: deletingStakeholder?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingStakeholder && deleteMutation.mutate(deletingStakeholder.id)}
              data-testid="button-confirm-delete"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
