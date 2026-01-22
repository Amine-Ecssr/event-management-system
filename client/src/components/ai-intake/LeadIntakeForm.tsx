'use client';

import { useTranslation } from 'react-i18next';
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

// Complete lead form data matching LeadManagement.tsx dialog
export interface LeadFormData {
  name: string;
  nameAr: string;
  email: string;
  phone: string;
  type: string;
  status: string;
  organizationName: string;
  notes: string;
  notesAr: string;
}

export const EMPTY_LEAD_FORM: LeadFormData = {
  name: '',
  nameAr: '',
  email: '',
  phone: '',
  type: 'lead',
  status: 'active',
  organizationName: '',
  notes: '',
  notesAr: '',
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

interface LeadIntakeFormProps {
  formData: LeadFormData;
  onChange: (field: keyof LeadFormData, value: string) => void;
}

export default function LeadIntakeForm({ formData, onChange }: LeadIntakeFormProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Lead Name */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('leads.basicInfo', 'Basic Information')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('leads.name', 'Lead Name')} required>
            <Input
              value={formData.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder={t('leads.namePlaceholder', 'Enter lead name')}
            />
          </FormField>
          <FormField label={t('leads.nameAr', 'Name (Arabic)')}>
            <Input
              value={formData.nameAr}
              onChange={(e) => onChange('nameAr', e.target.value)}
              placeholder="اسم العميل المحتمل"
              dir="rtl"
            />
          </FormField>
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('leads.contactInfo', 'Contact Information')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('leads.email', 'Email')}>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => onChange('email', e.target.value)}
              placeholder="email@example.com"
            />
          </FormField>
          <FormField label={t('leads.phone', 'Phone')}>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => onChange('phone', e.target.value)}
              placeholder="+971-50-123-4567"
            />
          </FormField>
        </div>
      </div>

      {/* Classification */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('leads.classification', 'Classification')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label={t('leads.type', 'Lead Type')}>
            <Select 
              value={formData.type} 
              onValueChange={(v) => onChange('type', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">{t('leads.typeLead', 'Lead')}</SelectItem>
                <SelectItem value="partner">{t('leads.typePartner', 'Partner')}</SelectItem>
                <SelectItem value="customer">{t('leads.typeCustomer', 'Customer')}</SelectItem>
                <SelectItem value="vendor">{t('leads.typeVendor', 'Vendor')}</SelectItem>
                <SelectItem value="other">{t('leads.typeOther', 'Other')}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t('leads.status', 'Status')}>
            <Select 
              value={formData.status} 
              onValueChange={(v) => onChange('status', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t('leads.statusActive', 'Active')}</SelectItem>
                <SelectItem value="in_progress">{t('leads.statusInProgress', 'In Progress')}</SelectItem>
                <SelectItem value="inactive">{t('leads.statusInactive', 'Inactive')}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t('leads.organization', 'Organization')}>
            <Input
              value={formData.organizationName}
              onChange={(e) => onChange('organizationName', e.target.value)}
              placeholder={t('leads.orgPlaceholder', 'Company name')}
            />
          </FormField>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('leads.notes', 'Notes')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('leads.notesEn', 'Notes (English)')}>
            <Textarea
              value={formData.notes}
              onChange={(e) => onChange('notes', e.target.value)}
              placeholder={t('leads.notesPlaceholder', 'Additional notes about this lead...')}
              rows={4}
            />
          </FormField>
          <FormField label={t('leads.notesAr', 'Notes (Arabic)')}>
            <Textarea
              value={formData.notesAr}
              onChange={(e) => onChange('notesAr', e.target.value)}
              placeholder="ملاحظات إضافية..."
              rows={4}
              dir="rtl"
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}
