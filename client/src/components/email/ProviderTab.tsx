import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mail, Send, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

interface ProviderTabProps {
  emailEnabled: boolean;
  setEmailEnabled: (value: boolean) => void;
  emailLanguage: 'en' | 'ar';
  setEmailLanguage: (value: 'en' | 'ar') => void;
  emailProvider: 'resend' | 'smtp';
  setEmailProvider: (value: 'resend' | 'smtp') => void;
  emailApiKey: string;
  setEmailApiKey: (value: string) => void;
  smtpHost: string;
  setSmtpHost: (value: string) => void;
  smtpPort: number;
  setSmtpPort: (value: number) => void;
  smtpSecure: boolean;
  setSmtpSecure: (value: boolean) => void;
  smtpUser: string;
  setSmtpUser: (value: string) => void;
  smtpPassword: string;
  setSmtpPassword: (value: string) => void;
  emailFromEmail: string;
  setEmailFromEmail: (value: string) => void;
  emailFromName: string;
  setEmailFromName: (value: string) => void;
  invitationFromEmail?: string;
  setInvitationFromEmail?: (value: string) => void;
  invitationFromName?: string;
  setInvitationFromName?: (value: string) => void;
  testEmailRecipient: string;
  setTestEmailRecipient: (value: string) => void;
  emailRecipients: string;
  setEmailRecipients: (value: string) => void;
  managementSummaryRecipients: string;
  setManagementSummaryRecipients: (value: string) => void;
  managementSummaryEnabled: boolean;
  setManagementSummaryEnabled: (value: boolean) => void;
  globalCcList: string;
  setGlobalCcList: (value: string) => void;
  stakeholderCcList: string;
  setStakeholderCcList: (value: string) => void;
  reminderCcList: string;
  setReminderCcList: (value: string) => void;
  managementSummaryCcList: string;
  setManagementSummaryCcList: (value: string) => void;
  handleSaveProviderSettings: () => void;
  testEmailMutation: any;
  saveSettingsMutation: any;
}

