/**
 * Task Trends Chart Component
 * 
 * Line chart showing monthly task creation vs completion trends.
 * 
 * @module components/analytics/TaskTrendsChart
 */

import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Bar,
} from 'recharts';
import type { TaskTrend } from '@/types/analytics';

interface TaskTrendsChartProps {
  data: TaskTrend[];
}

export function TaskTrendsChart({ data }: TaskTrendsChartProps) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        {t('tasksAnalytics.noTrendData', 'No trend data available')}
      </div>
    );
  }

  // Format month for display (YYYY-MM -> MMM YY)
  const chartData = data.map(item => ({
    ...item,
    displayMonth: new Date(item.month + '-01').toLocaleDateString(undefined, {
      year: '2-digit',
      month: 'short',
    }),
  }));

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="displayMonth"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Legend />
          <Bar
            dataKey="created"
            name={t('tasksAnalytics.created', 'Created')}
            fill="#3b82f6"
            opacity={0.6}
            radius={[4, 4, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="completed"
            name={t('tasksAnalytics.completed', 'Completed')}
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
