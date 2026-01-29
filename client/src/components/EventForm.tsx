import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { insertEventSchema } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Image, Upload, Trash2, Eye, X } from 'lucide-react';
import { Event, Category, Contact, EventSpeaker, EventMedia } from '@/lib/types';
import EventSpeakersManager from '@/components/EventSpeakersManager';
import { PrerequisiteConfirmDialog } from '@/components/workflows/PrerequisiteConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { canEditEvents, isReadOnly } from '@/lib/roles';
import { useAuth } from '@/hooks/use-auth';

interface StakeholderEmail {
  id: number;
  email: string;
  label: string | null;
  isPrimary: boolean;
}

interface StakeholderRequirement {
  id: number;
  title: string;
  titleAr?: string | null;
  description: string | null;
  descriptionAr?: string | null;
  isDefault: boolean;
}

interface Stakeholder {
  id: number;
  name: string;
  nameAr?: string | null;
  active: boolean;
  emails: StakeholderEmail[];
  requirements: StakeholderRequirement[];
}

// Create a frontend-friendly schema with camelCase fields
const eventFormSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  nameAr: z.string().optional(), // Arabic name (optional)
  description: z.string().optional(), // Description is now optional
  descriptionAr: z.string().optional(), // Arabic description (optional)
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Start time must be in HH:MM format (00:00 to 23:59)").optional().or(z.literal('')),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "End time must be in HH:MM format (00:00 to 23:59)").optional().or(z.literal('')),
  location: z.string().optional(), // Location is now optional
  locationAr: z.string().optional(), // Arabic location (optional)
  organizers: z.string().optional(),
  organizersAr: z.string().optional(), // Arabic organizers (optional)
  url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  categoryId: z.coerce.number().int().positive().optional().or(z.literal('')), // New: FK to categories
  eventType: z.enum(['local', 'international']),
  eventScope: z.enum(['internal', 'external']),
  expectedAttendance: z.coerce.number().int().positive().optional().or(z.literal('')),
  reminder1Week: z.boolean().optional(),
  reminder1Day: z.boolean().optional(),
  reminderWeekly: z.boolean().optional(),
  reminderDaily: z.boolean().optional(),
  reminderMorningOf: z.boolean().optional(),
}).refine(
  (data) => {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    return endDate >= startDate;
  },
  {
    message: "End date must be on or after start date",
    path: ["endDate"],
  }
).refine(
  (data) => {
    // If dates are the same and both times are provided, validate end time > start time
    if (data.startDate === data.endDate && data.startTime && data.endTime && data.startTime.trim() && data.endTime.trim()) {
      return data.endTime > data.startTime;
    }
    return true;
  },
  {
    message: "End time must be after start time for same-day events",
    path: ["endTime"],
  }
);

type EventFormData = z.infer<typeof eventFormSchema>;

