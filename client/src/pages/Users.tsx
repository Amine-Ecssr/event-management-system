import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from 'wouter';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Key, Trash2, Users as UsersIcon, Shield, ChevronDown, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useTranslation } from 'react-i18next';
import { ListLoadingSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { RoleDescription } from '@/components/RoleDescription';

type User = {
  id: number;
  username: string;
  role: 'admin' | 'superadmin' | 'stakeholder' | 'department' | 'department_admin' | 'events_lead' | 'division_head' | 'employee' | 'viewer';
  createdAt: string;
};

type StakeholderAccount = {
  id: number;
  userId: number;
  stakeholderId: number;
  stakeholderName: string;
  username: string;
  primaryEmail: string;
  lastLoginAt: string | null;
};

type Stakeholder = {
  id: number;
  name: string;
  nameAr?: string | null;
  emails: Array<{ id: number; email: string; isPrimary: boolean }>;
};

const createAdminSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^\S*$/, 'Username cannot contain spaces'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'superadmin', 'events_lead', 'division_head', 'employee', 'viewer']),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const createStakeholderAccountSchema = z.object({
  stakeholderId: z.number({ required_error: 'Please select a stakeholder' }),
  emailId: z.number({ required_error: 'Please select an email' }),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export default function Users() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const isArabic = i18n.language === 'ar' || language === 'ar';

  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [showCreateStakeholder, setShowCreateStakeholder] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<StakeholderAccount | null>(null);
  const [resetType, setResetType] = useState<'admin' | 'stakeholder'>('admin');

  // Redirect if not superadmin
  if (!user || user.role !== 'superadmin') {
    setLocation('/');
    return <div>{t('common.redirecting')}</div>;
  }

  // Fetch admin users (exclude stakeholders - they're shown in the Stakeholder Teams tab)
  const { data: allUsers = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });
  
  // Filter to only show admin and superadmin users in the Admin Users tab
  const users = allUsers.filter(u => u.role === 'admin' || u.role === 'superadmin');

  // Fetch stakeholder accounts
  const { data: stakeholderAccounts = [], isLoading: accountsLoading } = useQuery<StakeholderAccount[]>({
    queryKey: ['/api/stakeholder-accounts'],
  });

  // Fetch all stakeholders (for creating new accounts)
  const { data: allStakeholders = [] } = useQuery<Stakeholder[]>({
    queryKey: ['/api/stakeholders'],
  });

  // Forms
  const createAdminForm = useForm<z.infer<typeof createAdminSchema>>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: {
      username: '',
      password: '',
      role: 'admin',
    },
  });

  const resetPasswordForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
    },
  });

  const createStakeholderForm = useForm<z.infer<typeof createStakeholderAccountSchema>>({
    resolver: zodResolver(createStakeholderAccountSchema),
    defaultValues: {
      stakeholderId: undefined,
      emailId: undefined,
      password: '',
    },
  });

  // Watch selected stakeholder to show available emails
  const selectedStakeholderId = createStakeholderForm.watch('stakeholderId');
  const selectedStakeholder = allStakeholders.find(s => s.id === selectedStakeholderId);

  // Group stakeholder accounts by stakeholder
  const stakeholderGroups = allStakeholders.map(stakeholder => {
    const accounts = stakeholderAccounts.filter(a => a.stakeholderId === stakeholder.id);
    return {
      stakeholder,
      accounts,
      memberCount: accounts.length,
    };
  }).filter(group => group.memberCount > 0); // Only show stakeholders with accounts

  // Create admin user mutation
  const createAdminMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createAdminSchema>) => {
      return await apiRequest('POST', '/api/admin/create-user', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowCreateAdmin(false);
      createAdminForm.reset();
      toast({
        title: t('users.userCreated'),
        description: t('users.userCreatedDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('users.userCreateError'),
        variant: 'destructive',
      });
    },
  });

  // Reset admin password mutation
  const resetAdminPasswordMutation = useMutation({
    mutationFn: async ({ id, newPassword }: { id: number; newPassword: string }) => {
      return await apiRequest('PATCH', `/api/admin/users/${id}/reset-password`, { newPassword });
    },
    onSuccess: () => {
      setShowResetPassword(false);
      resetPasswordForm.reset();
      toast({
        title: t('users.passwordReset'),
        description: t('users.passwordResetDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('users.resetPasswordError'),
        variant: 'destructive',
      });
    },
  });

  // Delete admin user mutation
  const deleteAdminMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowDeleteDialog(false);
      setSelectedUser(null);
      toast({
        title: t('users.userDeleted'),
        description: t('users.userDeletedDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('users.deleteUserError'),
        variant: 'destructive',
      });
    },
  });

  // Create stakeholder account mutation
  const createStakeholderAccountMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createStakeholderAccountSchema>) => {
      return await apiRequest('POST', '/api/stakeholder-accounts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholder-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholders/without-accounts'] });
      setShowCreateStakeholder(false);
      createStakeholderForm.reset();
      toast({
        title: t('users.stakeholderAccountCreated'),
        description: t('users.stakeholderAccountCreatedDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('users.stakeholderAccountCreateError'),
        variant: 'destructive',
      });
    },
  });

  // Reset stakeholder password mutation
  const resetStakeholderPasswordMutation = useMutation({
    mutationFn: async ({ id, newPassword }: { id: number; newPassword: string }) => {
      return await apiRequest('POST', `/api/stakeholder-accounts/${id}/reset-password`, { newPassword });
    },
    onSuccess: () => {
      setShowResetPassword(false);
      resetPasswordForm.reset();
      toast({
        title: t('users.passwordReset'),
        description: t('users.passwordResetDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('users.resetPasswordError'),
        variant: 'destructive',
      });
    },
  });

  // Delete stakeholder account mutation
  const deleteStakeholderAccountMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/stakeholder-accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholder-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholders/without-accounts'] });
      setShowDeleteDialog(false);
      setSelectedAccount(null);
      toast({
        title: t('users.accountDeleted'),
        description: t('users.accountDeletedDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('users.accountDeleteError'),
        variant: 'destructive',
      });
    },
  });

  const handleResetPasswordClick = (type: 'admin' | 'stakeholder', userOrAccount: User | StakeholderAccount) => {
    setResetType(type);
    if (type === 'admin') {
      setSelectedUser(userOrAccount as User);
    } else {
      setSelectedAccount(userOrAccount as StakeholderAccount);
    }
    setShowResetPassword(true);
    resetPasswordForm.reset();
  };

  const handleDeleteClick = (type: 'admin' | 'stakeholder', userOrAccount: User | StakeholderAccount) => {
    if (type === 'admin') {
      setSelectedUser(userOrAccount as User);
      setResetType('admin');
    } else {
      setSelectedAccount(userOrAccount as StakeholderAccount);
      setResetType('stakeholder');
    }
    setShowDeleteDialog(true);
  };

  const handleResetPasswordSubmit = (values: z.infer<typeof resetPasswordSchema>) => {
    if (resetType === 'admin' && selectedUser) {
      resetAdminPasswordMutation.mutate({ id: selectedUser.id, newPassword: values.newPassword });
    } else if (resetType === 'stakeholder' && selectedAccount) {
      resetStakeholderPasswordMutation.mutate({ id: selectedAccount.id, newPassword: values.newPassword });
    }
  };

  const handleDelete = () => {
    if (resetType === 'admin' && selectedUser) {
      deleteAdminMutation.mutate(selectedUser.id);
    } else if (resetType === 'stakeholder' && selectedAccount) {
      deleteStakeholderAccountMutation.mutate(selectedAccount.id);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title={t('users.title')}
        subtitle={t('users.subtitle')}
        icon={UserPlus}
        iconColor="text-primary"
      />

      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="admin-users" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="admin-users" data-testid="tab-admin-users">
              <Shield className="w-4 h-4 mr-2" />
              {t('users.adminUsers')}
            </TabsTrigger>
            <TabsTrigger value="stakeholder-accounts" data-testid="tab-stakeholder-accounts">
              <UsersIcon className="w-4 h-4 mr-2" />
              {t('users.stakeholderAccounts')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="admin-users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>{t('users.adminUsers')}</CardTitle>
                  <CardDescription>{t('users.createAdminUserDesc')}</CardDescription>
                </div>
                <Button
                  onClick={() => setShowCreateAdmin(true)}
                  data-testid="button-create-admin"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('users.createAdminUser')}
                </Button>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <ListLoadingSkeleton count={3} />
                ) : users.length === 0 ? (
                  <EmptyState
                    icon={<Shield className="h-10 w-10" />}
                    title={t('users.noAdminUsers')}
                    className="py-8"
                  />
                ) : (
                  <>
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                      {users.map((adminUser) => (
                        <Card key={adminUser.id}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{adminUser.username}</p>
                                <p className="text-sm text-muted-foreground">
                                  {adminUser.createdAt ? format(new Date(adminUser.createdAt), 'MMM dd, yyyy') : 'N/A'}
                                </p>
                              </div>
                              <Badge variant={adminUser.role === 'superadmin' ? 'default' : 'secondary'}>
                                {adminUser.role === 'superadmin' ? t('users.superadmin') : t('users.admin')}
                              </Badge>
                            </div>
                            <div className="flex gap-2 pt-2 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleResetPasswordClick('admin', adminUser)}
                                data-testid={`button-reset-password-${adminUser.id}`}
                              >
                                <Key className="w-3 h-3 mr-1" />
                                {t('users.resetPassword')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleDeleteClick('admin', adminUser)}
                                disabled={adminUser.id === user.id}
                                data-testid={`button-delete-user-${adminUser.id}`}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                {t('common.delete')}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {/* Desktop Table View */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('users.username')}</TableHead>
                            <TableHead>{t('users.role')}</TableHead>
                            <TableHead>{t('users.created')}</TableHead>
                            <TableHead className="text-right">{t('common.actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((adminUser) => (
                            <TableRow key={adminUser.id}>
                              <TableCell className="font-medium">{adminUser.username}</TableCell>
                              <TableCell>
                                <Badge variant={adminUser.role === 'superadmin' ? 'default' : 'secondary'}>
                                  {adminUser.role === 'superadmin' ? t('users.superadmin') : t('users.admin')}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {adminUser.createdAt ? format(new Date(adminUser.createdAt), 'MMM dd, yyyy') : 'N/A'}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleResetPasswordClick('admin', adminUser)}
                                    data-testid={`button-reset-password-${adminUser.id}`}
                                  >
                                    <Key className="w-3 h-3 mr-1" />
                                    {t('users.resetPassword')}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteClick('admin', adminUser)}
                                    disabled={adminUser.id === user.id}
                                    data-testid={`button-delete-user-${adminUser.id}`}
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    {t('common.delete')}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stakeholder-accounts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>{t('users.stakeholderTeams')}</CardTitle>
                  <CardDescription>{t('users.stakeholderTeamsDesc')}</CardDescription>
                </div>
                <Button
                  onClick={() => setShowCreateStakeholder(true)}
                  disabled={allStakeholders.length === 0}
                  data-testid="button-create-stakeholder-account"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('users.addMemberAccount')}
                </Button>
              </CardHeader>
              <CardContent>
                {accountsLoading ? (
                  <ListLoadingSkeleton count={3} />
                ) : stakeholderGroups.length === 0 ? (
                  <EmptyState
                    icon={<UsersIcon className="h-10 w-10" />}
                    title={t('users.noStakeholderAccounts')}
                    className="py-8"
                  />
                ) : (
                  <div className="space-y-3">
                    {stakeholderGroups.map((group) => (
                      <Collapsible key={group.stakeholder.id} className="border rounded-lg">
                        <CollapsibleTrigger className="w-full" data-testid={`collapsible-stakeholder-${group.stakeholder.id}`}>
                          <div className="flex items-center justify-between p-4 hover-elevate">
                            <div className="flex items-center gap-3">
                              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200" />
                              <div className="text-left">
                                <div className="font-semibold">
                                  {isArabic && group.stakeholder.nameAr ? group.stakeholder.nameAr : group.stakeholder.name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {group.memberCount} {group.memberCount === 1 ? t('users.member') : t('users.members')}
                                </div>
                              </div>
                            </div>
                            <Badge variant="secondary" data-testid={`badge-member-count-${group.stakeholder.id}`}>
                              {group.memberCount} {group.memberCount === 1 ? t('users.account') : t('users.accounts')}
                            </Badge>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t">
                            {/* Mobile Card View */}
                            <div className="md:hidden p-4 space-y-4">
                              {group.accounts.map((account) => (
                                <Card key={account.id}>
                                  <CardContent className="p-4 space-y-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium truncate">{account.username}</p>
                                      <p className="text-sm text-muted-foreground">{account.primaryEmail}</p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {t('users.lastLogin')}: {account.lastLoginAt
                                          ? format(new Date(account.lastLoginAt), 'MMM dd, yyyy HH:mm')
                                          : t('users.never')}
                                      </p>
                                    </div>
                                    <div className="flex gap-2 pt-2 border-t">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => handleResetPasswordClick('stakeholder', account)}
                                        data-testid={`button-reset-password-${account.id}`}
                                      >
                                        <Key className="w-3 h-3 mr-1" />
                                        {t('users.resetPassword')}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => handleDeleteClick('stakeholder', account)}
                                        data-testid={`button-delete-user-${account.id}`}
                                      >
                                        <Trash2 className="w-3 h-3 mr-1" />
                                        {t('common.delete')}
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                            {/* Desktop Table View */}
                            <div className="hidden md:block">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>{t('users.usernameEmail')}</TableHead>
                                    <TableHead>{t('users.lastLogin')}</TableHead>
                                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.accounts.map((account) => (
                                    <TableRow key={account.id}>
                                      <TableCell>
                                        <div>
                                          <div className="font-medium">{account.username}</div>
                                          <div className="text-sm text-muted-foreground">{account.primaryEmail}</div>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        {account.lastLoginAt
                                          ? format(new Date(account.lastLoginAt), 'MMM dd, yyyy HH:mm')
                                          : t('users.never')}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleResetPasswordClick('stakeholder', account)}
                                            data-testid={`button-reset-password-${account.id}`}
                                          >
                                            <Key className="w-3 h-3 mr-1" />
                                            {t('users.resetPassword')}
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDeleteClick('stakeholder', account)}
                                            data-testid={`button-delete-user-${account.id}`}
                                          >
                                            <Trash2 className="w-3 h-3 mr-1" />
                                            {t('common.delete')}
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Admin User Dialog */}
      <Dialog open={showCreateAdmin} onOpenChange={setShowCreateAdmin}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.createAdminUser')}</DialogTitle>
            <DialogDescription>
              {t('users.createAdminUserDesc')}
            </DialogDescription>
          </DialogHeader>
          <Form {...createAdminForm}>
            <form
              onSubmit={createAdminForm.handleSubmit((data) => createAdminMutation.mutate(data))}
              className="space-y-4"
              data-testid="form-create-admin"
            >
              <FormField
                control={createAdminForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.username')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('users.enterUsername')} data-testid="input-username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createAdminForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.password')}</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder={t('users.enterPassword')} data-testid="input-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createAdminForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.role')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-role">
                          <SelectValue placeholder={t('users.selectRole')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="viewer">{t('users.viewer')}</SelectItem>
                        <SelectItem value="employee">{t('users.employee')}</SelectItem>
                        <SelectItem value="events_lead">{t('users.eventsLead')}</SelectItem>
                        <SelectItem value="division_head">{t('users.divisionHead')}</SelectItem>
                        <SelectItem value="admin">{t('users.admin')}</SelectItem>
                        {user?.role === 'superadmin' && (
                          <SelectItem value="superadmin">{t('users.superadmin')}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    {field.value && (
                      <RoleDescription role={field.value} className="mt-2" />
                    )}
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateAdmin(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={createAdminMutation.isPending}>
                  {createAdminMutation.isPending ? t('users.creating') : t('users.createUser')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create Stakeholder Account Dialog */}
      <Dialog open={showCreateStakeholder} onOpenChange={setShowCreateStakeholder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.createStakeholderAccount')}</DialogTitle>
            <DialogDescription>
              {t('users.createStakeholderAccountDesc')}
            </DialogDescription>
          </DialogHeader>
          {allStakeholders.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              {t('users.noStakeholdersAvailable')}
            </div>
          ) : (
            <Form {...createStakeholderForm}>
              <form
                onSubmit={createStakeholderForm.handleSubmit((data) => createStakeholderAccountMutation.mutate(data))}
                className="space-y-4"
                data-testid="form-create-stakeholder-account"
              >
                <FormField
                  control={createStakeholderForm.control}
                  name="stakeholderId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('users.stakeholderName')}</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                        <FormControl>
                          <SelectTrigger data-testid="select-stakeholder">
                            <SelectValue placeholder={t('users.selectStakeholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {allStakeholders.map((stakeholder: Stakeholder) => (
                            <SelectItem key={stakeholder.id} value={stakeholder.id.toString()}>
                              {isArabic && stakeholder.nameAr ? stakeholder.nameAr : stakeholder.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createStakeholderForm.control}
                  name="emailId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('users.email')}</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        disabled={!selectedStakeholder}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-email">
                            <SelectValue placeholder={selectedStakeholder ? t('users.selectEmailForLogin') : t('users.selectStakeholderFirst')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {selectedStakeholder?.emails.map((email) => (
                            <SelectItem key={email.id} value={email.id.toString()}>
                              {email.email} {email.isPrimary && `(${t('users.primary')})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createStakeholderForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('users.password')}</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder={t('users.enterPassword')} data-testid="input-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateStakeholder(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={createStakeholderAccountMutation.isPending}>
                    {createStakeholderAccountMutation.isPending ? t('users.creating') : t('users.createAccount')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPassword} onOpenChange={setShowResetPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.resetPasswordTitle')}</DialogTitle>
            <DialogDescription>
              {t('users.resetPasswordFor')}{' '}
              {resetType === 'admin' ? selectedUser?.username : selectedAccount?.stakeholderName}
            </DialogDescription>
          </DialogHeader>
          <Form {...resetPasswordForm}>
            <form
              onSubmit={resetPasswordForm.handleSubmit(handleResetPasswordSubmit)}
              className="space-y-4"
            >
              <FormField
                control={resetPasswordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.newPassword')}</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder={t('users.enterNewPassword')} data-testid="input-new-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowResetPassword(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    resetType === 'admin'
                      ? resetAdminPasswordMutation.isPending
                      : resetStakeholderPasswordMutation.isPending
                  }
                >
                  {resetType === 'admin'
                    ? resetAdminPasswordMutation.isPending
                      ? t('users.resetting')
                      : t('users.resetPassword')
                    : resetStakeholderPasswordMutation.isPending
                    ? t('users.resetting')
                    : t('users.resetPassword')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('users.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {resetType === 'admin'
                ? `${t('users.deleteAdminConfirm')} "${selectedUser?.username}". ${t('users.cannotUndo')}`
                : `${t('users.deleteStakeholderConfirm')} "${selectedAccount?.stakeholderName}". ${t('users.cannotUndo')}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetType === 'admin'
                ? deleteAdminMutation.isPending
                  ? t('common.deleting')
                  : t('users.deleteUser')
                : deleteStakeholderAccountMutation.isPending
                ? t('common.deleting')
                : t('users.deleteAccount')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
