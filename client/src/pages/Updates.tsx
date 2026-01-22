import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, startOfWeek, startOfMonth, subWeeks, subMonths, addWeeks, addMonths, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Save, Copy, Send, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { parseSendUpdatesResult } from '@/lib/sendUpdates';
import type { Update } from '@shared/schema';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function Updates() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isArabic = i18n.language === 'ar';
  const isDepartmentUser = user?.role === 'department' || user?.role === 'department_admin';
  const isDepartmentAdmin = user?.role === 'department_admin';

  // Calculate period start based on type
  const periodStart = useMemo(() => {
    if (activeTab === 'weekly') {
      // ISO week starts on Monday
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
  const [isPrimarySendDialogOpen, setIsPrimarySendDialogOpen] = useState(false);
  const [primaryEmailLanguage, setPrimaryEmailLanguage] = useState<'en' | 'ar'>(isArabic ? 'ar' : 'en');

  // Fetch current update
  const { data: currentUpdate, isLoading } = useQuery<Update | null>({
    queryKey: ['/api/updates', activeTab, periodStart],
    queryFn: async () => {
      try {
        const result = await apiRequest<Update>('GET', `/api/updates/${activeTab}/${periodStart}`);
        return result;
      } catch (error: any) {
        // Return null for 404 (no update exists yet for this period)
        if (error?.message?.includes('404') || error?.status === 404) {
          return null;
        }
        throw error;
      }
    },
  });

  // Fetch all updates for history
  const { data: allUpdates = [] } = useQuery<Update[]>({
    queryKey: ['/api/updates', activeTab],
    queryFn: async () => {
      const result = await apiRequest<Update[]>('GET', `/api/updates?type=${activeTab}`);
      return result;
    },
  });

  const {
    data: whatsappGroupsData,
    isLoading: isLoadingWhatsappGroups,
    error: whatsappGroupsError,
  } = useQuery<{ groups: Array<{ id: string; name: string; participants: number }> }>({
    queryKey: ['/api/whatsapp/groups'],
    queryFn: async () => {
      const result = await apiRequest<{ groups: Array<{ id: string; name: string; participants: number }> }>('GET', '/api/whatsapp/groups');
      return result;
    },
    enabled: !isDepartmentUser && isSendDialogOpen,
  });

  const [content, setContent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Update content when data changes, but preserve unsaved edits
  useEffect(() => {
    if (!hasUnsavedChanges) {
      setContent(currentUpdate?.content || '');
    }
  }, [currentUpdate, hasUnsavedChanges]);

  useEffect(() => {
    setSendType(activeTab);
    setSendPeriodStart(periodStart);
    setSendLanguage(isArabic ? 'ar' : 'en');
  }, [activeTab, periodStart]);

  useEffect(() => {
    if (isSendDialogOpen && !targetEmail && user?.email) {
      setTargetEmail(user.email);
    }
  }, [isSendDialogOpen, targetEmail, user]);

  // Helper to normalize HTML for comparison
  const normalizeHTML = (html: string): string => {
    // Remove common empty content patterns from Quill
    const emptyPatterns = ['<p><br></p>', '<p></p>', '<br>', ''];
    const trimmed = html.trim();
    if (emptyPatterns.includes(trimmed)) {
      return '';
    }
    // Normalize whitespace between tags and trim
    return trimmed.replace(/>\s+</g, '><').replace(/\s+/g, ' ');
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    const normalizedValue = normalizeHTML(value);
    const normalizedCurrent = normalizeHTML(currentUpdate?.content || '');
    setHasUnsavedChanges(normalizedValue !== normalizedCurrent);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { type: string; periodStart: string; content: string }) => {
      const result = await apiRequest<Update>('POST', '/api/updates', data);
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/updates'] });
      setHasUnsavedChanges(false);
      toast({
        title: t('common.success'),
        description: t('updates.updateSaved'),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('updates.updateSaveError'),
        variant: 'destructive',
      });
    },
  });

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

  const handleSave = () => {
    saveMutation.mutate({
      type: activeTab,
      periodStart,
      content,
    });
  };

  const handleOpenSendDialog = () => {
    setIsSendDialogOpen(true);
    setSelectedWhatsappGroupId('');
    setSelectedWhatsappGroupName('');
  };

  const handleWhatsappGroupChange = (value: string) => {
    if (!value) {
      setSelectedWhatsappGroupId('');
      setSelectedWhatsappGroupName('');
      return;
    }

    setSelectedWhatsappGroupId(value);
    const selected = whatsappGroups.find((group) => group.id === value);
    setSelectedWhatsappGroupName(selected?.name || '');
  };

  const sendPrimaryEmailMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<{ message: string }>('POST', `/api/updates/${activeTab}/${periodStart}/send-primary`, {
        language: primaryEmailLanguage,
      });
    },
    onSuccess: () => {
      toast({
        title: t('common.success'),
        description: t('updates.sentToPrimaryEmail'),
      });
      setIsPrimarySendDialogOpen(false);
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('updates.sendToPrimaryEmailError'),
        variant: 'destructive',
      });
    },
  });

  const handleSendToPrimaryEmail = () => {
    if (!currentUpdate) {
      toast({
        title: t('updates.sendToPrimaryEmailError'),
        description: t('updates.noContent'),
        variant: 'destructive',
      });
      return;
    }

    setIsPrimarySendDialogOpen(true);
  };

  const handlePrevious = () => {
    if (hasUnsavedChanges) {
      toast({
        title: t('updates.unsavedChanges'),
        description: t('updates.unsavedChangesDesc'),
        variant: 'destructive',
      });
      return;
    }
    
    if (activeTab === 'weekly') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (hasUnsavedChanges) {
      toast({
        title: t('updates.unsavedChanges'),
        description: t('updates.unsavedChangesDesc'),
        variant: 'destructive',
      });
      return;
    }
    
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
    
    // Prevent navigation to future periods using Date comparison
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

  const handleGoToLatest = () => {
    if (hasUnsavedChanges) {
      toast({
        title: t('updates.unsavedChanges'),
        description: t('updates.unsavedChangesDesc'),
        variant: 'destructive',
      });
      return;
    }
    setCurrentDate(new Date());
  };

  const formatPeriodLabel = () => {
    const locale = isArabic ? ar : undefined;
    if (activeTab === 'weekly') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      const dateFormat = isArabic ? 'MMM d yyyy' : 'MMM d, yyyy';
      const formattedStart = format(weekStart, dateFormat, { locale });
      const formattedEnd = format(weekEnd, dateFormat, { locale });
      return `${t('updates.weekOf')} ${formattedStart} - ${formattedEnd}`;
    } else {
      return format(currentDate, 'MMMM yyyy', { locale });
    }
  };

  const isCurrentPeriod = () => {
    const now = new Date();
    const nowPeriodStart = activeTab === 'weekly'
      ? format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : format(startOfMonth(now), 'yyyy-MM-dd');
    return periodStart === nowPeriodStart;
  };

  // Quill editor configuration
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['clean']
    ],
  };

  const quillFormats = [
    'header',
    'bold', 'italic', 'underline',
    'list', 'bullet'
  ];

  return (
    <div className="min-h-screen bg-background p-6" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader
          title={t('updates.title')}
          subtitle={isDepartmentUser ? t('updates.departmentSubtitle') : t('updates.subtitle')}
          icon={FileText}
          iconColor="text-primary"
        >
          {!isDepartmentUser && (
            <Button onClick={handleOpenSendDialog} className="gap-2" variant="outline">
              <Send className="h-4 w-4" />
              {t('updates.sendUpdates')}
            </Button>
          )}
        </PageHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'weekly' | 'monthly')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="weekly" data-testid="tab-weekly">
              {t('updates.weeklyUpdates')}
            </TabsTrigger>
            <TabsTrigger value="monthly" data-testid="tab-monthly">
              {t('updates.monthlyUpdates')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-6 mt-6">
            {/* Period Navigation */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{formatPeriodLabel()}</CardTitle>
                    <CardDescription>
                      {isDepartmentUser && t('updates.departmentSpecific')}
                      {isDepartmentUser && ' • '}
                      {isCurrentPeriod() ? t('updates.currentPeriod') : t('updates.historicalPeriod')}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handlePrevious}
                      data-testid="button-previous-period"
                      className="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {!isCurrentPeriod() && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGoToLatest}
                        data-testid="button-go-to-latest"
                        className="min-h-11 md:min-h-8"
                      >
                        {t('updates.goToLatest')}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleNext}
                      data-testid="button-next-period"
                      className="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('updates.content')}</label>
                  <div 
                    className="border rounded-md" 
                    data-testid="editor-update-content"
                    dir={isArabic ? 'rtl' : 'ltr'}
                  >
                    <ReactQuill
                      theme="snow"
                      value={content}
                      onChange={(value) => handleContentChange(value)}
                      placeholder={t('updates.enterContent')}
                      modules={quillModules}
                      formats={quillFormats}
                      className="min-h-[400px]"
                      readOnly={isLoading}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {isDepartmentAdmin && (
                    <Button
                      variant="outline"
                      onClick={handleSendToPrimaryEmail}
                      disabled={sendPrimaryEmailMutation.isPending || isLoading}
                      data-testid="button-send-primary-email"
                    >
                      {sendPrimaryEmailMutation.isPending ? t('common.loading') : t('updates.sendToPrimaryEmail')}
                    </Button>
                  )}
                  <Button
                    onClick={handleSave}
                    disabled={saveMutation.isPending || isLoading}
                    data-testid="button-save-update"
                  >
                    {saveMutation.isPending ? (
                      t('common.saving')
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {t('updates.saveUpdate')}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* History */}
            {allUpdates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('updates.recentUpdates')}</CardTitle>
                  <CardDescription>
                    {t('updates.last5', { type: activeTab })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {allUpdates
                      .sort((a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime())
                      .slice(0, 5)
                      .map((update) => {
                      return (
                        <div
                          key={update.id}
                          className="border-l-2 border-muted pl-4 py-2"
                          data-testid={`history-item-${update.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">
                              {activeTab === 'weekly'
                                ? `Week of ${format(new Date(update.periodStart), 'MMM d, yyyy')}`
                                : format(new Date(update.periodStart), 'MMMM yyyy')}
                            </h4>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  navigator.clipboard.writeText(update.content || '');
                                  toast({
                                    title: t('common.copied'),
                                    description: t('updates.copiedToClipboard'),
                                  });
                                }}
                                data-testid={`button-copy-${update.id}`}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <span className="text-sm text-muted-foreground">
                                {update.updatedAt && `${t('updates.updated')} ${format(new Date(update.updatedAt), 'MMM d, yyyy')}`}
                              </span>
                            </div>
                          </div>
                          <div 
                            className="text-sm text-muted-foreground prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: update.content || `<p class="text-muted-foreground">${t('updates.noContent')}</p>` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{t('updates.sendUpdates')}</DialogTitle>
              <DialogDescription>
                {t('updates.sendUpdatesDescription')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>{t('updates.fields.type')}</Label>
                <Select
                  value={sendType}
                  onValueChange={(value) => {
                    setSendType(value as 'weekly' | 'monthly');
                    const baseDate = value === 'weekly'
                      ? startOfWeek(currentDate, { weekStartsOn: 1 })
                      : startOfMonth(currentDate);
                    setSendPeriodStart(format(baseDate, 'yyyy-MM-dd'));
                  }}
                >
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
                <Label>{t('updates.fields.periodStart')}</Label>
                <Input
                  type="date"
                  value={sendPeriodStart}
                  onChange={(event) => setSendPeriodStart(event.target.value)}
                  data-testid="input-send-period-start"
                />
                <p className="text-xs text-muted-foreground">{t('updates.periodHelper')}</p>
              </div>

              <div className="grid gap-2">
                <Label>{t('updates.fields.language')}</Label>
                <Select
                  value={sendLanguage}
                  onValueChange={(value) => setSendLanguage(value as 'en' | 'ar')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('updates.fields.language')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{t('updates.languages.en')}</SelectItem>
                    <SelectItem value="ar">{t('updates.languages.ar')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>{t('updates.fields.template')}</Label>
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
                  onChange={(event) => setTargetEmail(event.target.value)}
                  placeholder={t('updates.placeholders.targetEmail')}
                  data-testid="input-target-email"
                />
              </div>

              <div className="grid gap-2">
                <Label>{t('updates.fields.whatsappGroup')}</Label>
                <Select
                  value={selectedWhatsappGroupId || "__default__"}
                  onValueChange={(v) => handleWhatsappGroupChange(v === "__default__" ? "" : v)}
                  disabled={isLoadingWhatsappGroups || !!whatsappGroupsError}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('updates.useDefaultWhatsappGroup')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">{t('updates.useDefaultWhatsappGroup')}</SelectItem>
                    {whatsappGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {whatsappGroupsError && (
                  <p className="text-xs text-destructive">{t('updates.whatsappGroupLoadError')}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSendDialogOpen(false)} disabled={sendUpdatesMutation.isPending}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => sendUpdatesMutation.mutate()}
                disabled={sendUpdatesMutation.isPending || !targetEmail.trim()}
              >
                {sendUpdatesMutation.isPending ? t('updates.sending') : t('updates.sendAction')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Primary Email Send Dialog for Department Admins */}
        <Dialog open={isPrimarySendDialogOpen} onOpenChange={setIsPrimarySendDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('updates.sendToPrimaryEmail')}</DialogTitle>
              <DialogDescription>{t('updates.primaryEmailDescription')}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{t('updates.fields.language')}</Label>
                <Select
                  value={primaryEmailLanguage}
                  onValueChange={(value) => setPrimaryEmailLanguage(value as 'en' | 'ar')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('updates.fields.language')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{t('updates.languages.en')}</SelectItem>
                    <SelectItem value="ar">{t('updates.languages.ar')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('updates.departmentLanguageHelper')}</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPrimarySendDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => sendPrimaryEmailMutation.mutate()} disabled={sendPrimaryEmailMutation.isPending}>
                {sendPrimaryEmailMutation.isPending ? t('common.loading') : t('updates.send')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
