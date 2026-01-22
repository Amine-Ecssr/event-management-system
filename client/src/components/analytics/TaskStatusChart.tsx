/**
 * Task Status Chart Component
 * 
 * Pie/Donut chart showing task distribution by status.
 * 
 * @module components/analytics/TaskStatusChart
 */

import { useTranslation } from 'react-i18next';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import type { TasksByStatus } from '@/types/analytics';

interface TaskStatusChartProps {
  data: TasksByStatus[];
}

// Color mapping for task statuses
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',    // amber
  in_progress: '#3b82f6', // blue
  completed: '#10b981',   // emerald
  cancelled: '#6b7280',   // gray
  waiting: '#8b5cf6',     // violet
};

// Display labels for statuses
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  waiting: 'Waiting',
};

export function TaskStatusChart({ data }: TaskStatusChartProps) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        {t('tasksAnalytics.noData', 'No data available')}
      </div>
    );
  }

  const chartData = data.map((item) => ({
    name: t(`tasksAnalytics.status.${item.status}`, STATUS_LABELS[item.status] || item.status),
    value: item.count,
    percentage: item.percentage,
    fill: STATUS_COLORS[item.status] || '#94a3b8',
  }));

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            fill="#8884d8"
            paddingAngle={2}
            dataKey="value"
            label={({ name, percentage }) => `${name}: ${percentage}%`}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value} ${t('tasksAnalytics.tasks', 'tasks')}`,
              name,
            ]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
