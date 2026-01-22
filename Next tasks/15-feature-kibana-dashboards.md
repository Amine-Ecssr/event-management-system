# Feature: Kibana Dashboard Integration

## Type
Feature / DevOps / Analytics

## Priority
🟢 Low

## Estimated Effort
4-5 hours

## Description
Create pre-built Kibana dashboards for development, monitoring, and analytics. These dashboards help administrators monitor ES health, query performance, and provide visual analytics. In production, Kibana is accessible at `kibana.eventcal.app`.

## Access Points
- **Development**: `http://localhost:5601`
- **Production**: `https://kibana.eventcal.app` (auto-SSL via nginx-proxy)

## Index Pattern Configuration
All dashboards use the configurable index prefix:
- Pattern: `eventcal-*` (matches all EventCal indices)
- Individual patterns: `eventcal-events-*`, `eventcal-tasks-*`, etc.

## Requirements

### Health Monitoring Dashboard
- Cluster health status (green/yellow/red)
- Node statistics (CPU, memory, disk)
- Index sizes and document counts
- Query latency metrics (p50, p95, p99)
- Indexing rate and throughput
- Shard allocation status

### Data Quality Dashboard
- Document counts per index
- Missing field analysis
- Data freshness (last indexed timestamp)
- Orphaned documents detection
- Sync status with PostgreSQL
- Field mapping conflicts

### Search Analytics Dashboard
- Popular search queries (top 100)
- Zero-result queries (for content gap analysis)
- Search latency distribution
- Query patterns by time of day
- Filter usage analytics
- Autocomplete suggestions analysis

### Index Management Dashboard
- Index statistics (size, docs, deleted)
- Mapping analysis (field types, analyzers)
- Field cardinality (unique values)
- Storage analysis by index
- Refresh/flush statistics
- Segment information

### Executive Overview Dashboard
- Events by category (pie chart)
- Tasks by status (donut chart)
- Partnerships by type (bar chart)
- Monthly event trends (line chart)
- Contact growth over time
- Lead conversion funnel

### Saved Searches
- Recent events (last 7 days)
- Overdue tasks (status != completed, dueDate < now)
- Active partnerships (status = active)
- Contact lookup (full-text search)
- Upcoming renewals (agreements expiring in 90 days)

---

## Complete Implementation

### Kibana Index Patterns Configuration (`kibana/index-patterns/`)

#### `eventcal-events.ndjson`
```json
{"attributes":{"fieldFormatMap":"{}","name":"eventcal-events-*","runtimeFieldMap":"{}","sourceFilters":"[]","timeFieldName":"createdAt","title":"eventcal-events-*","typeMeta":"{}"},"coreMigrationVersion":"8.8.0","created_at":"2024-01-01T00:00:00.000Z","id":"eventcal-events-pattern","managed":false,"references":[],"type":"index-pattern","typeMigrationVersion":"8.0.0","updated_at":"2024-01-01T00:00:00.000Z","version":"WzEsMV0="}
```

#### `eventcal-tasks.ndjson`
```json
{"attributes":{"fieldFormatMap":"{}","name":"eventcal-tasks-*","runtimeFieldMap":"{}","sourceFilters":"[]","timeFieldName":"createdAt","title":"eventcal-tasks-*","typeMeta":"{}"},"coreMigrationVersion":"8.8.0","created_at":"2024-01-01T00:00:00.000Z","id":"eventcal-tasks-pattern","managed":false,"references":[],"type":"index-pattern","typeMigrationVersion":"8.0.0","updated_at":"2024-01-01T00:00:00.000Z","version":"WzEsMV0="}
```

### Dashboard Exports

#### Health Monitoring Dashboard (`kibana/dashboards/health-monitoring.ndjson`)
```json
{"attributes":{"description":"Elasticsearch cluster health and performance monitoring","kibanaSavedObjectMeta":{"searchSourceJSON":"{}"},"optionsJSON":"{\"useMargins\":true,\"syncColors\":false,\"syncCursor\":true,\"syncTooltips\":false,\"hidePanelTitles\":false}","panelsJSON":"[{\"type\":\"lens\",\"gridData\":{\"x\":0,\"y\":0,\"w\":12,\"h\":8,\"i\":\"1\"},\"panelIndex\":\"1\",\"embeddableConfig\":{\"attributes\":{\"title\":\"Cluster Status\",\"visualizationType\":\"metric\"}},\"title\":\"Cluster Health\"},{\"type\":\"lens\",\"gridData\":{\"x\":12,\"y\":0,\"w\":12,\"h\":8,\"i\":\"2\"},\"panelIndex\":\"2\",\"embeddableConfig\":{\"attributes\":{\"title\":\"Document Counts\",\"visualizationType\":\"bar\"}},\"title\":\"Documents by Index\"},{\"type\":\"lens\",\"gridData\":{\"x\":24,\"y\":0,\"w\":12,\"h\":8,\"i\":\"3\"},\"panelIndex\":\"3\",\"embeddableConfig\":{\"attributes\":{\"title\":\"Query Latency\",\"visualizationType\":\"line\"}},\"title\":\"Query Performance\"}]","refreshInterval":{"pause":false,"value":30000},"timeFrom":"now-24h","timeTo":"now","title":"EventCal Health Monitoring","version":1},"id":"eventcal-health-dashboard","type":"dashboard"}
```

