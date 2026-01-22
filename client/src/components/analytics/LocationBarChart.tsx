/**
 * Location Bar Chart Component
 * 
 * Horizontal bar chart showing events by location.
 * 
 * @module components/analytics/LocationBarChart
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslation } from 'react-i18next';

interface LocationStat {
  location: string;
  eventCount: number;
  totalAttendees: number;
}

interface LocationBarChartProps {
  data: LocationStat[];
  height?: number;
}

/**
 * Location statistics bar chart
 */
export function LocationBarChart({ data, height = 300 }: LocationBarChartProps) {
  const { t } = useTranslation('analytics');

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {t('locationChart.noData')}
      </div>
    );
  }

  const chartData = data.map(d => ({
    name: d.location.length > 25 ? d.location.substring(0, 22) + '...' : d.location,
    fullName: d.location,
    events: d.eventCount,
    attendees: d.totalAttendees,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" />
        <YAxis 
          type="category" 
          dataKey="name" 
          tick={{ fontSize: 12 }}
          width={110}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
          formatter={(value: number, name: string) => [
            value,
            name === 'events' ? t('locationChart.events') : t('locationChart.attendees')
          ]}
          labelFormatter={(label, payload) => {
            const item = payload?.[0]?.payload;
            return item?.fullName || label;
          }}
        />
        <Bar 
          dataKey="events" 
          fill="#3b82f6"
          radius={[0, 4, 4, 0]}
          name="events"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default LocationBarChart;
