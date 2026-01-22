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

interface ManagementTabProps {
  emailLanguage: 'en' | 'ar';
  managementSummaryGreeting: string;
  setManagementSummaryGreeting: (value: string) => void;
  managementSummarySubject: string;
  setManagementSummarySubject: (value: string) => void;
  managementSummaryBody: string;
  setManagementSummaryBody: (value: string) => void;
  managementSummaryBrandColor: string;
  setManagementSummaryBrandColor: (value: string) => void;
  managementSummaryTextColor: string;
  setManagementSummaryTextColor: (value: string) => void;
  managementSummaryBgColor: string;
  setManagementSummaryBgColor: (value: string) => void;
  managementSummaryFontFamily: string;
  setManagementSummaryFontFamily: (value: string) => void;
  managementSummaryFontSize: string;
  setManagementSummaryFontSize: (value: string) => void;
  managementSummaryRequirementsTitle: string;
  setManagementSummaryRequirementsTitle: (value: string) => void;
  managementSummaryRequirementsBrandColor: string;
  setManagementSummaryRequirementsBrandColor: (value: string) => void;
  managementSummaryRequirementsTextColor: string;
  setManagementSummaryRequirementsTextColor: (value: string) => void;
  managementSummaryRequirementsBgColor: string;
  setManagementSummaryRequirementsBgColor: (value: string) => void;
  managementSummaryRequirementsFontFamily: string;
  setManagementSummaryRequirementsFontFamily: (value: string) => void;
  managementSummaryRequirementsFontSize: string;
  setManagementSummaryRequirementsFontSize: (value: string) => void;
  managementSummaryStakeholderTemplate: string;
  setManagementSummaryStakeholderTemplate: (value: string) => void;
  managementSummaryStakeholderSeparator: string;
  setManagementSummaryStakeholderSeparator: (value: string) => void;
  managementSummaryRequirementItemTemplate: string;
  setManagementSummaryRequirementItemTemplate: (value: string) => void;
  managementSummaryFooter: string;
  setManagementSummaryFooter: (value: string) => void;
  managementSummaryFooterBrandColor: string;
  setManagementSummaryFooterBrandColor: (value: string) => void;
  managementSummaryFooterTextColor: string;
  setManagementSummaryFooterTextColor: (value: string) => void;
  managementSummaryFooterBgColor: string;
  setManagementSummaryFooterBgColor: (value: string) => void;
  managementSummaryFooterFontFamily: string;
  setManagementSummaryFooterFontFamily: (value: string) => void;
  managementSummaryFooterFontSize: string;
  setManagementSummaryFooterFontSize: (value: string) => void;
  managementStylingOpen: boolean;
  setManagementStylingOpen: (value: boolean) => void;
  managementRequirementsStylingOpen: boolean;
  setManagementRequirementsStylingOpen: (value: boolean) => void;
  managementFooterStylingOpen: boolean;
  setManagementFooterStylingOpen: (value: boolean) => void;
  managementQuillRef: any;
  managementFooterQuillRef: any;
  testEmailRecipient: string;
  setTestEmailRecipient: (value: string) => void;
  handleSaveManagementTemplate: () => void;
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

export default function ManagementTab(props: ManagementTabProps) {
  const { t } = useTranslation();
  const {
    emailLanguage,
    managementSummaryGreeting,
    setManagementSummaryGreeting,
    managementSummarySubject,
    setManagementSummarySubject,
    managementSummaryBody,
    setManagementSummaryBody,
    managementSummaryBrandColor,
    setManagementSummaryBrandColor,
    managementSummaryTextColor,
    setManagementSummaryTextColor,
    managementSummaryBgColor,
    setManagementSummaryBgColor,
    managementSummaryFontFamily,
    setManagementSummaryFontFamily,
    managementSummaryFontSize,
    setManagementSummaryFontSize,
    managementSummaryRequirementsTitle,
    setManagementSummaryRequirementsTitle,
    managementSummaryRequirementsBrandColor,
    setManagementSummaryRequirementsBrandColor,
    managementSummaryRequirementsTextColor,
    setManagementSummaryRequirementsTextColor,
    managementSummaryRequirementsBgColor,
    setManagementSummaryRequirementsBgColor,
    managementSummaryRequirementsFontFamily,
    setManagementSummaryRequirementsFontFamily,
    managementSummaryRequirementsFontSize,
    setManagementSummaryRequirementsFontSize,
    managementSummaryStakeholderTemplate,
    setManagementSummaryStakeholderTemplate,
    managementSummaryStakeholderSeparator,
    setManagementSummaryStakeholderSeparator,
    managementSummaryRequirementItemTemplate,
    setManagementSummaryRequirementItemTemplate,
    managementSummaryFooter,
    setManagementSummaryFooter,
    managementSummaryFooterBrandColor,
    setManagementSummaryFooterBrandColor,
    managementSummaryFooterTextColor,
    setManagementSummaryFooterTextColor,
    managementSummaryFooterBgColor,
    setManagementSummaryFooterBgColor,
    managementSummaryFooterFontFamily,
    setManagementSummaryFooterFontFamily,
    managementSummaryFooterFontSize,
    setManagementSummaryFooterFontSize,
    managementStylingOpen,
    setManagementStylingOpen,
    managementRequirementsStylingOpen,
    setManagementRequirementsStylingOpen,
    managementFooterStylingOpen,
    setManagementFooterStylingOpen,
    managementQuillRef,
    managementFooterQuillRef,
    testEmailRecipient,
    setTestEmailRecipient,
    handleSaveManagementTemplate,
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
      <Alert className="mb-6" data-testid="alert-management-variables">
        <Info className="h-4 w-4" />
        <AlertTitle>{t('emailConfig.managementSummaryTemplateVariables')}</AlertTitle>
        <AlertDescription>
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{t('emailConfig.eventVariables')}</p>
            <p className="text-muted-foreground">
              {`{{eventName}}, {{description}}, {{startDate}}, {{endDate}}, {{location}}, {{organizers}}, {{category}}, {{eventType}}, {{eventTypeRaw}}, {{eventScope}}, {{eventScopeRaw}}, {{url}}, {{expectedAttendance}}`}
            </p>
            <p className="font-semibold mt-3">{t('emailConfig.summaryVariables')}</p>
            <p className="text-muted-foreground">
              {`{{stakeholderCount}}, {{stakeholderNames}}`}
            </p>
            <p className="font-semibold mt-3">{t('emailConfig.placementControl')}</p>
            <p className="text-muted-foreground">
              {`{{requirements}}`} - {t('emailConfig.placementControlDescription')}
            </p>
            <p className="font-semibold mt-3">{t('emailConfig.stakeholderTemplate')}</p>
            <p className="text-muted-foreground">
              {t('emailConfig.stakeholderTemplateDescription')}: {`{{stakeholderName}}, {{emails}}, {{emailsList}}, {{requirementsList}}, {{selectedRequirementsCount}}, {{customRequirements}}`}
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
            <CardTitle>{t('emailConfig.managementSummaryTemplate')}</CardTitle>
            <CardDescription>{t('emailConfig.managementSummaryTemplateDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
              {/* Greeting */}
              <div className="space-y-2">
                <Label htmlFor="management-greeting">{t('emailConfig.greetingOptional')}</Label>
                <Textarea
                  id="management-greeting"
                  data-testid="input-managementSummaryGreeting"
                  value={managementSummaryGreeting}
                  onChange={(e) => setManagementSummaryGreeting(e.target.value)}
                  placeholder="Dear Team, this event involves {{stakeholderCount}} departments: {{stakeholderNames}}."
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  {t('emailConfig.greetingOptionalSupportsDescription')}
                </p>
              </div>

              {/* Subject Line */}
              <div className="space-y-2">
                <Label htmlFor="management-subject">{t('emailConfig.subjectLine')}</Label>
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
                                const input = document.getElementById('management-subject') as HTMLInputElement;
                                if (input) {
                                  const pos = input.selectionStart || 0;
                                  const newValue = managementSummarySubject.slice(0, pos) + v.key + managementSummarySubject.slice(pos);
                                  setManagementSummarySubject(newValue);
                                }
                              }}
                              data-testid={`badge-management-subject-${v.key}`}
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
                    id="management-subject"
                    value={managementSummarySubject}
                    onChange={(e) => setManagementSummarySubject(e.target.value)}
                    placeholder="Management Summary: {{eventName}}"
                    data-testid="input-management-subject"
                    dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}
                    style={{ textAlign: emailLanguage === 'ar' ? 'right' : 'left' }}
                  />
                </div>
              </div>

              {/* Email Styling Options */}
              <Collapsible open={managementStylingOpen} onOpenChange={setManagementStylingOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full gap-2" data-testid="button-management-styling">
                    <Palette className="h-4 w-4" />
                    {t('emailConfig.emailStylingOptionsLabel')}
                    <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${managementStylingOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="management-brand-color">{t('emailConfig.brandColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="management-brand-color"
                          type="color"
                          value={managementSummaryBrandColor}
                          onChange={(e) => setManagementSummaryBrandColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-management-brand-color"
                        />
                        <Input
                          value={managementSummaryBrandColor}
                          onChange={(e) => setManagementSummaryBrandColor(e.target.value)}
                          placeholder="#BC9F6D"
                          data-testid="input-management-brand-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="management-text-color">{t('emailConfig.textColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="management-text-color"
                          type="color"
                          value={managementSummaryTextColor}
                          onChange={(e) => setManagementSummaryTextColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-management-text-color"
                        />
                        <Input
                          value={managementSummaryTextColor}
                          onChange={(e) => setManagementSummaryTextColor(e.target.value)}
                          placeholder="#333333"
                          data-testid="input-management-text-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="management-bg-color">{t('emailConfig.backgroundColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="management-bg-color"
                          type="color"
                          value={managementSummaryBgColor}
                          onChange={(e) => setManagementSummaryBgColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-management-bg-color"
                        />
                        <Input
                          value={managementSummaryBgColor}
                          onChange={(e) => setManagementSummaryBgColor(e.target.value)}
                          placeholder="#FFFFFF"
                          data-testid="input-management-bg-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="management-font-family">{t('emailConfig.fontFamily')}</Label>
                      <Select value={managementSummaryFontFamily} onValueChange={setManagementSummaryFontFamily}>
                        <SelectTrigger id="management-font-family" data-testid="select-management-font-family">
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
                      <Label htmlFor="management-font-size">{t('emailConfig.fontSize')}</Label>
                      <Select value={managementSummaryFontSize} onValueChange={setManagementSummaryFontSize}>
                        <SelectTrigger id="management-font-size" data-testid="select-management-font-size">
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
                <Label htmlFor="management-requirements-title">{t('emailConfig.requirementsSectionTitle')}</Label>
                <Input
                  id="management-requirements-title"
                  data-testid="input-management-requirements-title"
                  value={managementSummaryRequirementsTitle}
                  onChange={(e) => setManagementSummaryRequirementsTitle(e.target.value)}
                  placeholder={t('emailConfig.stakeholderAssignmentsTitlePlaceholder')}
                  dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}
                  style={{ textAlign: emailLanguage === 'ar' ? 'right' : 'left' }}
                />
                <p className="text-sm text-muted-foreground">
                  {t('emailConfig.requirementsSectionTitleDescription')}
                </p>
              </div>

              {/* Requirements Section Styling */}
              <Collapsible open={managementRequirementsStylingOpen} onOpenChange={setManagementRequirementsStylingOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full gap-2" data-testid="button-management-requirements-styling">
                    <Palette className="h-4 w-4" />
                    {t('emailConfig.requirementsSectionStyling')}
                    <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${managementRequirementsStylingOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t('emailConfig.requirementsStylingDescription')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="management-requirements-brand-color">{t('emailConfig.brandColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="management-requirements-brand-color"
                          type="color"
                          value={managementSummaryRequirementsBrandColor}
                          onChange={(e) => setManagementSummaryRequirementsBrandColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-management-requirements-brand-color"
                        />
                        <Input
                          value={managementSummaryRequirementsBrandColor}
                          onChange={(e) => setManagementSummaryRequirementsBrandColor(e.target.value)}
                          placeholder="#BC9F6D"
                          data-testid="input-management-requirements-brand-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="management-requirements-text-color">{t('emailConfig.textColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="management-requirements-text-color"
                          type="color"
                          value={managementSummaryRequirementsTextColor}
                          onChange={(e) => setManagementSummaryRequirementsTextColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-management-requirements-text-color"
                        />
                        <Input
                          value={managementSummaryRequirementsTextColor}
                          onChange={(e) => setManagementSummaryRequirementsTextColor(e.target.value)}
                          placeholder="#333333"
                          data-testid="input-management-requirements-text-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="management-requirements-bg-color">{t('emailConfig.backgroundColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="management-requirements-bg-color"
                          type="color"
                          value={managementSummaryRequirementsBgColor}
                          onChange={(e) => setManagementSummaryRequirementsBgColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-management-requirements-bg-color"
                        />
                        <Input
                          value={managementSummaryRequirementsBgColor}
                          onChange={(e) => setManagementSummaryRequirementsBgColor(e.target.value)}
                          placeholder="#F5F5F5"
                          data-testid="input-management-requirements-bg-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="management-requirements-font-family">{t('emailConfig.fontFamily')}</Label>
                      <Select value={managementSummaryRequirementsFontFamily} onValueChange={setManagementSummaryRequirementsFontFamily}>
                        <SelectTrigger id="management-requirements-font-family" data-testid="select-management-requirements-font-family">
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
                      <Label htmlFor="management-requirements-font-size">{t('emailConfig.fontSize')}</Label>
                      <Select value={managementSummaryRequirementsFontSize} onValueChange={setManagementSummaryRequirementsFontSize}>
                        <SelectTrigger id="management-requirements-font-size" data-testid="select-management-requirements-font-size">
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

              {/* Stakeholder Template */}
              <div className="space-y-2">
                <Label htmlFor="management-stakeholder-template">{t('emailConfig.stakeholderTemplate')}</Label>
                <Textarea
                  id="management-stakeholder-template"
                  data-testid="input-managementSummaryStakeholderTemplate"
                  value={managementSummaryStakeholderTemplate}
                  onChange={(e) => setManagementSummaryStakeholderTemplate(e.target.value)}
                  placeholder='<div class="stakeholder"><h3>{{stakeholderName}}</h3><p>Contact: {{emails}}</p>{{requirementsList}}</div>'
                  rows={4}
                  dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}
                  style={{ textAlign: emailLanguage === 'ar' ? 'right' : 'left' }}
                />
                <p className="text-sm text-muted-foreground">
                  {t('emailConfig.stakeholderTemplateDescription')}: {`{{stakeholderName}}, {{emails}}, {{emailsList}}, {{requirementsList}}, {{selectedRequirementsCount}}, {{customRequirements}}`}
                </p>
              </div>

              {/* Stakeholder Separator */}
              <div className="space-y-2">
                <Label htmlFor="management-stakeholder-separator">{t('emailConfig.stakeholderSeparator')}</Label>
                <Textarea
                  id="management-stakeholder-separator"
                  data-testid="input-managementSummaryStakeholderSeparator"
                  value={managementSummaryStakeholderSeparator}
                  onChange={(e) => setManagementSummaryStakeholderSeparator(e.target.value)}
                  placeholder='<hr style="margin: 20px 0;" />'
                  rows={2}
                  dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}
                  style={{ textAlign: emailLanguage === 'ar' ? 'right' : 'left' }}
                />
                <p className="text-sm text-muted-foreground">
                  {t('emailConfig.stakeholderSeparatorDescription')}
                </p>
              </div>

              {/* Requirement Item Template */}
              <div className="space-y-2">
                <Label htmlFor="management-requirement-item-template">{t('emailConfig.requirementItemTemplateOptional')}</Label>
                <Textarea
                  id="management-requirement-item-template"
                  data-testid="input-managementSummaryRequirementItemTemplate"
                  value={managementSummaryRequirementItemTemplate}
                  onChange={(e) => setManagementSummaryRequirementItemTemplate(e.target.value)}
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
                    ref={managementQuillRef}
                    theme="snow"
                    value={managementSummaryBody}
                    onChange={setManagementSummaryBody}
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
                <Label>{t('emailConfig.availableTemplateVariablesLabel')}</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('emailConfig.variablesForEventInfo')}
                </p>
                <div className="bg-muted/50 p-3 rounded-md mb-3">
                  <p className="text-sm font-medium mb-1">{t('emailConfig.stakeholderAssignmentsHandling')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('emailConfig.stakeholderAssignmentsHandlingDescription')}
                  </p>
                </div>
                <TooltipProvider>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <Tooltip key={v.key}>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="secondary"
                            className="cursor-pointer hover-elevate"
                            onClick={() => insertVariable(v.key, managementQuillRef)}
                            data-testid={`badge-management-var-${v.key}`}
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
                      ref={managementFooterQuillRef}
                      theme="snow"
                      value={managementSummaryFooter}
                      onChange={setManagementSummaryFooter}
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
                              onClick={() => insertVariable(v.key, managementFooterQuillRef)}
                              data-testid={`badge-management-footer-var-${v.key}`}
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
                <Collapsible open={managementFooterStylingOpen} onOpenChange={setManagementFooterStylingOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full gap-2" data-testid="button-management-footer-styling">
                      <Palette className="h-4 w-4" />
                      {t('emailConfig.footerStylingOptionsLabel')}
                      <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${managementFooterStylingOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="management-footer-brand-color">{t('emailConfig.brandColor')}</Label>
                        <div className="flex gap-2">
                          <Input
                            id="management-footer-brand-color"
                            type="color"
                            value={managementSummaryFooterBrandColor}
                            onChange={(e) => setManagementSummaryFooterBrandColor(e.target.value)}
                            className="h-10 w-20"
                            data-testid="input-management-footer-brand-color"
                          />
                          <Input
                            value={managementSummaryFooterBrandColor}
                            onChange={(e) => setManagementSummaryFooterBrandColor(e.target.value)}
                            placeholder="#BC9F6D"
                            data-testid="input-management-footer-brand-color-text"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="management-footer-text-color">{t('emailConfig.textColor')}</Label>
                        <div className="flex gap-2">
                          <Input
                            id="management-footer-text-color"
                            type="color"
                            value={managementSummaryFooterTextColor}
                            onChange={(e) => setManagementSummaryFooterTextColor(e.target.value)}
                            className="h-10 w-20"
                            data-testid="input-management-footer-text-color"
                          />
                          <Input
                            value={managementSummaryFooterTextColor}
                            onChange={(e) => setManagementSummaryFooterTextColor(e.target.value)}
                            placeholder="#666666"
                            data-testid="input-management-footer-text-color-text"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="management-footer-bg-color">{t('emailConfig.backgroundColor')}</Label>
                        <div className="flex gap-2">
                          <Input
                            id="management-footer-bg-color"
                            type="color"
                            value={managementSummaryFooterBgColor}
                            onChange={(e) => setManagementSummaryFooterBgColor(e.target.value)}
                            className="h-10 w-20"
                            data-testid="input-management-footer-bg-color"
                          />
                          <Input
                            value={managementSummaryFooterBgColor}
                            onChange={(e) => setManagementSummaryFooterBgColor(e.target.value)}
                            placeholder="#FFFFFF"
                            data-testid="input-management-footer-bg-color-text"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="management-footer-font-family">{t('emailConfig.fontFamily')}</Label>
                        <Select value={managementSummaryFooterFontFamily} onValueChange={setManagementSummaryFooterFontFamily}>
                          <SelectTrigger id="management-footer-font-family" data-testid="select-management-footer-font-family">
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
                        <Label htmlFor="management-footer-font-size">{t('emailConfig.fontSize')}</Label>
                        <Select value={managementSummaryFooterFontSize} onValueChange={setManagementSummaryFooterFontSize}>
                          <SelectTrigger id="management-footer-font-size" data-testid="select-management-footer-font-size">
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
                    data-testid="input-test-email-recipient-management"
                  />
                  <Button
                    onClick={() => testEmailMutation.mutate({ type: 'management', recipientEmail: testEmailRecipient })}
                    disabled={testEmailMutation.isPending || !testEmailRecipient}
                    variant="outline"
                    data-testid="button-send-test-management"
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
                  data-testid="button-preview-management"
                >
                  <Eye className="h-4 w-4" />
                  {t('emailConfig.previewEmail')}
                </Button>
                <Button
                  onClick={handleSaveManagementTemplate}
                  disabled={saveSettingsMutation.isPending}
                  data-testid="button-save-management"
                  className="w-full gap-2"
                  size="lg"
                >
                  <Save className="h-4 w-4" />
                  {t('emailConfig.saveManagementTemplate')}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      
      <EmailPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        templateType="management"
      />
    </>
  );
}
