/**
 * Events Chart Component
 * 
 * Displays event statistics using pie/donut and bar charts.
 * 
 * @module components/analytics/EventsChart
 */

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import type { CategoryStats, EventTypeStats, MonthlyStats } from "@/types/analytics";

// Color palette for charts
const PIE_COLORS = [
  "#3b82f6", // blue-500
  "#22c55e", // green-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
];

interface EventsByCategoryChartProps {
  /** Category statistics data */
  data: CategoryStats[];
  /** Chart title */
  title?: string;
  /** Chart height in pixels */
  height?: number;
}

/**
 * Events by Category Pie Chart
 */
export function EventsByCategoryChart({
  data,
  title,
  height = 300,
}: EventsByCategoryChartProps) {
  const { t } = useTranslation();

  const chartData = useMemo(() => 
    data.map(item => ({
      name: item.category,
      value: item.count,
    })),
    [data]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || t("analytics.charts.eventsByCategory")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => 
                `${name} (${(percent * 100).toFixed(0)}%)`
              }
              labelLine={false}
            >
              {chartData.map((_, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={PIE_COLORS[index % PIE_COLORS.length]} 
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface EventsByTypeChartProps {
  /** Event type statistics data */
  data: EventTypeStats[];
  /** Chart title */
  title?: string;
  /** Chart height in pixels */
  height?: number;
}

/**
 * Events by Type Bar Chart
 */
export function EventsByTypeChart({
  data,
  title,
  height = 300,
}: EventsByTypeChartProps) {
  const { t } = useTranslation();

  const chartData = useMemo(() => 
    data.map(item => ({
      name: item.eventType,
      value: item.count,
    })),
    [data]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || t("analytics.charts.eventsByType")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" />
            <YAxis 
              type="category" 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              width={90}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar 
              dataKey="value" 
              fill="#3b82f6"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface EventsByMonthChartProps {
  /** Monthly statistics data */
  data: MonthlyStats[];
  /** Chart title */
  title?: string;
  /** Chart height in pixels */
  height?: number;
}

/**
 * Events by Month Bar Chart with year comparison
 */
export function EventsByMonthChart({
  data,
  title,
  height = 300,
}: EventsByMonthChartProps) {
  const { t } = useTranslation();

  const chartData = useMemo(() => 
    data.map(item => ({
      name: item.month,
      current: item.count,
      previous: item.previousYearCount || 0,
    })),
    [data]
  );

  const hasComparison = data.some(d => d.previousYearCount !== undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || t("analytics.charts.eventsByMonth")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            {hasComparison && <Legend />}
            <Bar 
              dataKey="current" 
              name={t("analytics.charts.currentYear")}
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
            />
            {hasComparison && (
              <Bar 
                dataKey="previous" 
                name={t("analytics.charts.previousYear")}
                fill="#94a3b8"
                radius={[4, 4, 0, 0]}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface EventsChartProps {
  /** Category statistics */
  categoryData?: CategoryStats[];
  /** Event type statistics */
  typeData?: EventTypeStats[];
  /** Monthly statistics */
  monthlyData?: MonthlyStats[];
  /** Default active tab */
  defaultTab?: string;
  /** Chart height */
  height?: number;
}

/**
 * Combined Events Chart with tabs
 */
export function EventsChart({
  categoryData,
  typeData,
  monthlyData,
  defaultTab = "category",
  height = 300,
}: EventsChartProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("analytics.charts.eventsOverview")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-4">
            {categoryData && (
              <TabsTrigger value="category">{t("analytics.tabs.byCategory")}</TabsTrigger>
            )}
            {typeData && (
              <TabsTrigger value="type">{t("analytics.tabs.byType")}</TabsTrigger>
            )}
            {monthlyData && (
              <TabsTrigger value="monthly">{t("analytics.tabs.byMonth")}</TabsTrigger>
            )}
          </TabsList>
          
          {categoryData && (
            <TabsContent value="category">
              <ResponsiveContainer width="100%" height={height}>
                <PieChart>
                  <Pie
                    data={categoryData.map(d => ({ name: d.category, value: d.count }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </TabsContent>
          )}
          
          {typeData && (
            <TabsContent value="type">
              <ResponsiveContainer width="100%" height={height}>
                <BarChart 
                  data={typeData.map(d => ({ name: d.eventType, value: d.count }))} 
                  layout="vertical" 
                  margin={{ left: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={90} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
          )}
          
          {monthlyData && (
            <TabsContent value="monthly">
              <ResponsiveContainer width="100%" height={height}>
                <BarChart data={monthlyData.map(d => ({ name: d.month, value: d.count }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default EventsChart;
