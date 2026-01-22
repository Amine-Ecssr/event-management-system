import { useState, useEffect } from 'react';
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
  GripVertical,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Contact, EventSpeaker } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SelectedSpeaker {
  contactId: number;
  contact: Contact;
  role?: string;
  roleAr?: string;
  displayOrder: number;
}

interface EventSpeakersManagerProps {
  eventId?: string; // If provided, speakers are saved directly to the event via API
  selectedSpeakers: SelectedSpeaker[];
  onSpeakersChange: (speakers: SelectedSpeaker[]) => void;
  disabled?: boolean;
}

const SPEAKER_ROLES = [
  { value: 'keynote', labelEn: 'Keynote Speaker', labelAr: 'المتحدث الرئيسي' },
  { value: 'panelist', labelEn: 'Panelist', labelAr: 'عضو لجنة' },
  { value: 'moderator', labelEn: 'Moderator', labelAr: 'مدير الجلسة' },
  { value: 'speaker', labelEn: 'Speaker', labelAr: 'متحدث' },
  { value: 'presenter', labelEn: 'Presenter', labelAr: 'مقدم' },
];

export default function EventSpeakersManager({
  eventId,
  selectedSpeakers,
  onSpeakersChange,
  disabled = false,
}: EventSpeakersManagerProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isArabic = i18n.language === 'ar';
  const [open, setOpen] = useState(false);

  // Fetch eligible speakers
  const { data: eligibleSpeakers = [], isLoading } = useQuery<Contact[]>({
    queryKey: ['/api/contacts/speakers'],
    queryFn: async () => {
      const response = await fetch('/api/contacts/speakers', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch eligible speakers');
      return response.json();
    },
  });

  // Get speaker display name
  const getSpeakerDisplayName = (contact: Contact) => {
    const name = isArabic && contact.nameAr ? contact.nameAr : contact.nameEn;
    const title = isArabic && contact.titleAr ? contact.titleAr : contact.title;
    return title ? `${title} ${name}` : name;
  };

  // Get speaker info line (position + organization)
  const getSpeakerInfo = (contact: Contact) => {
    const parts: string[] = [];
    if (contact.position) {
      parts.push(isArabic && contact.position.nameAr ? contact.position.nameAr : contact.position.nameEn);
    }
    if (contact.organization) {
      parts.push(isArabic && contact.organization.nameAr ? contact.organization.nameAr : contact.organization.nameEn);
    }
    return parts.join(' • ');
  };

  // Add speaker
  const addSpeaker = (contact: Contact) => {
    if (selectedSpeakers.find(s => s.contactId === contact.id)) {
      return; // Already added
    }
    const newSpeaker: SelectedSpeaker = {
      contactId: contact.id,
      contact,
      role: undefined,
      roleAr: undefined,
      displayOrder: selectedSpeakers.length,
    };
    onSpeakersChange([...selectedSpeakers, newSpeaker]);
    setOpen(false);
  };

  // Remove speaker
  const removeSpeaker = (contactId: number) => {
    const updated = selectedSpeakers
      .filter(s => s.contactId !== contactId)
      .map((s, idx) => ({ ...s, displayOrder: idx }));
    onSpeakersChange(updated);
  };

  // Update speaker role
  const updateSpeakerRole = (contactId: number, role: string) => {
    const roleInfo = SPEAKER_ROLES.find(r => r.value === role);
    const updated = selectedSpeakers.map(s => {
      if (s.contactId === contactId) {
        return {
          ...s,
          role: roleInfo?.labelEn || role,
          roleAr: roleInfo?.labelAr || undefined,
        };
      }
      return s;
    });
    onSpeakersChange(updated);
  };

  // Filter out already selected speakers from the dropdown
  const availableSpeakers = eligibleSpeakers.filter(
    speaker => !selectedSpeakers.find(s => s.contactId === speaker.id)
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Mic className="h-4 w-4" />
          {t('speakers.title')}
        </Label>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Mic className="h-4 w-4" />
          {t('speakers.title')}
        </Label>
        {eligibleSpeakers.length === 0 && (
          <span className="text-xs text-muted-foreground">
            {t('speakers.noEligibleSpeakers')}
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {t('speakers.description')}
      </p>

      {/* Speaker selector dropdown */}
      {availableSpeakers.length > 0 && !disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
              data-testid="button-add-speaker"
            >
              <span className="text-muted-foreground">
                {t('speakers.addSpeaker')}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder={t('speakers.searchSpeakers')} />
              <CommandList>
                <CommandEmpty>{t('speakers.noSpeakersFound')}</CommandEmpty>
                <CommandGroup>
                  {availableSpeakers.map((speaker) => (
                    <CommandItem
                      key={speaker.id}
                      value={`${speaker.nameEn} ${speaker.nameAr || ''} ${speaker.organization?.nameEn || ''}`}
                      onSelect={() => addSpeaker(speaker)}
                      className="flex items-center gap-3 p-2"
                    >
                      <UserCircle className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {getSpeakerDisplayName(speaker)}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {getSpeakerInfo(speaker)}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {/* Selected speakers list */}
      {selectedSpeakers.length > 0 && (
        <div className="space-y-2">
          {selectedSpeakers.map((speaker, index) => (
            <div
              key={speaker.contactId}
              className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
              data-testid={`speaker-item-${speaker.contactId}`}
            >
              <div className="flex-shrink-0 text-muted-foreground">
                <GripVertical className="h-4 w-4" />
              </div>
              <UserCircle className="h-10 w-10 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {getSpeakerDisplayName(speaker.contact)}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {getSpeakerInfo(speaker.contact)}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Select
                  value={speaker.role ? SPEAKER_ROLES.find(r => r.labelEn === speaker.role)?.value || 'custom' : ''}
                  onValueChange={(value) => updateSpeakerRole(speaker.contactId, value)}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-[140px] h-8 text-xs" data-testid={`select-speaker-role-${speaker.contactId}`}>
                    <SelectValue placeholder={t('speakers.selectRole')} />
                  </SelectTrigger>
                  <SelectContent>
                    {SPEAKER_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {isArabic ? role.labelAr : role.labelEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!disabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => removeSpeaker(speaker.contactId)}
                    data-testid={`button-remove-speaker-${speaker.contactId}`}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">{t('common.remove')}</span>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {selectedSpeakers.length === 0 && eligibleSpeakers.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">
          {t('speakers.noSpeakersSelected')}
        </p>
      )}

      {/* No eligible speakers message */}
      {eligibleSpeakers.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">
          {t('speakers.noEligibleSpeakersHint')}
        </p>
      )}
    </div>
  );
}
