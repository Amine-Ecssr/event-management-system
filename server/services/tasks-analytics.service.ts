/**
 * Tasks Analytics Service
 * 
 * Provides analytics data for tasks dashboard including:
 * - Task status and priority breakdowns
 * - Completion rates (overall and by department)
 * - Overdue tasks tracking
 * - Department performance metrics
 * - Task trends over time
 * 
 * UPDATED: Now uses Elasticsearch for all aggregations (SQL fallback DISABLED for testing)
 * 
 * @module services/tasks-analytics.service
 */

import { db } from "../db";
import {
  tasks,
  departments,
  eventDepartments,
  events,
  leads,
  organizations,
} from "@shared/schema";
import { eq, and, gte, lte, desc, asc, count, sql, lt, isNotNull, inArray } from "drizzle-orm";
import { getOptionalElasticsearchClient, isElasticsearchEnabled } from '../elasticsearch/client';
import { ES_INDEX_PREFIX, ES_INDEX_SUFFIX } from '../elasticsearch/config';

// TEMPORARY: Set to false to disable SQL fallback and force ES-only
const ENABLE_SQL_FALLBACK = false;

// ============================================================================
// Types
// ============================================================================

export interface TasksSummary {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  cancelledTasks: number;
  waitingTasks: number;
  overdueTasks: number;
  highPriorityPending: number;
  completionRate: number;
  avgCompletionTime: number; // in days
}

export interface TasksByStatus {
  status: string;
  count: number;
  percentage: number;
}

export interface TasksByPriority {
  priority: string;
  count: number;
  percentage: number;
}

export interface DepartmentPerformance {
  departmentId: number;
  departmentName: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completionRate: number;
  avgCompletionTime: number;
}

export interface OverdueTask {
  id: number;
  title: string;
  priority: string;
  dueDate: string;
  daysOverdue: number;
  departmentName: string | null;
  entityType: 'event' | 'lead' | 'partnership';
  entityName: string | null;
}

export interface TaskTrend {
  month: string;
  created: number;
  completed: number;
  netChange: number;
}

export interface TasksByEntity {
  entityType: string;
  count: number;
  percentage: number;
}

export interface WorkloadDistribution {
  departmentId: number;
  departmentName: string;
  taskCount: number;
  percentage: number;
}

export interface TasksAnalyticsData {
  summary: TasksSummary;
  byStatus: TasksByStatus[];
  byPriority: TasksByPriority[];
  departmentPerformance: DepartmentPerformance[];
  overdueTasks: OverdueTask[];
  monthlyTrends: TaskTrend[];
  byEntity: TasksByEntity[];
  workloadDistribution: WorkloadDistribution[];
}

// ============================================================================
// Service Class
// ============================================================================

class TasksAnalyticsService {
  private buildIndexName(entity: string): string {
    return `${ES_INDEX_PREFIX}-${entity}-${ES_INDEX_SUFFIX}`;
  }

  /**
   * Get comprehensive tasks analytics dashboard data
   * Now uses Elasticsearch for all aggregations
   */
  async getTasksAnalytics(
    startDate?: Date,
    endDate?: Date,
    departmentId?: number
  ): Promise<TasksAnalyticsData> {
    const start = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
    const end = endDate || new Date();

    // Try ES first
    if (isElasticsearchEnabled()) {
      console.log('[TasksAnalytics] Using Elasticsearch for aggregations');
      const esData = await this.getTasksAnalyticsFromES(start, end, departmentId);
      if (esData) return esData;
    }

    // SQL fallback (disabled for testing)
    if (!ENABLE_SQL_FALLBACK) {
      console.warn('[TasksAnalytics] SQL fallback is DISABLED - returning empty data');
      return this.getEmptyAnalyticsData();
    }

    console.log('[TasksAnalytics] Falling back to SQL queries');
    return this.getTasksAnalyticsFromSQL(start, end, departmentId);
  }

