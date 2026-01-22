'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiRequest } from '@/lib/queryClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Category } from '@/lib/types';

// Stakeholder types
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
  requirements: StakeholderRequirement[];
}

// Complete event form data matching EventForm.tsx
export interface EventFormData {
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  locationAr: string;
  organizers: string;
  organizersAr: string;
  url: string;
  categoryId: string;
  eventType: string;
  eventScope: string;
  expectedAttendance: string;
  // Department assignments
  selectedStakeholders: number[];
  stakeholderRequirements: Record<number, string[]>;
  customRequirements: Record<number, string>;
}

export const EMPTY_EVENT_FORM: EventFormData = {
  name: '',
  nameAr: '',
  description: '',
  descriptionAr: '',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  location: '',
  locationAr: '',
  organizers: '',
  organizersAr: '',
  url: '',
  categoryId: '',
  eventType: 'local',
  eventScope: 'external',
  expectedAttendance: '',
  selectedStakeholders: [],
  stakeholderRequirements: {},
  customRequirements: {},
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

interface EventIntakeFormProps {
  formData: EventFormData;
  onChange: (field: keyof EventFormData, value: string | number[] | Record<number, string[]> | Record<number, string>) => void;
}

export default function EventIntakeForm({ formData, onChange }: EventIntakeFormProps) {
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const isArabic = i18n.language === 'ar' || language === 'ar';

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  // Fetch stakeholders/departments
  const { data: stakeholders = [] } = useQuery<Stakeholder[]>({
    queryKey: ['/api/stakeholders'],
  });

  // Local state for stakeholder selections (synced with parent formData)
  const selectedStakeholders = formData.selectedStakeholders || [];
  const stakeholderRequirements = formData.stakeholderRequirements || {};
  const customRequirements = formData.customRequirements || {};

  const toggleStakeholder = async (stakeholderId: number) => {
    if (selectedStakeholders.includes(stakeholderId)) {
      // Unselecting - remove it
      const newSelected = selectedStakeholders.filter(id => id !== stakeholderId);
      onChange('selectedStakeholders', newSelected);
      return;
    }

    // Selecting - add the stakeholder
    const stakeholder = stakeholders.find(s => s.id === stakeholderId);
    const newSelected = [...selectedStakeholders, stakeholderId];
    onChange('selectedStakeholders', newSelected);

    // Auto-select default requirements
    if (stakeholder) {
      const defaultRequirements = stakeholder.requirements.filter(r => r.isDefault);
      if (defaultRequirements.length > 0) {
        const defaultReqIds = defaultRequirements.map(r => r.id.toString());
        const newReqs = { ...stakeholderRequirements, [stakeholderId]: defaultReqIds };
        onChange('stakeholderRequirements', newReqs);
      }
    }
  };

  const toggleRequirement = (stakeholderId: number, requirementId: number) => {
    const reqIdStr = requirementId.toString();
    const current = stakeholderRequirements[stakeholderId] || [];

    if (current.includes(reqIdStr)) {
      // Remove
      const newReqs = {
        ...stakeholderRequirements,
        [stakeholderId]: current.filter(id => id !== reqIdStr)
      };
      onChange('stakeholderRequirements', newReqs);
    } else {
      // Add
      const newReqs = {
        ...stakeholderRequirements,
        [stakeholderId]: [...current, reqIdStr]
      };
      onChange('stakeholderRequirements', newReqs);
    }
  };

  const setCustomRequirement = (stakeholderId: number, text: string) => {
    const newCustom = { ...customRequirements, [stakeholderId]: text };
    onChange('customRequirements', newCustom);
  };

  return (
    <div className="space-y-6">
      {/* Event Names */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('events.basicInfo', 'Basic Information')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('events.name', 'Event Name')} required>
            <Input
              value={formData.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder={t('events.namePlaceholder', 'Enter event name')}
            />
          </FormField>
          <FormField label={t('events.nameAr', 'Event Name (Arabic)')}>
            <Input
              value={formData.nameAr}
              onChange={(e) => onChange('nameAr', e.target.value)}
              placeholder="أدخل اسم الفعالية"
              dir="rtl"
            />
          </FormField>
        </div>
      </div>

      {/* Descriptions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t('events.description', 'Description')}>
          <Textarea
            value={formData.description}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder={t('events.descriptionPlaceholder', 'Event description')}
            rows={3}
          />
        </FormField>
        <FormField label={t('events.descriptionAr', 'Description (Arabic)')}>
          <Textarea
            value={formData.descriptionAr}
            onChange={(e) => onChange('descriptionAr', e.target.value)}
            placeholder="وصف الفعالية"
            rows={3}
            dir="rtl"
          />
        </FormField>
      </div>

      {/* Date and Time */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('events.dateTime', 'Date & Time')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label={t('events.startDate', 'Start Date')} required>
            <Input
              type="date"
              value={formData.startDate}
              onChange={(e) => onChange('startDate', e.target.value)}
            />
          </FormField>
          <FormField label={t('events.endDate', 'End Date')} required>
            <Input
              type="date"
              value={formData.endDate}
              onChange={(e) => onChange('endDate', e.target.value)}
            />
          </FormField>
          <FormField label={t('events.startTime', 'Start Time')} hint="HH:MM format">
            <Input
              type="time"
              value={formData.startTime}
              onChange={(e) => onChange('startTime', e.target.value)}
            />
          </FormField>
          <FormField label={t('events.endTime', 'End Time')} hint="HH:MM format">
            <Input
              type="time"
              value={formData.endTime}
              onChange={(e) => onChange('endTime', e.target.value)}
            />
          </FormField>
        </div>
      </div>

      {/* Location */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('events.locationSection', 'Location')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('events.location', 'Location')}>
            <Input
              value={formData.location}
              onChange={(e) => onChange('location', e.target.value)}
              placeholder={t('events.locationPlaceholder', 'Event location')}
            />
          </FormField>
          <FormField label={t('events.locationAr', 'Location (Arabic)')}>
            <Input
              value={formData.locationAr}
              onChange={(e) => onChange('locationAr', e.target.value)}
              placeholder="موقع الفعالية"
              dir="rtl"
            />
          </FormField>
        </div>
      </div>

      {/* Organizers */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t('events.organizers', 'Organizers')}>
          <Input
            value={formData.organizers}
            onChange={(e) => onChange('organizers', e.target.value)}
            placeholder={t('events.organizersPlaceholder', 'Event organizers')}
          />
        </FormField>
        <FormField label={t('events.organizersAr', 'Organizers (Arabic)')}>
          <Input
            value={formData.organizersAr}
            onChange={(e) => onChange('organizersAr', e.target.value)}
            placeholder="المنظمون"
            dir="rtl"
          />
        </FormField>
      </div>

      {/* Category and Classification */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('events.classification', 'Classification')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label={t('events.category', 'Category')}>
            <Select 
              value={formData.categoryId} 
              onValueChange={(v) => onChange('categoryId', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('events.selectCategory', 'Select category')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {isArabic && cat.nameAr ? cat.nameAr : cat.nameEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t('events.eventType', 'Event Type')}>
            <Select 
              value={formData.eventType} 
              onValueChange={(v) => onChange('eventType', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">{t('events.local', 'Local')}</SelectItem>
                <SelectItem value="international">{t('events.international', 'International')}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t('events.eventScope', 'Event Scope')}>
            <Select 
              value={formData.eventScope} 
              onValueChange={(v) => onChange('eventScope', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">{t('events.internal', 'Internal')}</SelectItem>
                <SelectItem value="external">{t('events.external', 'External')}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </div>

      {/* Additional Info */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('events.additionalInfo', 'Additional Information')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('events.url', 'Event URL')}>
            <Input
              type="url"
              value={formData.url}
              onChange={(e) => onChange('url', e.target.value)}
              placeholder="https://example.com/event"
            />
          </FormField>
          <FormField label={t('events.expectedAttendance', 'Expected Attendance')}>
            <Input
              type="number"
              value={formData.expectedAttendance}
              onChange={(e) => onChange('expectedAttendance', e.target.value)}
              placeholder={t('events.attendancePlaceholder', 'Number of expected attendees')}
            />
          </FormField>
        </div>
      </div>

      {/* Department Assignments */}
      {stakeholders.length > 0 && (
        <div className="space-y-4 border-t pt-6">
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t('departments.notificationTitle', 'Department Notifications')}
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              {t('departments.notificationDesc', 'Select departments to notify and their tasks')}
            </p>
          </div>
          
          <div className="space-y-3">
            {stakeholders.filter(s => s.active).map(stakeholder => (
              <div key={stakeholder.id} className="border rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`stakeholder-${stakeholder.id}`}
                    checked={selectedStakeholders.includes(stakeholder.id)}
                    onCheckedChange={() => toggleStakeholder(stakeholder.id)}
                  />
                  <Label htmlFor={`stakeholder-${stakeholder.id}`} className="font-medium cursor-pointer text-sm">
                    {isArabic && stakeholder.nameAr ? stakeholder.nameAr : stakeholder.name}
                  </Label>
                </div>
                
                {selectedStakeholders.includes(stakeholder.id) && (
                  <div className="mt-3 space-y-3 ps-6">
                    {stakeholder.requirements.length > 0 && (
                      <div>
                        <Label className="text-xs font-medium">{t('departments.requirements', 'Tasks')}:</Label>
                        <div className="space-y-1.5 mt-1.5">
                          {stakeholder.requirements.map(req => (
                            <div key={req.id} className="flex items-start gap-2">
                              <Checkbox
                                id={`requirement-${req.id}`}
                                checked={stakeholderRequirements[stakeholder.id]?.includes(req.id.toString()) || false}
                                onCheckedChange={() => toggleRequirement(stakeholder.id, req.id)}
                                className="mt-0.5"
                              />
                              <Label htmlFor={`requirement-${req.id}`} className="cursor-pointer">
                                <p className="text-xs font-medium">
                                  {isArabic && req.titleAr ? req.titleAr : req.title}
                                </p>
                                {(isArabic ? req.descriptionAr || req.description : req.description) && (
                                  <p className="text-[10px] text-muted-foreground">
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
                      <Label className="text-xs">{t('departments.customRequirements', 'Custom Requirements')}:</Label>
                      <Textarea
                        rows={2}
                        value={customRequirements[stakeholder.id] || ''}
                        onChange={(e) => setCustomRequirement(stakeholder.id, e.target.value)}
                        placeholder={t('departments.customRequirementsPlaceholder', 'Enter any custom requirements...')}
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
