/**
 * Index List Component
 * 
 * Displays a table of Elasticsearch indices with stats and actions.
 * Used in the Elasticsearch Admin Page.
 * 
 * @module components/admin/IndexList
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  MoreHorizontal, 
  RefreshCw, 
  Trash2, 
  Eye, 
  Zap,
  Database,
  HardDrive
} from 'lucide-react';
import type { IndexStats, IndexActionResult } from '@/types/elasticsearch';

interface IndexListProps {
  indices: IndexStats[];
  compact?: boolean;
  isLoading?: boolean;
}

/**
 * Get badge variant based on health status
 */
function getHealthBadge(health: string) {
  switch (health) {
    case 'green':
      return <Badge className="bg-green-500 hover:bg-green-600">{health}</Badge>;
    case 'yellow':
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">{health}</Badge>;
    case 'red':
      return <Badge className="bg-red-500 hover:bg-red-600">{health}</Badge>;
    default:
      return <Badge variant="outline">{health || 'unknown'}</Badge>;
  }
}

/**
 * Format entity name for display
 */
function formatEntityName(entity: string): string {
  return entity
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function IndexList({ indices, compact = false, isLoading = false }: IndexListProps) {
  const { t } = useTranslation('admin');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteIndex, setDeleteIndex] = useState<string | null>(null);
  const [viewMapping, setViewMapping] = useState<{ index: string; mapping: any } | null>(null);

  // Refresh index mutation
  const refreshMutation = useMutation({
    mutationFn: () => 
      apiRequest<IndexActionResult>('POST', '/api/admin/elasticsearch/indices/refresh'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'elasticsearch', 'indices'] });
      toast({
        title: t('elasticsearch.indexRefreshed', 'Index Refreshed'),
        description: data.message || 'All indices have been refreshed',
      });
    },
    onError: () => {
      toast({
        title: t('common.error', 'Error'),
        description: t('elasticsearch.refreshFailed', 'Failed to refresh index'),
        variant: 'destructive',
      });
    },
  });

  // Delete index mutation
  const deleteMutation = useMutation({
    mutationFn: (indexName: string) =>
      apiRequest<IndexActionResult>('POST', `/api/admin/elasticsearch/indices/${indexName}/recreate`, {
        confirm: 'DELETE_ALL_DATA',
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'elasticsearch', 'indices'] });
      setDeleteIndex(null);
      toast({
        title: t('elasticsearch.indexRecreated', 'Index Recreated'),
        description: data.message || 'Index has been recreated successfully',
      });
    },
    onError: () => {
      toast({
        title: t('common.error', 'Error'),
        description: t('elasticsearch.deleteFailed', 'Failed to recreate index'),
        variant: 'destructive',
      });
    },
  });

  // Calculate totals
  const totals = indices.reduce(
    (acc, idx) => ({
      docs: acc.docs + idx.docsCount,
      size: acc.size + idx.sizeBytes,
    }),
    { docs: 0, size: 0 }
  );

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  if (isLoading) {
    return <IndexListSkeleton compact={compact} />;
  }

  return (
    <>
      {/* Summary Cards (if not compact) */}
      {!compact && (
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('elasticsearch.totalIndices', 'Total Indices')}
                  </p>
                  <p className="text-2xl font-bold">{indices.length}</p>
                </div>
                <Database className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('elasticsearch.totalDocuments', 'Total Documents')}
                  </p>
                  <p className="text-2xl font-bold">{totals.docs.toLocaleString()}</p>
                </div>
                <Eye className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('elasticsearch.totalSize', 'Total Size')}
                  </p>
                  <p className="text-2xl font-bold">{formatSize(totals.size)}</p>
                </div>
                <HardDrive className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Index Table */}
      <Card>
        {!compact && (
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('elasticsearch.indices', 'Indices')}</CardTitle>
                <CardDescription>
                  {t('elasticsearch.indicesDescription', 'Manage Elasticsearch indices and their data')}
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                {t('elasticsearch.refreshAll', 'Refresh All')}
              </Button>
            </div>
          </CardHeader>
        )}
        <CardContent className={compact ? 'p-0' : ''}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('elasticsearch.indexName', 'Index Name')}</TableHead>
                <TableHead>{t('elasticsearch.entity', 'Entity')}</TableHead>
                <TableHead>{t('elasticsearch.health', 'Health')}</TableHead>
                <TableHead className="text-right">{t('elasticsearch.documents', 'Documents')}</TableHead>
                <TableHead className="text-right">{t('elasticsearch.size', 'Size')}</TableHead>
                {!compact && <TableHead className="text-right">{t('common.actions', 'Actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {indices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={compact ? 5 : 6} className="text-center py-8 text-muted-foreground">
                    {t('elasticsearch.noIndices', 'No indices found')}
                  </TableCell>
                </TableRow>
              ) : (
                indices.map((index) => (
                  <TableRow key={index.index}>
                    <TableCell className="font-mono text-sm">{index.index}</TableCell>
                    <TableCell>{formatEntityName(index.entity)}</TableCell>
                    <TableCell>{getHealthBadge(index.health)}</TableCell>
                    <TableCell className="text-right">
                      {index.docsCount.toLocaleString()}
                      {index.docsDeleted > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (-{index.docsDeleted})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{index.sizeHuman}</TableCell>
                    {!compact && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => refreshMutation.mutate()}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              {t('elasticsearch.refresh', 'Refresh')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteIndex(index.index)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('elasticsearch.recreate', 'Recreate Index')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteIndex} onOpenChange={() => setDeleteIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('elasticsearch.recreateIndex', 'Recreate Index')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'elasticsearch.recreateWarning',
                'Are you sure you want to recreate {{index}}? This will delete ALL data in this index and create a fresh empty index. This action cannot be undone.',
                { index: deleteIndex }
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteIndex && deleteMutation.mutate(deleteIndex)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('common.processing', 'Processing...')}
                </>
              ) : (
                t('elasticsearch.recreate', 'Recreate')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mapping Dialog */}
      <Dialog open={!!viewMapping} onOpenChange={() => setViewMapping(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {t('elasticsearch.indexMapping', 'Index Mapping')}: {viewMapping?.index}
            </DialogTitle>
            <DialogDescription>
              {t('elasticsearch.mappingDescription', 'Field definitions and types for this index')}
            </DialogDescription>
          </DialogHeader>
          <pre className="bg-muted p-4 rounded-md text-sm overflow-auto">
            {JSON.stringify(viewMapping?.mapping, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Skeleton loader for IndexList
 */
function IndexListSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <Card>
      <CardContent className={compact ? 'p-0' : 'pt-6'}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Index Name</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Health</TableHead>
              <TableHead className="text-right">Documents</TableHead>
              <TableHead className="text-right">Size</TableHead>
              {!compact && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                {!compact && <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default IndexList;
