/**
 * Elasticsearch Aggregations Service
 * 
 * Provides analytics aggregations powered by Elasticsearch.
 * Used by analytics dashboards for fast statistical queries.
 * 
 * @module services/elasticsearch-aggregations.service
 */

import { getOptionalElasticsearchClient, isElasticsearchEnabled } from '../elasticsearch/client';
import { ES_INDEX_PREFIX, ES_INDEX_SUFFIX } from '../elasticsearch/config';
import { aggregationCache, CACHE_TTL } from '../cache/aggregation-cache';
import type {
  CategoryStats,
  MonthlyStats,
  TrendData,
  StatusStats,
  PriorityStats,
  DepartmentStats,
  CountryStats,
  EventTypeStats,
  OverdueStats,
  CompletionRate,
  ActivityTrends,
  LeadStageStats,
  OrganizationTypeStats,
  DashboardSummary,
  AggregationFilters,
  TrendPeriod,
} from '../elasticsearch/types/aggregations.types';

/**
 * Elasticsearch Aggregations Service
 * 
 * Provides methods for computing analytics aggregations using ES.
 * Includes caching for frequently accessed data.
 */
export class ElasticsearchAggregationsService {
  /**
   * Build index name from entity type
   */
  private buildIndexName(entity: string): string {
    return `${ES_INDEX_PREFIX}-${entity}-${ES_INDEX_SUFFIX}`;
  }

  // ============ EVENT AGGREGATIONS ============

  /**
   * Get events grouped by category
   */
  async getEventsByCategory(filters?: AggregationFilters): Promise<CategoryStats[]> {
    const cacheKey = aggregationCache.buildKey('eventsByCategory', filters as Record<string, unknown> || {});
    const cached = aggregationCache.get<CategoryStats[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return [];

    try {
      const response = await client.search({
        index: this.buildIndexName('events'),
        body: {
          size: 0,
          query: this.buildDateRangeQuery(filters),
          aggs: {
            categories: {
              terms: {
                field: 'category',
                size: 50,
              },
            },
          },
        },
      });

      const total = (response.hits.total as { value: number }).value;
      const buckets = (response.aggregations?.categories as { buckets: Array<{ key: string; doc_count: number }> })?.buckets || [];

      const result: CategoryStats[] = buckets.map((bucket) => ({
        category: bucket.key,
        count: bucket.doc_count,
        percentage: total > 0 ? Math.round((bucket.doc_count / total) * 100) : 0,
      }));

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Aggregations] getEventsByCategory error:', error);
      return [];
    }
  }

  /**
   * Get events grouped by event type
   */
  async getEventsByType(filters?: AggregationFilters): Promise<EventTypeStats[]> {
    const cacheKey = aggregationCache.buildKey('eventsByType', filters as Record<string, unknown> || {});
    const cached = aggregationCache.get<EventTypeStats[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return [];

    try {
      const response = await client.search({
        index: this.buildIndexName('events'),
        body: {
          size: 0,
          query: this.buildDateRangeQuery(filters),
          aggs: {
            eventTypes: {
              terms: {
                field: 'eventType',
                size: 50,
              },
            },
          },
        },
      });

      const total = (response.hits.total as { value: number }).value;
      const buckets = (response.aggregations?.eventTypes as { buckets: Array<{ key: string; doc_count: number }> })?.buckets || [];

      const result: EventTypeStats[] = buckets.map((bucket) => ({
        eventType: bucket.key,
        count: bucket.doc_count,
        percentage: total > 0 ? Math.round((bucket.doc_count / total) * 100) : 0,
      }));

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Aggregations] getEventsByType error:', error);
      return [];
    }
  }

  /**
   * Get events by month with year-over-year comparison
   */
  async getEventsByMonth(year: number, departmentId?: number): Promise<MonthlyStats[]> {
    const cacheKey = aggregationCache.buildKey('eventsByMonth', { year, departmentId });
    const cached = aggregationCache.get<MonthlyStats[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return [];

    try {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);
      const prevYearStart = new Date(year - 1, 0, 1);
      const prevYearEnd = new Date(year - 1, 11, 31, 23, 59, 59);

      const mustFilters: object[] = [
        { range: { startDate: { gte: startDate.toISOString(), lte: endDate.toISOString() } } },
      ];
      if (departmentId) {
        mustFilters.push({ term: { departmentId } });
      }

      // Current year
      const currentYearResponse = await client.search({
        index: this.buildIndexName('events'),
        body: {
          size: 0,
          query: { bool: { must: mustFilters } },
          aggs: {
            months: {
              date_histogram: {
                field: 'startDate',
                calendar_interval: 'month',
                format: 'yyyy-MM',
                min_doc_count: 0,
                extended_bounds: {
                  min: startDate.toISOString(),
                  max: endDate.toISOString(),
                },
              },
            },
          },
        },
      });

      // Previous year for comparison
      const prevMustFilters: object[] = [
        { range: { startDate: { gte: prevYearStart.toISOString(), lte: prevYearEnd.toISOString() } } },
      ];
      if (departmentId) {
        prevMustFilters.push({ term: { departmentId } });
      }

      const prevYearResponse = await client.search({
        index: this.buildIndexName('events'),
        body: {
          size: 0,
          query: { bool: { must: prevMustFilters } },
          aggs: {
            months: {
              date_histogram: {
                field: 'startDate',
                calendar_interval: 'month',
                format: 'MM',
              },
            },
          },
        },
      });

      const currentBuckets = (currentYearResponse.aggregations?.months as { buckets: Array<{ key_as_string: string; doc_count: number }> })?.buckets || [];
      const prevBuckets = (prevYearResponse.aggregations?.months as { buckets: Array<{ key_as_string: string; doc_count: number }> })?.buckets || [];

      // Map previous year counts by month number
      const prevYearMap = new Map<string, number>();
      prevBuckets.forEach((b) => {
        prevYearMap.set(b.key_as_string, b.doc_count);
      });

      const result: MonthlyStats[] = currentBuckets.map((bucket) => {
        const monthNum = bucket.key_as_string.split('-')[1];
        const prevCount = prevYearMap.get(monthNum) || 0;
        const growthRate = prevCount > 0
          ? Math.round(((bucket.doc_count - prevCount) / prevCount) * 100)
          : bucket.doc_count > 0 ? 100 : 0;

        return {
          month: bucket.key_as_string,
          year,
          count: bucket.doc_count,
          previousYearCount: prevCount,
          growthRate,
        };
      });

      aggregationCache.set(cacheKey, result, CACHE_TTL.LONG);
      return result;
    } catch (error) {
      console.error('[Aggregations] getEventsByMonth error:', error);
      return [];
    }
  }

