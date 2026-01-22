/**
 * Tasks Chart Component
 * 
 * Displays task statistics using pie and bar charts.
 * 
 * @module components/analytics/TasksChart
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
import type { StatusStats, PriorityStats, DepartmentStats, CompletionRate } from "@/types/analytics";

// Status colors
const STATUS_COLORS: Record<string, string> = {
  completed: "#22c55e", // green-500
  "in-progress": "#3b82f6", // blue-500
  pending: "#f59e0b", // amber-500
  blocked: "#ef4444", // red-500
  cancelled: "#6b7280", // gray-500
  default: "#94a3b8", // slate-400
};

// Priority colors
const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444", // red-500
  high: "#f97316", // orange-500
  medium: "#f59e0b", // amber-500
  low: "#22c55e", // green-500
  default: "#94a3b8", // slate-400
};

interface TasksByStatusChartProps {
  /** Status statistics data */
  data: StatusStats[];
  /** Chart title */
  title?: string;
  /** Chart height in pixels */
  height?: number;
}

/**
 * Tasks by Status Pie Chart
 */
export function TasksByStatusChart({
  data,
  title,
  height = 300,
}: TasksByStatusChartProps) {
  const { t } = useTranslation();

  const chartData = useMemo(() => 
    data.map(item => ({
      name: item.status,
      value: item.count,
      fill: STATUS_COLORS[item.status.toLowerCase()] || STATUS_COLORS.default,
    })),
    [data]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || t("analytics.charts.tasksByStatus")}</CardTitle>
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
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
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

interface TasksByPriorityChartProps {
  /** Priority statistics data */
  data: PriorityStats[];
  /** Chart title */
  title?: string;
  /** Chart height in pixels */
  height?: number;
}

/**
 * Tasks by Priority Bar Chart
 */
export function TasksByPriorityChart({
  data,
  title,
  height = 300,
}: TasksByPriorityChartProps) {
  const { t } = useTranslation();

  const chartData = useMemo(() => 
    data.map(item => ({
      name: item.priority,
      value: item.count,
      fill: PRIORITY_COLORS[item.priority.toLowerCase()] || PRIORITY_COLORS.default,
    })),
    [data]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || t("analytics.charts.tasksByPriority")}</CardTitle>
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
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface TasksByDepartmentChartProps {
  /** Department statistics data */
  data: DepartmentStats[];
  /** Chart title */
  title?: string;
  /** Chart height in pixels */
  height?: number;
}

/**
 * Tasks by Department Horizontal Bar Chart
 */
export function TasksByDepartmentChart({
  data,
  title,
  height = 300,
}: TasksByDepartmentChartProps) {
  const { t } = useTranslation();

  const chartData = useMemo(() => 
    data.slice(0, 10).map(item => ({
      name: item.departmentName,
      count: item.count,
      completionRate: item.completionRate || 0,
    })),
    [data]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || t("analytics.charts.tasksByDepartment")}</CardTitle>
      </CardHeader>
      <CardContent>
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
            />
            <Legend />
            <Bar 
              dataKey="count" 
              name={t("analytics.charts.taskCount")}
              fill="#3b82f6"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface CompletionRateChartProps {
  /** Completion rate data */
  data: CompletionRate;
  /** Chart title */
  title?: string;
  /** Chart height in pixels */
  height?: number;
}

/**
 * Task Completion Rate Chart
 */
export function CompletionRateChart({
  data,
  title,
  height = 300,
}: CompletionRateChartProps) {
  const { t } = useTranslation();

  const chartData = useMemo(() => 
    data.byPeriod.map(item => ({
      name: item.period,
      rate: item.rate,
      completed: item.completed,
      total: item.total,
    })),
    [data]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title || t("analytics.charts.completionRate")}
          <span className="ms-2 text-sm font-normal text-muted-foreground">
            ({t("analytics.charts.overallRate")}: {data.rate.toFixed(1)}%)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis 
              tick={{ fontSize: 12 }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, t("analytics.charts.completionRate")]}
            />
            <Bar 
              dataKey="rate" 
              fill="#22c55e"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface TasksChartProps {
  /** Status statistics */
  statusData?: StatusStats[];
  /** Priority statistics */
  priorityData?: PriorityStats[];
  /** Department statistics */
  departmentData?: DepartmentStats[];
  /** Completion rate data */
  completionData?: CompletionRate;
  /** Default active tab */
  defaultTab?: string;
  /** Chart height */
  height?: number;
}

/**
 * Combined Tasks Chart with tabs
 */
export function TasksChart({
  statusData,
  priorityData,
  departmentData,
  completionData,
  defaultTab = "status",
  height = 300,
}: TasksChartProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("analytics.charts.tasksOverview")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-4">
            {statusData && (
              <TabsTrigger value="status">{t("analytics.tabs.byStatus")}</TabsTrigger>
            )}
            {priorityData && (
              <TabsTrigger value="priority">{t("analytics.tabs.byPriority")}</TabsTrigger>
            )}
            {departmentData && (
              <TabsTrigger value="department">{t("analytics.tabs.byDepartment")}</TabsTrigger>
            )}
            {completionData && (
              <TabsTrigger value="completion">{t("analytics.tabs.completion")}</TabsTrigger>
            )}
          </TabsList>
          
          {statusData && (
            <TabsContent value="status">
              <ResponsiveContainer width="100%" height={height}>
                <PieChart>
                  <Pie
                    data={statusData.map(d => ({ 
                      name: d.status, 
                      value: d.count,
                      fill: STATUS_COLORS[d.status.toLowerCase()] || STATUS_COLORS.default,
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {statusData.map((d, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={STATUS_COLORS[d.status.toLowerCase()] || STATUS_COLORS.default} 
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
            </TabsContent>
          )}
          
          {priorityData && (
            <TabsContent value="priority">
              <ResponsiveContainer width="100%" height={height}>
                <BarChart data={priorityData.map(d => ({ 
                  name: d.priority, 
                  value: d.count,
                  fill: PRIORITY_COLORS[d.priority.toLowerCase()] || PRIORITY_COLORS.default,
                }))}>
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
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {priorityData.map((d, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={PRIORITY_COLORS[d.priority.toLowerCase()] || PRIORITY_COLORS.default} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
          )}
          
          {departmentData && (
            <TabsContent value="department">
              <ResponsiveContainer width="100%" height={height}>
                <BarChart 
                  data={departmentData.slice(0, 10).map(d => ({ 
                    name: d.departmentName, 
                    value: d.count 
                  }))} 
                  layout="vertical" 
                  margin={{ left: 120 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
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
          
          {completionData && (
            <TabsContent value="completion">
              <ResponsiveContainer width="100%" height={height}>
                <BarChart data={completionData.byPeriod.map(d => ({ 
                  name: d.period, 
                  rate: d.rate 
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, t("analytics.charts.rate")]}
                  />
                  <Bar dataKey="rate" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default TasksChart;
