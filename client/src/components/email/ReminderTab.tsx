import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Mail, ChevronDown, Palette, Save, Info, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useState } from 'react';
import { EmailPreviewModal } from './EmailPreviewModal';

interface ReminderTabProps {
  emailLanguage: 'en' | 'ar';
  reminderGreeting: string;
  setReminderGreeting: (value: string) => void;
  reminderSubject: string;
  setReminderSubject: (value: string) => void;
  reminderBody: string;
  setReminderBody: (value: string) => void;
  reminderBrandColor: string;
  setReminderBrandColor: (value: string) => void;
  reminderTextColor: string;
  setReminderTextColor: (value: string) => void;
  reminderBgColor: string;
  setReminderBgColor: (value: string) => void;
  reminderFontFamily: string;
  setReminderFontFamily: (value: string) => void;
  reminderFontSize: string;
  setReminderFontSize: (value: string) => void;
  reminderRequirementsTitle: string;
  setReminderRequirementsTitle: (value: string) => void;
  reminderRequirementsBrandColor: string;
  setReminderRequirementsBrandColor: (value: string) => void;
  reminderRequirementsTextColor: string;
  setReminderRequirementsTextColor: (value: string) => void;
  reminderRequirementsBgColor: string;
  setReminderRequirementsBgColor: (value: string) => void;
  reminderRequirementsFontFamily: string;
  setReminderRequirementsFontFamily: (value: string) => void;
  reminderRequirementsFontSize: string;
  setReminderRequirementsFontSize: (value: string) => void;
  reminderRequirementItemTemplate: string;
  setReminderRequirementItemTemplate: (value: string) => void;
  reminderFooter: string;
  setReminderFooter: (value: string) => void;
  reminderFooterBrandColor: string;
  setReminderFooterBrandColor: (value: string) => void;
  reminderFooterTextColor: string;
  setReminderFooterTextColor: (value: string) => void;
  reminderFooterBgColor: string;
  setReminderFooterBgColor: (value: string) => void;
  reminderFooterFontFamily: string;
  setReminderFooterFontFamily: (value: string) => void;
  reminderFooterFontSize: string;
  setReminderFooterFontSize: (value: string) => void;
  reminderStylingOpen: boolean;
  setReminderStylingOpen: (value: boolean) => void;
  reminderRequirementsStylingOpen: boolean;
  setReminderRequirementsStylingOpen: (value: boolean) => void;
  reminderFooterStylingOpen: boolean;
  setReminderFooterStylingOpen: (value: boolean) => void;
  reminderQuillRef: any;
  reminderFooterQuillRef: any;
  testEmailRecipient: string;
  setTestEmailRecipient: (value: string) => void;
  handleSaveReminderTemplate: () => void;
  testEmailMutation: any;
  saveSettingsMutation: any;
  TEMPLATE_VARIABLES: Array<{ key: string; description: string }>;
  FONT_FAMILIES: Array<{ value: string; label: string }>;
  FONT_SIZES: string[];
  insertVariable: (variable: string, quillRef: any) => void;
  replaceVariables: (template: string) => string;
  generatePreviewHtml: (body: string, brandColor: string, textColor: string, bgColor: string, fontFamily: string, fontSize: string, requirementsHtml?: string) => string;
  generateRequirementsPreviewHtml: (title: string, reqBrandColor: string, reqTextColor: string, reqBgColor: string, reqFontFamily: string, reqFontSize: string) => string;
  generateFooterPreviewHtml: (footerBody: string, footerBrandColor: string, footerTextColor: string, footerBgColor: string, footerFontFamily: string, footerFontSize: string) => string;
}