export default function ProviderTab(props: ProviderTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    emailEnabled,
    setEmailEnabled,
    emailLanguage,
    setEmailLanguage,
    emailProvider,
    setEmailProvider,
    emailApiKey,
    setEmailApiKey,
    smtpHost,
    setSmtpHost,
    smtpPort,
    setSmtpPort,
    smtpSecure,
    setSmtpSecure,
    smtpUser,
    setSmtpUser,
    smtpPassword,
    setSmtpPassword,
    emailFromEmail,
    setEmailFromEmail,
    emailFromName,
    setEmailFromName,
    testEmailRecipient,
    setTestEmailRecipient,
    emailRecipients,
    setEmailRecipients,
    managementSummaryRecipients,
    setManagementSummaryRecipients,
    managementSummaryEnabled,
    setManagementSummaryEnabled,
    globalCcList,
    setGlobalCcList,
    stakeholderCcList,
    setStakeholderCcList,
    reminderCcList,
    setReminderCcList,
    managementSummaryCcList,
    setManagementSummaryCcList,
    handleSaveProviderSettings,
    testEmailMutation,
    saveSettingsMutation,
  } = props;

  return (
    <div className="space-y-6">
      {/* Email Provider Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('emailConfig.emailProvider')}
          </CardTitle>
          <CardDescription>{t('emailConfig.emailProviderDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between pb-4 border-b">
            <div className="space-y-1">
              <Label htmlFor="email-enabled" className="text-base font-medium">
                {t('emailConfig.enableEmailNotifications')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('emailConfig.sendEmailNotifications')}
              </p>
            </div>
            <Switch
              id="email-enabled"
              checked={emailEnabled}
              onCheckedChange={setEmailEnabled}
              data-testid="switch-email-enabled"
            />
          </div>

          {/* Email Language Selection */}
          <div className="flex items-center justify-between pb-4 border-b">
            <div className="space-y-1 flex-1">
              <Label htmlFor="email-language" className="text-base font-medium">
                {t('emailConfig.emailLanguage')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('emailConfig.emailLanguageDescription')}
              </p>
            </div>
            <Select 
              value={emailLanguage} 
              onValueChange={(value: 'en' | 'ar') => {
                setEmailLanguage(value);
                // Auto-save language preference
                saveSettingsMutation.mutate({ emailLanguage: value });
                // Invalidate email preview cache to force refresh with new language
                queryClient.invalidateQueries({ queryKey: ['email-preview'] });
              }}
            >
              <SelectTrigger id="email-language" className="w-[180px]" data-testid="select-email-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en" data-testid="option-email-lang-en">{t('emailConfig.english')}</SelectItem>
                <SelectItem value="ar" data-testid="option-email-lang-ar">{t('emailConfig.arabic')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Provider Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">{t('emailConfig.emailProviderLabel')}</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card
                className={`cursor-pointer transition-all hover-elevate ${
                  emailProvider === 'resend' ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setEmailProvider('resend')}
                data-testid="card-provider-resend"
              >
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={emailProvider === 'resend'}
                      onChange={() => setEmailProvider('resend')}
                      className="h-4 w-4"
                      data-testid="radio-resend"
                    />
                    <div>
                      <p className="font-medium">{t('emailConfig.resend')}</p>
                      <p className="text-sm text-muted-foreground">{t('emailConfig.resendDescription')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover-elevate ${
                  emailProvider === 'smtp' ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setEmailProvider('smtp')}
                data-testid="card-provider-smtp"
              >
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={emailProvider === 'smtp'}
                      onChange={() => setEmailProvider('smtp')}
                      className="h-4 w-4"
                      data-testid="radio-smtp"
                    />
                    <div>
                      <p className="font-medium">{t('emailConfig.smtp')}</p>
                      <p className="text-sm text-muted-foreground">{t('emailConfig.smtpDescription')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Resend Configuration */}
          {emailProvider === 'resend' && (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">{t('emailConfig.resendApiKey')}</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={emailApiKey}
                  onChange={(e) => setEmailApiKey(e.target.value)}
                  placeholder={t('emailConfig.resendApiKeyPlaceholder')}
                  data-testid="input-api-key"
                />
                <p className="text-xs text-muted-foreground">
                  {t('emailConfig.getApiKeyFrom')}
                </p>
              </div>
            </div>
          )}

          {/* SMTP Configuration */}
          {emailProvider === 'smtp' && (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-host">{t('emailConfig.smtpHost')}</Label>
                  <Input
                    id="smtp-host"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder={t('emailConfig.smtpHostPlaceholder')}
                    data-testid="input-smtp-host"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">{t('emailConfig.smtpPort')}</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(parseInt(e.target.value))}
                    placeholder={t('emailConfig.smtpPortPlaceholder')}
                    data-testid="input-smtp-port"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="smtp-secure">{t('emailConfig.useTlsSsl')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('emailConfig.enableSecureConnection')}
                  </p>
                </div>
                <Switch
                  id="smtp-secure"
                  checked={smtpSecure}
                  onCheckedChange={setSmtpSecure}
                  data-testid="switch-smtp-secure"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-user">{t('emailConfig.smtpUsername')}</Label>
                <Input
                  id="smtp-user"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder={t('emailConfig.smtpUsernamePlaceholder')}
                  data-testid="input-smtp-user"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-password">{t('emailConfig.smtpPassword')}</Label>
                <Input
                  id="smtp-password"
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder={t('emailConfig.smtpPasswordPlaceholder')}
                  data-testid="input-smtp-password"
                />
              </div>
            </div>
          )}

          <Separator />

          {/* From Email/Name */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="from-email">{t('emailConfig.fromEmail')}</Label>
              <Input
                id="from-email"
                type="email"
                value={emailFromEmail}
                onChange={(e) => setEmailFromEmail(e.target.value)}
                placeholder="notifications@example.com"
                data-testid="input-from-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="from-name">{t('emailConfig.fromName')}</Label>
              <Input
                id="from-name"
                value={emailFromName}
                onChange={(e) => setEmailFromName(e.target.value)}
                placeholder={t('emailConfig.fromNamePlaceholder')}
                data-testid="input-from-name"
              />
            </div>
          </div>

          <Separator />

          {/* Invitation-Specific From Email/Name (Optional) */}
          {props.invitationFromEmail !== undefined && props.setInvitationFromEmail && (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-base font-medium">Invitation Email Sender (Optional)</Label>
                  <p className="text-sm text-muted-foreground">
                    Configure a separate sender for invitation emails. If not set, the default sender above will be used.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="invitation-from-email">Invitation From Email</Label>
                  <Input
                    id="invitation-from-email"
                    type="email"
                    value={props.invitationFromEmail}
                    onChange={(e) => props.setInvitationFromEmail?.(e.target.value)}
                    placeholder="invitations@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invitation-from-name">Invitation From Name</Label>
                  <Input
                    id="invitation-from-name"
                    value={props.invitationFromName || ''}
                    onChange={(e) => props.setInvitationFromName?.(e.target.value)}
                    placeholder="Events Team"
                  />
                </div>
              </div>

              <Separator />
            </>
          )}

          {/* Test Email */}
          <div className="space-y-4">
            <Label className="text-base font-medium">{t('emailConfig.testEmail')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('emailConfig.testEmailDescription')}
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                placeholder={t('emailConfig.testEmailPlaceholder')}
                data-testid="input-test-email"
              />
              <Button
                onClick={() => testEmailRecipient && testEmailMutation.mutate({ type: 'reminder', recipientEmail: testEmailRecipient })}
                disabled={!testEmailRecipient || testEmailMutation.isPending}
                data-testid="button-send-test"
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {t('emailConfig.sendTest')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Recipients Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('emailConfig.emailRecipients')}</CardTitle>
          <CardDescription>{t('emailConfig.emailRecipientsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="primary-recipients">{t('emailConfig.primaryRecipients')}</Label>
            <Textarea
              id="primary-recipients"
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              placeholder={t('emailConfig.emailPlaceholder')}
              rows={3}
              data-testid="textarea-primary-recipients"
            />
            <p className="text-xs text-muted-foreground">
              {t('emailConfig.commaSeparatedReminder')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="management-recipients">{t('emailConfig.managementSummaryRecipients')}</Label>
            <Textarea
              id="management-recipients"
              value={managementSummaryRecipients}
              onChange={(e) => setManagementSummaryRecipients(e.target.value)}
              placeholder={t('emailConfig.managementEmailPlaceholder')}
              rows={3}
              data-testid="textarea-management-recipients"
            />
            <p className="text-xs text-muted-foreground">
              {t('emailConfig.commaSeparatedManagement')}
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="space-y-1">
              <Label htmlFor="management-enabled" className="text-base font-medium">
                {t('emailConfig.enableManagementSummary')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('emailConfig.enableManagementSummaryDescription')}
              </p>
            </div>
            <Switch
              id="management-enabled"
              checked={managementSummaryEnabled}
              onCheckedChange={setManagementSummaryEnabled}
              data-testid="switch-management-enabled"
            />
          </div>
        </CardContent>
      </Card>

      {/* CC Lists Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('emailConfig.ccLists')}</CardTitle>
          <CardDescription>{t('emailConfig.ccListsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="global-cc" className="text-base font-medium">{t('emailConfig.globalCc')}</Label>
            <Textarea
              id="global-cc"
              value={globalCcList}
              onChange={(e) => setGlobalCcList(e.target.value)}
              placeholder={t('emailConfig.ccPlaceholder')}
              rows={2}
              data-testid="textarea-global-cc"
            />
            <p className="text-xs text-muted-foreground">
              {t('emailConfig.globalCcDescription')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stakeholder-cc">{t('emailConfig.stakeholderCc')}</Label>
            <Textarea
              id="stakeholder-cc"
              value={stakeholderCcList}
              onChange={(e) => setStakeholderCcList(e.target.value)}
              placeholder={t('emailConfig.stakeholderCcPlaceholder')}
              rows={2}
              data-testid="textarea-stakeholder-cc"
            />
            <p className="text-xs text-muted-foreground">
              {t('emailConfig.stakeholderCcDescription')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-cc">{t('emailConfig.reminderCc')}</Label>
            <Textarea
              id="reminder-cc"
              value={reminderCcList}
              onChange={(e) => setReminderCcList(e.target.value)}
              placeholder={t('emailConfig.reminderCcPlaceholder')}
              rows={2}
              data-testid="textarea-reminder-cc"
            />
            <p className="text-xs text-muted-foreground">
              {t('emailConfig.reminderCcDescription')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="management-cc">{t('emailConfig.managementSummaryCc')}</Label>
            <Textarea
              id="management-cc"
              value={managementSummaryCcList}
              onChange={(e) => setManagementSummaryCcList(e.target.value)}
              placeholder={t('emailConfig.managementCcPlaceholder')}
              rows={2}
              data-testid="textarea-management-cc"
            />
            <p className="text-xs text-muted-foreground">
              {t('emailConfig.managementSummaryCcDescription')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveProviderSettings}
          disabled={saveSettingsMutation.isPending}
          data-testid="button-save-provider"
          className="gap-2"
          size="lg"
        >
          <Save className="h-4 w-4" />
          {saveSettingsMutation.isPending ? t('emailConfig.saving') : t('emailConfig.saveChanges')}
        </Button>
      </div>
    </div>
  );
}
