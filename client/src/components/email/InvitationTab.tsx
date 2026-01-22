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

interface InvitationTabProps {
  emailLanguage: 'en' | 'ar';
  invitationGreeting: string;
  setInvitationGreeting: (value: string) => void;
  invitationSubject: string;
  setInvitationSubject: (value: string) => void;
  invitationBody: string;
  setInvitationBody: (value: string) => void;
  invitationBrandColor: string;
  setInvitationBrandColor: (value: string) => void;
  invitationTextColor: string;
  setInvitationTextColor: (value: string) => void;
  invitationBgColor: string;
  setInvitationBgColor: (value: string) => void;
  invitationFontFamily: string;
  setInvitationFontFamily: (value: string) => void;
  invitationFontSize: string;
  setInvitationFontSize: (value: string) => void;
  invitationFooter: string;
  setInvitationFooter: (value: string) => void;
  invitationFooterBrandColor: string;
  setInvitationFooterBrandColor: (value: string) => void;
  invitationFooterTextColor: string;
  setInvitationFooterTextColor: (value: string) => void;
  invitationFooterBgColor: string;
  setInvitationFooterBgColor: (value: string) => void;
  invitationFooterFontFamily: string;
  setInvitationFooterFontFamily: (value: string) => void;
  invitationFooterFontSize: string;
  setInvitationFooterFontSize: (value: string) => void;
  invitationStylingOpen: boolean;
  setInvitationStylingOpen: (value: boolean) => void;
  invitationFooterStylingOpen: boolean;
  setInvitationFooterStylingOpen: (value: boolean) => void;
  invitationQuillRef: any;
  invitationFooterQuillRef: any;
  testEmailRecipient: string;
  setTestEmailRecipient: (value: string) => void;
  handleSaveInvitationTemplate: () => void;
  testEmailMutation: any;
  saveSettingsMutation: any;
  TEMPLATE_VARIABLES: Array<{ key: string; description: string }>;
  FONT_FAMILIES: Array<{ value: string; label: string }>;
  FONT_SIZES: string[];
  insertVariable: (variable: string, quillRef: any) => void;
  replaceVariables: (template: string) => string;
  generatePreviewHtml: (body: string, brandColor: string, textColor: string, bgColor: string, fontFamily: string, fontSize: string) => string;
  generateFooterPreviewHtml: (footerBody: string, footerBrandColor: string, footerTextColor: string, footerBgColor: string, footerFontFamily: string, footerFontSize: string) => string;
}

