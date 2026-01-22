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

interface StakeholderTabProps {
  emailLanguage: 'en' | 'ar';
  stakeholderSubject: string;
  setStakeholderSubject: (value: string) => void;
  stakeholderBody: string;
  setStakeholderBody: (value: string) => void;
  stakeholderBrandColor: string;
  setStakeholderBrandColor: (value: string) => void;
  stakeholderTextColor: string;
  setStakeholderTextColor: (value: string) => void;
  stakeholderBgColor: string;
  setStakeholderBgColor: (value: string) => void;
  stakeholderFontFamily: string;
  setStakeholderFontFamily: (value: string) => void;
  stakeholderFontSize: string;
  setStakeholderFontSize: (value: string) => void;
  stakeholderRequirementsTitle: string;
  setStakeholderRequirementsTitle: (value: string) => void;
  stakeholderRequirementsBrandColor: string;
  setStakeholderRequirementsBrandColor: (value: string) => void;
  stakeholderRequirementsTextColor: string;
  setStakeholderRequirementsTextColor: (value: string) => void;
  stakeholderRequirementsBgColor: string;
  setStakeholderRequirementsBgColor: (value: string) => void;
  stakeholderRequirementsFontFamily: string;
  setStakeholderRequirementsFontFamily: (value: string) => void;
  stakeholderRequirementsFontSize: string;
  setStakeholderRequirementsFontSize: (value: string) => void;
  stakeholderRequirementItemTemplate: string;
  setStakeholderRequirementItemTemplate: (value: string) => void;
  stakeholderFooter: string;
  setStakeholderFooter: (value: string) => void;
  stakeholderFooterBrandColor: string;
  setStakeholderFooterBrandColor: (value: string) => void;
  stakeholderFooterTextColor: string;
  setStakeholderFooterTextColor: (value: string) => void;
  stakeholderFooterBgColor: string;
  setStakeholderFooterBgColor: (value: string) => void;
  stakeholderFooterFontFamily: string;
  setStakeholderFooterFontFamily: (value: string) => void;
  stakeholderFooterFontSize: string;
  setStakeholderFooterFontSize: (value: string) => void;
  stakeholderStylingOpen: boolean;
  setStakeholderStylingOpen: (value: boolean) => void;
  stakeholderRequirementsStylingOpen: boolean;
  setStakeholderRequirementsStylingOpen: (value: boolean) => void;
  stakeholderFooterStylingOpen: boolean;
  setStakeholderFooterStylingOpen: (value: boolean) => void;
  stakeholderQuillRef: any;
  stakeholderFooterQuillRef: any;
  testEmailRecipient: string;
  setTestEmailRecipient: (value: string) => void;
  handleSaveStakeholderTemplate: () => void;
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

export default function StakeholderTab(props: StakeholderTabProps) {
  const { t } = useTranslation();
  const {
    emailLanguage,
    stakeholderSubject,
    setStakeholderSubject,
    stakeholderBody,
    setStakeholderBody,
    stakeholderBrandColor,
    setStakeholderBrandColor,
    stakeholderTextColor,
    setStakeholderTextColor,
    stakeholderBgColor,
    setStakeholderBgColor,
    stakeholderFontFamily,
    setStakeholderFontFamily,
    stakeholderFontSize,
    setStakeholderFontSize,
    stakeholderRequirementsTitle,
    setStakeholderRequirementsTitle,
    stakeholderRequirementsBrandColor,
    setStakeholderRequirementsBrandColor,
    stakeholderRequirementsTextColor,
    setStakeholderRequirementsTextColor,
    stakeholderRequirementsBgColor,
    setStakeholderRequirementsBgColor,
    stakeholderRequirementsFontFamily,
    setStakeholderRequirementsFontFamily,
    stakeholderRequirementsFontSize,
    setStakeholderRequirementsFontSize,
    stakeholderRequirementItemTemplate,
    setStakeholderRequirementItemTemplate,
    stakeholderFooter,
    setStakeholderFooter,
    stakeholderFooterBrandColor,
    setStakeholderFooterBrandColor,
    stakeholderFooterTextColor,
    setStakeholderFooterTextColor,
    stakeholderFooterBgColor,
    setStakeholderFooterBgColor,
    stakeholderFooterFontFamily,
    setStakeholderFooterFontFamily,
    stakeholderFooterFontSize,
    setStakeholderFooterFontSize,
    stakeholderStylingOpen,
    setStakeholderStylingOpen,
    stakeholderRequirementsStylingOpen,
    setStakeholderRequirementsStylingOpen,
    stakeholderFooterStylingOpen,
    setStakeholderFooterStylingOpen,
    stakeholderQuillRef,
    stakeholderFooterQuillRef,
    testEmailRecipient,
    setTestEmailRecipient,
    handleSaveStakeholderTemplate,
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
      <Alert className="mb-6" data-testid="alert-stakeholder-variables">
        <Info className="h-4 w-4" />
        <AlertTitle>{t('emailConfig.stakeholderEmailTemplateVariables')}</AlertTitle>
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
            <p className="font-semibold mt-3">{t('emailConfig.placementControl')}</p>
            <p className="text-muted-foreground">
              {`{{requirements}}`} - {t('emailConfig.placementControlDescription')}
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
            <CardTitle>{t('emailConfig.stakeholderEmailTemplate')}</CardTitle>
            <CardDescription>{t('emailConfig.stakeholderEmailTemplateDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
              {/* Subject Line */}
              <div className="space-y-2">
                <Label htmlFor="stakeholder-subject">{t('emailConfig.subjectLine')}</Label>
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
                                const input = document.getElementById('stakeholder-subject') as HTMLInputElement;
                                if (input) {
                                  const pos = input.selectionStart || 0;
                                  const newValue = stakeholderSubject.slice(0, pos) + v.key + stakeholderSubject.slice(pos);
                                  setStakeholderSubject(newValue);
                                }
                              }}
                              data-testid={`badge-stakeholder-subject-${v.key}`}
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
                    id="stakeholder-subject"
                    value={stakeholderSubject}
                    onChange={(e) => setStakeholderSubject(e.target.value)}
                    placeholder={t('emailConfig.stakeholderSubjectPlaceholder')}
                    data-testid="input-stakeholder-subject"
                    dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}
                    style={{ textAlign: emailLanguage === 'ar' ? 'right' : 'left' }}
                  />
                </div>
              </div>

              {/* Email Styling Options */}
              <Collapsible open={stakeholderStylingOpen} onOpenChange={setStakeholderStylingOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full gap-2" data-testid="button-stakeholder-styling">
                    <Palette className="h-4 w-4" />
                    {t('emailConfig.emailStylingOptions')}
                    <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${stakeholderStylingOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="stakeholder-brand-color">{t('emailConfig.brandColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="stakeholder-brand-color"
                          type="color"
                          value={stakeholderBrandColor}
                          onChange={(e) => setStakeholderBrandColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-stakeholder-brand-color"
                        />
                        <Input
                          value={stakeholderBrandColor}
                          onChange={(e) => setStakeholderBrandColor(e.target.value)}
                          placeholder="#BC9F6D"
                          data-testid="input-stakeholder-brand-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stakeholder-text-color">{t('emailConfig.textColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="stakeholder-text-color"
                          type="color"
                          value={stakeholderTextColor}
                          onChange={(e) => setStakeholderTextColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-stakeholder-text-color"
                        />
                        <Input
                          value={stakeholderTextColor}
                          onChange={(e) => setStakeholderTextColor(e.target.value)}
                          placeholder="#333333"
                          data-testid="input-stakeholder-text-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stakeholder-bg-color">{t('emailConfig.backgroundColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="stakeholder-bg-color"
                          type="color"
                          value={stakeholderBgColor}
                          onChange={(e) => setStakeholderBgColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-stakeholder-bg-color"
                        />
                        <Input
                          value={stakeholderBgColor}
                          onChange={(e) => setStakeholderBgColor(e.target.value)}
                          placeholder="#FFFFFF"
                          data-testid="input-stakeholder-bg-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stakeholder-font-family">{t('emailConfig.fontFamily')}</Label>
                      <Select value={stakeholderFontFamily} onValueChange={setStakeholderFontFamily}>
                        <SelectTrigger id="stakeholder-font-family" data-testid="select-stakeholder-font-family">
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
                      <Label htmlFor="stakeholder-font-size">{t('emailConfig.fontSize')}</Label>
                      <Select value={stakeholderFontSize} onValueChange={setStakeholderFontSize}>
                        <SelectTrigger id="stakeholder-font-size" data-testid="select-stakeholder-font-size">
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
                <Label htmlFor="stakeholder-requirements-title">{t('emailConfig.requirementsSectionTitle')}</Label>
                <Input
                  id="stakeholder-requirements-title"
                  data-testid="input-stakeholder-requirements-title"
                  value={stakeholderRequirementsTitle}
                  onChange={(e) => setStakeholderRequirementsTitle(e.target.value)}
                  placeholder={t('emailConfig.requirementsSectionTitlePlaceholder')}
                  dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}
                  style={{ textAlign: emailLanguage === 'ar' ? 'right' : 'left' }}
                />
                <p className="text-sm text-muted-foreground">
                  {t('emailConfig.requirementsSectionTitleDescription')}
                </p>
              </div>

              {/* Requirements Section Styling */}
              <Collapsible open={stakeholderRequirementsStylingOpen} onOpenChange={setStakeholderRequirementsStylingOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full gap-2" data-testid="button-stakeholder-requirements-styling">
                    <Palette className="h-4 w-4" />
                    {t('emailConfig.requirementsStyling')}
                    <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${stakeholderRequirementsStylingOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t('emailConfig.requirementsStylingDescription')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="stakeholder-requirements-brand-color">{t('emailConfig.brandColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="stakeholder-requirements-brand-color"
                          type="color"
                          value={stakeholderRequirementsBrandColor}
                          onChange={(e) => setStakeholderRequirementsBrandColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-stakeholder-requirements-brand-color"
                        />
                        <Input
                          value={stakeholderRequirementsBrandColor}
                          onChange={(e) => setStakeholderRequirementsBrandColor(e.target.value)}
                          placeholder="#BC9F6D"
                          data-testid="input-stakeholder-requirements-brand-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stakeholder-requirements-text-color">{t('emailConfig.textColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="stakeholder-requirements-text-color"
                          type="color"
                          value={stakeholderRequirementsTextColor}
                          onChange={(e) => setStakeholderRequirementsTextColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-stakeholder-requirements-text-color"
                        />
                        <Input
                          value={stakeholderRequirementsTextColor}
                          onChange={(e) => setStakeholderRequirementsTextColor(e.target.value)}
                          placeholder="#333333"
                          data-testid="input-stakeholder-requirements-text-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stakeholder-requirements-bg-color">{t('emailConfig.backgroundColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="stakeholder-requirements-bg-color"
                          type="color"
                          value={stakeholderRequirementsBgColor}
                          onChange={(e) => setStakeholderRequirementsBgColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-stakeholder-requirements-bg-color"
                        />
                        <Input
                          value={stakeholderRequirementsBgColor}
                          onChange={(e) => setStakeholderRequirementsBgColor(e.target.value)}
                          placeholder="#F5F5F5"
                          data-testid="input-stakeholder-requirements-bg-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stakeholder-requirements-font-family">{t('emailConfig.fontFamily')}</Label>
                      <Select value={stakeholderRequirementsFontFamily} onValueChange={setStakeholderRequirementsFontFamily}>
                        <SelectTrigger id="stakeholder-requirements-font-family" data-testid="select-stakeholder-requirements-font-family">
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
                      <Label htmlFor="stakeholder-requirements-font-size">{t('emailConfig.fontSize')}</Label>
                      <Select value={stakeholderRequirementsFontSize} onValueChange={setStakeholderRequirementsFontSize}>
                        <SelectTrigger id="stakeholder-requirements-font-size" data-testid="select-stakeholder-requirements-font-size">
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
                <Label htmlFor="stakeholder-requirement-item-template">{t('emailConfig.requirementItemTemplate')}</Label>
                <Textarea
                  id="stakeholder-requirement-item-template"
                  data-testid="input-stakeholderRequirementItemTemplate"
                  value={stakeholderRequirementItemTemplate}
                  onChange={(e) => setStakeholderRequirementItemTemplate(e.target.value)}
                  placeholder="<li>{{number}}. <strong>{{title}}</strong> - {{description}}</li>"
                  rows={4}
                />
                <p className="text-sm text-muted-foreground">
                  {t('emailConfig.requirementItemTemplateDescription')} {`{{title}}, {{description}}, {{index}}, {{number}}`}
                </p>
              </div>

              {/* Rich Text Editor */}
              <div className="space-y-2">
                <Label>{t('emailConfig.emailBody')}</Label>
                <div dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}>
                  <ReactQuill
                    ref={stakeholderQuillRef}
                    theme="snow"
                    value={stakeholderBody}
                    onChange={setStakeholderBody}
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
                <Label>{t('emailConfig.availableTemplateVariables')}</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('emailConfig.clickToInsertVariable')}
                </p>
                <div className="bg-muted/50 p-3 rounded-md mb-3">
                  <p className="text-sm font-medium mb-1">{t('emailConfig.requirementsHandling')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('emailConfig.requirementsHandlingDescription')} <strong>{`{{requirements}}`}</strong>
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
                            onClick={() => insertVariable(v.key, stakeholderQuillRef)}
                            data-testid={`badge-stakeholder-var-${v.key}`}
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
                  <Label className="text-base font-medium">{t('emailConfig.footerCustomization')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('emailConfig.footerCustomizationDescription')}
                  </p>
                </div>

                {/* Footer Rich Text Editor */}
                <div className="space-y-2">
                  <Label>{t('emailConfig.footerContent')}</Label>
                  <div dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}>
                    <ReactQuill
                      ref={stakeholderFooterQuillRef}
                      theme="snow"
                      value={stakeholderFooter}
                      onChange={setStakeholderFooter}
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
                  <Label>{t('emailConfig.insertTemplateVariables')}</Label>
                  <TooltipProvider>
                    <div className="flex flex-wrap gap-2">
                      {TEMPLATE_VARIABLES.map((v) => (
                        <Tooltip key={v.key}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="secondary"
                              className="cursor-pointer hover-elevate"
                              onClick={() => insertVariable(v.key, stakeholderFooterQuillRef)}
                              data-testid={`badge-stakeholder-footer-var-${v.key}`}
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
                <Collapsible open={stakeholderFooterStylingOpen} onOpenChange={setStakeholderFooterStylingOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full gap-2" data-testid="button-stakeholder-footer-styling">
                      <Palette className="h-4 w-4" />
                      {t('emailConfig.footerStylingOptions')}
                      <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${stakeholderFooterStylingOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="stakeholder-footer-brand-color">{t('emailConfig.brandColor')}</Label>
                        <div className="flex gap-2">
                          <Input
                            id="stakeholder-footer-brand-color"
                            type="color"
                            value={stakeholderFooterBrandColor}
                            onChange={(e) => setStakeholderFooterBrandColor(e.target.value)}
                            className="h-10 w-20"
                            data-testid="input-stakeholder-footer-brand-color"
                          />
                          <Input
                            value={stakeholderFooterBrandColor}
                            onChange={(e) => setStakeholderFooterBrandColor(e.target.value)}
                            placeholder="#BC9F6D"
                            data-testid="input-stakeholder-footer-brand-color-text"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stakeholder-footer-text-color">{t('emailConfig.textColor')}</Label>
                        <div className="flex gap-2">
                          <Input
                            id="stakeholder-footer-text-color"
                            type="color"
                            value={stakeholderFooterTextColor}
                            onChange={(e) => setStakeholderFooterTextColor(e.target.value)}
                            className="h-10 w-20"
                            data-testid="input-stakeholder-footer-text-color"
                          />
                          <Input
                            value={stakeholderFooterTextColor}
                            onChange={(e) => setStakeholderFooterTextColor(e.target.value)}
                            placeholder="#666666"
                            data-testid="input-stakeholder-footer-text-color-text"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stakeholder-footer-bg-color">{t('emailConfig.backgroundColor')}</Label>
                        <div className="flex gap-2">
                          <Input
                            id="stakeholder-footer-bg-color"
                            type="color"
                            value={stakeholderFooterBgColor}
                            onChange={(e) => setStakeholderFooterBgColor(e.target.value)}
                            className="h-10 w-20"
                            data-testid="input-stakeholder-footer-bg-color"
                          />
                          <Input
                            value={stakeholderFooterBgColor}
                            onChange={(e) => setStakeholderFooterBgColor(e.target.value)}
                            placeholder="#FFFFFF"
                            data-testid="input-stakeholder-footer-bg-color-text"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stakeholder-footer-font-family">{t('emailConfig.fontFamily')}</Label>
                        <Select value={stakeholderFooterFontFamily} onValueChange={setStakeholderFooterFontFamily}>
                          <SelectTrigger id="stakeholder-footer-font-family" data-testid="select-stakeholder-footer-font-family">
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
                        <Label htmlFor="stakeholder-footer-font-size">{t('emailConfig.fontSize')}</Label>
                        <Select value={stakeholderFooterFontSize} onValueChange={setStakeholderFooterFontSize}>
                          <SelectTrigger id="stakeholder-footer-font-size" data-testid="select-stakeholder-footer-font-size">
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
                    placeholder={t('emailConfig.testEmailPlaceholder')}
                    value={testEmailRecipient}
                    onChange={(e) => setTestEmailRecipient(e.target.value)}
                    data-testid="input-test-email-recipient-stakeholder"
                  />
                  <Button
                    onClick={() => testEmailMutation.mutate({ type: 'stakeholder', recipientEmail: testEmailRecipient })}
                    disabled={testEmailMutation.isPending || !testEmailRecipient}
                    variant="outline"
                    data-testid="button-send-test-stakeholder"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {t('emailConfig.sendTest')}
                  </Button>
                </div>
                <Button
                  onClick={() => setPreviewModalOpen(true)}
                  variant="secondary"
                  className="w-full gap-2"
                  size="lg"
                  data-testid="button-preview-stakeholder"
                >
                  <Eye className="h-4 w-4" />
                  {t('emailConfig.previewEmail')}
                </Button>
                <Button
                  onClick={handleSaveStakeholderTemplate}
                  disabled={saveSettingsMutation.isPending}
                  data-testid="button-save-stakeholder"
                  className="w-full gap-2"
                  size="lg"
                >
                  <Save className="h-4 w-4" />
                  {saveSettingsMutation.isPending ? t('emailConfig.saving') : t('emailConfig.saveStakeholderTemplate')}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      
      <EmailPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        templateType="stakeholder"
      />
    </>
  );
}