  /**
   * Get event trends over time
   */
  async getEventTrends(period: TrendPeriod): Promise<TrendData[]> {
    const cacheKey = aggregationCache.buildKey('eventTrends', { period });
    const cached = aggregationCache.get<TrendData[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return [];

    try {
      const intervals: Record<TrendPeriod, { interval: string; range: number }> = {
        day: { interval: 'hour', range: 1 },
        week: { interval: 'day', range: 7 },
        month: { interval: 'day', range: 30 },
        quarter: { interval: 'week', range: 90 },
        year: { interval: 'month', range: 365 },
      };

      const { interval, range } = intervals[period];
      const startDate = new Date(Date.now() - range * 24 * 60 * 60 * 1000);

      const response = await client.search({
        index: this.buildIndexName('events'),
        body: {
          size: 0,
          query: {
            range: { startDate: { gte: startDate.toISOString() } },
          },
          aggs: {
            trend: {
              date_histogram: {
                field: 'startDate',
                calendar_interval: interval as 'hour' | 'day' | 'week' | 'month',
                format: 'yyyy-MM-dd',
              },
              aggs: {
                moving_avg_value: {
                  moving_fn: {
                    buckets_path: '_count',
                    window: 3,
                    script: 'MovingFunctions.unweightedAvg(values)',
                  },
                },
              },
            },
          },
        },
      });

      const buckets = (response.aggregations?.trend as { buckets: Array<{ key_as_string: string; doc_count: number; moving_avg_value?: { value: number } }> })?.buckets || [];

      const result: TrendData[] = buckets.map((bucket) => ({
        date: bucket.key_as_string,
        value: bucket.doc_count,
        movingAverage: bucket.moving_avg_value?.value,
      }));

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Aggregations] getEventTrends error:', error);
      return [];
    }
  }

  // ============ TASK AGGREGATIONS ============

  /**
   * Get tasks grouped by status
   */
  async getTasksByStatus(filters?: AggregationFilters): Promise<StatusStats[]> {
    const cacheKey = aggregationCache.buildKey('tasksByStatus', filters as Record<string, unknown> || {});
    const cached = aggregationCache.get<StatusStats[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return [];

    try {
      const response = await client.search({
        index: this.buildIndexName('tasks'),
        body: {
          size: 0,
          query: this.buildDateRangeQuery(filters, 'createdAt'),
          aggs: {
            statuses: {
              terms: {
                field: 'status',
                size: 20,
              },
            },
          },
        },
      });

      const total = (response.hits.total as { value: number }).value;
      const buckets = (response.aggregations?.statuses as { buckets: Array<{ key: string; doc_count: number }> })?.buckets || [];

      const result: StatusStats[] = buckets.map((bucket) => ({
        status: bucket.key,
        count: bucket.doc_count,
        percentage: total > 0 ? Math.round((bucket.doc_count / total) * 100) : 0,
      }));

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Aggregations] getTasksByStatus error:', error);
      return [];
    }
  }

  /**
   * Get tasks grouped by priority
   */
  async getTasksByPriority(filters?: AggregationFilters): Promise<PriorityStats[]> {
    const cacheKey = aggregationCache.buildKey('tasksByPriority', filters as Record<string, unknown> || {});
    const cached = aggregationCache.get<PriorityStats[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return [];

    try {
      const response = await client.search({
        index: this.buildIndexName('tasks'),
        body: {
          size: 0,
          query: this.buildDateRangeQuery(filters, 'createdAt'),
          aggs: {
            priorities: {
              terms: {
                field: 'priority',
                size: 10,
              },
            },
          },
        },
      });

      const total = (response.hits.total as { value: number }).value;
      const buckets = (response.aggregations?.priorities as { buckets: Array<{ key: string; doc_count: number }> })?.buckets || [];

      const result: PriorityStats[] = buckets.map((bucket) => ({
        priority: bucket.key,
        count: bucket.doc_count,
        percentage: total > 0 ? Math.round((bucket.doc_count / total) * 100) : 0,
      }));

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Aggregations] getTasksByPriority error:', error);
      return [];
    }
  }

