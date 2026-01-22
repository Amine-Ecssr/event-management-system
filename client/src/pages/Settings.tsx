import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  DialogDescription,
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
import { Key, UserPlus, Globe, Upload, RefreshCw, DatabaseZap, Settings as SettingsIcon, Archive, Search, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/PageHeader';
import { Redirect } from 'wouter';

export default function Settings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  // Redirect if not superadmin
  if (user && user.role !== 'superadmin') {
    return <Redirect to="/" />;
  }

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'superadmin'>('admin');
  const [pendingSampleAction, setPendingSampleAction] = useState<'seed' | 'reset' | null>(null);

  const { data: settings } = useQuery<{
    publicCsvExport: boolean;
    fileUploadsEnabled: boolean;
    scrapedEventsEnabled: boolean;
    archiveEnabled?: boolean;
    allowStakeholderAttendeeUpload?: boolean;
    stakeholderUploadPermissions?: Record<string, boolean>;
  }>({
    queryKey: ['/api/settings/admin'],
  });

  // Query stakeholders for permission management
  const { data: stakeholders = [] } = useQuery<Array<{ id: number; name: string; active: boolean }>>({
    queryKey: ['/api/stakeholders'],
    enabled: isSuperAdmin,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: {
      publicCsvExport?: boolean;
      fileUploadsEnabled?: boolean;
      scrapedEventsEnabled?: boolean;
      archiveEnabled?: boolean;
      allowStakeholderAttendeeUpload?: boolean;
      stakeholderUploadPermissions?: Record<string, boolean>;
    }) => {
      return await apiRequest('PATCH', '/api/settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/admin'] });
      toast({
        title: t('settings.settingsUpdated'),
        description: t('settings.settingsUpdatedSuccess'),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('settings.updateFailed'),
        variant: 'destructive',
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return await apiRequest('POST', '/api/user/change-password', data);
    },
    onSuccess: () => {
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toast({
        title: t('settings.passwordChanged'),
        description: t('settings.passwordChangedSuccess'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('settings.passwordChangeFailed'),
        variant: 'destructive',
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; role?: 'admin' | 'superadmin' }) => {
      return await apiRequest('POST', '/api/admin/create-user', data);
    },
    onSuccess: () => {
      setShowCreateUser(false);
      setNewUsername('');
      setNewUserPassword('');
      setNewUserRole('admin');
      toast({
        title: t('settings.userCreated'),
        description: t('settings.userCreatedSuccess'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('settings.createUserFailed'),
        variant: 'destructive',
      });
    },
  });

  const sampleDataMutation = useMutation<{ message: string }, Error, 'seed' | 'reset'>({
    mutationFn: async (action) => {
      return await apiRequest<{ message: string }>('POST', '/api/admin/sample-data', { action });
    },
    onSuccess: (_data, action) => {
      toast({
        title: t('settings.sampleDataActionSuccess'),
        description:
          action === 'seed' ? t('settings.seedSampleDataSuccess') : t('settings.resetSampleDataSuccess'),
      });
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('settings.sampleDataActionError'),
        variant: 'destructive',
      });
    },
  });

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast({
        title: t('common.error'),
        description: t('settings.allFieldsRequired'),
        variant: 'destructive',
      });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({
        title: t('common.error'),
        description: t('settings.passwordsDoNotMatch'),
        variant: 'destructive',
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleCreateUser = () => {
    if (!newUsername || !newUserPassword) {
      toast({
        title: t('common.error'),
        description: t('settings.usernamePasswordRequired'),
        variant: 'destructive',
      });
      return;
    }
    createUserMutation.mutate({ username: newUsername, password: newUserPassword, role: newUserRole });
  };

  const confirmSampleAction = () => {
    if (pendingSampleAction) {
      sampleDataMutation.mutate(pendingSampleAction);
      setPendingSampleAction(null);
    }
  };

  const toggleStakeholderPermission = (stakeholderId: number) => {
    const currentPermissions = settings?.stakeholderUploadPermissions || {};
    const newPermissions = {
      ...currentPermissions,
      [stakeholderId.toString()]: !currentPermissions[stakeholderId.toString()],
    };
    updateSettingsMutation.mutate({ stakeholderUploadPermissions: newPermissions });
  };

  const isSeedRunning = sampleDataMutation.isPending && sampleDataMutation.variables === 'seed';
  const isResetRunning = sampleDataMutation.isPending && sampleDataMutation.variables === 'reset';

  return (
    <div className="p-6">
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.description')}
        icon={SettingsIcon}
        iconColor="text-primary"
      />

      <div className="max-w-4xl mx-auto space-y-6">
          {/* Public CSV Export */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{t('settings.publicCsvExport')}</CardTitle>
                    <CardDescription>
                      {t('settings.publicCsvExportDescription')}
                    </CardDescription>
                  </div>
                </div>
                <Switch
                  checked={settings?.publicCsvExport || false}
                  onCheckedChange={(checked) => {
                    updateSettingsMutation.mutate({ publicCsvExport: checked });
                  }}
                  data-testid="switch-public-csv-export"
                  disabled={updateSettingsMutation.isPending}
                />
              </div>
            </CardHeader>
          </Card>

          {/* File Uploads (Superadmin only) */}
          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Upload className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{t('settings.enableFileUploads')}</CardTitle>
                      <CardDescription>
                        {t('settings.fileUploadsDescription')}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={settings?.fileUploadsEnabled || false}
                    onCheckedChange={(checked) => {
                      updateSettingsMutation.mutate({ fileUploadsEnabled: checked });
                    }}
                    data-testid="switch-file-uploads"
                    disabled={updateSettingsMutation.isPending}
                  />
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Archive Visibility (Superadmin only) */}
          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Archive className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{t('settings.archiveEnabledTitle')}</CardTitle>
                      <CardDescription>
                        {t('settings.archiveEnabledDescription')}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={settings?.archiveEnabled !== false}
                    onCheckedChange={(checked) => {
                      updateSettingsMutation.mutate({ archiveEnabled: checked });
                    }}
                    data-testid="switch-archive-enabled"
                    disabled={updateSettingsMutation.isPending}
                  />
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Scraped Events (Superadmin only) */}
          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <RefreshCw className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{t('settings.showScrapedEvents')}</CardTitle>
                      <CardDescription>
                        {t('settings.scrapedEventsDescription')}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={settings?.scrapedEventsEnabled || false}
                    onCheckedChange={(checked) => {
                      updateSettingsMutation.mutate({ scrapedEventsEnabled: checked });
                      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
                    }}
                    data-testid="switch-scraped-events"
                    disabled={updateSettingsMutation.isPending}
                  />
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Stakeholder Attendee Upload Permissions (Superadmin only) */}
          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Upload className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Stakeholder Attendee Management</CardTitle>
                        <CardDescription>
                          Allow specific stakeholders to upload and download event attendee lists
                        </CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={settings?.allowStakeholderAttendeeUpload || false}
                      onCheckedChange={(checked) => {
                        updateSettingsMutation.mutate({ allowStakeholderAttendeeUpload: checked });
                      }}
                      data-testid="switch-allow-stakeholder-attendee-upload"
                      disabled={updateSettingsMutation.isPending}
                    />
                  </div>

                  {settings?.allowStakeholderAttendeeUpload && (
                    <div className="mt-4 border-t pt-4">
                      <h4 className="text-sm font-medium mb-3">Stakeholder Permissions</h4>
                      <div className="space-y-2">
                        {stakeholders.filter(s => s.active).map((stakeholder) => (
                          <div
                            key={stakeholder.id}
                            className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50"
                          >
                            <span className="text-sm">{stakeholder.name}</span>
                            <Switch
                              checked={
                                settings?.stakeholderUploadPermissions?.[stakeholder.id.toString()] || false
                              }
                              onCheckedChange={() => toggleStakeholderPermission(stakeholder.id)}
                              disabled={updateSettingsMutation.isPending}
                              data-testid={`switch-stakeholder-${stakeholder.id}`}
                            />
                          </div>
                        ))}
                        {stakeholders.filter(s => s.active).length === 0 && (
                          <p className="text-sm text-muted-foreground py-2">
                            No active stakeholders found
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Sample Data Controls (Superadmin only) */}
          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <DatabaseZap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{t('settings.sampleDataTitle')}</CardTitle>
                      <CardDescription>{t('settings.sampleDataDescription')}</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      onClick={() => setPendingSampleAction('seed')}
                      disabled={sampleDataMutation.isPending}
                      data-testid="button-run-sample-data"
                    >
                      {isSeedRunning ? t('settings.sampleDataRunning') : t('settings.seedSampleData')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPendingSampleAction('reset')}
                      disabled={sampleDataMutation.isPending}
                      data-testid="button-reset-sample-data"
                    >
                      {isResetRunning ? t('settings.sampleDataRunning') : t('settings.resetSampleData')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Elasticsearch Admin (Superadmin only) */}
          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Search className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{t('settings.elasticsearchAdmin', 'Elasticsearch Admin')}</CardTitle>
                      <CardDescription>
                        {t('settings.elasticsearchAdminDescription', 'Manage search indices, sync data, and monitor Elasticsearch health')}
                      </CardDescription>
                    </div>
                  </div>
                  <Link href="/admin/elasticsearch">
                    <Button
                      variant="outline"
                      data-testid="button-elasticsearch-admin"
                      className="gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t('common.manage', 'Manage')}
                    </Button>
                  </Link>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Change Password */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{t('settings.changePassword')}</CardTitle>
                    <CardDescription>
                      {t('settings.changePasswordDescription')}
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowChangePassword(true)}
                  data-testid="button-change-password"
                  className="gap-2"
                >
                  <Key className="h-4 w-4" />
                  {t('common.change')}
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Create Admin User (Superadmin only) */}
          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <UserPlus className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{t('settings.createAdminUser')}</CardTitle>
                      <CardDescription>
                        {t('settings.createAdminUserDescription')}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateUser(true)}
                    data-testid="button-create-user"
                    className="gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    {t('common.create')}
                  </Button>
                </div>
              </CardHeader>
            </Card>
          )}
        </div>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={(open) => {
        if (!open) {
          setShowChangePassword(false);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
        }
      }}>
        <DialogContent data-testid="dialog-change-password">
          <DialogHeader>
            <DialogTitle>{t('settings.changePassword')}</DialogTitle>
            <DialogDescription>
              {t('settings.changePasswordDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t('settings.currentPassword')}</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('settings.currentPasswordPlaceholder')}
                data-testid="input-current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('settings.newPassword')}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('settings.newPasswordPlaceholder')}
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">{t('settings.confirmNewPassword')}</Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder={t('settings.confirmPasswordPlaceholder')}
                data-testid="input-confirm-new-password"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowChangePassword(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmNewPassword('');
              }}
              data-testid="button-cancel-change-password"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={changePasswordMutation.isPending}
              data-testid="button-submit-change-password"
            >
              {changePasswordMutation.isPending ? t('settings.changing') : t('settings.changePassword')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Admin User Dialog */}
      <Dialog open={showCreateUser} onOpenChange={(open) => {
        if (!open) {
          setShowCreateUser(false);
          setNewUsername('');
          setNewUserPassword('');
          setNewUserRole('admin');
        }
      }}>
        <DialogContent data-testid="dialog-create-user">
          <DialogHeader>
            <DialogTitle>{t('settings.createAdminUser')}</DialogTitle>
            <DialogDescription>
              {t('settings.createAdminUserDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">{t('settings.username')}</Label>
              <Input
                id="new-username"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder={t('settings.usernamePlaceholder')}
                data-testid="input-new-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-password">{t('settings.password')}</Label>
              <Input
                id="new-user-password"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder={t('settings.passwordPlaceholder')}
                data-testid="input-new-user-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-role">{t('settings.role')}</Label>
              <Select
                value={newUserRole}
                onValueChange={(value) => setNewUserRole(value as 'admin' | 'superadmin')}
              >
                <SelectTrigger id="new-user-role" data-testid="select-new-user-role">
                  <SelectValue placeholder={t('settings.selectRole')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin" data-testid="option-role-admin">{t('settings.adminRole')}</SelectItem>
                  <SelectItem value="superadmin" data-testid="option-role-superadmin">{t('settings.superadminRole')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {newUserRole === 'admin' 
                  ? t('settings.adminRoleDescription') 
                  : t('settings.superadminRoleDescription')}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateUser(false);
                setNewUsername('');
                setNewUserPassword('');
                setNewUserRole('admin');
              }}
              data-testid="button-cancel-create-user"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending}
              data-testid="button-submit-create-user"
            >
              {createUserMutation.isPending ? t('settings.creating') : t('settings.createUser')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingSampleAction !== null} onOpenChange={(open) => !open && setPendingSampleAction(null)}>
        <AlertDialogContent data-testid="dialog-sample-data">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingSampleAction === 'reset'
                ? t('settings.resetSampleDataConfirmTitle')
                : t('settings.seedSampleDataConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSampleAction === 'reset'
                ? t('settings.resetSampleDataConfirmDescription')
                : t('settings.seedSampleDataConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-sample-action">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSampleAction}
              disabled={sampleDataMutation.isPending}
              data-testid="button-confirm-sample-action"
            >
              {pendingSampleAction === 'reset'
                ? t('settings.resetSampleData')
                : t('settings.seedSampleData')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
