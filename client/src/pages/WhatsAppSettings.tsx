import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, CheckCircle2, XCircle, Search, MessageSquare, Send, AlertCircle, Languages, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

type WhatsAppConnectionState = "idle" | "connecting" | "connected" | "logged-out";

type WhatsAppStatusResponse = {
  connected: boolean;
  state?: WhatsAppConnectionState;
  requiresPairing?: boolean;
  reconnecting?: boolean;
  qrCode?: string;
  phoneNumber?: string;
  lastConnected?: string;
  authenticated?: boolean;
};

type WhatsAppGroup = {
  id: string;
  name: string;
  participants: number;
};

// Connection state labels moved to translation files

export default function WhatsAppSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showChatBrowser, setShowChatBrowser] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  
  // Local state for template editing
  const [eventTemplateEn, setEventTemplateEn] = useState("");
  const [eventTemplateAr, setEventTemplateAr] = useState("");
  const [reminderTemplateEn, setReminderTemplateEn] = useState("");
  const [reminderTemplateAr, setReminderTemplateAr] = useState("");
  const [updatesTemplateEn, setUpdatesTemplateEn] = useState("");
  const [updatesTemplateAr, setUpdatesTemplateAr] = useState("");

  // Fetch settings (updated to include whatsapp templates and language)
  const { data: settings, isLoading: settingsLoading } = useQuery<{
    whatsappEnabled?: boolean;
    whatsappChatId?: string;
    whatsappChatName?: string;
    whatsappLanguage?: 'en' | 'ar';
    whatsappEventCreatedTemplateEn?: string;
    whatsappEventCreatedTemplateAr?: string;
    whatsappReminderTemplateEn?: string;
    whatsappReminderTemplateAr?: string;
    whatsappUpdatesTemplateEn?: string;
    whatsappUpdatesTemplateAr?: string;
  }>({
    queryKey: ["/api/settings/admin"],
  });

  // Fetch WhatsApp status (Baileys format: { connected, qrCode?, phoneNumber? })
  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery<WhatsAppStatusResponse>({
    queryKey: ["/api/whatsapp/status"],
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const connectionState = statusData?.state ?? (statusData?.connected ? "connected" : "idle");
  const isConnected = statusData?.connected ?? false;
  const isAuthenticated = statusData?.authenticated ?? isConnected;
  const requiresPairing = statusData?.requiresPairing ?? !isConnected;
  const hasQRCode = !isConnected && Boolean(statusData?.qrCode);
  const isReconnecting = statusData?.reconnecting ?? false;
  const lastConnectedDisplay = statusData?.lastConnected
    ? new Date(statusData.lastConnected).toLocaleString()
    : null;
  const getConnectionStateLabel = (state: WhatsAppConnectionState) => {
    const stateMap: Record<WhatsAppConnectionState, string> = {
      idle: t('whatsapp.stateIdle'),
      connecting: t('whatsapp.stateConnecting'),
      connected: t('whatsapp.stateConnected'),
      "logged-out": t('whatsapp.stateLoggedOut'),
    };
    return stateMap[state] ?? t('whatsapp.stateUnknown');
  };
  const connectionStateLabel = getConnectionStateLabel(connectionState as WhatsAppConnectionState);
  const qrCodeValue = statusData?.qrCode ?? '';

  // Fetch WhatsApp group list
  const {
    data: groupsResponse,
    isLoading: groupsLoading,
    refetch: refetchGroups,
  } = useQuery<{ groups: WhatsAppGroup[] }>({
    queryKey: ["/api/whatsapp/groups"],
    enabled: showChatBrowser && isConnected,
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/groups", { credentials: "include" });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to fetch groups");
      }
      return response.json();
    },
    staleTime: 60_000,
  });

  const groups = groupsResponse?.groups ?? [];
  const filteredGroups = useMemo(() => {
    if (!chatSearch.trim()) return groups;
    const term = chatSearch.trim().toLowerCase();
    return groups.filter((group) => group.name.toLowerCase().includes(term));
  }, [groups, chatSearch]);

  const hasShownConnectedToast = useRef(false);

  // Initialize local template state from settings
  useEffect(() => {
    if (settings) {
      setEventTemplateEn(settings.whatsappEventCreatedTemplateEn || '');
      setEventTemplateAr(settings.whatsappEventCreatedTemplateAr || '');
      setReminderTemplateEn(settings.whatsappReminderTemplateEn || '');
      setReminderTemplateAr(settings.whatsappReminderTemplateAr || '');
      setUpdatesTemplateEn(settings.whatsappUpdatesTemplateEn || '');
      setUpdatesTemplateAr(settings.whatsappUpdatesTemplateAr || '');
    }
  }, [settings]);

  useEffect(() => {
    if (showChatBrowser && isConnected) {
      refetchGroups();
    }
  }, [showChatBrowser, isConnected, refetchGroups]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PATCH", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/admin"] });
      toast({
        title: t('communications.settingsUpdated'),
        description: t('whatsapp.settingsSaved'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('communications.settingsUpdateError'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/whatsapp/logout");
    },
    onSuccess: () => {
      refetchStatus();
      toast({
        title: t('whatsapp.loggedOut'),
        description: t('whatsapp.credentialsCleared'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('whatsapp.logoutFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test notification mutation
  const testNotificationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/whatsapp/test");
    },
    onSuccess: () => {
      toast({
        title: t('whatsapp.testSent'),
        description: t('whatsapp.testNotificationSent'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('whatsapp.testFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleWhatsApp = (enabled: boolean) => {
    updateSettingsMutation.mutate({ whatsappEnabled: enabled });
  };

  const handleLogin = () => {
    // Status query will automatically show QR code when available
    refetchStatus();
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Updated to save both chatId AND chatName
  const handleSelectChat = (chatId: string, chatName: string) => {
    updateSettingsMutation.mutate({ 
      whatsappChatId: chatId,
      whatsappChatName: chatName
    });
    setShowChatBrowser(false);
    toast({
      title: t('whatsapp.chatSelected'),
      description: `${t('whatsapp.selected')}: ${chatName}`,
    });
  };

  const handleSendTest = () => {
    testNotificationMutation.mutate();
  };

  // Handler to save template changes
  const handleSaveTemplates = () => {
    updateSettingsMutation.mutate({
      whatsappEventCreatedTemplateEn: eventTemplateEn,
      whatsappEventCreatedTemplateAr: eventTemplateAr,
      whatsappReminderTemplateEn: reminderTemplateEn,
      whatsappReminderTemplateAr: reminderTemplateAr,
      whatsappUpdatesTemplateEn: updatesTemplateEn,
      whatsappUpdatesTemplateAr: updatesTemplateAr,
    });
  };

  // Check if templates have been modified
  const templatesModified = 
    eventTemplateEn !== (settings?.whatsappEventCreatedTemplateEn || '') ||
    eventTemplateAr !== (settings?.whatsappEventCreatedTemplateAr || '') ||
    reminderTemplateEn !== (settings?.whatsappReminderTemplateEn || '') ||
    reminderTemplateAr !== (settings?.whatsappReminderTemplateAr || '') ||
    updatesTemplateEn !== (settings?.whatsappUpdatesTemplateEn || '') ||
    updatesTemplateAr !== (settings?.whatsappUpdatesTemplateAr || '');

  // Show success toast when authentication succeeds
  useEffect(() => {
    if (!statusLoading && isAuthenticated) {
      if (!hasShownConnectedToast.current) {
        hasShownConnectedToast.current = true;
        toast({
          title: t('whatsapp.connected'),
          description: t('whatsapp.authenticationSuccess'),
        });
      }
    } else if (!isAuthenticated) {
      hasShownConnectedToast.current = false;
    }
  }, [isAuthenticated, statusLoading, toast, t]);

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" data-testid="loader-settings" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2" data-testid="heading-whatsapp">
          {t('whatsapp.configuration')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('whatsapp.configureWhatsAppIntegration')}
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="connection" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="connection">
            <MessageSquare className="h-4 w-4 mr-2" />
            {t('whatsapp.connectionManagement')}
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Languages className="h-4 w-4 mr-2" />
            {t('whatsapp.messageCustomization')}
          </TabsTrigger>
        </TabsList>

        {/* Connection Management Tab */}
        <TabsContent value="connection" className="space-y-6 mt-6">
          {/* Status Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {isConnected ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <strong>{t('whatsapp.connectedStatus')}</strong> {t('whatsapp.whatsappIsConnected')}
                  {statusData?.phoneNumber ? ` (${statusData.phoneNumber})` : null}
                </span>
              ) : isReconnecting ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <strong>{t('whatsapp.reconnectingStatus')}</strong> {t('whatsapp.waitingForSession')}
                </span>
              ) : hasQRCode ? (
                <span><strong>{t('whatsapp.actionRequired')}</strong> {t('whatsapp.scanQRBelow')}</span>
              ) : requiresPairing ? (
                <span><strong>{t('whatsapp.awaitingQR')}</strong> {t('whatsapp.keepPageOpen')}</span>
              ) : (
                <span><strong>{t('whatsapp.notConnectedStatus')}</strong> {t('whatsapp.clickShowQR')}</span>
              )}
            </AlertDescription>
          </Alert>

          {/* Connection Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isConnected ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
                {t('whatsapp.connectionStatus')}
              </CardTitle>
              <CardDescription>
                {t('whatsapp.connectToEnable')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium">{t('whatsapp.session')}</span>
                  <Badge variant={isConnected ? "default" : "secondary"}>
                    {statusLoading ? t('whatsapp.checking') : isConnected ? t('whatsapp.connected') : t('whatsapp.notConnected')}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium">{t('whatsapp.state')}</span>
                  <Badge variant="outline">{connectionStateLabel}</Badge>
                </div>

                {isReconnecting && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">{t('whatsapp.recovery')}</span>
                    <span className="text-sm text-muted-foreground">{t('whatsapp.attemptingReconnect')}</span>
                  </div>
                )}

                {lastConnectedDisplay && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">{t('whatsapp.lastConnected')}</span>
                    <span className="text-sm text-muted-foreground">{lastConnectedDisplay}</span>
                  </div>
                )}

                {statusData?.phoneNumber && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">{t('whatsapp.phoneNumber')}</span>
                    <span className="text-sm text-muted-foreground">{statusData.phoneNumber}</span>
                  </div>
                )}
              </div>

              {/* QR Code Display */}
              {hasQRCode && !isConnected && (
                <div className="space-y-3">
                  <div className="p-4 bg-white rounded-lg border-2 border-dashed flex flex-col items-center justify-center">
                    <QRCodeSVG 
                      value={qrCodeValue}
                      size={256}
                      level="M"
                      includeMargin={true}
                    />
                    <p className="text-sm text-muted-foreground mt-3 text-center">
                      {t('whatsapp.qrInstructions')}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {!isConnected && (!hasQRCode || statusLoading) && (
                  <Button 
                    onClick={handleLogin}
                    disabled={statusLoading}
                  >
                    {statusLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {t('whatsapp.showQRCode')}
                  </Button>
                )}
                
                {isConnected && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowChatBrowser(true)}
                      disabled={!isConnected}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      {t('whatsapp.selectGroup')}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleLogout}
                      disabled={logoutMutation.isPending}
                    >
                      {logoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {t('whatsapp.disconnect')}
                    </Button>
                  </>
                )}

                {!isConnected && hasQRCode && (
                  <Button variant="outline" onClick={handleLogin} disabled={statusLoading}>
                    {statusLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {t('whatsapp.refreshStatus')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected Group Card */}
          {(isConnected || settings?.whatsappChatName) && (
            <Card>
              <CardHeader>
                <CardTitle>{t('whatsapp.selectedGroup')}</CardTitle>
                <CardDescription>
                  {t('whatsapp.groupDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings?.whatsappChatName ? (
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{settings.whatsappChatName}</p>
                      <p className="text-sm text-muted-foreground">{t('whatsapp.activeNotificationGroup')}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowChatBrowser(true)}
                      disabled={!isConnected}
                    >
                      {t('whatsapp.change')}
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="mb-3">{t('whatsapp.noGroupSelected')}</p>
                    <Button onClick={() => setShowChatBrowser(true)} disabled={!isConnected}>
                      <Search className="h-4 w-4 mr-2" />
                      {t('whatsapp.browseGroups')}
                    </Button>
                  </div>
                )}

                {settings?.whatsappChatName && (
                  <Button
                    onClick={handleSendTest}
                    disabled={
                      testNotificationMutation.isPending ||
                      !isConnected
                    }
                    className="w-full"
                  >
                    {testNotificationMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {t('whatsapp.sendTestMessage')}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Enable/Disable WhatsApp */}
          <Card>
            <CardHeader>
              <CardTitle>{t('whatsapp.enableNotificationsTitle')}</CardTitle>
              <CardDescription>
                {t('whatsapp.toggleNotifications')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="whatsapp-enabled">{t('whatsapp.whatsappNotifications')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {settings?.whatsappEnabled ? t('whatsapp.notificationsActive') : t('whatsapp.notificationsDisabled')}
                  </p>
                </div>
                <Switch
                  id="whatsapp-enabled"
                  checked={settings?.whatsappEnabled || false}
                  onCheckedChange={handleToggleWhatsApp}
                  disabled={!isConnected || !settings?.whatsappChatName}
                  data-testid="switch-whatsapp-enabled"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Message Customization Tab */}
        <TabsContent value="templates" className="space-y-6 mt-6">{/* Message Templates */}
      <Card>
        <CardHeader>
          <CardTitle>{t('whatsapp.messageTemplates')}</CardTitle>
          <CardDescription>
            {t('whatsapp.messageTemplatesDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Language Selection */}
          <div className="space-y-2">
            <Label htmlFor="whatsapp-language">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4" />
                {t('whatsapp.messageLanguage')}
              </div>
            </Label>
            <Select
              value={settings?.whatsappLanguage || 'en'}
              onValueChange={(value) => updateSettingsMutation.mutate({ whatsappLanguage: value })}
            >
              <SelectTrigger id="whatsapp-language" data-testid="select-whatsapp-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية (Arabic)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('whatsapp.languageDescription')}
            </p>
          </div>

          {/* Template Tabs */}
          <div>
            <Label className="mb-3 block">{t('whatsapp.templates')}</Label>
            <Tabs defaultValue="event-en" className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <TabsTrigger value="event-en" data-testid="tab-event-en">{t('whatsapp.eventEn')}</TabsTrigger>
                <TabsTrigger value="event-ar" data-testid="tab-event-ar">{t('whatsapp.eventAr')}</TabsTrigger>
                <TabsTrigger value="reminder-en" data-testid="tab-reminder-en">{t('whatsapp.reminderEn')}</TabsTrigger>
                <TabsTrigger value="reminder-ar" data-testid="tab-reminder-ar">{t('whatsapp.reminderAr')}</TabsTrigger>
                <TabsTrigger value="updates-en" data-testid="tab-updates-en">{t('whatsapp.updatesEn')}</TabsTrigger>
                <TabsTrigger value="updates-ar" data-testid="tab-updates-ar">{t('whatsapp.updatesAr')}</TabsTrigger>
              </TabsList>

              <TabsContent value="event-en" className="space-y-3">
                <div>
                  <Textarea
                    value={eventTemplateEn}
                    onChange={(e) => setEventTemplateEn(e.target.value)}
                    placeholder="🎉 New Event Created!..."
                    rows={8}
                    className="font-mono text-sm"
                    data-testid="textarea-event-template-en"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('whatsapp.availableVariables')}: <code className="bg-muted px-1 py-0.5 rounded">{'{{eventName}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{location}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{startDate}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{endDate}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{description}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{stakeholders}}'}</code>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>{t('whatsapp.stakeholdersNote')}:</strong> {t('whatsapp.stakeholdersDescription')}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="event-ar" className="space-y-3">
                <div>
                  <Textarea
                    value={eventTemplateAr}
                    onChange={(e) => setEventTemplateAr(e.target.value)}
                    placeholder="🎉 تم إنشاء حدث جديد!..."
                    rows={8}
                    className="font-mono text-sm"
                    dir="rtl"
                    data-testid="textarea-event-template-ar"
                  />
                  <p className="text-xs text-muted-foreground mt-2" dir="ltr">
                    Available variables: <code className="bg-muted px-1 py-0.5 rounded">{'{{eventName}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{location}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{startDate}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{endDate}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{description}}'}</code>
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="reminder-en" className="space-y-3">
                <div>
                  <Textarea
                    value={reminderTemplateEn}
                    onChange={(e) => setReminderTemplateEn(e.target.value)}
                    placeholder="⏰ Event Reminder..."
                    rows={8}
                    className="font-mono text-sm"
                    data-testid="textarea-reminder-template-en"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('whatsapp.availableVariables')}: <code className="bg-muted px-1 py-0.5 rounded">{'{{eventName}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{location}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{startDate}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{endDate}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{description}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{stakeholders}}'}</code>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>{t('whatsapp.stakeholdersNote')}:</strong> {t('whatsapp.stakeholdersDescription')}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="reminder-ar" className="space-y-3">
                <div>
                  <Textarea
                    value={reminderTemplateAr}
                    onChange={(e) => setReminderTemplateAr(e.target.value)}
                    placeholder="⏰ تذكير بالحدث..."
                    rows={8}
                    className="font-mono text-sm"
                    dir="rtl"
                    data-testid="textarea-reminder-template-ar"
                  />
                  <p className="text-xs text-muted-foreground mt-2" dir="ltr">
                    {t('whatsapp.availableVariables')}: <code className="bg-muted px-1 py-0.5 rounded">{'{{eventName}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{location}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{startDate}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{endDate}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{description}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{stakeholders}}'}</code>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>{t('whatsapp.stakeholdersNote')}:</strong> {t('whatsapp.stakeholdersDescription')}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="updates-en" className="space-y-3">
                <div>
                  <Textarea
                    value={updatesTemplateEn}
                    onChange={(e) => setUpdatesTemplateEn(e.target.value)}
                    placeholder="📢 Weekly Updates | {{period_label}}\n\n*Department*\nUpdates go here"
                    rows={8}
                    className="font-mono text-sm"
                    data-testid="textarea-updates-template-en"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('whatsapp.availableVariables')}: <code className="bg-muted px-1 py-0.5 rounded">{'{{header}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{heading}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{period_label}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{updates}}'}</code>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('whatsapp.updatesTemplateHelper')}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="updates-ar" className="space-y-3">
                <div>
                  <Textarea
                    value={updatesTemplateAr}
                    onChange={(e) => setUpdatesTemplateAr(e.target.value)}
                    placeholder="📢 المستجدات | {{period_label}}\n\n*الإدارة*\nالتحديثات هنا"
                    rows={8}
                    className="font-mono text-sm"
                    dir="rtl"
                    data-testid="textarea-updates-template-ar"
                  />
                  <p className="text-xs text-muted-foreground mt-2" dir="ltr">
                    {t('whatsapp.availableVariables')}: <code className="bg-muted px-1 py-0.5 rounded">{'{{header}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{heading}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{period_label}}'}</code>,{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">{'{{updates}}'}</code>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('whatsapp.updatesTemplateHelper')}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
            
            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSaveTemplates}
                disabled={!templatesModified || updateSettingsMutation.isPending}
                data-testid="button-save-templates"
              >
                {updateSettingsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save') || 'Save Templates'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('whatsapp.howItWorks')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            {t('whatsapp.howItWorksDescription')}
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>{t('whatsapp.step1Description')}</li>
            <li>{t('whatsapp.step2Description')}</li>
            <li>{t('whatsapp.step3Description')}</li>
          </ol>
          <p className="pt-2">
            <strong>{t('whatsapp.note')}:</strong> {t('whatsapp.stepsInOrder')}
          </p>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      {/* Chat Browser Dialog */}
      <Dialog open={showChatBrowser} onOpenChange={setShowChatBrowser}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('whatsapp.browseChatsDialog')}</DialogTitle>
            <DialogDescription>
              {t('whatsapp.selectChatToSend')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('whatsapp.searchChatsPlaceholder')}
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                className="pl-9"
                data-testid="input-chat-search"
              />
            </div>

            {/* Chat List */}
            <div className="border rounded-lg max-h-[400px] overflow-y-auto">
              {groupsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredGroups.length > 0 ? (
                <div className="divide-y">
                  {filteredGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => handleSelectChat(group.id, group.name)}
                      className="w-full text-left px-4 py-3 hover-elevate active-elevate-2 transition-colors"
                      data-testid={`button-select-chat-${group.id}`}
                    >
                      <div className="font-medium">{group.name}</div>
                      <div className="text-sm text-muted-foreground space-x-2">
                        <span>{group.id}</span>
                        <span aria-hidden="true">•</span>
                        <span>{group.participants} {t('whatsapp.members')}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {chatSearch ? t('whatsapp.noChatsFound') : t('whatsapp.noChatsAvailable')}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
