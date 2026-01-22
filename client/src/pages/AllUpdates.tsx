import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, startOfWeek, startOfMonth, subWeeks, subMonths, addWeeks, addMonths, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Send, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { parseSendUpdatesResult } from '@/lib/sendUpdates';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type UpdateWithDepartment = {
  id: number;
  type: 'weekly' | 'monthly';
  periodStart: string;
  content: string;
  departmentId: number | null;
  departmentName?: string | null;
  departmentNameAr?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export default function AllUpdates() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isArabic = i18n.language === 'ar';

  const TEMPLATE_VARIABLES = [
    { key: '{{updates}}', description: t('updates.variables.updates') },
    { key: '{{period_label}}', description: t('updates.variables.period') },
  ];

  // Only superadmins should access this page
  const isSuperAdmin = user?.role === 'superadmin';

  // Calculate period start based on type
  const periodStart = useMemo(() => {
    if (activeTab === 'weekly') {
      return format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    } else {
      return format(startOfMonth(currentDate), 'yyyy-MM-dd');
    }
  }, [activeTab, currentDate]);

  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [sendType, setSendType] = useState<'weekly' | 'monthly'>(activeTab);
  const [sendPeriodStart, setSendPeriodStart] = useState(periodStart);
  const [sendLanguage, setSendLanguage] = useState<'en' | 'ar'>(isArabic ? 'ar' : 'en');
  const [customEmailTemplate, setCustomEmailTemplate] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [selectedWhatsappGroupId, setSelectedWhatsappGroupId] = useState('');
  const [selectedWhatsappGroupName, setSelectedWhatsappGroupName] = useState('');

  // Fetch all updates for the period with department info
  const { data: periodUpdates = [], isLoading, error } = useQuery<UpdateWithDepartment[]>({
    queryKey: ['/api/updates/all-departments', activeTab, periodStart],
    queryFn: async () => {
      const result = await apiRequest<UpdateWithDepartment[]>(
        'GET',
        `/api/updates/all-departments/${activeTab}/${periodStart}`
      );
      return result;
    },
    enabled: isSuperAdmin,
  });

  const {
    data: whatsappGroupsData,
    isLoading: isLoadingWhatsappGroups,
    error: whatsappGroupsError,
  } = useQuery<{ groups: Array<{ id: string; name: string; participants: number }> }>({
    queryKey: ['/api/whatsapp/groups'],
    queryFn: async () => {
      const result = await apiRequest<{ groups: Array<{ id: string; name: string; participants: number }> }>(
        'GET',
        '/api/whatsapp/groups'
      );
      return result;
    },
    enabled: isSuperAdmin && isSendDialogOpen,
  });

  // Fetch settings for email templates
  const { data: settings } = useQuery<{
    updatesEmailTemplate?: string;
    updatesEmailTemplateAr?: string;
  }>({
    queryKey: ['/api/settings/admin'],
    queryFn: async () => {
      const result = await apiRequest<any>('GET', '/api/settings/admin');
      return result;
    },
    enabled: isSuperAdmin && isSendDialogOpen,
  });

  const selectedTemplateFromSettings = sendLanguage === 'ar'
    ? settings?.updatesEmailTemplateAr
    : settings?.updatesEmailTemplate;

  useEffect(() => {
    setSendType(activeTab);
    setSendPeriodStart(periodStart);
    setSendLanguage(isArabic ? 'ar' : 'en');
  }, [activeTab, periodStart, isArabic]);

  useEffect(() => {
    if (isSendDialogOpen && !targetEmail && user?.email) {
      setTargetEmail(user.email);
    }
  }, [isSendDialogOpen, targetEmail, user]);

  const whatsappGroups = whatsappGroupsData?.groups || [];

  const sendUpdatesMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {
        type: sendType,
        periodStart: sendPeriodStart,
        email: targetEmail.trim(),
        language: sendLanguage,
      };

      if (selectedWhatsappGroupId) {
        payload.whatsappGroupId = selectedWhatsappGroupId;
        payload.whatsappGroupName = selectedWhatsappGroupName;
      }

      if (customEmailTemplate.trim()) {
        payload.templateHtml = customEmailTemplate.trim();
      }

      return apiRequest<any>('POST', '/api/updates/send', payload);
    },
    onSuccess: (result: any) => {
      const outcome = parseSendUpdatesResult(result, sendPeriodStart);

      if (outcome.success) {
        const baseDescription = t('updates.sendSuccess', { period: outcome.periodLabel });
        const description = outcome.channelIssues.length > 0
          ? `${baseDescription} (${outcome.channelIssues.join(' | ')})`
          : baseDescription;

        toast({
          title: t('common.success'),
          description,
        });
        setIsSendDialogOpen(false);
      } else {
        toast({
          title: t('common.error'),
          description: result?.whatsapp?.message || result?.email?.message || t('updates.sendError'),
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error?.message || t('updates.sendError'),
        variant: 'destructive',
      });
    },
  });

  const handleOpenSendDialog = () => {
    setIsSendDialogOpen(true);
    setSelectedWhatsappGroupId('');
    setSelectedWhatsappGroupName('');
  };

  const handleWhatsappGroupChange = (value: string) => {
    if (!value || value === '__none__') {
      setSelectedWhatsappGroupId('');
      setSelectedWhatsappGroupName('');
      return;
    }

    setSelectedWhatsappGroupId(value);
    const selected = whatsappGroups.find((group) => group.id === value);
    setSelectedWhatsappGroupName(selected?.name || '');
  };

  const formatPeriodLabel = () => {
    const locale = isArabic ? ar : undefined;
    if (activeTab === 'weekly') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      const pattern = isArabic ? 'd MMM yyyy' : 'MMM d, yyyy';
      return `${format(weekStart, pattern, { locale })} - ${format(weekEnd, pattern, { locale })}`;
    } else {
      return format(currentDate, 'MMMM yyyy', { locale });
    }
  };

  const isCurrentPeriod = () => {
    const now = new Date();
    const currentPeriodDate = activeTab === 'weekly'
      ? startOfWeek(now, { weekStartsOn: 1 })
      : startOfMonth(now);
    const selectedPeriodDate = activeTab === 'weekly'
      ? startOfWeek(currentDate, { weekStartsOn: 1 })
      : startOfMonth(currentDate);
    return format(currentPeriodDate, 'yyyy-MM-dd') === format(selectedPeriodDate, 'yyyy-MM-dd');
  };

  const handlePrevious = () => {
    setCurrentDate(activeTab === 'weekly' ? subWeeks(currentDate, 1) : subMonths(currentDate, 1));
  };

  const handleNext = () => {
    const now = new Date();
    const currentPeriodStartDate = activeTab === 'weekly'
      ? startOfWeek(now, { weekStartsOn: 1 })
      : startOfMonth(now);

    const nextDate = activeTab === 'weekly'
      ? addWeeks(currentDate, 1)
      : addMonths(currentDate, 1);

    const nextPeriodStartDate = activeTab === 'weekly'
      ? startOfWeek(nextDate, { weekStartsOn: 1 })
      : startOfMonth(nextDate);

    if (nextPeriodStartDate.getTime() > currentPeriodStartDate.getTime()) {
      toast({
        title: t('updates.cannotNavigateToFuture'),
        description: t('updates.cannotNavigateToFutureDesc'),
        variant: 'destructive',
      });
      return;
    }

    setCurrentDate(nextDate);
  };

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      ['link'],
      ['clean'],
    ],
  };

  const quillFormats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'bullet',
    'align',
    'link',
  ];

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">{t('common.unauthorized')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Group updates by department
  const departmentUpdates = periodUpdates.filter(u => u.departmentId !== null);
  const globalUpdate = periodUpdates.find(u => u.departmentId === null);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader
          title={t('updates.allUpdatesTitle')}
          subtitle={t('updates.allUpdatesSubtitle')}
          icon={FileText}
          iconColor="text-primary"
        >
          <Button onClick={handleOpenSendDialog} className="gap-2" variant="outline">
            <Send className="h-4 w-4" />
            {t('updates.sendUpdates')}
          </Button>
        </PageHeader>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'weekly' | 'monthly')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="weekly">{t('updates.weeklyUpdates')}</TabsTrigger>
          <TabsTrigger value="monthly">{t('updates.monthlyUpdates')}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-6 mt-6">
          {/* Period Navigation */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{formatPeriodLabel()}</CardTitle>
                  <CardDescription>
                    {isCurrentPeriod() ? t('updates.currentPeriod') : t('updates.historicalPeriod')}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={handlePrevious}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleNext}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Display all updates by department */}
          <div className="space-y-4">
            {isLoading ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">{t('common.loading')}</p>
                </CardContent>
              </Card>
            ) : periodUpdates.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">{t('updates.noUpdatesForPeriod')}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {departmentUpdates.map((update) => (
                  <Card key={update.id}>
                    <CardHeader>
                      <CardTitle>
                        {isArabic
                          ? update.departmentNameAr || update.departmentName || `Department #${update.departmentId}`
                          : update.departmentName || `Department #${update.departmentId}`}
                      </CardTitle>
                      <CardDescription>
                        {t('updates.lastUpdated')}: {format(new Date(update.updatedAt), 'PPp')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div
                        className="prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: update.content || `<p class="text-muted-foreground">${t('updates.noContent')}</p>` }}
                      />
                    </CardContent>
                  </Card>
                ))}
                
                {globalUpdate && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('updates.generalUpdate')}</CardTitle>
                      <CardDescription>
                        {t('updates.lastUpdated')}: {format(new Date(globalUpdate.updatedAt), 'PPp')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div
                        className="prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: globalUpdate.content || `<p class="text-muted-foreground">${t('updates.noContent')}</p>` }}
                      />
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Send Dialog */}
      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('updates.sendUpdates')}</DialogTitle>
            <DialogDescription>
              {t('updates.sendAllDepartmentsDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t('updates.fields.type')}</Label>
              <Select value={sendType} onValueChange={(value) => setSendType(value as 'weekly' | 'monthly')}>
                <SelectTrigger>
                  <SelectValue placeholder={t('updates.fields.type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{t('updates.weeklyUpdates')}</SelectItem>
                  <SelectItem value="monthly">{t('updates.monthlyUpdates')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>{t('updates.fields.period')}</Label>
              <Input
                type="date"
                value={sendPeriodStart}
                onChange={(e) => setSendPeriodStart(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('updates.periodHelper')}</p>
            </div>

            <div className="grid gap-2">
              <Label>{t('updates.fields.language')}</Label>
              <Select value={sendLanguage} onValueChange={(value) => setSendLanguage(value as 'en' | 'ar')}>
                <SelectTrigger>
                  <SelectValue placeholder={t('updates.fields.language')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{t('updates.languages.en')}</SelectItem>
                  <SelectItem value="ar">{t('updates.languages.ar')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-2">
                <Label>{t('updates.fields.template')}</Label>
                <p className="text-xs text-muted-foreground text-right max-w-[420px]">
                  {t('updates.overrideHelper')}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {TEMPLATE_VARIABLES.map((variable) => (
                  <div key={variable.key} className="inline-flex items-center gap-2 rounded-md border px-2 py-1 bg-muted/60">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {variable.key}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{variable.description}</span>
                  </div>
                ))}
              </div>

              {selectedTemplateFromSettings && (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">{t('updates.savedTemplatePreview')}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCustomEmailTemplate(selectedTemplateFromSettings)}
                    >
                      {t('updates.loadSavedTemplate')}
                    </Button>
                  </div>
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: selectedTemplateFromSettings }}
                  />
                </div>
              )}

              <Textarea
                value={customEmailTemplate}
                onChange={(event) => setCustomEmailTemplate(event.target.value)}
                placeholder={t('updates.placeholders.template')}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">{t('updates.templateHelper')}</p>
            </div>

            <div className="grid gap-2">
              <Label>{t('updates.fields.email')}</Label>
              <Input
                type="email"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder={t('updates.placeholders.email')}
              />
            </div>

            <div className="grid gap-2">
              <Label>{t('updates.fields.whatsappGroup')}</Label>
              <Select value={selectedWhatsappGroupId || '__none__'} onValueChange={handleWhatsappGroupChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('updates.placeholders.whatsappGroup')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('updates.noWhatsappGroup')}</SelectItem>
                  {whatsappGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.participants} {t('updates.participants')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('updates.whatsappTemplateNote')}</p>
              {isLoadingWhatsappGroups && (
                <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
              )}
              {whatsappGroupsError && (
                <p className="text-xs text-destructive">{t('updates.whatsappGroupsError')}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => sendUpdatesMutation.mutate()} disabled={sendUpdatesMutation.isPending}>
              {sendUpdatesMutation.isPending ? t('common.loading') : t('updates.send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
