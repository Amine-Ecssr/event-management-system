# Feature: Executive Dashboard - Events Analytics

## Type
Feature / Analytics Dashboard

## Priority
🟡 Medium

## Estimated Effort
6-8 hours

## Description
Deep-dive analytics dashboard focused on events. Provides detailed insights into event performance, attendance patterns, and trends.

## Requirements

### Event Metrics
- Total events (YTD, MTD, WTD)
- Events by category breakdown
- Events by type (local/international)
- Events by scope (internal/external)
- Cancelled/postponed events

### Attendance Analytics
- Expected vs actual attendance rate
- Attendance trends over time
- Top attended events
- Attendance by category
- Invitee conversion rate (invited → attended)
- RSVP response rates

### Event Timeline
- Calendar heatmap (events per day)
- Seasonal patterns analysis
- Busy periods identification
- Event clustering analysis

### Speaker Analytics
- Most active speakers
- Speaker event participation
- Speaker organization distribution
- Speaker topic coverage

### Event Performance Scores
- Engagement score per event
- Task completion rate per event
- Media coverage (photos/videos)
- Stakeholder participation

### Archive Insights
- Archived events comparison
- Historical trends
- Year-over-year analysis
- Impact and outcomes summary

### Filters
- Date range
- Category
- Event type
- Event scope
- Department
- Organizer

### Files to Create
- `client/src/pages/EventsAnalyticsPage.tsx`
- `client/src/components/analytics/AttendanceCharts.tsx`
- `client/src/components/analytics/EventHeatmap.tsx`
- `client/src/components/analytics/SpeakerAnalytics.tsx`
- `client/src/components/analytics/EventPerformanceTable.tsx`

## Acceptance Criteria
- [ ] All event metrics display correctly
- [ ] Attendance comparison charts work
- [ ] Calendar heatmap visualizes event density
- [ ] Speaker analytics show participation
- [ ] Filters work together
- [ ] Export to PDF/Excel option

## Dependencies
- Task 10: Executive Dashboard Overview