  /**
   * Get tasks grouped by department with completion rates
   */
  async getTasksByDepartment(): Promise<DepartmentStats[]> {
    const cacheKey = 'tasksByDepartment';
    const cached = aggregationCache.get<DepartmentStats[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return [];

    try {
      const response = await client.search({
        index: this.buildIndexName('tasks'),
        body: {
          size: 0,
          aggs: {
            departments: {
              terms: {
                field: 'departmentId',
                size: 100,
              },
              aggs: {
                department_name: {
                  terms: { field: 'departmentName', size: 1 },
                },
                completed: {
                  filter: { term: { 'status': 'completed' } },
                },
              },
            },
          },
        },
      });

      type DeptBucket = {
        key: number;
        doc_count: number;
        department_name: { buckets: Array<{ key: string }> };
        completed: { doc_count: number };
      };

      const buckets = (response.aggregations?.departments as { buckets: DeptBucket[] })?.buckets || [];

      const result: DepartmentStats[] = buckets.map((bucket) => ({
        departmentId: bucket.key,
        departmentName: bucket.department_name?.buckets?.[0]?.key || `Department ${bucket.key}`,
        count: bucket.doc_count,
        completionRate: bucket.doc_count > 0 
          ? Math.round((bucket.completed.doc_count / bucket.doc_count) * 100) 
          : 0,
      }));

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Aggregations] getTasksByDepartment error:', error);
      return [];
    }
  }

  /**
   * Get task completion rate over time
   */
  async getTaskCompletionRate(period: string): Promise<CompletionRate> {
    const cacheKey = aggregationCache.buildKey('taskCompletionRate', { period });
    const cached = aggregationCache.get<CompletionRate>(cacheKey);
    if (cached) return cached;

    const defaultResult: CompletionRate = { total: 0, completed: 0, rate: 0, byPeriod: [] };

    if (!isElasticsearchEnabled()) {
      return defaultResult;
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return defaultResult;

    try {
      const response = await client.search({
        index: this.buildIndexName('tasks'),
        body: {
          size: 0,
          track_total_hits: true,
          aggs: {
            completed: {
              filter: { term: { 'status': 'completed' } },
            },
            by_period: {
              date_histogram: {
                field: 'createdAt',
                calendar_interval: period as 'day' | 'week' | 'month' | 'quarter' | 'year',
                format: 'yyyy-MM-dd',
              },
              aggs: {
                completed_in_period: {
                  filter: { term: { 'status': 'completed' } },
                },
              },
            },
          },
        },
      });

      const total = (response.hits.total as { value: number }).value || 0;
      const completed = (response.aggregations?.completed as { doc_count: number })?.doc_count || 0;

      type PeriodBucket = {
        key_as_string: string;
        doc_count: number;
        completed_in_period: { doc_count: number };
      };

      const byPeriodBuckets = (response.aggregations?.by_period as { buckets: PeriodBucket[] })?.buckets || [];

      const result: CompletionRate = {
        total,
        completed,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        byPeriod: byPeriodBuckets.map((bucket) => ({
          period: bucket.key_as_string,
          total: bucket.doc_count,
          completed: bucket.completed_in_period.doc_count,
          rate: bucket.doc_count > 0
            ? Math.round((bucket.completed_in_period.doc_count / bucket.doc_count) * 100)
            : 0,
        })),
      };

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Aggregations] getTaskCompletionRate error:', error);
      return defaultResult;
    }
  }

