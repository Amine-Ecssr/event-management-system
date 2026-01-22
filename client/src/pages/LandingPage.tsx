import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { parseISO, format } from 'date-fns';
import { Event, DashboardStats } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, Archive, LogIn, BarChart3, Users, CheckSquare, Sparkles, ArrowRight, History, Star, Image } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import ecssrLogo from '@assets/ecssr-logo.png';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LandingPage() {
  const { t } = useTranslation();
  const { language, isRTL } = useLanguage();

  // Fetch dashboard statistics
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  // Fetch all events
  const { data: allEvents = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  // Fetch settings to check archive availability
  const { data: settings } = useQuery<{ archiveEnabled?: boolean }>({
    queryKey: ['/api/settings'],
  });

  const archiveEnabled = settings?.archiveEnabled !== false;

  // Filter upcoming events
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingEvents = allEvents
    .filter(event => {
      const endDate = new Date(event.endDate);
      return endDate >= today;
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 6);

  // Calculate archive/past events stats
  const pastEvents = allEvents.filter(event => {
    const endDate = new Date(event.endDate);
    return endDate < today;
  });

  // Get category breakdown for display
  const categoryData = stats?.eventsByCategory
    ? Object.entries(stats.eventsByCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img 
                src={ecssrLogo} 
                alt="ECSSR Logo" 
                className="h-10 w-auto flex-shrink-0"
              />
              <div className="hidden md:block">
                <h1 className="text-lg md:text-xl font-semibold">
                  {t('navigation.eventsCalendar')}
                </h1>
              </div>
            </div>
            <div className="flex gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
              <Link href="/login">
                <Button variant="default" size="sm" className="gap-2">
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('landing.hero.signIn')}</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="py-12 md:py-16"
        >
          <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 relative">
            {/* Decorative elements */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
            </div>
            
            <CardContent className="py-12 md:py-16 px-6 text-center">
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-primary/10 border border-primary/20">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{t('landing.hero.badge')}</span>
                </div>
              </motion.div>
              
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 pb-2 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent leading-relaxed">
                {t('landing.hero.title')}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
                {t('landing.hero.subtitle')}
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link href="/calendar">
                  <Button size="lg" className="gap-2 shadow-lg hover:shadow-xl transition-shadow">
                    <Calendar className="h-5 w-5" />
                    {t('landing.hero.viewCalendar')}
                    {isRTL ? (
                      <ArrowRight className="h-4 w-4 mr-1 rotate-180" />
                    ) : (
                      <ArrowRight className="h-4 w-4 ml-1" />
                    )}
                  </Button>
                </Link>
                {archiveEnabled && (
                  <Link href="/archive">
                    <Button size="lg" variant="outline" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
                      <Archive className="h-5 w-5" />
                      {t('landing.hero.viewArchive')}
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Upcoming Events Section - Moved Higher */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="py-8 mb-8"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-3 pb-1.5 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent leading-relaxed">
              {t('landing.upcomingEvents.title')}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('landing.upcomingEvents.subtitle')}
            </p>
          </div>
          
          {eventsLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">{t('events.loadingEvents')}</p>
            </div>
          ) : upcomingEvents.length === 0 ? (
            <Card className="py-16 border-dashed border-2">
              <CardContent className="text-center">
                <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground text-lg">{t('landing.upcomingEvents.noEvents')}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Carousel
                opts={{
                  align: 'start',
                  loop: true,
                  direction: isRTL ? 'rtl' : 'ltr',
                }}
                className="w-full"
              >
                <CarouselContent className="-ml-2 md:-ml-4">
                  {upcomingEvents.map((event, index) => (
                    <CarouselItem key={event.id} className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/3">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="h-full"
                      >
                        <Card className="h-full min-h-[500px] hover:shadow-xl transition-all duration-300 border-primary/10 hover:border-primary/30 group overflow-hidden flex flex-col">
                          {/* Event image or gradient placeholder */}
                          <div className="h-48 relative overflow-hidden bg-gradient-to-br from-primary/20 via-blue-400/20 to-purple-400/20 shrink-0">
                            {event.thumbnailUrl ? (
                              <img 
                                src={event.thumbnailUrl}
                                alt={language === 'ar' && event.nameAr ? event.nameAr : event.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Calendar className="h-16 w-16 text-primary/30" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                            {event.media && event.media.length > 0 && (
                              <div className="absolute bottom-3 left-3">
                                <Badge className="bg-black/50 backdrop-blur text-white gap-1">
                                  <Image className="h-3 w-3" />
                                  {event.media.length}
                                </Badge>
                              </div>
                            )}
                          </div>
                          <CardHeader className="flex-grow">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <CardTitle className="line-clamp-2 text-lg group-hover:text-primary transition-colors">
                                {language === 'ar' && event.nameAr ? event.nameAr : event.name}
                              </CardTitle>
                              {event.category && (
                                <Badge variant="outline" className="shrink-0 bg-primary/5">
                                  {event.category}
                                </Badge>
                              )}
                            </div>
                            <CardDescription className="line-clamp-3 min-h-[4.5rem]">
                              {language === 'ar' && event.descriptionAr
                                ? event.descriptionAr
                                : event.description || '\u00A0'}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="mt-auto">
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="h-4 w-4 text-primary" />
                                <span>
                                  {format(parseISO(event.startDate), 'MMM dd, yyyy')}
                                  {event.startDate !== event.endDate &&
                                    ` - ${format(parseISO(event.endDate), 'MMM dd, yyyy')}`}
                                </span>
                              </div>
                              {event.location && (
                                <div className="text-muted-foreground line-clamp-1">
                                  📍 {language === 'ar' && event.locationAr ? event.locationAr : event.location}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                
                <div className="flex items-center justify-center gap-2 mt-6">
                  <CarouselPrevious className="relative left-auto right-auto translate-x-0 translate-y-0 shadow-md bg-card/90 backdrop-blur border hover:bg-primary/10" />
                  <CarouselNext className="relative left-auto right-auto translate-x-0 translate-y-0 shadow-md bg-card/90 backdrop-blur border hover:bg-primary/10" />
                </div>
              </Carousel>

              <div className="text-center mt-8">
                <Link href="/calendar">
                  <Button variant="outline" size="lg" className="gap-2 group">
                    {t('landing.upcomingEvents.viewAll')}
                    {isRTL ? (
                      <ArrowRight className="h-4 w-4 group-hover:-translate-x-1 transition-transform rotate-180" />
                    ) : (
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    )}
                  </Button>
                </Link>
              </div>
            </>
          )}
        </motion.section>

        {/* Quick Stats Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="py-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {/* Total Events */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <Card className="border-primary/20 hover:border-primary/40 transition-all hover:shadow-lg bg-gradient-to-br from-card to-primary/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('landing.stats.totalEvents')}
                  </CardTitle>
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    {statsLoading ? '...' : stats?.totalEvents || 0}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Upcoming Events */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.6 }}
            >
              <Card className="border-primary/20 hover:border-primary/40 transition-all hover:shadow-lg bg-gradient-to-br from-card to-green-500/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('landing.stats.upcomingEvents')}
                  </CardTitle>
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-green-600 dark:text-green-400">
                    {statsLoading ? '...' : stats?.upcomingEvents || 0}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Past Events */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.7 }}
            >
              <Card className="border-primary/20 hover:border-primary/40 transition-all hover:shadow-lg bg-gradient-to-br from-card to-blue-500/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('landing.stats.pastEvents')}
                  </CardTitle>
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                    {eventsLoading ? '...' : pastEvents.length}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Active Categories */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.8 }}
            >
              <Card className="border-primary/20 hover:border-primary/40 transition-all hover:shadow-lg bg-gradient-to-br from-card to-purple-500/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t('landing.stats.activeCategories')}
                  </CardTitle>
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <CheckSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                    {statsLoading ? '...' : Object.keys(stats?.eventsByCategory || {}).length}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

        </motion.section>

        {/* Archive Showcase Section */}
        {archiveEnabled && pastEvents.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="py-12 my-8"
          >
            <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
              <CardHeader className="text-center pb-4">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Archive className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-2xl md:text-3xl pb-1.5 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent leading-relaxed">
                    {t('landing.archive.title')}
                  </CardTitle>
                </div>
                <CardDescription className="text-base max-w-2xl mx-auto">
                  {t('landing.archive.subtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-card/50 rounded-lg border border-primary/10">
                    <div className="text-3xl font-bold text-primary mb-1">
                      {pastEvents.length}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('landing.archive.archivedEvents')}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-card/50 rounded-lg border border-primary/10">
                    <div className="text-3xl font-bold text-primary mb-1">
                      {new Set(pastEvents.map(e => e.category).filter(Boolean)).size}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('landing.archive.categories')}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-card/50 rounded-lg border border-primary/10">
                    <div className="text-3xl font-bold text-primary mb-1">
                      {pastEvents.filter(e => 'media' in e && Array.isArray((e as { media?: unknown[] }).media) && ((e as { media?: unknown[] }).media?.length ?? 0) > 0).length}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('landing.archive.withMedia')}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-card/50 rounded-lg border border-primary/10">
                    <div className="text-3xl font-bold text-primary mb-1">
                      <Star className="h-8 w-8 mx-auto fill-primary text-primary" />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('landing.archive.richContent')}
                    </div>
                  </div>
                </div>
                
                {categoryData.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold mb-3 text-center">
                      {t('landing.stats.eventsByCategory')}
                    </h4>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {categoryData.map(([category, count]) => (
                        <Badge key={category} variant="secondary" className="px-3 py-1.5 text-sm">
                          {category} <span className="ml-2 font-bold">{count}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-center">
                  <Link href="/archive">
                    <Button size="lg" className="gap-2 shadow-lg group">
                      <Archive className="h-5 w-5" />
                      {t('landing.archive.exploreArchive')}
                      {isRTL ? (
                        <ArrowRight className="h-4 w-4 group-hover:-translate-x-1 transition-transform rotate-180" />
                      ) : (
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      )}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.section>
        )}

        {/* Features Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="py-12 pb-20"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4 pb-1.5 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent leading-relaxed">
            {t('landing.features.title')}
          </h2>
          <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">
            {t('landing.features.subtitle')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 }}
            >
              <Card className="h-full hover:shadow-xl transition-all hover:border-primary/30 group">
                <CardHeader>
                  <div className="p-3 bg-primary/10 rounded-xl w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                    <Calendar className="h-10 w-10 text-primary" />
                  </div>
                  <CardTitle className="group-hover:text-primary transition-colors">
                    {t('landing.features.calendar')}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {t('landing.features.calendarDesc')}
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.0 }}
            >
              <Card className="h-full hover:shadow-xl transition-all hover:border-primary/30 group">
                <CardHeader>
                  <div className="p-3 bg-primary/10 rounded-xl w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                    <Archive className="h-10 w-10 text-primary" />
                  </div>
                  <CardTitle className="group-hover:text-primary transition-colors">
                    {t('landing.features.archive')}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {t('landing.features.archiveDesc')}
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.1 }}
            >
              <Card className="h-full hover:shadow-xl transition-all hover:border-primary/30 group">
                <CardHeader>
                  <div className="p-3 bg-primary/10 rounded-xl w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                    <CheckSquare className="h-10 w-10 text-primary" />
                  </div>
                  <CardTitle className="group-hover:text-primary transition-colors">
                    {t('landing.features.tasks')}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {t('landing.features.tasksDesc')}
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/50 backdrop-blur-sm py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 md:px-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} ECSSR. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
