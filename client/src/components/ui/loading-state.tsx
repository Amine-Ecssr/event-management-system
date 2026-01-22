import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

interface LoadingStateProps {
  className?: string
  text?: string
  size?: "sm" | "md" | "lg"
  fullPage?: boolean
}

const sizeClasses = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
}

export function LoadingState({
  className,
  text,
  size = "md",
  fullPage = false,
}: LoadingStateProps) {
  const content = (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <Spinner className={cn(sizeClasses[size], "text-primary")} />
      {text && (
        <p className="text-sm text-muted-foreground animate-pulse">{text}</p>
      )}
    </div>
  )

  if (fullPage) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        {content}
      </div>
    )
  }

  return content
}

// For use in cards and smaller containers
export function CardLoadingState({ className, showHeader = false }: { className?: string; showHeader?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-6 animate-pulse", className)}>
      {showHeader && (
        <div className="space-y-2 mb-4">
          <div className="h-5 w-3/4 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
        </div>
      )}
      <div className="flex items-center justify-center py-4">
        <Spinner className="size-6 text-primary" />
      </div>
    </div>
  )
}

// Skeleton-based loading for lists
export function ListLoadingSkeleton({ count = 3, height = "h-auto" }: { count?: number; height?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-4 rounded-lg border p-4 animate-pulse",
            height !== "h-auto" && height
          )}
        >
          <div className="h-10 w-10 rounded-md bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
          <div className="h-8 w-20 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

// Table loading skeleton
export function TableLoadingSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <div className="rounded-md border">
      <div className="border-b bg-muted/50 p-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div
              key={i}
              className="h-4 flex-1 rounded bg-muted animate-pulse"
            />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="border-b p-4 last:border-0">
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                className="h-4 flex-1 rounded bg-muted/60 animate-pulse"
                style={{ animationDelay: `${(rowIndex + colIndex) * 100}ms` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Dashboard card skeleton
export function DashboardCardSkeleton() {
  return (
    <div className="rounded-lg border p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="h-7 w-16 rounded bg-muted" />
        </div>
        <div className="h-10 w-10 rounded-md bg-muted" />
      </div>
    </div>
  )
}
