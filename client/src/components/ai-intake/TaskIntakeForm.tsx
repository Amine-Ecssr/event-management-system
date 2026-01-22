'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';

// Types
type SimpleEvent = { id: string; name: string; startDate: string };
type Department = { id: number; name: string; nameAr?: string | null };

// Complete task form data matching actual task creation flow
export interface TaskFormData {
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  dueDate: string;
  priority: string;
  status: string;
  eventId: string;
  departmentId: string;
}

export const EMPTY_TASK_FORM: TaskFormData = {
  title: '',
  titleAr: '',
  description: '',
  descriptionAr: '',
  dueDate: '',
  priority: 'medium',
  status: 'pending',
  eventId: '',
  departmentId: '',
};

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}

function FormField({ label, children, required, hint }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface TaskIntakeFormProps {
  formData: TaskFormData;
  onChange: (field: keyof TaskFormData, value: string) => void;
}

export default function TaskIntakeForm({ formData, onChange }: TaskIntakeFormProps) {
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const isArabic = i18n.language === 'ar' || language === 'ar';

  // Fetch events
  const { data: events = [] } = useQuery<SimpleEvent[]>({
    queryKey: ['/api/events'],
  });

  // Fetch departments
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['/api/stakeholders'],
  });

  return (
    <div className="space-y-6">
      {/* Task Title */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('tasks.taskInfo', 'Task Information')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('tasks.taskTitle', 'Task Title')} required>
            <Input
              value={formData.title}
              onChange={(e) => onChange('title', e.target.value)}
              placeholder={t('tasks.placeholders.title', 'Enter task title')}
            />
          </FormField>
          <FormField label={t('tasks.titleAr', 'Title (Arabic)')}>
            <Input
              value={formData.titleAr}
              onChange={(e) => onChange('titleAr', e.target.value)}
              placeholder="عنوان المهمة"
              dir="rtl"
            />
          </FormField>
        </div>
      </div>

      {/* Descriptions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t('tasks.description', 'Description')}>
          <Textarea
            value={formData.description}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder={t('tasks.descriptionPlaceholder', 'Task details and requirements')}
            rows={3}
          />
        </FormField>
        <FormField label={t('tasks.descriptionAr', 'Description (Arabic)')}>
          <Textarea
            value={formData.descriptionAr}
            onChange={(e) => onChange('descriptionAr', e.target.value)}
            placeholder="تفاصيل ومتطلبات المهمة"
            rows={3}
            dir="rtl"
          />
        </FormField>
      </div>

      {/* Assignment */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('tasks.assignment', 'Assignment')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('tasks.assignToEvent', 'Assign to Event')} required hint={t('tasks.eventHint', 'Task will be linked to this event')}>
            <Select 
              value={formData.eventId} 
              onValueChange={(v) => onChange('eventId', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('tasks.selectEvent', 'Select event')} />
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name} ({event.startDate})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t('tasks.assignToDepartment', 'Assign to Department')} required hint={t('tasks.departmentHint', 'Department responsible for this task')}>
            <Select 
              value={formData.departmentId} 
              onValueChange={(v) => onChange('departmentId', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('tasks.selectDepartment', 'Select department')} />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={String(dept.id)}>
                    {isArabic && dept.nameAr ? dept.nameAr : dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </div>

      {/* Schedule and Priority */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('tasks.scheduleAndPriority', 'Schedule & Priority')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label={t('tasks.dueDate', 'Due Date')}>
            <Input
              type="date"
              value={formData.dueDate}
              onChange={(e) => onChange('dueDate', e.target.value)}
            />
          </FormField>
          <FormField label={t('tasks.fields.priority', 'Priority')}>
            <Select 
              value={formData.priority} 
              onValueChange={(v) => onChange('priority', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    {t('tasks.priority.high', 'High')}
                  </span>
                </SelectItem>
                <SelectItem value="medium">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-yellow-500" />
                    {t('tasks.priority.medium', 'Medium')}
                  </span>
                </SelectItem>
                <SelectItem value="low">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    {t('tasks.priority.low', 'Low')}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t('tasks.taskStatus', 'Status')}>
            <Select 
              value={formData.status} 
              onValueChange={(v) => onChange('status', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">{t('tasks.status.pending', 'Pending')}</SelectItem>
                <SelectItem value="in_progress">{t('tasks.status.in_progress', 'In Progress')}</SelectItem>
                <SelectItem value="completed">{t('tasks.status.completed', 'Completed')}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </div>
    </div>
  );
}
