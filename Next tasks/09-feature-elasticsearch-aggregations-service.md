# Feature: Elasticsearch Aggregations Service

## Type
Feature / Analytics Backend

## Priority
🟠 High

## Estimated Effort
5-6 hours

## Description
Create aggregation service for analytics dashboards. Leverages ES aggregations for fast statistical queries instead of PostgreSQL. Powers all analytics dashboards with real-time metrics.

## Architecture Context
- **Index Prefix**: Configurable via `ES_INDEX_PREFIX` (default: `eventcal`)
- **Kibana**: Test queries at `kibana.eventcal.app`
- **Caching**: In-memory with Redis support for production

## Requirements

### Aggregation Types

#### Metric Aggregations
- Count, sum, avg, min, max
- Cardinality (unique counts)
- Stats (all metrics combined)

#### Bucket Aggregations
- Terms (group by field)
- Date histogram (time series)
- Range (numeric/date ranges)
- Filters (multiple filters)

#### Pipeline Aggregations
- Moving average
- Cumulative sum
- Derivative (rate of change)

---

## Complete Implementation

### Aggregation Types (`server/elasticsearch/types/aggregations.types.ts`)
```typescript
export interface CategoryStats {
  category: string;
  count: number;
  percentage: number;
}

export interface MonthlyStats {
  month: string;
  year: number;
  count: number;
  previousYearCount?: number;
  growthRate?: number;
}

export interface TrendData {
  date: string;
  value: number;
  movingAverage?: number;
}

export interface StatusStats {
  status: string;
  count: number;
  percentage: number;
}

export interface DepartmentStats {
  departmentId: number;
  departmentName: string;
  count: number;
  completionRate?: number;
}

export interface CountryStats {
  country: string;
  countryCode?: string;
  count: number;
}

export interface OverdueStats {
  total: number;
  byDays: {
    range: string;
    count: number;
  }[];
  byDepartment: {
    departmentName: string;
    count: number;
  }[];
}

export interface CompletionRate {
  total: number;
  completed: number;
  rate: number;
  byPeriod: {
    period: string;
    rate: number;
  }[];
}

export interface ActivityTrends {
  events: TrendData[];
  tasks: TrendData[];
  partnerships: TrendData[];
  contacts: TrendData[];
}

export interface AttendanceStats {
  eventId: number;
  eventTitle: string;
  invited: number;
  confirmed: number;
  attended: number;
  confirmationRate: number;
  attendanceRate: number;
}

export interface EngagementStats {
  contactId: number;
  contactName: string;
  eventsAttended: number;
  interactionsCount: number;
  lastInteraction: string;
  engagementScore: number;
}

export interface AggregationFilters {
  startDate?: Date;
  endDate?: Date;
  departmentId?: number;
  status?: string[];
  category?: string[];
}
```

### Aggregation Cache (`server/cache/aggregation-cache.ts`)
```typescript
import { logger } from '../utils/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class AggregationCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
  
  invalidateAll(): void {
    this.cache.clear();
  }
  
  buildKey(method: string, params: Record<string, any>): string {
    return `${method}:${JSON.stringify(params)}`;
  }
}

export const aggregationCache = new AggregationCache();
```

