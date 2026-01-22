/**
 * ES Health Status Component
 * 
 * Displays Elasticsearch cluster health status with metrics.
 * 
 * @module components/admin/ESHealthStatus
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Server,
  Database,
  Zap,
  HardDrive,
  Activity
} from 'lucide-react';
import type { ESHealthResponse } from '@/types/elasticsearch';

interface ESHealthStatusProps {
  health?: ESHealthResponse | null;
  isLoading?: boolean;
}

/**
 * Get health icon and color based on status
 */
function getHealthIndicator(status: string) {
  switch (status) {
    case 'green':
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        badge: <Badge className="bg-green-500 hover:bg-green-600">Healthy</Badge>,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
      };
    case 'yellow':
      return {
        icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
        badge: <Badge className="bg-yellow-500 hover:bg-yellow-600">Warning</Badge>,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
      };
    case 'red':
      return {
        icon: <XCircle className="h-5 w-5 text-red-500" />,
        badge: <Badge className="bg-red-500 hover:bg-red-600">Critical</Badge>,
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
      };
    default:
      return {
        icon: <XCircle className="h-5 w-5 text-muted-foreground" />,
        badge: <Badge variant="outline">Unavailable</Badge>,
        color: 'text-muted-foreground',
        bgColor: 'bg-muted',
      };
  }
}

export function ESHealthStatus({ health, isLoading = false }: ESHealthStatusProps) {
  const { t } = useTranslation('admin');

  if (isLoading) {
    return <ESHealthStatusSkeleton />;
  }

  const status = health?.status || 'unavailable';
  const indicator = getHealthIndicator(status);
  const shardsPercent = health?.active_shards_percent_as_number || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t('elasticsearch.clusterHealth', 'Cluster Health')}
            </CardTitle>
            <CardDescription>
              {health?.cluster_name || 'Unknown cluster'}
            </CardDescription>
          </div>
          {indicator.badge}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Health Overview */}
        <div className={`p-4 rounded-lg ${indicator.bgColor}`}>
          <div className="flex items-center gap-3">
            {indicator.icon}
            <div>
              <p className={`font-medium ${indicator.color}`}>
                {status === 'green' && t('elasticsearch.healthGreen', 'All systems operational')}
                {status === 'yellow' && t('elasticsearch.healthYellow', 'Some replicas may be unavailable')}
                {status === 'red' && t('elasticsearch.healthRed', 'Primary shards are unavailable')}
                {status === 'unavailable' && t('elasticsearch.healthUnavailable', 'Cannot connect to cluster')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('elasticsearch.shardsActive', '{{percent}}% of shards are active', { 
                  percent: shardsPercent.toFixed(1) 
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          <MetricCard
            icon={<Server className="h-4 w-4" />}
            label={t('elasticsearch.nodes', 'Nodes')}
            value={health?.number_of_nodes || 0}
            subValue={`${health?.number_of_data_nodes || 0} data`}
          />
          <MetricCard
            icon={<Database className="h-4 w-4" />}
            label={t('elasticsearch.primaryShards', 'Primary Shards')}
            value={health?.active_primary_shards || 0}
          />
          <MetricCard
            icon={<Zap className="h-4 w-4" />}
            label={t('elasticsearch.activeShards', 'Active Shards')}
            value={health?.active_shards || 0}
          />
          <MetricCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label={t('elasticsearch.unassignedShards', 'Unassigned')}
            value={health?.unassigned_shards || 0}
            warning={(health?.unassigned_shards || 0) > 0}
          />
          <MetricCard
            icon={<HardDrive className="h-4 w-4" />}
            label={t('elasticsearch.relocatingShards', 'Relocating')}
            value={health?.relocating_shards || 0}
          />
          <MetricCard
            icon={<Activity className="h-4 w-4" />}
            label={t('elasticsearch.pendingTasks', 'Pending Tasks')}
            value={health?.number_of_pending_tasks || 0}
          />
        </div>

        {/* Shards Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t('elasticsearch.shardsHealth', 'Shard Health')}
            </span>
            <span className="font-medium">{shardsPercent.toFixed(1)}%</span>
          </div>
          <Progress 
            value={shardsPercent} 
            className="h-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Metric card for displaying a single value
 */
interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subValue?: string;
  warning?: boolean;
}

function MetricCard({ icon, label, value, subValue, warning = false }: MetricCardProps) {
  return (
    <div className={`p-3 rounded-lg border ${warning ? 'border-yellow-500/50 bg-yellow-500/5' : ''}`}>
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-bold ${warning ? 'text-yellow-600' : ''}`}>
          {value}
        </span>
        {subValue && (
          <span className="text-xs text-muted-foreground">{subValue}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Skeleton loader for ESHealthStatus
 */
function ESHealthStatusSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <Skeleton className="h-4 w-full" />
      </CardContent>
    </Card>
  );
}

export default ESHealthStatus;