  /**
   * Get tasks analytics from Elasticsearch
   */
  private async getTasksAnalyticsFromES(
    startDate: Date,
    endDate: Date,
    departmentId?: number
  ): Promise<TasksAnalyticsData | null> {
    const client = await getOptionalElasticsearchClient();
    if (!client) {
      console.warn('[TasksAnalytics] ES client not available');
      return null;
    }

    try {
      const now = new Date();

      // Fetch all departments for name lookup
      const allDepartments = await db.select().from(departments);
      const deptMap = new Map(allDepartments.map(d => [d.id, d.name]));

      // Build department filter if needed
      const deptFilter = departmentId 
        ? [{ term: { departmentId: departmentId } }]
        : [];

      // Execute all ES aggregations in parallel
      const [summaryResponse, trendsResponse, entityResponse, workloadResponse, overdueResponse] = await Promise.all([
        // Summary + byStatus + byPriority aggregations
        client.search({
          index: this.buildIndexName('tasks'),
          body: {
            size: 0,
            track_total_hits: true,
            query: deptFilter.length > 0 ? { bool: { filter: deptFilter } } : { match_all: {} },
            aggs: {
              by_status: {
                terms: { field: 'status', size: 10 }
              },
              by_priority: {
                terms: { field: 'priority', size: 10 }
              },
              completed: {
                filter: { term: { 'status': 'completed' } }
              },
              pending: {
                filter: { term: { 'status': 'pending' } }
              },
              in_progress: {
                filter: { term: { 'status': 'in_progress' } }
              },
              waiting: {
                filter: { term: { 'status': 'waiting' } }
              },
              cancelled: {
                filter: { term: { 'status': 'cancelled' } }
              },
              overdue: {
                filter: {
                  bool: {
                    must: [{ range: { dueDate: { lt: now.toISOString() } } }],
                    must_not: [{ terms: { 'status': ['completed', 'cancelled'] } }]
                  }
                }
              },
              high_priority_pending: {
                filter: {
                  bool: {
                    must: [
                      { term: { 'priority': 'high' } },
                      { terms: { 'status': ['pending', 'in_progress'] } }
                    ]
                  }
                }
              },
              avg_completion_time: {
                filter: { term: { 'status': 'completed' } },
                aggs: {
                  avg_days: {
                    avg: { field: 'completionDays' }
                  }
                }
              }
            }
          }
        }),

        // Monthly trends aggregation
        client.search({
          index: this.buildIndexName('tasks'),
          body: {
            size: 0,
            query: {
              bool: {
                filter: [
                  { range: { createdAt: { gte: startDate.toISOString(), lte: endDate.toISOString() } } },
                  ...deptFilter
                ]
              }
            },
            aggs: {
              by_month: {
                date_histogram: {
                  field: 'createdAt',
                  calendar_interval: 'month',
                  format: 'yyyy-MM'
                },
                aggs: {
                  completed: {
                    filter: { term: { 'status': 'completed' } }
                  }
                }
              }
            }
          }
        }),

        // By entity type aggregation
        client.search({
          index: this.buildIndexName('tasks'),
          body: {
            size: 0,
            query: deptFilter.length > 0 ? { bool: { filter: deptFilter } } : { match_all: {} },
            aggs: {
              by_entity: {
                terms: { field: 'entityType', size: 10, missing: 'unknown' }
              }
            }
          }
        }),

        // Workload by department aggregation
        client.search({
          index: this.buildIndexName('tasks'),
          body: {
            size: 0,
            query: {
              bool: {
                filter: [
                  { terms: { 'status': ['pending', 'in_progress'] } }
                ]
              }
            },
            aggs: {
              by_department: {
                terms: { field: 'departmentId', size: 50 },
                aggs: {
                  dept_name: {
                    terms: { field: 'departmentName', size: 1 }
                  }
                }
              }
            }
          }
        }),

        // Overdue tasks details
        client.search({
          index: this.buildIndexName('tasks'),
          body: {
            size: 20,
            query: {
              bool: {
                must: [{ range: { dueDate: { lt: now.toISOString() } } }],
                must_not: [{ terms: { 'status': ['completed', 'cancelled'] } }],
                filter: deptFilter
              }
            },
            sort: [{ dueDate: 'asc' }],
            _source: ['id', 'name', 'title', 'priority', 'dueDate', 'departmentId', 'departmentName', 'eventId', 'eventName']
          }
        })
      ]);

      // Parse summary response
      const total = (summaryResponse.hits?.total as { value: number })?.value || 0;
      const aggs = summaryResponse.aggregations as any || {};
      
      const summary: TasksSummary = {
        totalTasks: total,
        pendingTasks: aggs.pending?.doc_count || 0,
        inProgressTasks: aggs.in_progress?.doc_count || 0,
        completedTasks: aggs.completed?.doc_count || 0,
        cancelledTasks: aggs.cancelled?.doc_count || 0,
        waitingTasks: aggs.waiting?.doc_count || 0,
        overdueTasks: aggs.overdue?.doc_count || 0,
        highPriorityPending: aggs.high_priority_pending?.doc_count || 0,
        completionRate: total > 0 ? Math.round((aggs.completed?.doc_count || 0) / total * 1000) / 10 : 0,
        avgCompletionTime: Math.round(aggs.avg_completion_time?.avg_days?.value || 0),
      };

      // Parse byStatus
      const statusBuckets = aggs.by_status?.buckets || [];
      const byStatus: TasksByStatus[] = statusBuckets.map((b: any) => ({
        status: b.key,
        count: b.doc_count,
        percentage: total > 0 ? Math.round(b.doc_count / total * 1000) / 10 : 0,
      }));

      // Parse byPriority
      const priorityBuckets = aggs.by_priority?.buckets || [];
      const priorityMap = new Map<string, number>(priorityBuckets.map((b: any) => [b.key, b.doc_count]));
      const priorityOrder = ['high', 'medium', 'low'];
      const byPriority: TasksByPriority[] = priorityOrder.map(p => ({
        priority: p,
        count: Number(priorityMap.get(p) || 0),
        percentage: total > 0 ? Math.round(Number(priorityMap.get(p) || 0) / total * 1000) / 10 : 0,
      }));

      // Parse monthly trends
      const trendsAggs = trendsResponse.aggregations as any || {};
      const monthBuckets = trendsAggs.by_month?.buckets || [];
      const monthlyTrends: TaskTrend[] = monthBuckets.map((b: any) => ({
        month: b.key_as_string,
        created: b.doc_count,
        completed: b.completed?.doc_count || 0,
        netChange: b.doc_count - (b.completed?.doc_count || 0),
      }));

      // Parse by entity
      const entityAggs = entityResponse?.aggregations as any || {};
      const entityBuckets = entityAggs.by_entity?.buckets || [];
      const entityTotal = entityBuckets.reduce((sum: number, b: any) => sum + b.doc_count, 0);
      const byEntity: TasksByEntity[] = entityBuckets.map((b: any) => ({
        entityType: b.key,
        count: b.doc_count,
        percentage: entityTotal > 0 ? Math.round(b.doc_count / entityTotal * 1000) / 10 : 0,
      }));

      // Parse workload distribution
      const workloadAggs = workloadResponse?.aggregations as any || {};
      const workloadBuckets = workloadAggs.by_department?.buckets || [];
      const workloadTotal = workloadBuckets.reduce((sum: number, b: any) => sum + b.doc_count, 0);
      const workloadDistribution: WorkloadDistribution[] = workloadBuckets.map((b: any) => ({
        departmentId: b.key,
        departmentName: deptMap.get(b.key) || b.dept_name?.buckets?.[0]?.key || 'Unknown Department',
        taskCount: b.doc_count,
        percentage: workloadTotal > 0 ? Math.round(b.doc_count / workloadTotal * 1000) / 10 : 0,
      }));

      // Parse overdue tasks and enrich with PostgreSQL data
      const overdueHits = overdueResponse?.hits?.hits || [];
      const overdueTaskIds = overdueHits.map((hit: any) => hit._source?.id).filter((id: any) => id != null);
      
      // Fetch detailed task data from PostgreSQL for enrichment
      let taskDetailsMap = new Map<number, { departmentName: string | null; eventName: string | null }>();
      if (overdueTaskIds.length > 0) {
        try {
          const taskDetails = await db.select({
            taskId: tasks.id,
            departmentName: departments.name,
            eventId: eventDepartments.eventId,
          })
            .from(tasks)
            .leftJoin(departments, eq(tasks.departmentId, departments.id))
            .leftJoin(eventDepartments, eq(tasks.eventDepartmentId, eventDepartments.id))
            .where(inArray(tasks.id, overdueTaskIds));
          
          // Get event names for enrichment - filter out any invalid IDs and dedupe
          const eventIdSet = new Set(taskDetails.filter(t => t.eventId != null).map(t => t.eventId!));
          const validEventIds = Array.from(eventIdSet);
          let eventNameMap = new Map<string, string>();
          if (validEventIds.length > 0) {
            try {
              const eventNames = await db.select({ id: events.id, name: events.name })
                .from(events)
                .where(inArray(events.id, validEventIds));
              eventNameMap = new Map(eventNames.map(e => [e.id, e.name]));
            } catch (eventErr: any) {
              console.error('[TasksAnalytics] Error fetching event names:', eventErr?.message);
            }
          }
          
          for (const td of taskDetails) {
            taskDetailsMap.set(td.taskId, {
              departmentName: td.departmentName || null,
              eventName: td.eventId ? eventNameMap.get(td.eventId) || null : null,
            });
          }
        } catch (enrichError: any) {
          console.error('[TasksAnalytics] Error enriching task details:', enrichError?.message);
          // Continue without enrichment
        }
      }
      
      const overdueTasks: OverdueTask[] = overdueHits.map((hit: any) => {
        const source = hit._source;
        const dueDate = new Date(source.dueDate);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const enrichedData = taskDetailsMap.get(source.id);
        return {
          id: source.id,
          title: source.title || source.name,
          priority: source.priority,
          dueDate: source.dueDate,
          daysOverdue,
          departmentName: enrichedData?.departmentName || source.departmentName || null,
          entityType: 'event' as const,
          entityName: enrichedData?.eventName || source.eventName || null,
        };
      });

      // Department performance - get from workload with additional completed metrics
      const departmentPerformance = await this.getDepartmentPerformanceFromES(client, deptFilter);

      console.log('[TasksAnalytics] ES aggregation successful');
      return {
        summary,
        byStatus,
        byPriority,
        departmentPerformance,
        overdueTasks,
        monthlyTrends,
        byEntity,
        workloadDistribution,
      };
    } catch (error: any) {
      console.error('[TasksAnalytics] ES aggregation error:', error?.message || error);
      console.error('[TasksAnalytics] Error stack:', error?.stack);
      return null;
    }
  }

