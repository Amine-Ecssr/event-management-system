/**
 * Analytics Types
 * 
 * Type definitions for analytics dashboard data.
 * 
 * @module types/analytics
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
 * Event type distribution
 */
export interface EventTypeStats {
  eventType: string;
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
 * Dashboard summary counts
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
 * Lead stage distribution
 */
export interface LeadStageStats {
  stage: string;
  count: number;
  percentage: number;
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
 * KPI trend direction
 */
export type TrendDirection = 'up' | 'down' | 'neutral';

/**
 * KPI trend data
 */
export interface KPITrend {
  value: number;
  direction: TrendDirection;
}

/**
 * Chart data point
 */
export interface ChartDataPoint {
  name: string;
  value: number;
  fill?: string;
}

/**
 * Time period filter
 */
export type TimePeriod = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Analytics filter state
 */
export interface AnalyticsFilters {
  startDate: Date;
  endDate: Date;
  departmentId?: number;
  period?: TimePeriod;
}

// ============================================================================
// Partnerships Analytics Types
// ============================================================================

/**
 * Complete partnerships analytics dashboard data
 */
export interface PartnershipsAnalyticsData {
  summary: PartnershipsSummary;
  pipeline: PipelineData;
  renewalCalendar: RenewalItem[];
  agreementTypeBreakdown: AgreementTypeData[];
  partnerPerformance: PartnerPerformanceData[];
  financialMetrics: FinancialMetrics;
  monthlyTrends: PartnershipTrend[];
  recentActivity: PartnershipActivity[];
  partnersByCountry: PartnersByCountry[];
  mostActivePartners: MostActivePartner[];
  activityTypeBreakdown: ActivityTypeBreakdown[];
}

/**
 * Partnerships summary KPIs
 */
export interface PartnershipsSummary {
  totalPartnerships: number;
  activeAgreements: number;
  pendingAgreements: number;
  expiringThisMonth: number;
  expiringThisQuarter: number;
  newThisMonth: number;
  totalPartnerOrganizations: number;
  avgAgreementDuration: number;
  totalActivities: number;
  activitiesThisMonth: number;
}

/**
 * Pipeline data for Kanban view
 */
export interface PipelineData {
  draft: PipelineStage;
  pending: PipelineStage;
  active: PipelineStage;
  expiring: PipelineStage;
  expired: PipelineStage;
  renewed: PipelineStage;
}

/**
 * Pipeline stage with agreements
 */
export interface PipelineStage {
  count: number;
  value: number;
  agreements: PipelineAgreement[];
}

/**
 * Agreement in pipeline
 */
export interface PipelineAgreement {
  id: number;
  organizationName: string;
  agreementType: string;
  signedDate: string;
  expiryDate: string;
  value: number;
  status: string;
}

/**
 * Renewal calendar item with priority
 */
export interface RenewalItem {
  id: number;
  organizationName: string;
  agreementType: string;
  expiryDate: string;
  daysUntilExpiry: number;
  value: number;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Agreement type distribution data
 */
export interface AgreementTypeData {
  type: string;
  count: number;
  percentage: number;
  totalValue: number;
  avgDuration: number;
}

/**
 * Partner organization performance metrics
 */
export interface PartnerPerformanceData {
  organizationId: number;
  organizationName: string;
  totalAgreements: number;
  activeAgreements: number;
  totalValue: number;
  eventsSponsored: number;
  partnerSince: string;
  renewalRate: number;
}

/**
 * Financial metrics (placeholder)
 */
export interface FinancialMetrics {
  totalActiveValue: number;
  projectedRenewalValue: number;
  avgAgreementValue: number;
  valueByType: { type: string; value: number }[];
  monthlyRevenue: { month: string; value: number }[];
  yearOverYearGrowth: number;
}

/**
 * Monthly partnership trend data
 */
export interface PartnershipTrend {
  month: string;
  newAgreements: number;
  renewals: number;
  expirations: number;
  netChange: number;
  activities?: number;
}

/**
 * Partners grouped by country
 */
export interface PartnersByCountry {
  countryId: number;
  countryNameEn: string;
  countryNameAr: string;
  partnerCount: number;
  activeAgreements: number;
  totalActivities: number;
}

/**
 * Most active partner with activity breakdown
 */
export interface MostActivePartner {
  organizationId: number;
  organizationName: string;
  countryName: string;
  totalActivities: number;
  activeAgreements: number;
  activityBreakdown: { type: string; count: number }[];
  lastActivityDate: string | null;
}

/**
 * Activity type breakdown with percentages
 */
export interface ActivityTypeBreakdown {
  activityType: string;
  count: number;
  percentage: number;
}

/**
 * Partnership activity feed item
 */
export interface PartnershipActivity {
  id: number;
  type: 'created' | 'renewed' | 'expired' | 'updated';
  organizationName: string;
  agreementType: string;
  date: string;
  description: string;
}

// ============================================================================
// Tasks Analytics Types
// ============================================================================

/**
 * Complete tasks analytics dashboard data
 */
export interface TasksAnalyticsData {
  summary: TasksSummary;
  byStatus: TasksByStatus[];
  byPriority: TasksByPriority[];
  departmentPerformance: TaskDepartmentPerformance[];
  overdueTasks: OverdueTaskItem[];
  monthlyTrends: TaskTrend[];
  byEntity: TasksByEntity[];
  workloadDistribution: WorkloadDistribution[];
}

/**
 * Tasks summary KPIs
 */
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
  avgCompletionTime: number;
}

/**
 * Tasks grouped by status
 */
export interface TasksByStatus {
  status: string;
  count: number;
  percentage: number;
}

/**
 * Tasks grouped by priority
 */
export interface TasksByPriority {
  priority: string;
  count: number;
  percentage: number;
}

/**
 * Department performance metrics for tasks
 */
export interface TaskDepartmentPerformance {
  departmentId: number;
  departmentName: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completionRate: number;
  avgCompletionTime: number;
}

/**
 * Overdue task item
 */
export interface OverdueTaskItem {
  id: number;
  title: string;
  priority: string;
  dueDate: string;
  daysOverdue: number;
  departmentName: string | null;
  entityType: 'event' | 'lead' | 'partnership';
  entityName: string | null;
}

/**
 * Monthly task trend data
 */
export interface TaskTrend {
  month: string;
  created: number;
  completed: number;
  netChange: number;
}

/**
 * Tasks grouped by entity type
 */
export interface TasksByEntity {
  entityType: string;
  count: number;
  percentage: number;
}

/**
 * Workload distribution across departments
 */
export interface WorkloadDistribution {
  departmentId: number;
  departmentName: string;
  taskCount: number;
  percentage: number;
}

// ==================== Contacts Analytics Types ====================

/**
 * Contacts summary metrics
 */
export interface ContactsSummary {
  totalContacts: number;
  eligibleSpeakers: number;
  contactsWithEmail: number;
  contactsWithPhone: number;
  contactsWithOrganization: number;
  dataCompletenessScore: number;
  newContactsThisMonth: number;
  growthRate: number;
}

/**
 * Contacts grouped by organization
 */
export interface ContactsByOrganization {
  organizationId: number | null;
  organizationName: string;
  count: number;
  percentage: number;
}

/**
 * Contacts grouped by country
 */
export interface ContactsByCountry {
  countryId: number | null;
  countryName: string;
  countryCode: string;
  count: number;
  percentage: number;
}

/**
 * Contacts grouped by position
 */
export interface ContactsByPosition {
  positionId: number | null;
  positionName: string;
  count: number;
  percentage: number;
}

/**
 * Speaker activity metrics
 */
export interface SpeakerMetrics {
  totalSpeakers: number;
  averageEventsPerSpeaker: number;
  mostActiveSpeakers: ActiveSpeaker[];
  speakerUtilizationRate: number;
}

/**
 * Individual active speaker data
 */
export interface ActiveSpeaker {
  contactId: number;
  name: string;
  eventCount: number;
  roles: string[];
}

/**
 * Leads summary metrics
 */
export interface LeadsSummary {
  totalLeads: number;
  activeLeads: number;
  inProgressLeads: number;
  inactiveLeads: number;
  leadsByType: LeadsByType[];
  conversionRate: number;
}

/**
 * Leads grouped by type
 */
export interface LeadsByType {
  type: string;
  count: number;
  percentage: number;
}

/**
 * Interaction metrics
 */
export interface InteractionMetrics {
  totalInteractions: number;
  interactionsByType: InteractionByType[];
  monthlyTrends: InteractionTrend[];
  averageInteractionsPerLead: number;
}

/**
 * Interactions grouped by type
 */
export interface InteractionByType {
  type: string;
  count: number;
  percentage: number;
}

/**
 * Monthly interaction trend
 */
export interface InteractionTrend {
  month: string;
  emailCount: number;
  phoneCount: number;
  meetingCount: number;
  otherCount: number;
  total: number;
}

/**
 * Contact growth trend
 */
export interface ContactGrowthTrend {
  month: string;
  totalContacts: number;
  newContacts: number;
  speakersAdded: number;
}

/**
 * Full contacts analytics data
 */
export interface ContactsAnalyticsData {
  summary: ContactsSummary;
  byOrganization: ContactsByOrganization[];
  byCountry: ContactsByCountry[];
  byPosition: ContactsByPosition[];
  speakerMetrics: SpeakerMetrics;
  leadsSummary: LeadsSummary;
  interactionMetrics: InteractionMetrics;
  growthTrends: ContactGrowthTrend[];
}
