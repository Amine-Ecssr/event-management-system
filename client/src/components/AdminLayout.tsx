import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';
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
import { Home, Calendar, CheckCircle2, Mail, Users, Bell, UserPlus, Settings, LogOut, Archive } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import ecssrGlobeLogo from '@assets/ecssr-logo-globe.png';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { t } = useTranslation();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation('/login');
      },
    });
  };

  const isSuperAdmin = user?.role === 'superadmin';

  const navigationItems = [
    {
      titleKey: 'navigation.publicCalendar',
      icon: Home,
      url: '/',
      testId: 'link-home',
    },
    {
      titleKey: 'navigation.eventsCalendar',
      icon: Calendar,
      url: '/admin',
      testId: 'nav-events',
    },
    {
      titleKey: 'navigation.tasks',
      icon: CheckCircle2,
      url: '/admin/tasks',
      testId: 'nav-tasks',
    },
    {
      titleKey: 'navigation.communications',
      icon: Mail,
      url: '/admin/communications',
      testId: 'nav-communications',
      superAdminOnly: true,
    },
    {
      titleKey: 'navigation.stakeholders',
      icon: Users,
      url: '/admin/stakeholders',
      testId: 'nav-stakeholders',
    },
    {
      titleKey: 'navigation.reminders',
      icon: Bell,
      url: '/admin/reminders',
      testId: 'nav-reminders',
    },
    {
      titleKey: 'navigation.users',
      icon: UserPlus,
      url: '/admin/users',
      testId: 'nav-users',
      superAdminOnly: true,
    },
    {
      titleKey: 'navigation.files',
      icon: Archive,
      url: '/admin/files-management',
      testId: 'nav-files',
      superAdminOnly: true,
    },
    {
      titleKey: 'navigation.settings',
      icon: Settings,
      url: '/admin/settings',
      testId: 'nav-settings',
    },
  ];

  const visibleItems = navigationItems.filter(
    (item) => !item.superAdminOnly || isSuperAdmin
  );

  const style = {
    '--sidebar-width': '18rem',
  };

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
                  {t('navigation.adminPortal')}
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const isActive = location === item.url;
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          data-testid={item.testId}
                        >
                          <a href={item.url} onClick={(e) => {
                            e.preventDefault();
                            setLocation(item.url);
                          }}>
                            <item.icon />
                            <span>{t(item.titleKey)}</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
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
          <header className="flex items-center justify-between gap-2 border-b bg-card px-4 py-3">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
