/**
 * Sync Controls Component
 * 
 * Controls for triggering Elasticsearch sync operations.
 * Provides full reindex, incremental sync, and entity-specific reindex.
 * 
 * @module components/admin/SyncControls
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  RefreshCw, 
  Play, 
  Pause, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database
} from 'lucide-react';
import type { SyncStatus } from '@/types/elasticsearch';

interface SyncControlsProps {
  syncStatus?: SyncStatus | null;
}

// Available entity types for reindexing
const ENTITY_TYPES = [
  { value: 'events', label: 'Events' },
  { value: 'archivedEvents', label: 'Archived Events' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'organizations', label: 'Organizations' },
  { value: 'partnerships', label: 'Partnerships' },
  { value: 'leads', label: 'Leads' },
  { value: 'departments', label: 'Departments' },
  { value: 'attendees', label: 'Attendees' },
  { value: 'invitees', label: 'Invitees' },
  { value: 'updates', label: 'Updates' },
];

export function SyncControls({ syncStatus }: SyncControlsProps) {
  const { t } = useTranslation('admin');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEntity, setSelectedEntity] = useState<string>('events');

  // Full reindex mutation
  const fullReindexMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/elasticsearch/reindex'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'elasticsearch'] });
      toast({
        title: t('elasticsearch.reindexStarted', 'Reindex Started'),
        description: t('elasticsearch.reindexStartedDesc', 'Full reindex has been started. This may take several minutes.'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error', 'Error'),
        description: error.message || t('elasticsearch.reindexFailed', 'Failed to start reindex'),
        variant: 'destructive',
      });
    },
  });

  // Incremental sync mutation
  const incrementalSyncMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/elasticsearch/sync'),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'elasticsearch'] });
      toast({
        title: t('elasticsearch.syncComplete', 'Sync Complete'),
        description: t('elasticsearch.syncCompleteDesc', 'Indexed {{count}} documents', { count: data.documentsIndexed || 0 }),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error', 'Error'),
        description: error.message || t('elasticsearch.syncFailed', 'Failed to sync'),
        variant: 'destructive',
      });
    },
  });

  // Entity reindex mutation
  const entityReindexMutation = useMutation({
    mutationFn: (entity: string) => 
      apiRequest('POST', `/api/admin/elasticsearch/reindex/${entity}`),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'elasticsearch'] });
      toast({
        title: t('elasticsearch.entityReindexed', 'Entity Reindexed'),
        description: t('elasticsearch.entityReindexedDesc', 'Successfully reindexed {{count}} {{entity}} documents', { 
          count: data.documentsIndexed || 0,
          entity: selectedEntity 
        }),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error', 'Error'),
        description: error.message || t('elasticsearch.entityReindexFailed', 'Failed to reindex entity'),
        variant: 'destructive',
      });
    },
  });

  // Cleanup orphans mutation
  const cleanupMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/elasticsearch/cleanup'),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'elasticsearch'] });
      toast({
        title: t('elasticsearch.cleanupComplete', 'Cleanup Complete'),
        description: t('elasticsearch.cleanupCompleteDesc', 'Removed {{count}} orphaned documents', { count: data.documentsDeleted || 0 }),
      });
    },
    onError: () => {
      toast({
        title: t('common.error', 'Error'),
        description: t('elasticsearch.cleanupFailed', 'Failed to cleanup orphans'),
        variant: 'destructive',
      });
    },
  });

  // Determine if any operation is in progress
  const isAnyOperationRunning = 
    syncStatus?.inProgress || 
    fullReindexMutation.isPending || 
    incrementalSyncMutation.isPending || 
    entityReindexMutation.isPending ||
    cleanupMutation.isPending;

  const formatDate = (date: string | null) => {
    if (!date) return t('common.never', 'Never');
    return new Date(date).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Sync Status Card */}
      {syncStatus?.inProgress && (
        <Card className="border-primary">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="font-medium">
                  {t('elasticsearch.syncInProgress', 'Syncing {{entity}}...', { 
                    entity: syncStatus.currentEntity || 'data' 
                  })}
                </p>
                <Progress value={syncStatus.progress} className="mt-2" />
              </div>
              <span className="text-sm text-muted-foreground">
                {syncStatus.progress}%
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Sync Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('elasticsearch.syncStatus', 'Sync Status')}
          </CardTitle>
          <CardDescription>
            {t('elasticsearch.syncStatusDesc', 'Information about last synchronization operations')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                {t('elasticsearch.lastFullSync', 'Last Full Sync')}
              </p>
              <p className="text-sm">{formatDate(syncStatus?.lastFullSyncAt || null)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                {t('elasticsearch.lastIncrementalSync', 'Last Incremental Sync')}
              </p>
              <p className="text-sm">{formatDate(syncStatus?.lastSyncAt || null)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                {t('elasticsearch.documentsIndexed', 'Documents Indexed')}
              </p>
              <p className="text-sm">{(syncStatus?.documentsIndexed || 0).toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                {t('elasticsearch.errors', 'Errors')}
              </p>
              <p className="text-sm flex items-center gap-1">
                {(syncStatus?.errors || 0) > 0 ? (
                  <>
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-destructive">{syncStatus?.errors}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-500">0</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Operations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            {t('elasticsearch.syncOperations', 'Sync Operations')}
          </CardTitle>
          <CardDescription>
            {t('elasticsearch.syncOperationsDesc', 'Trigger synchronization between PostgreSQL and Elasticsearch')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Full Reindex */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">
                {t('elasticsearch.fullReindex', 'Full Reindex')}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t('elasticsearch.fullReindexDesc', 'Reindex all data from PostgreSQL. Use when ES data is out of sync or corrupted.')}
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="default"
                  disabled={isAnyOperationRunning}
                >
                  {fullReindexMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {t('elasticsearch.startReindex', 'Start Reindex')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t('elasticsearch.confirmReindex', 'Confirm Full Reindex')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('elasticsearch.confirmReindexDesc', 'This will reindex ALL data from PostgreSQL to Elasticsearch. This operation may take several minutes depending on data volume. Are you sure you want to proceed?')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => fullReindexMutation.mutate()}>
                    {t('elasticsearch.proceedReindex', 'Proceed with Reindex')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Incremental Sync */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">
                {t('elasticsearch.incrementalSync', 'Incremental Sync')}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t('elasticsearch.incrementalSyncDesc', 'Sync only changed documents since last sync. Faster than full reindex.')}
              </p>
            </div>
            <Button 
              variant="outline"
              onClick={() => incrementalSyncMutation.mutate()}
              disabled={isAnyOperationRunning}
            >
              {incrementalSyncMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t('elasticsearch.runSync', 'Run Sync')}
            </Button>
          </div>

          {/* Entity-specific Reindex */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1 mr-4">
              <h4 className="font-medium">
                {t('elasticsearch.entityReindex', 'Entity Reindex')}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t('elasticsearch.entityReindexDesc', 'Reindex a specific entity type only.')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select entity" />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((entity) => (
                    <SelectItem key={entity.value} value={entity.value}>
                      {entity.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline"
                onClick={() => entityReindexMutation.mutate(selectedEntity)}
                disabled={isAnyOperationRunning}
              >
                {entityReindexMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                {t('elasticsearch.reindex', 'Reindex')}
              </Button>
            </div>
          </div>

          {/* Cleanup Orphans */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">
                {t('elasticsearch.cleanupOrphans', 'Cleanup Orphans')}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t('elasticsearch.cleanupOrphansDesc', 'Remove documents from ES that no longer exist in PostgreSQL.')}
              </p>
            </div>
            <Button 
              variant="outline"
              onClick={() => cleanupMutation.mutate()}
              disabled={isAnyOperationRunning}
            >
              {cleanupMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4 mr-2" />
              )}
              {t('elasticsearch.cleanup', 'Cleanup')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SyncControls;
