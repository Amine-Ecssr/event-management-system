import { LucideIcon, FileQuestion, FolderOpen, SearchX, Calendar, Users, ListTodo, FileText } from "lucide-react"
import { ReactNode, isValidElement } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon | ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: LucideIcon
  } | ReactNode
  className?: string
  variant?: "default" | "bordered" | "muted"
}

export function EmptyState({
  icon: IconProp = FileQuestion,
  title,
  description,
  action,
  className,
  variant = "default",
}: EmptyStateProps) {
  // Render icon - support both LucideIcon component and ReactNode (JSX)
  const renderIcon = () => {
    // If it's already a valid React element (JSX), render it directly
    if (isValidElement(IconProp)) {
      return IconProp;
    }
    // Otherwise, treat it as a component and render it
    const Icon = IconProp as LucideIcon;
    return <Icon className="size-5 text-muted-foreground" />;
  };

  // Render action - support both action object and ReactNode
  const renderAction = () => {
    if (!action) return null;
    
    // If it's a valid React element, render it directly
    if (isValidElement(action)) {
      return <EmptyContent>{action}</EmptyContent>;
    }
    
    // Check if it's an action object with label and onClick
    if (typeof action === 'object' && action !== null && 'label' in action && 'onClick' in action) {
      const actionObj = action as { label: string; onClick: () => void; icon?: LucideIcon };
      const ActionIcon = actionObj.icon;
      return (
        <EmptyContent>
          <Button onClick={actionObj.onClick} variant="default">
            {ActionIcon && <ActionIcon className="mr-2 size-4" />}
            {actionObj.label}
          </Button>
        </EmptyContent>
      );
    }
    
    return null;
  };

  return (
    <Empty
      className={cn(
        variant === "bordered" && "border",
        variant === "muted" && "bg-muted/30",
        className
      )}
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {renderIcon()}
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {renderAction()}
    </Empty>
  )
}

// Pre-configured empty states for common scenarios
export function NoEventsEmptyState({
  onAction,
  showAction = true,
}: {
  onAction?: () => void
  showAction?: boolean
}) {
  const { t } = useTranslation()
  return (
    <EmptyState
      icon={Calendar}
      title={t("events.noEventsFound")}
      description={t("events.noEventsDescription")}
      action={
        showAction && onAction
          ? {
              label: t("events.addNewEvent"),
              onClick: onAction,
              icon: Calendar,
            }
          : undefined
      }
      variant="bordered"
    />
  )
}

export function NoTasksEmptyState({
  onAction,
  showAction = true,
}: {
  onAction?: () => void
  showAction?: boolean
}) {
  const { t } = useTranslation()
  return (
    <EmptyState
      icon={ListTodo}
      title={t("tasks.noTasksFound")}
      description={t("tasks.noTasksDescription")}
      action={
        showAction && onAction
          ? {
              label: t("tasks.createTask"),
              onClick: onAction,
              icon: ListTodo,
            }
          : undefined
      }
      variant="bordered"
    />
  )
}

export function NoContactsEmptyState({
  onAction,
  showAction = true,
}: {
  onAction?: () => void
  showAction?: boolean
}) {
  const { t } = useTranslation()
  return (
    <EmptyState
      icon={Users}
      title={t("contacts.noContactsFound")}
      description={t("contacts.noContactsDescription")}
      action={
        showAction && onAction
          ? {
              label: t("contacts.addContact"),
              onClick: onAction,
              icon: Users,
            }
          : undefined
      }
      variant="bordered"
    />
  )
}

export function NoSearchResultsEmptyState({
  searchTerm,
}: {
  searchTerm?: string
}) {
  const { t } = useTranslation()
  return (
    <EmptyState
      icon={SearchX}
      title={t("search.noResults")}
      description={
        searchTerm
          ? t("search.noResultsFor", { term: searchTerm })
          : t("search.tryDifferentSearch")
      }
      variant="muted"
    />
  )
}

export function NoFilesEmptyState({
  onAction,
  showAction = true,
}: {
  onAction?: () => void
  showAction?: boolean
}) {
  const { t } = useTranslation()
  return (
    <EmptyState
      icon={FolderOpen}
      title={t("files.noFilesFound")}
      description={t("files.noFilesDescription")}
      action={
        showAction && onAction
          ? {
              label: t("files.uploadFile"),
              onClick: onAction,
              icon: FileText,
            }
          : undefined
      }
      variant="bordered"
    />
  )
}

export function NoDataEmptyState({
  title,
  description,
}: {
  title?: string
  description?: string
}) {
  const { t } = useTranslation()
  return (
    <EmptyState
      icon={FileQuestion}
      title={title || t("common.noData")}
      description={description || t("common.noDataDescription")}
      variant="muted"
    />
  )
}
