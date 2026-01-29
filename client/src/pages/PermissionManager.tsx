import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions, useUserPermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPermissionEditor } from '@/components/permissions/UserPermissionEditor';
import { PermissionAuditLog } from '@/components/permissions/PermissionAuditLog';
import { getRoleName } from '@/lib/roles';
import { Search, Shield, Users as UsersIcon, AlertTriangle, Info, Lock } from 'lucide-react';
import { ListLoadingSkeleton } from '@/components/ui/loading-state';

interface User {
  id: number;
  username: string;
  role: string;
  email?: string;
  createdAt: string;
}

export default function PermissionManager() {
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  // Fetch all users
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Fetch all permissions
  const { data: allPermissions, isLoading: permissionsLoading } = usePermissions();

  // Fetch selected user's permissions
  const { data: userPermissions = [], isLoading: userPermsLoading } = useUserPermissions(
    selectedUserId || undefined
  );

  const selectedUser = users.find(u => u.id === selectedUserId);

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const handleManagePermissions = (userId: number) => {
    setSelectedUserId(userId);
    setShowPermissionDialog(true);
  };

  if (usersLoading || permissionsLoading) {
    return (
      <div className="container mx-auto p-6">
        <PageHeader
          title="Permission Management"
          description="Manage user permissions and access control"
        />
        <ListLoadingSkeleton />
      </div>
    );
  }

  // Check if current user can manage permissions
  const canManagePermissions = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

  if (!canManagePermissions) {
    return (
      <div className="container mx-auto p-6">
        <PageHeader
          title="Permission Management"
          description="Manage user permissions and access control"
        />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to manage user permissions. Only superadmins can access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Permission Management"
        description="Manage granular user permissions beyond role defaults"
      />

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Users inherit default permissions from their role. You can grant additional permissions or explicitly deny permissions here.
        </AlertDescription>
      </Alert>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Users
          </CardTitle>
          <CardDescription>
            Select a user to manage their permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="superadmin">Superadmin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="division_head">Division Head</SelectItem>
                <SelectItem value="events_lead">Events Lead</SelectItem>
                <SelectItem value="department_admin">Department Admin</SelectItem>
                <SelectItem value="department">Department</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User List */}
          <div className="space-y-2">
            {filteredUsers.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No users found matching your search criteria.
                </AlertDescription>
              </Alert>
            ) : (
              filteredUsers.map(user => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.username}</span>
                        {user.id === currentUser?.id && (
                          <Badge variant="outline" className="text-xs">You</Badge>
                        )}
                        {user.role === 'superadmin' && (
                          <Lock className="h-3 w-3 text-amber-500" title="Superadmin - all permissions" />
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {getRoleName(user.role)}
                        </Badge>
                        {user.email && (
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => handleManagePermissions(user.id)}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Manage Permissions
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Permission Management Dialog */}
      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Manage Permissions: {selectedUser?.username}
            </DialogTitle>
          </DialogHeader>

          {selectedUser && allPermissions && (
            <Tabs defaultValue="permissions" className="flex-1 overflow-hidden flex flex-col">
              <TabsList>
                <TabsTrigger value="permissions">Permissions</TabsTrigger>
                <TabsTrigger value="audit">Audit Log</TabsTrigger>
              </TabsList>
              
              <TabsContent value="permissions" className="flex-1 overflow-auto">
                {userPermsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : (
                  <UserPermissionEditor
                    userId={selectedUser.id}
                    userRole={selectedUser.role}
                    userName={selectedUser.username}
                    permissionsByCategory={allPermissions}
                    userPermissions={userPermissions}
                  />
                )}
              </TabsContent>
              
              <TabsContent value="audit" className="flex-1 overflow-auto">
                <PermissionAuditLog
                  userId={selectedUser.id}
                  userName={selectedUser.username}
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
