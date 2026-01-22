import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseISO, format, getYear, getMonth, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { ArchivedEvent, ArchiveStats, Category, Contact } from '@/lib/types';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CardLoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Users,
  Image,
  Video,
  Search,
  ChevronLeft,
  ChevronRight,
  Archive,
  Trophy,
  TrendingUp,
  Sparkles,
  CalendarDays,
  LayoutGrid,
  MapPin,
  Star,
  ArrowRight,
  ArrowLeft,
  Settings,
  Mic,
  UserCircle,
  Home,
} from 'lucide-react';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { motion, AnimatePresence } from 'framer-motion';
import ecssrLogo from '@assets/ecssr-logo.png';

// Animated counter component
function AnimatedCounter({ value, duration = 2000, suffix = '' }: { value: number; duration?: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    
    const startTime = Date.now();
    const startValue = 0;
    
    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.floor(startValue + (value - startValue) * easeOutQuart);
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}{suffix}</span>;
}

// Calendar month view component
function ArchiveCalendarMonth({ 
  year, 
  month, 
  events, 
  isArabic,
  locale,
  onEventClick 
}: { 
  year: number;
  month: number;
  events: ArchivedEvent[];
  isArabic: boolean;
  locale?: Locale;
  onEventClick: (id: number) => void;
}) {
  const start = startOfMonth(new Date(year, month));
  const end = endOfMonth(start);
  const days = eachDayOfInterval({ start, end });
  
  // Get day of week for first day (0 = Sunday)
  const startDay = start.getDay();
  // Create padding for days before the month starts
  const paddingDays = Array(startDay).fill(null);
  
  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, ArchivedEvent[]>();
    events.forEach(event => {
      const dateKey = event.startDate;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    });
    return map;
  }, [events]);

  const monthName = format(start, isArabic ? 'MMMM yyyy' : 'MMMM yyyy', { locale });
  
  return (
    <div className="bg-card/50 backdrop-blur rounded-xl border p-4">
      <h4 className="text-center font-semibold text-lg mb-3">{monthName}</h4>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-xs font-medium text-muted-foreground p-1">
            {day}
          </div>
        ))}
        {paddingDays.map((_, i) => (
          <div key={`pad-${i}`} className="p-1" />
        ))}
        {days.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDate.get(dateKey) || [];
          const hasEvents = dayEvents.length > 0;
          
          return (
            <div
              key={dateKey}
              className={`
                relative p-1 text-sm rounded-lg transition-all
                ${hasEvents 
                  ? 'bg-gradient-to-br from-blue-500/20 to-blue-400/20 text-blue-700 dark:text-blue-300 font-medium cursor-pointer hover:from-blue-500/30 hover:to-blue-400/30' 
                  : 'text-muted-foreground'
                }
              `}
              onClick={() => hasEvents && onEventClick(dayEvents[0].id)}
            >
              {format(day, 'd')}
              {hasEvents && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PublicArchive() {
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isArabic = i18n.language === 'ar' || language === 'ar';
  const locale = isArabic ? ar : undefined;
  
  const [page, setPage] = useState(1);
  const [year, setYear] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [speakerId, setSpeakerId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'gallery' | 'calendar'>('gallery');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const limit = 12;

  // Fetch archive stats
  const { data: stats, isLoading: statsLoading } = useQuery<ArchiveStats>({
    queryKey: ['/api/archive/stats'],
  });

  // Fetch available years
  const { data: years = [] } = useQuery<number[]>({
    queryKey: ['/api/archive/years'],
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  // Fetch eligible speakers for filtering
  const { data: speakers = [] } = useQuery<Contact[]>({
    queryKey: ['/api/archive/speakers'],
  });

  // Fetch archived events
  const { data: archiveData, isLoading: eventsLoading } = useQuery<{
    events: ArchivedEvent[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: ['/api/archive', { page, year, categoryId, search, speakerId, limit: viewMode === 'calendar' ? 100 : limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(viewMode === 'calendar' ? 100 : limit));
      if (year) params.append('year', year);
      if (categoryId) params.append('categoryId', categoryId);
      if (search) params.append('search', search);
      if (speakerId) params.append('speaker', speakerId);
      const response = await fetch(`/api/archive?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch archive');
      return response.json();
    },
  });

  // Fetch speaker spotlight info when filtering by speaker
  const { data: speakerEvents } = useQuery<{ contact: Contact; archivedEvents: ArchivedEvent[] }>({
    queryKey: ['/api/archive/speaker-events', speakerId],
    enabled: !!speakerId,
    queryFn: async () => {
      const response = await fetch(`/api/contacts/${speakerId}/events`);
      if (!response.ok) throw new Error('Failed to fetch speaker events');
      return response.json();
    },
    select: (data) => ({ contact: data.contact, archivedEvents: data.archivedEvents }),
  });

  // Keep speaker filter in sync with URL for sharable links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const existingSpeaker = params.get('speaker');
    if (existingSpeaker && /^\d+$/.test(existingSpeaker)) {
      setSpeakerId(existingSpeaker);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (speakerId) {
      params.set('speaker', speakerId);
    } else {
      params.delete('speaker');
    }
    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [speakerId]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleClearFilters = () => {
    setYear('');
    setCategoryId('');
    setSearch('');
    setSearchInput('');
    setSpeakerId('');
    setPage(1);
  };

  const totalPages = archiveData ? Math.ceil(archiveData.total / limit) : 0;
  const hasActiveFilters = year || categoryId || search || speakerId;
  const selectedSpeaker = speakers.find((sp) => String(sp.id) === speakerId);

  // Helper for bilingual content
  const getBilingualContent = (en: string | null | undefined, ar: string | null | undefined) => {
    if (isArabic && ar) return ar;
    return en || '';
  };

  const getSpeakerDisplayName = (speaker: any) => {
    const name = isArabic && speaker.speakerNameAr ? speaker.speakerNameAr : speaker.speakerNameEn;
    const title = isArabic ? speaker.speakerTitleAr : speaker.speakerTitle;
    return title ? `${title} ${name}` : name || '';
  };

  const getContactDisplayName = (contact: Contact) => {
    const name = isArabic && contact.nameAr ? contact.nameAr : contact.nameEn;
    const title = isArabic ? contact.titleAr : contact.title;
    return title ? `${title} ${name}` : name;
  };

  const formatShortDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), isArabic ? 'd MMM' : 'MMM d', { locale });
    } catch {
      return dateStr;
    }
  };

  // Generate months for calendar view
  const calendarMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => i);
  }, []);

  // Navigate between years in calendar view
  const handleYearChange = (delta: number) => {
    setSelectedYear(prev => prev + delta);
    setYear(String(selectedYear + delta));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-blue-100/40">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img 
                src={ecssrLogo} 
                alt="ECSSR Logo" 
                className="h-10 w-auto flex-shrink-0"
              />
              <div className="hidden md:block">
                <h1 className="text-lg md:text-xl font-semibold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                  {t('archive.title')}
                </h1>
              </div>
            </div>
            <div className="flex gap-2">
              {user ? (
                <>
                  {(user.role === 'admin' || user.role === 'superadmin') && (
                  <Link href="/admin/archive">
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4 me-2" />
                      {t('archive.admin.manageArchive')}
                    </Button>
                  </Link>
                  )}
                  <Link href="/">
                    <Button variant="outline" size="sm">
                      <ArrowLeft className="h-4 w-4 me-2" />
                      {t('archive.admin.backToCalendar')}
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/">
                    <Button variant="ghost" size="sm">
                      <Home className="h-4 w-4 me-2" />
                      <span className="hidden sm:inline">{t('navigation.home')}</span>
                    </Button>
                  </Link>
                  <Link href="/calendar">
                    <Button variant="ghost" size="sm">
                      <Calendar className="h-4 w-4 me-2" />
                      <span className="hidden sm:inline">{t('navigation.eventsCalendar')}</span>
                    </Button>
                  </Link>
                </>
              )}
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-10">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-400 to-blue-200 p-8 md:p-12 text-white"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-100/30 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
          <Sparkles className="absolute top-6 right-6 h-8 w-8 text-blue-200/60 animate-pulse" />
          
          <div className="relative z-10 text-center space-y-4">
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur"
            >
              <Trophy className="h-5 w-5" />
              <span className="font-medium">{t('archive.public.theHarvest')}</span>
            </motion.div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              {t('archive.public.eventsArchive')}
            </h1>
            
            <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
              {isArabic 
                ? 'استكشف رحلتنا عبر السنين واكتشف إنجازاتنا وفعالياتنا المميزة'
                : 'Explore our journey through the years and discover our remarkable events and achievements'
              }
            </p>
          </div>
        </motion.div>

        {/* Stats Cards - Animated */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {statsLoading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <CardLoadingState key={i} className="h-32" />
              ))}
            </>
          ) : stats ? (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="relative overflow-hidden border-none bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 h-full">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/20 rounded-full blur-xl" />
                  <CardContent className="pt-6 text-center relative z-10">
                    <Trophy className="h-8 w-8 mx-auto mb-2 text-orange-600 dark:text-orange-400" />
                    <div className="text-4xl font-bold text-orange-600 dark:text-orange-400">
                      <AnimatedCounter value={stats.totalEvents} />
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{t('archive.stats.totalEvents')}</div>
                  </CardContent>
                </Card>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="relative overflow-hidden border-none bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 h-full">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/20 rounded-full blur-xl" />
                  <CardContent className="pt-6 text-center relative z-10">
                    <Users className="h-8 w-8 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                    <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                      <AnimatedCounter value={stats.totalAttendees} />
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{t('archive.stats.totalAttendees')}</div>
                  </CardContent>
                </Card>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="relative overflow-hidden border-none bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 h-full">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/20 rounded-full blur-xl" />
                  <CardContent className="pt-6 text-center relative z-10">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
                    <div className="text-4xl font-bold text-green-600 dark:text-green-400">
                      <AnimatedCounter value={stats.yearsActive.length} suffix="+" />
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{t('archive.stats.yearsActive')}</div>
                  </CardContent>
                </Card>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="relative overflow-hidden border-none bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 h-full">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/20 rounded-full blur-xl" />
                  <CardContent className="pt-6 text-center relative z-10">
                    <Star className="h-8 w-8 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                    <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                      <AnimatedCounter value={stats.categoriesUsed} />
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{t('archive.stats.categories')}</div>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          ) : null}
        </div>

        {/* View Mode Toggle & Filters */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'gallery' | 'calendar')} className="w-auto">
            <TabsList className="bg-muted/50 backdrop-blur">
              <TabsTrigger value="gallery" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                {t('calendar.views.list') || 'Gallery'}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                {t('calendar.views.calendar') || 'Calendar'}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto">
            <div className="flex gap-2 flex-1 lg:flex-initial">
              <Input
                placeholder={t('archive.filters.searchPlaceholder')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="max-w-xs bg-background/50 backdrop-blur"
              />
              <Button variant="secondary" onClick={handleSearch} size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Select value={year || "__all__"} onValueChange={(v) => { setYear(v === "__all__" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-[130px] bg-background/50 backdrop-blur">
                  <SelectValue placeholder={t('archive.filters.allYears')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('archive.filters.allYears')}</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryId || "__all__"} onValueChange={(v) => { setCategoryId(v === "__all__" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-[160px] bg-background/50 backdrop-blur">
                  <SelectValue placeholder={t('archive.filters.allCategories')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('archive.filters.allCategories')}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {getBilingualContent(cat.nameEn, cat.nameAr)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={speakerId || "__all__"} onValueChange={(v) => { setSpeakerId(v === "__all__" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-[190px] bg-background/50 backdrop-blur">
                  <SelectValue placeholder={isArabic ? 'كل المتحدثين' : 'All speakers'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{isArabic ? 'كل المتحدثين' : 'All speakers'}</SelectItem>
                  {speakers.map((speaker) => (
                    <SelectItem key={speaker.id} value={String(speaker.id)}>
                      {getContactDisplayName(speaker)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={handleClearFilters} size="sm">
                  {t('archive.filters.clearFilters')}
                </Button>
              )}
            </div>
          </div>
        </div>

        {selectedSpeaker && (
          <Card className="bg-gradient-to-r from-purple-500/10 to-amber-500/10 border-purple-500/20">
            <CardContent className="py-4 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 flex-shrink-0">
                  <AvatarImage
                    src={selectedSpeaker.profilePictureThumbnailKey ? `/api/contacts/profile-picture/${selectedSpeaker.id}?thumbnail=true` : undefined}
                    alt=""
                  />
                  <AvatarFallback>
                    <UserCircle className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">{isArabic ? 'عرض فعاليات المتحدث' : 'Filtering by speaker'}</p>
                  <h3 className="text-lg font-semibold">{getContactDisplayName(selectedSpeaker)}</h3>
                  {(selectedSpeaker.positionId || selectedSpeaker.organizationId) && (
                    <p className="text-sm text-muted-foreground truncate">
                      {selectedSpeaker.positionId && getBilingualContent(selectedSpeaker.position?.nameEn || '', selectedSpeaker.position?.nameAr || '')}
                      {selectedSpeaker.positionId && selectedSpeaker.organizationId && ' • '}
                      {selectedSpeaker.organizationId && getBilingualContent(selectedSpeaker.organization?.nameEn || '', selectedSpeaker.organization?.nameAr || '')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {speakerEvents && (
                  <div className="text-center">
                    <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">
                      {speakerEvents.archivedEvents?.length || 0}
                    </div>
                    <div className="text-xs">{isArabic ? 'فعاليات في الأرشيف' : 'Archived events'}</div>
                  </div>
                )}
                <Button variant="ghost" size="sm" onClick={() => setSpeakerId('')}>
                  {isArabic ? 'إزالة المتحدث' : 'Clear speaker'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {viewMode === 'gallery' ? (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Events Grid */}
              {eventsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <CardLoadingState key={i} className="h-80" />
                  ))}
                </div>
              ) : archiveData?.events.length === 0 ? (
                <EmptyState
                  icon={<Archive className="h-12 w-12" />}
                  title={hasActiveFilters ? t('archive.emptyStates.noResults') : t('archive.emptyStates.noArchives')}
                  description={hasActiveFilters ? t('archive.emptyStates.noResultsDesc') : t('archive.emptyStates.noArchivesDesc')}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {archiveData?.events.map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link href={`/archive/${event.id}`}>
                        <Card className="group h-full overflow-hidden bg-card/50 backdrop-blur border-muted/50 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 cursor-pointer">
                          {/* Event image or gradient placeholder */}
                          <div className="h-40 relative overflow-hidden bg-gradient-to-br from-amber-400/20 via-orange-400/20 to-rose-400/20">
                            {event.thumbnailUrl ? (
                              <img 
                                src={event.thumbnailUrl}
                                alt={getBilingualContent(event.name, event.nameAr)}
                                className="w-full h-full object-cover"
                              />
                            ) : null}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent)]" />
                            <div className="absolute bottom-3 left-3 right-3 flex gap-2">
                              {event.photoKeys && event.photoKeys.length > 0 && (
                                <Badge className="bg-black/50 backdrop-blur text-white gap-1">
                                  <Image className="h-3 w-3" />
                                  {event.photoKeys.length}
                                </Badge>
                              )}
                              {event.youtubeVideoIds && event.youtubeVideoIds.length > 0 && (
                                <Badge className="bg-black/50 backdrop-blur text-white gap-1">
                                  <Video className="h-3 w-3" />
                                  {event.youtubeVideoIds.length}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <CardContent className="p-5 space-y-4">
                            <div>
                              <CardTitle className="line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                {getBilingualContent(event.name, event.nameAr)}
                              </CardTitle>
                            </div>
                            
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-blue-600" />
                                <span>{formatShortDate(event.startDate)}</span>
                              </div>
                              {event.actualAttendees && (
                                <div className="flex items-center gap-1.5">
                                  <Users className="h-4 w-4 text-blue-500" />
                                  <span>{event.actualAttendees.toLocaleString()}</span>
                                </div>
                              )}
                              {event.location && (
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="h-4 w-4 text-blue-400" />
                                  <span className="truncate max-w-[120px]">
                                    {getBilingualContent(event.location, event.locationAr)}
                                  </span>
                                </div>
                              )}
                            </div>

                            {(event.highlights || event.highlightsAr) && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {getBilingualContent(event.highlights, event.highlightsAr)}
                              </p>
                            )}

                            {event.speakers && event.speakers.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {event.speakers.slice(0, 3).map((speaker) => (
                                  speaker.contactId ? (
                                    <Link key={speaker.id} href={`/archive?speaker=${speaker.contactId}`}>
                                      <Badge variant="outline" className="gap-1 hover:bg-amber-50 dark:hover:bg-amber-500/10">
                                        <Mic className="h-3 w-3" />
                                        <span className="truncate max-w-[150px]">{getSpeakerDisplayName(speaker)}</span>
                                      </Badge>
                                    </Link>
                                  ) : (
                                    <Badge key={speaker.id} variant="outline" className="gap-1">
                                      <Mic className="h-3 w-3" />
                                      <span className="truncate max-w-[150px]">{getSpeakerDisplayName(speaker)}</span>
                                    </Badge>
                                  )
                                ))}
                                {event.speakers.length > 3 && (
                                  <Badge variant="secondary" className="bg-muted/80">
                                    +{event.speakers.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-2">
                              <span className="text-xs text-muted-foreground">
                                {getYear(parseISO(event.startDate))}
                              </span>
                              <span className="text-amber-600 dark:text-amber-400 text-sm font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {t('archive.actions.viewDetails')}
                                <ArrowRight className="h-4 w-4 text-blue-500" />
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {viewMode === 'gallery' && totalPages > 1 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-4 pt-8"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('common.previous')}
                  </Button>
                  <span className="text-sm text-muted-foreground bg-muted px-4 py-2 rounded-full">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="gap-2"
                  >
                    {t('common.next')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Calendar View */}
              <div className="space-y-6">
                {/* Year Navigator */}
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleYearChange(-1)}
                  >
                    {isArabic ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                  </Button>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                    {selectedYear}
                  </h2>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleYearChange(1)}
                    disabled={selectedYear >= new Date().getFullYear()}
                  >
                    {isArabic ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>

                {/* Calendar Grid */}
                {eventsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(12)].map((_, i) => (
                      <CardLoadingState key={i} className="h-64" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {calendarMonths.map((month) => (
                      <ArchiveCalendarMonth
                        key={month}
                        year={selectedYear}
                        month={month}
                        events={archiveData?.events.filter(e => {
                          const eventDate = parseISO(e.startDate);
                          return getYear(eventDate) === selectedYear && getMonth(eventDate) === month;
                        }) || []}
                        isArabic={isArabic}
                        locale={locale}
                        onEventClick={(id) => window.location.href = `/archive/${id}`}
                      />
                    ))}
                  </div>
                )}

                {/* Year Summary */}
                {archiveData && archiveData.events.length > 0 && (
                  <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20">
                    <CardContent className="py-6">
                      <div className="flex flex-wrap justify-center gap-8 text-center">
                        <div>
                          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            {archiveData.events.filter(e => getYear(parseISO(e.startDate)) === selectedYear).length}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t('archive.public.eventsThisYear')}
                          </div>
                        </div>
                        <div>
                          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            {archiveData.events
                              .filter(e => getYear(parseISO(e.startDate)) === selectedYear)
                              .reduce((sum, e) => sum + (e.actualAttendees || 0), 0)
                              .toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t('archive.public.totalAttendees')}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-8 text-center text-sm text-muted-foreground">
        <p>
          {isArabic 
            ? '© مركز الإمارات للدراسات والبحوث الاستراتيجية - أرشيف الفعاليات'
            : '© Emirates Center for Strategic Studies and Research - Events Archive'
          }
        </p>
      </footer>
    </div>
  );
}
