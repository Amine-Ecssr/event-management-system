import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LogOut, 
  FolderArchive,
  LayoutDashboard,
  ListTodo,
  FileText,
  Search,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SidebarSection } from '@/components/SidebarSection';
import { AIAssistantButton } from '@/components/AIAssistantButton';
import {
  adminNavigationSections,
  stakeholderNavigationSections,
  adminDepartmentItems,
  superAdminOnlyItems,
  loadExpandedSections,
  saveExpandedSections,
  type NavigationSection,
} from '@/lib/navigationConfig';
import ecssrGlobeLogo from '@assets/ecssr-logo-globe.png';

interface UnifiedLayoutProps {
  children: React.ReactNode;
}

export function UnifiedLayout({ children }: UnifiedLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { t } = useTranslation();
  const { data: settings } = useQuery<{ archiveEnabled?: boolean }>({
    queryKey: ['/api/settings'],
  });

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation('/');
      },
    });
  };

  const isSuperAdmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isStakeholder = user?.role === 'stakeholder' || user?.role === 'department' || user?.role === 'department_admin';
  const hasDepartment = user?.departmentId != null;

  // Get the appropriate navigation sections based on user role
  const baseNavigationSections = useMemo(() => {
    if (isStakeholder) {
      return stakeholderNavigationSections;
    }
    if (isAdmin) {
      // Deep clone the admin sections while preserving icon references
      const sections: NavigationSection[] = adminNavigationSections.map(section => ({
        ...section,
        items: [...section.items.map(item => ({ ...item }))],
      }));
      
      // Add "My Tasks" to the tasks section for admins who are in a department
      if (hasDepartment) {
        const tasksSection = sections.find(s => s.id === 'tasks');
        if (tasksSection) {
          // Insert at beginning of tasks section
          tasksSection.items.unshift({
            ...adminDepartmentItems.myTasks,
          });
        }
        
        // Add Updates to communication section
        const communicationSection = sections.find(s => s.id === 'communication');
        if (communicationSection) {
          communicationSection.items.push({
            ...adminDepartmentItems.updates,
          });
        }
      }

      // Add All Updates to communication section for superadmins
      if (isSuperAdmin) {
        const communicationSection = sections.find(s => s.id === 'communication');
        if (communicationSection) {
          communicationSection.items.push({
            ...superAdminOnlyItems.allUpdates,
          });
        }
      }
      
      return sections;
    }
    return [];
  }, [isStakeholder, isAdmin, hasDepartment, isSuperAdmin]);

  // State for expanded sections
  const [expandedSections, setExpandedSections] = useState<string[]>(() => 
    loadExpandedSections(baseNavigationSections)
  );

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const updated = prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId];
      saveExpandedSections(updated);
      return updated;
    });
  }, []);

  const handleNavigate = useCallback((href: string) => {
    setLocation(href);
  }, [setLocation]);

  const style = {
    '--sidebar-width': '18rem',
  };

  const portalTitle = isStakeholder ? t('navigation.stakeholderPortal') : t('navigation.adminPortal');

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-3">
              <img src={ecssrGlobeLogo} alt="ECSSR Logo" className="h-12 w-12" data-testid="img-logo" />
              <div>
                <h2 className="text-lg font-semibold text-sidebar-foreground" data-testid="text-app-name">
                  {t('navigation.eventManager')}
                </h2>
                <p className="text-xs text-sidebar-foreground/70" data-testid="text-app-subtitle">
                  {portalTitle}
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent className="space-y-1">
                {baseNavigationSections.map((section) => (
                  <SidebarSection
                    key={section.id}
                    section={section}
                    isExpanded={expandedSections.includes(section.id)}
                    onToggle={() => toggleSection(section.id)}
                    currentPath={location}
                    onNavigate={handleNavigate}
                    isSuperAdmin={isSuperAdmin}
                  />
                ))}
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4">
            <div className="space-y-2">
              <div className="text-sm text-sidebar-foreground/70" data-testid="text-user-info">
                <p className="font-medium truncate">{user?.username}</p>
                <p className="text-xs capitalize">{t(`auth.${user?.role}`)}</p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="me-2 h-4 w-4" />
                {t('navigation.logout')}
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            {/* Search Button - navigates to search page */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/admin/search')}
              data-testid="button-header-search"
              title={t('search.title')}
            >
              <Search className="h-4 w-4 me-2" />
              <span className="hidden md:inline">{t('search.title')}</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
              {(isAdmin || isStakeholder) && location !== '/' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation('/')}
                  data-testid="button-header-home"
                  title={t('navigation.dashboard')}
                >
                  <LayoutDashboard className="h-4 w-4 me-2" />
                  <span className="hidden sm:inline">{t('navigation.dashboard')}</span>
                </Button>
              )}
              {settings?.archiveEnabled !== false && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation('/archive')}
                  data-testid="button-header-archive"
                  title={t('navigation.archive')}
                >
                  <FolderArchive className="h-4 w-4 me-2" />
                  <span className="hidden sm:inline">{t('navigation.archive')}</span>
                </Button>
              )}
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            {children}
          </main>

          {/* Floating AI Assistant - only for admin/superadmin */}
          {isAdmin && <AIAssistantButton />}
        </div>
      </div>
    </SidebarProvider>
  );
}