  /**
   * Get overdue task statistics
   */
  async getOverdueTasks(): Promise<OverdueStats> {
    const cacheKey = 'overdueTasks';
    const cached = aggregationCache.get<OverdueStats>(cacheKey);
    if (cached) return cached;

    const defaultResult: OverdueStats = { total: 0, byDays: [], byDepartment: [] };

    if (!isElasticsearchEnabled()) {
      return defaultResult;
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return defaultResult;

    try {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const response = await client.search({
        index: this.buildIndexName('tasks'),
        body: {
          size: 0,
          query: {
            bool: {
              must: [
                { range: { dueDate: { lt: now.toISOString() } } },
              ],
              must_not: [
                { term: { 'status': 'completed' } },
              ],
            },
          },
          aggs: {
            by_days: {
              range: {
                field: 'dueDate',
                ranges: [
                  { key: '1-7 days', from: oneWeekAgo.toISOString(), to: now.toISOString() },
                  { key: '8-14 days', from: twoWeeksAgo.toISOString(), to: oneWeekAgo.toISOString() },
                  { key: '15-30 days', from: oneMonthAgo.toISOString(), to: twoWeeksAgo.toISOString() },
                  { key: '30+ days', to: oneMonthAgo.toISOString() },
                ],
              },
            },
            by_department: {
              terms: {
                field: 'departmentName',
                size: 20,
              },
            },
          },
        },
      });

      const total = (response.hits.total as { value: number }).value;

      type RangeBucket = { key: string; doc_count: number };
      type TermsBucket = { key: string; doc_count: number };

      const daysBuckets = (response.aggregations?.by_days as { buckets: RangeBucket[] })?.buckets || [];
      const deptBuckets = (response.aggregations?.by_department as { buckets: TermsBucket[] })?.buckets || [];

      const result: OverdueStats = {
        total,
        byDays: daysBuckets.map((b) => ({
          range: b.key,
          count: b.doc_count,
        })),
        byDepartment: deptBuckets.map((b) => ({
          departmentName: b.key,
          count: b.doc_count,
        })),
      };

      aggregationCache.set(cacheKey, result, CACHE_TTL.SHORT);
      return result;
    } catch (error) {
      console.error('[Aggregations] getOverdueTasks error:', error);
      return defaultResult;
    }
  }

  // ============ PARTNERSHIP AGGREGATIONS ============

  /**
   * Get partnerships/agreements grouped by status
   */
  async getPartnershipsByStatus(): Promise<StatusStats[]> {
    const cacheKey = 'partnershipsByStatus';
    const cached = aggregationCache.get<StatusStats[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return [];

    try {
      const response = await client.search({
        index: this.buildIndexName('partnerships'),
        body: {
          size: 0,
          aggs: {
            statuses: {
              terms: { field: 'status', size: 20 },
            },
          },
        },
      });

      const total = (response.hits.total as { value: number }).value;
      const buckets = (response.aggregations?.statuses as { buckets: Array<{ key: string; doc_count: number }> })?.buckets || [];

      const result: StatusStats[] = buckets.map((bucket) => ({
        status: bucket.key,
        count: bucket.doc_count,
        percentage: total > 0 ? Math.round((bucket.doc_count / total) * 100) : 0,
      }));

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Aggregations] getPartnershipsByStatus error:', error);
      return [];
    }
  }

  /**
   * Get organizations grouped by country
   */
  async getOrganizationsByCountry(): Promise<CountryStats[]> {
    const cacheKey = 'organizationsByCountry';
    const cached = aggregationCache.get<CountryStats[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return [];

    try {
      const response = await client.search({
        index: this.buildIndexName('organizations'),
        body: {
          size: 0,
          aggs: {
            countries: {
              terms: { field: 'country', size: 100, missing: 'Unknown' },
            },
          },
        },
      });

      const buckets = (response.aggregations?.countries as { buckets: Array<{ key: string; doc_count: number }> })?.buckets || [];

      const result: CountryStats[] = buckets.map((bucket) => ({
        country: bucket.key,
        count: bucket.doc_count,
      }));

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Aggregations] getOrganizationsByCountry error:', error);
      return [];
    }
  }

  /**
   * Get organizations grouped by type
   */
  async getOrganizationsByType(): Promise<OrganizationTypeStats[]> {
    const cacheKey = 'organizationsByType';
    const cached = aggregationCache.get<OrganizationTypeStats[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return [];

    try {
      const response = await client.search({
        index: this.buildIndexName('organizations'),
        body: {
          size: 0,
          aggs: {
            types: {
              terms: { field: 'type', size: 50 },
            },
          },
        },
      });

      const total = (response.hits.total as { value: number }).value;
      const buckets = (response.aggregations?.types as { buckets: Array<{ key: string; doc_count: number }> })?.buckets || [];

      const result: OrganizationTypeStats[] = buckets.map((bucket) => ({
        type: bucket.key,
        count: bucket.doc_count,
        percentage: total > 0 ? Math.round((bucket.doc_count / total) * 100) : 0,
      }));

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Aggregations] getOrganizationsByType error:', error);
      return [];
    }
  }

  // ============ LEAD AGGREGATIONS ============

  /**
   * Get leads grouped by stage
   */
  async getLeadsByStage(): Promise<LeadStageStats[]> {
    const cacheKey = 'leadsByStage';
    const cached = aggregationCache.get<LeadStageStats[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return [];

    try {
      const response = await client.search({
        index: this.buildIndexName('leads'),
        body: {
          size: 0,
          aggs: {
            stages: {
              terms: { field: 'stage', size: 20 },
            },
          },
        },
      });

      const total = (response.hits.total as { value: number }).value;
      const buckets = (response.aggregations?.stages as { buckets: Array<{ key: string; doc_count: number }> })?.buckets || [];

      const result: LeadStageStats[] = buckets.map((bucket) => ({
        stage: bucket.key,
        count: bucket.doc_count,
        percentage: total > 0 ? Math.round((bucket.doc_count / total) * 100) : 0,
      }));

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Aggregations] getLeadsByStage error:', error);
      return [];
    }
  }

  // ============ CROSS-ENTITY AGGREGATIONS ============

  /**
   * Get overall activity trends across all entity types
   */
  async getOverallActivityTrends(days = 30): Promise<ActivityTrends> {
    const cacheKey = aggregationCache.buildKey('activityTrends', { days });
    const cached = aggregationCache.get<ActivityTrends>(cacheKey);
    if (cached) return cached;

    const defaultResult: ActivityTrends = { events: [], tasks: [], partnerships: [], contacts: [] };

    if (!isElasticsearchEnabled()) {
      return defaultResult;
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return defaultResult;

    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const buildTrendQuery = (index: string, dateField: string) => ({
        index,
        body: {
          size: 0,
          query: { range: { [dateField]: { gte: startDate.toISOString() } } },
          aggs: {
            trend: {
              date_histogram: {
                field: dateField,
                calendar_interval: 'day',
                format: 'yyyy-MM-dd',
              },
            },
          },
        },
      });

      const [eventsResponse, tasksResponse, partnershipsResponse, contactsResponse] = await Promise.all([
        client.search(buildTrendQuery(this.buildIndexName('events'), 'createdAt')),
        client.search(buildTrendQuery(this.buildIndexName('tasks'), 'createdAt')),
        client.search(buildTrendQuery(this.buildIndexName('partnerships'), 'createdAt')),
        client.search(buildTrendQuery(this.buildIndexName('contacts'), 'createdAt')),
      ]);

      const extractTrend = (response: { aggregations?: Record<string, unknown> }): TrendData[] => {
        const buckets = (response.aggregations?.trend as { buckets: Array<{ key_as_string: string; doc_count: number }> })?.buckets || [];
        return buckets.map((b) => ({
          date: b.key_as_string,
          value: b.doc_count,
        }));
      };

      const result: ActivityTrends = {
        events: extractTrend(eventsResponse),
        tasks: extractTrend(tasksResponse),
        partnerships: extractTrend(partnershipsResponse),
        contacts: extractTrend(contactsResponse),
      };

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Aggregations] getOverallActivityTrends error:', error);
      return defaultResult;
    }
  }

