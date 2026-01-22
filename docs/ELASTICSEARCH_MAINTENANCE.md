# Elasticsearch Maintenance Guide

This guide covers day-to-day maintenance, monitoring, and operational procedures for the EventVue Elasticsearch cluster.

## Table of Contents

1. [Health Monitoring](#health-monitoring)
2. [Index Management](#index-management)
3. [Backup & Restore](#backup--restore)
4. [Performance Tuning](#performance-tuning)
5. [Scaling](#scaling)
6. [Troubleshooting](#troubleshooting)

---

## Health Monitoring

### Quick Health Check

```bash
# Cluster health
curl -X GET "localhost:9200/_cluster/health?pretty"

# Expected response for healthy cluster
{
  "status": "green",           # green = all good, yellow = replicas missing, red = shards missing
  "number_of_nodes": 1,
  "active_primary_shards": 15,
  "active_shards": 15,
  "unassigned_shards": 0
}
```

### Via EventVue API

```bash
# Simple health check
curl http://localhost:5000/api/search/health

# Detailed health info
curl http://localhost:5000/api/search/health/detailed
```

### Kibana Monitoring Dashboard

Access at: https://kibana.eventcal.app

Navigate to:
1. **Stack Monitoring** → Overview of cluster health
2. **Discover** → Query and explore data
3. **Management** → Index management

### Key Metrics to Monitor

| Metric | Warning Threshold | Critical Threshold |
|--------|-------------------|-------------------|
| Cluster Status | yellow | red |
| Disk Usage | > 80% | > 90% |
| JVM Heap | > 75% | > 85% |
| Search Latency | > 200ms | > 500ms |
| Index Latency | > 100ms | > 250ms |
| Document Count | - | > 1M per index |

### Prometheus Alerts

Pre-configured alerts in `prometheus/rules/elasticsearch.yml`:

```yaml
# High-priority alerts
- ElasticsearchClusterRed          # Cluster in red state
- ElasticsearchHighDiskUsage       # Disk > 90%
- ElasticsearchHighHeapUsage       # JVM heap > 85%
- ElasticsearchIndexingBlocked     # Writes blocked

# EventVue-specific alerts
- EventVueSearchServiceUnavailable # Search API returning errors
- EventVueSearchHighLatency        # P95 latency > 2s
- EventVueReindexFailed           # Reindex job failed
```

---

## Index Management

### List All Indices

```bash
# All EventVue indices
curl "localhost:9200/_cat/indices/eventcal-*?v&s=index"

# Index details with sizes
curl "localhost:9200/_cat/indices/eventcal-*?v&h=index,docs.count,store.size"
```

### Index Lifecycle Management (ILM)

EventVue uses ILM policies for automatic index management:

```
Hot Phase (0-90 days)
  └─ Primary storage, all queries
       │
Warm Phase (91-180 days)
  └─ Read-only, force merge
       │
Cold Phase (181-365 days)
  └─ Searchable snapshot
       │
Delete Phase (365+ days)
  └─ Automatic deletion
```

#### Check ILM Status

```bash
# Policy status
curl "localhost:9200/_ilm/policy/eventcal-lifecycle?pretty"

# Index lifecycle status
curl "localhost:9200/eventcal-events-*/_ilm/explain?pretty"
```

### Manual Index Operations

#### Create Index

```bash
curl -X PUT "localhost:9200/eventcal-events-prod" -H "Content-Type: application/json" -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  }
}'
```

#### Delete Index

```bash
# Single index
curl -X DELETE "localhost:9200/eventcal-events-old"

# Pattern (dangerous!)
curl -X DELETE "localhost:9200/eventcal-*-backup"
```

#### Reindex Data

```bash
# Via API (recommended)
curl -X POST "localhost:5000/api/search/admin/reindex" \
  -H "Content-Type: application/json" \
  -d '{"entity": "events"}'

# Manual Elasticsearch reindex
curl -X POST "localhost:9200/_reindex" -H "Content-Type: application/json" -d '{
  "source": { "index": "eventcal-events-old" },
  "dest": { "index": "eventcal-events-prod" }
}'
```

#### Force Merge (Optimize)

For read-heavy indices:

```bash
curl -X POST "localhost:9200/eventcal-events-*/_forcemerge?max_num_segments=1"
```

### Index Aliases

```bash
# Create alias
curl -X POST "localhost:9200/_aliases" -H "Content-Type: application/json" -d '{
  "actions": [
    { "add": { "index": "eventcal-events-prod", "alias": "events" } }
  ]
}'

# Zero-downtime index switch
curl -X POST "localhost:9200/_aliases" -H "Content-Type: application/json" -d '{
  "actions": [
    { "remove": { "index": "eventcal-events-v1", "alias": "events" } },
    { "add": { "index": "eventcal-events-v2", "alias": "events" } }
  ]
}'
```

---

## Backup & Restore

### Automated Backups

Backups run automatically via cron using `scripts/es-backup.sh`:

```bash
# Schedule (add to crontab)
0 2 * * * /path/to/scripts/es-backup.sh >> /var/log/es-backup.log 2>&1
```

Features:
- Creates MinIO/S3 repository
- Backs up all EventVue indices
- Retains 30 days of backups
- Automatic cleanup of old snapshots

### Manual Backup

```bash
# Run backup script
./scripts/es-backup.sh

# Or via API
curl -X POST "localhost:9200/_snapshot/eventcal-backup/snapshot-$(date +%Y%m%d)?wait_for_completion=true"
```

### View Snapshots

```bash
# List all snapshots
curl "localhost:9200/_snapshot/eventcal-backup/_all?pretty"

# Snapshot details
curl "localhost:9200/_snapshot/eventcal-backup/snapshot-20240115?pretty"
```

### Restore

Use the interactive restore script:

```bash
./scripts/es-restore.sh
```

Options:
1. **List snapshots** - View available backups
2. **Restore all** - Full cluster restore
3. **Restore specific indices** - Selective restore
4. **Point-in-time restore** - Restore to specific snapshot

Manual restore:

```bash
# Close indices first (if restoring over existing)
curl -X POST "localhost:9200/eventcal-events-*/_close"

# Restore
curl -X POST "localhost:9200/_snapshot/eventcal-backup/snapshot-20240115/_restore" \
  -H "Content-Type: application/json" -d '{
    "indices": "eventcal-*",
    "ignore_unavailable": true,
    "include_global_state": false
  }'
```

### Verify Backup Integrity

```bash
curl -X POST "localhost:9200/_snapshot/eventcal-backup/snapshot-20240115/_verify"
```

---

## Performance Tuning

### JVM Settings

Production settings in `elasticsearch-prod.yml`:

```yaml
# JVM heap (set to 50% of available RAM, max 31GB)
ES_JAVA_OPTS: "-Xms4g -Xmx4g"

# Disable swapping
bootstrap.memory_lock: true
```

### Index Settings

```json
{
  "settings": {
    "index": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "refresh_interval": "1s",
      "max_result_window": 10000
    }
  }
}
```

Tuning for write-heavy workloads:

```bash
# Increase refresh interval during bulk imports
curl -X PUT "localhost:9200/eventcal-events-*/_settings" -H "Content-Type: application/json" -d '{
  "index": {
    "refresh_interval": "30s"
  }
}'

# Reset after import
curl -X PUT "localhost:9200/eventcal-events-*/_settings" -H "Content-Type: application/json" -d '{
  "index": {
    "refresh_interval": "1s"
  }
}'
```

### Query Cache

```bash
# Clear query cache
curl -X POST "localhost:9200/eventcal-*/_cache/clear?query=true"

# View cache stats
curl "localhost:9200/_nodes/stats/indices/query_cache?pretty"
```

### Slow Query Log

Enabled in production to identify slow queries:

```yaml
index.search.slowlog.threshold.query.warn: 5s
index.search.slowlog.threshold.query.info: 2s
index.search.slowlog.threshold.fetch.warn: 1s
```

View slow queries:

```bash
# In Elasticsearch logs
tail -f /var/log/elasticsearch/eventcal_index_search_slowlog.log
```

---

## Scaling

### Horizontal Scaling

Add more nodes to the cluster:

```yaml
# docker-compose.prod.yml
elasticsearch-2:
  image: elasticsearch:8.12.0
  environment:
    - node.name=es-node-2
    - discovery.seed_hosts=elasticsearch-1
    - cluster.initial_master_nodes=es-node-1,es-node-2
```

### Shard Allocation

```bash
# View shard allocation
curl "localhost:9200/_cat/shards/eventcal-*?v"

# Disable allocation temporarily
curl -X PUT "localhost:9200/_cluster/settings" -H "Content-Type: application/json" -d '{
  "transient": {
    "cluster.routing.allocation.enable": "none"
  }
}'

# Re-enable
curl -X PUT "localhost:9200/_cluster/settings" -H "Content-Type: application/json" -d '{
  "transient": {
    "cluster.routing.allocation.enable": "all"
  }
}'
```

### Index Splitting

For large indices:

```bash
# Split into 2 shards
curl -X POST "localhost:9200/eventcal-events-prod/_split/eventcal-events-prod-split" \
  -H "Content-Type: application/json" -d '{
    "settings": {
      "index.number_of_shards": 2
    }
  }'
```

---

## Troubleshooting

### Common Issues

#### Cluster Status Yellow/Red

```bash
# Check unassigned shards
curl "localhost:9200/_cat/shards?v&h=index,shard,prirep,state,unassigned.reason"

# Explain unassigned shards
curl "localhost:9200/_cluster/allocation/explain?pretty"
```

**Solutions:**
- Yellow (missing replicas): Add nodes or reduce replicas
- Red (missing primaries): Restore from backup

#### High Disk Usage

```bash
# Check disk usage
curl "localhost:9200/_cat/allocation?v"

# Force merge to reduce size
curl -X POST "localhost:9200/eventcal-*/_forcemerge?max_num_segments=1"

# Delete old indices
curl -X DELETE "localhost:9200/eventcal-*-archive-2022"
```

#### High Memory/CPU

```bash
# Check hot threads
curl "localhost:9200/_nodes/hot_threads"

# Cancel long-running tasks
curl "localhost:9200/_tasks?detailed=true"
curl -X POST "localhost:9200/_tasks/<task_id>/_cancel"
```

#### Search Timeouts

```bash
# Increase timeout
curl "localhost:9200/eventcal-*/_search?timeout=30s" -d '...'

# Check slow log
tail -f /var/log/elasticsearch/*_slowlog.log
```

#### Connection Refused

```bash
# Check if ES is running
curl localhost:9200

# Check logs
docker logs elasticsearch

# Common causes:
# - JVM OOM (increase heap)
# - Disk full (clear space)
# - Network issues (check firewall)
```

### Diagnostic Commands

```bash
# Full cluster state
curl "localhost:9200/_cluster/state?pretty"

# Node info
curl "localhost:9200/_nodes?pretty"

# Pending tasks
curl "localhost:9200/_cluster/pending_tasks"

# Thread pool stats
curl "localhost:9200/_nodes/stats/thread_pool?pretty"
```

### Recovery Procedures

#### Corrupt Index

```bash
# 1. Try to repair
curl -X POST "localhost:9200/eventcal-events-prod/_close"
curl -X POST "localhost:9200/eventcal-events-prod/_open"

# 2. If repair fails, restore from backup
./scripts/es-restore.sh

# 3. If no backup, reindex from PostgreSQL
curl -X POST "localhost:5000/api/search/admin/reindex" \
  -d '{"entity": "events"}'
```

#### Full Cluster Recovery

See [ES_DISASTER_RECOVERY.md](./ES_DISASTER_RECOVERY.md) for complete disaster recovery procedures.

---

## Maintenance Schedule

### Daily
- [ ] Check cluster health
- [ ] Review Prometheus alerts
- [ ] Verify backup completion

### Weekly
- [ ] Review slow query logs
- [ ] Check disk usage trends
- [ ] Validate recent backups

### Monthly
- [ ] Review and optimize slow queries
- [ ] Update analyzer dictionaries
- [ ] Test restore procedure
- [ ] Review index sizes and retention

### Quarterly
- [ ] Full backup restore test
- [ ] Performance benchmark
- [ ] Review ILM policies
- [ ] Update Elasticsearch version (if needed)

---

## Related Documentation

- [ES_PRODUCTION.md](./ES_PRODUCTION.md) - Production deployment
- [ES_DISASTER_RECOVERY.md](./ES_DISASTER_RECOVERY.md) - DR procedures
- [ELASTICSEARCH_ARCHITECTURE.md](./ELASTICSEARCH_ARCHITECTURE.md) - System architecture
