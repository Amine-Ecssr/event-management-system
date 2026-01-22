import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface EmailConfigSettings {
  // Provider settings
  emailEnabled?: boolean;
  emailProvider?: 'resend' | 'smtp';
  emailApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  emailFromEmail?: string;
  emailFromName?: string;
  
  // Recipients
  emailRecipients?: string;
  managementSummaryEnabled?: boolean;
  managementSummaryRecipients?: string;
  
  // CC Lists
  globalCcList?: string;
  stakeholderCcList?: string;
  reminderCcList?: string;
  managementSummaryCcList?: string;
  
  // Stakeholder template
  stakeholderSubject?: string;
  stakeholderBody?: string;
  stakeholderBrandColor?: string;
  stakeholderTextColor?: string;
  stakeholderBgColor?: string;
  stakeholderFontFamily?: string;
  stakeholderFontSize?: string;
  stakeholderRequirementsTitle?: string;
  stakeholderRequirementsBrandColor?: string;
  stakeholderRequirementsTextColor?: string;
  stakeholderRequirementsBgColor?: string;
  stakeholderRequirementsFontFamily?: string;
  stakeholderRequirementsFontSize?: string;
  stakeholderRequirementItemTemplate?: string;
  stakeholderFooter?: string;
  stakeholderFooterBrandColor?: string;
  stakeholderFooterTextColor?: string;
  stakeholderFooterBgColor?: string;
  stakeholderFooterFontFamily?: string;
  stakeholderFooterFontSize?: string;
  
  // Reminder template
  reminderSubject?: string;
  reminderBody?: string;
  reminderBrandColor?: string;
  reminderTextColor?: string;
  reminderBgColor?: string;
  reminderFontFamily?: string;
  reminderFontSize?: string;
  reminderRequirementsTitle?: string;
  reminderRequirementsBrandColor?: string;
  reminderRequirementsTextColor?: string;
  reminderRequirementsBgColor?: string;
  reminderRequirementsFontFamily?: string;
  reminderRequirementsFontSize?: string;
  reminderRequirementItemTemplate?: string;
  reminderGreeting?: string;
  reminderFooter?: string;
  reminderFooterBrandColor?: string;
  reminderFooterTextColor?: string;
  reminderFooterBgColor?: string;
  reminderFooterFontFamily?: string;
  reminderFooterFontSize?: string;
  
  // Management summary template
  managementSummarySubjectTemplate?: string;
  managementSummaryBody?: string;
  managementSummaryBrandColor?: string;
  managementSummaryTextColor?: string;
  managementSummaryBgColor?: string;
  managementSummaryFontFamily?: string;
  managementSummaryFontSize?: string;
  managementSummaryRequirementsTitle?: string;
  managementSummaryRequirementsBrandColor?: string;
  managementSummaryRequirementsTextColor?: string;
  managementSummaryRequirementsBgColor?: string;
  managementSummaryRequirementsFontFamily?: string;
  managementSummaryRequirementsFontSize?: string;
  managementSummaryRequirementItemTemplate?: string;
  managementSummaryGreeting?: string;
  managementSummaryStakeholderTemplate?: string;
  managementSummaryStakeholderSeparator?: string;
  managementSummaryFooter?: string;
  managementSummaryFooterBrandColor?: string;
  managementSummaryFooterTextColor?: string;
  managementSummaryFooterBgColor?: string;
  managementSummaryFooterFontFamily?: string;
  managementSummaryFooterFontSize?: string;
  
  // Legacy fields
  emailSubjectTemplate?: string;
  emailBodyTemplate?: string;
}

