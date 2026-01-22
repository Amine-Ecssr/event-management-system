/**
 * Workload Distribution Chart Component
 * 
 * Treemap/Bar chart showing workload distribution across departments.
 * 
 * @module components/analytics/WorkloadChart
 */

import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { WorkloadDistribution } from '@/types/analytics';

interface WorkloadChartProps {
  data: WorkloadDistribution[];
}

// Color palette for departments
const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#6366f1', // indigo
  '#f97316', // orange
];

export function WorkloadChart({ data }: WorkloadChartProps) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-muted-foreground">
        {t('tasksAnalytics.noWorkloadData', 'No workload data available')}
      </div>
    );
  }

  const chartData = data.map((item, index) => ({
    name: item.departmentName,
    value: item.taskCount,
    percentage: item.percentage,
    fill: COLORS[index % COLORS.length],
  }));

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            interval={0}
            tick={{ fontSize: 11 }}
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
            formatter={(value: number, name: string, entry: any) => [
              `${value} ${t('tasksAnalytics.activeTasks', 'active tasks')} (${entry.payload.percentage}%)`,
              entry.payload.name,
            ]}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
