/**
 * Lead Funnel Chart Component
 * 
 * Displays leads status distribution as a funnel.
 * 
 * @module components/analytics/LeadFunnelChart
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp } from 'lucide-react';
import type { LeadsSummary } from '@/types/analytics';

interface LeadFunnelChartProps {
  data: LeadsSummary;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500',
  in_progress: 'bg-blue-500',
  inactive: 'bg-gray-500',
};

const typeColors: Record<string, string> = {
  lead: 'bg-blue-500',
  partner: 'bg-purple-500',
  customer: 'bg-green-500',
  vendor: 'bg-amber-500',
  other: 'bg-gray-500',
};

export function LeadFunnelChart({ data }: LeadFunnelChartProps) {
  const { t } = useTranslation();

  const statusStages = [
    {
      label: t('contactsAnalytics.leadStatus.active', 'Active'),
      count: data.activeLeads,
      percentage: data.totalLeads > 0 ? (data.activeLeads / data.totalLeads) * 100 : 0,
      color: 'bg-green-500',
    },
    {
      label: t('contactsAnalytics.leadStatus.inProgress', 'In Progress'),
      count: data.inProgressLeads,
      percentage: data.totalLeads > 0 ? (data.inProgressLeads / data.totalLeads) * 100 : 0,
      color: 'bg-blue-500',
    },
    {
      label: t('contactsAnalytics.leadStatus.inactive', 'Inactive'),
      count: data.inactiveLeads,
      percentage: data.totalLeads > 0 ? (data.inactiveLeads / data.totalLeads) * 100 : 0,
      color: 'bg-gray-500',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          {t('contactsAnalytics.leadFunnel', 'Lead Funnel')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Distribution Funnel */}
        <div className="space-y-4">
          {statusStages.map((stage, index) => (
            <div key={stage.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{stage.label}</span>
                <span className="text-muted-foreground">
                  {stage.count} ({stage.percentage.toFixed(1)}%)
                </span>
              </div>
              <div
                className="relative h-8 rounded-md overflow-hidden"
                style={{
                  width: `${100 - index * 15}%`,
                  marginLeft: `${index * 7.5}%`,
                }}
              >
                <div
                  className={`absolute inset-0 ${stage.color} opacity-80`}
                  style={{ width: `${Math.max(stage.percentage, 5)}%` }}
                />
                <div className="absolute inset-0 bg-muted/30" />
              </div>
            </div>
          ))}
        </div>

        {/* Conversion Rate */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="font-medium">
                {t('contactsAnalytics.conversionRate', 'Conversion Rate')}
              </span>
            </div>
            <span className="text-2xl font-bold">{data.conversionRate}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t('contactsAnalytics.conversionDescription', 'Leads moved to inactive (completed/converted)')}
          </p>
        </div>

        {/* By Type */}
        {data.leadsByType.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">
              {t('contactsAnalytics.leadsByType', 'Leads by Type')}
            </h4>
            <div className="flex flex-wrap gap-2">
              {data.leadsByType.map((typeData) => (
                <Badge
                  key={typeData.type}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${typeColors[typeData.type] || 'bg-gray-500'}`}
                  />
                  <span className="capitalize">{typeData.type}</span>
                  <span className="font-bold">{typeData.count}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {data.totalLeads === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            {t('contactsAnalytics.noLeads', 'No leads data available')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LeadFunnelChart;