### Aggregations Service (`server/services/elasticsearch-aggregations.service.ts`)
```typescript
import { getOptionalElasticsearchClient, isElasticsearchEnabled } from '../elasticsearch/client';
import { getIndexConfig } from '../elasticsearch/config';
import { aggregationCache } from '../cache/aggregation-cache';
import { logger } from '../utils/logger';
import {
  CategoryStats, MonthlyStats, TrendData, StatusStats,
  DepartmentStats, CountryStats, OverdueStats, CompletionRate,
  ActivityTrends, AttendanceStats, EngagementStats, AggregationFilters
} from '../elasticsearch/types/aggregations.types';

const { ES_INDEX_PREFIX, ES_INDEX_SUFFIX } = getIndexConfig();

export class ElasticsearchAggregationsService {
  private buildIndexName(entity: string): string {
    return `${ES_INDEX_PREFIX}-${entity}-${ES_INDEX_SUFFIX}`;
  }

  // ============ EVENT AGGREGATIONS ============

  async getEventsByCategory(filters?: AggregationFilters): Promise<CategoryStats[]> {
    const cacheKey = aggregationCache.buildKey('eventsByCategory', filters || {});
    const cached = aggregationCache.get<CategoryStats[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = getOptionalElasticsearchClient();
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
                field: 'category.keyword',
                size: 50
              }
            }
          }
        }
      });

      const total = response.hits.total as { value: number };
      const buckets = (response.aggregations?.categories as any)?.buckets || [];
      
      const result: CategoryStats[] = buckets.map((bucket: any) => ({
        category: bucket.key,
        count: bucket.doc_count,
        percentage: Math.round((bucket.doc_count / total.value) * 100)
      }));

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('getEventsByCategory error:', error);
      return [];
    }
  }

  async getEventsByMonth(year: number, departmentId?: number): Promise<MonthlyStats[]> {
    const cacheKey = aggregationCache.buildKey('eventsByMonth', { year, departmentId });
    const cached = aggregationCache.get<MonthlyStats[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = getOptionalElasticsearchClient();
    if (!client) return [];

    try {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);
      const prevYearStart = new Date(year - 1, 0, 1);
      const prevYearEnd = new Date(year - 1, 11, 31);

      // Get current year stats
      const currentYearResponse = await client.search({
        index: this.buildIndexName('events'),
        body: {
          size: 0,
          query: {
            bool: {
              must: [
                { range: { startDate: { gte: startDate.toISOString(), lte: endDate.toISOString() } } },
                ...(departmentId ? [{ term: { departmentId } }] : [])
              ]
            }
          },
          aggs: {
            months: {
              date_histogram: {
                field: 'startDate',
                calendar_interval: 'month',
                format: 'yyyy-MM',
                min_doc_count: 0,
                extended_bounds: {
                  min: startDate.toISOString(),
                  max: endDate.toISOString()
                }
              }
            }
          }
        }
      });

      // Get previous year stats for comparison
      const prevYearResponse = await client.search({
        index: this.buildIndexName('events'),
        body: {
          size: 0,
          query: {
            bool: {
              must: [
                { range: { startDate: { gte: prevYearStart.toISOString(), lte: prevYearEnd.toISOString() } } },
                ...(departmentId ? [{ term: { departmentId } }] : [])
              ]
            }
          },
          aggs: {
            months: {
              date_histogram: {
                field: 'startDate',
                calendar_interval: 'month',
                format: 'MM'
              }
            }
          }
        }
      });

      const currentBuckets = (currentYearResponse.aggregations?.months as any)?.buckets || [];
      const prevBuckets = (prevYearResponse.aggregations?.months as any)?.buckets || [];
      
      // Create map of previous year counts
      const prevYearMap = new Map<string, number>();
      prevBuckets.forEach((b: any) => {
        prevYearMap.set(b.key_as_string, b.doc_count);
      });

      const result: MonthlyStats[] = currentBuckets.map((bucket: any) => {
        const month = bucket.key_as_string;
        const monthNum = month.split('-')[1];
        const prevCount = prevYearMap.get(monthNum) || 0;
        const growthRate = prevCount > 0 
          ? Math.round(((bucket.doc_count - prevCount) / prevCount) * 100) 
          : 0;
        
        return {
          month,
          year,
          count: bucket.doc_count,
          previousYearCount: prevCount,
          growthRate
        };
      });

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('getEventsByMonth error:', error);
      return [];
    }
  }

  async getEventTrends(period: 'week' | 'month' | 'year'): Promise<TrendData[]> {
    const cacheKey = aggregationCache.buildKey('eventTrends', { period });
    const cached = aggregationCache.get<TrendData[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = getOptionalElasticsearchClient();
    if (!client) return [];

    try {
      const intervals: Record<string, { interval: string; range: number }> = {
        week: { interval: 'day', range: 7 },
        month: { interval: 'day', range: 30 },
        year: { interval: 'week', range: 365 }
      };

      const { interval, range } = intervals[period];
      const startDate = new Date(Date.now() - range * 24 * 60 * 60 * 1000);

      const response = await client.search({
        index: this.buildIndexName('events'),
        body: {
          size: 0,
          query: {
            range: {
              startDate: { gte: startDate.toISOString() }
            }
          },
          aggs: {
            trend: {
              date_histogram: {
                field: 'startDate',
                calendar_interval: interval,
                format: 'yyyy-MM-dd'
              },
              aggs: {
                moving_avg: {
                  moving_avg: {
                    buckets_path: '_count',
                    window: 3
                  }
                }
              }
            }
          }
        }
      });

      const buckets = (response.aggregations?.trend as any)?.buckets || [];
      const result: TrendData[] = buckets.map((bucket: any) => ({
        date: bucket.key_as_string,
        value: bucket.doc_count,
        movingAverage: bucket.moving_avg?.value
      }));

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('getEventTrends error:', error);
      return [];
    }
  }

  // ============ TASK AGGREGATIONS ============

  async getTasksByStatus(filters?: AggregationFilters): Promise<StatusStats[]> {
    const cacheKey = aggregationCache.buildKey('tasksByStatus', filters || {});
    const cached = aggregationCache.get<StatusStats[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = getOptionalElasticsearchClient();
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
                field: 'status.keyword',
                size: 20
              }
            }
          }
        }
      });

      const total = response.hits.total as { value: number };
      const buckets = (response.aggregations?.statuses as any)?.buckets || [];
      
      const result: StatusStats[] = buckets.map((bucket: any) => ({
        status: bucket.key,
        count: bucket.doc_count,
        percentage: Math.round((bucket.doc_count / total.value) * 100)
      }));

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('getTasksByStatus error:', error);
      return [];
    }
  }

  async getTasksByDepartment(): Promise<DepartmentStats[]> {
    const cacheKey = 'tasksByDepartment';
    const cached = aggregationCache.get<DepartmentStats[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = getOptionalElasticsearchClient();
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
                size: 100
              },
              aggs: {
                department_name: {
                  terms: { field: 'departmentName.keyword', size: 1 }
                },
                completed: {
                  filter: { term: { 'status.keyword': 'completed' } }
                }
              }
            }
          }
        }
      });

      const buckets = (response.aggregations?.departments as any)?.buckets || [];
      
      const result: DepartmentStats[] = buckets.map((bucket: any) => ({
        departmentId: bucket.key,
        departmentName: bucket.department_name?.buckets?.[0]?.key || `Department ${bucket.key}`,
        count: bucket.doc_count,
        completionRate: Math.round((bucket.completed.doc_count / bucket.doc_count) * 100)
      }));

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('getTasksByDepartment error:', error);
      return [];
    }
  }

  async getTaskCompletionRate(period: string): Promise<CompletionRate> {
    const cacheKey = aggregationCache.buildKey('taskCompletionRate', { period });
    const cached = aggregationCache.get<CompletionRate>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return { total: 0, completed: 0, rate: 0, byPeriod: [] };
    }

    const client = getOptionalElasticsearchClient();
    if (!client) return { total: 0, completed: 0, rate: 0, byPeriod: [] };

    try {
      const response = await client.search({
        index: this.buildIndexName('tasks'),
        body: {
          size: 0,
          aggs: {
            total: { value_count: { field: 'id' } },
            completed: {
              filter: { term: { 'status.keyword': 'completed' } }
            },
            by_period: {
              date_histogram: {
                field: 'createdAt',
                calendar_interval: period,
                format: 'yyyy-MM-dd'
              },
              aggs: {
                completed_in_period: {
                  filter: { term: { 'status.keyword': 'completed' } }
                }
              }
            }
          }
        }
      });

      const total = (response.aggregations?.total as any)?.value || 0;
      const completed = (response.aggregations?.completed as any)?.doc_count || 0;
      const byPeriodBuckets = (response.aggregations?.by_period as any)?.buckets || [];

      const result: CompletionRate = {
        total,
        completed,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        byPeriod: byPeriodBuckets.map((bucket: any) => ({
          period: bucket.key_as_string,
          rate: bucket.doc_count > 0 
            ? Math.round((bucket.completed_in_period.doc_count / bucket.doc_count) * 100)
            : 0
        }))
      };

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('getTaskCompletionRate error:', error);
      return { total: 0, completed: 0, rate: 0, byPeriod: [] };
    }
  }

  async getOverdueTasks(): Promise<OverdueStats> {
    const cacheKey = 'overdueTasks';
    const cached = aggregationCache.get<OverdueStats>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return { total: 0, byDays: [], byDepartment: [] };
    }

    const client = getOptionalElasticsearchClient();
    if (!client) return { total: 0, byDays: [], byDepartment: [] };

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
                { range: { dueDate: { lt: now.toISOString() } } }
              ],
              must_not: [
                { term: { 'status.keyword': 'completed' } }
              ]
            }
          },
          aggs: {
            by_days: {
              range: {
                field: 'dueDate',
                ranges: [
                  { key: '1-7 days', from: oneWeekAgo.toISOString(), to: now.toISOString() },
                  { key: '8-14 days', from: twoWeeksAgo.toISOString(), to: oneWeekAgo.toISOString() },
                  { key: '15-30 days', from: oneMonthAgo.toISOString(), to: twoWeeksAgo.toISOString() },
                  { key: '30+ days', to: oneMonthAgo.toISOString() }
                ]
              }
            },
            by_department: {
              terms: {
                field: 'departmentName.keyword',
                size: 20
              }
            }
          }
        }
      });

      const total = response.hits.total as { value: number };
      const daysBuckets = (response.aggregations?.by_days as any)?.buckets || [];
      const deptBuckets = (response.aggregations?.by_department as any)?.buckets || [];

      const result: OverdueStats = {
        total: total.value,
        byDays: daysBuckets.map((b: any) => ({
          range: b.key,
          count: b.doc_count
        })),
        byDepartment: deptBuckets.map((b: any) => ({
          departmentName: b.key,
          count: b.doc_count
        }))
      };

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('getOverdueTasks error:', error);
      return { total: 0, byDays: [], byDepartment: [] };
    }
  }

  // ============ PARTNERSHIP AGGREGATIONS ============

  async getPartnershipsByStatus(): Promise<StatusStats[]> {
    const cacheKey = 'partnershipsByStatus';
    const cached = aggregationCache.get<StatusStats[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = getOptionalElasticsearchClient();
    if (!client) return [];

    try {
      const response = await client.search({
        index: this.buildIndexName('agreements'),
        body: {
          size: 0,
          aggs: {
            statuses: {
              terms: { field: 'status.keyword', size: 20 }
            }
          }
        }
      });

      const total = response.hits.total as { value: number };
      const buckets = (response.aggregations?.statuses as any)?.buckets || [];
      
      const result: StatusStats[] = buckets.map((bucket: any) => ({
        status: bucket.key,
        count: bucket.doc_count,
        percentage: Math.round((bucket.doc_count / total.value) * 100)
      }));

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('getPartnershipsByStatus error:', error);
      return [];
    }
  }

  async getPartnershipsByCountry(): Promise<CountryStats[]> {
    const cacheKey = 'partnershipsByCountry';
    const cached = aggregationCache.get<CountryStats[]>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return [];
    }

    const client = getOptionalElasticsearchClient();
    if (!client) return [];

    try {
      const response = await client.search({
        index: this.buildIndexName('organizations'),
        body: {
          size: 0,
          aggs: {
            countries: {
              terms: { field: 'country.keyword', size: 100, missing: 'Unknown' }
            }
          }
        }
      });

      const buckets = (response.aggregations?.countries as any)?.buckets || [];
      
      const result: CountryStats[] = buckets.map((bucket: any) => ({
        country: bucket.key,
        count: bucket.doc_count
      }));

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('getPartnershipsByCountry error:', error);
      return [];
    }
  }

  // ============ CROSS-ENTITY AGGREGATIONS ============

  async getOverallActivityTrends(days = 30): Promise<ActivityTrends> {
    const cacheKey = aggregationCache.buildKey('activityTrends', { days });
    const cached = aggregationCache.get<ActivityTrends>(cacheKey);
    if (cached) return cached;

    if (!isElasticsearchEnabled()) {
      return { events: [], tasks: [], partnerships: [], contacts: [] };
    }

    const client = getOptionalElasticsearchClient();
    if (!client) return { events: [], tasks: [], partnerships: [], contacts: [] };

    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Fetch trends for all entities in parallel
      const [eventsResponse, tasksResponse, partnershipsResponse, contactsResponse] = await Promise.all([
        client.search({
          index: this.buildIndexName('events'),
          body: {
            size: 0,
            query: { range: { createdAt: { gte: startDate.toISOString() } } },
            aggs: {
              trend: {
                date_histogram: { field: 'createdAt', calendar_interval: 'day', format: 'yyyy-MM-dd' }
              }
            }
          }
        }),
        client.search({
          index: this.buildIndexName('tasks'),
          body: {
            size: 0,
            query: { range: { createdAt: { gte: startDate.toISOString() } } },
            aggs: {
              trend: {
                date_histogram: { field: 'createdAt', calendar_interval: 'day', format: 'yyyy-MM-dd' }
              }
            }
          }
        }),
        client.search({
          index: this.buildIndexName('agreements'),
          body: {
            size: 0,
            query: { range: { createdAt: { gte: startDate.toISOString() } } },
            aggs: {
              trend: {
                date_histogram: { field: 'createdAt', calendar_interval: 'day', format: 'yyyy-MM-dd' }
              }
            }
          }
        }),
        client.search({
          index: this.buildIndexName('contacts'),
          body: {
            size: 0,
            query: { range: { createdAt: { gte: startDate.toISOString() } } },
            aggs: {
              trend: {
                date_histogram: { field: 'createdAt', calendar_interval: 'day', format: 'yyyy-MM-dd' }
              }
            }
          }
        })
      ]);

      const extractTrend = (response: any): TrendData[] => {
        const buckets = response.aggregations?.trend?.buckets || [];
        return buckets.map((b: any) => ({
          date: b.key_as_string,
          value: b.doc_count
        }));
      };

      const result: ActivityTrends = {
        events: extractTrend(eventsResponse),
        tasks: extractTrend(tasksResponse),
        partnerships: extractTrend(partnershipsResponse),
        contacts: extractTrend(contactsResponse)
      };

      aggregationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('getOverallActivityTrends error:', error);
      return { events: [], tasks: [], partnerships: [], contacts: [] };
    }
  }

  // ============ HELPER METHODS ============

  private buildDateRangeQuery(filters?: AggregationFilters, dateField = 'startDate'): any {
    if (!filters?.startDate && !filters?.endDate && !filters?.departmentId) {
      return { match_all: {} };
    }

    const must: any[] = [];

    if (filters.startDate || filters.endDate) {
      const range: any = {};
      if (filters.startDate) range.gte = filters.startDate.toISOString();
      if (filters.endDate) range.lte = filters.endDate.toISOString();
      must.push({ range: { [dateField]: range } });
    }

    if (filters.departmentId) {
      must.push({ term: { departmentId: filters.departmentId } });
    }

    if (filters.status?.length) {
      must.push({ terms: { 'status.keyword': filters.status } });
    }

    if (filters.category?.length) {
      must.push({ terms: { 'category.keyword': filters.category } });
    }

    return { bool: { must } };
  }

  // Invalidate cache when data changes
  invalidateCache(entity?: string): void {
    if (entity) {
      aggregationCache.invalidate(entity);
    } else {
      aggregationCache.invalidateAll();
    }
  }
}

export const aggregationsService = new ElasticsearchAggregationsService();
```