export default function ReminderTab(props: ReminderTabProps) {
  const { t } = useTranslation();
  const {
    emailLanguage,
    reminderGreeting,
    setReminderGreeting,
    reminderSubject,
    setReminderSubject,
    reminderBody,
    setReminderBody,
    reminderBrandColor,
    setReminderBrandColor,
    reminderTextColor,
    setReminderTextColor,
    reminderBgColor,
    setReminderBgColor,
    reminderFontFamily,
    setReminderFontFamily,
    reminderFontSize,
    setReminderFontSize,
    reminderRequirementsTitle,
    setReminderRequirementsTitle,
    reminderRequirementsBrandColor,
    setReminderRequirementsBrandColor,
    reminderRequirementsTextColor,
    setReminderRequirementsTextColor,
    reminderRequirementsBgColor,
    setReminderRequirementsBgColor,
    reminderRequirementsFontFamily,
    setReminderRequirementsFontFamily,
    reminderRequirementsFontSize,
    setReminderRequirementsFontSize,
    reminderRequirementItemTemplate,
    setReminderRequirementItemTemplate,
    reminderFooter,
    setReminderFooter,
    reminderFooterBrandColor,
    setReminderFooterBrandColor,
    reminderFooterTextColor,
    setReminderFooterTextColor,
    reminderFooterBgColor,
    setReminderFooterBgColor,
    reminderFooterFontFamily,
    setReminderFooterFontFamily,
    reminderFooterFontSize,
    setReminderFooterFontSize,
    reminderStylingOpen,
    setReminderStylingOpen,
    reminderRequirementsStylingOpen,
    setReminderRequirementsStylingOpen,
    reminderFooterStylingOpen,
    setReminderFooterStylingOpen,
    reminderQuillRef,
    reminderFooterQuillRef,
    testEmailRecipient,
    setTestEmailRecipient,
    handleSaveReminderTemplate,
    testEmailMutation,
    saveSettingsMutation,
    TEMPLATE_VARIABLES,
    FONT_FAMILIES,
    FONT_SIZES,
    insertVariable,
    replaceVariables,
    generatePreviewHtml,
    generateRequirementsPreviewHtml,
    generateFooterPreviewHtml,
  } = props;

  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  return (
    <>
      <Alert className="mb-6" data-testid="alert-reminder-variables">
        <Info className="h-4 w-4" />
        <AlertTitle>{t('emailConfig.reminderEmailTemplateVariables')}</AlertTitle>
        <AlertDescription>
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{t('emailConfig.eventVariables')}</p>
            <p className="text-muted-foreground">
              {`{{eventName}}, {{description}}, {{startDate}}, {{endDate}}, {{location}}, {{organizers}}, {{category}}, {{eventType}}, {{eventTypeRaw}}, {{eventScope}}, {{eventScopeRaw}}, {{url}}, {{expectedAttendance}}`}
            </p>
            <p className="font-semibold mt-3">{t('emailConfig.stakeholderVariables')}</p>
            <p className="text-muted-foreground">
              {`{{name}}, {{stakeholderName}}`}
            </p>
            <p className="font-semibold mt-3">{t('emailConfig.requirementItemTemplate')}</p>
            <p className="text-muted-foreground">
              {t('emailConfig.requirementItemTemplateDescription')} {`{{title}}, {{description}}, {{index}}, {{number}}`}
            </p>
          </div>
        </AlertDescription>
      </Alert>
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('emailConfig.reminderEmailTemplate')}</CardTitle>
            <CardDescription>{t('emailConfig.reminderEmailTemplateDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
              {/* Greeting */}
              <div className="space-y-2">
                <Label htmlFor="reminder-greeting">{t('emailConfig.greetingOptional')}</Label>
                <Textarea
                  id="reminder-greeting"
                  data-testid="input-reminderGreeting"
                  value={reminderGreeting}
                  onChange={(e) => setReminderGreeting(e.target.value)}
                  placeholder={t('emailConfig.reminderGreetingPlaceholder')}
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  {t('emailConfig.greetingOptionalDescription')}
                </p>
              </div>

              {/* Subject Line */}
              <div className="space-y-2">
                <Label htmlFor="reminder-subject">{t('emailConfig.subjectLine')}</Label>
                <div className="space-y-2">
                  <TooltipProvider>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {TEMPLATE_VARIABLES.map((v) => (
                        <Tooltip key={v.key}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="cursor-pointer hover-elevate"
                              onClick={() => {
                                const input = document.getElementById('reminder-subject') as HTMLInputElement;
                                if (input) {
                                  const pos = input.selectionStart || 0;
                                  const newValue = reminderSubject.slice(0, pos) + v.key + reminderSubject.slice(pos);
                                  setReminderSubject(newValue);
                                }
                              }}
                              data-testid={`badge-reminder-subject-${v.key}`}
                            >
                              {v.key}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{v.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </TooltipProvider>
                  <Input
                    id="reminder-subject"
                    value={reminderSubject}
                    onChange={(e) => setReminderSubject(e.target.value)}
                    placeholder={t('emailConfig.reminderSubjectPlaceholder')}
                    data-testid="input-reminder-subject"
                    dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}
                    style={{ textAlign: emailLanguage === 'ar' ? 'right' : 'left' }}
                  />
                </div>
              </div>

              {/* Email Styling Options */}
              <Collapsible open={reminderStylingOpen} onOpenChange={setReminderStylingOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full gap-2" data-testid="button-reminder-styling">
                    <Palette className="h-4 w-4" />
                    {t('emailConfig.emailStylingOptionsLabel')}
                    <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${reminderStylingOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reminder-brand-color">{t('emailConfig.brandColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="reminder-brand-color"
                          type="color"
                          value={reminderBrandColor}
                          onChange={(e) => setReminderBrandColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-reminder-brand-color"
                        />
                        <Input
                          value={reminderBrandColor}
                          onChange={(e) => setReminderBrandColor(e.target.value)}
                          placeholder="#BC9F6D"
                          data-testid="input-reminder-brand-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reminder-text-color">{t('emailConfig.textColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="reminder-text-color"
                          type="color"
                          value={reminderTextColor}
                          onChange={(e) => setReminderTextColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-reminder-text-color"
                        />
                        <Input
                          value={reminderTextColor}
                          onChange={(e) => setReminderTextColor(e.target.value)}
                          placeholder="#333333"
                          data-testid="input-reminder-text-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reminder-bg-color">{t('emailConfig.backgroundColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="reminder-bg-color"
                          type="color"
                          value={reminderBgColor}
                          onChange={(e) => setReminderBgColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-reminder-bg-color"
                        />
                        <Input
                          value={reminderBgColor}
                          onChange={(e) => setReminderBgColor(e.target.value)}
                          placeholder="#FFFFFF"
                          data-testid="input-reminder-bg-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reminder-font-family">{t('emailConfig.fontFamily')}</Label>
                      <Select value={reminderFontFamily} onValueChange={setReminderFontFamily}>
                        <SelectTrigger id="reminder-font-family" data-testid="select-reminder-font-family">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FONT_FAMILIES.map((font) => (
                            <SelectItem key={font.value} value={font.value}>
                              {font.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reminder-font-size">{t('emailConfig.fontSize')}</Label>
                      <Select value={reminderFontSize} onValueChange={setReminderFontSize}>
                        <SelectTrigger id="reminder-font-size" data-testid="select-reminder-font-size">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FONT_SIZES.map((size) => (
                            <SelectItem key={size} value={size}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Requirements Title */}
              <div className="space-y-2">
                <Label htmlFor="reminder-requirements-title">{t('emailConfig.requirementsSectionTitle')}</Label>
                <Input
                  id="reminder-requirements-title"
                  data-testid="input-reminder-requirements-title"
                  value={reminderRequirementsTitle}
                  onChange={(e) => setReminderRequirementsTitle(e.target.value)}
                  placeholder={t('emailConfig.requirementsSectionTitlePlaceholder')}
                  dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}
                  style={{ textAlign: emailLanguage === 'ar' ? 'right' : 'left' }}
                />
                <p className="text-sm text-muted-foreground">
                  {t('emailConfig.requirementsSectionTitleDescription')}
                </p>
              </div>

              {/* Requirements Section Styling */}
              <Collapsible open={reminderRequirementsStylingOpen} onOpenChange={setReminderRequirementsStylingOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full gap-2" data-testid="button-reminder-requirements-styling">
                    <Palette className="h-4 w-4" />
                    {t('emailConfig.requirementsSectionStyling')}
                    <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${reminderRequirementsStylingOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t('emailConfig.requirementsStylingDescription')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reminder-requirements-brand-color">{t('emailConfig.brandColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="reminder-requirements-brand-color"
                          type="color"
                          value={reminderRequirementsBrandColor}
                          onChange={(e) => setReminderRequirementsBrandColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-reminder-requirements-brand-color"
                        />
                        <Input
                          value={reminderRequirementsBrandColor}
                          onChange={(e) => setReminderRequirementsBrandColor(e.target.value)}
                          placeholder="#BC9F6D"
                          data-testid="input-reminder-requirements-brand-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reminder-requirements-text-color">{t('emailConfig.textColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="reminder-requirements-text-color"
                          type="color"
                          value={reminderRequirementsTextColor}
                          onChange={(e) => setReminderRequirementsTextColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-reminder-requirements-text-color"
                        />
                        <Input
                          value={reminderRequirementsTextColor}
                          onChange={(e) => setReminderRequirementsTextColor(e.target.value)}
                          placeholder="#333333"
                          data-testid="input-reminder-requirements-text-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reminder-requirements-bg-color">{t('emailConfig.backgroundColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="reminder-requirements-bg-color"
                          type="color"
                          value={reminderRequirementsBgColor}
                          onChange={(e) => setReminderRequirementsBgColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-reminder-requirements-bg-color"
                        />
                        <Input
                          value={reminderRequirementsBgColor}
                          onChange={(e) => setReminderRequirementsBgColor(e.target.value)}
                          placeholder="#F5F5F5"
                          data-testid="input-reminder-requirements-bg-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reminder-requirements-font-family">{t('emailConfig.fontFamily')}</Label>
                      <Select value={reminderRequirementsFontFamily} onValueChange={setReminderRequirementsFontFamily}>
                        <SelectTrigger id="reminder-requirements-font-family" data-testid="select-reminder-requirements-font-family">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FONT_FAMILIES.map((font) => (
                            <SelectItem key={font.value} value={font.value}>
                              {font.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reminder-requirements-font-size">{t('emailConfig.fontSize')}</Label>
                      <Select value={reminderRequirementsFontSize} onValueChange={setReminderRequirementsFontSize}>
                        <SelectTrigger id="reminder-requirements-font-size" data-testid="select-reminder-requirements-font-size">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FONT_SIZES.map((size) => (
                            <SelectItem key={size} value={size}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Requirement Item Template */}
              <div className="space-y-2">
                <Label htmlFor="reminder-requirement-item-template">{t('emailConfig.requirementItemTemplateOptional')}</Label>
                <Textarea
                  id="reminder-requirement-item-template"
                  data-testid="input-reminderRequirementItemTemplate"
                  value={reminderRequirementItemTemplate}
                  onChange={(e) => setReminderRequirementItemTemplate(e.target.value)}
                  placeholder="<li>{{number}}. <strong>{{title}}</strong> - {{description}}</li>"
                  rows={4}
                  dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}
                  style={{ textAlign: emailLanguage === 'ar' ? 'right' : 'left' }}
                />
                <p className="text-sm text-muted-foreground">
                  {t('emailConfig.requirementItemTemplateSupports')} {`{{title}}, {{description}}, {{index}}, {{number}}`}
                </p>
              </div>

              {/* Rich Text Editor */}
              <div className="space-y-2">
                <Label>{t('emailConfig.emailBodyLabel')}</Label>
                <div dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}>
                  <ReactQuill
                    ref={reminderQuillRef}
                    theme="snow"
                    value={reminderBody}
                    onChange={setReminderBody}
                    modules={{
                      toolbar: [
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ list: 'ordered' }, { list: 'bullet' }],
                        ['link', 'image'],
                        [{ align: [] }],
                        [{ color: [] }, { background: [] }],
                        ['clean'],
                      ],
                    }}
                    style={{ minHeight: '400px' }}
                  />
                </div>
              </div>

              {/* Template Variables */}
              <div className="space-y-2">
                <Label>{t('emailConfig.templateVariablesLabel')}</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('emailConfig.clickToInsertVariableLabel')}
                </p>
                <TooltipProvider>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <Tooltip key={v.key}>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="secondary"
                            className="cursor-pointer hover-elevate"
                            onClick={() => insertVariable(v.key, reminderQuillRef)}
                            data-testid={`badge-reminder-var-${v.key}`}
                          >
                            {v.key}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{v.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>
              </div>

              {/* Footer Customization */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-base font-medium">{t('emailConfig.footerCustomizationLabel')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('emailConfig.footerCustomizationDescriptionLabel')}
                  </p>
                </div>

                {/* Footer Rich Text Editor */}
                <div className="space-y-2">
                  <Label>{t('emailConfig.footerContentLabel')}</Label>
                  <div dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}>
                    <ReactQuill
                      ref={reminderFooterQuillRef}
                      theme="snow"
                      value={reminderFooter}
                      onChange={setReminderFooter}
                      modules={{
                        toolbar: [
                          ['bold', 'italic', 'underline'],
                          [{ list: 'ordered' }, { list: 'bullet' }],
                          ['link'],
                          [{ align: [] }],
                          ['clean'],
                        ],
                      }}
                      style={{ minHeight: '200px' }}
                    />
                  </div>
                </div>

                {/* Footer Template Variables */}
                <div className="space-y-2">
                  <Label>{t('emailConfig.insertTemplateVariablesLabel')}</Label>
                  <TooltipProvider>
                    <div className="flex flex-wrap gap-2">
                      {TEMPLATE_VARIABLES.map((v) => (
                        <Tooltip key={v.key}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="secondary"
                              className="cursor-pointer hover-elevate"
                              onClick={() => insertVariable(v.key, reminderFooterQuillRef)}
                              data-testid={`badge-reminder-footer-var-${v.key}`}
                            >
                              {v.key}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{v.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </TooltipProvider>
                </div>

                {/* Footer Styling Options */}
                <Collapsible open={reminderFooterStylingOpen} onOpenChange={setReminderFooterStylingOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full gap-2" data-testid="button-reminder-footer-styling">
                      <Palette className="h-4 w-4" />
                      {t('emailConfig.footerStylingOptionsLabel')}
                      <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${reminderFooterStylingOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="reminder-footer-brand-color">{t('emailConfig.brandColor')}</Label>
                        <div className="flex gap-2">
                          <Input
                            id="reminder-footer-brand-color"
                            type="color"
                            value={reminderFooterBrandColor}
                            onChange={(e) => setReminderFooterBrandColor(e.target.value)}
                            className="h-10 w-20"
                            data-testid="input-reminder-footer-brand-color"
                          />
                          <Input
                            value={reminderFooterBrandColor}
                            onChange={(e) => setReminderFooterBrandColor(e.target.value)}
                            placeholder="#BC9F6D"
                            data-testid="input-reminder-footer-brand-color-text"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reminder-footer-text-color">{t('emailConfig.textColor')}</Label>
                        <div className="flex gap-2">
                          <Input
                            id="reminder-footer-text-color"
                            type="color"
                            value={reminderFooterTextColor}
                            onChange={(e) => setReminderFooterTextColor(e.target.value)}
                            className="h-10 w-20"
                            data-testid="input-reminder-footer-text-color"
                          />
                          <Input
                            value={reminderFooterTextColor}
                            onChange={(e) => setReminderFooterTextColor(e.target.value)}
                            placeholder="#666666"
                            data-testid="input-reminder-footer-text-color-text"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reminder-footer-bg-color">{t('emailConfig.backgroundColor')}</Label>
                        <div className="flex gap-2">
                          <Input
                            id="reminder-footer-bg-color"
                            type="color"
                            value={reminderFooterBgColor}
                            onChange={(e) => setReminderFooterBgColor(e.target.value)}
                            className="h-10 w-20"
                            data-testid="input-reminder-footer-bg-color"
                          />
                          <Input
                            value={reminderFooterBgColor}
                            onChange={(e) => setReminderFooterBgColor(e.target.value)}
                            placeholder="#FFFFFF"
                            data-testid="input-reminder-footer-bg-color-text"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reminder-footer-font-family">{t('emailConfig.fontFamily')}</Label>
                        <Select value={reminderFooterFontFamily} onValueChange={setReminderFooterFontFamily}>
                          <SelectTrigger id="reminder-footer-font-family" data-testid="select-reminder-footer-font-family">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FONT_FAMILIES.map((font) => (
                              <SelectItem key={font.value} value={font.value}>
                                {font.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reminder-footer-font-size">{t('emailConfig.fontSize')}</Label>
                        <Select value={reminderFooterFontSize} onValueChange={setReminderFooterFontSize}>
                          <SelectTrigger id="reminder-footer-font-size" data-testid="select-reminder-footer-font-size">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FONT_SIZES.map((size) => (
                              <SelectItem key={size} value={size}>
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <div className="w-full space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder={t('emailConfig.testEmailRecipientPlaceholder')}
                    value={testEmailRecipient}
                    onChange={(e) => setTestEmailRecipient(e.target.value)}
                    data-testid="input-test-email-recipient-reminder"
                  />
                  <Button
                    onClick={() => testEmailMutation.mutate({ type: 'reminder', recipientEmail: testEmailRecipient })}
                    disabled={testEmailMutation.isPending || !testEmailRecipient}
                    variant="outline"
                    data-testid="button-send-test-reminder"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {t('emailConfig.sendTestLabel')}
                  </Button>
                </div>
                <Button
                  onClick={() => setPreviewModalOpen(true)}
                  variant="secondary"
                  className="w-full gap-2"
                  size="lg"
                  data-testid="button-preview-reminder"
                >
                  <Eye className="h-4 w-4" />
                  {t('emailConfig.previewEmail')}
                </Button>
                <Button
                  onClick={handleSaveReminderTemplate}
                  disabled={saveSettingsMutation.isPending}
                  data-testid="button-save-reminder"
                  className="w-full gap-2"
                  size="lg"
                >
                  <Save className="h-4 w-4" />
                  {t('emailConfig.saveReminderTemplate')}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      
      <EmailPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        templateType="reminder"
      />
    </>
  );
}
