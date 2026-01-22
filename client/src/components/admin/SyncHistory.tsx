/**
 * Sync History Component
 * 
 * Displays history of Elasticsearch sync operations.
 * Note: This is a placeholder - actual sync history would require 
 * server-side logging implementation.
 * 
 * @module components/admin/SyncHistory
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Clock,
  Info
} from 'lucide-react';

interface SyncHistoryEntry {
  id: string;
  type: 'full' | 'incremental' | 'entity';
  entity?: string;
  startedAt: string;
  completedAt: string | null;
  documentsIndexed: number;
  documentsDeleted: number;
  errors: number;
  status: 'running' | 'completed' | 'failed';
}

interface SyncHistoryProps {
  history?: SyncHistoryEntry[];
}

/**
 * Get status badge based on sync status
 */
function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-green-500 hover:bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case 'running':
      return (
        <Badge className="bg-blue-500 hover:bg-blue-600">
          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
          Running
        </Badge>
      );
    case 'failed':
      return (
        <Badge className="bg-red-500 hover:bg-red-600">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/**
 * Format sync type for display
 */
function formatSyncType(type: string, entity?: string): string {
  switch (type) {
    case 'full':
      return 'Full Reindex';
    case 'incremental':
      return 'Incremental Sync';
    case 'entity':
      return `Reindex: ${entity || 'Unknown'}`;
    default:
      return type;
  }
}

/**
 * Calculate duration between two timestamps
 */
function calculateDuration(start: string, end: string | null): string {
  if (!end) return 'Running...';
  
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const duration = Math.round((endTime - startTime) / 1000);
  
  if (duration < 60) return `${duration}s`;
  if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
  return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
}

export function SyncHistory({ history = [] }: SyncHistoryProps) {
  const { t } = useTranslation('admin');

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {t('elasticsearch.syncHistory', 'Sync History')}
        </CardTitle>
        <CardDescription>
          {t('elasticsearch.syncHistoryDesc', 'Recent synchronization operations')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Info className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {t('elasticsearch.noSyncHistory', 'No sync history available')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('elasticsearch.noSyncHistoryDesc', 'Sync operations will appear here once executed')}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('elasticsearch.type', 'Type')}</TableHead>
                  <TableHead>{t('elasticsearch.started', 'Started')}</TableHead>
                  <TableHead>{t('elasticsearch.duration', 'Duration')}</TableHead>
                  <TableHead className="text-right">
                    {t('elasticsearch.indexed', 'Indexed')}
                  </TableHead>
                  <TableHead className="text-right">
                    {t('elasticsearch.deleted', 'Deleted')}
                  </TableHead>
                  <TableHead className="text-right">
                    {t('elasticsearch.errors', 'Errors')}
                  </TableHead>
                  <TableHead>{t('common.status', 'Status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {formatSyncType(entry.type, entry.entity)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(entry.startedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {calculateDuration(entry.startedAt, entry.completedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.documentsIndexed.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.documentsDeleted.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.errors > 0 ? (
                        <span className="text-destructive">{entry.errors}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default SyncHistory;