export default function InvitationTab(props: InvitationTabProps) {
  const { t } = useTranslation();
  const {
    emailLanguage,
    invitationGreeting,
    setInvitationGreeting,
    invitationSubject,
    setInvitationSubject,
    invitationBody,
    setInvitationBody,
    invitationBrandColor,
    setInvitationBrandColor,
    invitationTextColor,
    setInvitationTextColor,
    invitationBgColor,
    setInvitationBgColor,
    invitationFontFamily,
    setInvitationFontFamily,
    invitationFontSize,
    setInvitationFontSize,
    invitationFooter,
    setInvitationFooter,
    invitationFooterBrandColor,
    setInvitationFooterBrandColor,
    invitationFooterTextColor,
    setInvitationFooterTextColor,
    invitationFooterBgColor,
    setInvitationFooterBgColor,
    invitationFooterFontFamily,
    setInvitationFooterFontFamily,
    invitationFooterFontSize,
    setInvitationFooterFontSize,
    invitationStylingOpen,
    setInvitationStylingOpen,
    invitationFooterStylingOpen,
    setInvitationFooterStylingOpen,
    invitationQuillRef,
    invitationFooterQuillRef,
    testEmailRecipient,
    setTestEmailRecipient,
    handleSaveInvitationTemplate,
    testEmailMutation,
    saveSettingsMutation,
    TEMPLATE_VARIABLES,
    FONT_FAMILIES,
    FONT_SIZES,
    insertVariable,
    replaceVariables,
    generatePreviewHtml,
    generateFooterPreviewHtml,
  } = props;

  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  return (
    <>
      <Alert className="mb-6" data-testid="alert-invitation-variables">
        <Info className="h-4 w-4" />
        <AlertTitle>{t('emailConfig.invitationEmailTemplateVariables')}</AlertTitle>
        <AlertDescription>
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{t('emailConfig.eventVariables')}</p>
            <p className="text-muted-foreground">
              {`{{eventName}}, {{description}}, {{startDate}}, {{endDate}}, {{location}}, {{organizers}}, {{category}}, {{eventType}}, {{eventTypeRaw}}, {{eventScope}}, {{eventScopeRaw}}, {{url}}, {{expectedAttendance}}`}
            </p>
            <p className="font-semibold mt-3">{t('emailConfig.inviteeVariables')}</p>
            <p className="text-muted-foreground">
              {`{{inviteeName}}, {{inviteeTitle}}, {{inviteeOrganization}}`}
            </p>
          </div>
        </AlertDescription>
      </Alert>
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('emailConfig.invitationEmailTemplate')}</CardTitle>
            <CardDescription>{t('emailConfig.invitationEmailTemplateDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
              {/* Greeting */}
              <div className="space-y-2">
                <Label htmlFor="invitation-greeting">{t('emailConfig.greetingOptional')}</Label>
                <Textarea
                  id="invitation-greeting"
                  data-testid="input-invitationGreeting"
                  value={invitationGreeting}
                  onChange={(e) => setInvitationGreeting(e.target.value)}
                  placeholder={t('emailConfig.invitationGreetingPlaceholder')}
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  {t('emailConfig.greetingOptionalDescription')}
                </p>
              </div>

              {/* Subject Line */}
              <div className="space-y-2">
                <Label htmlFor="invitation-subject">{t('emailConfig.subjectLine')}</Label>
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
                                const input = document.getElementById('invitation-subject') as HTMLInputElement;
                                if (input) {
                                  const pos = input.selectionStart || 0;
                                  const newValue = invitationSubject.slice(0, pos) + v.key + invitationSubject.slice(pos);
                                  setInvitationSubject(newValue);
                                }
                              }}
                              data-testid={`badge-invitation-subject-${v.key}`}
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
                    id="invitation-subject"
                    value={invitationSubject}
                    onChange={(e) => setInvitationSubject(e.target.value)}
                    placeholder={t('emailConfig.invitationSubjectPlaceholder')}
                    data-testid="input-invitation-subject"
                    dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}
                    style={{ textAlign: emailLanguage === 'ar' ? 'right' : 'left' }}
                  />
                </div>
              </div>

              {/* Email Styling Options */}
              <Collapsible open={invitationStylingOpen} onOpenChange={setInvitationStylingOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full gap-2" data-testid="button-invitation-styling">
                    <Palette className="h-4 w-4" />
                    {t('emailConfig.emailStylingOptionsLabel')}
                    <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${invitationStylingOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="invitation-brand-color">{t('emailConfig.brandColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="invitation-brand-color"
                          type="color"
                          value={invitationBrandColor}
                          onChange={(e) => setInvitationBrandColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-invitation-brand-color"
                        />
                        <Input
                          value={invitationBrandColor}
                          onChange={(e) => setInvitationBrandColor(e.target.value)}
                          placeholder="#BC9F6D"
                          data-testid="input-invitation-brand-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="invitation-text-color">{t('emailConfig.textColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="invitation-text-color"
                          type="color"
                          value={invitationTextColor}
                          onChange={(e) => setInvitationTextColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-invitation-text-color"
                        />
                        <Input
                          value={invitationTextColor}
                          onChange={(e) => setInvitationTextColor(e.target.value)}
                          placeholder="#333333"
                          data-testid="input-invitation-text-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="invitation-bg-color">{t('emailConfig.backgroundColor')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="invitation-bg-color"
                          type="color"
                          value={invitationBgColor}
                          onChange={(e) => setInvitationBgColor(e.target.value)}
                          className="h-10 w-20"
                          data-testid="input-invitation-bg-color"
                        />
                        <Input
                          value={invitationBgColor}
                          onChange={(e) => setInvitationBgColor(e.target.value)}
                          placeholder="#F9F9F9"
                          data-testid="input-invitation-bg-color-text"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="invitation-font-family">{t('emailConfig.fontFamily')}</Label>
                      <Select value={invitationFontFamily} onValueChange={setInvitationFontFamily}>
                        <SelectTrigger id="invitation-font-family" data-testid="select-invitation-font-family">
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
                      <Label htmlFor="invitation-font-size">{t('emailConfig.fontSize')}</Label>
                      <Select value={invitationFontSize} onValueChange={setInvitationFontSize}>
                        <SelectTrigger id="invitation-font-size" data-testid="select-invitation-font-size">
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

              {/* Email Body */}
              <div className="space-y-2">
                <Label htmlFor="invitation-body">{t('emailConfig.emailBody')}</Label>
                <TooltipProvider>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <Tooltip key={v.key}>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className="cursor-pointer hover-elevate"
                            onClick={() => insertVariable(v.key, invitationQuillRef)}
                            data-testid={`badge-invitation-body-${v.key}`}
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
                <ReactQuill
                  ref={invitationQuillRef}
                  theme="snow"
                  value={invitationBody}
                  onChange={setInvitationBody}
                  className="h-48 mb-12"
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline', 'strike'],
                      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                      [{ 'align': [] }],
                      ['link'],
                      ['clean']
                    ]
                  }}
                />
              </div>
          </CardContent>
        </Card>

        {/* Footer Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('emailConfig.footerSection')}</CardTitle>
            <CardDescription>{t('emailConfig.footerSectionDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Footer Styling Options */}
            <Collapsible open={invitationFooterStylingOpen} onOpenChange={setInvitationFooterStylingOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full gap-2" data-testid="button-invitation-footer-styling">
                  <Palette className="h-4 w-4" />
                  {t('emailConfig.footerStylingOptionsLabel')}
                  <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${invitationFooterStylingOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invitation-footer-brand-color">{t('emailConfig.brandColor')}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="invitation-footer-brand-color"
                        type="color"
                        value={invitationFooterBrandColor}
                        onChange={(e) => setInvitationFooterBrandColor(e.target.value)}
                        className="h-10 w-20"
                        data-testid="input-invitation-footer-brand-color"
                      />
                      <Input
                        value={invitationFooterBrandColor}
                        onChange={(e) => setInvitationFooterBrandColor(e.target.value)}
                        placeholder="#BC9F6D"
                        data-testid="input-invitation-footer-brand-color-text"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invitation-footer-text-color">{t('emailConfig.textColor')}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="invitation-footer-text-color"
                        type="color"
                        value={invitationFooterTextColor}
                        onChange={(e) => setInvitationFooterTextColor(e.target.value)}
                        className="h-10 w-20"
                        data-testid="input-invitation-footer-text-color"
                      />
                      <Input
                        value={invitationFooterTextColor}
                        onChange={(e) => setInvitationFooterTextColor(e.target.value)}
                        placeholder="#666666"
                        data-testid="input-invitation-footer-text-color-text"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invitation-footer-bg-color">{t('emailConfig.backgroundColor')}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="invitation-footer-bg-color"
                        type="color"
                        value={invitationFooterBgColor}
                        onChange={(e) => setInvitationFooterBgColor(e.target.value)}
                        className="h-10 w-20"
                        data-testid="input-invitation-footer-bg-color"
                      />
                      <Input
                        value={invitationFooterBgColor}
                        onChange={(e) => setInvitationFooterBgColor(e.target.value)}
                        placeholder="#F0F0F0"
                        data-testid="input-invitation-footer-bg-color-text"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invitation-footer-font-family">{t('emailConfig.fontFamily')}</Label>
                    <Select value={invitationFooterFontFamily} onValueChange={setInvitationFooterFontFamily}>
                      <SelectTrigger id="invitation-footer-font-family" data-testid="select-invitation-footer-font-family">
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
                    <Label htmlFor="invitation-footer-font-size">{t('emailConfig.fontSize')}</Label>
                    <Select value={invitationFooterFontSize} onValueChange={setInvitationFooterFontSize}>
                      <SelectTrigger id="invitation-footer-font-size" data-testid="select-invitation-footer-font-size">
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

            {/* Footer Body */}
            <div className="space-y-2">
              <Label htmlFor="invitation-footer-body">{t('emailConfig.footerBody')}</Label>
              <TooltipProvider>
                <div className="flex flex-wrap gap-1 mb-2">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <Tooltip key={v.key}>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="cursor-pointer hover-elevate"
                          onClick={() => insertVariable(v.key, invitationFooterQuillRef)}
                          data-testid={`badge-invitation-footer-${v.key}`}
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
              <ReactQuill
                ref={invitationFooterQuillRef}
                theme="snow"
                value={invitationFooter}
                onChange={setInvitationFooter}
                className="h-32 mb-12"
                modules={{
                  toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['link'],
                    ['clean']
                  ]
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('emailConfig.testAndSaveLabel')}</CardTitle>
            <CardDescription>{t('emailConfig.testAndSaveDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={() => setPreviewModalOpen(true)}
                variant="outline"
                className="gap-2"
                data-testid="button-preview-invitation-email"
              >
                <Eye className="h-4 w-4" />
                {t('emailConfig.previewEmail')}
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="test-email-recipient">{t('emailConfig.testEmailRecipient')}</Label>
              <div className="flex gap-2">
                <Input
                  id="test-email-recipient"
                  type="email"
                  value={testEmailRecipient}
                  onChange={(e) => setTestEmailRecipient(e.target.value)}
                  placeholder="test@example.com"
                  data-testid="input-test-email-recipient"
                />
                <Button
                  onClick={() => {
                    testEmailMutation.mutate({
                      type: 'invitation',
                      recipient: testEmailRecipient,
                    });
                  }}
                  disabled={testEmailMutation.isPending || !testEmailRecipient}
                  variant="outline"
                  className="gap-2"
                  data-testid="button-send-test-invitation-email"
                >
                  <Mail className="h-4 w-4" />
                  {testEmailMutation.isPending ? t('emailConfig.sending') : t('emailConfig.sendTestEmail')}
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSaveInvitationTemplate}
              disabled={saveSettingsMutation.isPending}
              className="w-full gap-2"
              data-testid="button-save-invitation-template"
            >
              <Save className="h-4 w-4" />
              {saveSettingsMutation.isPending ? t('emailConfig.saving') : t('emailConfig.saveInvitationTemplate')}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <EmailPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        templateType="invitation"
      />
    </>
  );
}
