'use client';

import { useState } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';

// Icons
import {
  Sparkles,
  Calendar,
  CheckSquare,
  Handshake,
  UserPlus,
  Users,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  MessageSquare,
  Wand2,
  Maximize2,
  ExternalLink,
  ArrowRight,
  Info,
} from 'lucide-react';

// Import AI intake forms
import {
  EventIntakeForm,
  TaskIntakeForm,
  PartnershipIntakeForm,
  LeadIntakeForm,
  ContactIntakeForm,
  EMPTY_EVENT_FORM,
  EMPTY_TASK_FORM,
  EMPTY_PARTNERSHIP_FORM,
  EMPTY_LEAD_FORM,
  EMPTY_CONTACT_FORM,
} from '@/components/ai-intake';
import type { EventFormData } from '@/components/ai-intake/EventIntakeForm';
import type { TaskFormData } from '@/components/ai-intake/TaskIntakeForm';
import type { PartnershipFormData } from '@/components/ai-intake/PartnershipIntakeForm';
import type { LeadFormData } from '@/components/ai-intake/LeadIntakeForm';
import type { ContactFormData } from '@/components/ai-intake/ContactIntakeForm';

import type { AiIntakeResponse, AiSource } from '@/types/ai';

// ============================================================================
// Types
// ============================================================================

type IntakeType = 'event' | 'task' | 'partnership' | 'lead' | 'contact';
type AnyFormData = EventFormData | TaskFormData | PartnershipFormData | LeadFormData | ContactFormData;

type Organization = { id: number; nameEn: string; nameAr?: string | null };

// ============================================================================
// Constants
// ============================================================================

