# Feature: Admin ES Management Panel

## Type
Feature / Admin UI

## Priority
🟡 Medium

## Estimated Effort
4-5 hours

## Description
Admin interface for Elasticsearch management including index control, sync operations, and health monitoring. Provides a centralized dashboard for superadmins to monitor search infrastructure health, trigger manual sync operations, and troubleshoot indexing issues.

## Access
- **Development**: Accessible at `/admin/elasticsearch` (requires superadmin role)
- **Production**: Same route; for full Kibana access use `kibana.eventcal.app`

## Requirements

### Index Management Section
- List all indices with stats (using configurable `ES_INDEX_PREFIX`)
- Document count per index with comparison to PostgreSQL
- Index size (with human-readable format)
- Health status indicator (green/yellow/red)
- Create/delete index buttons (with confirmation modals)
- Index refresh and force merge operations
- View mapping button

### Sync Operations
- Manual full reindex button (all entities)
- Incremental sync button (changed since last sync)
- Reindex specific entity type dropdown
- Sync progress indicator with percentage
- Last sync timestamp per entity
- Estimated time remaining
- Cancel sync operation

### Health Monitoring
- Cluster health status (real-time)
- Node information (CPU, memory, disk)
- Memory usage graphs
- Query latency stats (p50, p95, p99)
- Indexing rate metrics
- Active shards and replicas

### Data Quality
- Missing documents detection (diff PostgreSQL vs ES)
- Orphan cleanup (documents in ES not in DB)
- Data freshness check (oldest document age)
- Sync discrepancy report
- Field mapping conflicts

### Logs & History
- Recent sync operations (last 50)
- Error log viewer with filtering
- Query performance log
- Export logs to CSV

### Navigation
- Add to Admin menu (Superadmin only)
- Route: `/admin/elasticsearch`
- Sidebar icon: Database/Search

---

## Complete Implementation

