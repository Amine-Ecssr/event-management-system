import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronsUpDown,
  X,
  Mic,
  UserCircle,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Contact, ArchivedEventSpeaker } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ArchivedEventSpeakersManagerProps {
  archivedEventId: number;
  disabled?: boolean;
}

const SPEAKER_ROLES = [
  { value: 'keynote', labelEn: 'Keynote Speaker', labelAr: 'المتحدث الرئيسي' },
  { value: 'panelist', labelEn: 'Panelist', labelAr: 'عضو لجنة' },
  { value: 'moderator', labelEn: 'Moderator', labelAr: 'مدير الجلسة' },
  { value: 'speaker', labelEn: 'Speaker', labelAr: 'متحدث' },
  { value: 'presenter', labelEn: 'Presenter', labelAr: 'مقدم' },
];

export default function ArchivedEventSpeakersManager({
  archivedEventId,
  disabled = false,
}: ArchivedEventSpeakersManagerProps) {
  const { t, i18n } = useTranslation(['speakers', 'common']);
  const { toast } = useToast();
  const isArabic = i18n.language === 'ar';
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('speaker');

  // Fetch current speakers for this archived event
  const { data: currentSpeakers = [], isLoading: loadingSpeakers } = useQuery<ArchivedEventSpeaker[]>({
    queryKey: ['/api/archive', archivedEventId, 'speakers'],
    queryFn: async () => {
      const response = await fetch(`/api/archive/${archivedEventId}/speakers`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch speakers');
      return response.json();
    },
    enabled: !!archivedEventId,
    staleTime: 0,
  });

  // Fetch eligible speakers (contacts)
  const { data: eligibleSpeakers = [], isLoading: loadingContacts } = useQuery<Contact[]>({
    queryKey: ['/api/contacts/speakers'],
    queryFn: async () => {
      const response = await fetch('/api/contacts/speakers', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch speakers');
      return response.json();
    },
  });

  // Add speaker mutation
  const addSpeakerMutation = useMutation({
    mutationFn: async (data: { contactId: number; role: string; roleAr: string; displayOrder: number }) => {
      return await apiRequest('POST', `/api/archive/${archivedEventId}/speakers`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/archive', archivedEventId, 'speakers'] });
      toast({
        title: t('speakers:speakerAdded'),
      });
    },
    onError: () => {
      toast({
        title: t('speakers:failedToAddSpeaker'),
        variant: 'destructive',
      });
    },
  });

  // Remove speaker mutation
  const removeSpeakerMutation = useMutation({
    mutationFn: async (speakerId: number) => {
      return await apiRequest('DELETE', `/api/archive/${archivedEventId}/speakers/${speakerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/archive', archivedEventId, 'speakers'] });
      toast({
        title: t('speakers:speakerRemoved'),
      });
    },
    onError: () => {
      toast({
        title: t('speakers:failedToRemoveSpeaker'),
        variant: 'destructive',
      });
    },
  });

  // Filter out already selected speakers
  const availableSpeakers = eligibleSpeakers.filter(
    (contact) => !currentSpeakers.some((s) => s.contactId === contact.id)
  );

  const handleAddSpeaker = (contact: Contact) => {
    const role = SPEAKER_ROLES.find((r) => r.value === selectedRole);
    addSpeakerMutation.mutate({
      contactId: contact.id,
      role: role?.labelEn || 'Speaker',
      roleAr: role?.labelAr || 'متحدث',
      displayOrder: currentSpeakers.length,
    });
    setOpen(false);
  };

  const handleRemoveSpeaker = (speakerId: number) => {
    removeSpeakerMutation.mutate(speakerId);
  };

  const getRoleDisplay = (speaker: ArchivedEventSpeaker) => {
    const role = SPEAKER_ROLES.find(
      (r) => r.labelEn === speaker.role || r.value === speaker.role?.toLowerCase()
    );
    if (role) {
      return isArabic ? role.labelAr : role.labelEn;
    }
    return isArabic ? (speaker.roleAr || speaker.role) : (speaker.role || t('speakers:roles.speaker'));
  };

  const getSpeakerDisplayName = (speaker: ArchivedEventSpeaker) => {
    return isArabic 
      ? (speaker.speakerNameAr || speaker.speakerNameEn || 'Unknown')
      : (speaker.speakerNameEn || speaker.speakerNameAr || 'Unknown');
  };

  const getSpeakerDetails = (speaker: ArchivedEventSpeaker) => {
    const position = isArabic 
      ? (speaker.speakerPositionAr || speaker.speakerPosition)
      : (speaker.speakerPosition || speaker.speakerPositionAr);
    const organization = isArabic
      ? (speaker.speakerOrganizationAr || speaker.speakerOrganization)
      : (speaker.speakerOrganization || speaker.speakerOrganizationAr);
    
    const parts = [position, organization].filter(Boolean);
    return parts.join(' • ');
  };

  if (loadingSpeakers) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Label className="flex items-center gap-2">
        <Mic className="h-4 w-4" />
        {t('speakers:title')}
        {currentSpeakers.length > 0 && (
          <Badge variant="secondary">{currentSpeakers.length}</Badge>
        )}
      </Label>

      {/* Current Speakers List */}
      {currentSpeakers.length > 0 && (
        <div className="space-y-2">
          {currentSpeakers.map((speaker) => (
            <div
              key={speaker.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex-shrink-0">
                  {speaker.speakerProfilePictureThumbnailKey ? (
                    <img
                      src={`/api/contacts/profile-picture/${speaker.contactId}?thumbnail=true`}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <UserCircle className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {getSpeakerDisplayName(speaker)}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {getSpeakerDetails(speaker)}
                  </div>
                </div>
                <Badge variant="outline" className="flex-shrink-0">
                  {getRoleDisplay(speaker)}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0 ml-2 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemoveSpeaker(speaker.id)}
                disabled={disabled || removeSpeakerMutation.isPending}
              >
                {removeSpeakerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Speaker Section */}
      {!disabled && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label className="text-sm text-muted-foreground mb-1 block">
              {t('speakers:addSpeaker')}
            </Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                  disabled={loadingContacts || addSpeakerMutation.isPending}
                >
                  {loadingContacts ? (
                    <span className="text-muted-foreground">
                      {t('speakers:loading')}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t('speakers:selectSpeaker')}
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput 
                    placeholder={t('speakers:searchContacts')} 
                  />
                  <CommandList>
                    <CommandEmpty>
                      {t('speakers:noSpeakersFound')}
                    </CommandEmpty>
                    <CommandGroup>
                      {availableSpeakers.map((contact) => (
                        <CommandItem
                          key={contact.id}
                          value={`${contact.nameEn || ''} ${contact.nameAr || ''}`}
                          onSelect={() => handleAddSpeaker(contact)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          {contact.profilePictureThumbnailKey ? (
                            <img
                              src={`/api/contacts/profile-picture/${contact.id}?thumbnail=true`}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <UserCircle className="h-8 w-8 text-muted-foreground" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {isArabic 
                                ? (contact.nameAr || contact.nameEn)
                                : (contact.nameEn || contact.nameAr)
                              }
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {isArabic
                                ? (contact.position?.nameAr || contact.position?.nameEn)
                                : (contact.position?.nameEn || contact.position?.nameAr)
                              }
                              {contact.organization && (
                                <>
                                  {' • '}
                                  {isArabic
                                    ? (contact.organization.nameAr || contact.organization.nameEn)
                                    : (contact.organization.nameEn || contact.organization.nameAr)
                                  }
                                </>
                              )}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="w-40">
            <Label className="text-sm text-muted-foreground mb-1 block">
              {t('speakers:role')}
            </Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEAKER_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {isArabic ? role.labelAr : role.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {availableSpeakers.length === 0 && !loadingContacts && (
        <p className="text-sm text-muted-foreground">
          {currentSpeakers.length > 0
            ? t('speakers:allSpeakersAdded')
            : t('speakers:noSpeakersAvailable')
          }
        </p>
      )}
    </div>
  );
}