const RECORD_TYPES = [
  { id: 'event' as IntakeType, label: 'Event', labelAr: 'فعالية', icon: Calendar, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { id: 'task' as IntakeType, label: 'Task', labelAr: 'مهمة', icon: CheckSquare, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  { id: 'partnership' as IntakeType, label: 'Partnership', labelAr: 'شراكة', icon: Handshake, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { id: 'lead' as IntakeType, label: 'Lead', labelAr: 'عميل محتمل', icon: UserPlus, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
  { id: 'contact' as IntakeType, label: 'Contact', labelAr: 'جهة اتصال', icon: Users, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
] as const;

const EXAMPLE_NOTES = [
  {
    type: 'event' as IntakeType,
    text: 'Annual Technology Summit on March 15, 2025 at Dubai Convention Center. Expected 500 attendees. Topics include AI, Cloud Computing, and Digital Transformation. Organized by TechHub UAE. The event will run from 9:00 AM to 5:00 PM.',
  },
  {
    type: 'task' as IntakeType,
    text: 'Need to prepare presentation materials for the Annual Technology Summit by March 10th. High priority. Marketing department to handle design and branding. Should include event agenda, speaker bios, and promotional materials.',
  },
  {
    type: 'partnership' as IntakeType,
    text: 'Meeting scheduled with Microsoft UAE to discuss potential MoU partnership for cloud services. They are interested in sponsoring our tech events. Contact: John Smith, Partnership Manager. Website: microsoft.com/uae',
  },
  {
    type: 'lead' as IntakeType,
    text: 'Received inquiry from Sarah Johnson at TechCorp regarding event sponsorship opportunities for 2025. Email: sarah.j@techcorp.com, Phone: +971-50-123-4567. Very interested in AI-focused events.',
  },
  {
    type: 'contact' as IntakeType,
    text: 'Dr. Ahmed Al-Rashid, Chief Innovation Officer at Emirates Future Foundation. Email: ahmed.r@eff.ae, Phone: +971-2-123-4567. Based in Abu Dhabi. Expert speaker on digital transformation topics.',
  },
];

const ENTITY_ROUTE_MAP: Record<string, { base: string; mode: 'detail' | 'list' | 'search' }> = {
  events: { base: '/admin/events', mode: 'detail' },
  'archived-events': { base: '/archive', mode: 'detail' },
  tasks: { base: '/admin/tasks', mode: 'list' },
  contacts: { base: '/admin/contacts', mode: 'list' },
  organizations: { base: '/admin/partnerships', mode: 'search' },
  leads: { base: '/admin/leads', mode: 'detail' },
  agreements: { base: '/admin/partnerships', mode: 'list' },
  attendees: { base: '/admin/events', mode: 'list' },
  invitees: { base: '/admin/events', mode: 'list' },
  departments: { base: '/admin/stakeholders', mode: 'list' },
  partnerships: { base: '/admin/partnerships', mode: 'detail' },
  updates: { base: '/admin/updates', mode: 'list' },
  'lead-interactions': { base: '/admin/leads', mode: 'list' },
  'partnership-activities': { base: '/admin/partnerships', mode: 'list' },
  'partnership-interactions': { base: '/admin/partnerships', mode: 'list' },
};

// ============================================================================
// Helper functions
// ============================================================================

function getEmptyForm(type: IntakeType): AnyFormData {
  switch (type) {
    case 'event': return { ...EMPTY_EVENT_FORM };
    case 'task': return { ...EMPTY_TASK_FORM };
    case 'partnership': return { ...EMPTY_PARTNERSHIP_FORM };
    case 'lead': return { ...EMPTY_LEAD_FORM };
    case 'contact': return { ...EMPTY_CONTACT_FORM };
    default: return { ...EMPTY_EVENT_FORM };
  }
}

// ============================================================================
// Sub-components
// ============================================================================

function SourceCard({ source }: { source: AiSource }) {
  const routeConfig = ENTITY_ROUTE_MAP[source.entityType];
  const searchLink = `/admin/search?q=${encodeURIComponent(source.title)}`;
  let link = searchLink;

  if (routeConfig) {
    if (routeConfig.mode === 'detail') {
      link = `${routeConfig.base}/${source.id}`;
    } else if (routeConfig.mode === 'list') {
      link = routeConfig.base;
    } else {
      link = `${routeConfig.base}?search=${encodeURIComponent(source.title)}`;
    }
  }

  return (
    <Card className="border-muted hover:border-primary/30 transition-colors">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium truncate">{source.title}</div>
          <Badge variant="outline" className="text-[10px] uppercase shrink-0">
            {source.entityType.replace('-', ' ')}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {source.snippet || 'No snippet available.'}
        </p>
        <Button asChild size="sm" variant="ghost" className="w-full h-7 text-xs">
          <Link href={link}>
            <ExternalLink className="h-3 w-3 mr-1" />
            Open record
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function TypeSelector({
  selectedType,
  onSelect,
  isArabic,
}: {
  selectedType: IntakeType;
  onSelect: (type: IntakeType) => void;
  isArabic: boolean;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {RECORD_TYPES.map((type) => (
        <Tooltip key={type.id}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onSelect(type.id)}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all duration-200',
                selectedType === type.id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20'
              )}
            >
              <div className={cn('p-2 rounded-lg', type.bgColor, type.color)}>
                <type.icon className="h-4 w-4" />
              </div>
              <span className={cn('text-xs font-medium', selectedType === type.id && 'text-primary')}>
                {isArabic ? type.labelAr : type.label}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isArabic ? type.labelAr : type.label}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function AnalysisResult({ result, onTypeChange }: { result: AiIntakeResponse; onTypeChange: (type: IntakeType) => void }) {
  const { t } = useTranslation();
  const confidencePercent = Math.round(result.confidence * 100);
  const detectedType = result.type === 'unknown' ? 'event' : result.type;
  const typeConfig = RECORD_TYPES.find((t) => t.id === detectedType);

  return (
    <Card className="border-dashed bg-muted/30">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {typeConfig && (
              <div className={cn('p-2 rounded-lg', typeConfig.bgColor, typeConfig.color)}>
                <typeConfig.icon className="h-4 w-4" />
              </div>
            )}
            <div>
              <p className="font-medium text-sm">
                {t('ai.detected', 'Detected')}: {typeConfig?.label || result.type}
              </p>
              <p className="text-xs text-muted-foreground">
                {confidencePercent}% {t('ai.confidence', 'confidence')}
              </p>
            </div>
          </div>
          <Badge 
            variant={confidencePercent >= 70 ? 'default' : 'secondary'}
            className={cn(
              confidencePercent >= 70 ? 'bg-green-500' : 
              confidencePercent >= 40 ? 'bg-yellow-500' : 'bg-red-500'
            )}
          >
            {confidencePercent >= 70 ? t('ai.highConfidence', 'High') : 
             confidencePercent >= 40 ? t('ai.mediumConfidence', 'Medium') : 
             t('ai.lowConfidence', 'Low')}
          </Badge>
        </div>

        {/* Progress */}
        <Progress value={confidencePercent} className="h-1.5" />

        {/* Summary */}
        {result.summary && (
          <p className="text-sm text-muted-foreground bg-background p-3 rounded-lg border">
            {result.summary}
          </p>
        )}

        {/* Warnings */}
        {result.missingFields.length > 0 && (
          <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/5">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-700 text-sm">{t('ai.missingFields', 'Missing fields')}</AlertTitle>
            <AlertDescription className="text-xs text-yellow-600">
              {result.missingFields.join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {/* Suggestions */}
        {result.suggestions.length > 0 && (
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertTitle className="text-sm">{t('ai.suggestions', 'Suggestions')}</AlertTitle>
            <AlertDescription>
              <ul className="space-y-1 text-xs mt-1">
                {result.suggestions.map((suggestion: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AIAssistant() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isArabic = i18n.language === 'ar';

  // Intake state
  const [intakeText, setIntakeText] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AiIntakeResponse | null>(null);
  const [selectedType, setSelectedType] = useState<IntakeType>('event');
  const [formData, setFormData] = useState<AnyFormData>(EMPTY_EVENT_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [showOriginalDialog, setShowOriginalDialog] = useState(false);

  // Fetch organizations for partnership creation
  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
  });

  // ============================================================================
  // Intake handlers
  // ============================================================================

  const parseMutation = useMutation({
    mutationFn: async (data: { text: string; type: IntakeType }) => {
      return apiRequest<AiIntakeResponse>('POST', '/api/ai/intake/parse', data);
    },
    onSuccess: (response) => {
      setAnalysisResult(response);
      
      // Map AI response type to our IntakeType (including contact support)
      const nextType = selectedType; // Use user-selected type instead of AI guess

      // Prefill form based on detected type and fields
      const baseFields = getEmptyForm(nextType) as any;
      
      if (nextType === 'event') {
        baseFields.name = response.fields.title || '';
        baseFields.nameAr = response.fields.titleAr || '';
        baseFields.description = response.fields.description || '';
        baseFields.descriptionAr = response.fields.descriptionAr || '';
        baseFields.startDate = response.fields.date || '';
        baseFields.endDate = response.fields.date || '';
        baseFields.startTime = response.fields.startTime || '';
        baseFields.endTime = response.fields.endTime || '';
        baseFields.location = response.fields.location || '';
        baseFields.locationAr = response.fields.locationAr || '';
        baseFields.organizers = response.fields.organizers || response.fields.organizer || '';
        baseFields.organizersAr = response.fields.organizersAr || '';
        if (response.fields.expectedAttendance) {
          baseFields.expectedAttendance = response.fields.expectedAttendance;
        }
      }
      
      if (nextType === 'task') {
        baseFields.title = response.fields.title || '';
        baseFields.titleAr = response.fields.titleAr || '';
        baseFields.description = response.fields.description || '';
        baseFields.descriptionAr = response.fields.descriptionAr || '';
        baseFields.dueDate = response.fields.date || '';
        if (response.fields.priority) {
          baseFields.priority = response.fields.priority.toLowerCase();
        }
      }
      
      if (nextType === 'partnership') {
        baseFields.organizationName = response.fields.organizationName || '';
        baseFields.organizationNameAr = response.fields.organizationNameAr || '';
        baseFields.partnershipNotes = response.fields.description || '';
        baseFields.website = response.fields.website || '';
      }
      
      if (nextType === 'lead') {
        baseFields.name = response.fields.contactName || response.fields.title || '';
        baseFields.nameAr = response.fields.titleAr || '';
        baseFields.organizationName = response.fields.organizationName || '';
        baseFields.email = response.fields.email || '';
        baseFields.phone = response.fields.phone || '';
        baseFields.notes = response.fields.description || '';
        baseFields.notesAr = response.fields.descriptionAr || '';
      }
      
      if (nextType === 'contact') {
        baseFields.nameEn = response.fields.contactName || response.fields.title || '';
        baseFields.nameAr = response.fields.titleAr || '';
        baseFields.title = response.fields.jobTitle || '';
        baseFields.titleAr = response.fields.jobTitleAr || '';
        baseFields.email = response.fields.email || '';
        baseFields.phone = response.fields.phone || '';
        // Check for speaker keyword
        if (intakeText.toLowerCase().includes('speaker')) {
          baseFields.isEligibleSpeaker = true;
        }
      }
      
      setFormData(baseFields);
    },
    onError: (error: Error) => {
      toast({
        title: t('ai.parseError', 'Parsing failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleAnalyze = () => {
    if (!intakeText.trim()) return;
    parseMutation.mutate({ text: intakeText, type: selectedType });
  };

  const handleTypeChange = (type: IntakeType) => {
    setSelectedType(type);
    setFormData(getEmptyForm(type));
  };

  const handleUseExample = (example: typeof EXAMPLE_NOTES[0]) => {
    setIntakeText(example.text);
    setSelectedType(example.type);
    setFormData(getEmptyForm(example.type));
    setAnalysisResult(null);
  };

  const handleFieldChange = (field: string, value: string | boolean | number[] | Record<number, string[]> | Record<number, string>) => {
    setFormData((prev) => ({ ...prev, [field]: value } as AnyFormData));
  };

  const handleCreateRecord = async () => {
    setIsCreating(true);

    try {
      if (selectedType === 'event') {
        const data = formData as EventFormData;
        if (!data.name || !data.startDate) {
          throw new Error(t('ai.errors.eventRequired', 'Event name and start date are required.'));
        }

        // Build stakeholder payload if any departments are selected
        let stakeholderPayload: any[] | undefined;
        if (data.selectedStakeholders && data.selectedStakeholders.length > 0) {
          stakeholderPayload = data.selectedStakeholders.map(stakeholderId => ({
            stakeholderId: Number(stakeholderId),
            selectedRequirementIds: (data.stakeholderRequirements?.[stakeholderId] || []).map(id => parseInt(id, 10)),
            customRequirements: data.customRequirements?.[stakeholderId] || '',
            notifyOnCreate: true,
          }));
        }

        // Create FormData for the request (to match EventForm behavior)
        const formDataObj = new FormData();
        formDataObj.append('name', data.name);
        if (data.nameAr) formDataObj.append('nameAr', data.nameAr);
        if (data.description) formDataObj.append('description', data.description);
        if (data.descriptionAr) formDataObj.append('descriptionAr', data.descriptionAr);
        formDataObj.append('startDate', data.startDate);
        formDataObj.append('endDate', data.endDate || data.startDate);
        if (data.startTime) formDataObj.append('startTime', data.startTime);
        if (data.endTime) formDataObj.append('endTime', data.endTime);
        if (data.location) formDataObj.append('location', data.location);
        if (data.locationAr) formDataObj.append('locationAr', data.locationAr);
        if (data.organizers) formDataObj.append('organizers', data.organizers);
        if (data.organizersAr) formDataObj.append('organizersAr', data.organizersAr);
        if (data.url) formDataObj.append('url', data.url);
        if (data.categoryId) formDataObj.append('categoryId', data.categoryId);
        formDataObj.append('eventType', data.eventType || 'local');
        formDataObj.append('eventScope', data.eventScope || 'external');
        if (data.expectedAttendance) formDataObj.append('expectedAttendance', data.expectedAttendance);
        
        if (stakeholderPayload) {
          formDataObj.append('stakeholders', JSON.stringify(stakeholderPayload));
        }

        // Use fetch directly for FormData
        const response = await fetch('/api/events', {
          method: 'POST',
          body: formDataObj,
          credentials: 'include',
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to create event');
        }
        
        queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      }

      if (selectedType === 'task') {
        const data = formData as TaskFormData;
        if (!data.title || !data.eventId || !data.departmentId) {
          throw new Error(t('ai.errors.taskRequired', 'Task title, event, and department are required.'));
        }
        // First create or get the event-stakeholder assignment
        const assignment = await apiRequest<{ id: number }>('POST', '/api/admin/event-stakeholders', {
          eventId: data.eventId,
          departmentId: Number(data.departmentId),
        });
        // Then create the task
        await apiRequest('POST', `/api/event-departments/${assignment.id}/tasks`, {
          title: data.title,
          titleAr: data.titleAr || null,
          description: data.description || null,
          descriptionAr: data.descriptionAr || null,
          dueDate: data.dueDate || null,
          priority: data.priority || 'medium',
        });
        queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      }

      if (selectedType === 'partnership') {
        const data = formData as PartnershipFormData;
        
        if (data.isNewOrganization) {
          if (!data.organizationName) {
            throw new Error(t('ai.errors.partnershipRequired', 'Organization name is required.'));
          }
          // Create new organization as partner
          await apiRequest('POST', '/api/organizations', {
            nameEn: data.organizationName,
            nameAr: data.organizationNameAr || null,
            isPartner: true,
            partnershipStatus: data.partnershipStatus || 'pending',
            partnershipTypeId: data.partnershipTypeId ? Number(data.partnershipTypeId) : null,
            partnershipStartDate: data.partnershipStartDate || null,
            partnershipEndDate: data.partnershipEndDate || null,
            partnershipSignedDate: data.partnershipSignedDate || null,
            partnershipNotes: data.partnershipNotes || null,
            agreementSignedBy: data.agreementSignedBy || null,
            agreementSignedByUs: data.agreementSignedByUs || null,
            website: data.website || null,
            countryId: data.countryId ? Number(data.countryId) : null,
          });
        } else {
          if (!data.organizationId) {
            throw new Error(t('ai.errors.selectOrg', 'Please select an organization.'));
          }
          // Create partnership from existing org
          await apiRequest('POST', '/api/partnerships', {
            organizationId: Number(data.organizationId),
            partnershipTypeId: data.partnershipTypeId ? Number(data.partnershipTypeId) : null,
            countryId: data.countryId ? Number(data.countryId) : null,
            partnershipStatus: data.partnershipStatus || 'pending',
            partnershipSignedDate: data.partnershipSignedDate || null,
            partnershipStartDate: data.partnershipStartDate || null,
            partnershipEndDate: data.partnershipEndDate || null,
            partnershipNotes: data.partnershipNotes || null,
            agreementSignedBy: data.agreementSignedBy || null,
            agreementSignedByUs: data.agreementSignedByUs || null,
          });
        }
        queryClient.invalidateQueries({ queryKey: ['/api/partnerships'] });
        queryClient.invalidateQueries({ queryKey: ['/api/organizations'] });
      }

      if (selectedType === 'lead') {
        const data = formData as LeadFormData;
        if (!data.name) {
          throw new Error(t('ai.errors.leadRequired', 'Lead name is required.'));
        }
        await apiRequest('POST', '/api/leads', {
          name: data.name,
          nameAr: data.nameAr || null,
          email: data.email || null,
          phone: data.phone || null,
          type: data.type || 'lead',
          status: data.status || 'active',
          organizationName: data.organizationName || null,
          notes: data.notes || null,
          notesAr: data.notesAr || null,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      }

      if (selectedType === 'contact') {
        const data = formData as ContactFormData;
        if (!data.nameEn) {
          throw new Error(t('ai.errors.contactRequired', 'Contact name is required.'));
        }
        
        // If creating new org, create it first
        let orgId = data.organizationId ? Number(data.organizationId) : null;
        if (data.organizationName && !orgId) {
          const newOrg = await apiRequest<Organization>('POST', '/api/organizations', {
            nameEn: data.organizationName,
          });
          orgId = newOrg.id;
        }
        
        // Create contact
        await apiRequest('POST', '/api/contacts', {
          nameEn: data.nameEn,
          nameAr: data.nameAr || null,
          title: data.title || null,
          titleAr: data.titleAr || null,
          email: data.email || null,
          phone: data.phone || null,
          organizationId: orgId,
          positionId: data.positionId ? Number(data.positionId) : null,
          countryId: data.countryId ? Number(data.countryId) : null,
          isEligibleSpeaker: data.isEligibleSpeaker || false,
        });
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
      }

      toast({
        title: t('ai.recordCreated', 'Record created'),
        description: t('ai.recordCreatedDesc', 'The new item has been added to the database.'),
      });

      // Reset form
      setFormData(getEmptyForm(selectedType));
      setIntakeText('');
      setAnalysisResult(null);
    } catch (error: any) {
      toast({
        title: t('ai.recordCreateError', 'Unable to create record'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Get the route for the original form
  const getOriginalFormRoute = () => {
    switch (selectedType) {
      case 'event': return '/admin/events';
      case 'task': return '/admin/tasks';
      case 'partnership': return '/admin/partnerships';
      case 'lead': return '/admin/leads';
      case 'contact': return '/admin/contacts';
      default: return '/admin';
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <TooltipProvider>
      <div className="container mx-auto py-6 px-4 space-y-6">
        {/* Header */}
        <Card className="border-muted bg-gradient-to-r from-primary/5 to-primary/10">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {t('ai.intakeTitle', 'AI Intake Assistant')}
                </CardTitle>
                <CardDescription>
                  {t('ai.intakeSubtitle', 'Turn raw notes into structured records with AI assistance.')}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/ai">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {t('ai.goToChat', 'AI Chat')}
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Main Content - Intake Only */}
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Left Panel - Input */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {t('ai.pasteNotes', 'Paste your notes')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('ai.selectTypeFirst', 'Select the type first, then AI will extract details')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Type Selector - Always visible */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('ai.selectRecordType', 'What are you creating?')}
                  </label>
                  <TypeSelector
                    selectedType={selectedType}
                    onSelect={setSelectedType}
                    isArabic={isArabic}
                  />
                </div>

                <Textarea
                  value={intakeText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setIntakeText(e.target.value)}
                  placeholder={t('ai.intakePlaceholder', 'Paste a paragraph about a new event, task, partnership, lead, or contact...')}
                  rows={8}
                  className="resize-none"
                />
                <Button
                  onClick={handleAnalyze}
                  disabled={!intakeText.trim() || parseMutation.isPending}
                  className="w-full gap-2"
                >
                  {parseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  {t('ai.analyzeButton', 'Analyze & Prefill')}
                </Button>
              </CardContent>
            </Card>

            {/* Analysis Result */}
            {analysisResult && (
              <AnalysisResult 
                result={analysisResult} 
                onTypeChange={handleTypeChange} 
              />
            )}

            {/* Example Notes */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  {t('ai.tryExample', 'Try an example')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {EXAMPLE_NOTES.map((example, idx) => {
                  const typeConfig = RECORD_TYPES.find((t) => t.id === example.type);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleUseExample(example)}
                      className="w-full flex items-start gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent hover:border-primary/20 transition-all text-left group"
                    >
                      {typeConfig && (
                        <div className={cn('p-1.5 rounded-md mt-0.5 shrink-0', typeConfig.bgColor, typeConfig.color)}>
                          <typeConfig.icon className="h-3 w-3" />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground line-clamp-2 flex-1 group-hover:text-foreground transition-colors">
                        {example.text}
                      </p>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Form */}
          <Card className="flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {t('ai.createRecord', 'Create Record')}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                  {t('ai.createRecordDesc', 'Fill in the details below')}
                  </CardDescription>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowOriginalDialog(true)}
                    >
                      <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
                      {t('ai.openOriginal', 'Full Form')}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('ai.openOriginalHint', 'Open the form in a larger view')}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              {/* Dynamic Form */}
              <ScrollArea className="h-[calc(100vh-400px)] min-h-[400px] pe-4">
                {selectedType === 'event' && (
                  <EventIntakeForm 
                    formData={formData as EventFormData} 
                    onChange={handleFieldChange as any}
                  />
                )}
                {selectedType === 'task' && (
                  <TaskIntakeForm 
                    formData={formData as TaskFormData} 
                    onChange={handleFieldChange as any}
                  />
                )}
                {selectedType === 'partnership' && (
                  <PartnershipIntakeForm 
                    formData={formData as PartnershipFormData} 
                    onChange={handleFieldChange as any}
                  />
                )}
                {selectedType === 'lead' && (
                  <LeadIntakeForm 
                    formData={formData as LeadFormData} 
                    onChange={handleFieldChange as any}
                  />
                )}
                {selectedType === 'contact' && (
                  <ContactIntakeForm 
                    formData={formData as ContactFormData} 
                    onChange={handleFieldChange as any}
                  />
                )}
              </ScrollArea>
            </CardContent>
            <CardFooter className="border-t pt-4 pb-4">
              <Button
                onClick={handleCreateRecord}
                disabled={isCreating}
                className="w-full gap-2"
                size="lg"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {t('ai.confirmCreate', 'Create Record')}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Similar Records */}
        {analysisResult?.similar && analysisResult.similar.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                {t('ai.similarRecords', 'Similar Records Found')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('ai.similarRecordsDesc', 'These existing records may be related')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {analysisResult.similar.map((source: AiSource) => (
                  <SourceCard key={`${source.entityType}-${source.id}`} source={source} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Full Form Dialog */}
      <Dialog open={showOriginalDialog} onOpenChange={setShowOriginalDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {RECORD_TYPES.find(r => r.id === selectedType)?.icon && (
                (() => {
                  const IconComponent = RECORD_TYPES.find(r => r.id === selectedType)?.icon;
                  return IconComponent ? <IconComponent className="h-5 w-5" /> : null;
                })()
              )}
              {t('ai.createRecord', 'Create Record')} - {RECORD_TYPES.find(r => r.id === selectedType)?.label}
            </DialogTitle>
            <DialogDescription>
              {t('ai.fullFormDesc', 'Complete all fields for the new record')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-[calc(90vh-200px)] pe-4">
              {/* Type Selector */}
              <div className="mb-6">
                <TypeSelector 
                  selectedType={selectedType} 
                  onSelect={handleTypeChange} 
                  isArabic={isArabic}
                />
              </div>

              <Separator className="mb-6" />

              {/* Dynamic Form */}
              {selectedType === 'event' && (
                <EventIntakeForm 
                  formData={formData as EventFormData} 
                  onChange={handleFieldChange as any}
                />
              )}
              {selectedType === 'task' && (
                <TaskIntakeForm 
                  formData={formData as TaskFormData} 
                  onChange={handleFieldChange as any}
                />
              )}
              {selectedType === 'partnership' && (
                <PartnershipIntakeForm 
                  formData={formData as PartnershipFormData} 
                  onChange={handleFieldChange as any}
                />
              )}
              {selectedType === 'lead' && (
                <LeadIntakeForm 
                  formData={formData as LeadFormData} 
                  onChange={handleFieldChange as any}
                />
              )}
              {selectedType === 'contact' && (
                <ContactIntakeForm 
                  formData={formData as ContactFormData} 
                  onChange={handleFieldChange as any}
                />
              )}
            </ScrollArea>
          </div>

          <div className="border-t pt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowOriginalDialog(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={() => {
                handleCreateRecord();
                setShowOriginalDialog(false);
              }}
              disabled={isCreating}
              className="gap-2"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {t('ai.confirmCreate', 'Create Record')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
