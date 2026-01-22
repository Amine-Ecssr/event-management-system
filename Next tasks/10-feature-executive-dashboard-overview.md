# Feature: Executive Dashboard - Overview

## Type
Feature / Analytics Dashboard

## Priority
🟠 High

## Estimated Effort
8-10 hours

## Description
Create a comprehensive executive dashboard providing holistic insights across all EventVue data. This is the main landing page for executives and management.

## Requirements

### KPI Cards Row
1. **Total Events** - This year vs last year, % change
2. **Active Partnerships** - Count with trend
3. **Tasks Completed** - This month, completion rate
4. **Contact Database** - Total contacts, growth
5. **Upcoming Events** - Next 30 days
6. **Overdue Tasks** - Urgent attention needed

### Events Overview Section
- Events by month (area chart)
- Events by category (donut chart)
- Events by type: Local vs International (bar)
- Events by scope: Internal vs External (bar)
- Expected vs Actual attendance comparison

### Tasks Performance Section
- Task completion trend (line chart)
- Tasks by status (horizontal bar)
- Tasks by priority (stacked bar)
- Tasks by department (treemap)
- Average completion time

### Partnership Health Section
- Partnerships by status (pie chart)
- Partnerships by country (map or bar)
- Agreement expiration timeline
- Partnership activity frequency
- Inactive partnership alerts

### Contact Engagement Section
- Contact growth over time
- Contacts by organization type
- Speaker utilization rate
- Event attendance patterns
- Top engaged contacts

### Department Performance Section
- Tasks completed by department
- Response time by department
- Event participation by department
- Department workload distribution

### Time-Based Filters
- This week / This month / This quarter / This year
- Custom date range
- Compare periods (YoY, MoM)

### Files to Create
- `client/src/pages/ExecutiveDashboardPage.tsx`
- `client/src/components/dashboard/KPICard.tsx`
- `client/src/components/dashboard/EventsOverview.tsx`
- `client/src/components/dashboard/TasksPerformance.tsx`
- `client/src/components/dashboard/PartnershipHealth.tsx`
- `client/src/components/dashboard/ContactEngagement.tsx`
- `client/src/components/dashboard/DepartmentPerformance.tsx`
- `client/src/components/dashboard/DashboardFilters.tsx`
- `client/src/hooks/useDashboardData.ts`

### Chart Library
Use Recharts (already in project) for all visualizations.

## Acceptance Criteria
- [ ] All KPIs load and display correctly
- [ ] Charts render with real ES data
- [ ] Time filters work across all sections
- [ ] Responsive layout on all screens
- [ ] Arabic RTL layout works
- [ ] Loading states for each section
- [ ] Error handling per section

## Dependencies
- Task 09: Aggregations Service
