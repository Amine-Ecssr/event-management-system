/**
 * KPI Card Component
 * 
 * Displays a key performance indicator with icon, value, and trend.
 * 
 * @module components/analytics/KPICard
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, LucideIcon } from "lucide-react";
import type { TrendDirection, KPITrend } from "@/types/analytics";

interface KPICardProps {
  /** Card title/label */
  title: string;
  /** Primary value to display */
  value: number | string;
  /** Optional icon component */
  icon?: LucideIcon;
  /** Color theme for the icon */
  iconColor?: string;
  /** Background color for the icon */
  iconBgColor?: string;
  /** Trend data for change indicator */
  trend?: KPITrend;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Format value as percentage */
  isPercentage?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays the trend indicator with arrow and percentage
 */
function TrendIndicator({ trend }: { trend: KPITrend }) {
  const Icon = trend.direction === 'up' 
    ? TrendingUp 
    : trend.direction === 'down' 
    ? TrendingDown 
    : Minus;

  const colorClass = trend.direction === 'up'
    ? 'text-green-600 dark:text-green-400'
    : trend.direction === 'down'
    ? 'text-red-600 dark:text-red-400'
    : 'text-gray-500 dark:text-gray-400';

  return (
    <div className={cn("flex items-center gap-1 text-sm font-medium", colorClass)}>
      <Icon className="h-4 w-4" />
      <span>{Math.abs(trend.value).toFixed(1)}%</span>
    </div>
  );
}

/**
 * KPI Card component for displaying key metrics
 */
export function KPICard({
  title,
  value,
  icon: Icon,
  iconColor = "text-primary",
  iconBgColor = "bg-primary/10",
  trend,
  subtitle,
  isPercentage = false,
  className,
}: KPICardProps) {
  const formattedValue = typeof value === 'number'
    ? isPercentage 
      ? `${value.toFixed(1)}%`
      : value.toLocaleString()
    : value;

  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div className={cn("p-2 rounded-lg", iconBgColor)}>
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-2xl font-bold">{formattedValue}</div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {trend && <TrendIndicator trend={trend} />}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for KPI Card
 */
export function KPICardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
        <div className="h-8 w-8 bg-muted animate-pulse rounded-lg" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-20 bg-muted animate-pulse rounded mb-2" />
        <div className="h-3 w-32 bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

export default KPICard;