  /**
   * Get department performance metrics from ES
   */
  private async getDepartmentPerformanceFromES(client: any, deptFilter: any[]): Promise<DepartmentPerformance[]> {
    try {
      // Fetch all departments for name lookup
      const allDepartments = await db.select().from(departments);
      const deptMap = new Map(allDepartments.map(d => [d.id, d.name]));

      const now = new Date();
      const response = await client.search({
        index: this.buildIndexName('tasks'),
        body: {
          size: 0,
          query: { match_all: {} },
          aggs: {
            by_department: {
              terms: { field: 'departmentId', size: 50 },
              aggs: {
                dept_name: {
                  terms: { field: 'departmentName', size: 1 }
                },
                completed: {
                  filter: { term: { 'status': 'completed' } }
                },
                pending: {
                  filter: { terms: { 'status': ['pending', 'in_progress', 'waiting'] } }
                },
                overdue: {
                  filter: {
                    bool: {
                      must: [{ range: { dueDate: { lt: now.toISOString() } } }],
                      must_not: [{ terms: { 'status': ['completed', 'cancelled'] } }]
                    }
                  }
                },
                avg_completion_time: {
                  filter: { term: { 'status': 'completed' } },
                  aggs: {
                    avg_days: { avg: { field: 'completionDays' } }
                  }
                }
              }
            }
          }
        }
      });

      const aggs = response.aggregations as any;
      const buckets = aggs.by_department?.buckets || [];

      return buckets.map((b: any) => {
        const total = b.doc_count;
        const completed = b.completed?.doc_count || 0;
        return {
          departmentId: b.key,
          departmentName: deptMap.get(b.key) || b.dept_name?.buckets?.[0]?.key || 'Unknown Department',
          totalTasks: total,
          completedTasks: completed,
          pendingTasks: b.pending?.doc_count || 0,
          overdueTasks: b.overdue?.doc_count || 0,
          completionRate: total > 0 ? Math.round(completed / total * 1000) / 10 : 0,
          avgCompletionTime: Math.round(b.avg_completion_time?.avg_days?.value || 0),
        };
      });
    } catch (error) {
      console.error('[TasksAnalytics] getDepartmentPerformanceFromES error:', error);
      return [];
    }
  }

