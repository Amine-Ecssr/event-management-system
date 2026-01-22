import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseISO, format, getYear } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ArchivedEvent, ArchivedEventSpeaker } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Calendar,
  Users,
  MapPin,
  Link as LinkIcon,
  Archive,
  ChevronLeft,
  Image,
  Video,
  Building,
  Share2,
  ExternalLink,
  Sparkles,
  Trophy,
  Target,
  Lightbulb,
  Play,
  X,
  ChevronRight,
  Quote,
  Settings,
  ArrowLeft,
  Mic,
  UserCircle,
} from 'lucide-react';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import ecssrLogo from '@assets/ecssr-logo.png';

interface ArchiveDetailProps {
  id: string;
}

interface MediaItem {
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  caption?: string | null;
}

// Lightbox component for photos
function PhotoLightbox({ 
  images, 
  currentIndex, 
  onClose, 
  onNext, 
  onPrev 
}: { 
  images: MediaItem[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const current = images[currentIndex];
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>
      
      {images.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 text-white hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 text-white hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); onNext(); }}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </>
      )}
      
      <div className="max-w-5xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
        <img
          src={current?.imageUrl || ''}
          alt={current?.caption || ''}
          className="max-w-full max-h-[85vh] object-contain mx-auto rounded-lg"
        />
        {current?.caption && (
          <p className="text-white text-center mt-4">{current.caption}</p>
        )}
        <p className="text-white/60 text-center mt-2 text-sm">
          {currentIndex + 1} / {images.length}
        </p>
      </div>
    </motion.div>
  );
}

