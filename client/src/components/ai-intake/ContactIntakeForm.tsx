'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Check, ChevronsUpDown, Building, Briefcase, MapPin, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Organization, Position, Country } from '@/lib/types';

// Complete contact form data matching Contacts.tsx dialog
export interface ContactFormData {
  nameEn: string;
  nameAr: string;
  title: string;
  titleAr: string;
  email: string;
  phone: string;
  organizationId: string;
  organizationName: string; // For new org creation
  positionId: string;
  positionName: string; // For new position creation
  countryId: string;
  isEligibleSpeaker: boolean;
}

export const EMPTY_CONTACT_FORM: ContactFormData = {
  nameEn: '',
  nameAr: '',
  title: '',
  titleAr: '',
  email: '',
  phone: '',
  organizationId: '',
  organizationName: '',
  positionId: '',
  positionName: '',
  countryId: '',
  isEligibleSpeaker: false,
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

interface ContactIntakeFormProps {
  formData: ContactFormData;
  onChange: (field: keyof ContactFormData, value: string | boolean) => void;
}

export default function ContactIntakeForm({ formData, onChange }: ContactIntakeFormProps) {
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const isArabic = i18n.language === 'ar' || language === 'ar';
  
  const [orgOpen, setOrgOpen] = useState(false);
  const [posOpen, setPosOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [showNewPos, setShowNewPos] = useState(false);

  // Fetch organizations
  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ['organizations'],
  });

  // Fetch positions
  const { data: positions = [] } = useQuery<Position[]>({
    queryKey: ['positions'],
  });

  // Fetch countries
  const { data: countries = [] } = useQuery<Country[]>({
    queryKey: ['countries'],
  });

  const selectedOrg = organizations.find(org => String(org.id) === formData.organizationId);
  const selectedPos = positions.find(pos => String(pos.id) === formData.positionId);
  const selectedCountry = countries.find(c => String(c.id) === formData.countryId);

  const getOrgLabel = (org: Organization) => isArabic && org.nameAr ? org.nameAr : org.nameEn;
  const getPosLabel = (pos: Position) => isArabic && pos.nameAr ? pos.nameAr : pos.nameEn;
  const getCountryLabel = (country: Country) => isArabic && country.nameAr ? country.nameAr : country.nameEn;

  return (
    <div className="space-y-6">
      {/* Contact Name */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('contacts.basicInfo', 'Basic Information')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('contacts.nameEn', 'Name (English)')} required>
            <Input
              value={formData.nameEn}
              onChange={(e) => onChange('nameEn', e.target.value)}
              placeholder={t('contacts.namePlaceholder', 'Enter contact name')}
            />
          </FormField>
          <FormField label={t('contacts.nameAr', 'Name (Arabic)')}>
            <Input
              value={formData.nameAr}
              onChange={(e) => onChange('nameAr', e.target.value)}
              placeholder="أدخل اسم جهة الاتصال"
              dir="rtl"
            />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('contacts.title', 'Title')}>
            <Input
              value={formData.title}
              onChange={(e) => onChange('title', e.target.value)}
              placeholder={t('contacts.titlePlaceholder', 'e.g. CEO, Director')}
            />
          </FormField>
          <FormField label={t('contacts.titleAr', 'Title (Arabic)')}>
            <Input
              value={formData.titleAr}
              onChange={(e) => onChange('titleAr', e.target.value)}
              placeholder="المسمى الوظيفي"
              dir="rtl"
            />
          </FormField>
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('contacts.contactDetails', 'Contact Details')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('contacts.email', 'Email')}>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => onChange('email', e.target.value)}
              placeholder="email@example.com"
            />
          </FormField>
          <FormField label={t('contacts.phone', 'Phone')}>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => onChange('phone', e.target.value)}
              placeholder="+971-50-123-4567"
            />
          </FormField>
        </div>
      </div>

      {/* Organization */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('contacts.organization', 'Organization')}
          </h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowNewOrg(!showNewOrg);
              if (!showNewOrg) {
                onChange('organizationId', '');
              } else {
                onChange('organizationName', '');
              }
            }}
          >
            {showNewOrg ? t('contacts.selectExisting', 'Select Existing') : (
              <>
                <Plus className="h-3 w-3 mr-1" />
                {t('contacts.createNew', 'Create New')}
              </>
            )}
          </Button>
        </div>
        
        {showNewOrg ? (
          <FormField label={t('contacts.newOrgName', 'New Organization Name')}>
            <Input
              value={formData.organizationName}
              onChange={(e) => onChange('organizationName', e.target.value)}
              placeholder={t('contacts.newOrgPlaceholder', 'Enter new organization name')}
            />
          </FormField>
        ) : (
          <FormField label={t('contacts.selectOrganization', 'Select Organization')}>
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
                      {getOrgLabel(selectedOrg)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t('contacts.searchOrg', 'Search organizations...')}
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('contacts.searchOrg', 'Search organizations...')} />
                  <CommandList>
                    <CommandEmpty>{t('contacts.noOrgFound', 'No organization found.')}</CommandEmpty>
                    <CommandGroup>
                      {organizations.map((org) => (
                        <CommandItem
                          key={org.id}
                          value={getOrgLabel(org)}
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
                          {getOrgLabel(org)}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </FormField>
        )}
      </div>

      {/* Position */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('contacts.position', 'Position')}
          </h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowNewPos(!showNewPos);
              if (!showNewPos) {
                onChange('positionId', '');
              } else {
                onChange('positionName', '');
              }
            }}
          >
            {showNewPos ? t('contacts.selectExisting', 'Select Existing') : (
              <>
                <Plus className="h-3 w-3 mr-1" />
                {t('contacts.createNew', 'Create New')}
              </>
            )}
          </Button>
        </div>
        
        {showNewPos ? (
          <FormField label={t('contacts.newPosName', 'New Position Name')}>
            <Input
              value={formData.positionName}
              onChange={(e) => onChange('positionName', e.target.value)}
              placeholder={t('contacts.newPosPlaceholder', 'Enter new position name')}
            />
          </FormField>
        ) : (
          <FormField label={t('contacts.selectPosition', 'Select Position')}>
            <Popover open={posOpen} onOpenChange={setPosOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={posOpen}
                  className="w-full justify-between"
                >
                  {selectedPos ? (
                    <span className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      {getPosLabel(selectedPos)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t('contacts.searchPos', 'Search positions...')}
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('contacts.searchPos', 'Search positions...')} />
                  <CommandList>
                    <CommandEmpty>{t('contacts.noPosFound', 'No position found.')}</CommandEmpty>
                    <CommandGroup>
                      {positions.map((pos) => (
                        <CommandItem
                          key={pos.id}
                          value={getPosLabel(pos)}
                          onSelect={() => {
                            onChange('positionId', String(pos.id));
                            setPosOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.positionId === String(pos.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                          {getPosLabel(pos)}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </FormField>
        )}
      </div>

      {/* Country */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('contacts.location', 'Location')}
        </h4>
        <FormField label={t('contacts.country', 'Country')}>
          <Popover open={countryOpen} onOpenChange={setCountryOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={countryOpen}
                className="w-full justify-between"
              >
                {selectedCountry ? (
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {getCountryLabel(selectedCountry)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {t('contacts.selectCountry', 'Select country')}
                  </span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput placeholder={t('contacts.searchCountry', 'Search countries...')} />
                <CommandList>
                  <CommandEmpty>{t('contacts.noCountryFound', 'No country found.')}</CommandEmpty>
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
                        <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
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

      {/* Speaker eligibility */}
      <div className="flex items-center space-x-2 p-4 rounded-lg bg-muted/50">
        <Checkbox
          id="speaker"
          checked={formData.isEligibleSpeaker}
          onCheckedChange={(checked) => onChange('isEligibleSpeaker', !!checked)}
        />
        <div className="space-y-1">
          <label
            htmlFor="speaker"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            {t('contacts.eligibleSpeaker', 'Eligible as Speaker')}
          </label>
          <p className="text-xs text-muted-foreground">
            {t('contacts.eligibleSpeakerHint', 'Check if this contact can be selected as an event speaker')}
          </p>
        </div>
      </div>
    </div>
  );
}