export function useEmailConfig() {
  const { toast } = useToast();
  const { t } = useTranslation();
  
  // Provider settings
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailProvider, setEmailProvider] = useState<'resend' | 'smtp'>('resend');
  const [emailLanguage, setEmailLanguage] = useState<'en' | 'ar'>('en');
  const [emailApiKey, setEmailApiKey] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [emailFromEmail, setEmailFromEmail] = useState('');
  const [emailFromName, setEmailFromName] = useState('');
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  
  // Recipients
  const [emailRecipients, setEmailRecipients] = useState('');
  const [managementSummaryEnabled, setManagementSummaryEnabled] = useState(false);
  const [managementSummaryRecipients, setManagementSummaryRecipients] = useState('');
  
  // CC Lists
  const [globalCcList, setGlobalCcList] = useState('');
  const [stakeholderCcList, setStakeholderCcList] = useState('');
  const [reminderCcList, setReminderCcList] = useState('');
  const [managementSummaryCcList, setManagementSummaryCcList] = useState('');
  
  // Fetch settings
  const { data: settings } = useQuery<EmailConfigSettings>({
    queryKey: ['/api/settings/admin'],
  });
  
  // Sync settings to state
  useEffect(() => {
    if (settings) {
      setEmailEnabled(settings.emailEnabled || false);
      setEmailProvider(settings.emailProvider || 'resend');
      setEmailApiKey(settings.emailApiKey || '');
      setSmtpHost(settings.smtpHost || '');
      setSmtpPort(settings.smtpPort || 587);
      setSmtpSecure(settings.smtpSecure ?? true);
      setSmtpUser(settings.smtpUser || '');
      setSmtpPassword(settings.smtpPassword || '');
      setEmailFromEmail(settings.emailFromEmail || '');
      setEmailFromName(settings.emailFromName || '');
      setEmailRecipients(settings.emailRecipients || '');
      setGlobalCcList(settings.globalCcList || '');
      setStakeholderCcList(settings.stakeholderCcList || '');
      setReminderCcList(settings.reminderCcList || '');
      setManagementSummaryCcList(settings.managementSummaryCcList || '');
      setManagementSummaryEnabled(settings.managementSummaryEnabled || false);
      setManagementSummaryRecipients(settings.managementSummaryRecipients || '');
    }
  }, [settings]);
  
  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PATCH', '/api/settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/admin'] });
      toast({
        title: t('emailConfig.settingsSaved'),
        description: t('emailConfig.settingsSavedDescription'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('emailConfig.error'),
        description: error.message || t('emailConfig.failedToSaveSettings'),
        variant: 'destructive',
      });
    },
  });
  
  // Test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async ({ type, recipientEmail }: { type: 'stakeholder' | 'reminder' | 'management', recipientEmail: string }) => {
      return await apiRequest('POST', `/api/settings/test-email/${type}`, { recipientEmail });
    },
    onSuccess: () => {
      toast({
        title: t('emailConfig.testEmailSent'),
        description: t('emailConfig.testEmailSentDescription'),
      });
      setTestEmailRecipient('');
    },
    onError: (error: any) => {
      toast({
        title: t('emailConfig.failedToSendTestEmail'),
        description: error.message || t('common.errorOccurred'),
        variant: 'destructive',
      });
    },
  });
  
  const handleSaveProviderSettings = () => {
    const data: any = {
      emailEnabled,
      emailProvider,
      emailFromEmail,
      emailFromName,
      emailRecipients,
      globalCcList,
      stakeholderCcList,
      reminderCcList,
      managementSummaryCcList,
      managementSummaryEnabled,
      managementSummaryRecipients,
    };

    if (emailProvider === 'resend') {
      data.emailApiKey = emailApiKey;
    } else {
      data.smtpHost = smtpHost;
      data.smtpPort = smtpPort;
      data.smtpSecure = smtpSecure;
      data.smtpUser = smtpUser;
      data.smtpPassword = smtpPassword;
    }

    saveSettingsMutation.mutate(data);
  };
  
  const handleSendTestEmail = (type: 'stakeholder' | 'reminder' | 'management', recipientEmail: string) => {
    testEmailMutation.mutate({ type, recipientEmail });
  };
  
  return {
    // Provider settings
    emailEnabled,
    setEmailEnabled,
    emailProvider,
    setEmailProvider,
    emailLanguage,
    setEmailLanguage,
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
    
    // Recipients
    emailRecipients,
    setEmailRecipients,
    managementSummaryEnabled,
    setManagementSummaryEnabled,
    managementSummaryRecipients,
    setManagementSummaryRecipients,
    
    // CC Lists
    globalCcList,
    setGlobalCcList,
    stakeholderCcList,
    setStakeholderCcList,
    reminderCcList,
    setReminderCcList,
    managementSummaryCcList,
    setManagementSummaryCcList,
    
    // Methods
    handleSaveProviderSettings,
    handleSendTestEmail,
    saveSettingsMutation,
    testEmailMutation,
    settings,
  };
}
