# EventCal Kibana Dashboards

This directory contains Kibana saved objects (dashboards, index patterns) for monitoring and analyzing EventCal data in Elasticsearch.

## 📁 Directory Structure

```
kibana/
├── README.md                    # This file
├── import-dashboards.sh         # Automated import script
├── index-patterns/              # Index pattern definitions
│   ├── eventcal-events.ndjson   # Events index pattern
│   ├── eventcal-tasks.ndjson    # Tasks index pattern
│   ├── eventcal-contacts.ndjson # Contacts index pattern
│   └── eventcal-all.ndjson      # All indices pattern (eventcal-*)
├── dashboards/                  # Dashboard definitions
│   ├── health-monitoring.ndjson # Cluster health dashboard
│   ├── data-quality.ndjson      # Data quality metrics
│   ├── search-analytics.ndjson  # Search query analytics
│   ├── index-management.ndjson  # Index statistics
│   └── executive-overview.ndjson # Executive KPI dashboard
└── spaces/
    └── eventcal-space.json      # Kibana space configuration
```

## 🚀 Quick Start

### Prerequisites

1. Elasticsearch 8.x running with EventCal indices created
2. Kibana 8.x running and connected to Elasticsearch
3. EventCal data indexed (run sync first if needed)

### Import Dashboards

**Option 1: Using the Import Script (Recommended)**

```bash
# Make the script executable
chmod +x kibana/import-dashboards.sh

# Run with default Kibana URL (http://localhost:5601)
./kibana/import-dashboards.sh

# Or specify custom Kibana URL
./kibana/import-dashboards.sh http://your-kibana-host:5601
```

**Option 2: Manual Import via Kibana UI**

1. Open Kibana: http://localhost:5601
2. Go to **Stack Management** → **Saved Objects**
3. Click **Import**
4. Import files in this order:
   - All files from `index-patterns/` first
   - All files from `dashboards/` second
5. Enable "Automatically overwrite conflicts"

## 📊 Available Dashboards

### 1. Health Monitoring (`health-monitoring.ndjson`)

Monitor Elasticsearch cluster health and performance.

**Panels:**
- Cluster status (green/yellow/red)
- Node health metrics
- Index count and document totals
- JVM memory usage
- CPU and disk utilization
- Recent indexing activity

**Use Cases:**
- System health checks
- Performance monitoring
- Capacity planning

### 2. Data Quality (`data-quality.ndjson`)

Track data completeness and quality across indices.

**Panels:**
- Records with missing fields
- Field population rates
- Data freshness metrics
- Validation error counts
- Quality trends over time

**Use Cases:**
- Data governance
- Quality assurance
- Identifying gaps in data entry

### 3. Search Analytics (`search-analytics.ndjson`)

Analyze search patterns and query performance.

**Panels:**
- Total search volume
- Average response time
- Popular search terms
- Zero-result queries
- Search trends by time
- Query latency distribution

**Use Cases:**
- Search optimization
- User behavior analysis
- Performance tuning

### 4. Index Management (`index-management.ndjson`)

Monitor index sizes, document counts, and storage.

**Panels:**
- Storage by index
- Document counts per index
- Shard overview
- Index statistics table
- Field cardinality
- Field type distribution

**Use Cases:**
- Storage planning
- Index optimization
- Schema analysis

### 5. Executive Overview (`executive-overview.ndjson`)

High-level KPIs and business metrics.

**Panels:**
- Total events, tasks, contacts, partnerships
- Events timeline by status
- Tasks by status and priority
- Department performance
- Contact growth trends
- Partnership distribution
- Recent activities table

**Use Cases:**
- Management reporting
- Business intelligence
- KPI tracking

## 🔧 Index Patterns

| Pattern | Description | Time Field |
|---------|-------------|------------|
| `eventcal-events` | Event documents only | `startDate` |
| `eventcal-tasks` | Task documents only | `createdAt` |
| `eventcal-contacts` | Contact documents only | `createdAt` |
| `eventcal-*` | All EventCal indices | `@timestamp` |

## ⚙️ Configuration

### Kibana Space

The import script can create a dedicated "EventCal" space in Kibana for better organization. Edit `spaces/eventcal-space.json` to customize:

```json
{
  "id": "eventcal",
  "name": "EventCal",
  "description": "EventVue Event Calendar and Management System",
  "color": "#2563eb",
  "initials": "EC"
}
```

### Refresh Intervals

Default refresh intervals for dashboards:
- Health Monitoring: 30 seconds
- Data Quality: 5 minutes
- Search Analytics: 5 minutes
- Index Management: 5 minutes
- Executive Overview: 1 minute

## 🔐 Security Notes

- If Kibana authentication is enabled, the import script may require credentials
- For secured clusters, use:
  ```bash
  curl -u username:password -X POST "..."
  ```
- Or set up API keys for automation

## 🐛 Troubleshooting

### Import Fails with "Unauthorized"

Add authentication to the import script or use Kibana UI import.

### Index Pattern Shows No Data

1. Verify indices exist: `GET /_cat/indices/eventcal-*`
2. Check index has documents: `GET /eventcal-events/_count`
3. Verify time field matches your data

### Dashboard Shows "No Results"

1. Adjust time range in Kibana
2. Check that data exists in the index
3. Verify index pattern is correctly configured

### Script Permission Denied

```bash
chmod +x kibana/import-dashboards.sh
```

## 📝 Customization

### Adding New Dashboards

1. Create dashboard in Kibana UI
2. Export via **Stack Management** → **Saved Objects** → **Export**
3. Save `.ndjson` file to `dashboards/` directory

### Modifying Existing Dashboards

1. Import dashboard to Kibana
2. Edit in Kibana UI
3. Export updated version
4. Replace file in `dashboards/` directory

## 📚 Related Documentation

- [Elasticsearch Setup](../docs/SETUP.md)
- [Architecture Overview](../docs/ARCHITECTURE.md)
- [Search Service](../server/services/elasticsearch-search.service.ts)
- [Analytics Dashboard](../client/src/pages/analytics/)