interface EventFormProps {
  event?: Event;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function EventForm({ event, onSubmit, onCancel, isSubmitting = false }: EventFormProps) {
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const { toast } = useToast();
  const isArabic = i18n.language === 'ar' || language === 'ar';
  const [selectedStakeholders, setSelectedStakeholders] = useState<number[]>([]);
  const [stakeholderRequirements, setStakeholderRequirements] = useState<Record<number, string[]>>({});
  const [customRequirements, setCustomRequirements] = useState<Record<number, string>>({});
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategoryEn, setCustomCategoryEn] = useState('');
  const [customCategoryAr, setCustomCategoryAr] = useState('');
  const [agendaEnFile, setAgendaEnFile] = useState<File | null>(null);
  const [agendaArFile, setAgendaArFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const { user } = useAuth();
  const canEdit = canEditEvents(user?.role);
  const readOnly = isReadOnly(user?.role);

  // Media state for live updates
  const [currentMedia, setCurrentMedia] = useState<EventMedia[]>(event?.media || []);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Update media when event prop changes
  useEffect(() => {
    setCurrentMedia(event?.media || []);
  }, [event?.media]);
  
  // Prerequisite confirmation dialog state
  interface PrerequisiteTemplate {
    id: number;
    title: string;
    titleAr?: string | null;
    stakeholderId: number;
    stakeholderName?: string;
    stakeholderNameAr?: string | null;
  }
  const [showPrereqDialog, setShowPrereqDialog] = useState(false);
  const [pendingPrereqAction, setPendingPrereqAction] = useState<{
    stakeholderId: number;
    requirementId: number;
    requirementName: string;
    prerequisites: PrerequisiteTemplate[];
    // For department selection with default tasks that have prerequisites
    isDepartmentSelection?: boolean;
    defaultRequirementIds?: number[];
    allRequiredTemplates?: PrerequisiteTemplate[];
  } | null>(null);
  
  // Speakers state
  interface SelectedSpeaker {
    contactId: number;
    contact: Contact;
    role?: string;
    roleAr?: string;
    displayOrder: number;
  }
  const [selectedSpeakers, setSelectedSpeakers] = useState<SelectedSpeaker[]>([]);
  
  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: event?.name || '',
      nameAr: (event as any)?.nameAr || '',
      description: event?.description || '',
      descriptionAr: (event as any)?.descriptionAr || '',
      startDate: event?.startDate || '',
      endDate: event?.endDate || '',
      startTime: event?.startTime || '',
      endTime: event?.endTime || '',
      location: event?.location || '',
      locationAr: (event as any)?.locationAr || '',
      organizers: event?.organizers || '',
      organizersAr: (event as any)?.organizersAr || '',
      url: event?.url || '',
      categoryId: event?.categoryId || '',
      eventType: event?.eventType || 'local',
      eventScope: event?.eventScope || 'external',
      expectedAttendance: event?.expectedAttendance || '',
      reminder1Week: event?.reminder1Week ?? true,
      reminder1Day: event?.reminder1Day ?? true,
      reminderWeekly: event?.reminderWeekly ?? false,
      reminderDaily: event?.reminderDaily ?? false,
      reminderMorningOf: event?.reminderMorningOf ?? false,
    },
  });

  const { data: stakeholders = [] } = useQuery<Stakeholder[]>({
    queryKey: ['/api/stakeholders'],
  });

  // Fetch categories from the API
  const { data: categories = [], refetch: refetchCategories } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    queryFn: async () => {
      return await apiRequest<Category[]>('GET', '/api/categories');
    },
  });
  
  // Initialize custom category state if event has a category not in the list
  useEffect(() => {
    if (event?.categoryId) {
      // Categories are now properly loaded from the database
      // No need for custom category fallback logic
    }
  }, [event?.categoryId, categories]);

  // Load existing stakeholder assignments when editing an event
  const { data: eventStakeholders = [] } = useQuery<any[]>({
    queryKey: [`/api/events/${event?.id}/stakeholders`],
    enabled: !!event?.id,
  });

  // Load existing speakers when editing an event
  const { data: existingEventSpeakers = [] } = useQuery<EventSpeaker[]>({
    queryKey: [`/api/events/${event?.id}/speakers`],
    queryFn: async () => {
      const response = await fetch(`/api/events/${event?.id}/speakers`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch event speakers');
      return response.json();
    },
    enabled: !!event?.id,
    staleTime: 0, // Always refetch to get the latest speakers
  });

  // Initialize stakeholder state from existing event data
  useEffect(() => {
    if (event?.id && eventStakeholders && eventStakeholders.length > 0) {
      const stakeholderIds: number[] = [];
      const requirements: Record<number, string[]> = {};
      const custom: Record<number, string> = {};

      eventStakeholders.forEach((es: any) => {
        const stakeholderId = Number(es.stakeholderId);
        stakeholderIds.push(stakeholderId);
        if (es.selectedRequirementIds) {
          requirements[stakeholderId] = es.selectedRequirementIds.map((id: number) => id.toString());
        }
        if (es.customRequirements) {
          custom[stakeholderId] = es.customRequirements;
        }
      });

      setSelectedStakeholders(stakeholderIds);
      setStakeholderRequirements(requirements);
      setCustomRequirements(custom);
    }
  }, [event?.id, eventStakeholders]);

  // Initialize speakers state from existing event data
  useEffect(() => {
    if (event?.id && existingEventSpeakers) {
      if (existingEventSpeakers.length > 0) {
        const speakers = existingEventSpeakers.map((es: EventSpeaker) => ({
          contactId: es.contactId,
          contact: es.contact,
          role: es.role || undefined,
          roleAr: es.roleAr || undefined,
          displayOrder: es.displayOrder,
        }));
        setSelectedSpeakers(speakers);
      } else {
        // Reset to empty if the event has no speakers
        setSelectedSpeakers([]);
      }
    }
  }, [event?.id, existingEventSpeakers]);

  // Reset state when event changes (for creating new events)
  useEffect(() => {
    setAgendaEnFile(null);
    setAgendaArFile(null);
    setPhotoFiles([]);
    // Reset speakers when creating a new event (no event id)
    if (!event?.id) {
      setSelectedSpeakers([]);
    }
  }, [event?.id]);

  const toggleStakeholder = async (stakeholderId: number) => {
    if (selectedStakeholders.includes(stakeholderId)) {
      // Unselecting - just remove it
      setSelectedStakeholders(prev => prev.filter(id => id !== stakeholderId));
      return;
    }
    
    // Selecting - add the stakeholder
    const stakeholder = stakeholders.find(s => s.id === stakeholderId);
    if (!stakeholder) {
      setSelectedStakeholders(prev => [...prev, stakeholderId]);
      return;
    }
    
    const defaultRequirements = stakeholder.requirements.filter(r => r.isDefault);
    
    if (defaultRequirements.length === 0) {
      // No default requirements - just add the stakeholder
      setSelectedStakeholders(prev => [...prev, stakeholderId]);
      return;
    }
    
    // Check if any default requirements have prerequisites
    const defaultReqIds = defaultRequirements.map(r => r.id);
    
    try {
      const prereqs = await apiRequest(
        'POST',
        '/api/task-templates/resolve-prerequisites',
        { selectedTemplateIds: defaultReqIds }
      );
      
      // Add the stakeholder first
      setSelectedStakeholders(prev => [...prev, stakeholderId]);
      
      if (prereqs.allTemplates && prereqs.allTemplates.length > defaultReqIds.length) {
        // Has prerequisites beyond the defaults - add all required templates
        const allRequiredIds = new Set<string>();
        const stakeholderReqUpdates: Record<number, string[]> = {};
        
        // Add all templates (both selected defaults and their prerequisites)
        for (const template of prereqs.allTemplates) {
          allRequiredIds.add(template.id.toString());
          
          // Find which stakeholder owns this template
          const ownerStakeholder = stakeholders.find(s => 
            s.requirements.some(r => r.id === template.id)
          );
          
          if (ownerStakeholder) {
            // Make sure the owner stakeholder is selected
            if (!selectedStakeholders.includes(ownerStakeholder.id) && ownerStakeholder.id !== stakeholderId) {
              setSelectedStakeholders(prev => 
                prev.includes(ownerStakeholder.id) ? prev : [...prev, ownerStakeholder.id]
              );
            }
            
            // Add to that stakeholder's requirements
            if (!stakeholderReqUpdates[ownerStakeholder.id]) {
              stakeholderReqUpdates[ownerStakeholder.id] = [];
            }
            if (!stakeholderReqUpdates[ownerStakeholder.id].includes(template.id.toString())) {
              stakeholderReqUpdates[ownerStakeholder.id].push(template.id.toString());
            }
          }
        }
        
        // Update all stakeholder requirements at once
        setStakeholderRequirements(prev => {
          const updated = { ...prev };
          for (const [sId, reqIds] of Object.entries(stakeholderReqUpdates)) {
            const existing = updated[parseInt(sId)] || [];
            const combined = Array.from(new Set([...existing, ...reqIds]));
            updated[parseInt(sId)] = combined;
          }
          return updated;
        });
      } else {
        // No additional prerequisites - just add the default requirements
        setStakeholderRequirements(prev => ({
          ...prev,
          [stakeholderId]: defaultReqIds.map(id => id.toString())
        }));
      }
    } catch (error) {
      console.error('Error checking prerequisites for default tasks:', error);
      // Fallback: just add the stakeholder with defaults
      setSelectedStakeholders(prev => [...prev, stakeholderId]);
      setStakeholderRequirements(prev => ({
        ...prev,
        [stakeholderId]: defaultReqIds.map(id => id.toString())
      }));
    }
  };

  const toggleRequirement = async (stakeholderId: number, requirementId: number) => {
    const reqIdStr = requirementId.toString();
    const current = stakeholderRequirements[stakeholderId] || [];
    
    if (current.includes(reqIdStr)) {
      // Unselecting - just remove it
      setStakeholderRequirements(prev => ({
        ...prev,
        [stakeholderId]: current.filter(id => id !== reqIdStr)
      }));
    } else {
      // Selecting - check for prerequisites first
      try {
        const prereqs = await apiRequest(
          'POST',
          '/api/task-templates/resolve-prerequisites',
          { selectedTemplateIds: [requirementId] }
        );
        
        if (prereqs.allTemplates && prereqs.allTemplates.length > 1) {
          // Has prerequisites - get their info and show dialog
          const stakeholder = stakeholders.find(s => s.id === stakeholderId);
          const requirement = stakeholder?.requirements.find(r => r.id === requirementId);
          
          // Filter out the selected requirement from prerequisites list
          const prerequisiteTemplates = prereqs.allTemplates
            .filter((t: any) => t.id !== requirementId)
            .map((t: any) => {
              const prereqStakeholder = stakeholders.find(s => 
                s.requirements.some(r => r.id === t.id)
              );
              return {
                id: t.id,
                title: t.title,
                titleAr: t.titleAr,
                stakeholderId: prereqStakeholder?.id || 0,
                stakeholderName: prereqStakeholder?.name,
                stakeholderNameAr: prereqStakeholder?.nameAr,
              };
            });
          
          setPendingPrereqAction({
            stakeholderId,
            requirementId,
            requirementName: (isArabic && requirement?.titleAr) ? requirement.titleAr : requirement?.title || '',
            prerequisites: prerequisiteTemplates,
          });
          setShowPrereqDialog(true);
        } else {
          // No prerequisites - just add it
          setStakeholderRequirements(prev => ({
            ...prev,
            [stakeholderId]: [...current, reqIdStr]
          }));
        }
      } catch (error) {
        console.error('Error checking prerequisites:', error);
        // Fallback: just add the requirement
        setStakeholderRequirements(prev => ({
          ...prev,
          [stakeholderId]: [...current, reqIdStr]
        }));
      }
    }
  };

  // Handle prerequisite confirmation
  const handlePrereqConfirm = () => {
    if (!pendingPrereqAction) return;
    
    const { stakeholderId, requirementId, prerequisites } = pendingPrereqAction;
    
    // Add the selected requirement and all its prerequisites
    setStakeholderRequirements(prev => {
      const current = prev[stakeholderId] || [];
      const toAdd = new Set([...current, requirementId.toString()]);
      
      // Add prerequisites (may need to add stakeholders and their requirements)
      prerequisites.forEach(prereq => {
        toAdd.add(prereq.id.toString());
        
        // Make sure the prerequisite's stakeholder is selected
        if (prereq.stakeholderId && !selectedStakeholders.includes(prereq.stakeholderId)) {
          setSelectedStakeholders(prev => [...prev, prereq.stakeholderId]);
        }
      });
      
      return {
        ...prev,
        [stakeholderId]: Array.from(toAdd)
      };
    });
    
    // For cross-department prerequisites, add them to their respective stakeholders
    prerequisites.forEach(prereq => {
      if (prereq.stakeholderId && prereq.stakeholderId !== stakeholderId) {
        setStakeholderRequirements(prev => {
          const deptCurrent = prev[prereq.stakeholderId] || [];
          if (!deptCurrent.includes(prereq.id.toString())) {
            return {
              ...prev,
              [prereq.stakeholderId]: [...deptCurrent, prereq.id.toString()]
            };
          }
          return prev;
        });
      }
    });
    
    setPendingPrereqAction(null);
  };

  // Handle prerequisite cancellation (just add the selected requirement without prerequisites)
  const handlePrereqCancel = () => {
    if (!pendingPrereqAction) return;
    
    const { stakeholderId, requirementId } = pendingPrereqAction;
    const current = stakeholderRequirements[stakeholderId] || [];
    
    setStakeholderRequirements(prev => ({
      ...prev,
      [stakeholderId]: [...current, requirementId.toString()]
    }));
    
    setPendingPrereqAction(null);
  };

  const setCustomRequirement = (stakeholderId: number, text: string) => {
    setCustomRequirements(prev => ({
      ...prev,
      [stakeholderId]: text
    }));
  };

  const handleSubmit = (data: EventFormData) => {
    const apiData: any = {
      name: data.name,
      nameAr: data.nameAr || undefined,
      description: data.description || undefined,
      descriptionAr: data.descriptionAr || undefined,
      startDate: data.startDate,
      endDate: data.endDate,
      startTime: data.startTime || undefined,
      endTime: data.endTime || undefined,
      location: data.location || undefined,
      locationAr: data.locationAr || undefined,
      organizers: data.organizers || undefined,
      organizersAr: data.organizersAr || undefined,
      url: data.url || undefined,
      categoryId: data.categoryId || undefined,
      eventType: data.eventType,
      eventScope: data.eventScope,
      expectedAttendance: data.expectedAttendance || undefined,
      reminder1Week: data.reminder1Week ?? true,
      reminder1Day: data.reminder1Day ?? true,
      reminderWeekly: data.reminderWeekly ?? false,
      reminderDaily: data.reminderDaily ?? false,
      reminderMorningOf: data.reminderMorningOf ?? false,
    };

    let stakeholderPayload: any[] | undefined;
    if (selectedStakeholders.length > 0) {
      stakeholderPayload = selectedStakeholders.map(stakeholderId => ({
        stakeholderId: Number(stakeholderId),
        selectedRequirementIds: (stakeholderRequirements[stakeholderId] || []).map(id => parseInt(id, 10)),
        customRequirements: customRequirements[stakeholderId] || '',
        notifyOnCreate: !event,
        notifyOnUpdate: !!event,
      }));
    }

    // Prepare speakers payload - always include when editing (even empty array to remove all speakers)
    const speakersPayload = selectedSpeakers.map((speaker, index) => ({
      contactId: speaker.contactId,
      role: speaker.role || null,
      roleAr: speaker.roleAr || null,
      displayOrder: index,
    }));

    const formData = new FormData();
    Object.entries(apiData).forEach(([key, value]) => {
      if (value === undefined || value === '') return;
      formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    });

    if (stakeholderPayload) {
      formData.append('stakeholders', JSON.stringify(stakeholderPayload));
    }

    // Always send speakers array when editing an event (to allow removing all speakers)
    if (event?.id || speakersPayload.length > 0) {
      formData.append('speakers', JSON.stringify(speakersPayload));
    }

    if (agendaEnFile) {
      formData.append('agendaEn', agendaEnFile);
    }
    if (agendaArFile) {
      formData.append('agendaAr', agendaArFile);
    }
    
    // Append photo files
    if (photoFiles.length > 0) {
      photoFiles.forEach(file => {
        formData.append('photos', file);
      });
    }

    console.log('EventForm - Submitting data:', {
      hasStakeholders: !!stakeholderPayload,
      stakeholdersCount: stakeholderPayload?.length || 0,
      stakeholders: stakeholderPayload,
      speakersCount: speakersPayload.length,
      speakers: speakersPayload,
      hasAgendaEn: !!agendaEnFile,
      hasAgendaAr: !!agendaArFile,
    });

    onSubmit(formData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>{t('events.fields.name')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('events.placeholders.enterEventName')}
                    data-testid="input-event-name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="nameAr"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>{t('events.fields.nameAr')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('events.placeholders.enterEventNameAr')}
                    data-testid="input-event-name-ar"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('events.fields.startDate')}</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    data-testid="input-startDate"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('events.fields.startTime')}</FormLabel>
                <FormControl>
                  <Input
                    type="time"
                    data-testid="input-startTime"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <FormDescription className="text-xs">
                  {t('events.timeFormatHint')}
                </FormDescription>
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('events.fields.endDate')}</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    data-testid="input-endDate"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('events.fields.endTime')}</FormLabel>
                <FormControl>
                  <Input
                    type="time"
                    data-testid="input-endTime"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <FormDescription className="text-xs">
                  {t('events.timeFormatHint')}
                </FormDescription>
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('events.fields.location')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('events.placeholders.enterLocation')}
                    data-testid="input-location"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="locationAr"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('events.fields.locationAr')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('events.placeholders.enterLocationAr')}
                    data-testid="input-location-ar"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="organizers"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('events.fields.organizers')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('events.placeholders.enterOrganizers')}
                    data-testid="input-organizers"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="organizersAr"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('events.fields.organizersAr')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('events.placeholders.enterOrganizersAr')}
                    data-testid="input-organizers-ar"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('events.fields.category')}
                </FormLabel>
                {!showCustomCategory ? (
                  <Select
                    onValueChange={(value) => {
                      if (value === '__custom__') {
                        setShowCustomCategory(true);
                        setCustomCategoryEn('');
                        setCustomCategoryAr('');
                        field.onChange('');
                      } else {
                        field.onChange(value ? Number(value) : '');
                      }
                    }}
                    value={field.value ? String(field.value) : ''}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder={t('events.placeholders.selectCategory')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map(cat => (
                          <SelectItem key={cat.id} value={String(cat.id)} data-testid={`option-category-${cat.id}`}>
                            {isArabic ? cat.nameAr || cat.nameEn : cat.nameEn}
                          </SelectItem>
                        ))}
                      <SelectItem value="__custom__" data-testid="option-category-custom">
                        + {t('events.categoryForm.addNewCategory')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="custom-category-en">{t('events.categoryForm.categoryNameEn')} *</Label>
                      <Input
                        id="custom-category-en"
                        placeholder={t('events.placeholders.enterCategoryNameEn')}
                        value={customCategoryEn}
                        onChange={(e) => setCustomCategoryEn(e.target.value)}
                        data-testid="input-custom-category-en"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom-category-ar">{t('events.categoryForm.categoryNameAr')} *</Label>
                      <Input
                        id="custom-category-ar"
                        placeholder={t('events.placeholders.enterCategoryNameAr')}
                        value={customCategoryAr}
                        onChange={(e) => setCustomCategoryAr(e.target.value)}
                        data-testid="input-custom-category-ar"
                        dir="rtl"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!customCategoryEn.trim() || !customCategoryAr.trim()) {
                            alert(t('events.categoryForm.enterBothNames'));
                            return;
                          }
                          
                          try {
                            // Create the new category via API
                            const response = await fetch('/api/categories', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                nameEn: customCategoryEn.trim(),
                                nameAr: customCategoryAr.trim(),
                              }),
                              credentials: 'include',
                            });
                            
                            if (!response.ok) {
                              throw new Error('Failed to create category');
                            }
                            
                            const newCategory = await response.json();
                            
                            // Refetch categories to update the list
                            await refetchCategories();
                            
                            // Set the newly created category
                            field.onChange(newCategory.id);
                            
                            // Reset custom category state
                            setShowCustomCategory(false);
                            setCustomCategoryEn('');
                            setCustomCategoryAr('');
                          } catch (error) {
                            console.error('Error creating category:', error);
                            alert(t('events.categoryForm.createFailed'));
                          }
                        }}
                        data-testid="button-save-custom-category"
                      >
                        {t('events.categoryForm.save')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowCustomCategory(false);
                          setCustomCategoryEn('');
                          setCustomCategoryAr('');
                          field.onChange('');
                        }}
                        data-testid="button-cancel-custom-category"
                      >
                        {t('events.categoryForm.cancel')}
                      </Button>
                    </div>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="eventType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('events.fields.eventType')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-event-type">
                      <SelectValue placeholder={t('events.placeholders.selectEventType')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="local" data-testid="option-local">{t('events.eventTypes.local')}</SelectItem>
                    <SelectItem value="international" data-testid="option-international">{t('events.eventTypes.international')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="eventScope"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('events.fields.eventScope')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-event-scope">
                      <SelectValue placeholder={t('events.placeholders.selectEventScope')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="internal" data-testid="option-internal">{t('events.eventScopes.internal')}</SelectItem>
                    <SelectItem value="external" data-testid="option-external">{t('events.eventScopes.external')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>{t('events.fields.url')}</FormLabel>
                <FormControl>
                  <Input
                    type="url"
                    placeholder={t('events.placeholders.enterUrl')}
                    data-testid="input-url"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>{t('events.fields.description')}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t('events.placeholders.enterDescription')}
                    rows={4}
                    data-testid="input-description"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="descriptionAr"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>{t('events.fields.descriptionAr')}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t('events.placeholders.enterDescriptionAr')}
                    rows={4}
                    data-testid="input-description-ar"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid sm:grid-cols-2 gap-4 sm:col-span-2">
            <div className="space-y-2">
              <Label htmlFor="agenda-en">{t('events.fields.agendaEn')}</Label>
              <Input
                id="agenda-en"
                type="file"
                accept="application/pdf"
                onChange={(e) => setAgendaEnFile(e.target.files?.[0] || null)}
                data-testid="input-agenda-en"
              />
              <p className="text-xs text-muted-foreground">{t('events.agendaUploadHint')}</p>
              {(agendaEnFile || event?.agendaEnFileName) && (
                <p className="text-xs text-muted-foreground">
                  {agendaEnFile ? agendaEnFile.name : event?.agendaEnFileName}{' '}
                  {event?.agendaEnFileName && event.id && (
                    <a
                      href={`/api/events/${event.id}/agenda/en`}
                      className="text-primary underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      ({t('events.downloadCurrent')})
                    </a>
                  )}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="agenda-ar">{t('events.fields.agendaAr')}</Label>
              <Input
                id="agenda-ar"
                type="file"
                accept="application/pdf"
                onChange={(e) => setAgendaArFile(e.target.files?.[0] || null)}
                data-testid="input-agenda-ar"
              />
              <p className="text-xs text-muted-foreground">{t('events.agendaUploadHint')}</p>
              {(agendaArFile || event?.agendaArFileName) && (
                <p className="text-xs text-muted-foreground" dir="rtl">
                  {agendaArFile ? agendaArFile.name : event?.agendaArFileName}{' '}
                  {event?.agendaArFileName && event.id && (
                    <a
                      href={`/api/events/${event.id}/agenda/ar`}
                      className="text-primary underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      ({t('events.downloadCurrent')})
                    </a>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Event Photos Section */}
          <div className="sm:col-span-2 space-y-4 border-t pt-4">
            <Label className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              {t('events.fields.photos', 'Event Photos')}
              <Badge variant="secondary">{currentMedia.length + photoFiles.length} / 20</Badge>
            </Label>
            
            {/* Show existing photos when editing an event */}
            {event?.id && currentMedia.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('events.currentPhotos', 'Current photos')}:</p>
                <div className="grid grid-cols-4 gap-2">
                  {currentMedia.map((media, idx) => (
                    <div key={media.id || idx} className="aspect-square bg-muted rounded-md overflow-hidden relative group cursor-pointer">
                      <img
                        src={media.thumbnailUrl || media.imageUrl || ''}
                        alt={media.caption || `Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onClick={() => setPreviewImage(media.imageUrl || media.thumbnailUrl || '')}
                      />
                      {/* Delete button overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImage(media.imageUrl || media.thumbnailUrl || '');
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm(t('events.confirmDeletePhoto', 'Delete this photo?'))) return;
                            try {
                              await fetch(`/api/events/${event.id}/media/${media.id}`, {
                                method: 'DELETE',
                                credentials: 'include',
                              });
                              // Update local state immediately
                              setCurrentMedia(prev => prev.filter(m => m.id !== media.id));
                              toast({ title: t('events.photoDeleted', 'Photo deleted') });
                            } catch (error) {
                              console.error('Failed to delete photo:', error);
                              toast({ title: t('events.deletePhotoFailed', 'Failed to delete photo'), variant: 'destructive' });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Upload new photos section */}
            <div className="p-4 border-2 border-dashed rounded-lg space-y-3">
              <Label className="flex items-center gap-2 text-sm">
                <Upload className="h-4 w-4" />
                {event?.id ? t('events.uploadNewPhotos', 'Upload new photos') : t('events.addPhotos', 'Add photos')}
              </Label>
              <Input
                id="event-photos"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;
                  
                  const currentCount = currentMedia.length + photoFiles.length;
                  if (currentCount + files.length > 20) {
                    alert(t('events.maxPhotosError', `Maximum 20 photos allowed. You have ${currentCount} and tried to add ${files.length}.`));
                    e.target.value = '';
                    return;
                  }
                  
                  // If editing an existing event, upload immediately like archive
                  if (event?.id) {
                    setIsUploadingPhotos(true);
                    const formData = new FormData();
                    files.forEach(file => formData.append('photos', file));
                    
                    try {
                      const response = await fetch(`/api/events/${event.id}/media`, {
                        method: 'POST',
                        body: formData,
                        credentials: 'include',
                      });
                      if (!response.ok) throw new Error('Upload failed');
                      const result = await response.json();
                      // Update local state with new media (API returns 'media' array)
                      if (result.media && result.media.length > 0) {
                        setCurrentMedia(prev => [...prev, ...result.media]);
                      }
                      toast({ title: t('events.photosUploaded', 'Photos uploaded successfully') });
                    } catch (error) {
                      console.error('Failed to upload photos:', error);
                      toast({ title: t('events.uploadFailed', 'Failed to upload photos'), variant: 'destructive' });
                    } finally {
                      setIsUploadingPhotos(false);
                    }
                  } else {
                    // For new events, store files to upload on submit
                    setPhotoFiles(prev => [...prev, ...files]);
                  }
                  e.target.value = '';
                }}
                disabled={isSubmitting || isUploadingPhotos || currentMedia.length + photoFiles.length >= 20}
                data-testid="input-event-photos"
              />
              <p className="text-xs text-muted-foreground">
                {t('events.photoUploadHint', `Max 5MB per photo. Supported: JPEG, PNG, WebP, GIF. ${20 - currentMedia.length - photoFiles.length} slots remaining.`)}
              </p>
              {isUploadingPhotos && (
                <p className="text-sm text-amber-600 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('events.uploadingPhotos', 'Uploading photos...')}
                </p>
              )}
            </div>
            
            {/* Show pending photos for new events */}
            {!event?.id && photoFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('events.pendingPhotos', 'Photos to upload')}:</p>
                <div className="grid grid-cols-4 gap-2">
                  {photoFiles.map((file, idx) => (
                    <div key={idx} className="aspect-square bg-muted rounded-md overflow-hidden relative group cursor-pointer">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        onClick={() => setPreviewImage(URL.createObjectURL(file))}
                      />
                      {/* Remove button overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImage(URL.createObjectURL(file));
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoFiles(prev => prev.filter((_, i) => i !== idx));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {/* File name */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate">
                        {file.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Image Preview Modal */}
          {previewImage && (
            <div 
              className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
              onClick={() => setPreviewImage(null)}
            >
              <div className="relative max-w-4xl max-h-[90vh]">
                <img
                  src={previewImage}
                  alt="Preview"
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => setPreviewImage(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <FormField
            control={form.control}
            name="expectedAttendance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('events.fields.expectedAttendance')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder={t('events.placeholders.enterExpectedAttendance')}
                    data-testid="input-expected-attendance"
                    {...field}
                    value={field.value || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      field.onChange(value ? parseInt(value, 10) : '');
                    }}
                  />
                </FormControl>
                <FormMessage />
                <p className="text-xs text-muted-foreground">
                  {t('events.expectedAttendanceHint')}
                </p>
              </FormItem>
            )}
          />
        </div>

        {/* Speakers Section */}
        <div className="border-t pt-6">
          <EventSpeakersManager
            eventId={event?.id}
            selectedSpeakers={selectedSpeakers}
            onSpeakersChange={setSelectedSpeakers}
            disabled={isSubmitting}
          />
        </div>

        <div className="border-t pt-6 space-y-3">
          <Label className="text-base font-semibold">{t('eventForm.reminderSettings')}</Label>
          <p className="text-sm text-muted-foreground">
            {t('eventForm.reminderSettingsDesc')}
          </p>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="reminder1Week"
                checked={form.watch("reminder1Week") ?? true}
                onCheckedChange={(checked) => form.setValue("reminder1Week", !!checked)}
                data-testid="checkbox-reminder-1-week"
              />
              <Label htmlFor="reminder1Week" className="font-normal cursor-pointer">
                {t('eventForm.oneWeekBefore')}
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="reminder1Day"
                checked={form.watch("reminder1Day") ?? true}
                onCheckedChange={(checked) => form.setValue("reminder1Day", !!checked)}
                data-testid="checkbox-reminder-1-day"
              />
              <Label htmlFor="reminder1Day" className="font-normal cursor-pointer">
                {t('eventForm.oneDayBefore')}
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="reminderWeekly"
                checked={form.watch("reminderWeekly") ?? false}
                onCheckedChange={(checked) => form.setValue("reminderWeekly", !!checked)}
                data-testid="checkbox-reminder-weekly"
              />
              <Label htmlFor="reminderWeekly" className="font-normal cursor-pointer">
                {t('eventForm.weeklyReminders')}
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="reminderDaily"
                checked={form.watch("reminderDaily") ?? false}
                onCheckedChange={(checked) => form.setValue("reminderDaily", !!checked)}
                data-testid="checkbox-reminder-daily"
              />
              <Label htmlFor="reminderDaily" className="font-normal cursor-pointer">
                {t('eventForm.dailyReminders')}
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="reminderMorningOf"
                checked={form.watch("reminderMorningOf") ?? false}
                onCheckedChange={(checked) => form.setValue("reminderMorningOf", !!checked)}
                data-testid="checkbox-reminder-morning-of"
              />
              <Label htmlFor="reminderMorningOf" className="font-normal cursor-pointer">
                {t('eventForm.morningOfEvent')}
              </Label>
            </div>
          </div>
        </div>

        {stakeholders.length > 0 && (
          <div className="border-t pt-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">{t('departments.notificationTitle')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('departments.notificationDesc')}
              </p>
            </div>
            
            <div className="space-y-4">
              {stakeholders.filter(s => s.active).map(stakeholder => (
                <div key={stakeholder.id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`stakeholder-${stakeholder.id}`}
                      checked={selectedStakeholders.includes(stakeholder.id)}
                      onChange={() => toggleStakeholder(stakeholder.id)}
                      data-testid={`checkbox-stakeholder-${stakeholder.id}`}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor={`stakeholder-${stakeholder.id}`} className="font-medium cursor-pointer">
                      {isArabic && stakeholder.nameAr ? stakeholder.nameAr : stakeholder.name}
                    </Label>
                  </div>
                  
                  {selectedStakeholders.includes(stakeholder.id) && (
                    <div className="mt-4 space-y-3 ps-6">
                      {stakeholder.requirements.length > 0 && (
                        <div>
                          <Label className="text-sm font-medium">{t('departments.requirements')}:</Label>
                          <div className="space-y-2 mt-2">
                            {stakeholder.requirements.map(req => (
                              <div key={req.id} className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  id={`requirement-${req.id}`}
                                  checked={stakeholderRequirements[stakeholder.id]?.includes(req.id.toString()) || false}
                                  onChange={() => toggleRequirement(stakeholder.id, req.id)}
                                  data-testid={`checkbox-requirement-${req.id}`}
                                  className="h-4 w-4 rounded border-gray-300 mt-0.5"
                                />
                                <Label htmlFor={`requirement-${req.id}`} className="cursor-pointer">
                                  <p className="text-sm font-medium">
                                    {isArabic && req.titleAr ? req.titleAr : req.title}
                                  </p>
                                  {(isArabic ? req.descriptionAr || req.description : req.description) && (
                                    <p className="text-xs text-muted-foreground">
                                      {isArabic && req.descriptionAr ? req.descriptionAr : req.description}
                                    </p>
                                  )}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <Label className="text-sm">{t('departments.customRequirements')}:</Label>
                        <Textarea
                          rows={3}
                          value={customRequirements[stakeholder.id] || ''}
                          onChange={(e) => setCustomRequirement(stakeholder.id, e.target.value)}
                          placeholder={t('departments.customRequirementsPlaceholder')}
                          data-testid={`textarea-custom-requirements-${stakeholder.id}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex gap-4 justify-end pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            data-testid="button-cancel"
          >
            {t('common.cancel')}
          </Button>

           {/* Hide save button for viewers */}
          {!readOnly && canEdit && (
          <Button
            type="submit"
            disabled={isSubmitting}
            data-testid="button-submit"
          >
            {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {event ? t('events.updateEvent') : t('events.createEvent')}
          </Button>)}
        </div>
      </form>
      
      {/* Prerequisite Confirmation Dialog */}
      <PrerequisiteConfirmDialog
        open={showPrereqDialog}
        onOpenChange={setShowPrereqDialog}
        taskName={pendingPrereqAction?.requirementName || ''}
        prerequisites={pendingPrereqAction?.prerequisites || []}
        onConfirm={handlePrereqConfirm}
        onCancel={handlePrereqCancel}
      />
    </Form>
  );
}
