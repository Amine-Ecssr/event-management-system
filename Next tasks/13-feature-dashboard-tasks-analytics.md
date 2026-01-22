# Feature: Executive Dashboard - Tasks & Operations Analytics

## Type
Feature / Analytics Dashboard

## Priority
🟡 Medium

## Estimated Effort
5-6 hours

## Description
Analytics dashboard for task management and operational efficiency metrics across departments.

## Requirements

### Task Metrics
- Total tasks by status
- Completion rate (overall, by department)
- Overdue tasks count and list
- Average time to completion
- Tasks created vs completed trend

### Department Performance
- Tasks by department
- Completion rate by department
- Average response time by department
- Department workload distribution
- Top performing departments

### Priority Analysis
- Tasks by priority level
- High priority completion rate
- Priority distribution over time
- Escalation patterns

### Timeline Analysis
- Task completion trend (daily/weekly/monthly)
- Due date adherence
- Lead time analysis
- Bottleneck identification

### Workflow Insights
- Tasks by parent entity (event/lead/partnership)
- Dependency chain completion
- Blocked tasks analysis
- Waiting status patterns

### Productivity Metrics
- Tasks per user (if applicable)
- Peak activity times
- Completion velocity
- Capacity utilization

### Files to Create
- `client/src/pages/TasksAnalyticsPage.tsx`
- `client/src/components/analytics/TaskStatusChart.tsx`
- `client/src/components/analytics/DepartmentPerformanceChart.tsx`
- `client/src/components/analytics/TaskTimelineChart.tsx`
- `client/src/components/analytics/OverdueTasksList.tsx`
- `client/src/components/analytics/ProductivityMetrics.tsx`

## Acceptance Criteria
- [ ] Task status breakdown accurate
- [ ] Department metrics calculated correctly
- [ ] Overdue detection working
- [ ] Timeline charts render correctly
- [ ] Performance comparisons work
- [ ] Drill-down to task details

## Dependencies
- Task 10: Executive Dashboard Overview
