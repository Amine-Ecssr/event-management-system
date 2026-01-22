import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { parseISO, format, addDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { Event, DashboardStats } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  TrendingUp,
  Archive,
  CheckSquare,
  Users,
  ClipboardList,
  Plus,
  Settings,
  BarChart3,
  ListTodo,
  Handshake,
  UserCircle,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { StatCard, StatsGrid } from '@/components/ui/stat-card';
import { LoadingState, ListLoadingSkeleton, DashboardCardSkeleton } from '@/components/ui/loading-state';
import { NoEventsEmptyState, NoTasksEmptyState } from '@/components/ui/empty-state';
import { PageContainer, PageContent, PageSection } from '@/components/ui/page-container';

interface Task {
  id: number;
  title: string;
  titleAr?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'waiting';
  dueDate: string | null;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { language } = useLanguage();

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isDepartmentScoped = user?.departmentId != null || user?.role === 'department' || user?.role === 'department_admin';

  // Fetch dashboard statistics
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  // Fetch partnerships analytics
  const { data: partnershipStats, isLoading: partnershipStatsLoading } = useQuery<{
    totalPartners: number;
    activePartners: number;
  }>({
    queryKey: ['/api/partnerships/analytics'],
    enabled: isAdmin,
  });

  // Fetch contacts statistics
  const { data: contactsStats, isLoading: contactsStatsLoading } = useQuery<{
    totalContacts: number;
    totalOrganizations: number;
  }>({
    queryKey: ['/api/contacts/statistics'],
    enabled: isAdmin,
  });

  // Fetch all events
  const { data: allEvents = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  // Fetch tasks if user is authenticated (using admin endpoint)
  const { data: allTasksData = [], isLoading: tasksLoading } = useQuery<Array<{
    task: Task;
    eventDepartment: any;
    department: any;
    event: Event;
  }>>({
    queryKey: ['/api/admin/tasks'],
    enabled: !!user && isAdmin,
  });

  // Extract tasks from the data structure
  const allTasks = allTasksData.map(item => item.task);

  // Fetch settings
  const { data: settings } = useQuery<{ archiveEnabled?: boolean }>({
    queryKey: ['/api/settings'],
  });

  const archiveEnabled = settings?.archiveEnabled !== false;

  // Get upcoming events (next 30 days)
  const today = startOfDay(new Date());
  const next30Days = addDays(today, 30);
  
  const upcomingEvents = allEvents
    .filter(event => {
      const endDate = new Date(event.endDate);
      const startDate = new Date(event.startDate);
      return endDate >= today && startDate <= next30Days;
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5);

  // Get recent tasks (next 10 days or overdue)
  const recentTasks = allTasks
    .filter(task => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      return isBefore(dueDate, addDays(today, 10)) && task.status !== 'completed' && task.status !== 'cancelled';
    })
    .sort((a, b) => {
      if (!a.dueDate || !b.dueDate) return 0;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, 5);

  const statsCards = [
    {
      title: t('dashboard.stats.totalEvents'),
      value: stats?.totalEvents || 0,
      icon: BarChart3,
      loading: statsLoading,
    },
    {
      title: t('dashboard.stats.upcomingEvents'),
      value: stats?.upcomingEvents || 0,
      icon: TrendingUp,
      loading: statsLoading,
    },
    ...(stats?.totalTasks !== undefined ? [
      {
        title: t('dashboard.stats.totalTasks'),
        value: stats.totalTasks,
        icon: ClipboardList,
        loading: statsLoading,
      },
      {
        title: t('dashboard.stats.pendingTasks'),
        value: stats.pendingTasks || 0,
        icon: ListTodo,
        loading: statsLoading,
      },
    ] : []),
    ...(isAdmin && partnershipStats ? [
      {
        title: t('dashboard.stats.activePartnerships'),
        value: partnershipStats.activePartners,
        icon: Handshake,
        loading: partnershipStatsLoading,
      },
    ] : []),
    ...(isAdmin && contactsStats ? [
      {
        title: t('dashboard.stats.totalContacts'),
        value: contactsStats.totalContacts,
        icon: UserCircle,
        loading: contactsStatsLoading,
      },
    ] : []),
  ];

  const quickActions = [
    ...(isAdmin ? [
      {
        title: t('dashboard.quickActions.addEvent'),
        description: t('dashboard.quickActions.addEventDesc'),
        href: '/calendar?new=true',
        icon: Plus,
        variant: 'default' as const,
      },
    ] : []),
    {
      title: t('dashboard.quickActions.viewCalendar'),
      description: t('dashboard.quickActions.viewCalendarDesc'),
      href: '/calendar',
      icon: Calendar,
      variant: 'outline' as const,
    },
    ...(user ? [
      {
        title: t('dashboard.quickActions.manageTasks'),
        description: t('dashboard.quickActions.manageTasksDesc'),
        href: '/admin/tasks',
        icon: ClipboardList,
        variant: 'outline' as const,
      },
    ] : []),
    ...(archiveEnabled ? [
      {
        title: t('dashboard.quickActions.viewArchive'),
        description: t('dashboard.quickActions.viewArchiveDesc'),
        href: '/archive',
        icon: Archive,
        variant: 'outline' as const,
      },
    ] : []),
    ...(isAdmin ? [
      {
        title: t('dashboard.quickActions.managePartnerships'),
        description: t('dashboard.quickActions.managePartnershipsDesc'),
        href: '/admin/partnerships',
        icon: Handshake,
        variant: 'outline' as const,
      },
      {
        title: t('dashboard.quickActions.manageContacts'),
        description: t('dashboard.quickActions.manageContactsDesc'),
        href: '/admin/contacts',
        icon: UserCircle,
        variant: 'outline' as const,
      },
      {
        title: t('dashboard.quickActions.settings'),
        description: t('dashboard.quickActions.settingsDesc'),
        href: '/admin/settings',
        icon: Settings,
        variant: 'outline' as const,
      },
    ] : []),
  ];

  const getTaskStatusBadge = (status: Task['status']) => {
    const variants: Record<Task['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      in_progress: 'default',
      completed: 'default',
      cancelled: 'secondary',
      waiting: 'secondary',
    };
    return (
      <Badge variant={variants[status]}>
        {t(`dashboard.recentTasks.status.${status}`)}
      </Badge>
    );
  };

  return (
    <PageContainer>
      <PageContent className="max-w-7xl mx-auto space-y-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {t('dashboard.welcome.greeting')}, {user?.username}!
          </h1>
          <p className="text-muted-foreground">{t('dashboard.welcome.subtitle')}</p>
        </motion.div>

        {/* Statistics Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <StatsGrid columns={statsCards.length > 4 ? 5 : 4}>
            {statsCards.map((stat, index) => (
              <StatCard
                key={index}
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                loading={stat.loading}
              />
            ))}
          </StatsGrid>
        </motion.div>

        {/* Quick Actions */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <PageSection title={t('dashboard.quickActions.title')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickActions.map((action, index) => (
                <Link key={index} href={action.href}>
                  <Card className="h-full hover:shadow-md transition-all hover:border-primary/30 cursor-pointer group">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-lg transition-colors ${action.variant === 'default' ? 'bg-primary text-primary-foreground' : 'bg-muted group-hover:bg-primary/10'}`}>
                          <action.icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-base">{action.title}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">{action.description}</CardDescription>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </PageSection>
        </motion.section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Events */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-base">{t('dashboard.upcomingEvents.title')}</CardTitle>
                  </div>
                  <Link href="/calendar">
                    <Button variant="ghost" size="sm" className="h-8 text-xs">
                      {t('dashboard.upcomingEvents.viewAll')}
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
                <CardDescription className="text-xs">{t('dashboard.upcomingEvents.next30Days')}</CardDescription>
              </CardHeader>
              <CardContent>
                {eventsLoading ? (
                  <ListLoadingSkeleton count={3} />
                ) : upcomingEvents.length === 0 ? (
                  <div className="py-6">
                    <NoEventsEmptyState showAction={false} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcomingEvents.map((event) => (
                      <Link key={event.id} href={`/admin/events/${event.id}`}>
                        <div className="flex items-start gap-3 p-3 rounded-lg border border-transparent hover:bg-accent/50 hover:border-border transition-colors cursor-pointer group">
                          <div className="p-2 rounded-md bg-muted group-hover:bg-primary/10 transition-colors">
                            <Calendar className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium line-clamp-1 text-sm">
                              {language === 'ar' && event.nameAr ? event.nameAr : event.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(parseISO(event.startDate), 'MMM dd, yyyy')}
                              {event.startDate !== event.endDate &&
                                ` - ${format(parseISO(event.endDate), 'MMM dd')}`}
                            </p>
                          </div>
                          {event.category && (
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              {event.category}
                            </Badge>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.section>

          {/* Recent Tasks */}
          {user && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-md bg-primary/10">
                        <ListTodo className="h-4 w-4 text-primary" />
                      </div>
                      <CardTitle className="text-base">{t('dashboard.recentTasks.title')}</CardTitle>
                    </div>
                    <Link href="/admin/tasks">
                      <Button variant="ghost" size="sm" className="h-8 text-xs">
                        {t('dashboard.recentTasks.viewAll')}
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                  <CardDescription className="text-xs">{t('dashboard.recentTasks.subtitle')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {tasksLoading ? (
                    <ListLoadingSkeleton count={3} />
                  ) : recentTasks.length === 0 ? (
                    <div className="py-6">
                      <NoTasksEmptyState showAction={false} />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentTasks.map((task) => {
                        const isOverdue = task.dueDate && isBefore(new Date(task.dueDate), today);
                        return (
                          <div
                            key={task.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors hover:bg-accent/50 ${isOverdue ? 'border-red-500/30 bg-red-500/5' : 'border-transparent'}`}
                          >
                            <div className={`p-2 rounded-md ${isOverdue ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                              <Clock className={`h-4 w-4 ${isOverdue ? 'text-red-500' : 'text-primary'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium line-clamp-1 text-sm">
                                {language === 'ar' && task.titleAr ? task.titleAr : task.title}
                              </p>
                              {task.dueDate && (
                                <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                                  {isOverdue ? t('dashboard.recentTasks.overdue') + ': ' : t('dashboard.recentTasks.dueDate') + ': '}
                                  {format(parseISO(task.dueDate), 'MMM dd, yyyy')}
                                </p>
                              )}
                            </div>
                            {getTaskStatusBadge(task.status)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.section>
          )}
        </div>
      </PageContent>
    </PageContainer>
  );
}
