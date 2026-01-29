import type { Permission } from '@/hooks/use-permissions';

/**
 * Get display name for permission category
 */
export function getCategoryDisplayName(category: string): string {
  const categoryNames: Record<string, string> = {
    events: 'Events',
    tasks: 'Tasks',
    partnerships: 'Partnerships',
    contacts: 'Contacts',
    leads: 'Leads',
    analytics: 'Analytics',
    users: 'Users',
    settings: 'Settings',
    departments: 'Departments',
    workflows: 'Workflows',
    reminders: 'Reminders',
    updates: 'Updates',
    archive: 'Archive',
    system: 'System',
  };
  
  return categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Get icon for permission category
 */
export function getCategoryIcon(category: string): string {
  const categoryIcons: Record<string, string> = {
    events: '📅',
    tasks: '✓',
    partnerships: '🤝',
    contacts: '👤',
    leads: '🎯',
    analytics: '📊',
    users: '👥',
    settings: '⚙️',
    departments: '🏢',
    workflows: '🔄',
    reminders: '🔔',
    updates: '📢',
    archive: '📦',
    system: '🖥️',
  };
  
  return categoryIcons[category] || '📋';
}

/**
 * Get color for permission category
 */
export function getCategoryColor(category: string): string {
  const categoryColors: Record<string, string> = {
    events: 'bg-blue-100 text-blue-700 border-blue-200',
    tasks: 'bg-green-100 text-green-700 border-green-200',
    partnerships: 'bg-purple-100 text-purple-700 border-purple-200',
    contacts: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    leads: 'bg-orange-100 text-orange-700 border-orange-200',
    analytics: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    users: 'bg-red-100 text-red-700 border-red-200',
    settings: 'bg-gray-100 text-gray-700 border-gray-200',
    departments: 'bg-teal-100 text-teal-700 border-teal-200',
    workflows: 'bg-pink-100 text-pink-700 border-pink-200',
    reminders: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    updates: 'bg-lime-100 text-lime-700 border-lime-200',
    archive: 'bg-amber-100 text-amber-700 border-amber-200',
    system: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  
  return categoryColors[category] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/**
 * Format permission action as display text
 */
export function formatAction(action: string): string {
  const actionMap: Record<string, string> = {
    create: 'Create',
    read: 'View',
    update: 'Edit',
    delete: 'Delete',
    import: 'Import',
    export: 'Export',
    assign: 'Assign',
    comment: 'Comment',
    manage: 'Manage',
    trigger: 'Trigger',
    send: 'Send',
    view: 'View',
    manage_media: 'Manage Media',
    manage_permissions: 'Manage Permissions',
    reset_password: 'Reset Password',
    email: 'Email Config',
    whatsapp: 'WhatsApp Config',
    executive: 'Executive View',
  };
  
  return actionMap[action] || action.split('_').map(w => 
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');
}

/**
 * Get permission display name
 */
export function getPermissionDisplayName(permission: Permission): string {
  return `${formatAction(permission.action)} ${getCategoryDisplayName(permission.resource)}`;
}

/**
 * Sort permissions by category order
 */
export function sortCategoriesByImportance(categories: string[]): string[] {
  const order = [
    'events',
    'tasks',
    'partnerships',
    'contacts',
    'leads',
    'analytics',
    'users',
    'departments',
    'workflows',
    'reminders',
    'updates',
    'settings',
    'archive',
    'system',
  ];
  
  return categories.sort((a, b) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    
    return indexA - indexB;
  });
}

/**
 * Check if permission is expired
 */
export function isPermissionExpired(permission: Permission): boolean {
  if (!permission.expiresAt) return false;
  return new Date(permission.expiresAt) < new Date();
}

/**
 * Get expiration status text
 */
export function getExpirationText(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  
  const expiryDate = new Date(expiresAt);
  const now = new Date();
  
  if (expiryDate < now) {
    return 'Expired';
  }
  
  const daysUntilExpiry = Math.ceil(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysUntilExpiry === 0) {
    return 'Expires today';
  } else if (daysUntilExpiry === 1) {
    return 'Expires tomorrow';
  } else if (daysUntilExpiry <= 7) {
    return `Expires in ${daysUntilExpiry} days`;
  } else {
    return `Expires ${expiryDate.toLocaleDateString()}`;
  }
}

/**
 * Group permissions by whether they are granted or not
 */
export function groupPermissionsByStatus(permissions: Permission[]) {
  const granted: Permission[] = [];
  const denied: Permission[] = [];
  const inherited: Permission[] = [];
  
  permissions.forEach(perm => {
    if (perm.source === 'user') {
      if (perm.granted) {
        granted.push(perm);
      } else {
        denied.push(perm);
      }
    } else if (perm.granted) {
      inherited.push(perm);
    }
  });
  
  return { granted, denied, inherited };
}

/**
 * Filter permissions by search term
 */
export function filterPermissions(
  permissions: Permission[],
  searchTerm: string
): Permission[] {
  if (!searchTerm.trim()) return permissions;
  
  const term = searchTerm.toLowerCase();
  
  return permissions.filter(perm =>
    perm.name.toLowerCase().includes(term) ||
    perm.description.toLowerCase().includes(term) ||
    perm.resource.toLowerCase().includes(term) ||
    perm.action.toLowerCase().includes(term) ||
    getCategoryDisplayName(perm.category).toLowerCase().includes(term)
  );
}

/**
 * Get permission badge variant based on source and status
 */
export function getPermissionBadgeVariant(permission: Permission): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!permission.granted) return 'destructive';
  if (permission.source === 'user') return 'default';
  return 'secondary';
}

/**
 * Get permission source label
 */
export function getPermissionSourceLabel(permission: Permission): string {
  if (permission.source === 'user') {
    return permission.granted ? 'Custom Grant' : 'Custom Deny';
  }
  return 'From Role';
}
