/**
 * Activity Type Breakdown Chart
 * 
 * Displays a pie/donut chart showing the distribution of partnership
 * activities by type.
 * 
 * @module components/analytics/ActivityTypeChart
 */

import { useTranslation } from 'react-i18next';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { ActivityTypeBreakdown } from '@/types/analytics';

interface ActivityTypeChartProps {
  data: ActivityTypeBreakdown[];
}

// Color palette for pie slices
const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(210, 70%, 60%)',
  'hsl(280, 70%, 60%)',
];

// Map activity types to display labels
const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  joint_event: 'partnershipsAnalytics.activityTypes.jointEvent',
  sponsorship: 'partnershipsAnalytics.activityTypes.sponsorship',
  collaboration: 'partnershipsAnalytics.activityTypes.collaboration',
  training: 'partnershipsAnalytics.activityTypes.training',
  exchange: 'partnershipsAnalytics.activityTypes.exchange',
  meeting: 'partnershipsAnalytics.activityTypes.meeting',
  other: 'partnershipsAnalytics.activityTypes.other',
};

export function ActivityTypeChart({ data }: ActivityTypeChartProps) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {t('common.noData', 'No data available')}
      </div>
    );
  }

  const chartData = data.map((item, index) => ({
    name: t(ACTIVITY_TYPE_LABELS[item.activityType] || item.activityType, item.activityType),
    value: item.count,
    percentage: item.percentage,
    fill: COLORS[index % COLORS.length],
  }));

  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percentage }) => `${percentage.toFixed(1)}%`}
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip 
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload;
              return (
                <div className="bg-popover border rounded-lg shadow-lg p-3">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.value} {t('partnershipsAnalytics.activities', 'activities')} ({item.percentage.toFixed(1)}%)
                  </p>
                </div>
              );
            }}
          />
          <Legend 
            layout="horizontal"
            align="center"
            verticalAlign="bottom"
          />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Summary */}
      <div className="text-center text-sm text-muted-foreground">
        {t('partnershipsAnalytics.totalActivitiesCount', 'Total: {{count}} activities', { count: total })}
      </div>
    </div>
  );
}