export default function ArchiveDetail({ id }: ArchiveDetailProps) {
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const isArabic = i18n.language === 'ar' || language === 'ar';
  const locale = isArabic ? ar : undefined;
  
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const { data: archivedEvent, isLoading, error } = useQuery<ArchivedEvent>({
    queryKey: ['/api/archive', id],
    queryFn: async () => {
      const response = await fetch(`/api/archive/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Archive not found');
        }
        throw new Error('Failed to fetch archive');
      }
      return response.json();
    },
  });

  // Fetch speakers for the archived event
  const { data: speakers = [] } = useQuery<ArchivedEventSpeaker[]>({
    queryKey: ['/api/archive', id, 'speakers'],
    queryFn: async () => {
      const response = await fetch(`/api/archive/${id}/speakers`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!id,
  });

  // Helper for speaker display name
  const getSpeakerDisplayName = (speaker: ArchivedEventSpeaker) => {
    const name = isArabic && speaker.speakerNameAr ? speaker.speakerNameAr : speaker.speakerNameEn;
    const title = isArabic ? speaker.speakerTitleAr : speaker.speakerTitle;
    return title ? `${title} ${name}` : name;
  };

  const getSpeakerInitials = (speaker: ArchivedEventSpeaker) => {
    const name = getSpeakerDisplayName(speaker) || '';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  const getBilingualContent = (en: string | null | undefined, ar: string | null | undefined) => {
    if (isArabic && ar) return ar;
    return en || '';
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), isArabic ? 'd MMMM yyyy' : 'MMMM d, yyyy', { locale });
    } catch {
      return dateStr;
    }
  };

  const formatDateRange = (startDate: string, endDate: string, startTime?: string | null, endTime?: string | null) => {
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    
    if (startDate === endDate) {
      if (startTime && endTime) {
        return `${start} • ${startTime} - ${endTime}`;
      }
      return start;
    }
    
    return `${start} - ${end}`;
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: archivedEvent?.name || 'Event Archive',
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast({
          title: t('archive.messages.linkCopied'),
        });
      }
    } catch {
      toast({
        title: t('archive.messages.failedToShare'),
        variant: 'destructive',
      });
    }
  };

  const extractYoutubeId = (urlOrId: string): string => {
    if (!urlOrId.includes('/') && !urlOrId.includes('.')) {
      return urlOrId;
    }
    const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^&?\s]+)/);
    return match ? match[1] : urlOrId;
  };

  const openLightbox = (index: number) => {
    setCurrentPhotoIndex(index);
    setLightboxOpen(true);
  };

  const nextPhoto = () => {
    if (archivedEvent?.media) {
      setCurrentPhotoIndex((prev) => (prev + 1) % archivedEvent.media!.length);
    }
  };

  const prevPhoto = () => {
    if (archivedEvent?.media) {
      setCurrentPhotoIndex((prev) => (prev - 1 + archivedEvent.media!.length) % archivedEvent.media!.length);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-amber-500/5">
        <div className="max-w-5xl mx-auto p-6">
          <LoadingState text="Loading archive details..." fullPage />
        </div>
      </div>
    );
  }

  if (error || !archivedEvent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-amber-500/5">
        <div className="max-w-4xl mx-auto p-6">
          <EmptyState
            icon={<Archive className="h-12 w-12" />}
            title={t('archive.emptyStates.noArchives')}
            description={t('archive.emptyStates.noArchivesDesc')}
            action={
              <Link href="/archive">
                <Button size="lg" className="gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  {t('archive.title')}
                </Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const eventYear = getYear(parseISO(archivedEvent.startDate));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-amber-500/5">
      {/* Photo Lightbox */}
      <AnimatePresence>
        {lightboxOpen && archivedEvent.media && (
          <PhotoLightbox
            images={archivedEvent.media}
            currentIndex={currentPhotoIndex}
            onClose={() => setLightboxOpen(false)}
            onNext={nextPhoto}
            onPrev={prevPhoto}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={ecssrLogo} alt="ECSSR Logo" className="h-10 w-auto flex-shrink-0" />
              <div className="hidden md:block">
                <h1 className="text-lg md:text-xl font-semibold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                  {t('archive.title')}
                </h1>
              </div>
            </div>
            <div className="flex gap-2">
              {user ? (
                <>
                  <Link href="/admin/archive">
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4 me-2" />
                      {t('archive.admin.manageArchive')}
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button variant="outline" size="sm">
                      <ArrowLeft className="h-4 w-4 me-2" />
                      {t('archive.admin.backToCalendar')}
                    </Button>
                  </Link>
                </>
              ) : (
                <Link href="/archive">
                  <Button variant="ghost" size="sm">
                    <Archive className="h-4 w-4 me-2" />
                    {t('archive.title')}
                  </Button>
                </Link>
              )}
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-8">
        {/* Back Link */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link href="/archive">
            <Button variant="ghost" size="sm" className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              {t('archive.title')}
            </Button>
          </Link>
        </motion.div>

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-8 md:p-12 text-white"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
          <Sparkles className="absolute top-6 right-6 h-8 w-8 text-white/30 animate-pulse" />
          
          <div className="relative z-10 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-white/20 backdrop-blur text-white border-0 gap-1">
                <Trophy className="h-3 w-3" />
                {t('archive.alHasad')}
              </Badge>
              <Badge className="bg-white/20 backdrop-blur text-white border-0">
                {eventYear}
              </Badge>
              {archivedEvent.category && (
                <Badge className="bg-white/20 backdrop-blur text-white border-0">
                  {getBilingualContent(archivedEvent.category, archivedEvent.categoryAr)}
                </Badge>
              )}
            </div>
            
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
              {getBilingualContent(archivedEvent.name, archivedEvent.nameAr)}
            </h1>
            
            <div className="flex flex-wrap gap-6 text-white/90">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span>{formatDateRange(archivedEvent.startDate, archivedEvent.endDate, archivedEvent.startTime, archivedEvent.endTime)}</span>
              </div>
              {archivedEvent.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  <span>{getBilingualContent(archivedEvent.location, archivedEvent.locationAr)}</span>
                </div>
              )}
              {archivedEvent.actualAttendees && (
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <span>{archivedEvent.actualAttendees.toLocaleString()} {t('archive.detail.attendees')}</span>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button 
                variant="secondary" 
                className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur gap-2"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" />
                {t('archive.actions.share')}
              </Button>
              {archivedEvent.url && (
                <Button 
                  variant="secondary" 
                  className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur gap-2"
                  asChild
                >
                  <a href={archivedEvent.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    {t('archive.detail.originalLink')}
                  </a>
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        {(archivedEvent.actualAttendees || archivedEvent.media?.length || archivedEvent.youtubeVideoIds?.length) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {archivedEvent.actualAttendees && (
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-0">
                <CardContent className="pt-6 text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {archivedEvent.actualAttendees.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {t('archive.fields.actualAttendees')}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {archivedEvent.media && archivedEvent.media.length > 0 && (
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-0">
                <CardContent className="pt-6 text-center">
                  <Image className="h-8 w-8 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {archivedEvent.media.length}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {t('archive.fields.photos')}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {archivedEvent.youtubeVideoIds && archivedEvent.youtubeVideoIds.length > 0 && (
              <Card className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border-0">
                <CardContent className="pt-6 text-center">
                  <Video className="h-8 w-8 mx-auto mb-2 text-red-600 dark:text-red-400" />
                  <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                    {archivedEvent.youtubeVideoIds.length}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {t('archive.fields.videos')}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {archivedEvent.organizers && (
              <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-0">
                <CardContent className="pt-6 text-center">
                  <Building className="h-8 w-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
                  <div className="text-sm font-medium text-green-600 dark:text-green-400 line-clamp-2">
                    {getBilingualContent(archivedEvent.organizers, archivedEvent.organizersAr)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {t('archive.detail.organizer')}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {/* Content Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full grid grid-cols-3 bg-muted/50 backdrop-blur">
              <TabsTrigger value="overview" className="gap-2">
                <Quote className="h-4 w-4" />
                <span className="hidden sm:inline">{t('archive.tabs.overview')}</span>
              </TabsTrigger>
              <TabsTrigger value="gallery" className="gap-2">
                <Image className="h-4 w-4" />
                <span className="hidden sm:inline">{t('archive.tabs.gallery')}</span>
              </TabsTrigger>
              <TabsTrigger value="videos" className="gap-2">
                <Video className="h-4 w-4" />
                <span className="hidden sm:inline">{t('archive.tabs.videos')}</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Description */}
              {(archivedEvent.description || archivedEvent.descriptionAr) && (
                <Card className="border-0 bg-card/50 backdrop-blur">
                  <CardContent className="pt-6">
                    <p className="text-lg leading-relaxed whitespace-pre-wrap">
                      {getBilingualContent(archivedEvent.description, archivedEvent.descriptionAr)}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Speakers */}
              {speakers.length > 0 && (
                <Card className="border-0 bg-gradient-to-r from-violet-500/10 to-purple-500/10 overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                      <Mic className="h-5 w-5" />
                      {t('archive.fields.speakers')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
                      {speakers.map((speaker) => (
                        <div
                          key={speaker.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-white/50 dark:bg-black/20"
                        >
                          <Avatar className="h-12 w-12 flex-shrink-0">
                            <AvatarImage
                              src={speaker.speakerProfilePictureThumbnailKey && speaker.contactId
                                ? `/api/contacts/profile-picture/${speaker.contactId}?thumbnail=true`
                                : undefined}
                              alt=""
                            />
                            <AvatarFallback className="bg-violet-500/10 text-violet-700 dark:text-violet-200">
                              {getSpeakerInitials(speaker) || <UserCircle className="h-5 w-5" />}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            {speaker.contactId ? (
                              <Link href={`/archive?speaker=${speaker.contactId}`} className="font-medium block truncate text-violet-700 dark:text-violet-200 hover:underline">
                                {getSpeakerDisplayName(speaker)}
                              </Link>
                            ) : (
                              <div className="font-medium truncate">{getSpeakerDisplayName(speaker)}</div>
                            )}
                            <div className="text-sm text-muted-foreground truncate">
                              {speaker.speakerPosition && (
                                <span>
                                  {isArabic && speaker.speakerPositionAr
                                    ? speaker.speakerPositionAr
                                    : speaker.speakerPosition}
                                </span>
                              )}
                              {speaker.speakerPosition && speaker.speakerOrganization && ' • '}
                              {speaker.speakerOrganization && (
                                <span>
                                  {isArabic && speaker.speakerOrganizationAr 
                                    ? speaker.speakerOrganizationAr 
                                    : speaker.speakerOrganization}
                                </span>
                              )}
                            </div>
                            {speaker.role && (
                              <Badge variant="secondary" className="mt-1.5 inline-block bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                                {isArabic && speaker.roleAr ? speaker.roleAr : speaker.role}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Highlights */}
              {(archivedEvent.highlights || archivedEvent.highlightsAr) && (
                <Card className="border-0 bg-gradient-to-r from-amber-500/10 to-orange-500/10 overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <Sparkles className="h-5 w-5" />
                      {t('archive.fields.highlights')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">
                      {getBilingualContent(archivedEvent.highlights, archivedEvent.highlightsAr)}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Impact */}
              {(archivedEvent.impact || archivedEvent.impactAr) && (
                <Card className="border-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Target className="h-5 w-5" />
                      {t('archive.fields.impact')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">
                      {getBilingualContent(archivedEvent.impact, archivedEvent.impactAr)}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Key Takeaways */}
              {(archivedEvent.keyTakeaways || archivedEvent.keyTakeawaysAr) && (
                <Card className="border-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <Lightbulb className="h-5 w-5" />
                      {t('archive.fields.keyTakeaways')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">
                      {getBilingualContent(archivedEvent.keyTakeaways, archivedEvent.keyTakeawaysAr)}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Gallery Tab */}
            <TabsContent value="gallery" className="mt-6">
              {archivedEvent.media && archivedEvent.media.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {archivedEvent.media.map((media, index) => (
                    <motion.div
                      key={media.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="aspect-square relative group cursor-pointer"
                      onClick={() => openLightbox(index)}
                    >
                      {media.thumbnailUrl ? (
                        <>
                          <img
                            src={media.thumbnailUrl}
                            alt={media.caption || media.originalFileName}
                            className="w-full h-full object-cover rounded-xl transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-end p-4">
                            <span className="text-white text-sm font-medium">
                              {t('archive.detail.view')}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full bg-muted rounded-xl flex items-center justify-center">
                          <Image className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
                    <Image className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground">
                    {t('archive.detail.noPhotosForEvent')}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Videos Tab */}
            <TabsContent value="videos" className="mt-6">
              {archivedEvent.youtubeVideoIds && archivedEvent.youtubeVideoIds.length > 0 ? (
                <div className="grid gap-8">
                  {archivedEvent.youtubeVideoIds.map((videoId, idx) => {
                    const id = extractYoutubeId(videoId);
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="aspect-video relative rounded-2xl overflow-hidden shadow-2xl"
                      >
                        <iframe
                          src={`https://www.youtube.com/embed/${id}`}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title={`Video ${idx + 1}`}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
                    <Play className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground">
                    {t('archive.detail.noVideosForEvent')}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Related Events Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="pt-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">
              {t('archive.detail.exploreMore')}
            </h2>
            <Link href="/archive">
              <Button variant="ghost" className="gap-2">
                {t('archive.detail.viewAll')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-0">
            <CardContent className="py-12 text-center">
              <Archive className="h-12 w-12 mx-auto mb-4 text-amber-600 dark:text-amber-400" />
              <p className="text-lg font-medium mb-2">
                {t('archive.detail.discoverMore')}
              </p>
              <p className="text-muted-foreground mb-6">
                {isArabic 
                  ? 'تصفح مجموعتنا الكاملة من الفعاليات السابقة والإنجازات'
                  : 'Browse our complete collection of past events and achievements'
                }
              </p>
              <Link href="/archive">
                <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white gap-2">
                  <Archive className="h-4 w-4" />
                  {t('archive.detail.browseArchive')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
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