  /**
   * Get dashboard summary counts
   */
  async getDashboardSummary(): Promise<DashboardSummary> {
    const cacheKey = 'dashboardSummary';
    const cached = aggregationCache.get<DashboardSummary>(cacheKey);
    if (cached) return cached;

    const defaultResult: DashboardSummary = {
      totalEvents: 0,
      activeEvents: 0,
      upcomingEvents: 0,
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      totalPartners: 0,
      activeAgreements: 0,
      totalContacts: 0,
      totalOrganizations: 0,
      totalLeads: 0,
      openLeads: 0,
    };

    if (!isElasticsearchEnabled()) {
      return defaultResult;
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return defaultResult;

    try {
      const now = new Date();

      const [
        eventsResponse,
        tasksResponse,
        partnershipsResponse,
        contactsResponse,
        orgsResponse,
        leadsResponse,
      ] = await Promise.all([
        // Events - use track_total_hits instead of value_count on text field
        client.search({
          index: this.buildIndexName('events'),
          body: {
            size: 0,
            track_total_hits: true,
            aggs: {
              active: {
                filter: {
                  bool: {
                    must: [
                      { range: { startDate: { lte: now.toISOString() } } },
                      { range: { endDate: { gte: now.toISOString() } } },
                    ],
                  },
                },
              },
              upcoming: {
                filter: { range: { startDate: { gt: now.toISOString() } } },
              },
            },
          },
        }),
        // Tasks - use track_total_hits for consistency
        client.search({
          index: this.buildIndexName('tasks'),
          body: {
            size: 0,
            track_total_hits: true,
            aggs: {
              completed: { filter: { term: { 'status': 'completed' } } },
              pending: { filter: { term: { 'status': 'pending' } } },
              overdue: {
                filter: {
                  bool: {
                    must: [{ range: { dueDate: { lt: now.toISOString() } } }],
                    must_not: [{ term: { 'status': 'completed' } }],
                  },
                },
              },
            },
          },
        }),
        // Partnerships - use track_total_hits for consistency
        client.search({
          index: this.buildIndexName('partnerships'),
          body: {
            size: 0,
            track_total_hits: true,
            aggs: {
              active: { filter: { term: { 'status': 'active' } } },
            },
          },
        }),
        // Contacts
        client.count({ index: this.buildIndexName('contacts') }),
        // Organizations
        client.count({ index: this.buildIndexName('organizations') }),
        // Leads - use track_total_hits for consistency
        client.search({
          index: this.buildIndexName('leads'),
          body: {
            size: 0,
            track_total_hits: true,
            aggs: {
              open: {
                filter: {
                  bool: {
                    must_not: [
                      { terms: { 'stage': ['won', 'lost', 'closed'] } },
                    ],
                  },
                },
              },
            },
          },
        }),
      ]);

      type SearchResponse = {
        hits: { total: { value: number } };
        aggregations?: Record<string, { value?: number; doc_count?: number }>;
      };

      const result: DashboardSummary = {
        totalEvents: (eventsResponse as SearchResponse).hits.total.value || 0,
        activeEvents: (eventsResponse as SearchResponse).aggregations?.active?.doc_count || 0,
        upcomingEvents: (eventsResponse as SearchResponse).aggregations?.upcoming?.doc_count || 0,
        totalTasks: (tasksResponse as SearchResponse).hits.total.value || 0,
        completedTasks: (tasksResponse as SearchResponse).aggregations?.completed?.doc_count || 0,
        pendingTasks: (tasksResponse as SearchResponse).aggregations?.pending?.doc_count || 0,
        overdueTasks: (tasksResponse as SearchResponse).aggregations?.overdue?.doc_count || 0,
        totalPartners: (partnershipsResponse as SearchResponse).hits.total.value || 0,
        activeAgreements: (partnershipsResponse as SearchResponse).aggregations?.active?.doc_count || 0,
        totalContacts: (contactsResponse as { count: number }).count || 0,
        totalOrganizations: (orgsResponse as { count: number }).count || 0,
        totalLeads: (leadsResponse as SearchResponse).hits.total.value || 0,
        openLeads: (leadsResponse as SearchResponse).aggregations?.open?.doc_count || 0,
      };

      aggregationCache.set(cacheKey, result, CACHE_TTL.SHORT);
      return result;
    } catch (error) {
      console.error('[Aggregations] getDashboardSummary error:', error);
      return defaultResult;
    }
  }

  // ============ ENGAGEMENT AGGREGATIONS ============

  /**
   * Get comprehensive engagement analytics using Elasticsearch
   * Provides conversion funnel, monthly trends, category breakdown, and tier analysis
   */
  async getEngagementAnalytics(): Promise<{
    engagementByCategory: Array<{
      categoryId: number;
      categoryNameEn: string;
      categoryNameAr: string | null;
      totalEvents: number;
      totalInvitees: number;
      totalAttendees: number;
      attendanceRate: number;
    }>;
    engagementByMonth: Array<{
      month: number;
      year: number;
      totalEvents: number;
      totalInvitees: number;
      totalAttendees: number;
    }>;
    conversionFunnel: {
      invited: number;
      registered: number;
      attended: number;
      registrationRate: number;
      attendanceRate: number;
      overallConversion: number;
    };
    topPerformingEvents: Array<{
      eventId: string;
      eventName: string;
      eventNameAr: string | null;
      eventDate: string;
      categoryName: string | null;
      totalInvitees: number;
      totalAttendees: number;
      attendanceRate: number;
    }>;
    engagementTiers: {
      highly_engaged: number;
      moderately_engaged: number;
      low_engaged: number;
      not_engaged: number;
    };
    eventTypeEngagement: Array<{
      eventType: string | null;
      eventScope: string | null;
      totalEvents: number;
      totalInvitees: number;
      totalAttendees: number;
      attendanceRate: number;
    }>;
    geographicEngagement: Array<{
      countryCode: string;
      countryNameEn: string;
      countryNameAr: string | null;
      uniqueContacts: number;
      totalInvitations: number;
      totalAttendances: number;
    }>;
  } | null> {
    const cacheKey = 'engagementAnalytics';
    const cached = aggregationCache.get<Awaited<ReturnType<typeof this.getEngagementAnalytics>>>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return null;
    }

    const client = await getOptionalElasticsearchClient();
    if (!client) return null;

    try {
      // Parallel execution of all aggregation queries
      const [
        categoryAggResponse,
        monthlyAggResponse,
        funnelResponse,
        topEventsResponse,
        tiersResponse,
        eventTypeResponse,
        geographicInviteesResponse,
        geographicAttendeesResponse,
      ] = await Promise.all([
        // 1. Engagement by Category
        client.search({
          index: this.buildIndexName('events'),
          body: {
            size: 0,
            aggs: {
              categories: {
                terms: { field: 'categoryId', size: 50 },
                aggs: {
                  category_name: { terms: { field: 'categoryNameEn', size: 1 } },
                  category_name_ar: { terms: { field: 'categoryNameAr', size: 1 } },
                },
              },
            },
          },
        }),

        // 2. Engagement by Month (Last 12 months)
        client.search({
          index: this.buildIndexName('events'),
          body: {
            size: 0,
            query: {
              range: { startDate: { gte: 'now-12M' } },
            },
            aggs: {
              months: {
                date_histogram: {
                  field: 'startDate',
                  calendar_interval: 'month',
                  format: 'yyyy-MM',
                },
              },
            },
          },
        }),

        // 3. Conversion Funnel - Invitees to Attendees
        Promise.all([
          client.count({ index: this.buildIndexName('invitees') }),
          client.count({
            index: this.buildIndexName('invitees'),
            body: {
              query: { term: { registered: true } },
            },
          }),
          client.count({ index: this.buildIndexName('attendees') }),
        ]),

        // 4. Top Performing Events (by attendance count)
        client.search({
          index: this.buildIndexName('attendees'),
          body: {
            size: 0,
            aggs: {
              top_events: {
                terms: { field: 'eventId', size: 10, order: { _count: 'desc' } },
                aggs: {
                  event_name: { terms: { field: 'eventName', size: 1 } },
                  event_name_ar: { terms: { field: 'eventNameAr', size: 1 } },
                  event_date: { terms: { field: 'eventDate', size: 1 } },
                },
              },
            },
          },
        }),

        // 5. Engagement Tiers (contact attendance distribution)
        client.search({
          index: this.buildIndexName('attendees'),
          body: {
            size: 0,
            aggs: {
              contacts: {
                terms: { field: 'contactId', size: 10000 },
              },
            },
          },
        }),

        // 6. Event Type Engagement
        client.search({
          index: this.buildIndexName('events'),
          body: {
            size: 0,
            aggs: {
              event_types: {
                terms: { field: 'eventType', size: 20 },
                aggs: {
                  event_scope: { terms: { field: 'eventScope', size: 5 } },
                },
              },
            },
          },
        }),

        // 7. Geographic Engagement - Invitations by country
        client.search({
          index: this.buildIndexName('invitees'),
          body: {
            size: 0,
            aggs: {
              countries: {
                terms: { field: 'countryCode', size: 50, missing: 'UNKNOWN' },
                aggs: {
                  country_name_en: { terms: { field: 'countryNameEn', size: 1 } },
                  country_name_ar: { terms: { field: 'countryNameAr', size: 1 } },
                  unique_contacts: { cardinality: { field: 'contactId' } },
                },
              },
            },
          },
        }),

        // 8. Geographic Engagement - Attendances by country
        client.search({
          index: this.buildIndexName('attendees'),
          body: {
            size: 0,
            aggs: {
              countries: {
                terms: { field: 'countryCode', size: 50, missing: 'UNKNOWN' },
                aggs: {
                  country_name_en: { terms: { field: 'countryNameEn', size: 1 } },
                  country_name_ar: { terms: { field: 'countryNameAr', size: 1 } },
                  unique_contacts: { cardinality: { field: 'contactId' } },
                },
              },
            },
          },
        }),
      ]);

      // Process category aggregation
      type CategoryBucket = {
        key: number;
        doc_count: number;
        category_name: { buckets: Array<{ key: string }> };
        category_name_ar: { buckets: Array<{ key: string }> };
      };
      const categoryBuckets = (categoryAggResponse.aggregations?.categories as { buckets: CategoryBucket[] })?.buckets || [];

      // Get invitee and attendee counts per category using denormalized eventCategoryId field
      const categoryInviteeCounts = new Map<number, number>();
      const categoryAttendeeCounts = new Map<number, number>();
      
      // Parallel fetch invitees and attendees per category using eventCategoryId
      await Promise.all(
        categoryBuckets.map(async (cat) => {
          const [inviteeCount, attendeeCount] = await Promise.all([
            client.count({
              index: this.buildIndexName('invitees'),
              body: {
                query: {
                  term: { eventCategoryId: cat.key },
                },
              },
            }).then(r => r.count).catch(() => 0),
            client.count({
              index: this.buildIndexName('attendees'),
              body: {
                query: {
                  term: { eventCategoryId: cat.key },
                },
              },
            }).then(r => r.count).catch(() => 0),
          ]);
          categoryInviteeCounts.set(cat.key, inviteeCount);
          categoryAttendeeCounts.set(cat.key, attendeeCount);
        })
      );

      const engagementByCategory = categoryBuckets.map((bucket) => {
        const totalInvitees = categoryInviteeCounts.get(bucket.key) || 0;
        const totalAttendees = categoryAttendeeCounts.get(bucket.key) || 0;
        return {
          categoryId: bucket.key,
          categoryNameEn: bucket.category_name?.buckets?.[0]?.key || `Category ${bucket.key}`,
          categoryNameAr: bucket.category_name_ar?.buckets?.[0]?.key || null,
          totalEvents: bucket.doc_count,
          totalInvitees,
          totalAttendees,
          attendanceRate: totalInvitees > 0 ? Math.round((totalAttendees / totalInvitees) * 100) : 0,
        };
      });

      // Process monthly aggregation - fetch invitee/attendee counts per month
      type MonthlyBucket = { key_as_string: string; key: number; doc_count: number };
      const monthlyBuckets = (monthlyAggResponse.aggregations?.months as { buckets: MonthlyBucket[] })?.buckets || [];
      
      // Fetch monthly invitee and attendee counts using denormalized eventDate
      const engagementByMonth = await Promise.all(
        monthlyBuckets.map(async (bucket) => {
          const [yearStr, monthStr] = bucket.key_as_string.split('-');
          const monthStart = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
          const monthEnd = new Date(parseInt(yearStr), parseInt(monthStr), 0, 23, 59, 59);
          
          // Get invitee and attendee counts for this month using eventDate field
          const [inviteeCount, attendeeCount] = await Promise.all([
            client.count({
              index: this.buildIndexName('invitees'),
              body: {
                query: {
                  range: { eventDate: { gte: monthStart.toISOString(), lte: monthEnd.toISOString() } },
                },
              },
            }).then(r => r.count).catch(() => 0),
            client.count({
              index: this.buildIndexName('attendees'),
              body: {
                query: {
                  range: { eventDate: { gte: monthStart.toISOString(), lte: monthEnd.toISOString() } },
                },
              },
            }).then(r => r.count).catch(() => 0),
          ]);

          return {
            month: parseInt(monthStr, 10),
            year: parseInt(yearStr, 10),
            totalEvents: bucket.doc_count,
            totalInvitees: inviteeCount,
            totalAttendees: attendeeCount,
          };
        })
      );

      // Process conversion funnel
      const [inviteeCountResp, registeredResp, attendeeCountResp] = funnelResponse;
      const invited = (inviteeCountResp as { count: number }).count || 0;
      const registered = (registeredResp as { count: number }).count || 0;
      const attended = (attendeeCountResp as { count: number }).count || 0;

      const conversionFunnel = {
        invited,
        registered,
        attended,
        registrationRate: invited > 0 ? Math.round((registered / invited) * 100) : 0,
        attendanceRate: registered > 0 ? Math.round((attended / registered) * 100) : 0,
        overallConversion: invited > 0 ? Math.round((attended / invited) * 100) : 0,
      };

      // Process top performing events
      type TopEventBucket = {
        key: string;
        doc_count: number;
        event_name: { buckets: Array<{ key: string }> };
        event_name_ar: { buckets: Array<{ key: string }> };
        event_date: { buckets: Array<{ key: number }> };
      };
      const topEventBuckets = (topEventsResponse.aggregations?.top_events as { buckets: TopEventBucket[] })?.buckets || [];

      // Get invitee counts per event for top events
      const eventInviteeCounts = new Map<string, number>();
      await Promise.all(
        topEventBuckets.map(async (evt) => {
          const inviteeCount = await client.count({
            index: this.buildIndexName('invitees'),
            body: { query: { term: { 'eventId': evt.key } } },
          }).then(r => r.count).catch(() => 0);
          eventInviteeCounts.set(evt.key, inviteeCount);
        })
      );

      const topPerformingEvents = topEventBuckets.map((bucket) => {
        const totalInvitees = eventInviteeCounts.get(bucket.key) || 0;
        const totalAttendees = bucket.doc_count;
        return {
          eventId: bucket.key,
          eventName: bucket.event_name?.buckets?.[0]?.key || `Event ${bucket.key}`,
          eventNameAr: bucket.event_name_ar?.buckets?.[0]?.key || null,
          eventDate: bucket.event_date?.buckets?.[0]?.key 
            ? new Date(bucket.event_date.buckets[0].key).toISOString()
            : new Date().toISOString(),
          categoryName: null,
          totalInvitees,
          totalAttendees,
          attendanceRate: totalInvitees > 0 ? Math.round((totalAttendees / totalInvitees) * 100) : 0,
        };
      });

      // Process engagement tiers (contacts by attendance count)
      type ContactBucket = { key: number; doc_count: number };
      const contactBuckets = (tiersResponse.aggregations?.contacts as { buckets: ContactBucket[] })?.buckets || [];

      // Get total contacts count for not_engaged calculation
      const totalContacts = await client.count({ index: this.buildIndexName('contacts') }).then(r => r.count).catch(() => 0);
      const engagedContactIds = new Set(contactBuckets.map(b => b.key));

      const engagementTiers = {
        highly_engaged: contactBuckets.filter(c => c.doc_count >= 5).length,
        moderately_engaged: contactBuckets.filter(c => c.doc_count >= 2 && c.doc_count < 5).length,
        low_engaged: contactBuckets.filter(c => c.doc_count === 1).length,
        not_engaged: Math.max(0, totalContacts - engagedContactIds.size),
      };

      // Process event type engagement
      type EventTypeBucket = {
        key: string;
        doc_count: number;
        event_scope: { buckets: Array<{ key: string; doc_count: number }> };
      };
      const eventTypeBuckets = (eventTypeResponse.aggregations?.event_types as { buckets: EventTypeBucket[] })?.buckets || [];

      const eventTypeEngagement: Array<{
        eventType: string | null;
        eventScope: string | null;
        totalEvents: number;
        totalInvitees: number;
        totalAttendees: number;
        attendanceRate: number;
      }> = eventTypeBuckets.flatMap((bucket) => {
        if (bucket.event_scope?.buckets?.length) {
          return bucket.event_scope.buckets.map((scope) => ({
            eventType: bucket.key as string | null,
            eventScope: scope.key as string | null,
            totalEvents: scope.doc_count,
            totalInvitees: 0,
            totalAttendees: 0,
            attendanceRate: 0,
          }));
        }
        return [{
          eventType: bucket.key as string | null,
          eventScope: null,
          totalEvents: bucket.doc_count,
          totalInvitees: 0,
          totalAttendees: 0,
          attendanceRate: 0,
        }];
      });

      // Process geographic engagement data
      type GeoBucket = {
        key: string;
        doc_count: number;
        country_name_en: { buckets: Array<{ key: string }> };
        country_name_ar: { buckets: Array<{ key: string }> };
        unique_contacts: { value: number };
      };
      
      const inviteeCountryBuckets = (geographicInviteesResponse.aggregations?.countries as { buckets: GeoBucket[] })?.buckets || [];
      const attendeeCountryBuckets = (geographicAttendeesResponse.aggregations?.countries as { buckets: GeoBucket[] })?.buckets || [];
      
      // Build a map of attendee counts by country
      const attendeesByCountry = new Map<string, { count: number; contacts: number; nameEn: string; nameAr: string | null }>();
      for (const bucket of attendeeCountryBuckets) {
        if (bucket.key && bucket.key !== 'UNKNOWN') {
          attendeesByCountry.set(bucket.key, {
            count: bucket.doc_count,
            contacts: bucket.unique_contacts?.value || 0,
            nameEn: bucket.country_name_en?.buckets?.[0]?.key || bucket.key,
            nameAr: bucket.country_name_ar?.buckets?.[0]?.key || null,
          });
        }
      }
      
      // Combine invitee and attendee data by country
      const geographicEngagement: Array<{
        countryCode: string;
        countryNameEn: string;
        countryNameAr: string | null;
        uniqueContacts: number;
        totalInvitations: number;
        totalAttendances: number;
      }> = inviteeCountryBuckets
        .filter(bucket => bucket.key && bucket.key !== 'UNKNOWN')
        .map(bucket => {
          const attendeeData = attendeesByCountry.get(bucket.key);
          return {
            countryCode: bucket.key,
            countryNameEn: bucket.country_name_en?.buckets?.[0]?.key || bucket.key,
            countryNameAr: bucket.country_name_ar?.buckets?.[0]?.key || null,
            uniqueContacts: bucket.unique_contacts?.value || 0,
            totalInvitations: bucket.doc_count,
            totalAttendances: attendeeData?.count || 0,
          };
        })
        .sort((a, b) => b.totalAttendances - a.totalAttendances)
        .slice(0, 15);

      const result = {
        engagementByCategory,
        engagementByMonth,
        conversionFunnel,
        topPerformingEvents,
        engagementTiers,
        eventTypeEngagement,
        geographicEngagement,
      };

      aggregationCache.set(cacheKey, result, CACHE_TTL.MEDIUM);
      return result;
    } catch (error) {
      console.error('[Aggregations] getEngagementAnalytics error:', error);
      return null;
    }
  }

