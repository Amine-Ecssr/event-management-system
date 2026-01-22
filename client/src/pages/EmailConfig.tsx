import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Mail, Send, ChevronDown, Palette, Save, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useTranslation } from 'react-i18next';
import ProviderTab from '@/components/email/ProviderTab';
import StakeholderTab from '@/components/email/StakeholderTab';
import ReminderTab from '@/components/email/ReminderTab';
import InvitationTab from '@/components/email/InvitationTab';
import ManagementTab from '@/components/email/ManagementTab';
import TaskCompletionTab from '@/components/email/TaskCompletionTab';
import UpdatesTab from '@/components/email/UpdatesTab';

const SAMPLE_EVENT = {
  eventName: 'Annual Technology Summit 2025',
  description: 'Join us for the premier technology conference featuring industry leaders, innovative workshops, and networking opportunities.',
  startDate: 'March 15, 2025',
  endDate: 'March 17, 2025',
  location: 'Dubai World Trade Centre',
  organizers: 'Tech Innovation Hub',
  category: 'Technology',
  eventType: 'International',
  url: 'https://example.com/tech-summit',
  expectedAttendance: '500',
};

const FONT_FAMILIES = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Courier, monospace', label: 'Courier' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet MS' },
];

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px'];

export default function EmailConfig() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  // Template variables with translated descriptions
  const TEMPLATE_VARIABLES = [
    { key: '{{eventName}}', description: t('emailConfig.variableEventName') },
    { key: '{{description}}', description: t('emailConfig.variableDescription') },
    { key: '{{startDate}}', description: t('emailConfig.variableStartDate') },
    { key: '{{endDate}}', description: t('emailConfig.variableEndDate') },
    { key: '{{location}}', description: t('emailConfig.variableLocation') },
    { key: '{{organizers}}', description: t('emailConfig.variableOrganizers') },
    { key: '{{category}}', description: t('emailConfig.variableCategory') },
    { key: '{{eventType}}', description: t('emailConfig.variableEventType') },
    { key: '{{url}}', description: t('emailConfig.variableUrl') },
    { key: '{{expectedAttendance}}', description: t('emailConfig.variableExpectedAttendance') },
    { key: '{{requirements}}', description: t('emailConfig.variableRequirements') },
  ];

  // Redirect if not superadmin
  if (!user || user.role !== 'superadmin') {
    setLocation('/admin');
    return <div>{t('common.redirecting')}</div>;
  }

  // Tab state
  const [activeTab, setActiveTab] = useState('provider');

  // Global email language setting (applies to all email types)
  const [emailLanguage, setEmailLanguage] = useState<'en' | 'ar'>('en');

  // Provider settings state
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailProvider, setEmailProvider] = useState<'resend' | 'smtp'>('resend');
  const [emailApiKey, setEmailApiKey] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [emailFromEmail, setEmailFromEmail] = useState('');
  const [emailFromName, setEmailFromName] = useState('');
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  
  // Invitation email specific sender (optional, separate from general emails)
  const [invitationFromEmail, setInvitationFromEmail] = useState('');
  const [invitationFromName, setInvitationFromName] = useState('');

  // Recipients state
  const [emailRecipients, setEmailRecipients] = useState('');
  const [managementSummaryEnabled, setManagementSummaryEnabled] = useState(false);
  const [managementSummaryRecipients, setManagementSummaryRecipients] = useState('');

  // CC lists state
  const [globalCcList, setGlobalCcList] = useState('');
  const [stakeholderCcList, setStakeholderCcList] = useState('');
  const [reminderCcList, setReminderCcList] = useState('');
  const [managementSummaryCcList, setManagementSummaryCcList] = useState('');

  // Stakeholder email template state
  const [stakeholderSubject, setStakeholderSubject] = useState('New Event: {{eventName}}');
  const [stakeholderBody, setStakeholderBody] = useState('<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>Date:</strong> {{startDate}} - {{endDate}}</p><p><strong>Location:</strong> {{location}}</p>');
  const [stakeholderBrandColor, setStakeholderBrandColor] = useState('#BC9F6D');
  const [stakeholderTextColor, setStakeholderTextColor] = useState('#333333');
  const [stakeholderBgColor, setStakeholderBgColor] = useState('#FFFFFF');
  const [stakeholderFontFamily, setStakeholderFontFamily] = useState('Arial, sans-serif');
  const [stakeholderFontSize, setStakeholderFontSize] = useState('16px');

  // Stakeholder email template state (Arabic)
  const [stakeholderSubjectAr, setStakeholderSubjectAr] = useState('فعالية جديدة: {{eventName}}');
  const [stakeholderBodyAr, setStakeholderBodyAr] = useState('<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>التاريخ:</strong> {{startDate}} - {{endDate}}</p><p><strong>الموقع:</strong> {{location}}</p>');

  // Reminder email template state
  const [reminderSubject, setReminderSubject] = useState('Event Reminder: {{eventName}}');
  const [reminderBody, setReminderBody] = useState('<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>Date:</strong> {{startDate}} - {{endDate}}</p>');
  const [reminderBrandColor, setReminderBrandColor] = useState('#BC9F6D');
  const [reminderTextColor, setReminderTextColor] = useState('#333333');
  const [reminderBgColor, setReminderBgColor] = useState('#FFFFFF');
  const [reminderFontFamily, setReminderFontFamily] = useState('Arial, sans-serif');
  const [reminderFontSize, setReminderFontSize] = useState('16px');

  // Reminder email template state (Arabic)
  const [reminderSubjectAr, setReminderSubjectAr] = useState('تذكير بالفعالية: {{eventName}}');
  const [reminderBodyAr, setReminderBodyAr] = useState('<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>التاريخ:</strong> {{startDate}} - {{endDate}}</p>');

  // Management summary template state
  const [managementSummarySubject, setManagementSummarySubject] = useState('Management Summary: {{eventName}}');
  const [managementSummaryBody, setManagementSummaryBody] = useState('<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>Date:</strong> {{startDate}} - {{endDate}}</p><p><strong>Expected Attendance:</strong> {{expectedAttendance}}</p>');
  const [managementSummaryBrandColor, setManagementSummaryBrandColor] = useState('#BC9F6D');
  const [managementSummaryTextColor, setManagementSummaryTextColor] = useState('#333333');
  const [managementSummaryBgColor, setManagementSummaryBgColor] = useState('#FFFFFF');
  const [managementSummaryFontFamily, setManagementSummaryFontFamily] = useState('Arial, sans-serif');
  const [managementSummaryFontSize, setManagementSummaryFontSize] = useState('16px');

  // Management summary template state (Arabic)
  const [managementSummarySubjectAr, setManagementSummarySubjectAr] = useState('ملخص إداري: {{eventName}}');
  const [managementSummaryBodyAr, setManagementSummaryBodyAr] = useState('<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>التاريخ:</strong> {{startDate}} - {{endDate}}</p><p><strong>العدد المتوقع للحضور:</strong> {{expectedAttendance}}</p>');

  // Requirements titles
  const [stakeholderRequirementsTitle, setStakeholderRequirementsTitle] = useState('Your Requirements for this Event');
  const [reminderRequirementsTitle, setReminderRequirementsTitle] = useState('Your Requirements for this Event');
  const [managementSummaryRequirementsTitle, setManagementSummaryRequirementsTitle] = useState('Stakeholder Assignments');

  // Requirements titles (Arabic)
  const [stakeholderRequirementsTitleAr, setStakeholderRequirementsTitleAr] = useState('متطلباتك لهذه الفعالية');
  const [reminderRequirementsTitleAr, setReminderRequirementsTitleAr] = useState('متطلباتك لهذه الفعالية');
  const [managementSummaryRequirementsTitleAr, setManagementSummaryRequirementsTitleAr] = useState('تكليفات أصحاب المصلحة');

  // Stakeholder requirements section styling
  const [stakeholderRequirementsBrandColor, setStakeholderRequirementsBrandColor] = useState('#BC9F6D');
  const [stakeholderRequirementsTextColor, setStakeholderRequirementsTextColor] = useState('#333333');
  const [stakeholderRequirementsBgColor, setStakeholderRequirementsBgColor] = useState('#F5F5F5');
  const [stakeholderRequirementsFontFamily, setStakeholderRequirementsFontFamily] = useState('Arial, sans-serif');
  const [stakeholderRequirementsFontSize, setStakeholderRequirementsFontSize] = useState('16px');

  // Stakeholder footer
  const [stakeholderFooter, setStakeholderFooter] = useState('<p>Best regards,<br/>ECSSR Events Team</p>');
  const [stakeholderFooterBrandColor, setStakeholderFooterBrandColor] = useState('#BC9F6D');
  const [stakeholderFooterTextColor, setStakeholderFooterTextColor] = useState('#666666');
  const [stakeholderFooterBgColor, setStakeholderFooterBgColor] = useState('#FFFFFF');
  const [stakeholderFooterFontFamily, setStakeholderFooterFontFamily] = useState('Arial, sans-serif');
  const [stakeholderFooterFontSize, setStakeholderFooterFontSize] = useState('14px');

  // Stakeholder footer (Arabic)
  const [stakeholderFooterAr, setStakeholderFooterAr] = useState('<p>مع أطيب التحيات،<br/>فريق فعاليات المركز</p>');

  // Reminder requirements section styling
  const [reminderRequirementsBrandColor, setReminderRequirementsBrandColor] = useState('#BC9F6D');
  const [reminderRequirementsTextColor, setReminderRequirementsTextColor] = useState('#333333');
  const [reminderRequirementsBgColor, setReminderRequirementsBgColor] = useState('#F5F5F5');
  const [reminderRequirementsFontFamily, setReminderRequirementsFontFamily] = useState('Arial, sans-serif');
  const [reminderRequirementsFontSize, setReminderRequirementsFontSize] = useState('16px');

  // Reminder footer
  const [reminderFooter, setReminderFooter] = useState('<p>Best regards,<br/>ECSSR Events Team</p>');
  const [reminderFooterBrandColor, setReminderFooterBrandColor] = useState('#BC9F6D');
  const [reminderFooterTextColor, setReminderFooterTextColor] = useState('#666666');
  const [reminderFooterBgColor, setReminderFooterBgColor] = useState('#FFFFFF');
  const [reminderFooterFontFamily, setReminderFooterFontFamily] = useState('Arial, sans-serif');
  const [reminderFooterFontSize, setReminderFooterFontSize] = useState('14px');

  // Reminder footer (Arabic)
  const [reminderFooterAr, setReminderFooterAr] = useState('<p>مع أطيب التحيات،<br/>فريق فعاليات المركز</p>');

  // Management summary requirements section styling
  const [managementSummaryRequirementsBrandColor, setManagementSummaryRequirementsBrandColor] = useState('#BC9F6D');
  const [managementSummaryRequirementsTextColor, setManagementSummaryRequirementsTextColor] = useState('#333333');
  const [managementSummaryRequirementsBgColor, setManagementSummaryRequirementsBgColor] = useState('#F5F5F5');
  const [managementSummaryRequirementsFontFamily, setManagementSummaryRequirementsFontFamily] = useState('Arial, sans-serif');
  const [managementSummaryRequirementsFontSize, setManagementSummaryRequirementsFontSize] = useState('16px');

  // Management summary footer
  const [managementSummaryFooter, setManagementSummaryFooter] = useState('<p>Best regards,<br/>ECSSR Management</p>');
  const [managementSummaryFooterBrandColor, setManagementSummaryFooterBrandColor] = useState('#BC9F6D');
  const [managementSummaryFooterTextColor, setManagementSummaryFooterTextColor] = useState('#666666');
  const [managementSummaryFooterBgColor, setManagementSummaryFooterBgColor] = useState('#FFFFFF');
  const [managementSummaryFooterFontFamily, setManagementSummaryFooterFontFamily] = useState('Arial, sans-serif');
  const [managementSummaryFooterFontSize, setManagementSummaryFooterFontSize] = useState('14px');

  // Management summary footer (Arabic)
  const [managementSummaryFooterAr, setManagementSummaryFooterAr] = useState('<p>مع أطيب التحيات،<br/>إدارة المركز</p>');

  // New advanced template customization fields
  const [managementSummaryGreeting, setManagementSummaryGreeting] = useState('');
  const [managementSummaryStakeholderTemplate, setManagementSummaryStakeholderTemplate] = useState('');
  const [managementSummaryStakeholderSeparator, setManagementSummaryStakeholderSeparator] = useState('');
  const [managementSummaryRequirementItemTemplate, setManagementSummaryRequirementItemTemplate] = useState('');
  const [stakeholderRequirementItemTemplate, setStakeholderRequirementItemTemplate] = useState('');
  const [reminderGreeting, setReminderGreeting] = useState('');
  const [reminderRequirementItemTemplate, setReminderRequirementItemTemplate] = useState('');

  // Advanced template customization fields (Arabic)
  const [managementSummaryGreetingAr, setManagementSummaryGreetingAr] = useState('');
  const [reminderGreetingAr, setReminderGreetingAr] = useState('');

  // Task Completion email template state
  const [taskCompletionSubject, setTaskCompletionSubject] = useState('Task Completed: {{taskTitle}} - {{eventName}}');
  const [taskCompletionBody, setTaskCompletionBody] = useState('<p>Dear Team,</p><p>Kindly note that the following task has been marked as completed:</p>');
  const [taskCompletionBrandColor, setTaskCompletionBrandColor] = useState('#BC9F6D');
  const [taskCompletionTextColor, setTaskCompletionTextColor] = useState('#333333');
  const [taskCompletionBgColor, setTaskCompletionBgColor] = useState('#FFFFFF');
  const [taskCompletionFontFamily, setTaskCompletionFontFamily] = useState('Arial, sans-serif');
  const [taskCompletionFontSize, setTaskCompletionFontSize] = useState('16px');
  
  // Task Completion footer
  const [taskCompletionFooter, setTaskCompletionFooter] = useState('<p>Best regards,<br/>ECSSR Events Team</p>');
  const [taskCompletionFooterBrandColor, setTaskCompletionFooterBrandColor] = useState('#BC9F6D');
  const [taskCompletionFooterTextColor, setTaskCompletionFooterTextColor] = useState('#666666');
  const [taskCompletionFooterBgColor, setTaskCompletionFooterBgColor] = useState('#FFFFFF');
  const [taskCompletionFooterFontFamily, setTaskCompletionFooterFontFamily] = useState('Arial, sans-serif');
  const [taskCompletionFooterFontSize, setTaskCompletionFooterFontSize] = useState('14px');
  
  // Task Completion email template state (Arabic)
  const [taskCompletionSubjectAr, setTaskCompletionSubjectAr] = useState('تم إنجاز المهمة: {{taskTitle}} - {{eventName}}');
  const [taskCompletionBodyAr, setTaskCompletionBodyAr] = useState('<p>عزيزي الفريق،</p><p>يرجى العلم بأنه تم إنجاز المهمة التالية:</p>');
  const [taskCompletionFooterAr, setTaskCompletionFooterAr] = useState('<p>مع أطيب التحيات،<br/>فريق فعاليات المركز</p>');

  const DEFAULT_UPDATES_TEMPLATE = `
    <p>Hello,</p>
    <p>Here are the latest updates for {{period_label}}:</p>
    {{updates}}
    <p>Regards,<br/>ECSSR Events Team</p>
  `;

  const DEFAULT_UPDATES_TEMPLATE_AR = `
    <p>مرحباً،</p>
    <p>هذه آخر المستجدات للفترة {{period_label}}:</p>
    {{updates}}
    <p>تحياتنا،<br/>فريق فعاليات مركز الإمارات</p>
  `;

  // Updates email template state
  const [updatesEmailTemplate, setUpdatesEmailTemplate] = useState(DEFAULT_UPDATES_TEMPLATE);
  const [updatesEmailTemplateAr, setUpdatesEmailTemplateAr] = useState(DEFAULT_UPDATES_TEMPLATE_AR);
  const [updatesBrandColor, setUpdatesBrandColor] = useState('#BC9F6D');
  const [updatesTextColor, setUpdatesTextColor] = useState('#333333');
  const [updatesBgColor, setUpdatesBgColor] = useState('#FFFFFF');
  const [updatesFontFamily, setUpdatesFontFamily] = useState('Arial, sans-serif');
  const [updatesFontSize, setUpdatesFontSize] = useState('16px');
  const [updatesStylingOpen, setUpdatesStylingOpen] = useState(false);

  // Invitation email template state
  const [invitationGreeting, setInvitationGreeting] = useState('');
  const [invitationSubject, setInvitationSubject] = useState('You are invited: {{eventName}}');
  const [invitationBody, setInvitationBody] = useState('<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>Date:</strong> {{startDate}} - {{endDate}}</p><p><strong>Location:</strong> {{location}}</p>');
  const [invitationBrandColor, setInvitationBrandColor] = useState('#BC9F6D');
  const [invitationTextColor, setInvitationTextColor] = useState('#333333');
  const [invitationBgColor, setInvitationBgColor] = useState('#FFFFFF');
  const [invitationFontFamily, setInvitationFontFamily] = useState('Arial, sans-serif');
  const [invitationFontSize, setInvitationFontSize] = useState('16px');
  
  // Invitation footer
  const [invitationFooter, setInvitationFooter] = useState('<p>Best regards,<br/>ECSSR Events Team</p>');
  const [invitationFooterBrandColor, setInvitationFooterBrandColor] = useState('#BC9F6D');
  const [invitationFooterTextColor, setInvitationFooterTextColor] = useState('#666666');
  const [invitationFooterBgColor, setInvitationFooterBgColor] = useState('#FFFFFF');
  const [invitationFooterFontFamily, setInvitationFooterFontFamily] = useState('Arial, sans-serif');
  const [invitationFooterFontSize, setInvitationFooterFontSize] = useState('14px');

  // Invitation email template state (Arabic)
  const [invitationGreetingAr, setInvitationGreetingAr] = useState('');
  const [invitationSubjectAr, setInvitationSubjectAr] = useState('أنت مدعو: {{eventName}}');
  const [invitationBodyAr, setInvitationBodyAr] = useState('<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>التاريخ:</strong> {{startDate}} - {{endDate}}</p><p><strong>الموقع:</strong> {{location}}</p>');
  const [invitationFooterAr, setInvitationFooterAr] = useState('<p>مع أطيب التحيات،<br/>فريق فعاليات المركز</p>');

  // Quill editor refs
  const stakeholderQuillRef = useRef<any>(null);
  const reminderQuillRef = useRef<any>(null);
  const managementQuillRef = useRef<any>(null);
  const invitationQuillRef = useRef<any>(null);
  const stakeholderFooterQuillRef = useRef<any>(null);
  const reminderFooterQuillRef = useRef<any>(null);
  const managementFooterQuillRef = useRef<any>(null);
  const invitationFooterQuillRef = useRef<any>(null);
  const taskCompletionQuillRef = useRef<any>(null);
  const taskCompletionFooterQuillRef = useRef<any>(null);
  const updatesQuillRef = useRef<any>(null);
  const updatesQuillRefAr = useRef<any>(null);

  // Styling collapsible states
  const [stakeholderStylingOpen, setStakeholderStylingOpen] = useState(false);
  const [reminderStylingOpen, setReminderStylingOpen] = useState(false);
  const [managementStylingOpen, setManagementStylingOpen] = useState(false);
  const [invitationStylingOpen, setInvitationStylingOpen] = useState(false);
  const [stakeholderRequirementsStylingOpen, setStakeholderRequirementsStylingOpen] = useState(false);
  const [reminderRequirementsStylingOpen, setReminderRequirementsStylingOpen] = useState(false);
  const [managementRequirementsStylingOpen, setManagementRequirementsStylingOpen] = useState(false);
  const [stakeholderFooterStylingOpen, setStakeholderFooterStylingOpen] = useState(false);
  const [reminderFooterStylingOpen, setReminderFooterStylingOpen] = useState(false);
  const [managementFooterStylingOpen, setManagementFooterStylingOpen] = useState(false);
  const [invitationFooterStylingOpen, setInvitationFooterStylingOpen] = useState(false);
  const [taskCompletionStylingOpen, setTaskCompletionStylingOpen] = useState(false);
  const [taskCompletionFooterStylingOpen, setTaskCompletionFooterStylingOpen] = useState(false);

  // Query settings
  const { data: settings } = useQuery<{
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
    emailRecipients?: string;
    emailSubjectTemplate?: string;
    emailBodyTemplate?: string;
    globalCcList?: string;
    stakeholderCcList?: string;
    reminderCcList?: string;
    managementSummaryCcList?: string;
    managementSummaryEnabled?: boolean;
    managementSummaryRecipients?: string;
    managementSummarySubjectTemplate?: string;
    managementSummaryBody?: string;
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
    stakeholderFooter?: string;
    stakeholderFooterBrandColor?: string;
    stakeholderFooterTextColor?: string;
    stakeholderFooterBgColor?: string;
    stakeholderFooterFontFamily?: string;
    stakeholderFooterFontSize?: string;
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
    reminderFooter?: string;
    reminderFooterBrandColor?: string;
    reminderFooterTextColor?: string;
    reminderFooterBgColor?: string;
    reminderFooterFontFamily?: string;
    reminderFooterFontSize?: string;
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
    managementSummaryFooter?: string;
    managementSummaryFooterBrandColor?: string;
    managementSummaryFooterTextColor?: string;
    managementSummaryFooterBgColor?: string;
    managementSummaryFooterFontFamily?: string;
    managementSummaryFooterFontSize?: string;
    managementSummaryGreeting?: string;
    managementSummaryStakeholderTemplate?: string;
    managementSummaryStakeholderSeparator?: string;
    managementSummaryRequirementItemTemplate?: string;
    stakeholderRequirementItemTemplate?: string;
    reminderGreeting?: string;
    reminderSubject?: string;
    reminderBody?: string;
    reminderRequirementItemTemplate?: string;
    // Arabic template fields
    stakeholderSubjectAr?: string;
    stakeholderBodyAr?: string;
    stakeholderRequirementsTitleAr?: string;
    stakeholderFooterAr?: string;
    stakeholderGreetingAr?: string;
    reminderSubjectAr?: string;
    reminderBodyAr?: string;
    reminderRequirementsTitleAr?: string;
    reminderFooterAr?: string;
    reminderGreetingAr?: string;
    managementSummarySubjectAr?: string;
    managementSummaryBodyAr?: string;
    managementSummaryRequirementsTitleAr?: string;
    managementSummaryFooterAr?: string;
    managementSummaryGreetingAr?: string;
    // Task Completion template fields
    taskCompletionSubject?: string;
    taskCompletionBody?: string;
    taskCompletionBrandColor?: string;
    taskCompletionTextColor?: string;
    taskCompletionBgColor?: string;
    taskCompletionFontFamily?: string;
    taskCompletionFontSize?: string;
    taskCompletionFooter?: string;
    taskCompletionFooterBrandColor?: string;
    taskCompletionFooterTextColor?: string;
    taskCompletionFooterBgColor?: string;
    taskCompletionFooterFontFamily?: string;
    taskCompletionFooterFontSize?: string;
    taskCompletionSubjectAr?: string;
    taskCompletionBodyAr?: string;
    taskCompletionFooterAr?: string;
    // Updates template fields
    updatesEmailTemplate?: string;
    updatesEmailTemplateAr?: string;
    updatesBrandColor?: string;
    updatesTextColor?: string;
    updatesBgColor?: string;
    updatesFontFamily?: string;
    updatesFontSize?: string;
    // Invitation template fields
    invitationGreeting?: string;
    invitationSubject?: string;
    invitationBody?: string;
    invitationBrandColor?: string;
    invitationTextColor?: string;
    invitationBgColor?: string;
    invitationFontFamily?: string;
    invitationFontSize?: string;
    invitationFooter?: string;
    invitationFooterBrandColor?: string;
    invitationFooterTextColor?: string;
    invitationFooterBgColor?: string;
    invitationFooterFontFamily?: string;
    invitationFooterFontSize?: string;
    invitationGreetingAr?: string;
    invitationSubjectAr?: string;
    invitationBodyAr?: string;
    invitationFooterAr?: string;
    // Invitation sender fields
    invitationFromEmail?: string;
    invitationFromName?: string;
    // Global email language preference
    emailLanguage?: string;
  }>({
    queryKey: ['/api/settings/admin'],
  });

  // Sync settings to state on mount
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
      setInvitationFromEmail(settings.invitationFromEmail || '');
      setInvitationFromName(settings.invitationFromName || '');
      setGlobalCcList(settings.globalCcList || '');
      setStakeholderCcList(settings.stakeholderCcList || '');
      setReminderCcList(settings.reminderCcList || '');
      setManagementSummaryCcList(settings.managementSummaryCcList || '');
      setManagementSummaryEnabled(settings.managementSummaryEnabled || false);
      setManagementSummaryRecipients(settings.managementSummaryRecipients || '');
      
      // Load global email language preference
      setEmailLanguage((settings.emailLanguage as 'en' | 'ar') || 'en');
      
      // Stakeholder template (English)
      if (settings.stakeholderSubject) setStakeholderSubject(settings.stakeholderSubject);
      if (settings.stakeholderBody) setStakeholderBody(settings.stakeholderBody);
      if (settings.stakeholderBrandColor) setStakeholderBrandColor(settings.stakeholderBrandColor);
      if (settings.stakeholderTextColor) setStakeholderTextColor(settings.stakeholderTextColor);
      if (settings.stakeholderBgColor) setStakeholderBgColor(settings.stakeholderBgColor);
      if (settings.stakeholderFontFamily) setStakeholderFontFamily(settings.stakeholderFontFamily);
      if (settings.stakeholderFontSize) setStakeholderFontSize(settings.stakeholderFontSize);
      
      // Stakeholder template (Arabic)
      if (settings.stakeholderSubjectAr) setStakeholderSubjectAr(settings.stakeholderSubjectAr);
      if (settings.stakeholderBodyAr) setStakeholderBodyAr(settings.stakeholderBodyAr);
      if (settings.stakeholderRequirementsTitleAr) setStakeholderRequirementsTitleAr(settings.stakeholderRequirementsTitleAr);
      if (settings.stakeholderFooterAr) setStakeholderFooterAr(settings.stakeholderFooterAr);
      
      // Reminder template (English)
      if (settings.emailSubjectTemplate) setReminderSubject(settings.emailSubjectTemplate);
      if (settings.emailBodyTemplate) setReminderBody(settings.emailBodyTemplate);
      if (settings.reminderBrandColor) setReminderBrandColor(settings.reminderBrandColor);
      if (settings.reminderTextColor) setReminderTextColor(settings.reminderTextColor);
      if (settings.reminderBgColor) setReminderBgColor(settings.reminderBgColor);
      if (settings.reminderFontFamily) setReminderFontFamily(settings.reminderFontFamily);
      if (settings.reminderFontSize) setReminderFontSize(settings.reminderFontSize);
      
      // Reminder template (Arabic)
      if (settings.reminderSubjectAr) setReminderSubjectAr(settings.reminderSubjectAr);
      if (settings.reminderBodyAr) setReminderBodyAr(settings.reminderBodyAr);
      if (settings.reminderRequirementsTitleAr) setReminderRequirementsTitleAr(settings.reminderRequirementsTitleAr);
      if (settings.reminderFooterAr) setReminderFooterAr(settings.reminderFooterAr);
      
      // Management summary template (English)
      if (settings.managementSummarySubjectTemplate) setManagementSummarySubject(settings.managementSummarySubjectTemplate);
      if (settings.managementSummaryBody) setManagementSummaryBody(settings.managementSummaryBody);
      if (settings.managementSummaryBrandColor) setManagementSummaryBrandColor(settings.managementSummaryBrandColor);
      if (settings.managementSummaryTextColor) setManagementSummaryTextColor(settings.managementSummaryTextColor);
      if (settings.managementSummaryBgColor) setManagementSummaryBgColor(settings.managementSummaryBgColor);
      if (settings.managementSummaryFontFamily) setManagementSummaryFontFamily(settings.managementSummaryFontFamily);
      if (settings.managementSummaryFontSize) setManagementSummaryFontSize(settings.managementSummaryFontSize);
      
      // Management summary template (Arabic)
      if (settings.managementSummarySubjectAr) setManagementSummarySubjectAr(settings.managementSummarySubjectAr);
      if (settings.managementSummaryBodyAr) setManagementSummaryBodyAr(settings.managementSummaryBodyAr);
      if (settings.managementSummaryRequirementsTitleAr) setManagementSummaryRequirementsTitleAr(settings.managementSummaryRequirementsTitleAr);
      if (settings.managementSummaryFooterAr) setManagementSummaryFooterAr(settings.managementSummaryFooterAr);
      
      // Stakeholder requirements section styling
      if (settings.stakeholderRequirementsTitle) setStakeholderRequirementsTitle(settings.stakeholderRequirementsTitle);
      if (settings.stakeholderRequirementsBrandColor) setStakeholderRequirementsBrandColor(settings.stakeholderRequirementsBrandColor);
      if (settings.stakeholderRequirementsTextColor) setStakeholderRequirementsTextColor(settings.stakeholderRequirementsTextColor);
      if (settings.stakeholderRequirementsBgColor) setStakeholderRequirementsBgColor(settings.stakeholderRequirementsBgColor);
      if (settings.stakeholderRequirementsFontFamily) setStakeholderRequirementsFontFamily(settings.stakeholderRequirementsFontFamily);
      if (settings.stakeholderRequirementsFontSize) setStakeholderRequirementsFontSize(settings.stakeholderRequirementsFontSize);
      
      // Stakeholder footer
      if (settings.stakeholderFooter) setStakeholderFooter(settings.stakeholderFooter);
      if (settings.stakeholderFooterBrandColor) setStakeholderFooterBrandColor(settings.stakeholderFooterBrandColor);
      if (settings.stakeholderFooterTextColor) setStakeholderFooterTextColor(settings.stakeholderFooterTextColor);
      if (settings.stakeholderFooterBgColor) setStakeholderFooterBgColor(settings.stakeholderFooterBgColor);
      if (settings.stakeholderFooterFontFamily) setStakeholderFooterFontFamily(settings.stakeholderFooterFontFamily);
      if (settings.stakeholderFooterFontSize) setStakeholderFooterFontSize(settings.stakeholderFooterFontSize);
      
      // Reminder requirements section styling
      if (settings.reminderRequirementsTitle) setReminderRequirementsTitle(settings.reminderRequirementsTitle);
      if (settings.reminderRequirementsBrandColor) setReminderRequirementsBrandColor(settings.reminderRequirementsBrandColor);
      if (settings.reminderRequirementsTextColor) setReminderRequirementsTextColor(settings.reminderRequirementsTextColor);
      if (settings.reminderRequirementsBgColor) setReminderRequirementsBgColor(settings.reminderRequirementsBgColor);
      if (settings.reminderRequirementsFontFamily) setReminderRequirementsFontFamily(settings.reminderRequirementsFontFamily);
      if (settings.reminderRequirementsFontSize) setReminderRequirementsFontSize(settings.reminderRequirementsFontSize);
      
      // Reminder footer
      if (settings.reminderFooter) setReminderFooter(settings.reminderFooter);
      if (settings.reminderFooterBrandColor) setReminderFooterBrandColor(settings.reminderFooterBrandColor);
      if (settings.reminderFooterTextColor) setReminderFooterTextColor(settings.reminderFooterTextColor);
      if (settings.reminderFooterBgColor) setReminderFooterBgColor(settings.reminderFooterBgColor);
      if (settings.reminderFooterFontFamily) setReminderFooterFontFamily(settings.reminderFooterFontFamily);
      if (settings.reminderFooterFontSize) setReminderFooterFontSize(settings.reminderFooterFontSize);
      
      // Management summary requirements section styling
      if (settings.managementSummaryRequirementsTitle) setManagementSummaryRequirementsTitle(settings.managementSummaryRequirementsTitle);
      if (settings.managementSummaryRequirementsBrandColor) setManagementSummaryRequirementsBrandColor(settings.managementSummaryRequirementsBrandColor);
      if (settings.managementSummaryRequirementsTextColor) setManagementSummaryRequirementsTextColor(settings.managementSummaryRequirementsTextColor);
      if (settings.managementSummaryRequirementsBgColor) setManagementSummaryRequirementsBgColor(settings.managementSummaryRequirementsBgColor);
      if (settings.managementSummaryRequirementsFontFamily) setManagementSummaryRequirementsFontFamily(settings.managementSummaryRequirementsFontFamily);
      if (settings.managementSummaryRequirementsFontSize) setManagementSummaryRequirementsFontSize(settings.managementSummaryRequirementsFontSize);
      
      // Management summary footer
      if (settings.managementSummaryFooter) setManagementSummaryFooter(settings.managementSummaryFooter);
      if (settings.managementSummaryFooterBrandColor) setManagementSummaryFooterBrandColor(settings.managementSummaryFooterBrandColor);
      if (settings.managementSummaryFooterTextColor) setManagementSummaryFooterTextColor(settings.managementSummaryFooterTextColor);
      if (settings.managementSummaryFooterBgColor) setManagementSummaryFooterBgColor(settings.managementSummaryFooterBgColor);
      if (settings.managementSummaryFooterFontFamily) setManagementSummaryFooterFontFamily(settings.managementSummaryFooterFontFamily);
      if (settings.managementSummaryFooterFontSize) setManagementSummaryFooterFontSize(settings.managementSummaryFooterFontSize);
      
      // Advanced template customization fields
      if (settings.managementSummaryGreeting) setManagementSummaryGreeting(settings.managementSummaryGreeting);
      if (settings.managementSummaryStakeholderTemplate) setManagementSummaryStakeholderTemplate(settings.managementSummaryStakeholderTemplate);
      if (settings.managementSummaryStakeholderSeparator) setManagementSummaryStakeholderSeparator(settings.managementSummaryStakeholderSeparator);
      if (settings.managementSummaryRequirementItemTemplate) setManagementSummaryRequirementItemTemplate(settings.managementSummaryRequirementItemTemplate);
      if (settings.stakeholderRequirementItemTemplate) setStakeholderRequirementItemTemplate(settings.stakeholderRequirementItemTemplate);
      if (settings.reminderGreeting) setReminderGreeting(settings.reminderGreeting);
      if (settings.reminderSubject) setReminderSubject(settings.reminderSubject);
      if (settings.reminderBody) setReminderBody(settings.reminderBody);
      if (settings.reminderRequirementItemTemplate) setReminderRequirementItemTemplate(settings.reminderRequirementItemTemplate);
      
      // Task Completion template (English)
      if (settings.taskCompletionSubject) setTaskCompletionSubject(settings.taskCompletionSubject);
      if (settings.taskCompletionBody) setTaskCompletionBody(settings.taskCompletionBody);
      if (settings.taskCompletionBrandColor) setTaskCompletionBrandColor(settings.taskCompletionBrandColor);
      if (settings.taskCompletionTextColor) setTaskCompletionTextColor(settings.taskCompletionTextColor);
      if (settings.taskCompletionBgColor) setTaskCompletionBgColor(settings.taskCompletionBgColor);
      if (settings.taskCompletionFontFamily) setTaskCompletionFontFamily(settings.taskCompletionFontFamily);
      if (settings.taskCompletionFontSize) setTaskCompletionFontSize(settings.taskCompletionFontSize);
      
      // Task Completion footer
      if (settings.taskCompletionFooter) setTaskCompletionFooter(settings.taskCompletionFooter);
      if (settings.taskCompletionFooterBrandColor) setTaskCompletionFooterBrandColor(settings.taskCompletionFooterBrandColor);
      if (settings.taskCompletionFooterTextColor) setTaskCompletionFooterTextColor(settings.taskCompletionFooterTextColor);
      if (settings.taskCompletionFooterBgColor) setTaskCompletionFooterBgColor(settings.taskCompletionFooterBgColor);
      if (settings.taskCompletionFooterFontFamily) setTaskCompletionFooterFontFamily(settings.taskCompletionFooterFontFamily);
      if (settings.taskCompletionFooterFontSize) setTaskCompletionFooterFontSize(settings.taskCompletionFooterFontSize);
      
      // Task Completion template (Arabic)
      if (settings.taskCompletionSubjectAr) setTaskCompletionSubjectAr(settings.taskCompletionSubjectAr);
      if (settings.taskCompletionBodyAr) setTaskCompletionBodyAr(settings.taskCompletionBodyAr);
      if (settings.taskCompletionFooterAr) setTaskCompletionFooterAr(settings.taskCompletionFooterAr);
      
      // Updates email templates
      if (settings.updatesEmailTemplate) setUpdatesEmailTemplate(settings.updatesEmailTemplate);
      if (settings.updatesEmailTemplateAr) setUpdatesEmailTemplateAr(settings.updatesEmailTemplateAr);
      if (settings.updatesBrandColor) setUpdatesBrandColor(settings.updatesBrandColor);
      if (settings.updatesTextColor) setUpdatesTextColor(settings.updatesTextColor);
      if (settings.updatesBgColor) setUpdatesBgColor(settings.updatesBgColor);
      if (settings.updatesFontFamily) setUpdatesFontFamily(settings.updatesFontFamily);
      if (settings.updatesFontSize) setUpdatesFontSize(settings.updatesFontSize);
      
      // Invitation email templates (English)
      if (settings.invitationGreeting) setInvitationGreeting(settings.invitationGreeting);
      if (settings.invitationSubject) setInvitationSubject(settings.invitationSubject);
      if (settings.invitationBody) setInvitationBody(settings.invitationBody);
      if (settings.invitationBrandColor) setInvitationBrandColor(settings.invitationBrandColor);
      if (settings.invitationTextColor) setInvitationTextColor(settings.invitationTextColor);
      if (settings.invitationBgColor) setInvitationBgColor(settings.invitationBgColor);
      if (settings.invitationFontFamily) setInvitationFontFamily(settings.invitationFontFamily);
      if (settings.invitationFontSize) setInvitationFontSize(settings.invitationFontSize);
      
      // Invitation footer
      if (settings.invitationFooter) setInvitationFooter(settings.invitationFooter);
      if (settings.invitationFooterBrandColor) setInvitationFooterBrandColor(settings.invitationFooterBrandColor);
      if (settings.invitationFooterTextColor) setInvitationFooterTextColor(settings.invitationFooterTextColor);
      if (settings.invitationFooterBgColor) setInvitationFooterBgColor(settings.invitationFooterBgColor);
      if (settings.invitationFooterFontFamily) setInvitationFooterFontFamily(settings.invitationFooterFontFamily);
      if (settings.invitationFooterFontSize) setInvitationFooterFontSize(settings.invitationFooterFontSize);
      
      // Invitation email templates (Arabic)
      if (settings.invitationGreetingAr) setInvitationGreetingAr(settings.invitationGreetingAr);
      if (settings.invitationSubjectAr) setInvitationSubjectAr(settings.invitationSubjectAr);
      if (settings.invitationBodyAr) setInvitationBodyAr(settings.invitationBodyAr);
      if (settings.invitationFooterAr) setInvitationFooterAr(settings.invitationFooterAr);
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

  // Save provider settings
  const handleSaveProviderSettings = () => {
    const data: any = {
      emailEnabled,
      emailProvider,
      emailFromEmail,
      emailFromName,
      invitationFromEmail,
      invitationFromName,
      emailRecipients,
      globalCcList,
      stakeholderCcList,
      reminderCcList,
      managementSummaryCcList,
      managementSummaryEnabled,
      managementSummaryRecipients,
      emailLanguage, // Save global email language
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

  // Save stakeholder template
  const handleSaveStakeholderTemplate = () => {
    const dataToSave: any = {
      stakeholderSubject,
      stakeholderBody,
      stakeholderBrandColor,
      stakeholderTextColor,
      stakeholderBgColor,
      stakeholderFontFamily,
      stakeholderFontSize,
      stakeholderRequirementsTitle,
      stakeholderRequirementsBrandColor,
      stakeholderRequirementsTextColor,
      stakeholderRequirementsBgColor,
      stakeholderRequirementsFontFamily,
      stakeholderRequirementsFontSize,
      stakeholderFooter,
      stakeholderFooterBrandColor,
      stakeholderFooterTextColor,
      stakeholderFooterBgColor,
      stakeholderFooterFontFamily,
      stakeholderFooterFontSize,
      stakeholderRequirementItemTemplate,
      // Arabic templates
      stakeholderSubjectAr,
      stakeholderBodyAr,
      stakeholderRequirementsTitleAr,
      stakeholderFooterAr,
    };
    saveSettingsMutation.mutate(dataToSave);
  };

  // Save reminder template
  const handleSaveReminderTemplate = () => {
    const dataToSave: any = {
      emailSubjectTemplate: reminderSubject,
      emailBodyTemplate: reminderBody,
      reminderSubject,
      reminderBody,
      reminderBrandColor,
      reminderTextColor,
      reminderBgColor,
      reminderFontFamily,
      reminderFontSize,
      reminderRequirementsTitle,
      reminderRequirementsBrandColor,
      reminderRequirementsTextColor,
      reminderRequirementsBgColor,
      reminderRequirementsFontFamily,
      reminderRequirementsFontSize,
      reminderFooter,
      reminderFooterBrandColor,
      reminderFooterTextColor,
      reminderFooterBgColor,
      reminderFooterFontFamily,
      reminderFooterFontSize,
      reminderGreeting,
      reminderRequirementItemTemplate,
      // Arabic templates
      reminderSubjectAr,
      reminderBodyAr,
      reminderRequirementsTitleAr,
      reminderFooterAr,
      reminderGreetingAr,
    };
    saveSettingsMutation.mutate(dataToSave);
  };

  // Save management summary template
  const handleSaveManagementTemplate = () => {
    saveSettingsMutation.mutate({
      managementSummarySubjectTemplate: managementSummarySubject,
      managementSummaryBody,
      managementSummaryBrandColor,
      managementSummaryTextColor,
      managementSummaryBgColor,
      managementSummaryFontFamily,
      managementSummaryFontSize,
      managementSummaryRequirementsTitle,
      managementSummaryRequirementsBrandColor,
      managementSummaryRequirementsTextColor,
      managementSummaryRequirementsBgColor,
      managementSummaryRequirementsFontFamily,
      managementSummaryRequirementsFontSize,
      managementSummaryFooter,
      managementSummaryFooterBrandColor,
      managementSummaryFooterTextColor,
      managementSummaryFooterBgColor,
      managementSummaryFooterFontFamily,
      managementSummaryFooterFontSize,
      managementSummaryGreeting,
      managementSummaryStakeholderTemplate,
      managementSummaryStakeholderSeparator,
      managementSummaryRequirementItemTemplate,
      // Arabic templates
      managementSummarySubjectAr,
      managementSummaryBodyAr,
      managementSummaryRequirementsTitleAr,
      managementSummaryFooterAr,
      managementSummaryGreetingAr,
    });
  };

  // Save task completion template
  const handleSaveTaskCompletionTemplate = () => {
    const dataToSave = emailLanguage === 'ar' ? {
      taskCompletionSubjectAr,
      taskCompletionBodyAr,
      taskCompletionFooterAr,
      taskCompletionBrandColor,
      taskCompletionTextColor,
      taskCompletionBgColor,
      taskCompletionFontFamily,
      taskCompletionFontSize,
      taskCompletionFooterBrandColor,
      taskCompletionFooterTextColor,
      taskCompletionFooterBgColor,
      taskCompletionFooterFontFamily,
      taskCompletionFooterFontSize,
    } : {
      taskCompletionSubject,
      taskCompletionBody,
      taskCompletionFooter,
      taskCompletionBrandColor,
      taskCompletionTextColor,
      taskCompletionBgColor,
      taskCompletionFontFamily,
      taskCompletionFontSize,
      taskCompletionFooterBrandColor,
      taskCompletionFooterTextColor,
      taskCompletionFooterBgColor,
      taskCompletionFooterFontFamily,
      taskCompletionFooterFontSize,
    };
    saveSettingsMutation.mutate(dataToSave);
  };

  const handleSaveUpdatesTemplate = () => {
    const dataToSave = emailLanguage === 'ar' ? {
      updatesEmailTemplateAr,
      updatesBrandColor,
      updatesTextColor,
      updatesBgColor,
      updatesFontFamily,
      updatesFontSize,
    } : {
      updatesEmailTemplate,
      updatesBrandColor,
      updatesTextColor,
      updatesBgColor,
      updatesFontFamily,
      updatesFontSize,
    };
    saveSettingsMutation.mutate(dataToSave);
  };

  // Save invitation template
  const handleSaveInvitationTemplate = () => {
    const dataToSave: any = {
      invitationGreeting,
      invitationSubject,
      invitationBody,
      invitationBrandColor,
      invitationTextColor,
      invitationBgColor,
      invitationFontFamily,
      invitationFontSize,
      invitationFooter,
      invitationFooterBrandColor,
      invitationFooterTextColor,
      invitationFooterBgColor,
      invitationFooterFontFamily,
      invitationFooterFontSize,
      // Arabic templates
      invitationGreetingAr,
      invitationSubjectAr,
      invitationBodyAr,
      invitationFooterAr,
    };
    saveSettingsMutation.mutate(dataToSave);
  };

  // Insert variable into editor
  const insertVariable = (variable: string, quillRef: any) => {
    const editor = quillRef.current?.getEditor();
    if (editor) {
      const range = editor.getSelection();
      if (range) {
        editor.insertText(range.index, variable);
        editor.setSelection(range.index + variable.length);
      }
    }
  };

  // Replace template variables with sample data
  const replaceVariables = (template: string) => {
    let result = template;
    Object.entries(SAMPLE_EVENT).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return result;
  };

  // Generate preview HTML for custom message only
  const generatePreviewHtml = (body: string, brandColor: string, textColor: string, bgColor: string, fontFamily: string, fontSize: string, requirementsHtml?: string) => {
    let processedBody = replaceVariables(body);
    
    // If requirementsHtml is provided and body contains {{requirements}}, replace it inline
    if (requirementsHtml && processedBody.includes('{{requirements}}')) {
      processedBody = processedBody.replace(/\{\{requirements\}\}/g, requirementsHtml);
    }
    
    return `
      <div style="font-family: ${fontFamily}; font-size: ${fontSize}; color: ${textColor}; background-color: ${bgColor}; padding: 24px; border-radius: 8px; border: 2px solid ${brandColor};">
        ${processedBody}
      </div>
    `;
  };

  // Generate requirements section preview
  const generateRequirementsPreviewHtml = (title: string, reqBrandColor: string, reqTextColor: string, reqBgColor: string, reqFontFamily: string, reqFontSize: string) => {
    return `
      <div style="font-family: ${reqFontFamily}; font-size: ${reqFontSize}; color: ${reqTextColor}; background-color: ${reqBgColor}; padding: 16px; border-radius: 4px;">
        <h2 style="color: ${reqBrandColor}; font-size: 18px; margin-bottom: 12px;">${title}</h2>
        <ul style="margin: 12px 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">
            <strong>Submit Event Documentation</strong>
            <br />
            <span style="color: #666; font-size: 14px;">Provide a comprehensive report covering key highlights, attendance figures, and outcomes within 5 business days.</span>
          </li>
          <li style="margin-bottom: 8px;">
            <strong>Coordinate Logistics</strong>
            <br />
            <span style="color: #666; font-size: 14px;">Ensure all venue, catering, and technical requirements are confirmed at least 2 weeks before the event date.</span>
          </li>
          <li style="margin-bottom: 8px;">
            <strong>Prepare Promotional Materials</strong>
            <br />
            <span style="color: #666; font-size: 14px;">Design and distribute event flyers, social media content, and email announcements to target audience.</span>
          </li>
        </ul>
      </div>
    `;
  };

  // Generate footer preview
  const generateFooterPreviewHtml = (footerBody: string, footerBrandColor: string, footerTextColor: string, footerBgColor: string, footerFontFamily: string, footerFontSize: string) => {
    const processedFooter = replaceVariables(footerBody);
    return `
      <div style="font-family: ${footerFontFamily}; font-size: ${footerFontSize}; color: ${footerTextColor}; background-color: ${footerBgColor}; padding: 16px; border-radius: 4px; border-top: 2px solid ${footerBrandColor};">
        ${processedFooter}
      </div>
    `;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          {t('communications.emailConfiguration')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('communications.subtitle')}
        </p>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Label htmlFor="email-template-select" className="text-base font-semibold mb-2 block">
            {t('emailConfig.selectTemplate') || 'Select Email Template'}
          </Label>
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger id="email-template-select" className="w-full max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="provider">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {t('settings.title')} & {t('communications.configuration')}
                </div>
              </SelectItem>
              <SelectItem value="stakeholder">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {t('departments.title')} {t('communications.email')}
                </div>
              </SelectItem>
              <SelectItem value="reminder">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {t('reminders.title')} {t('communications.email')}
                </div>
              </SelectItem>
              <SelectItem value="invitation">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Invitation Email
                </div>
              </SelectItem>
              <SelectItem value="management">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {t('communications.managementSummary')}
                </div>
              </SelectItem>
              <SelectItem value="taskCompletion">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Task Completion
                </div>
              </SelectItem>
              <SelectItem value="updates">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {t('updates.title')}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>

          <TabsContent value="provider" className="space-y-6">
            <ProviderTab
              emailEnabled={emailEnabled}
              setEmailEnabled={setEmailEnabled}
              emailLanguage={emailLanguage}
              setEmailLanguage={setEmailLanguage}
              emailProvider={emailProvider}
              setEmailProvider={setEmailProvider}
              emailApiKey={emailApiKey}
              setEmailApiKey={setEmailApiKey}
              smtpHost={smtpHost}
              setSmtpHost={setSmtpHost}
              smtpPort={smtpPort}
              setSmtpPort={setSmtpPort}
              smtpSecure={smtpSecure}
              setSmtpSecure={setSmtpSecure}
              smtpUser={smtpUser}
              setSmtpUser={setSmtpUser}
              smtpPassword={smtpPassword}
              setSmtpPassword={setSmtpPassword}
              emailFromEmail={emailFromEmail}
              setEmailFromEmail={setEmailFromEmail}
              emailFromName={emailFromName}
              setEmailFromName={setEmailFromName}
              invitationFromEmail={invitationFromEmail}
              setInvitationFromEmail={setInvitationFromEmail}
              invitationFromName={invitationFromName}
              setInvitationFromName={setInvitationFromName}
              testEmailRecipient={testEmailRecipient}
              setTestEmailRecipient={setTestEmailRecipient}
              testEmailMutation={testEmailMutation}
              emailRecipients={emailRecipients}
              setEmailRecipients={setEmailRecipients}
              managementSummaryRecipients={managementSummaryRecipients}
              setManagementSummaryRecipients={setManagementSummaryRecipients}
              managementSummaryEnabled={managementSummaryEnabled}
              setManagementSummaryEnabled={setManagementSummaryEnabled}
              globalCcList={globalCcList}
              setGlobalCcList={setGlobalCcList}
              stakeholderCcList={stakeholderCcList}
              setStakeholderCcList={setStakeholderCcList}
              reminderCcList={reminderCcList}
              setReminderCcList={setReminderCcList}
              managementSummaryCcList={managementSummaryCcList}
              setManagementSummaryCcList={setManagementSummaryCcList}
              handleSaveProviderSettings={handleSaveProviderSettings}
              saveSettingsMutation={saveSettingsMutation}
            />
          </TabsContent>

          {/* Tab 2: Stakeholder Emails Template */}
          <TabsContent value="stakeholder">
            <StakeholderTab
              emailLanguage={emailLanguage}
              TEMPLATE_VARIABLES={TEMPLATE_VARIABLES}
              FONT_FAMILIES={FONT_FAMILIES}
              FONT_SIZES={FONT_SIZES}
              stakeholderSubject={emailLanguage === 'ar' ? stakeholderSubjectAr : stakeholderSubject}
              setStakeholderSubject={emailLanguage === 'ar' ? setStakeholderSubjectAr : setStakeholderSubject}
              stakeholderBody={emailLanguage === 'ar' ? stakeholderBodyAr : stakeholderBody}
              setStakeholderBody={emailLanguage === 'ar' ? setStakeholderBodyAr : setStakeholderBody}
              stakeholderBrandColor={stakeholderBrandColor}
              setStakeholderBrandColor={setStakeholderBrandColor}
              stakeholderTextColor={stakeholderTextColor}
              setStakeholderTextColor={setStakeholderTextColor}
              stakeholderBgColor={stakeholderBgColor}
              setStakeholderBgColor={setStakeholderBgColor}
              stakeholderFontFamily={stakeholderFontFamily}
              setStakeholderFontFamily={setStakeholderFontFamily}
              stakeholderFontSize={stakeholderFontSize}
              setStakeholderFontSize={setStakeholderFontSize}
              stakeholderRequirementsTitle={emailLanguage === 'ar' ? stakeholderRequirementsTitleAr : stakeholderRequirementsTitle}
              setStakeholderRequirementsTitle={emailLanguage === 'ar' ? setStakeholderRequirementsTitleAr : setStakeholderRequirementsTitle}
              stakeholderRequirementsBrandColor={stakeholderRequirementsBrandColor}
              setStakeholderRequirementsBrandColor={setStakeholderRequirementsBrandColor}
              stakeholderRequirementsTextColor={stakeholderRequirementsTextColor}
              setStakeholderRequirementsTextColor={setStakeholderRequirementsTextColor}
              stakeholderRequirementsBgColor={stakeholderRequirementsBgColor}
              setStakeholderRequirementsBgColor={setStakeholderRequirementsBgColor}
              stakeholderRequirementsFontFamily={stakeholderRequirementsFontFamily}
              setStakeholderRequirementsFontFamily={setStakeholderRequirementsFontFamily}
              stakeholderRequirementsFontSize={stakeholderRequirementsFontSize}
              setStakeholderRequirementsFontSize={setStakeholderRequirementsFontSize}
              stakeholderRequirementItemTemplate={stakeholderRequirementItemTemplate}
              setStakeholderRequirementItemTemplate={setStakeholderRequirementItemTemplate}
              stakeholderFooter={emailLanguage === 'ar' ? stakeholderFooterAr : stakeholderFooter}
              setStakeholderFooter={emailLanguage === 'ar' ? setStakeholderFooterAr : setStakeholderFooter}
              stakeholderFooterBrandColor={stakeholderFooterBrandColor}
              setStakeholderFooterBrandColor={setStakeholderFooterBrandColor}
              stakeholderFooterTextColor={stakeholderFooterTextColor}
              setStakeholderFooterTextColor={setStakeholderFooterTextColor}
              stakeholderFooterBgColor={stakeholderFooterBgColor}
              setStakeholderFooterBgColor={setStakeholderFooterBgColor}
              stakeholderFooterFontFamily={stakeholderFooterFontFamily}
              setStakeholderFooterFontFamily={setStakeholderFooterFontFamily}
              stakeholderFooterFontSize={stakeholderFooterFontSize}
              setStakeholderFooterFontSize={setStakeholderFooterFontSize}
              stakeholderStylingOpen={stakeholderStylingOpen}
              setStakeholderStylingOpen={setStakeholderStylingOpen}
              stakeholderRequirementsStylingOpen={stakeholderRequirementsStylingOpen}
              setStakeholderRequirementsStylingOpen={setStakeholderRequirementsStylingOpen}
              stakeholderFooterStylingOpen={stakeholderFooterStylingOpen}
              setStakeholderFooterStylingOpen={setStakeholderFooterStylingOpen}
              stakeholderQuillRef={stakeholderQuillRef}
              stakeholderFooterQuillRef={stakeholderFooterQuillRef}
              testEmailRecipient={testEmailRecipient}
              setTestEmailRecipient={setTestEmailRecipient}
              testEmailMutation={testEmailMutation}
              handleSaveStakeholderTemplate={handleSaveStakeholderTemplate}
              saveSettingsMutation={saveSettingsMutation}
              insertVariable={insertVariable}
              replaceVariables={replaceVariables}
              generatePreviewHtml={generatePreviewHtml}
              generateRequirementsPreviewHtml={generateRequirementsPreviewHtml}
              generateFooterPreviewHtml={generateFooterPreviewHtml}
            />
          </TabsContent>

          {/* Tab 3: Reminder Emails Template */}
          <TabsContent value="reminder">
            <ReminderTab
              emailLanguage={emailLanguage}
              TEMPLATE_VARIABLES={TEMPLATE_VARIABLES}
              FONT_FAMILIES={FONT_FAMILIES}
              FONT_SIZES={FONT_SIZES}
              reminderSubject={emailLanguage === 'ar' ? reminderSubjectAr : reminderSubject}
              setReminderSubject={emailLanguage === 'ar' ? setReminderSubjectAr : setReminderSubject}
              reminderBody={emailLanguage === 'ar' ? reminderBodyAr : reminderBody}
              setReminderBody={emailLanguage === 'ar' ? setReminderBodyAr : setReminderBody}
              reminderBrandColor={reminderBrandColor}
              setReminderBrandColor={setReminderBrandColor}
              reminderTextColor={reminderTextColor}
              setReminderTextColor={setReminderTextColor}
              reminderBgColor={reminderBgColor}
              setReminderBgColor={setReminderBgColor}
              reminderFontFamily={reminderFontFamily}
              setReminderFontFamily={setReminderFontFamily}
              reminderFontSize={reminderFontSize}
              setReminderFontSize={setReminderFontSize}
              reminderRequirementsTitle={emailLanguage === 'ar' ? reminderRequirementsTitleAr : reminderRequirementsTitle}
              setReminderRequirementsTitle={emailLanguage === 'ar' ? setReminderRequirementsTitleAr : setReminderRequirementsTitle}
              reminderRequirementsBrandColor={reminderRequirementsBrandColor}
              setReminderRequirementsBrandColor={setReminderRequirementsBrandColor}
              reminderRequirementsTextColor={reminderRequirementsTextColor}
              setReminderRequirementsTextColor={setReminderRequirementsTextColor}
              reminderRequirementsBgColor={reminderRequirementsBgColor}
              setReminderRequirementsBgColor={setReminderRequirementsBgColor}
              reminderRequirementsFontFamily={reminderRequirementsFontFamily}
              setReminderRequirementsFontFamily={setReminderRequirementsFontFamily}
              reminderRequirementsFontSize={reminderRequirementsFontSize}
              setReminderRequirementsFontSize={setReminderRequirementsFontSize}
              reminderRequirementItemTemplate={reminderRequirementItemTemplate}
              setReminderRequirementItemTemplate={setReminderRequirementItemTemplate}
              reminderFooter={emailLanguage === 'ar' ? reminderFooterAr : reminderFooter}
              setReminderFooter={emailLanguage === 'ar' ? setReminderFooterAr : setReminderFooter}
              reminderFooterBrandColor={reminderFooterBrandColor}
              setReminderFooterBrandColor={setReminderFooterBrandColor}
              reminderFooterTextColor={reminderFooterTextColor}
              setReminderFooterTextColor={setReminderFooterTextColor}
              reminderFooterBgColor={reminderFooterBgColor}
              setReminderFooterBgColor={setReminderFooterBgColor}
              reminderFooterFontFamily={reminderFooterFontFamily}
              setReminderFooterFontFamily={setReminderFooterFontFamily}
              reminderFooterFontSize={reminderFooterFontSize}
              setReminderFooterFontSize={setReminderFooterFontSize}
              reminderStylingOpen={reminderStylingOpen}
              setReminderStylingOpen={setReminderStylingOpen}
              reminderRequirementsStylingOpen={reminderRequirementsStylingOpen}
              setReminderRequirementsStylingOpen={setReminderRequirementsStylingOpen}
              reminderFooterStylingOpen={reminderFooterStylingOpen}
              setReminderFooterStylingOpen={setReminderFooterStylingOpen}
              reminderQuillRef={reminderQuillRef}
              reminderFooterQuillRef={reminderFooterQuillRef}
              testEmailRecipient={testEmailRecipient}
              setTestEmailRecipient={setTestEmailRecipient}
              handleSaveReminderTemplate={handleSaveReminderTemplate}
              testEmailMutation={testEmailMutation}
              saveSettingsMutation={saveSettingsMutation}
              insertVariable={insertVariable}
              replaceVariables={replaceVariables}
              generatePreviewHtml={generatePreviewHtml}
              generateRequirementsPreviewHtml={generateRequirementsPreviewHtml}
              generateFooterPreviewHtml={generateFooterPreviewHtml}
              reminderGreeting={reminderGreeting}
              setReminderGreeting={setReminderGreeting}
            />
          </TabsContent>

          {/* Tab 3.5: Invitation Email Template */}
          <TabsContent value="invitation">
            <InvitationTab
              emailLanguage={emailLanguage}
              TEMPLATE_VARIABLES={TEMPLATE_VARIABLES}
              FONT_FAMILIES={FONT_FAMILIES}
              FONT_SIZES={FONT_SIZES}
              invitationGreeting={emailLanguage === 'ar' ? invitationGreetingAr : invitationGreeting}
              setInvitationGreeting={emailLanguage === 'ar' ? setInvitationGreetingAr : setInvitationGreeting}
              invitationSubject={emailLanguage === 'ar' ? invitationSubjectAr : invitationSubject}
              setInvitationSubject={emailLanguage === 'ar' ? setInvitationSubjectAr : setInvitationSubject}
              invitationBody={emailLanguage === 'ar' ? invitationBodyAr : invitationBody}
              setInvitationBody={emailLanguage === 'ar' ? setInvitationBodyAr : setInvitationBody}
              invitationBrandColor={invitationBrandColor}
              setInvitationBrandColor={setInvitationBrandColor}
              invitationTextColor={invitationTextColor}
              setInvitationTextColor={setInvitationTextColor}
              invitationBgColor={invitationBgColor}
              setInvitationBgColor={setInvitationBgColor}
              invitationFontFamily={invitationFontFamily}
              setInvitationFontFamily={setInvitationFontFamily}
              invitationFontSize={invitationFontSize}
              setInvitationFontSize={setInvitationFontSize}
              invitationFooter={emailLanguage === 'ar' ? invitationFooterAr : invitationFooter}
              setInvitationFooter={emailLanguage === 'ar' ? setInvitationFooterAr : setInvitationFooter}
              invitationFooterBrandColor={invitationFooterBrandColor}
              setInvitationFooterBrandColor={setInvitationFooterBrandColor}
              invitationFooterTextColor={invitationFooterTextColor}
              setInvitationFooterTextColor={setInvitationFooterTextColor}
              invitationFooterBgColor={invitationFooterBgColor}
              setInvitationFooterBgColor={setInvitationFooterBgColor}
              invitationFooterFontFamily={invitationFooterFontFamily}
              setInvitationFooterFontFamily={setInvitationFooterFontFamily}
              invitationFooterFontSize={invitationFooterFontSize}
              setInvitationFooterFontSize={setInvitationFooterFontSize}
              invitationStylingOpen={invitationStylingOpen}
              setInvitationStylingOpen={setInvitationStylingOpen}
              invitationFooterStylingOpen={invitationFooterStylingOpen}
              setInvitationFooterStylingOpen={setInvitationFooterStylingOpen}
              invitationQuillRef={invitationQuillRef}
              invitationFooterQuillRef={invitationFooterQuillRef}
              testEmailRecipient={testEmailRecipient}
              setTestEmailRecipient={setTestEmailRecipient}
              handleSaveInvitationTemplate={handleSaveInvitationTemplate}
              testEmailMutation={testEmailMutation}
              saveSettingsMutation={saveSettingsMutation}
              insertVariable={insertVariable}
              replaceVariables={replaceVariables}
              generatePreviewHtml={generatePreviewHtml}
              generateFooterPreviewHtml={generateFooterPreviewHtml}
            />
          </TabsContent>

          {/* Tab 4: Management Summary Template */}
          <TabsContent value="management">
            <ManagementTab
              emailLanguage={emailLanguage}
              TEMPLATE_VARIABLES={TEMPLATE_VARIABLES}
              FONT_FAMILIES={FONT_FAMILIES}
              FONT_SIZES={FONT_SIZES}
              managementSummarySubject={emailLanguage === 'ar' ? managementSummarySubjectAr : managementSummarySubject}
              setManagementSummarySubject={emailLanguage === 'ar' ? setManagementSummarySubjectAr : setManagementSummarySubject}
              managementSummaryBody={emailLanguage === 'ar' ? managementSummaryBodyAr : managementSummaryBody}
              setManagementSummaryBody={emailLanguage === 'ar' ? setManagementSummaryBodyAr : setManagementSummaryBody}
              managementSummaryBrandColor={managementSummaryBrandColor}
              setManagementSummaryBrandColor={setManagementSummaryBrandColor}
              managementSummaryTextColor={managementSummaryTextColor}
              setManagementSummaryTextColor={setManagementSummaryTextColor}
              managementSummaryBgColor={managementSummaryBgColor}
              setManagementSummaryBgColor={setManagementSummaryBgColor}
              managementSummaryFontFamily={managementSummaryFontFamily}
              setManagementSummaryFontFamily={setManagementSummaryFontFamily}
              managementSummaryFontSize={managementSummaryFontSize}
              setManagementSummaryFontSize={setManagementSummaryFontSize}
              managementSummaryRequirementsTitle={emailLanguage === 'ar' ? managementSummaryRequirementsTitleAr : managementSummaryRequirementsTitle}
              setManagementSummaryRequirementsTitle={emailLanguage === 'ar' ? setManagementSummaryRequirementsTitleAr : setManagementSummaryRequirementsTitle}
              managementSummaryRequirementsBrandColor={managementSummaryRequirementsBrandColor}
              setManagementSummaryRequirementsBrandColor={setManagementSummaryRequirementsBrandColor}
              managementSummaryRequirementsTextColor={managementSummaryRequirementsTextColor}
              setManagementSummaryRequirementsTextColor={setManagementSummaryRequirementsTextColor}
              managementSummaryRequirementsBgColor={managementSummaryRequirementsBgColor}
              setManagementSummaryRequirementsBgColor={setManagementSummaryRequirementsBgColor}
              managementSummaryRequirementsFontFamily={managementSummaryRequirementsFontFamily}
              setManagementSummaryRequirementsFontFamily={setManagementSummaryRequirementsFontFamily}
              managementSummaryRequirementsFontSize={managementSummaryRequirementsFontSize}
              setManagementSummaryRequirementsFontSize={setManagementSummaryRequirementsFontSize}
              managementSummaryFooter={emailLanguage === 'ar' ? managementSummaryFooterAr : managementSummaryFooter}
              setManagementSummaryFooter={emailLanguage === 'ar' ? setManagementSummaryFooterAr : setManagementSummaryFooter}
              managementSummaryFooterBrandColor={managementSummaryFooterBrandColor}
              setManagementSummaryFooterBrandColor={setManagementSummaryFooterBrandColor}
              managementSummaryFooterTextColor={managementSummaryFooterTextColor}
              setManagementSummaryFooterTextColor={setManagementSummaryFooterTextColor}
              managementSummaryFooterBgColor={managementSummaryFooterBgColor}
              setManagementSummaryFooterBgColor={setManagementSummaryFooterBgColor}
              managementSummaryFooterFontFamily={managementSummaryFooterFontFamily}
              setManagementSummaryFooterFontFamily={setManagementSummaryFooterFontFamily}
              managementSummaryFooterFontSize={managementSummaryFooterFontSize}
              setManagementSummaryFooterFontSize={setManagementSummaryFooterFontSize}
              managementStylingOpen={managementStylingOpen}
              setManagementStylingOpen={setManagementStylingOpen}
              managementRequirementsStylingOpen={managementRequirementsStylingOpen}
              setManagementRequirementsStylingOpen={setManagementRequirementsStylingOpen}
              managementFooterStylingOpen={managementFooterStylingOpen}
              setManagementFooterStylingOpen={setManagementFooterStylingOpen}
              managementQuillRef={managementQuillRef}
              managementFooterQuillRef={managementFooterQuillRef}
              testEmailRecipient={testEmailRecipient}
              setTestEmailRecipient={setTestEmailRecipient}
              handleSaveManagementTemplate={handleSaveManagementTemplate}
              testEmailMutation={testEmailMutation}
              saveSettingsMutation={saveSettingsMutation}
              insertVariable={insertVariable}
              replaceVariables={replaceVariables}
              generatePreviewHtml={generatePreviewHtml}
              generateRequirementsPreviewHtml={generateRequirementsPreviewHtml}
              generateFooterPreviewHtml={generateFooterPreviewHtml}
              managementSummaryGreeting={managementSummaryGreeting}
              setManagementSummaryGreeting={setManagementSummaryGreeting}
              managementSummaryStakeholderTemplate={managementSummaryStakeholderTemplate}
              setManagementSummaryStakeholderTemplate={setManagementSummaryStakeholderTemplate}
              managementSummaryStakeholderSeparator={managementSummaryStakeholderSeparator}
              setManagementSummaryStakeholderSeparator={setManagementSummaryStakeholderSeparator}
              managementSummaryRequirementItemTemplate={managementSummaryRequirementItemTemplate}
              setManagementSummaryRequirementItemTemplate={setManagementSummaryRequirementItemTemplate}
            />
          </TabsContent>

          {/* Tab 5: Task Completion Email */}
          <TabsContent value="taskCompletion" className="space-y-6">
            <TaskCompletionTab
              emailLanguage={emailLanguage}
              taskCompletionSubject={emailLanguage === 'ar' ? taskCompletionSubjectAr : taskCompletionSubject}
              setTaskCompletionSubject={emailLanguage === 'ar' ? setTaskCompletionSubjectAr : setTaskCompletionSubject}
              taskCompletionBody={emailLanguage === 'ar' ? taskCompletionBodyAr : taskCompletionBody}
              setTaskCompletionBody={emailLanguage === 'ar' ? setTaskCompletionBodyAr : setTaskCompletionBody}
              taskCompletionBrandColor={taskCompletionBrandColor}
              setTaskCompletionBrandColor={setTaskCompletionBrandColor}
              taskCompletionTextColor={taskCompletionTextColor}
              setTaskCompletionTextColor={setTaskCompletionTextColor}
              taskCompletionBgColor={taskCompletionBgColor}
              setTaskCompletionBgColor={setTaskCompletionBgColor}
              taskCompletionFontFamily={taskCompletionFontFamily}
              setTaskCompletionFontFamily={setTaskCompletionFontFamily}
              taskCompletionFontSize={taskCompletionFontSize}
              setTaskCompletionFontSize={setTaskCompletionFontSize}
              taskCompletionFooter={emailLanguage === 'ar' ? taskCompletionFooterAr : taskCompletionFooter}
              setTaskCompletionFooter={emailLanguage === 'ar' ? setTaskCompletionFooterAr : setTaskCompletionFooter}
              taskCompletionFooterBrandColor={taskCompletionFooterBrandColor}
              setTaskCompletionFooterBrandColor={setTaskCompletionFooterBrandColor}
              taskCompletionFooterTextColor={taskCompletionFooterTextColor}
              setTaskCompletionFooterTextColor={setTaskCompletionFooterTextColor}
              taskCompletionFooterBgColor={taskCompletionFooterBgColor}
              setTaskCompletionFooterBgColor={setTaskCompletionFooterBgColor}
              taskCompletionFooterFontFamily={taskCompletionFooterFontFamily}
              setTaskCompletionFooterFontFamily={setTaskCompletionFooterFontFamily}
              taskCompletionFooterFontSize={taskCompletionFooterFontSize}
              setTaskCompletionFooterFontSize={setTaskCompletionFooterFontSize}
              taskCompletionStylingOpen={taskCompletionStylingOpen}
              setTaskCompletionStylingOpen={setTaskCompletionStylingOpen}
              taskCompletionFooterStylingOpen={taskCompletionFooterStylingOpen}
              setTaskCompletionFooterStylingOpen={setTaskCompletionFooterStylingOpen}
              taskCompletionQuillRef={taskCompletionQuillRef}
              taskCompletionFooterQuillRef={taskCompletionFooterQuillRef}
              handleSaveTaskCompletionTemplate={handleSaveTaskCompletionTemplate}
              saveSettingsMutation={saveSettingsMutation}
              FONT_FAMILIES={FONT_FAMILIES}
              FONT_SIZES={FONT_SIZES}
              insertVariable={insertVariable}
              replaceVariables={replaceVariables}
            />
          </TabsContent>

          {/* Tab 6: Updates Email Template */}
          <TabsContent value="updates" className="space-y-6">
            <UpdatesTab
              updatesEmailTemplate={updatesEmailTemplate}
              setUpdatesEmailTemplate={setUpdatesEmailTemplate}
              updatesEmailTemplateAr={updatesEmailTemplateAr}
              setUpdatesEmailTemplateAr={setUpdatesEmailTemplateAr}
              updatesBrandColor={updatesBrandColor}
              setUpdatesBrandColor={setUpdatesBrandColor}
              updatesTextColor={updatesTextColor}
              setUpdatesTextColor={setUpdatesTextColor}
              updatesBgColor={updatesBgColor}
              setUpdatesBgColor={setUpdatesBgColor}
              updatesFontFamily={updatesFontFamily}
              setUpdatesFontFamily={setUpdatesFontFamily}
              updatesFontSize={updatesFontSize}
              setUpdatesFontSize={setUpdatesFontSize}
              updatesStylingOpen={updatesStylingOpen}
              setUpdatesStylingOpen={setUpdatesStylingOpen}
              updatesQuillRef={updatesQuillRef}
              updatesQuillRefAr={updatesQuillRefAr}
              handleSaveUpdatesTemplate={handleSaveUpdatesTemplate}
              saveSettingsMutation={saveSettingsMutation}
              FONT_FAMILIES={FONT_FAMILIES}
              FONT_SIZES={FONT_SIZES}
              insertVariable={insertVariable}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
