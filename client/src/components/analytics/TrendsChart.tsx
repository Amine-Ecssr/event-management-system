/**
 * Trends Chart Component
 * 
 * Displays activity trends over time using area charts.
 * 
 * @module components/analytics/TrendsChart
 */

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import type { ActivityTrends } from "@/types/analytics";

interface TrendsChartProps {
  /** Activity trends data */
  data: ActivityTrends;
  /** Optional title */
  title?: string;
  /** Chart height in pixels */
  height?: number;
  /** Additional CSS classes */
  className?: string;
}

// Chart colors
const COLORS = {
  events: "#3b82f6", // blue-500
  tasks: "#22c55e", // green-500
  partnerships: "#f59e0b", // amber-500
  contacts: "#8b5cf6", // violet-500
};

/**
 * Merges multiple trend arrays into a single dataset for the chart
 */
function mergeActivityData(data: ActivityTrends) {
  const dateMap = new Map<string, {
    date: string;
    events?: number;
    tasks?: number;
    partnerships?: number;
    contacts?: number;
  }>();

  // Process each entity type
  data.events?.forEach(d => {
    const existing = dateMap.get(d.date) || { date: d.date };
    existing.events = d.value;
    dateMap.set(d.date, existing);
  });

  data.tasks?.forEach(d => {
    const existing = dateMap.get(d.date) || { date: d.date };
    existing.tasks = d.value;
    dateMap.set(d.date, existing);
  });

  data.partnerships?.forEach(d => {
    const existing = dateMap.get(d.date) || { date: d.date };
    existing.partnerships = d.value;
    dateMap.set(d.date, existing);
  });

  data.contacts?.forEach(d => {
    const existing = dateMap.get(d.date) || { date: d.date };
    existing.contacts = d.value;
    dateMap.set(d.date, existing);
  });

  // Sort by date
  return Array.from(dateMap.values()).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

/**
 * Activity Trends Chart component
 */
export function TrendsChart({
  data,
  title,
  height = 300,
  className,
}: TrendsChartProps) {
  const { t } = useTranslation();

  const chartData = useMemo(() => mergeActivityData(data), [data]);

  const formatDate = (value: string) => {
    const date = new Date(value);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title || t("analytics.charts.activityTrends")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.events} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS.events} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.tasks} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS.tasks} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPartnerships" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.partnerships} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS.partnerships} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorContacts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.contacts} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS.contacts} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <Tooltip 
              labelFormatter={formatDate}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="events"
              name={t("analytics.entities.events")}
              stroke={COLORS.events}
              fillOpacity={1}
              fill="url(#colorEvents)"
            />
            <Area
              type="monotone"
              dataKey="tasks"
              name={t("analytics.entities.tasks")}
              stroke={COLORS.tasks}
              fillOpacity={1}
              fill="url(#colorTasks)"
            />
            <Area
              type="monotone"
              dataKey="partnerships"
              name={t("analytics.entities.partnerships")}
              stroke={COLORS.partnerships}
              fillOpacity={1}
              fill="url(#colorPartnerships)"
            />
            <Area
              type="monotone"
              dataKey="contacts"
              name={t("analytics.entities.contacts")}
              stroke={COLORS.contacts}
              fillOpacity={1}
              fill="url(#colorContacts)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for Trends Chart
 */
export function TrendsChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-40 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div 
          className="bg-muted animate-pulse rounded" 
          style={{ height: `${height}px` }}
        />
      </CardContent>
    </Card>
  );
}

export default TrendsChart;
