/**
 * Elasticsearch Admin Page
 * 
 * Admin interface for Elasticsearch management including index control,
 * sync operations, and health monitoring.
 * 
 * Superadmin only access.
 * 
 * @module pages/admin/ElasticsearchAdmin
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  IndexList, 
  SyncControls, 
  ESHealthStatus,
  SyncHistory,
  DataQualityReport 
} from '@/components/admin';
import { PageHeader } from '@/components/PageHeader';
import { apiRequest } from '@/lib/queryClient';
import {
  Database, 
  RefreshCw, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  Settings,
  Search,
  BarChart3
} from 'lucide-react';
import type { ESHealthResponse, IndexStats, ESAdminStatus } from '@/types/elasticsearch';

/**
 * Elasticsearch Admin Page Component
 */
export default function ElasticsearchAdminPage() {
  const { t } = useTranslation('admin');
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch ES health
  const { 
    data: health, 
    isLoading: healthLoading,
    error: healthError 
  } = useQuery<ESHealthResponse>({
    queryKey: ['admin', 'elasticsearch', 'health'],
    queryFn: () => apiRequest('GET', '/api/health/elasticsearch/detailed'),
    refetchInterval: 30000, // Refresh every 30s
    retry: 1,
  });

  // Fetch index stats
  const { 
    data: indices, 
    isLoading: indicesLoading 
  } = useQuery<IndexStats[]>({
    queryKey: ['admin', 'elasticsearch', 'indices'],
    queryFn: () => apiRequest('GET', '/api/admin/elasticsearch/indices'),
    refetchInterval: 60000,
    retry: 1,
  });

  // Fetch sync status
  const { data: adminStatus } = useQuery<ESAdminStatus>({
    queryKey: ['admin', 'elasticsearch', 'sync-status'],
    queryFn: () => apiRequest('GET', '/api/admin/elasticsearch/sync-status'),
    refetchInterval: 5000, // More frequent when sync might be running
    retry: 1,
  });

  const syncStatus = adminStatus?.sync;

  /**
   * Get health badge based on status
   */
  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'green':
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle className="w-3 h-3 mr-1" /> 
            {t('elasticsearch.healthy', 'Healthy')}
          </Badge>
        );
      case 'yellow':
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600">
            <AlertTriangle className="w-3 h-3 mr-1" /> 
            {t('elasticsearch.warning', 'Warning')}
          </Badge>
        );
      case 'red':
        return (
          <Badge className="bg-red-500 hover:bg-red-600">
            <XCircle className="w-3 h-3 mr-1" /> 
            {t('elasticsearch.critical', 'Critical')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {t('elasticsearch.unavailable', 'Unavailable')}
          </Badge>
        );
    }
  };

  /**
   * Get Kibana URL based on environment
   */
  const getKibanaUrl = () => {
    // Check if we're in production
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      return 'https://kibana.eventcal.app';
    }
    return 'http://localhost:5601';
  };

  // Loading state
  if (healthLoading && indicesLoading) {
    return <ElasticsearchAdminSkeleton />;
  }

  return (
    <div className="container mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title={t('elasticsearch.title', 'Elasticsearch Admin')}
          subtitle={t('elasticsearch.description', 'Manage search infrastructure, indices, and synchronization')}
        />
        <div className="flex items-center gap-2">
          {getHealthBadge(health?.status || 'unavailable')}
          <Button variant="outline" size="sm" asChild>
            <a 
              href={getKibanaUrl()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              {t('elasticsearch.openKibana', 'Open Kibana')}
            </a>
          </Button>
        </div>
      </div>

      {/* Health Alert */}
      {health?.status === 'red' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t(
              'elasticsearch.criticalAlert',
              'Elasticsearch cluster is in critical state. Some search features may be unavailable.'
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Connection Error */}
      {healthError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {t(
              'elasticsearch.connectionError',
              'Unable to connect to Elasticsearch. Please check that the service is running.'
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Sync Progress */}
      {syncStatus?.inProgress && (
        <Card className="border-primary">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="font-medium">
                  {t('elasticsearch.syncing', 'Syncing {{entity}}...', { 
                    entity: syncStatus.currentEntity || 'data' 
                  })}
                </p>
                <div className="w-full bg-secondary rounded-full h-2 mt-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${syncStatus.progress}%` }}
                  />
                </div>
              </div>
              <span className="text-sm text-muted-foreground">
                {syncStatus.progress}%
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">
              {t('elasticsearch.overview', 'Overview')}
            </span>
          </TabsTrigger>
          <TabsTrigger value="indices" className="flex items-center gap-1">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">
              {t('elasticsearch.indices', 'Indices')}
            </span>
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex items-center gap-1">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">
              {t('elasticsearch.sync', 'Sync')}
            </span>
          </TabsTrigger>
          <TabsTrigger value="quality" className="flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">
              {t('elasticsearch.quality', 'Quality')}
            </span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">
              {t('elasticsearch.settings', 'Settings')}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <ESHealthStatus health={health} isLoading={healthLoading} />
            <Card>
              <CardHeader>
                <CardTitle>{t('elasticsearch.quickActions', 'Quick Actions')}</CardTitle>
                <CardDescription>
                  {t('elasticsearch.quickActionsDesc', 'Common administrative operations')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => setActiveTab('sync')}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('elasticsearch.goToSync', 'Manage Sync Operations')}
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => setActiveTab('indices')}
                >
                  <Database className="w-4 h-4 mr-2" />
                  {t('elasticsearch.goToIndices', 'View Index Details')}
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => setActiveTab('quality')}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  {t('elasticsearch.goToQuality', 'Check Data Quality')}
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  asChild
                >
                  <a href={getKibanaUrl()} target="_blank" rel="noopener noreferrer">
                    <Search className="w-4 h-4 mr-2" />
                    {t('elasticsearch.openKibanaFull', 'Open Kibana Dashboard')}
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Index Summary */}
          <IndexList 
            indices={indices || []} 
            compact 
            isLoading={indicesLoading}
          />
        </TabsContent>

        {/* Indices Tab */}
        <TabsContent value="indices" className="mt-6">
          <IndexList 
            indices={indices || []} 
            isLoading={indicesLoading}
          />
        </TabsContent>

        {/* Sync Tab */}
        <TabsContent value="sync" className="mt-6">
          <SyncControls syncStatus={syncStatus} />
          <SyncHistory />
        </TabsContent>

        {/* Quality Tab */}
        <TabsContent value="quality" className="mt-6">
          <DataQualityReport indices={indices || []} />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('elasticsearch.configuration', 'Configuration')}</CardTitle>
              <CardDescription>
                {t('elasticsearch.configurationDesc', 'Current Elasticsearch configuration settings')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('elasticsearch.indexPrefix', 'Index Prefix')}
                  </label>
                  <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    eventcal
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('elasticsearch.environment', 'Environment')}
                  </label>
                  <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    {typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
                      ? 'production' 
                      : 'development'}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('elasticsearch.kibanaUrl', 'Kibana URL')}
                  </label>
                  <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    {getKibanaUrl()}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('elasticsearch.clusterName', 'Cluster Name')}
                  </label>
                  <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    {health?.cluster_name || 'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('elasticsearch.totalIndices', 'Total Indices')}
                  </label>
                  <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    {indices?.length || 0}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('elasticsearch.syncInterval', 'Cron Sync Interval')}
                  </label>
                  <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    {adminStatus?.cron?.interval || 'Every 5 minutes'}
                  </p>
                </div>
              </div>

              {/* Cron Status */}
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-3">
                  {t('elasticsearch.cronStatus', 'Scheduled Sync Status')}
                </h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      {t('elasticsearch.cronRunning', 'Status')}
                    </p>
                    <p className="font-medium flex items-center gap-2">
                      {adminStatus?.cron?.running ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          {t('common.active', 'Active')}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                          {t('common.inactive', 'Inactive')}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      {t('elasticsearch.lastCronRun', 'Last Run')}
                    </p>
                    <p className="font-medium text-sm">
                      {adminStatus?.cron?.lastRun 
                        ? new Date(adminStatus.cron.lastRun).toLocaleString()
                        : t('common.never', 'Never')
                      }
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      {t('elasticsearch.nextCronRun', 'Next Run')}
                    </p>
                    <p className="font-medium text-sm">
                      {adminStatus?.cron?.nextRun 
                        ? new Date(adminStatus.cron.nextRun).toLocaleString()
                        : t('common.notScheduled', 'Not Scheduled')
                      }
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Skeleton loader for the admin page
 */
function ElasticsearchAdminSkeleton() {
  return (
    <div className="container mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
