/**
 * Agreement Types Chart Component
 * 
 * Pie chart showing distribution of agreements by type.
 * 
 * @module components/analytics/AgreementTypesChart
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
import type { AgreementTypeData } from '@/types/analytics';

interface AgreementTypesChartProps {
  data: AgreementTypeData[];
}

// Color palette for pie chart segments
const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export function AgreementTypesChart({ data }: AgreementTypesChartProps) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        {t('partnershipsAnalytics.noData', 'No data available')}
      </div>
    );
  }

  const chartData = data.map((item, index) => ({
    name: item.type,
    value: item.count,
    percentage: item.percentage,
    fill: COLORS[index % COLORS.length],
  }));

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percentage }) => `${name}: ${percentage}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value} ${t('partnershipsAnalytics.agreements', 'agreements')}`,
              name,
            ]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