  /**
   * Return empty analytics data structure
   */
  private getEmptyAnalyticsData(): TasksAnalyticsData {
    return {
      summary: {
        totalTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        completedTasks: 0,
        cancelledTasks: 0,
        waitingTasks: 0,
        overdueTasks: 0,
        highPriorityPending: 0,
        completionRate: 0,
        avgCompletionTime: 0,
      },
      byStatus: [],
      byPriority: [],
      departmentPerformance: [],
      overdueTasks: [],
      monthlyTrends: [],
      byEntity: [],
      workloadDistribution: [],
    };
  }

  /**
   * Get tasks analytics from SQL (fallback)
   */
  private async getTasksAnalyticsFromSQL(
    startDate: Date,
    endDate: Date,
    departmentId?: number
  ): Promise<TasksAnalyticsData> {
    const [
      summary,
      byStatus,
      byPriority,
      departmentPerformance,
      overdueTasks,
      monthlyTrends,
      byEntity,
      workloadDistribution,
    ] = await Promise.all([
      this.getSummary(departmentId),
      this.getByStatus(departmentId),
      this.getByPriority(departmentId),
      this.getDepartmentPerformance(),
      this.getOverdueTasks(departmentId),
      this.getMonthlyTrends(startDate, endDate, departmentId),
      this.getByEntity(departmentId),
      this.getWorkloadDistribution(),
    ]);

    return {
      summary,
      byStatus,
      byPriority,
      departmentPerformance,
      overdueTasks,
      monthlyTrends,
      byEntity,
      workloadDistribution,
    };
  }