  // ============ HELPER METHODS ============

  /**
   * Build date range query with optional filters
   */
  private buildDateRangeQuery(filters?: AggregationFilters, dateField = 'startDate'): object {
    if (!filters?.startDate && !filters?.endDate && !filters?.departmentId && 
        !filters?.status?.length && !filters?.category?.length) {
      return { match_all: {} };
    }

    const must: object[] = [];

    if (filters?.startDate || filters?.endDate) {
      const range: Record<string, string> = {};
      if (filters.startDate) {
        // Handle both Date objects and strings
        range.gte = filters.startDate instanceof Date 
          ? filters.startDate.toISOString() 
          : String(filters.startDate);
      }
      if (filters.endDate) {
        range.lte = filters.endDate instanceof Date 
          ? filters.endDate.toISOString() 
          : String(filters.endDate);
      }
      must.push({ range: { [dateField]: range } });
    }

    if (filters?.departmentId) {
      must.push({ term: { departmentId: filters.departmentId } });
    }

    if (filters?.status?.length) {
      must.push({ terms: { 'status': filters.status } });
    }

    if (filters?.category?.length) {
      must.push({ terms: { 'category': filters.category } });
    }

    if (filters?.eventType?.length) {
      must.push({ terms: { 'eventType': filters.eventType } });
    }

    if (filters?.priority?.length) {
      must.push({ terms: { 'priority': filters.priority } });
    }

    return { bool: { must } };
  }

  /**
   * Invalidate cache for specific entity or all
   */
  invalidateCache(entity?: string): void {
    if (entity) {
      aggregationCache.invalidate(entity);
    } else {
      aggregationCache.invalidateAll();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return aggregationCache.getStats();
  }
}

// Export singleton instance
export const aggregationsService = new ElasticsearchAggregationsService();
