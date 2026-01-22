import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("flex flex-col min-h-full", className)}>
      {children}
    </div>
  )
}

interface PageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  backHref?: string
  onBack?: () => void
  actions?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  backHref,
  onBack,
  actions,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn("sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60", className)}>
      <div className="px-6 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {(backHref || onBack) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onBack}
                asChild={!!backHref}
              >
                {backHref ? (
                  <a href={backHref}>
                    <ChevronLeft className="h-4 w-4" />
                  </a>
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            )}
            {Icon && (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
        {children}
      </div>
      <Separator />
    </div>
  )
}

interface PageContentProps {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export function PageContent({
  children,
  className,
  noPadding = false,
}: PageContentProps) {
  return (
    <div className={cn("flex-1", !noPadding && "p-6", className)}>
      {children}
    </div>
  )
}

interface PageSectionProps {
  title?: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function PageSection({
  title,
  description,
  actions,
  children,
  className,
}: PageSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || description || actions) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && (
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

// A card-style section
interface ContentCardProps {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export function ContentCard({
  children,
  className,
  noPadding = false,
}: ContentCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        !noPadding && "p-6",
        className
      )}
    >
      {children}
    </div>
  )
}