  /**
   * Get summary statistics for tasks
   */
  private async getSummary(departmentId?: number): Promise<TasksSummary> {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Base condition for department filtering
    const deptCondition = departmentId ? eq(tasks.departmentId, departmentId) : undefined;

    const [
      totalResult,
      pendingResult,
      inProgressResult,
      completedResult,
      cancelledResult,
      waitingResult,
      overdueResult,
      highPriorityResult,
    ] = await Promise.all([
      // Total tasks
      db.select({ count: count() }).from(tasks).where(deptCondition),
      
      // Pending tasks
      db.select({ count: count() })
        .from(tasks)
        .where(deptCondition ? and(eq(tasks.status, 'pending'), deptCondition) : eq(tasks.status, 'pending')),
      
      // In progress tasks
      db.select({ count: count() })
        .from(tasks)
        .where(deptCondition ? and(eq(tasks.status, 'in_progress'), deptCondition) : eq(tasks.status, 'in_progress')),
      
      // Completed tasks
      db.select({ count: count() })
        .from(tasks)
        .where(deptCondition ? and(eq(tasks.status, 'completed'), deptCondition) : eq(tasks.status, 'completed')),
      
      // Cancelled tasks
      db.select({ count: count() })
        .from(tasks)
        .where(deptCondition ? and(eq(tasks.status, 'cancelled'), deptCondition) : eq(tasks.status, 'cancelled')),
      
      // Waiting tasks
      db.select({ count: count() })
        .from(tasks)
        .where(deptCondition ? and(eq(tasks.status, 'waiting'), deptCondition) : eq(tasks.status, 'waiting')),
      
      // Overdue tasks (pending/in_progress with past due date)
      db.select({ count: count() })
        .from(tasks)
        .where(
          deptCondition
            ? and(
                sql`${tasks.status} IN ('pending', 'in_progress')`,
                sql`${tasks.dueDate}::date < ${todayStr}::date`,
                deptCondition
              )
            : and(
                sql`${tasks.status} IN ('pending', 'in_progress')`,
                sql`${tasks.dueDate}::date < ${todayStr}::date`
              )
        ),
      
      // High priority pending
      db.select({ count: count() })
        .from(tasks)
        .where(
          deptCondition
            ? and(
                eq(tasks.priority, 'high'),
                sql`${tasks.status} IN ('pending', 'in_progress')`,
                deptCondition
              )
            : and(
                eq(tasks.priority, 'high'),
                sql`${tasks.status} IN ('pending', 'in_progress')`
              )
        ),
    ]);

    // Calculate average completion time
    const avgTimeResult = await db.select({
      avgDays: sql<number>`AVG(
        CASE 
          WHEN ${tasks.completedAt} IS NOT NULL AND ${tasks.createdAt} IS NOT NULL
          THEN EXTRACT(EPOCH FROM (${tasks.completedAt} - ${tasks.createdAt})) / 86400
          ELSE NULL
        END
      )`,
    })
      .from(tasks)
      .where(eq(tasks.status, 'completed'));

    const total = totalResult[0]?.count || 0;
    const completed = completedResult[0]?.count || 0;

    return {
      totalTasks: total,
      pendingTasks: pendingResult[0]?.count || 0,
      inProgressTasks: inProgressResult[0]?.count || 0,
      completedTasks: completed,
      cancelledTasks: cancelledResult[0]?.count || 0,
      waitingTasks: waitingResult[0]?.count || 0,
      overdueTasks: overdueResult[0]?.count || 0,
      highPriorityPending: highPriorityResult[0]?.count || 0,
      completionRate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
      avgCompletionTime: Math.round(avgTimeResult[0]?.avgDays || 0),
    };
  }

