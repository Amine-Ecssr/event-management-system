'use client';

import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';

// Icons
import {
  Sparkles,
  ClipboardList,
  Calendar,
  CheckSquare,
  Handshake,
  UserPlus,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ArrowRight,
  MessageSquare,
  Wand2,
  Plus,
  Info,
} from 'lucide-react';

import type { AiIntakeResponse, AiIntakeType } from '@/types/ai';

// ============================================================================
// Types
// ============================================================================

type SimpleEvent = { id: string; name: string; startDate: string };
type Department = { id: number; name: string; nameAr?: string | null };
type Organization = { id: number; nameEn: string; nameAr?: string | null };
type Category = { id: number; nameEn: string; nameAr?: string | null };
type PartnershipType = { id: number; nameEn: string; nameAr?: string | null };
type Country = { id: number; nameEn: string; nameAr?: string | null; code: string };

// ============================================================================
// Constants
// ============================================================================

const RECORD_TYPES = [
  { id: 'event', label: 'Event', icon: Calendar, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { id: 'task', label: 'Task', icon: CheckSquare, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  { id: 'partnership', label: 'Partnership', icon: Handshake, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { id: 'lead', label: 'Lead', icon: UserPlus, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
] as const;

const EXAMPLE_NOTES = [
  {
    type: 'event',
    text: 'Annual Technology Summit on March 15, 2025 at Dubai Convention Center. Expected 500 attendees. Topics include AI, Cloud Computing, and Digital Transformation.',
  },
  {
    type: 'task',
    text: 'Need to prepare presentation materials for the upcoming board meeting by January 10th. High priority. Marketing department to handle design.',
  },
  {
    type: 'partnership',
    text: 'Meeting scheduled with Microsoft UAE to discuss potential partnership for cloud services. Contact: John Smith, john@microsoft.com',
  },
  {
    type: 'lead',
    text: 'Received inquiry from Sarah Johnson at TechCorp regarding event sponsorship opportunities. Email: sarah.j@techcorp.com, Phone: +971-50-123-4567',
  },
];

const EVENT_FIELDS = {
  name: '', nameAr: '', description: '', descriptionAr: '',
  startDate: '', endDate: '', startTime: '', endTime: '',
  location: '', locationAr: '', organizers: '', organizersAr: '',
  url: '', categoryId: '', eventType: 'local', eventScope: 'external',
  expectedAttendance: '',
};

const TASK_FIELDS = {
  title: '', titleAr: '', description: '', descriptionAr: '',
  dueDate: '', priority: 'medium', status: 'pending',
  eventId: '', departmentId: '',
};

const PARTNERSHIP_FIELDS = {
  organizationName: '', organizationNameAr: '', countryId: '', website: '',
  partnershipTypeId: '', partnershipStatus: 'pending',
  partnershipStartDate: '', partnershipEndDate: '',
  partnershipNotes: '',
};

const LEAD_FIELDS = {
  name: '', nameAr: '', email: '', phone: '',
  type: 'lead', status: 'active',
  organizationName: '', notes: '', notesAr: '',
};

const CONTACT_FIELDS = {
  name: '', nameAr: '', email: '', phone: '',
  type: 'contact', status: 'active',
  organizationName: '', notes: '', notesAr: '',
};

const EMPTY_FIELDS: Record<AiIntakeType, Record<string, string>> = {
  event: EVENT_FIELDS,
  task: TASK_FIELDS,
  partnership: PARTNERSHIP_FIELDS,
  lead: LEAD_FIELDS,
  contact: CONTACT_FIELDS,
  unknown: {},
};

// ============================================================================
// Sub-components
// ============================================================================

function TypeSelector({
  selectedType,
  onSelect,
}: {
  selectedType: AiIntakeType;
  onSelect: (type: AiIntakeType) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {RECORD_TYPES.map((type) => (
        <button
          key={type.id}
          onClick={() => onSelect(type.id as AiIntakeType)}
          className={cn(
            'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
            selectedType === type.id
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20'
          )}
        >
          <div className={cn('p-2.5 rounded-lg', type.bgColor, type.color)}>
            <type.icon className="h-5 w-5" />
          </div>
          <span className={cn('text-sm font-medium', selectedType === type.id && 'text-primary')}>
            {type.label}
          </span>
        </button>
      ))}
    </div>
  );
}

function AnalysisResult({ result }: { result: AiIntakeResponse }) {
  const { t } = useTranslation();
  const confidencePercent = Math.round(result.confidence * 100);
  const typeConfig = RECORD_TYPES.find((t) => t.id === result.type);

  return (
    <Card className="border-dashed">
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
              <p className="font-medium">Detected: {result.type}</p>
              <p className="text-xs text-muted-foreground">
                {confidencePercent}% confidence
              </p>
            </div>
          </div>
          <Badge variant={confidencePercent >= 70 ? 'default' : 'secondary'}>
            {confidencePercent >= 70 ? 'High' : confidencePercent >= 40 ? 'Medium' : 'Low'}
          </Badge>
        </div>

        {/* Progress */}
        <Progress value={confidencePercent} className="h-2" />

        {/* Summary */}
        {result.summary && (
          <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            {result.summary}
          </p>
        )}

        {/* Warnings */}
        {result.missingFields.length > 0 && (
          <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/5">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <AlertTitle className="text-yellow-600">Missing fields</AlertTitle>
            <AlertDescription className="text-sm">
              {result.missingFields.join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {/* Suggestions */}
        {result.suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              Suggestions
            </p>
            <ul className="space-y-1">
              {result.suggestions.map((suggestion, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FormField({
  label,
  children,
  required,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ============================================================================
// Form Components
// ============================================================================

function EventForm({
  formData,
  onChange,
  categories,
}: {
  formData: Record<string, string>;
  onChange: (field: string, value: string) => void;
  categories?: Category[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Event Name" required>
          <Input
            value={formData.name || ''}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Enter event name"
          />
        </FormField>
        <FormField label="Event Name (Arabic)">
          <Input
            value={formData.nameAr || ''}
            onChange={(e) => onChange('nameAr', e.target.value)}
            placeholder="أدخل اسم الفعالية"
            dir="rtl"
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Description">
          <Textarea
            value={formData.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Event description"
            rows={3}
          />
        </FormField>
        <FormField label="Description (Arabic)">
          <Textarea
            value={formData.descriptionAr || ''}
            onChange={(e) => onChange('descriptionAr', e.target.value)}
            placeholder="وصف الفعالية"
            rows={3}
            dir="rtl"
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Start Date" required>
          <Input
            type="date"
            value={formData.startDate || ''}
            onChange={(e) => onChange('startDate', e.target.value)}
          />
        </FormField>
        <FormField label="End Date">
          <Input
            type="date"
            value={formData.endDate || ''}
            onChange={(e) => onChange('endDate', e.target.value)}
          />
        </FormField>
        <FormField label="Start Time">
          <Input
            type="time"
            value={formData.startTime || ''}
            onChange={(e) => onChange('startTime', e.target.value)}
          />
        </FormField>
        <FormField label="End Time">
          <Input
            type="time"
            value={formData.endTime || ''}
            onChange={(e) => onChange('endTime', e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Location">
          <Input
            value={formData.location || ''}
            onChange={(e) => onChange('location', e.target.value)}
            placeholder="Event location"
          />
        </FormField>
        <FormField label="Category">
          <Select value={formData.categoryId || ''} onValueChange={(v) => onChange('categoryId', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {(categories || []).map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>
                  {cat.nameEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Event Type">
          <Select value={formData.eventType || 'local'} onValueChange={(v) => onChange('eventType', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">Local</SelectItem>
              <SelectItem value="international">International</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Event Scope">
          <Select value={formData.eventScope || 'external'} onValueChange={(v) => onChange('eventScope', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Internal</SelectItem>
              <SelectItem value="external">External</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Expected Attendance">
          <Input
            type="number"
            value={formData.expectedAttendance || ''}
            onChange={(e) => onChange('expectedAttendance', e.target.value)}
            placeholder="Number of attendees"
          />
        </FormField>
      </div>
    </div>
  );
}

function TaskForm({
  formData,
  onChange,
  events,
  departments,
}: {
  formData: Record<string, string>;
  onChange: (field: string, value: string) => void;
  events?: SimpleEvent[];
  departments?: Department[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Task Title" required>
          <Input
            value={formData.title || ''}
            onChange={(e) => onChange('title', e.target.value)}
            placeholder="Enter task title"
          />
        </FormField>
        <FormField label="Title (Arabic)">
          <Input
            value={formData.titleAr || ''}
            onChange={(e) => onChange('titleAr', e.target.value)}
            placeholder="عنوان المهمة"
            dir="rtl"
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Description">
          <Textarea
            value={formData.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Task details"
            rows={3}
          />
        </FormField>
        <FormField label="Description (Arabic)">
          <Textarea
            value={formData.descriptionAr || ''}
            onChange={(e) => onChange('descriptionAr', e.target.value)}
            placeholder="تفاصيل المهمة"
            rows={3}
            dir="rtl"
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Due Date">
          <Input
            type="date"
            value={formData.dueDate || ''}
            onChange={(e) => onChange('dueDate', e.target.value)}
          />
        </FormField>
        <FormField label="Priority">
          <Select value={formData.priority || 'medium'} onValueChange={(v) => onChange('priority', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Status">
          <Select value={formData.status || 'pending'} onValueChange={(v) => onChange('status', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Assign to Event" required>
          <Select value={formData.eventId || ''} onValueChange={(v) => onChange('eventId', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select event" />
            </SelectTrigger>
            <SelectContent>
              {(events || []).map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name} ({event.startDate})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Assign to Department" required>
          <Select value={formData.departmentId || ''} onValueChange={(v) => onChange('departmentId', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {(departments || []).map((dept) => (
                <SelectItem key={dept.id} value={String(dept.id)}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
    </div>
  );
}

function PartnershipForm({
  formData,
  onChange,
  partnershipTypes,
  countries,
}: {
  formData: Record<string, string>;
  onChange: (field: string, value: string) => void;
  partnershipTypes?: PartnershipType[];
  countries?: Country[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Organization Name" required>
          <Input
            value={formData.organizationName || ''}
            onChange={(e) => onChange('organizationName', e.target.value)}
            placeholder="Enter organization name"
          />
        </FormField>
        <FormField label="Organization (Arabic)">
          <Input
            value={formData.organizationNameAr || ''}
            onChange={(e) => onChange('organizationNameAr', e.target.value)}
            placeholder="اسم المنظمة"
            dir="rtl"
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Partnership Type">
          <Select value={formData.partnershipTypeId || ''} onValueChange={(v) => onChange('partnershipTypeId', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {(partnershipTypes || []).map((type) => (
                <SelectItem key={type.id} value={String(type.id)}>
                  {type.nameEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Country">
          <Select value={formData.countryId || ''} onValueChange={(v) => onChange('countryId', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {(countries || []).map((country) => (
                <SelectItem key={country.id} value={String(country.id)}>
                  {country.nameEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Status">
          <Select value={formData.partnershipStatus || 'pending'} onValueChange={(v) => onChange('partnershipStatus', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Start Date">
          <Input
            type="date"
            value={formData.partnershipStartDate || ''}
            onChange={(e) => onChange('partnershipStartDate', e.target.value)}
          />
        </FormField>
        <FormField label="End Date">
          <Input
            type="date"
            value={formData.partnershipEndDate || ''}
            onChange={(e) => onChange('partnershipEndDate', e.target.value)}
          />
        </FormField>
      </div>

      <FormField label="Website">
        <Input
          type="url"
          value={formData.website || ''}
          onChange={(e) => onChange('website', e.target.value)}
          placeholder="https://example.com"
        />
      </FormField>

      <FormField label="Notes">
        <Textarea
          value={formData.partnershipNotes || ''}
          onChange={(e) => onChange('partnershipNotes', e.target.value)}
          placeholder="Partnership notes and details"
          rows={3}
        />
      </FormField>
    </div>
  );
}

function LeadForm({
  formData,
  onChange,
}: {
  formData: Record<string, string>;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Lead Name" required>
          <Input
            value={formData.name || ''}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Enter lead name"
          />
        </FormField>
        <FormField label="Name (Arabic)">
          <Input
            value={formData.nameAr || ''}
            onChange={(e) => onChange('nameAr', e.target.value)}
            placeholder="اسم العميل المحتمل"
            dir="rtl"
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Email">
          <Input
            type="email"
            value={formData.email || ''}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="email@example.com"
          />
        </FormField>
        <FormField label="Phone">
          <Input
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => onChange('phone', e.target.value)}
            placeholder="+971-50-123-4567"
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Lead Type">
          <Select value={formData.type || 'lead'} onValueChange={(v) => onChange('type', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="vendor">Vendor</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Status">
          <Select value={formData.status || 'active'} onValueChange={(v) => onChange('status', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Organization">
          <Input
            value={formData.organizationName || ''}
            onChange={(e) => onChange('organizationName', e.target.value)}
            placeholder="Company name"
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Notes">
          <Textarea
            value={formData.notes || ''}
            onChange={(e) => onChange('notes', e.target.value)}
            placeholder="Additional notes"
            rows={3}
          />
        </FormField>
        <FormField label="Notes (Arabic)">
          <Textarea
            value={formData.notesAr || ''}
            onChange={(e) => onChange('notesAr', e.target.value)}
            placeholder="ملاحظات إضافية"
            rows={3}
            dir="rtl"
          />
        </FormField>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AIIntakePage() {
  const { t } = useTranslation();
  const { toast } = useToast();

  // State
  const [intakeText, setIntakeText] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AiIntakeResponse | null>(null);
  const [selectedType, setSelectedType] = useState<AiIntakeType>('event');
  const [formData, setFormData] = useState<Record<string, string>>(EMPTY_FIELDS.event);
  const [isCreating, setIsCreating] = useState(false);

  // Queries
  const { data: events } = useQuery<SimpleEvent[]>({ queryKey: ['/api/events'] });
  const { data: departments } = useQuery<Department[]>({ queryKey: ['/api/stakeholders'] });
  const { data: organizations } = useQuery<Organization[]>({ queryKey: ['/api/organizations'] });
  const { data: categories } = useQuery<Category[]>({ queryKey: ['/api/categories'] });
  const { data: partnershipTypes } = useQuery<PartnershipType[]>({ queryKey: ['/api/partnership-types'] });
  const { data: countries } = useQuery<Country[]>({ queryKey: ['/api/countries'] });

  // Parse mutation
  const parseMutation = useMutation({
    mutationFn: async (text: string) => {
      return apiRequest<AiIntakeResponse>('POST', '/api/ai/intake/parse', { text });
    },
    onSuccess: (response) => {
      setAnalysisResult(response);
      const nextType = response.type === 'unknown' ? 'event' : response.type;
      setSelectedType(nextType);

      // Prefill form
      const baseFields = { ...EMPTY_FIELDS[nextType] };
      if (nextType === 'event') {
        baseFields.name = response.fields.title || '';
        baseFields.description = response.fields.description || '';
        baseFields.startDate = response.fields.date || '';
        baseFields.endDate = response.fields.date || '';
      }
      if (nextType === 'task') {
        baseFields.title = response.fields.title || '';
        baseFields.description = response.fields.description || '';
        baseFields.dueDate = response.fields.date || '';
      }
      if (nextType === 'partnership') {
        baseFields.organizationName = response.fields.organizationName || '';
        baseFields.partnershipNotes = response.fields.description || '';
      }
      if (nextType === 'lead') {
        baseFields.name = response.fields.contactName || response.fields.title || '';
        baseFields.organizationName = response.fields.organizationName || '';
        baseFields.notes = response.fields.description || '';
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

  // Handlers
  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTypeChange = (type: AiIntakeType) => {
    setSelectedType(type);
    setFormData({ ...EMPTY_FIELDS[type] });
  };

  const handleAnalyze = () => {
    if (intakeText.trim()) {
      parseMutation.mutate(intakeText);
    }
  };

  const handleUseExample = (example: typeof EXAMPLE_NOTES[0]) => {
    setIntakeText(example.text);
    setSelectedType(example.type as AiIntakeType);
    setFormData({ ...EMPTY_FIELDS[example.type as AiIntakeType] });
    setAnalysisResult(null);
  };

  const handleCreateRecord = async () => {
    setIsCreating(true);

    try {
      if (selectedType === 'event') {
        if (!formData.name || !formData.startDate) {
          throw new Error('Event name and start date are required.');
        }
        await apiRequest('POST', '/api/events', {
          name: formData.name,
          nameAr: formData.nameAr || null,
          description: formData.description || null,
          descriptionAr: formData.descriptionAr || null,
          startDate: formData.startDate,
          endDate: formData.endDate || formData.startDate,
          startTime: formData.startTime || null,
          endTime: formData.endTime || null,
          location: formData.location || null,
          locationAr: formData.locationAr || null,
          url: formData.url || null,
          categoryId: formData.categoryId ? Number(formData.categoryId) : null,
          eventType: formData.eventType || 'local',
          eventScope: formData.eventScope || 'external',
          expectedAttendance: formData.expectedAttendance ? Number(formData.expectedAttendance) : null,
        });
      }

      if (selectedType === 'task') {
        if (!formData.title || !formData.eventId || !formData.departmentId) {
          throw new Error('Task title, event, and department are required.');
        }
        const assignment = await apiRequest<{ id: number }>('POST', '/api/admin/event-stakeholders', {
          eventId: formData.eventId,
          departmentId: Number(formData.departmentId),
        });
        await apiRequest('POST', `/api/event-departments/${assignment.id}/tasks`, {
          title: formData.title,
          titleAr: formData.titleAr || null,
          description: formData.description || null,
          descriptionAr: formData.descriptionAr || null,
          dueDate: formData.dueDate || null,
          priority: formData.priority || 'medium',
        });
      }

      if (selectedType === 'partnership') {
        if (!formData.organizationName) {
          throw new Error('Organization name is required.');
        }
        const existing = organizations?.find(
          (org) => org.nameEn.toLowerCase() === formData.organizationName.toLowerCase()
        );
        await apiRequest('POST', '/api/organizations', {
          nameEn: formData.organizationName,
          nameAr: formData.organizationNameAr || null,
          isPartner: true,
          partnershipStatus: formData.partnershipStatus || 'pending',
          partnershipTypeId: formData.partnershipTypeId ? Number(formData.partnershipTypeId) : null,
          partnershipStartDate: formData.partnershipStartDate || null,
          partnershipEndDate: formData.partnershipEndDate || null,
          partnershipNotes: formData.partnershipNotes || null,
          website: formData.website || null,
          countryId: formData.countryId ? Number(formData.countryId) : null,
        });
      }

      if (selectedType === 'lead') {
        if (!formData.name) {
          throw new Error('Lead name is required.');
        }
        await apiRequest('POST', '/api/leads', {
          name: formData.name,
          nameAr: formData.nameAr || null,
          email: formData.email || null,
          phone: formData.phone || null,
          type: formData.type || 'lead',
          status: formData.status || 'active',
          organizationName: formData.organizationName || null,
          notes: formData.notes || null,
          notesAr: formData.notesAr || null,
        });
      }

      toast({
        title: t('ai.recordCreated', 'Record created'),
        description: t('ai.recordCreatedDesc', 'The new item has been added to the database.'),
      });

      // Reset form
      setFormData({ ...EMPTY_FIELDS[selectedType] });
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

  return (
    <TooltipProvider>
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
              <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('ai.intakeTitle', 'AI Intake Assistant')}</h1>
              <p className="text-sm text-muted-foreground">
                Paste notes and let AI help you create structured records
              </p>
            </div>
          </div>
          <Link href="/admin/ai">
            <Button variant="outline" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              AI Chat
            </Button>
          </Link>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          {/* Left Panel - Input */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Paste your notes
                </CardTitle>
                <CardDescription>
                  AI will analyze your text and suggest the record type
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={intakeText}
                  onChange={(e) => setIntakeText(e.target.value)}
                  placeholder="Paste a paragraph about a new event, task, partnership, or lead..."
                  rows={8}
                  className="resize-none"
                />
                <Button
                  onClick={handleAnalyze}
                  disabled={!intakeText.trim() || parseMutation.isPending}
                  className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                >
                  {parseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  Analyze & Prefill
                </Button>
              </CardContent>
            </Card>

            {/* Analysis Result */}
            {analysisResult && <AnalysisResult result={analysisResult} />}

            {/* Example Notes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Try an example
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {EXAMPLE_NOTES.map((example, idx) => {
                  const typeConfig = RECORD_TYPES.find((t) => t.id === example.type);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleUseExample(example)}
                      className="w-full flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent hover:border-primary/20 transition-all text-left group"
                    >
                      {typeConfig && (
                        <div className={cn('p-1.5 rounded-md mt-0.5', typeConfig.bgColor, typeConfig.color)}>
                          <typeConfig.icon className="h-3.5 w-3.5" />
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Record
              </CardTitle>
              <CardDescription>
                Select the record type and fill in the details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Type Selector */}
              <TypeSelector selectedType={selectedType} onSelect={handleTypeChange} />

              <Separator />

              {/* Dynamic Form */}
              <ScrollArea className="h-[calc(100vh-480px)] min-h-[300px] pe-4">
                {selectedType === 'event' && (
                  <EventForm formData={formData} onChange={handleFieldChange} categories={categories} />
                )}
                {selectedType === 'task' && (
                  <TaskForm
                    formData={formData}
                    onChange={handleFieldChange}
                    events={events}
                    departments={departments}
                  />
                )}
                {selectedType === 'partnership' && (
                  <PartnershipForm
                    formData={formData}
                    onChange={handleFieldChange}
                    partnershipTypes={partnershipTypes}
                    countries={countries}
                  />
                )}
                {selectedType === 'lead' && <LeadForm formData={formData} onChange={handleFieldChange} />}
              </ScrollArea>
            </CardContent>
            <CardFooter className="border-t pt-4">
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
      </div>
    </TooltipProvider>
  );
}
