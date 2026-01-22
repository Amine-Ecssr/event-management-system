/**
 * Data Quality Report Component
 * 
 * Displays data quality metrics comparing PostgreSQL and Elasticsearch.
 * Shows missing documents, orphans, and sync discrepancies.
 * 
 * @module components/admin/DataQualityReport
 */

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  RefreshCw,
  Database,
  Search,
  Info
} from 'lucide-react';
import type { IndexStats } from '@/types/elasticsearch';

interface DataQualityItem {
  entity: string;
  pgCount: number;
  esCount: number;
  difference: number;
  status: 'ok' | 'warning' | 'error';
}

interface DataQualityReportProps {
  indices?: IndexStats[];
}

/**
 * Calculate data quality status
 */
function calculateStatus(pgCount: number, esCount: number): 'ok' | 'warning' | 'error' {
  if (pgCount === esCount) return 'ok';
  if (Math.abs(pgCount - esCount) <= 5) return 'warning';
  return 'error';
}

/**
 * Get status badge
 */
function getStatusBadge(status: 'ok' | 'warning' | 'error') {
  switch (status) {
    case 'ok':
      return (
        <Badge className="bg-green-500 hover:bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          Synced
        </Badge>
      );
    case 'warning':
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Minor Diff
        </Badge>
      );
    case 'error':
      return (
        <Badge className="bg-red-500 hover:bg-red-600">
          <XCircle className="h-3 w-3 mr-1" />
          Out of Sync
        </Badge>
      );
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

export function DataQualityReport({ indices = [] }: DataQualityReportProps) {
  const { t } = useTranslation('admin');

  // Fetch PostgreSQL counts from the real API endpoint
  const { data: pgCounts, isLoading: pgLoading, refetch } = useQuery({
    queryKey: ['admin', 'elasticsearch', 'quality', 'pg-counts'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/elasticsearch/pg-counts');
      return response as Record<string, number>;
    },
    enabled: indices.length > 0,
    staleTime: 60000, // 1 minute
  });

  // Calculate quality metrics
  const qualityData: DataQualityItem[] = indices.map(idx => {
    const pgCount = pgCounts?.[idx.entity] ?? idx.docsCount;
    const difference = pgCount - idx.docsCount;
    return {
      entity: idx.entity,
      pgCount,
      esCount: idx.docsCount,
      difference,
      status: calculateStatus(pgCount, idx.docsCount),
    };
  });

  // Summary stats
  const summary = {
    total: qualityData.length,
    synced: qualityData.filter(d => d.status === 'ok').length,
    warnings: qualityData.filter(d => d.status === 'warning').length,
    errors: qualityData.filter(d => d.status === 'error').length,
  };

  const isLoading = pgLoading;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              {t('elasticsearch.dataQuality', 'Data Quality Report')}
            </CardTitle>
            <CardDescription>
              {t('elasticsearch.dataQualityDesc', 'Compare document counts between PostgreSQL and Elasticsearch')}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {t('common.refresh', 'Refresh')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <div className="p-4 rounded-lg border">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Database className="h-4 w-4" />
              <span className="text-sm">Total Entities</span>
            </div>
            <span className="text-2xl font-bold">{summary.total}</span>
          </div>
          <div className="p-4 rounded-lg border bg-green-500/5 border-green-500/20">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Synced</span>
            </div>
            <span className="text-2xl font-bold text-green-600">{summary.synced}</span>
          </div>
          <div className="p-4 rounded-lg border bg-yellow-500/5 border-yellow-500/20">
            <div className="flex items-center gap-2 text-yellow-600 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Warnings</span>
            </div>
            <span className="text-2xl font-bold text-yellow-600">{summary.warnings}</span>
          </div>
          <div className="p-4 rounded-lg border bg-red-500/5 border-red-500/20">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <XCircle className="h-4 w-4" />
              <span className="text-sm">Out of Sync</span>
            </div>
            <span className="text-2xl font-bold text-red-600">{summary.errors}</span>
          </div>
        </div>

        {/* Alert if issues detected */}
        {summary.errors > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t(
                'elasticsearch.syncIssuesDetected',
                '{{count}} entities are out of sync. Consider running a full reindex to resolve discrepancies.',
                { count: summary.errors }
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Info Note */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {t(
              'elasticsearch.dataQualityNote',
              'Minor differences (1-5 documents) may be due to timing or pending sync operations. Larger differences may require investigation or a full reindex.'
            )}
          </AlertDescription>
        </Alert>

        {/* Data Quality Table */}
        {isLoading ? (
          <DataQualitySkeleton />
        ) : qualityData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Info className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {t('elasticsearch.noQualityData', 'No quality data available')}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('elasticsearch.entity', 'Entity')}</TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Database className="h-3 w-3" />
                    PostgreSQL
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Search className="h-3 w-3" />
                    Elasticsearch
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  {t('elasticsearch.difference', 'Difference')}
                </TableHead>
                <TableHead>{t('common.status', 'Status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {qualityData.map((item) => (
                <TableRow key={item.entity}>
                  <TableCell className="font-medium">
                    {formatEntityName(item.entity)}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.pgCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.esCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.difference !== 0 && (
                      <span className={item.difference > 0 ? 'text-yellow-600' : 'text-red-600'}>
                        {item.difference > 0 ? '+' : ''}{item.difference}
                      </span>
                    )}
                    {item.difference === 0 && (
                      <span className="text-green-600">0</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton loader for DataQualityReport
 */
function DataQualitySkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Entity</TableHead>
          <TableHead className="text-right">PostgreSQL</TableHead>
          <TableHead className="text-right">Elasticsearch</TableHead>
          <TableHead className="text-right">Difference</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
            <TableCell><Skeleton className="h-6 w-20" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default DataQualityReport;
