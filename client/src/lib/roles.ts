export type UserRole = 
  | 'superadmin' 
  | 'admin' 
  | 'department' 
  | 'department_admin' 
  | 'events_lead' 
  | 'division_head' 
  | 'employee' 
  | 'viewer';

// Role hierarchy levels (higher number = more permissions)
const ROLE_LEVELS: Record<UserRole, number> = {
  viewer: 0,
  employee: 1,
  department: 2,
  events_lead: 3,
  division_head: 4,
  department_admin: 4,
  admin: 5,
  superadmin: 6,
};

/**
 * Check if user has at least the required role level
 * @param userRole - The user's current role
 * @param requiredRole - The minimum required role
 * @returns true if user has sufficient permissions
 */
export function hasRoleLevel(userRole: string | undefined, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  const userLevel = ROLE_LEVELS[userRole as UserRole] ?? 0;
  const requiredLevel = ROLE_LEVELS[requiredRole];
  return userLevel >= requiredLevel;
}

// Specific permission checks

/**
 * Can create new events
 */
export function canCreateEvents(role?: string): boolean {
  return hasRoleLevel(role, 'events_lead');
}

/**
 * Can edit existing events
 */
export function canEditEvents(role?: string): boolean {
  return hasRoleLevel(role, 'events_lead');
}

/**
 * Can delete events (admin+ only)
 */
export function canDeleteEvents(role?: string): boolean {
  return hasRoleLevel(role, 'admin');
}

/**
 * Can manage partnerships (division_head+)
 */
export function canManagePartnerships(role?: string): boolean {
  return hasRoleLevel(role, 'division_head');
}

/**
 * Can manage contacts and speakers
 */
export function canManageContacts(role?: string): boolean {
  return hasRoleLevel(role, 'events_lead');
}

/**
 * Can update tasks (employee+)
 */
export function canUpdateTasks(role?: string): boolean {
  return hasRoleLevel(role, 'employee');
}

/**
 * Can create new tasks
 */
export function canCreateTasks(role?: string): boolean {
  return hasRoleLevel(role, 'events_lead');
}

/**
 * Can view analytics dashboards
 */
export function canViewAnalytics(role?: string): boolean {
  return hasRoleLevel(role, 'division_head');
}

/**
 * Can manage workflows
 */
export function canManageWorkflows(role?: string): boolean {
  return hasRoleLevel(role, 'admin');
}

/**
 * Is this user a viewer (read-only)?
 */
export function isReadOnly(role?: string): boolean {
  return role === 'viewer';
}

/**
 * Can create new users
 */
export function canCreateUsers(role?: string): boolean {
  return role === 'superadmin';
}

/**
 * Can modify system settings
 */
export function canModifySettings(role?: string): boolean {
  return hasRoleLevel(role, 'admin');
}

/**
 * Can export data
 */
export function canExportData(role?: string): boolean {
  return hasRoleLevel(role, 'division_head');
}

/**
 * Can manage leads
 */
export function canManageLeads(role?: string): boolean {
  return hasRoleLevel(role, 'events_lead');
}

/**
 * Can send invitations
 */
export function canSendInvitations(role?: string): boolean {
  return hasRoleLevel(role, 'events_lead');
}

/**
 * Can manage event media/photos
 */
export function canManageEventMedia(role?: string): boolean {
  return hasRoleLevel(role, 'events_lead');
}

/**
 * Can access Elasticsearch admin features
 */
export function canAccessElasticsearchAdmin(role?: string): boolean {
  return hasRoleLevel(role, 'admin');
}

/**
 * Is this user an admin-level role or higher?
 */
export function isAdmin(role?: string): boolean {
  return hasRoleLevel(role, 'admin');
}

/**
 * Is this user a superadmin?
 */
export function isSuperAdmin(role?: string): boolean {
  return role === 'superadmin';
}

/**
 * Get user-friendly role name
 */
export function getRoleName(role?: string): string {
  const roleNames: Record<UserRole, string> = {
    superadmin: 'Super Administrator',
    admin: 'Administrator',
    division_head: 'Division Head',
    events_lead: 'Events Lead',
    department_admin: 'Department Admin',
    department: 'Department User',
    employee: 'Employee',
    viewer: 'Viewer',
  };
  
  return roleNames[role as UserRole] || 'Unknown';
}

/**
 * Get role description
 */
export function getRoleDescription(role?: string): string {
  const descriptions: Record<UserRole, string> = {
    superadmin: 'Full system access including user management and system settings',
    admin: 'Can manage events, tasks, partnerships, and create admin users',
    division_head: 'Oversees division with access to analytics, partnerships, and all events',
    events_lead: 'Manages events, assigns tasks, and coordinates event-related activities',
    department_admin: 'Manages department users and assigned events',
    department: 'View-only access to assigned department events',
    employee: 'Can update assigned tasks and view related events',
    viewer: 'Read-only access across the system - cannot create or edit anything',
  };
  
  return descriptions[role as UserRole] || 'Unknown role';
}

/**
 * Get all available roles (optionally filter based on user's role)
 */
export function getAvailableRoles(currentUserRole?: string): Array<{ value: UserRole; label: string; description: string }> {
  const allRoles: Array<{ value: UserRole; label: string; description: string }> = [
    { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
    { value: 'employee', label: 'Employee', description: 'Can update assigned tasks' },
    { value: 'events_lead', label: 'Events Lead', description: 'Manages events and tasks' },
    { value: 'division_head', label: 'Division Head', description: 'Oversees division with analytics' },
    { value: 'department', label: 'Department User', description: 'View department events' },
    { value: 'department_admin', label: 'Department Admin', description: 'Manages department' },
    { value: 'admin', label: 'Administrator', description: 'Full system management' },
    { value: 'superadmin', label: 'Super Administrator', description: 'Ultimate system access' },
  ];
  
  // Only superadmin can create superadmin users
  if (currentUserRole !== 'superadmin') {
    return allRoles.filter(r => r.value !== 'superadmin');
  }
  
  return allRoles;
}
