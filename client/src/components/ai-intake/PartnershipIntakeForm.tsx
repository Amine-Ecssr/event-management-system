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
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Building, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

// Types matching Partnerships.tsx
interface Organization {
  id: number;
  nameEn: string;
  nameAr: string | null;
  isPartner: boolean;
  countryId?: number | null;
}

interface PartnershipType {
  id: number;
  nameEn: string;
  nameAr: string | null;
}

interface Country {
  id: number;
  code: string;
  nameEn: string;
  nameAr: string | null;
}

// Complete partnership form data matching Partnerships.tsx dialog
export interface PartnershipFormData {
  // Organization selection or creation
  organizationId: string;
  organizationName: string;
  organizationNameAr: string;
  isNewOrganization: boolean;
  // Partnership details
  partnershipTypeId: string;
  countryId: string;
  partnershipStatus: string;
  partnershipStartDate: string;
  partnershipEndDate: string;
  partnershipSignedDate: string;
  agreementSignedBy: string;
  agreementSignedByUs: string;
  website: string;
  partnershipNotes: string;
}

export const EMPTY_PARTNERSHIP_FORM: PartnershipFormData = {
  organizationId: '',
  organizationName: '',
  organizationNameAr: '',
  isNewOrganization: true,
  partnershipTypeId: '',
  countryId: '',
  partnershipStatus: 'pending',
  partnershipStartDate: '',
  partnershipEndDate: '',
  partnershipSignedDate: '',
  agreementSignedBy: '',
  agreementSignedByUs: '',
  website: '',
  partnershipNotes: '',
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

interface PartnershipIntakeFormProps {
  formData: PartnershipFormData;
  onChange: (field: keyof PartnershipFormData, value: string | boolean) => void;
}

export default function PartnershipIntakeForm({ formData, onChange }: PartnershipIntakeFormProps) {
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const isArabic = i18n.language === 'ar' || language === 'ar';
  const [orgOpen, setOrgOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);

  // Fetch organizations (non-partner ones)
  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
  });

  // Fetch partnership types
  const { data: partnershipTypes = [] } = useQuery<PartnershipType[]>({
    queryKey: ['/api/partnership-types'],
  });

  // Fetch countries
  const { data: countries = [] } = useQuery<Country[]>({
    queryKey: ['/api/countries'],
  });

  // Filter non-partner organizations for selection
  const availableOrganizations = organizations.filter(org => !org.isPartner);
  
  const selectedOrg = organizations.find(org => String(org.id) === formData.organizationId);
  const selectedCountry = countries.find(c => String(c.id) === formData.countryId);

  const getCountryLabel = (country: Country) => {
    return isArabic && country.nameAr ? country.nameAr : country.nameEn;
  };

  return (
    <div className="space-y-6">
      {/* Organization Selection */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('partnerships.organization', 'Organization')}
        </h4>
        
        {/* Toggle between existing and new org */}
        <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
          <Button
            type="button"
            variant={!formData.isNewOrganization ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              onChange('isNewOrganization', false);
              onChange('organizationName', '');
              onChange('organizationNameAr', '');
            }}
          >
            {t('partnerships.selectExisting', 'Select Existing')}
          </Button>
          <Button
            type="button"
            variant={formData.isNewOrganization ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              onChange('isNewOrganization', true);
              onChange('organizationId', '');
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('partnerships.createNew', 'Create New')}
          </Button>
        </div>

        {!formData.isNewOrganization ? (
          <FormField label={t('partnerships.selectOrganization', 'Select Organization')} required>
            <Popover open={orgOpen} onOpenChange={setOrgOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={orgOpen}
                  className="w-full justify-between"
                >
                  {selectedOrg ? (
                    <span className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      {isArabic && selectedOrg.nameAr ? selectedOrg.nameAr : selectedOrg.nameEn}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t('partnerships.searchOrganization', 'Search organizations...')}
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('partnerships.searchOrganization', 'Search organizations...')} />
                  <CommandList>
                    <CommandEmpty>{t('partnerships.noOrgFound', 'No organization found.')}</CommandEmpty>
                    <CommandGroup>
                      {availableOrganizations.map((org) => (
                        <CommandItem
                          key={org.id}
                          value={isArabic && org.nameAr ? org.nameAr : org.nameEn}
                          onSelect={() => {
                            onChange('organizationId', String(org.id));
                            setOrgOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.organizationId === String(org.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <Building className="mr-2 h-4 w-4 text-muted-foreground" />
                          {isArabic && org.nameAr ? org.nameAr : org.nameEn}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </FormField>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('partnerships.organizationName', 'Organization Name')} required>
              <Input
                value={formData.organizationName}
                onChange={(e) => onChange('organizationName', e.target.value)}
                placeholder={t('partnerships.orgNamePlaceholder', 'Enter organization name')}
              />
            </FormField>
            <FormField label={t('partnerships.organizationNameAr', 'Organization Name (Arabic)')}>
              <Input
                value={formData.organizationNameAr}
                onChange={(e) => onChange('organizationNameAr', e.target.value)}
                placeholder="اسم المنظمة"
                dir="rtl"
              />
            </FormField>
          </div>
        )}
      </div>

      {/* Partnership Type and Country */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('partnerships.partnershipDetails', 'Partnership Details')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('partnerships.partnershipType', 'Partnership Type')}>
            <Select 
              value={formData.partnershipTypeId} 
              onValueChange={(v) => onChange('partnershipTypeId', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('partnerships.selectType', 'Select type')} />
              </SelectTrigger>
              <SelectContent>
                {partnershipTypes.map((type) => (
                  <SelectItem key={type.id} value={String(type.id)}>
                    {isArabic && type.nameAr ? type.nameAr : type.nameEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t('partnerships.country', 'Country')}>
            <Popover open={countryOpen} onOpenChange={setCountryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={countryOpen}
                  className="w-full justify-between"
                >
                  {selectedCountry ? getCountryLabel(selectedCountry) : (
                    <span className="text-muted-foreground">
                      {t('partnerships.selectCountry', 'Select country')}
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('partnerships.searchCountry', 'Search countries...')} />
                  <CommandList>
                    <CommandEmpty>{t('partnerships.noCountryFound', 'No country found.')}</CommandEmpty>
                    <CommandGroup>
                      {countries.map((country) => (
                        <CommandItem
                          key={country.id}
                          value={getCountryLabel(country)}
                          onSelect={() => {
                            onChange('countryId', String(country.id));
                            setCountryOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.countryId === String(country.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {getCountryLabel(country)}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </FormField>
        </div>
      </div>

      {/* Status and Dates */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('partnerships.statusAndDates', 'Status & Dates')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label={t('partnerships.status', 'Status')}>
            <Select 
              value={formData.partnershipStatus} 
              onValueChange={(v) => onChange('partnershipStatus', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t('partnerships.statusActive', 'Active')}</SelectItem>
                <SelectItem value="pending">{t('partnerships.statusPending', 'Pending')}</SelectItem>
                <SelectItem value="inactive">{t('partnerships.statusInactive', 'Inactive')}</SelectItem>
                <SelectItem value="expired">{t('partnerships.statusExpired', 'Expired')}</SelectItem>
                <SelectItem value="terminated">{t('partnerships.statusTerminated', 'Terminated')}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t('partnerships.signedDate', 'Signed Date')}>
            <Input
              type="date"
              value={formData.partnershipSignedDate}
              onChange={(e) => onChange('partnershipSignedDate', e.target.value)}
            />
          </FormField>
          <FormField label={t('partnerships.startDate', 'Start Date')}>
            <Input
              type="date"
              value={formData.partnershipStartDate}
              onChange={(e) => onChange('partnershipStartDate', e.target.value)}
            />
          </FormField>
          <FormField label={t('partnerships.endDate', 'End Date')}>
            <Input
              type="date"
              value={formData.partnershipEndDate}
              onChange={(e) => onChange('partnershipEndDate', e.target.value)}
            />
          </FormField>
        </div>
      </div>

      {/* Signatories */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('partnerships.signatories', 'Signatories')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField 
            label={t('partnerships.signedByPartner', 'Signed By (Partner)')} 
            hint={t('partnerships.signedByPartnerHint', 'Name of signatory from partner side')}
          >
            <Input
              value={formData.agreementSignedBy}
              onChange={(e) => onChange('agreementSignedBy', e.target.value)}
              placeholder={t('partnerships.signedByPlaceholder', 'Enter name')}
            />
          </FormField>
          <FormField 
            label={t('partnerships.signedByUs', 'Signed By (ECSSR)')} 
            hint={t('partnerships.signedByUsHint', 'Name of ECSSR signatory')}
          >
            <Input
              value={formData.agreementSignedByUs}
              onChange={(e) => onChange('agreementSignedByUs', e.target.value)}
              placeholder={t('partnerships.signedByPlaceholder', 'Enter name')}
            />
          </FormField>
        </div>
      </div>

      {/* Website and Notes */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('partnerships.additionalInfo', 'Additional Information')}
        </h4>
        <FormField label={t('partnerships.website', 'Website')}>
          <Input
            type="url"
            value={formData.website}
            onChange={(e) => onChange('website', e.target.value)}
            placeholder="https://partner-organization.com"
          />
        </FormField>
        <FormField label={t('partnerships.notes', 'Notes')}>
          <Textarea
            value={formData.partnershipNotes}
            onChange={(e) => onChange('partnershipNotes', e.target.value)}
            placeholder={t('partnerships.notesPlaceholder', 'Partnership notes and details...')}
            rows={3}
          />
        </FormField>
      </div>
    </div>
  );
}