  /**
   * Get tasks breakdown by status
   */
  private async getByStatus(departmentId?: number): Promise<TasksByStatus[]> {
    const deptCondition = departmentId ? eq(tasks.departmentId, departmentId) : undefined;

    const result = await db.select({
      status: tasks.status,
      count: count(),
    })
      .from(tasks)
      .where(deptCondition)
      .groupBy(tasks.status)
      .orderBy(desc(count()));

    const total = result.reduce((sum, r) => sum + r.count, 0);

    return result.map(r => ({
      status: r.status,
      count: r.count,
      percentage: total > 0 ? Math.round(r.count / total * 1000) / 10 : 0,
    }));
  }

  /**
   * Get tasks breakdown by priority
   */
  private async getByPriority(departmentId?: number): Promise<TasksByPriority[]> {
    const deptCondition = departmentId ? eq(tasks.departmentId, departmentId) : undefined;

    const result = await db.select({
      priority: tasks.priority,
      count: count(),
    })
      .from(tasks)
      .where(deptCondition)
      .groupBy(tasks.priority)
      .orderBy(desc(count()));

    const total = result.reduce((sum, r) => sum + r.count, 0);

    // Ensure all priorities are present
    const priorityOrder = ['high', 'medium', 'low'];
    const resultMap = new Map(result.map(r => [r.priority, r.count]));

    return priorityOrder.map(p => ({
      priority: p,
      count: resultMap.get(p) || 0,
      percentage: total > 0 ? Math.round((resultMap.get(p) || 0) / total * 1000) / 10 : 0,
    }));
  }

