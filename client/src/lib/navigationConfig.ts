import {
  Home,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Mail,
  Users,
  Bell,
  UserPlus,
  Settings,
  Archive,
  ListTodo,
  FileText,
  RefreshCw,
  FolderArchive,
  UserCircle,
  Database,
  TrendingUp,
  GitBranch,
  LayoutDashboard,
  Handshake,
  Target,
  LucideIcon,
  MessageSquare,
  BarChart3,
  Sparkles,
  ClipboardList,
} from 'lucide-react';

export type UserRole = 'superadmin' | 'admin' | 'stakeholder' | 'department' | 'department_admin';

export interface NavigationItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  testId: string;
  superAdminOnly?: boolean;
}

export interface NavigationSection {
  id: string;
  titleKey: string;
  icon: LucideIcon;
  defaultExpanded: boolean;
  roles: UserRole[];
  items: NavigationItem[];
}

/**
 * Navigation sections for Admin/Superadmin users
 */
export const adminNavigationSections: NavigationSection[] = [
  {
    id: 'dashboard',
    titleKey: 'navigation.sections.dashboards',
    icon: LayoutDashboard,
    defaultExpanded: true,
    roles: ['superadmin', 'admin'],
    items: [
      {
        href: '/',
        labelKey: 'navigation.dashboard',
        icon: LayoutDashboard,
        testId: 'nav-dashboard',
      },
      {
        href: '/admin/analytics',
        labelKey: 'navigation.analytics',
        icon: BarChart3,
        testId: 'nav-analytics',
      },
      {
        href: '/admin/analytics/events',
        labelKey: 'navigation.eventsAnalytics',
        icon: Calendar,
        testId: 'nav-events-analytics',
      },
      {
        href: '/admin/analytics/partnerships',
        labelKey: 'navigation.partnershipsAnalytics',
        icon: Handshake,
        testId: 'nav-partnerships-analytics',
      },
      {
        href: '/admin/analytics/tasks',
        labelKey: 'navigation.tasksAnalytics',
        icon: CheckSquare,
        testId: 'nav-tasks-analytics',
      },
      {
        href: '/admin/analytics/contacts',
        labelKey: 'navigation.contactsAnalytics',
        icon: Users,
        testId: 'nav-contacts-analytics',
      },
      {
        href: '/admin/engagement',
        labelKey: 'navigation.engagement',
        icon: TrendingUp,
        testId: 'nav-engagement',
      },
    ],
  },
  {
    id: 'events',
    titleKey: 'navigation.sections.events',
    icon: Calendar,
    defaultExpanded: true,
    roles: ['superadmin', 'admin'],
    items: [
      {
        href: '/calendar',
        labelKey: 'navigation.eventsCalendar',
        icon: Calendar,
        testId: 'nav-home',
      },
      {
        href: '/admin/archive',
        labelKey: 'navigation.archive',
        icon: FolderArchive,
        testId: 'nav-archive',
      },
    ],
  },
  {
    id: 'tasks',
    titleKey: 'navigation.sections.tasks',
    icon: CheckCircle2,
    defaultExpanded: true,
    roles: ['superadmin', 'admin'],
    items: [
      {
        href: '/admin/tasks',
        labelKey: 'navigation.tasks',
        icon: CheckCircle2,
        testId: 'nav-tasks',
      },
      {
        href: '/admin/workflows',
        labelKey: 'navigation.workflows',
        icon: GitBranch,
        testId: 'nav-workflows',
      },
    ],
  },
  {
    id: 'partnerships',
    titleKey: 'navigation.sections.partnerships',
    icon: Handshake,
    defaultExpanded: false,
    roles: ['superadmin', 'admin'],
    items: [
      {
        href: '/admin/partnerships',
        labelKey: 'navigation.partnerships',
        icon: Handshake,
        testId: 'nav-partnerships',
      },
      {
        href: '/admin/contacts',
        labelKey: 'navigation.contacts',
        icon: UserCircle,
        testId: 'nav-contacts',
      },
      {
        href: '/admin/leads',
        labelKey: 'navigation.leadManagement',
        icon: Target,
        testId: 'nav-leads',
      },
    ],
  },
  {
    id: 'communication',
    titleKey: 'navigation.sections.communication',
    icon: MessageSquare,
    defaultExpanded: false,
    roles: ['superadmin', 'admin'],
    items: [
      {
        href: '/admin/communications',
        labelKey: 'navigation.communications',
        icon: Mail,
        testId: 'nav-communications',
        superAdminOnly: true,
      },
      {
        href: '/admin/reminders',
        labelKey: 'navigation.reminders',
        icon: Bell,
        testId: 'nav-reminders',
      },
    ],
  },
  {
    id: 'ai',
    titleKey: 'navigation.sections.ai',
    icon: Sparkles,
    defaultExpanded: false,
    roles: ['superadmin', 'admin'],
    items: [
      {
        href: '/admin/ai',
        labelKey: 'navigation.aiChat',
        icon: Sparkles,
        testId: 'nav-ai-chat',
      },
      {
        href: '/admin/ai/intake',
        labelKey: 'navigation.aiIntake',
        icon: ClipboardList,
        testId: 'nav-ai-intake',
      },
    ],
  },
  {
    id: 'organization',
    titleKey: 'navigation.sections.organization',
    icon: Users,
    defaultExpanded: false,
    roles: ['superadmin', 'admin'],
    items: [
      {
        href: '/admin/stakeholders',
        labelKey: 'navigation.stakeholders',
        icon: Users,
        testId: 'nav-stakeholders',
        superAdminOnly: true,
      },
    ],
  },
  {
    id: 'settings',
    titleKey: 'navigation.sections.settings',
    icon: Settings,
    defaultExpanded: false,
    roles: ['superadmin', 'admin'],
    items: [
      {
        href: '/admin/users',
        labelKey: 'navigation.users',
        icon: UserPlus,
        testId: 'nav-users',
        superAdminOnly: true,
      },
      {
        href: '/admin/files-management',
        labelKey: 'navigation.files',
        icon: Archive,
        testId: 'nav-files',
        superAdminOnly: true,
      },
      {
        href: '/admin/scrapers',
        labelKey: 'navigation.scrapers',
        icon: RefreshCw,
        testId: 'nav-scrapers',
        superAdminOnly: true,
      },
      {
        href: '/admin/dropdowns',
        labelKey: 'navigation.dropdowns',
        icon: Database,
        testId: 'nav-dropdowns',
        superAdminOnly: true,
      },
      {
        href: '/admin/settings',
        labelKey: 'navigation.settings',
        icon: Settings,
        testId: 'nav-settings',
        superAdminOnly: true,
      },
    ],
  },
];