### Analytics Routes (`server/routes/analytics.routes.ts`)
```typescript
import { Router } from 'express';
import { aggregationsService } from '../services/elasticsearch-aggregations.service';
import { isAuthenticated } from '../auth';
import { z } from 'zod';

const router = Router();

// Event analytics
router.get('/api/analytics/events/by-category', isAuthenticated, async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const result = await aggregationsService.getEventsByCategory({ startDate, endDate });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event category stats' });
  }
});

router.get('/api/analytics/events/by-month', isAuthenticated, async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const departmentId = req.query.departmentId ? parseInt(req.query.departmentId as string) : undefined;
    const result = await aggregationsService.getEventsByMonth(year, departmentId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch monthly event stats' });
  }
});

router.get('/api/analytics/events/trends', isAuthenticated, async (req, res) => {
  try {
    const period = (req.query.period as 'week' | 'month' | 'year') || 'month';
    const result = await aggregationsService.getEventTrends(period);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event trends' });
  }
});

// Task analytics
router.get('/api/analytics/tasks/by-status', isAuthenticated, async (req, res) => {
  try {
    const result = await aggregationsService.getTasksByStatus();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch task status stats' });
  }
});

router.get('/api/analytics/tasks/by-department', isAuthenticated, async (req, res) => {
  try {
    const result = await aggregationsService.getTasksByDepartment();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch department task stats' });
  }
});

router.get('/api/analytics/tasks/completion-rate', isAuthenticated, async (req, res) => {
  try {
    const period = (req.query.period as string) || 'month';
    const result = await aggregationsService.getTaskCompletionRate(period);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch completion rate' });
  }
});

router.get('/api/analytics/tasks/overdue', isAuthenticated, async (req, res) => {
  try {
    const result = await aggregationsService.getOverdueTasks();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch overdue tasks' });
  }
});

// Partnership analytics
router.get('/api/analytics/partnerships/by-status', isAuthenticated, async (req, res) => {
  try {
    const result = await aggregationsService.getPartnershipsByStatus();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch partnership status stats' });
  }
});

router.get('/api/analytics/partnerships/by-country', isAuthenticated, async (req, res) => {
  try {
    const result = await aggregationsService.getPartnershipsByCountry();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch country stats' });
  }
});

// Overview analytics
router.get('/api/analytics/overview', isAuthenticated, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const result = await aggregationsService.getOverallActivityTrends(days);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activity trends' });
  }
});

// Cache management (admin only)
router.post('/api/analytics/cache/invalidate', isAuthenticated, async (req, res) => {
  try {
    const { entity } = req.body;
    aggregationsService.invalidateCache(entity);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

export default router;
```