  /**
   * Get performance metrics by department
   */
  private async getDepartmentPerformance(): Promise<DepartmentPerformance[]> {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Get all departments with task counts
    const result = await db.select({
      departmentId: tasks.departmentId,
      departmentName: departments.name,
      totalTasks: count(),
    })
      .from(tasks)
      .leftJoin(departments, eq(tasks.departmentId, departments.id))
      .where(isNotNull(tasks.departmentId))
      .groupBy(tasks.departmentId, departments.name)
      .orderBy(desc(count()));

    // Get completed counts per department
    const completedByDept = await db.select({
      departmentId: tasks.departmentId,
      count: count(),
    })
      .from(tasks)
      .where(and(eq(tasks.status, 'completed'), isNotNull(tasks.departmentId)))
      .groupBy(tasks.departmentId);

    // Get pending counts per department
    const pendingByDept = await db.select({
      departmentId: tasks.departmentId,
      count: count(),
    })
      .from(tasks)
      .where(and(eq(tasks.status, 'pending'), isNotNull(tasks.departmentId)))
      .groupBy(tasks.departmentId);

    // Get overdue counts per department
    const overdueByDept = await db.select({
      departmentId: tasks.departmentId,
      count: count(),
    })
      .from(tasks)
      .where(and(
        sql`${tasks.status} IN ('pending', 'in_progress')`,
        sql`${tasks.dueDate}::date < ${todayStr}::date`,
        isNotNull(tasks.departmentId)
      ))
      .groupBy(tasks.departmentId);

    const completedMap = new Map(completedByDept.map(c => [c.departmentId, c.count]));
    const pendingMap = new Map(pendingByDept.map(p => [p.departmentId, p.count]));
    const overdueMap = new Map(overdueByDept.map(o => [o.departmentId, o.count]));

    return result.map(r => {
      const completed = completedMap.get(r.departmentId) || 0;
      return {
        departmentId: r.departmentId || 0,
        departmentName: r.departmentName || 'Unassigned',
        totalTasks: r.totalTasks,
        completedTasks: completed,
        pendingTasks: pendingMap.get(r.departmentId) || 0,
        overdueTasks: overdueMap.get(r.departmentId) || 0,
        completionRate: r.totalTasks > 0 ? Math.round(completed / r.totalTasks * 1000) / 10 : 0,
        avgCompletionTime: 0, // Would need individual query per dept
      };
    });
  }

