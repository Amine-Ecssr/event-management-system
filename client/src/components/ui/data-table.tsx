import * as React from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileQuestion,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface Column<T> {
  key: string
  header: string | React.ReactNode
  cell: (row: T) => React.ReactNode
  sortable?: boolean
  className?: string
  headerClassName?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  pagination?: {
    currentPage: number
    totalPages: number
    pageSize: number
    totalItems: number
    onPageChange: (page: number) => void
    onPageSizeChange?: (size: number) => void
  }
  sorting?: {
    column: string | null
    direction: "asc" | "desc"
    onSort: (column: string) => void
  }
  emptyState?: {
    title: string
    description?: string
    action?: {
      label: string
      onClick: () => void
    }
  }
  className?: string
  rowClassName?: string | ((row: T, index: number) => string)
  onRowClick?: (row: T) => void
}

export function DataTable<T extends { id?: number | string }>({
  data,
  columns,
  loading = false,
  searchable = false,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  pagination,
  sorting,
  emptyState,
  className,
  rowClassName,
  onRowClick,
}: DataTableProps<T>) {
  const { t } = useTranslation()

  const getSortIcon = (columnKey: string) => {
    if (!sorting || sorting.column !== columnKey) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    return sorting.direction === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    )
  }

  const renderContent = () => {
    if (loading) {
      return (
        <TableRow>
          <TableCell colSpan={columns.length} className="h-48">
            <div className="flex items-center justify-center">
              <Spinner className="h-8 w-8" />
            </div>
          </TableCell>
        </TableRow>
      )
    }

    if (data.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={columns.length} className="h-48">
            {emptyState ? (
              <EmptyState
                icon={FileQuestion}
                title={emptyState.title}
                description={emptyState.description}
                action={emptyState.action}
              />
            ) : (
              <div className="flex items-center justify-center text-muted-foreground">
                {t("common.noData")}
              </div>
            )}
          </TableCell>
        </TableRow>
      )
    }

    return data.map((row, index) => {
      const rowKey = row.id ?? index
      const computedRowClassName =
        typeof rowClassName === "function"
          ? rowClassName(row, index)
          : rowClassName

      return (
        <TableRow
          key={rowKey}
          className={cn(
            onRowClick && "cursor-pointer",
            computedRowClassName
          )}
          onClick={() => onRowClick?.(row)}
        >
          {columns.map((column) => (
            <TableCell key={column.key} className={column.className}>
              {column.cell(row)}
            </TableCell>
          ))}
        </TableRow>
      )
    })
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search bar */}
      {searchable && onSearchChange && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder || t("common.search")}
            value={searchValue || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.sortable && "cursor-pointer select-none",
                    column.headerClassName
                  )}
                  onClick={() =>
                    column.sortable && sorting?.onSort(column.key)
                  }
                >
                  <div className="flex items-center">
                    {column.header}
                    {column.sortable && getSortIcon(column.key)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>{renderContent()}</TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 0 && (
        <DataTablePagination {...pagination} />
      )}
    </div>
  )
}

interface PaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
}

function DataTablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const { t } = useTranslation()

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="flex flex-col gap-4 px-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        {t("pagination.showing", {
          start: startItem,
          end: endItem,
          total: totalItems,
        })}
      </div>

      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {t("pagination.rowsPerPage")}
            </span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 30, 50, 100].map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="px-2 text-sm">
            {t("pagination.page", { current: currentPage, total: totalPages })}
          </span>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export { DataTablePagination }
