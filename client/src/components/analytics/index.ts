/**
 * Analytics Components Index
 * 
 * Barrel file exporting all analytics components.
 * 
 * @module components/analytics
 */

export { KPICard, KPICardSkeleton } from "./KPICard";
export { TrendsChart, TrendsChartSkeleton } from "./TrendsChart";
export { 
  EventsChart, 
  EventsByCategoryChart, 
  EventsByTypeChart, 
  EventsByMonthChart 
} from "./EventsChart";
export { 
  TasksChart, 
  TasksByStatusChart, 
  TasksByPriorityChart, 
  TasksByDepartmentChart,
  CompletionRateChart 
} from "./TasksChart";
export { DepartmentTable, DepartmentTableSkeleton } from "./DepartmentTable";
export { CalendarHeatmap, CalendarHeatmapSkeleton } from "./CalendarHeatmap";
export { EventTimeline, EventTimelineSkeleton } from "./EventTimeline";
export { LocationBarChart } from "./LocationBarChart";

// Partnerships Analytics Components
export { PartnershipPipeline } from "./PartnershipPipeline";
export { RenewalCalendar } from "./RenewalCalendar";
export { AgreementTypesChart } from "./AgreementTypesChart";
export { PartnerPerformanceTable } from "./PartnerPerformanceTable";
export { PartnershipTrendsChart } from "./PartnershipTrendsChart";
export { ActivityTimeline } from "./ActivityTimeline";
export { PartnersByCountryChart } from "./PartnersByCountryChart";
export { ActivityTypeChart } from "./ActivityTypeChart";
export { MostActivePartnersTable } from "./MostActivePartnersTable";

// Tasks Analytics Components
export { OverdueTasksList } from "./OverdueTasksList";
export { TaskStatusChart } from "./TaskStatusChart";
export { TaskPriorityChart } from "./TaskPriorityChart";
export { TaskTrendsChart } from "./TaskTrendsChart";
export { DepartmentPerformanceTable } from "./DepartmentPerformanceTable";
export { WorkloadChart } from "./WorkloadChart";

// Contacts Analytics Components
export { ContactGrowthChart } from "./ContactGrowthChart";
export { SpeakerUtilizationChart } from "./SpeakerUtilizationChart";
export { LeadFunnelChart } from "./LeadFunnelChart";
export { InteractionsChart } from "./InteractionsChart";
export { DataQualityCard } from "./DataQualityCard";
export { ContactsDistributionChart } from "./ContactsDistributionChart";
