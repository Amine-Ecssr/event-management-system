/**
 * Department Performance Table Component
 * 
 * Table showing task performance metrics by department.
 * 
 * @module components/analytics/DepartmentPerformanceTable
 */

import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Building2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskDepartmentPerformance } from '@/types/analytics';

interface DepartmentPerformanceTableProps {
  data: TaskDepartmentPerformance[];
}

export function DepartmentPerformanceTable({ data }: DepartmentPerformanceTableProps) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        {t('tasksAnalytics.noDepartments', 'No department data available')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('tasksAnalytics.department', 'Department')}</TableHead>
            <TableHead className="text-center">
              {t('tasksAnalytics.total', 'Total')}
            </TableHead>
            <TableHead className="text-center">
              {t('tasksAnalytics.completedLabel', 'Completed')}
            </TableHead>
            <TableHead className="text-center">
              {t('tasksAnalytics.overdueLabel', 'Overdue')}
            </TableHead>
            <TableHead className="w-[150px]">
              {t('tasksAnalytics.completionRate', 'Completion Rate')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((dept) => {
            // Color-code completion rate
            const rateColor = 
              dept.completionRate >= 80 ? 'text-green-600' :
              dept.completionRate >= 50 ? 'text-amber-600' :
              'text-red-600';

            return (
              <TableRow key={dept.departmentId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{dept.departmentName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{dept.totalTasks}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge 
                    variant={dept.completedTasks > 0 ? 'default' : 'secondary'}
                    className={dept.completedTasks > 0 ? 'bg-green-600' : ''}
                  >
                    {dept.completedTasks}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {dept.overdueTasks > 0 ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {dept.overdueTasks}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">0</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={dept.completionRate} 
                      className="h-2 flex-1"
                    />
                    <span className={cn('text-sm font-medium w-12 text-right', rateColor)}>
                      {dept.completionRate}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
