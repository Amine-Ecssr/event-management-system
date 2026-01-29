import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { RoleDescription } from '@/components/RoleDescription';
import { Badge } from '@/components/ui/badge';
import { Shield, Eye, Users, Briefcase, TrendingUp, UserCheck, Crown, Lock } from 'lucide-react';
import { getAvailableRoles, UserRole } from '@/lib/roles';

const roleIcons: Record<UserRole, any> = {
  viewer: Eye,
  employee: Users,
  events_lead: Briefcase,
  division_head: TrendingUp,
  department: UserCheck,
  department_admin: UserCheck,
  admin: Shield,
  superadmin: Crown,
};

const roleColors: Record<UserRole, string> = {
  viewer: 'bg-slate-100 text-slate-700',
  employee: 'bg-blue-100 text-blue-700',
  events_lead: 'bg-green-100 text-green-700',
  division_head: 'bg-purple-100 text-purple-700',
  department: 'bg-orange-100 text-orange-700',
  department_admin: 'bg-orange-100 text-orange-700',
  admin: 'bg-red-100 text-red-700',
  superadmin: 'bg-amber-100 text-amber-700',
};

export default function RolesInfo() {
  const { user } = useAuth();
  const roles = getAvailableRoles(user?.role);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="User Roles & Permissions"
        description="Overview of all user roles and their access levels in the system"
      />

      {/* Current User Role */}
      {user && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Your Current Role
                </CardTitle>
                <CardDescription>You are currently logged in as</CardDescription>
              </div>
              <Badge className={`${roleColors[user.role as UserRole]} text-lg px-4 py-2`}>
                {user.role}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <RoleDescription role={user.role} />
          </CardContent>
        </Card>
      )}

      {/* All Available Roles */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => {
          const Icon = roleIcons[role.value];
          return (
            <Card key={role.value} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${roleColors[role.value]}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{role.label}</CardTitle>
                      <CardDescription className="text-sm">
                        Level {getRoleLevel(role.value)}
                      </CardDescription>
                    </div>
                  </div>
                  {user?.role === role.value && (
                    <Badge variant="secondary">Current</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <RoleDescription role={role.value} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Role Hierarchy */}
      <Card>
        <CardHeader>
          <CardTitle>Role Hierarchy</CardTitle>
          <CardDescription>
            Higher-level roles inherit permissions from lower levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge className="bg-amber-100 text-amber-700 w-32">Level 6</Badge>
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4" />
                <span className="font-medium">Superadmin</span>
                <span className="text-muted-foreground text-sm">- Full system control</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge className="bg-red-100 text-red-700 w-32">Level 5</Badge>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="font-medium">Admin</span>
                <span className="text-muted-foreground text-sm">- System management</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge className="bg-purple-100 text-purple-700 w-32">Level 4</Badge>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="font-medium">Division Head</span>
                <span className="text-muted-foreground text-sm">- Division oversight + analytics</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge className="bg-green-100 text-green-700 w-32">Level 3</Badge>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                <span className="font-medium">Events Lead</span>
                <span className="text-muted-foreground text-sm">- Event management</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge className="bg-orange-100 text-orange-700 w-32">Level 2</Badge>
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                <span className="font-medium">Department</span>
                <span className="text-muted-foreground text-sm">- Department access</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge className="bg-blue-100 text-blue-700 w-32">Level 1</Badge>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="font-medium">Employee</span>
                <span className="text-muted-foreground text-sm">- Task execution</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge className="bg-slate-100 text-slate-700 w-32">Level 0</Badge>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span className="font-medium">Viewer</span>
                <span className="text-muted-foreground text-sm">- Read-only access</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to get role level
function getRoleLevel(role: UserRole): number {
  const levels: Record<UserRole, number> = {
    viewer: 0,
    employee: 1,
    department: 2,
    events_lead: 3,
    division_head: 4,
    department_admin: 4,
    admin: 5,
    superadmin: 6,
  };
  return levels[role];
}
