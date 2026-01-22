# Elasticsearch Disaster Recovery Guide

This guide provides step-by-step procedures for recovering from various Elasticsearch failures in the EventVue system.

## Table of Contents

1. [Incident Classification](#incident-classification)
2. [Recovery Procedures](#recovery-procedures)
3. [Data Reconstruction](#data-reconstruction)
4. [Communication Templates](#communication-templates)
5. [Post-Incident Review](#post-incident-review)

---

## Incident Classification

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P1 - Critical** | Complete search unavailable | < 15 min | Cluster down, all nodes failed |
| **P2 - High** | Partial functionality loss | < 1 hour | Single node down, data loss |
| **P3 - Medium** | Degraded performance | < 4 hours | Yellow cluster, slow queries |
| **P4 - Low** | Minor issues | < 24 hours | Single index corruption |

### Impact Assessment Matrix

```
┌─────────────────┬───────────────────────────────────────────────┐
│     Status      │                   Impact                      │
├─────────────────┼───────────────────────────────────────────────┤
│ ES Cluster RED  │ • Search completely unavailable               │
│                 │ • New data not being indexed                  │
│                 │ • PostgreSQL still operational                │
├─────────────────┼───────────────────────────────────────────────┤
│ ES Cluster YELLOW│ • Search functional but degraded             │
│                 │ • No data redundancy                          │
│                 │ • Risk of data loss if node fails             │
├─────────────────┼───────────────────────────────────────────────┤
│ Sync Lag > 5min │ • Search results may be stale                 │
│                 │ • New events not immediately searchable       │
│                 │ • Edits not reflected in search               │
├─────────────────┼───────────────────────────────────────────────┤
│ Index Missing   │ • Specific entity type not searchable         │
│                 │ • 404 errors for that entity search           │
│                 │ • Can be rebuilt from PostgreSQL              │
└─────────────────┴───────────────────────────────────────────────┘
```

---

## Recovery Procedures

### Scenario 1: Complete Cluster Failure

**Symptoms:**
- All ES nodes unreachable
- API returns connection refused
- Search completely unavailable

**Recovery Steps:**

```bash
# 1. Check container status
docker ps -a | grep elasticsearch
docker logs elasticsearch --tail 100

# 2. Check disk space
df -h /var/lib/elasticsearch

# 3. Check system resources
free -h
top -bn1 | head -20

# 4. Attempt restart
docker compose -f docker-compose.yml restart elasticsearch

# 5. If restart fails, check for data corruption
docker run --rm -v elasticsearch_data:/data alpine ls -la /data

# 6. If data is corrupt, restore from backup
./scripts/es-restore.sh  # List available backups
./scripts/es-restore.sh snapshot-YYYY-MM-DD

# 7. If no backup available, rebuild from PostgreSQL
curl -X POST http://localhost:3000/api/admin/elasticsearch/reindex \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Scenario 2: Single Node Failure (Multi-Node Cluster)

**Symptoms:**
- Cluster status YELLOW
- One node missing from cluster
- Unassigned replica shards

**Recovery Steps:**

```bash
# 1. Identify failed node
curl -s "http://localhost:9200/_cat/nodes?v"
curl -s "http://localhost:9200/_cluster/health?pretty"

# 2. Check the specific node
docker logs es-node-2 --tail 100

# 3. If recoverable, restart the node
docker restart es-node-2

# 4. Wait for cluster to rebalance (monitor)
watch -n 5 'curl -s "http://localhost:9200/_cat/shards?v&h=index,shard,prirep,state,node" | grep -v STARTED'

# 5. If node is unrecoverable, remove from cluster
curl -X PUT "http://localhost:9200/_cluster/settings" -H "Content-Type: application/json" -d '{
  "transient": {
    "cluster.routing.allocation.exclude._name": "failed-node-name"
  }
}'

# 6. Add replacement node and re-enable allocation
# (Refer to production deployment guide)
```

### Scenario 3: Index Corruption

**Symptoms:**
- Specific index shows RED status
- Queries to index fail with errors
- Other indices working normally

**Recovery Steps:**

```bash
# 1. Identify corrupted index
curl -s "http://localhost:9200/_cat/indices?v&health=red"

# 2. Check shard status
curl -s "http://localhost:9200/_cat/shards/eventcal-events?v"

# 3. Try to close and reopen
curl -X POST "http://localhost:9200/eventcal-events/_close"
curl -X POST "http://localhost:9200/eventcal-events/_open"

# 4. If still corrupt, delete and recreate
curl -X DELETE "http://localhost:9200/eventcal-events"

# 5. Recreate index with correct mapping
curl -X PUT "http://localhost:9200/eventcal-events" -H "Content-Type: application/json" \
  -d @server/elasticsearch/mappings/events.json

# 6. Reindex from PostgreSQL
curl -X POST "http://localhost:3000/api/admin/elasticsearch/reindex/events" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Scenario 4: Sync Failure / Data Drift

**Symptoms:**
- Search results don't match database
- Newly created items not appearing
- Deleted items still showing in search

**Recovery Steps:**

```bash
# 1. Check sync status
curl -s "http://localhost:3000/api/admin/elasticsearch/sync-status" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 2. Check cron job status
docker logs app --tail 50 | grep -i "sync\|cron\|elasticsearch"

# 3. Run incremental sync manually
curl -X POST "http://localhost:3000/api/admin/elasticsearch/sync" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. If incremental sync doesn't resolve, compare counts
curl -s "http://localhost:3000/api/admin/elasticsearch/stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 5. For large drift (>100 docs), run full reindex
curl -X POST "http://localhost:3000/api/admin/elasticsearch/reindex" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deleteExisting": true}'

# 6. Clean up orphaned documents
curl -X POST "http://localhost:3000/api/admin/elasticsearch/cleanup" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Scenario 5: Performance Degradation

**Symptoms:**
- Search queries taking >2 seconds
- High heap usage (>90%)
- Thread pool rejections

**Recovery Steps:**

```bash
# 1. Check current performance
curl -s "http://localhost:9200/_nodes/stats/jvm,thread_pool?pretty"

# 2. Clear caches
curl -X POST "http://localhost:9200/_cache/clear"

# 3. Force merge indices (reduces segments)
curl -X POST "http://localhost:9200/eventcal-*/_forcemerge?max_num_segments=1"

# 4. If heap is critical, restart ES
docker restart elasticsearch

# 5. For ongoing issues, analyze slow queries
tail -f /var/log/elasticsearch/eventvue_search_slowlog.json

# 6. Consider scaling or optimizing
# - Increase heap (max 31GB)
# - Add more nodes
# - Optimize queries
```

---

## Data Reconstruction

### Full Rebuild from PostgreSQL

If all Elasticsearch data is lost and no backups are available:

```bash
# 1. Ensure PostgreSQL is healthy
docker exec -it postgres psql -U eventvue -c "SELECT count(*) FROM events;"

# 2. Delete all ES indices
curl -X DELETE "http://localhost:9200/eventcal-*"

# 3. Recreate indices with mappings
curl -X POST "http://localhost:3000/api/admin/elasticsearch/setup" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Run full reindex (may take several minutes)
curl -X POST "http://localhost:3000/api/admin/elasticsearch/reindex" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deleteExisting": false, "batchSize": 500}'

# 5. Monitor progress
watch -n 10 'curl -s "http://localhost:9200/_cat/count/eventcal-*?v"'

# 6. Verify counts match
curl -s "http://localhost:3000/api/admin/elasticsearch/stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Partial Reconstruction

To rebuild specific entity types:

```bash
# Rebuild only events
curl -X POST "http://localhost:3000/api/admin/elasticsearch/reindex/events" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Rebuild only contacts
curl -X POST "http://localhost:3000/api/admin/elasticsearch/reindex/contacts" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Rebuild only partnerships
curl -X POST "http://localhost:3000/api/admin/elasticsearch/reindex/partnerships" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Data Validation Script

```bash
#!/bin/bash
# validate-es-data.sh - Validates ES data against PostgreSQL

echo "Validating Elasticsearch data integrity..."

# Get counts from PostgreSQL
PG_EVENTS=$(docker exec postgres psql -U eventvue -t -c "SELECT count(*) FROM events WHERE deleted_at IS NULL;")
PG_CONTACTS=$(docker exec postgres psql -U eventvue -t -c "SELECT count(*) FROM contacts WHERE deleted_at IS NULL;")
PG_TASKS=$(docker exec postgres psql -U eventvue -t -c "SELECT count(*) FROM tasks WHERE deleted_at IS NULL;")

# Get counts from Elasticsearch
ES_EVENTS=$(curl -s "localhost:9200/eventcal-events/_count" | jq '.count')
ES_CONTACTS=$(curl -s "localhost:9200/eventcal-contacts/_count" | jq '.count')
ES_TASKS=$(curl -s "localhost:9200/eventcal-tasks/_count" | jq '.count')

echo "Entity      | PostgreSQL | Elasticsearch | Diff"
echo "------------|------------|---------------|------"
echo "Events      | $PG_EVENTS | $ES_EVENTS | $((PG_EVENTS - ES_EVENTS))"
echo "Contacts    | $PG_CONTACTS | $ES_CONTACTS | $((PG_CONTACTS - ES_CONTACTS))"
echo "Tasks       | $PG_TASKS | $ES_TASKS | $((PG_TASKS - ES_TASKS))"

# Alert if diff > 10
if [ $((PG_EVENTS - ES_EVENTS)) -gt 10 ] || [ $((ES_EVENTS - PG_EVENTS)) -gt 10 ]; then
  echo "⚠️  WARNING: Events count mismatch exceeds threshold!"
fi
```

---

## Communication Templates

### P1 Incident - Initial Notification

```
Subject: [P1] EventVue Search Service Degraded

Status: INVESTIGATING
Start Time: YYYY-MM-DD HH:MM UTC
Affected: Search functionality across all EventVue applications

Summary:
The Elasticsearch cluster is currently unavailable. Users may experience:
- Search functionality not working
- Autocomplete not functioning
- Analytics dashboards showing stale data

Impact:
- All users affected
- Core event management still functional via PostgreSQL

Current Actions:
- Engineering team investigating
- Backups being prepared for potential restore

Next Update: 15 minutes
```

### P1 Incident - Resolution

```
Subject: [RESOLVED] EventVue Search Service Restored

Status: RESOLVED
Start Time: YYYY-MM-DD HH:MM UTC
End Time: YYYY-MM-DD HH:MM UTC
Duration: X hours Y minutes

Summary:
The Elasticsearch cluster has been restored. All search functionality is now operational.

Root Cause:
[Describe what caused the incident]

Resolution:
[Describe what was done to resolve]

Prevention:
[Describe measures to prevent recurrence]

User Impact:
- Search was unavailable for X minutes
- No data was lost
- All searches now return current results
```

---

## Post-Incident Review

### Checklist

After any P1/P2 incident:

- [ ] Incident timeline documented
- [ ] Root cause identified
- [ ] Data integrity verified
- [ ] Monitoring alerts reviewed
- [ ] Backup status confirmed
- [ ] Runbook updated if needed
- [ ] Team debriefing scheduled

### Metrics to Review

```bash
# Time to detect (TTD)
# - How long before alert fired?

# Time to respond (TTR)  
# - How long before engineer started investigating?

# Time to resolve (TTRS)
# - Total incident duration

# Data impact
# - Documents lost (if any)
# - Sync lag during incident
```

### Prevention Measures

1. **Automated Health Checks**
   - Ensure Prometheus alerts are configured
   - Verify PagerDuty/OpsGenie integration

2. **Backup Verification**
   - Monthly restore tests
   - Backup age monitoring

3. **Capacity Planning**
   - Review disk usage trends
   - Plan for growth

4. **Documentation**
   - Keep runbooks updated
   - Document environment changes

---

## Quick Reference

### Essential Commands

```bash
# Health check
curl -s "localhost:9200/_cluster/health?pretty"

# Node status
curl -s "localhost:9200/_cat/nodes?v"

# Index status
curl -s "localhost:9200/_cat/indices/eventcal-*?v"

# Sync status (EventVue)
curl -s "localhost:3000/api/admin/elasticsearch/sync-status" -H "Authorization: Bearer $TOKEN"

# Trigger reindex
curl -X POST "localhost:3000/api/admin/elasticsearch/reindex" -H "Authorization: Bearer $TOKEN"

# List backups
./scripts/es-restore.sh

# Restore backup
./scripts/es-restore.sh snapshot-name
```

### Contact Information

| Role | Contact |
|------|---------|
| Primary On-Call | [On-call rotation] |
| ES Subject Matter Expert | [Name/Slack] |
| Database Admin | [Name/Slack] |
| Platform Lead | [Name/Slack] |

---

## Related Documentation

- [ES Production Guide](./ES_PRODUCTION.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [RBAC & Security](./RBAC_AND_SECURITY.md)