/**
 * Additional items for admins with department assignment
 */
export const adminDepartmentItems = {
  myTasks: {
    href: '/stakeholder-dashboard',
    labelKey: 'navigation.myTasks',
    icon: ListTodo,
    testId: 'nav-my-tasks',
  },
  updates: {
    href: '/admin/updates',
    labelKey: 'navigation.updates',
    icon: FileText,
    testId: 'nav-updates',
  },
};

/**
 * Superadmin-only items
 */
export const superAdminOnlyItems = {
  allUpdates: {
    href: '/admin/all-updates',
    labelKey: 'navigation.allUpdates',
    icon: FileText,
    testId: 'nav-all-updates',
    superAdminOnly: true,
  },
};

/**
 * Navigation sections for Stakeholder/Department users
 */
export const stakeholderNavigationSections: NavigationSection[] = [
  {
    id: 'dashboard',
    titleKey: 'navigation.sections.dashboard',
    icon: LayoutDashboard,
    defaultExpanded: true,
    roles: ['stakeholder', 'department', 'department_admin'],
    items: [
      {
        href: '/',
        labelKey: 'navigation.dashboard',
        icon: LayoutDashboard,
        testId: 'nav-dashboard',
      },
    ],
  },
  {
    id: 'events',
    titleKey: 'navigation.sections.events',
    icon: Calendar,
    defaultExpanded: true,
    roles: ['stakeholder', 'department', 'department_admin'],
    items: [
      {
        href: '/calendar',
        labelKey: 'navigation.publicCalendar',
        icon: Home,
        testId: 'nav-home',
      },
    ],
  },
  {
    id: 'tasks',
    titleKey: 'navigation.sections.tasks',
    icon: CheckCircle2,
    defaultExpanded: true,
    roles: ['stakeholder', 'department', 'department_admin'],
    items: [
      {
        href: '/stakeholder-dashboard',
        labelKey: 'navigation.myTasks',
        icon: ListTodo,
        testId: 'nav-my-tasks',
      },
      {
        href: '/admin/workflows',
        labelKey: 'navigation.workflows',
        icon: GitBranch,
        testId: 'nav-workflows',
      },
    ],
  },
  {
    id: 'updates',
    titleKey: 'navigation.sections.updates',
    icon: FileText,
    defaultExpanded: true,
    roles: ['stakeholder', 'department', 'department_admin'],
    items: [
      {
        href: '/admin/updates',
        labelKey: 'navigation.updates',
        icon: FileText,
        testId: 'nav-updates',
      },
    ],
  },
];

/**
 * Storage key for persisting expanded sections
 */
export const SIDEBAR_SECTIONS_STORAGE_KEY = 'eventvue-sidebar-expanded-sections';

/**
 * Get default expanded sections from navigation config
 */
export function getDefaultExpandedSections(sections: NavigationSection[]): string[] {
  return sections
    .filter(section => section.defaultExpanded)
    .map(section => section.id);
}

/**
 * Load expanded sections from localStorage
 */
export function loadExpandedSections(sections: NavigationSection[]): string[] {
  if (typeof window === 'undefined') {
    return getDefaultExpandedSections(sections);
  }
  
  try {
    const saved = localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load sidebar sections from localStorage:', e);
  }
  
  return getDefaultExpandedSections(sections);
}

/**
 * Save expanded sections to localStorage
 */
export function saveExpandedSections(sections: string[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(SIDEBAR_SECTIONS_STORAGE_KEY, JSON.stringify(sections));
  } catch (e) {
    console.warn('Failed to save sidebar sections to localStorage:', e);
  }
}
