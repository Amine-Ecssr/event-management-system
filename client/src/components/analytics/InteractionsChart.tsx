/**
 * Interaction Timeline Chart Component
 * 
 * Displays interaction trends over time.
 * 
 * @module components/analytics/InteractionsChart
 */

import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Phone, Users, MoreHorizontal } from 'lucide-react';
import type { InteractionMetrics } from '@/types/analytics';

interface InteractionsChartProps {
  data: InteractionMetrics;
}

const typeIcons: Record<string, React.ReactNode> = {
  email: <MessageSquare className="h-3 w-3" />,
  phone_call: <Phone className="h-3 w-3" />,
  meeting: <Users className="h-3 w-3" />,
  other: <MoreHorizontal className="h-3 w-3" />,
};

const typeColors: Record<string, string> = {
  email: '#3B82F6',
  phone_call: '#10B981',
  meeting: '#8B5CF6',
  other: '#6B7280',
};

export function InteractionsChart({ data }: InteractionsChartProps) {
  const { t } = useTranslation();

  const chartData = data.monthlyTrends.map((trend) => ({
    month: trend.month,
    [t('contactsAnalytics.interactionType.email', 'Email')]: trend.emailCount,
    [t('contactsAnalytics.interactionType.phone', 'Phone')]: trend.phoneCount,
    [t('contactsAnalytics.interactionType.meeting', 'Meeting')]: trend.meetingCount,
    [t('contactsAnalytics.interactionType.other', 'Other')]: trend.otherCount,
  }));

  return (
    <Card className="col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('contactsAnalytics.interactionTrends', 'Interaction Trends')}</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t('contactsAnalytics.total', 'Total')}:
              </span>
              <span className="font-bold">{data.totalInteractions}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t('contactsAnalytics.avgPerLead', 'Avg/Lead')}:
              </span>
              <span className="font-bold">{data.averageInteractionsPerLead}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type Distribution Badges */}
        <div className="flex flex-wrap gap-2">
          {data.interactionsByType.map((typeData) => (
            <Badge
              key={typeData.type}
              variant="outline"
              className="flex items-center gap-2"
              style={{ borderColor: typeColors[typeData.type] || '#6B7280' }}
            >
              {typeIcons[typeData.type]}
              <span className="capitalize">
                {t(`contactsAnalytics.interactionType.${typeData.type}`, typeData.type.replace('_', ' '))}
              </span>
              <span className="font-bold">{typeData.count}</span>
              <span className="text-muted-foreground">({typeData.percentage}%)</span>
            </Badge>
          ))}
        </div>

        {/* Monthly Chart */}
        {data.monthlyTrends.length > 0 ? (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(value) => {
                    const [year, month] = value.split('-');
                    return `${month}/${year.slice(2)}`;
                  }}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  labelFormatter={(value) => {
                    const [year, month] = value.split('-');
                    const date = new Date(parseInt(year), parseInt(month) - 1);
                    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  }}
                />
                <Legend />
                <Bar
                  dataKey={t('contactsAnalytics.interactionType.email', 'Email')}
                  stackId="a"
                  fill="#3B82F6"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey={t('contactsAnalytics.interactionType.phone', 'Phone')}
                  stackId="a"
                  fill="#10B981"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey={t('contactsAnalytics.interactionType.meeting', 'Meeting')}
                  stackId="a"
                  fill="#8B5CF6"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey={t('contactsAnalytics.interactionType.other', 'Other')}
                  stackId="a"
                  fill="#6B7280"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            {t('contactsAnalytics.noInteractionData', 'No interaction data available')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default InteractionsChart;