---

### API Endpoints
```
GET /api/analytics/events/by-category
GET /api/analytics/events/by-month?year=2024&departmentId=1
GET /api/analytics/events/trends?period=month
GET /api/analytics/tasks/by-status
GET /api/analytics/tasks/by-department
GET /api/analytics/tasks/completion-rate?period=week
GET /api/analytics/tasks/overdue
GET /api/analytics/partnerships/by-status
GET /api/analytics/partnerships/by-country
GET /api/analytics/overview?days=30
POST /api/analytics/cache/invalidate
```

### Files to Create
- `server/elasticsearch/types/aggregations.types.ts` - Type definitions
- `server/cache/aggregation-cache.ts` - In-memory cache
- `server/services/elasticsearch-aggregations.service.ts` - Aggregations service
- `server/routes/analytics.routes.ts` - API routes

### Files to Modify
- `server/routes.ts` - Mount analytics routes
- `server/services/elasticsearch-indexing.service.ts` - Invalidate cache on data changes

### Caching Strategy
- Cache aggregation results for 5 minutes (DEFAULT_TTL)
- Invalidate on data changes via `invalidateCache(entity)`
- Background refresh available for heavy queries
- Redis adapter available for production multi-instance deployments

## Acceptance Criteria
- [ ] All aggregation endpoints return data correctly
- [ ] Response times <500ms for complex queries
- [ ] Caching reduces repeated query load (5-minute TTL)
- [ ] Date histograms support timezone-aware queries
- [ ] Nested aggregations work (department → completion rate)
- [ ] Cache invalidation triggers on data changes
- [ ] Moving average calculations accurate
- [ ] Year-over-year comparisons work

## Dependencies
- Tasks 01-06 completed (data indexed in Elasticsearch)
