import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { ReactNode, isValidElement } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type StatCardVariant = "default" | "success" | "warning" | "danger" | "info"

const variantStyles: Record<StatCardVariant, { icon: string; text: string }> = {
  default: {
    icon: "bg-primary/10",
    text: "text-primary",
  },
  success: {
    icon: "bg-green-500/10",
    text: "text-green-600 dark:text-green-400",
  },
  warning: {
    icon: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
  },
  danger: {
    icon: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
  },
  info: {
    icon: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
  },
}

interface StatCardProps {
  title: string
  value: number | string
  icon: LucideIcon | ReactNode
  description?: string
  trend?: {
    value: number
    label?: string
  }
  loading?: boolean
  className?: string
  iconClassName?: string
  onClick?: () => void
  variant?: StatCardVariant
}

export function StatCard({
  title,
  value,
  icon,
  description,
  trend,
  loading = false,
  className,
  iconClassName,
  onClick,
  variant = "default",
}: StatCardProps) {
  const TrendIcon = trend
    ? trend.value > 0
      ? TrendingUp
      : trend.value < 0
        ? TrendingDown
        : Minus
    : null

  const trendColor = trend
    ? trend.value > 0
      ? "text-green-600 dark:text-green-400"
      : trend.value < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground"
    : ""

  const styles = variantStyles[variant]

  // Render icon - support both LucideIcon component and ReactNode
  const renderIcon = () => {
    // If it's already a valid React element (JSX), render it directly
    if (isValidElement(icon)) {
      return icon;
    }
    // Otherwise, treat it as a component and render it
    const IconComponent = icon as LucideIcon;
    return <IconComponent className={cn("h-5 w-5", styles.text)} />;
  };

  if (loading) {
    return (
      <Card className={cn("relative overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20 mb-1" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-md hover:border-primary/20",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            styles.icon,
            iconClassName
          )}
        >
          {renderIcon()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <p className={cn("text-2xl font-bold tracking-tight", variant !== "default" && styles.text)}>{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {trend && TrendIcon && (
            <div className={cn("flex items-center gap-1 text-xs", trendColor)}>
              <TrendIcon className="h-3 w-3" />
              <span>{Math.abs(trend.value)}%</span>
              {trend.label && (
                <span className="text-muted-foreground">{trend.label}</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Grid of stat cards
interface StatsGridProps {
  children: React.ReactNode
  columns?: 2 | 3 | 4 | 5
  className?: string
}

export function StatsGrid({
  children,
  columns = 4,
  className,
}: StatsGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5",
  }

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {children}
    </div>
  )
}

// Mini stat for sidebars or compact views
export function MiniStat({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string
  value: number | string
  icon?: LucideIcon
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2",
        className
      )}
    >
      {Icon && (
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div>
        <p className="text-lg font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
