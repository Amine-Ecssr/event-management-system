/**
 * Department Table Component
 * 
 * Displays department performance metrics in a sortable table.
 * 
 * @module components/analytics/DepartmentTable
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { DepartmentPerformance } from "@/types/analytics";

interface DepartmentTableProps {
  /** Department performance data */
  data: DepartmentPerformance[];
  /** Table title */
  title?: string;
  /** Additional CSS classes */
  className?: string;
}

type SortField = "departmentName" | "eventsCount" | "tasksCompleted" | "tasksPending" | "completionRate";
type SortDirection = "asc" | "desc";

/**
 * Get badge variant based on completion rate
 */
function getCompletionBadgeVariant(rate: number): "default" | "secondary" | "destructive" | "outline" {
  if (rate >= 80) return "default"; // green
  if (rate >= 60) return "secondary"; // yellow
  if (rate >= 40) return "outline"; // gray
  return "destructive"; // red
}

/**
 * Sort icon component
 */
function SortIcon({ field, sortField, sortDirection }: { 
  field: SortField; 
  sortField: SortField;
  sortDirection: SortDirection;
}) {
  if (sortField !== field) {
    return <ArrowUpDown className="ms-1 h-4 w-4" />;
  }
  return sortDirection === "asc" 
    ? <ArrowUp className="ms-1 h-4 w-4" />
    : <ArrowDown className="ms-1 h-4 w-4" />;
}

/**
 * Department Performance Table
 */
export function DepartmentTable({
  data,
  title,
  className,
}: DepartmentTableProps) {
  const { t } = useTranslation();
  const [sortField, setSortField] = useState<SortField>("completionRate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortDirection === "asc" 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [data, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title || t("analytics.charts.departmentPerformance")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ms-4 h-8 hover:bg-transparent"
                    onClick={() => handleSort("departmentName")}
                  >
                    {t("analytics.table.department")}
                    <SortIcon 
                      field="departmentName" 
                      sortField={sortField} 
                      sortDirection={sortDirection} 
                    />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ms-4 h-8 hover:bg-transparent"
                    onClick={() => handleSort("eventsCount")}
                  >
                    {t("analytics.table.events")}
                    <SortIcon 
                      field="eventsCount" 
                      sortField={sortField} 
                      sortDirection={sortDirection} 
                    />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ms-4 h-8 hover:bg-transparent"
                    onClick={() => handleSort("tasksCompleted")}
                  >
                    {t("analytics.table.completed")}
                    <SortIcon 
                      field="tasksCompleted" 
                      sortField={sortField} 
                      sortDirection={sortDirection} 
                    />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ms-4 h-8 hover:bg-transparent"
                    onClick={() => handleSort("tasksPending")}
                  >
                    {t("analytics.table.pending")}
                    <SortIcon 
                      field="tasksPending" 
                      sortField={sortField} 
                      sortDirection={sortDirection} 
                    />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ms-4 h-8 hover:bg-transparent"
                    onClick={() => handleSort("completionRate")}
                  >
                    {t("analytics.table.completionRate")}
                    <SortIcon 
                      field="completionRate" 
                      sortField={sortField} 
                      sortDirection={sortDirection} 
                    />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    {t("analytics.table.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((dept) => (
                  <TableRow key={dept.departmentId}>
                    <TableCell className="font-medium">
                      {dept.departmentName}
                    </TableCell>
                    <TableCell className="text-center">
                      {dept.eventsCount}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-green-600 dark:text-green-400">
                        {dept.tasksCompleted}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        dept.tasksPending > 0 
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                      )}>
                        {dept.tasksPending}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getCompletionBadgeVariant(dept.completionRate)}>
                        {dept.completionRate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for Department Table
 */
export function DepartmentTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-48 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <div className="h-10 bg-muted/50 border-b" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 border-b flex items-center gap-4 px-4">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-4 w-12 bg-muted animate-pulse rounded" />
              <div className="h-4 w-12 bg-muted animate-pulse rounded" />
              <div className="h-4 w-12 bg-muted animate-pulse rounded" />
              <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default DepartmentTable;
