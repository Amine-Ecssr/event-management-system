/**
 * Task Priority Chart Component
 * 
 * Horizontal bar chart showing task distribution by priority.
 * 
 * @module components/analytics/TaskPriorityChart
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
import type { TasksByPriority } from '@/types/analytics';

interface TaskPriorityChartProps {
  data: TasksByPriority[];
}

// Color mapping for task priorities
const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',    // red
  medium: '#f59e0b',  // amber
  low: '#10b981',     // emerald
};

// Display labels for priorities
const PRIORITY_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function TaskPriorityChart({ data }: TaskPriorityChartProps) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        {t('tasksAnalytics.noData', 'No data available')}
      </div>
    );
  }

  const chartData = data.map((item) => ({
    name: t(`tasksAnalytics.priority.${item.priority}`, PRIORITY_LABELS[item.priority] || item.priority),
    value: item.count,
    percentage: item.percentage,
    fill: PRIORITY_COLORS[item.priority] || '#94a3b8',
    priority: item.priority,
  }));

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis type="number" className="text-muted-foreground" />
          <YAxis 
            type="category" 
            dataKey="name" 
            width={80}
            className="text-muted-foreground"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            formatter={(value: number, name: string, entry: any) => [
              `${value} (${entry.payload.percentage}%)`,
              t('tasksAnalytics.tasks', 'Tasks'),
            ]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