### Admin Page (`client/src/pages/admin/ElasticsearchAdminPage.tsx`)
```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IndexList } from '@/components/admin/IndexList';
import { SyncControls } from '@/components/admin/SyncControls';
import { ESHealthStatus } from '@/components/admin/ESHealthStatus';
import { SyncHistory } from '@/components/admin/SyncHistory';
import { DataQualityReport } from '@/components/admin/DataQualityReport';
import { apiRequest } from '@/lib/queryClient';
import {
  Database, RefreshCw, Activity, AlertTriangle, 
  CheckCircle, XCircle, ExternalLink, Settings
} from 'lucide-react';
import type { ESHealthResponse, IndexStats, SyncStatus } from '@/types/elasticsearch';

export default function ElasticsearchAdminPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch ES health
  const { data: health, isLoading: healthLoading } = useQuery<ESHealthResponse>({
    queryKey: ['admin', 'elasticsearch', 'health'],
    queryFn: () => apiRequest('GET', '/api/health/elasticsearch/detailed'),
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch index stats
  const { data: indices, isLoading: indicesLoading } = useQuery<IndexStats[]>({
    queryKey: ['admin', 'elasticsearch', 'indices'],
    queryFn: () => apiRequest('GET', '/api/admin/elasticsearch/indices'),
    refetchInterval: 60000,
  });

  // Fetch sync status
  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ['admin', 'elasticsearch', 'sync-status'],
    queryFn: () => apiRequest('GET', '/api/admin/elasticsearch/sync-status'),
    refetchInterval: 5000, // More frequent when sync might be running
  });

  // Full reindex mutation
  const fullReindexMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/elasticsearch/reindex'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'elasticsearch'] });
    },
  });

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'green':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Healthy</Badge>;
      case 'yellow':
        return <Badge className="bg-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" /> Warning</Badge>;
      case 'red':
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" /> Critical</Badge>;
      default:
        return <Badge variant="outline">Unavailable</Badge>;
    }
  };

  if (healthLoading) {
    return <ElasticsearchAdminSkeleton />;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.elasticsearch.title')}</h1>
          <p className="text-muted-foreground">
            {t('admin.elasticsearch.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getHealthBadge(health?.status || 'unavailable')}
          <Button variant="outline" size="sm" asChild>
            <a 
              href={process.env.NODE_ENV === 'production' 
                ? 'https://kibana.eventcal.app' 
                : 'http://localhost:5601'
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Open Kibana
            </a>
          </Button>
        </div>
      </div>

      {/* Health Alert */}
      {health?.status === 'red' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Elasticsearch cluster is in critical state. Some search features may be unavailable.
          </AlertDescription>
        </Alert>
      )}

      {/* Sync Progress */}
      {syncStatus?.inProgress && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="font-medium">
                  Syncing {syncStatus.currentEntity}...
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="w-4 h-4 mr-1" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="indices">
            <Database className="w-4 h-4 mr-1" />
            Indices
          </TabsTrigger>
          <TabsTrigger value="sync">
            <RefreshCw className="w-4 h-4 mr-1" />
            Sync
          </TabsTrigger>
          <TabsTrigger value="quality">
            <AlertTriangle className="w-4 h-4 mr-1" />
            Data Quality
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-1" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <ESHealthStatus health={health} />
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full" 
                  onClick={() => fullReindexMutation.mutate()}
                  disabled={syncStatus?.inProgress || fullReindexMutation.isPending}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${fullReindexMutation.isPending ? 'animate-spin' : ''}`} />
                  Full Reindex
                </Button>
                <Button variant="outline" className="w-full">
                  Refresh All Indices
                </Button>
                <Button variant="outline" className="w-full">
                  Clear Query Cache
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Index Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Index Summary</CardTitle>
              <CardDescription>
                Using index prefix: <code className="bg-muted px-1 rounded">eventcal</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IndexList indices={indices || []} compact />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indices">
          <IndexList indices={indices || []} />
        </TabsContent>

        <TabsContent value="sync">
          <SyncControls syncStatus={syncStatus} />
          <SyncHistory />
        </TabsContent>

        <TabsContent value="quality">
          <DataQualityReport />
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Index Prefix</label>
                  <p className="text-sm text-muted-foreground">
                    <code>ES_INDEX_PREFIX=eventcal</code>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Environment Suffix</label>
                  <p className="text-sm text-muted-foreground">
                    <code>ES_INDEX_SUFFIX={process.env.NODE_ENV === 'production' ? 'prod' : 'dev'}</code>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Kibana URL</label>
                  <p className="text-sm text-muted-foreground">
                    {process.env.NODE_ENV === 'production' 
                      ? 'https://kibana.eventcal.app'
                      : 'http://localhost:5601'
                    }
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Cluster Name</label>
                  <p className="text-sm text-muted-foreground">
                    {health?.cluster_name || 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ElasticsearchAdminSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
```

### Index List Component (`client/src/components/admin/IndexList.tsx`)
```tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { apiRequest } from '@/lib/queryClient';
import { MoreHorizontal, RefreshCw, Trash2, Eye, Zap } from 'lucide-react';
import type { IndexStats } from '@/types/elasticsearch';

interface IndexListProps {
  indices: IndexStats[];
  compact?: boolean;
}

export function IndexList({ indices, compact = false }: IndexListProps) {
  const queryClient = useQueryClient();
  const [deleteIndex, setDeleteIndex] = useState<string | null>(null);

  const refreshMutation = useMutation({
    mutationFn: (indexName: string) => 
      apiRequest('POST', `/api/admin/elasticsearch/indices/${indexName}/refresh`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'elasticsearch', 'indices'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (indexName: string) => 
      apiRequest('DELETE', `/api/admin/elasticsearch/indices/${indexName}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'elasticsearch', 'indices'] });
      setDeleteIndex(null);
    },
  });

  const getHealthBadge = (health: string) => {
    const colors: Record<string, string> = {
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500',
    };
    return <Badge className={colors[health] || 'bg-gray-500'}>{health}</Badge>;
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Index Name</TableHead>
            <TableHead>Health</TableHead>
            <TableHead className="text-right">Documents</TableHead>
            <TableHead className="text-right">Size</TableHead>
            {!compact && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {indices.map((index) => (
            <TableRow key={index.index}>
              <TableCell className="font-mono text-sm">{index.index}</TableCell>
              <TableCell>{getHealthBadge(index.health)}</TableCell>
              <TableCell className="text-right">
                {index.docs_count.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">{index.size_human}</TableCell>
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
                        onClick={() => refreshMutation.mutate(index.index)}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        View Mapping
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Zap className="h-4 w-4 mr-2" />
                        Force Merge
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteIndex(index.index)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Index
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!deleteIndex} onOpenChange={() => setDeleteIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Index</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <code>{deleteIndex}</code>? 
              This action cannot be undone. All data in this index will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteIndex && deleteMutation.mutate(deleteIndex)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

### Admin Routes (`server/routes/elasticsearch-admin.routes.ts`)
```typescript
import { Router } from 'express';
import { isSuperAdmin } from '../auth';
import { indexManager } from '../elasticsearch/indices/index-manager';
import { syncService } from '../services/elasticsearch-sync.service';
import { getElasticsearchClient, checkElasticsearchHealth } from '../elasticsearch/client';
import { ES_INDEX_PREFIX } from '../elasticsearch/config';

const router = Router();

// Get all indices stats
router.get('/api/admin/elasticsearch/indices', isSuperAdmin, async (req, res) => {
  try {
    const stats = await indexManager.getIndexStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch index stats' });
  }
});

// Refresh specific index
router.post('/api/admin/elasticsearch/indices/:indexName/refresh', isSuperAdmin, async (req, res) => {
  try {
    await indexManager.refreshIndex(req.params.indexName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh index' });
  }
});

// Delete index (dangerous!)
router.delete('/api/admin/elasticsearch/indices/:indexName', isSuperAdmin, async (req, res) => {
  const { indexName } = req.params;
  
  // Safety check - only allow deleting indices with our prefix
  if (!indexName.startsWith(ES_INDEX_PREFIX)) {
    return res.status(403).json({ error: 'Cannot delete indices outside of EventCal namespace' });
  }
  
  try {
    await indexManager.deleteIndex(indexName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete index' });
  }
});

// Get sync status
router.get('/api/admin/elasticsearch/sync-status', isSuperAdmin, async (req, res) => {
  try {
    const status = syncService.getSyncStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// Trigger full reindex
router.post('/api/admin/elasticsearch/reindex', isSuperAdmin, async (req, res) => {
  try {
    // Start async reindex
    syncService.fullReindex().catch(console.error);
    res.json({ success: true, message: 'Full reindex started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start reindex' });
  }
});

// Reindex specific entity
router.post('/api/admin/elasticsearch/reindex/:entity', isSuperAdmin, async (req, res) => {
  try {
    await syncService.reindexEntity(req.params.entity);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reindex entity' });
  }
});

// Initialize all indices
router.post('/api/admin/elasticsearch/init-indices', isSuperAdmin, async (req, res) => {
  try {
    const result = await indexManager.createAllIndices();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to initialize indices' });
  }
});

export default router;
```

---

### Files to Create
- `client/src/pages/admin/ElasticsearchAdminPage.tsx`
- `client/src/components/admin/IndexList.tsx`
- `client/src/components/admin/SyncControls.tsx`
- `client/src/components/admin/ESHealthStatus.tsx`
- `client/src/components/admin/SyncHistory.tsx`
- `client/src/components/admin/DataQualityReport.tsx`
- `server/routes/elasticsearch-admin.routes.ts`

### Files to Modify
- `client/src/App.tsx` - Add route for `/admin/elasticsearch`
- `client/src/components/layout/AdminSidebar.tsx` - Add menu item
- `server/routes.ts` - Register admin routes
- `client/src/types/elasticsearch.ts` - Add admin types

## Acceptance Criteria
- [ ] Index list shows all indices with correct stats
- [ ] Manual reindex triggers successfully
- [ ] Health status updates in real-time (30s interval)
- [ ] Sync progress visible with percentage
- [ ] Error logs accessible and filterable
- [ ] Superadmin only access (middleware enforced)
- [ ] Link to Kibana (kibana.eventcal.app in prod)
- [ ] Delete index has safety check for prefix
- [ ] Configuration shows ES_INDEX_PREFIX value

## Dependencies
- Task 04: Index Management
- Task 06: Scheduled Sync
- Task 09: Aggregations Service
