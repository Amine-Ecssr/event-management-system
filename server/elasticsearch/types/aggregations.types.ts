/**
 * Elasticsearch Aggregation Types
 * 
 * Type definitions for analytics aggregations powered by Elasticsearch.
 * 
 * @module elasticsearch/types/aggregations.types
 */

/**
 * Category statistics with count and percentage
 */
export interface CategoryStats {
  category: string;
  count: number;
  percentage: number;
}

/**
 * Monthly statistics with year-over-year comparison
 */
export interface MonthlyStats {
  month: string;
  year: number;
  count: number;
  previousYearCount?: number;
  growthRate?: number;
}

/**
 * Time-series trend data point
 */
export interface TrendData {
  date: string;
  value: number;
  movingAverage?: number;
}

/**
 * Status breakdown statistics
 */
export interface StatusStats {
  status: string;
  count: number;
  percentage: number;
}

/**
 * Priority breakdown statistics
 */
export interface PriorityStats {
  priority: string;
  count: number;
  percentage: number;
}

/**
 * Department-level statistics
 */
export interface DepartmentStats {
  departmentId: number;
  departmentName: string;
  count: number;
  completionRate?: number;
}

/**
 * Country distribution statistics
 */
export interface CountryStats {
  country: string;
  countryCode?: string;
  count: number;
}

/**
 * Event type distribution
 */
export interface EventTypeStats {
  eventType: string;
  count: number;
  percentage: number;
}

/**
 * Overdue task breakdown
 */
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

/**
 * Completion rate metrics
 */
export interface CompletionRate {
  total: number;
  completed: number;
  rate: number;
  byPeriod: {
    period: string;
    rate: number;
    total: number;
    completed: number;
  }[];
}

/**
 * Cross-entity activity trends
 */
export interface ActivityTrends {
  events: TrendData[];
  tasks: TrendData[];
  partnerships: TrendData[];
  contacts: TrendData[];
}

/**
 * Event attendance statistics
 */
export interface AttendanceStats {
  eventId: number;
  eventTitle: string;
  invited: number;
  confirmed: number;
  attended: number;
  confirmationRate: number;
  attendanceRate: number;
}

/**
 * Contact engagement metrics
 */
export interface EngagementStats {
  contactId: number;
  contactName: string;
  eventsAttended: number;
  interactionsCount: number;
  lastInteraction: string | null;
  engagementScore: number;
}

/**
 * Lead stage distribution
 */
export interface LeadStageStats {
  stage: string;
  count: number;
  percentage: number;
}

/**
 * Lead source distribution
 */
export interface LeadSourceStats {
  source: string;
  count: number;
  percentage: number;
  conversionRate?: number;
}

/**
 * Organization type distribution
 */
export interface OrganizationTypeStats {
  type: string;
  count: number;
  percentage: number;
}

/**
 * Aggregation filter parameters
 */
export interface AggregationFilters {
  startDate?: Date;
  endDate?: Date;
  departmentId?: number;
  status?: string[];
  category?: string[];
  eventType?: string[];
  priority?: string[];
}

/**
 * Time period for trend analysis
 */
export type TrendPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Executive dashboard summary
 */
export interface DashboardSummary {
  totalEvents: number;
  activeEvents: number;
  upcomingEvents: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  totalPartners: number;
  activeAgreements: number;
  totalContacts: number;
  totalOrganizations: number;
  totalLeads: number;
  openLeads: number;
}

/**
 * Event metrics for dashboard
 */
export interface EventMetrics {
  byCategory: CategoryStats[];
  byType: EventTypeStats[];
  byMonth: MonthlyStats[];
  completionRate: number;
  avgDuration: number;
}

/**
 * Task metrics for dashboard
 */
export interface TaskMetrics {
  byStatus: StatusStats[];
  byPriority: PriorityStats[];
  completionTrend: TrendData[];
  avgCompletionTime: number;
  overdueRate: number;
}

/**
 * Partnership metrics for dashboard
 */
export interface PartnershipMetrics {
  byType: {
    type: string;
    count: number;
  }[];
  byStatus: StatusStats[];
  byCountry: CountryStats[];
  totalActive: number;
}

/**
 * Contact metrics for dashboard
 */
export interface ContactMetrics {
  byOrganization: {
    org: string;
    count: number;
  }[];
  growthTrend: TrendData[];
  totalWithEmail: number;
  totalWithPhone: number;
}

/**
 * Lead metrics for dashboard
 */
export interface LeadMetrics {
  byStage: LeadStageStats[];
  bySource: LeadSourceStats[];
  conversionRate: number;
  avgTimeToConvert: number;
}

/**
 * Department performance metrics
 */
export interface DepartmentPerformance {
  departmentId: number;
  departmentName: string;
  eventsCount: number;
  tasksCompleted: number;
  tasksPending: number;
  completionRate: number;
}

/**
 * Complete executive dashboard data
 */
export interface ExecutiveDashboardData {
  summary: DashboardSummary;
  eventMetrics: EventMetrics;
  taskMetrics: TaskMetrics;
  partnershipMetrics: PartnershipMetrics;
  contactMetrics: ContactMetrics;
  leadMetrics: LeadMetrics;
  departmentPerformance: DepartmentPerformance[];
  activityTrends: ActivityTrends;
}

/**
 * Cache entry metadata
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}