### Import Script (`kibana/import-dashboards.sh`)
```bash
#!/bin/bash
# Import Kibana dashboards

KIBANA_URL="${KIBANA_URL:-http://localhost:5601}"
KIBANA_USER="${KIBANA_USER:-elastic}"
KIBANA_PASSWORD="${KIBANA_PASSWORD:-}"

echo "Importing Kibana dashboards to $KIBANA_URL..."

# Wait for Kibana to be ready
until curl -sf "$KIBANA_URL/api/status" > /dev/null; do
  echo "Waiting for Kibana..."
  sleep 5
done

# Import index patterns
for file in kibana/index-patterns/*.ndjson; do
  echo "Importing index pattern: $file"
  curl -X POST "$KIBANA_URL/api/saved_objects/_import?overwrite=true" \
    -H "kbn-xsrf: true" \
    -u "$KIBANA_USER:$KIBANA_PASSWORD" \
    --form file=@"$file"
done

# Import dashboards
for file in kibana/dashboards/*.ndjson; do
  echo "Importing dashboard: $file"
  curl -X POST "$KIBANA_URL/api/saved_objects/_import?overwrite=true" \
    -H "kbn-xsrf: true" \
    -u "$KIBANA_USER:$KIBANA_PASSWORD" \
    --form file=@"$file"
done

echo "Dashboard import complete!"
```

### Kibana Space Configuration (`kibana/spaces/eventcal-space.json`)
```json
{
  "id": "eventcal",
  "name": "EventCal Analytics",
  "description": "Event management analytics and monitoring",
  "color": "#2563EB",
  "initials": "EC",
  "disabledFeatures": []
}
```

---

## Security Configuration for Production

### Restrict Kibana Access

Add to nginx configuration for additional security:

```nginx
# Rate limiting for Kibana
limit_req_zone $binary_remote_addr zone=kibana_limit:10m rate=10r/s;

server {
    server_name kibana.eventcal.app;
    
    # Optional: IP whitelist for admin access
    # allow 192.168.1.0/24;
    # deny all;
    
    location / {
        limit_req zone=kibana_limit burst=20 nodelay;
        proxy_pass http://kibana:5601;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Create Read-Only User for Analysts

```bash
# Create analyst role
curl -X PUT "localhost:9200/_security/role/eventcal_analyst" \
  -H "Content-Type: application/json" \
  -u elastic:$ES_PASSWORD \
  -d '{
    "cluster": ["monitor"],
    "indices": [
      {
        "names": ["eventcal-*"],
        "privileges": ["read", "view_index_metadata"]
      }
    ],
    "applications": [
      {
        "application": "kibana-.kibana",
        "privileges": ["feature_dashboard.read", "feature_discover.read"],
        "resources": ["space:eventcal"]
      }
    ]
  }'

# Create analyst user
curl -X POST "localhost:9200/_security/user/analyst" \
  -H "Content-Type: application/json" \
  -u elastic:$ES_PASSWORD \
  -d '{
    "password": "analyst-secure-password",
    "roles": ["eventcal_analyst", "kibana_admin"],
    "full_name": "EventCal Analyst"
  }'
```

---

### Files to Create
- `kibana/index-patterns/eventcal-events.ndjson`
- `kibana/index-patterns/eventcal-tasks.ndjson`
- `kibana/index-patterns/eventcal-contacts.ndjson`
- `kibana/index-patterns/eventcal-all.ndjson` (eventcal-*)
- `kibana/dashboards/health-monitoring.ndjson`
- `kibana/dashboards/data-quality.ndjson`
- `kibana/dashboards/search-analytics.ndjson`
- `kibana/dashboards/index-management.ndjson`
- `kibana/dashboards/executive-overview.ndjson`
- `kibana/spaces/eventcal-space.json`
- `kibana/import-dashboards.sh`
- `kibana/README.md` - Import instructions

## Acceptance Criteria
- [ ] All dashboards importable to Kibana
- [ ] Health dashboard shows cluster status
- [ ] Data quality identifies issues
- [ ] Search analytics captures queries
- [ ] Executive overview provides business insights
- [ ] Documentation for import process
- [ ] Production subdomain (kibana.eventcal.app) documented
- [ ] Security configuration for read-only analysts

## Dependencies
- Task 01: Docker Setup (Kibana with subdomain)
- Task 05-06: Data indexed
- Task 20: Documentation
