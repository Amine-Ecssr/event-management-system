import * as React from "react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow, format } from "date-fns"
import { LucideIcon, Calendar, Clock, MapPin, Users, ChevronRight, MoreHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemContent,
  ItemMedia,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemGroup,
  ItemSeparator,
} from "@/components/ui/item"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Event Item Component
interface EventItemProps {
  title: string
  description?: string
  startDate: Date | string
  endDate?: Date | string
  location?: string
  category?: string
  status?: string
  imageUrl?: string
  onClick?: () => void
  actions?: Array<{
    label: string
    icon?: LucideIcon
    onClick: () => void
    variant?: "default" | "destructive"
  }>
  className?: string
}

export function EventItem({
  title,
  description,
  startDate,
  endDate,
  location,
  category,
  status,
  imageUrl,
  onClick,
  actions,
  className,
}: EventItemProps) {
  const start = typeof startDate === "string" ? new Date(startDate) : startDate
  const end = endDate ? (typeof endDate === "string" ? new Date(endDate) : endDate) : null

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "upcoming":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "ongoing":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "completed":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
      case "cancelled":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      default:
        return ""
    }
  }

  return (
    <Item
      variant="outline"
      className={cn("hover:bg-accent/50 transition-colors", className)}
      onClick={onClick}
    >
      {imageUrl && (
        <ItemMedia variant="image">
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        </ItemMedia>
      )}
      <ItemContent>
        <div className="flex items-start justify-between gap-2">
          <ItemTitle className="flex-1">
            {title}
            {status && (
              <Badge variant="outline" className={cn("ml-2", getStatusColor(status))}>
                {status}
              </Badge>
            )}
          </ItemTitle>
        </div>
        {description && (
          <ItemDescription className="line-clamp-2">{description}</ItemDescription>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-2">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(start, "MMM d, yyyy")}
            {end && ` - ${format(end, "MMM d, yyyy")}`}
          </span>
          {location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {location}
            </span>
          )}
          {category && (
            <Badge variant="secondary" className="text-xs">
              {category}
            </Badge>
          )}
        </div>
      </ItemContent>
      <ItemActions>
        {actions && actions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map((action, index) => (
                <React.Fragment key={action.label}>
                  {action.variant === "destructive" && index > 0 && (
                    <DropdownMenuSeparator />
                  )}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      action.onClick()
                    }}
                    className={action.variant === "destructive" ? "text-destructive" : ""}
                  >
                    {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                    {action.label}
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : onClick ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : null}
      </ItemActions>
    </Item>
  )
}

// Task Item Component
interface TaskItemProps {
  title: string
  description?: string
  dueDate?: Date | string | null
  status: "pending" | "in_progress" | "completed" | "cancelled" | "waiting"
  priority?: "low" | "medium" | "high"
  assignee?: {
    name: string
    avatar?: string
  }
  eventTitle?: string
  onClick?: () => void
  onStatusChange?: (status: string) => void
  actions?: Array<{
    label: string
    icon?: LucideIcon
    onClick: () => void
    variant?: "default" | "destructive"
  }>
  className?: string
}

export function TaskItem({
  title,
  description,
  dueDate,
  status,
  priority,
  assignee,
  eventTitle,
  onClick,
  onStatusChange,
  actions,
  className,
}: TaskItemProps) {
  const due = dueDate ? (typeof dueDate === "string" ? new Date(dueDate) : dueDate) : null
  const isOverdue = due && due < new Date() && status !== "completed" && status !== "cancelled"

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
      case "in_progress":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20"
      case "completed":
        return "bg-green-500/10 text-green-600 border-green-500/20"
      case "cancelled":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
      case "waiting":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20"
      default:
        return ""
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "high":
        return "text-red-500"
      case "medium":
        return "text-yellow-500"
      case "low":
        return "text-green-500"
      default:
        return ""
    }
  }

  return (
    <Item
      variant="outline"
      className={cn(
        "hover:bg-accent/50 transition-colors",
        isOverdue && "border-red-500/30 bg-red-500/5",
        className
      )}
      onClick={onClick}
    >
      <ItemContent>
        <div className="flex items-start justify-between gap-2">
          <ItemTitle className="flex-1">
            {title}
            <Badge variant="outline" className={cn("ml-2", getStatusColor(status))}>
              {status.replace("_", " ")}
            </Badge>
            {priority && (
              <span className={cn("ml-2 text-xs font-medium", getPriorityColor(priority))}>
                {priority}
              </span>
            )}
          </ItemTitle>
        </div>
        {description && (
          <ItemDescription className="line-clamp-2">{description}</ItemDescription>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-2">
          {due && (
            <span className={cn("flex items-center gap-1", isOverdue && "text-red-500 font-medium")}>
              <Clock className="h-3 w-3" />
              {isOverdue ? "Overdue: " : "Due: "}
              {formatDistanceToNow(due, { addSuffix: true })}
            </span>
          )}
          {eventTitle && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {eventTitle}
            </span>
          )}
          {assignee && (
            <span className="flex items-center gap-1">
              <Avatar className="h-4 w-4">
                <AvatarImage src={assignee.avatar} />
                <AvatarFallback className="text-[8px]">
                  {assignee.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {assignee.name}
            </span>
          )}
        </div>
      </ItemContent>
      <ItemActions>
        {actions && actions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map((action, index) => (
                <React.Fragment key={action.label}>
                  {action.variant === "destructive" && index > 0 && (
                    <DropdownMenuSeparator />
                  )}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      action.onClick()
                    }}
                    className={action.variant === "destructive" ? "text-destructive" : ""}
                  >
                    {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                    {action.label}
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : onClick ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : null}
      </ItemActions>
    </Item>
  )
}

// Contact Item Component
interface ContactItemProps {
  name: string
  email?: string
  phone?: string
  organization?: string
  role?: string
  avatar?: string
  onClick?: () => void
  actions?: Array<{
    label: string
    icon?: LucideIcon
    onClick: () => void
    variant?: "default" | "destructive"
  }>
  className?: string
}

export function ContactItem({
  name,
  email,
  phone,
  organization,
  role,
  avatar,
  onClick,
  actions,
  className,
}: ContactItemProps) {
  return (
    <Item
      variant="outline"
      className={cn("hover:bg-accent/50 transition-colors", className)}
      onClick={onClick}
    >
      <ItemMedia variant="default">
        <Avatar className="h-10 w-10">
          <AvatarImage src={avatar} alt={name} />
          <AvatarFallback>
            {name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          {name}
          {role && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {role}
            </Badge>
          )}
        </ItemTitle>
        <ItemDescription>
          {organization && <span>{organization}</span>}
          {organization && email && <span className="mx-1">•</span>}
          {email && <span>{email}</span>}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {actions && actions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map((action, index) => (
                <React.Fragment key={action.label}>
                  {action.variant === "destructive" && index > 0 && (
                    <DropdownMenuSeparator />
                  )}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      action.onClick()
                    }}
                    className={action.variant === "destructive" ? "text-destructive" : ""}
                  >
                    {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                    {action.label}
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : onClick ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : null}
      </ItemActions>
    </Item>
  )
}

// Generic list wrapper
interface ItemListProps {
  children: React.ReactNode
  withSeparators?: boolean
  className?: string
}

export function ItemList({ children, withSeparators = false, className }: ItemListProps) {
  const childArray = React.Children.toArray(children)

  if (!withSeparators) {
    return <ItemGroup className={cn("gap-2", className)}>{children}</ItemGroup>
  }

  return (
    <ItemGroup className={className}>
      {childArray.map((child, index) => (
        <React.Fragment key={index}>
          {child}
          {index < childArray.length - 1 && <ItemSeparator />}
        </React.Fragment>
      ))}
    </ItemGroup>
  )
}