  /**
   * Get list of overdue tasks with details
   */
  private async getOverdueTasks(departmentId?: number): Promise<OverdueTask[]> {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const baseCondition = and(
      sql`${tasks.status} IN ('pending', 'in_progress')`,
      sql`${tasks.dueDate}::date < ${todayStr}::date`
    );

    const condition = departmentId
      ? and(baseCondition, eq(tasks.departmentId, departmentId))
      : baseCondition;

    const overdueList = await db.select({
      id: tasks.id,
      title: tasks.title,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      departmentId: tasks.departmentId,
      departmentName: departments.name,
      eventDepartmentId: tasks.eventDepartmentId,
      leadId: tasks.leadId,
      partnershipId: tasks.partnershipId,
    })
      .from(tasks)
      .leftJoin(departments, eq(tasks.departmentId, departments.id))
      .where(condition)
      .orderBy(asc(tasks.dueDate))
      .limit(20);

    return overdueList.map(t => {
      const dueDate = t.dueDate ? new Date(t.dueDate) : now;
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));

      // Determine entity type
      let entityType: 'event' | 'lead' | 'partnership' = 'event';
      if (t.leadId) entityType = 'lead';
      else if (t.partnershipId) entityType = 'partnership';

      return {
        id: t.id,
        title: t.title,
        priority: t.priority,
        dueDate: t.dueDate || '',
        daysOverdue: Math.max(0, daysOverdue),
        departmentName: t.departmentName,
        entityType,
        entityName: null, // Would need additional queries to resolve
      };
    });
  }

  /**
   * Get monthly task trends (created vs completed)
   */
  private async getMonthlyTrends(
    startDate: Date,
    endDate: Date,
    departmentId?: number
  ): Promise<TaskTrend[]> {
    const deptCondition = departmentId ? eq(tasks.departmentId, departmentId) : undefined;

    // Created by month
    const createdCondition = deptCondition
      ? and(
          gte(tasks.createdAt, startDate),
          lte(tasks.createdAt, endDate),
          deptCondition
        )
      : and(
          gte(tasks.createdAt, startDate),
          lte(tasks.createdAt, endDate)
        );

    const created = await db.select({
      month: sql<string>`TO_CHAR(${tasks.createdAt}, 'YYYY-MM')`,
      count: count(),
    })
      .from(tasks)
      .where(createdCondition)
      .groupBy(sql`TO_CHAR(${tasks.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${tasks.createdAt}, 'YYYY-MM')`);

    // Completed by month
    const completedCondition = deptCondition
      ? and(
          gte(tasks.completedAt, startDate),
          lte(tasks.completedAt, endDate),
          deptCondition
        )
      : and(
          gte(tasks.completedAt, startDate),
          lte(tasks.completedAt, endDate)
        );

    const completed = await db.select({
      month: sql<string>`TO_CHAR(${tasks.completedAt}, 'YYYY-MM')`,
      count: count(),
    })
      .from(tasks)
      .where(completedCondition)
      .groupBy(sql`TO_CHAR(${tasks.completedAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${tasks.completedAt}, 'YYYY-MM')`);

    // Merge results
    const completedMap = new Map(completed.map(c => [c.month, c.count]));
    const allMonths = new Set([
      ...created.map(c => c.month),
      ...completed.map(c => c.month),
    ]);

    return Array.from(allMonths).sort().map(month => {
      const createdCount = created.find(c => c.month === month)?.count || 0;
      const completedCount = completedMap.get(month) || 0;
      return {
        month,
        created: createdCount,
        completed: completedCount,
        netChange: createdCount - completedCount,
      };
    });
  }

  /**
   * Get tasks breakdown by entity type (event/lead/partnership)
   */
  private async getByEntity(departmentId?: number): Promise<TasksByEntity[]> {
    const deptCondition = departmentId ? eq(tasks.departmentId, departmentId) : undefined;

    const result = await db.select({
      hasEvent: sql<boolean>`${tasks.eventDepartmentId} IS NOT NULL`,
      hasLead: sql<boolean>`${tasks.leadId} IS NOT NULL`,
      hasPartnership: sql<boolean>`${tasks.partnershipId} IS NOT NULL`,
      count: count(),
    })
      .from(tasks)
      .where(deptCondition)
      .groupBy(
        sql`${tasks.eventDepartmentId} IS NOT NULL`,
        sql`${tasks.leadId} IS NOT NULL`,
        sql`${tasks.partnershipId} IS NOT NULL`
      );

    let eventCount = 0, leadCount = 0, partnershipCount = 0;
    for (const r of result) {
      if (r.hasEvent) eventCount = r.count;
      else if (r.hasLead) leadCount = r.count;
      else if (r.hasPartnership) partnershipCount = r.count;
    }

    const total = eventCount + leadCount + partnershipCount;

    return [
      { entityType: 'Events', count: eventCount, percentage: total > 0 ? Math.round(eventCount / total * 1000) / 10 : 0 },
      { entityType: 'Leads', count: leadCount, percentage: total > 0 ? Math.round(leadCount / total * 1000) / 10 : 0 },
      { entityType: 'Partnerships', count: partnershipCount, percentage: total > 0 ? Math.round(partnershipCount / total * 1000) / 10 : 0 },
    ].filter(e => e.count > 0);
  }

  /**
   * Get workload distribution across departments
   */
  private async getWorkloadDistribution(): Promise<WorkloadDistribution[]> {
    const result = await db.select({
      departmentId: tasks.departmentId,
      departmentName: departments.name,
      taskCount: count(),
    })
      .from(tasks)
      .leftJoin(departments, eq(tasks.departmentId, departments.id))
      .where(and(
        sql`${tasks.status} IN ('pending', 'in_progress')`,
        isNotNull(tasks.departmentId)
      ))
      .groupBy(tasks.departmentId, departments.name)
      .orderBy(desc(count()));

    const total = result.reduce((sum, r) => sum + r.taskCount, 0);

    return result.map(r => ({
      departmentId: r.departmentId || 0,
      departmentName: r.departmentName || 'Unassigned',
      taskCount: r.taskCount,
      percentage: total > 0 ? Math.round(r.taskCount / total * 1000) / 10 : 0,
    }));
  }
}

export const tasksAnalyticsService = new TasksAnalyticsService();
