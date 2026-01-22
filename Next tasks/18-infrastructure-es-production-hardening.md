# Infrastructure: ES Production Hardening

## Type
Infrastructure / Security

## Priority
🟡 Medium

## Estimated Effort
4-5 hours

## Description
Production hardening for Elasticsearch including security, backup, and performance optimization. This ensures the search infrastructure is secure, resilient, and performant for production workloads at scale.

## Architecture Context
- **Kibana Access**: `kibana.eventcal.app` (secured with ES auth)
- **MinIO Console**: `storage.eventcal.app` (for backup storage)
- **Index Prefix**: Configurable via `ES_INDEX_PREFIX` (default: `eventcal`)

## Requirements

### Security
- TLS/SSL encryption (inter-node and client)
- Role-based access control (RBAC)
- API key authentication for services
- Network isolation (internal network only)
- Audit logging enabled
- IP allowlist for admin access

### Backup & Recovery
- Snapshot repository setup (MinIO/S3)
- Automated daily snapshots
- Retention policy (30 days)
- Restore procedure documentation
- Cross-region backup consideration

### Performance
- Index lifecycle management (ILM)
- Query caching optimization
- Shard sizing strategy (target 20-40GB per shard)
- Hot-warm architecture (if data volume warrants)
- Field data cache limits

### Monitoring
- Prometheus metrics export
- Alert rules for cluster health
- Disk space monitoring (alert at 80%)
- Query latency alerts (p99 > 500ms)
- Indexing throughput monitoring

### Documentation
- Disaster recovery procedure
- Scaling guidelines
- Troubleshooting guide
- Runbook for common issues

---

## Complete Implementation

### Production Elasticsearch Config (`elasticsearch/elasticsearch-prod.yml`)
```yaml
cluster.name: "eventcal-cluster-prod"
node.name: "eventcal-es-prod-01"
network.host: 0.0.0.0

# Security settings
xpack.security.enabled: true
xpack.security.enrollment.enabled: true

# TLS for HTTP layer
xpack.security.http.ssl:
  enabled: true
  key: /usr/share/elasticsearch/config/certs/es-key.pem
  certificate: /usr/share/elasticsearch/config/certs/es-cert.pem
  certificate_authorities: /usr/share/elasticsearch/config/certs/ca.pem

# TLS for transport layer (inter-node)
xpack.security.transport.ssl:
  enabled: true
  verification_mode: certificate
  key: /usr/share/elasticsearch/config/certs/es-key.pem
  certificate: /usr/share/elasticsearch/config/certs/es-cert.pem
  certificate_authorities: /usr/share/elasticsearch/config/certs/ca.pem

# Audit logging
xpack.security.audit.enabled: true
xpack.security.audit.logfile.events.include:
  - access_denied
  - authentication_failed
  - connection_denied
  - tampered_request
  - security_config_change

# Path settings
path.data: /usr/share/elasticsearch/data
path.logs: /usr/share/elasticsearch/logs

# Memory settings
bootstrap.memory_lock: true

# Index settings
action.auto_create_index: "eventcal-*"
indices.query.bool.max_clause_count: 4096

# Slow query logging
index.search.slowlog.threshold.query.warn: 10s
index.search.slowlog.threshold.query.info: 5s
index.search.slowlog.threshold.fetch.warn: 1s
index.indexing.slowlog.threshold.index.warn: 10s

# Snapshot repository
path.repo: ["/usr/share/elasticsearch/backup"]
```

### Role Definitions (`elasticsearch/roles/eventcal-roles.json`)
```json
{
  "eventcal_app": {
    "cluster": ["monitor", "manage_index_templates"],
    "indices": [
      {
        "names": ["eventcal-*"],
        "privileges": ["create_index", "delete_index", "read", "write", "manage"]
      }
    ]
  },
  "eventcal_readonly": {
    "cluster": ["monitor"],
    "indices": [
      {
        "names": ["eventcal-*"],
        "privileges": ["read", "view_index_metadata"]
      }
    ]
  },
  "eventcal_admin": {
    "cluster": ["all"],
    "indices": [
      {
        "names": ["eventcal-*"],
        "privileges": ["all"]
      }
    ],
    "applications": [
      {
        "application": "kibana-.kibana",
        "privileges": ["all"],
        "resources": ["*"]
      }
    ]
  },
  "eventcal_backup": {
    "cluster": ["manage_slm", "cluster:admin/snapshot/*"],
    "indices": [
      {
        "names": ["eventcal-*"],
        "privileges": ["read", "view_index_metadata"]
      }
    ]
  }
}
```

### Backup Script (`scripts/es-backup.sh`)
```bash
#!/bin/bash
# Elasticsearch Backup Script
# Runs daily via cron

set -e

ES_URL="${ELASTICSEARCH_URL:-https://localhost:9200}"
ES_USER="${ELASTICSEARCH_USERNAME:-elastic}"
ES_PASS="${ELASTICSEARCH_PASSWORD}"
SNAPSHOT_REPO="eventcal-backups"
SNAPSHOT_NAME="eventcal-$(date +%Y%m%d-%H%M%S)"

# Create snapshot repository if not exists
curl -X PUT "$ES_URL/_snapshot/$SNAPSHOT_REPO" \
  -u "$ES_USER:$ES_PASS" \
  --cacert /etc/elasticsearch/certs/ca.pem \
  -H "Content-Type: application/json" \
  -d '{
    "type": "s3",
    "settings": {
      "bucket": "eventcal-es-backups",
      "endpoint": "storage.eventcal.app",
      "protocol": "https",
      "path_style_access": true
    }
  }' 2>/dev/null || true

# Create snapshot
echo "Creating snapshot: $SNAPSHOT_NAME"
curl -X PUT "$ES_URL/_snapshot/$SNAPSHOT_REPO/$SNAPSHOT_NAME?wait_for_completion=true" \
  -u "$ES_USER:$ES_PASS" \
  --cacert /etc/elasticsearch/certs/ca.pem \
  -H "Content-Type: application/json" \
  -d '{
    "indices": "eventcal-*",
    "ignore_unavailable": true,
    "include_global_state": false
  }'

# Cleanup old snapshots (keep last 30)
echo "Cleaning up old snapshots..."
SNAPSHOTS=$(curl -s "$ES_URL/_snapshot/$SNAPSHOT_REPO/_all" \
  -u "$ES_USER:$ES_PASS" \
  --cacert /etc/elasticsearch/certs/ca.pem | jq -r '.snapshots[].snapshot' | sort | head -n -30)

for snapshot in $SNAPSHOTS; do
  echo "Deleting old snapshot: $snapshot"
  curl -X DELETE "$ES_URL/_snapshot/$SNAPSHOT_REPO/$snapshot" \
    -u "$ES_USER:$ES_PASS" \
    --cacert /etc/elasticsearch/certs/ca.pem
done

echo "Backup complete: $SNAPSHOT_NAME"
```

### Restore Script (`scripts/es-restore.sh`)
```bash
#!/bin/bash
# Elasticsearch Restore Script
# Usage: ./es-restore.sh <snapshot_name> [index_pattern]

set -e

ES_URL="${ELASTICSEARCH_URL:-https://localhost:9200}"
ES_USER="${ELASTICSEARCH_USERNAME:-elastic}"
ES_PASS="${ELASTICSEARCH_PASSWORD}"
SNAPSHOT_REPO="eventcal-backups"
SNAPSHOT_NAME="${1:-}"
INDEX_PATTERN="${2:-eventcal-*}"

if [ -z "$SNAPSHOT_NAME" ]; then
  echo "Usage: $0 <snapshot_name> [index_pattern]"
  echo ""
  echo "Available snapshots:"
  curl -s "$ES_URL/_snapshot/$SNAPSHOT_REPO/_all" \
    -u "$ES_USER:$ES_PASS" \
    --cacert /etc/elasticsearch/certs/ca.pem | jq -r '.snapshots[].snapshot'
  exit 1
fi

echo "WARNING: This will restore indices matching '$INDEX_PATTERN' from snapshot '$SNAPSHOT_NAME'"
echo "Existing indices will be closed and replaced."
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 1
fi

# Close existing indices
echo "Closing existing indices..."
curl -X POST "$ES_URL/$INDEX_PATTERN/_close" \
  -u "$ES_USER:$ES_PASS" \
  --cacert /etc/elasticsearch/certs/ca.pem 2>/dev/null || true

# Restore from snapshot
echo "Restoring from snapshot: $SNAPSHOT_NAME"
curl -X POST "$ES_URL/_snapshot/$SNAPSHOT_REPO/$SNAPSHOT_NAME/_restore?wait_for_completion=true" \
  -u "$ES_USER:$ES_PASS" \
  --cacert /etc/elasticsearch/certs/ca.pem \
  -H "Content-Type: application/json" \
  -d "{
    \"indices\": \"$INDEX_PATTERN\",
    \"ignore_unavailable\": true,
    \"include_global_state\": false
  }"

echo "Restore complete!"
```

### Index Lifecycle Policy (`elasticsearch/ilm-policy.json`)
```json
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_size": "30gb",
            "max_age": "30d"
          },
          "set_priority": {
            "priority": 100
          }
        }
      },
      "warm": {
        "min_age": "30d",
        "actions": {
          "shrink": {
            "number_of_shards": 1
          },
          "forcemerge": {
            "max_num_segments": 1
          },
          "set_priority": {
            "priority": 50
          }
        }
      },
      "cold": {
        "min_age": "90d",
        "actions": {
          "set_priority": {
            "priority": 0
          },
          "freeze": {}
        }
      },
      "delete": {
        "min_age": "365d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

### Prometheus Monitoring Config
Add to `prometheus/prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'elasticsearch'
    static_configs:
      - targets: ['elasticsearch:9200']
    basic_auth:
      username: 'elastic'
      password_file: /etc/prometheus/es_password
    scheme: https
    tls_config:
      ca_file: /etc/prometheus/certs/ca.pem
    metrics_path: /_prometheus/metrics
```

### Alert Rules (`prometheus/rules/elasticsearch.yml`)
```yaml
groups:
  - name: elasticsearch
    rules:
      - alert: ElasticsearchClusterRed
        expr: elasticsearch_cluster_health_status{color="red"} == 1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Elasticsearch cluster is RED"
          description: "Elasticsearch cluster health is RED for more than 5 minutes"

      - alert: ElasticsearchClusterYellow
        expr: elasticsearch_cluster_health_status{color="yellow"} == 1
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Elasticsearch cluster is YELLOW"
          description: "Elasticsearch cluster health is YELLOW for more than 30 minutes"

      - alert: ElasticsearchDiskSpaceLow
        expr: elasticsearch_filesystem_data_available_bytes / elasticsearch_filesystem_data_size_bytes < 0.2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Elasticsearch disk space low"
          description: "Less than 20% disk space available on {{ $labels.node }}"

      - alert: ElasticsearchHighQueryLatency
        expr: elasticsearch_indices_search_query_time_seconds / elasticsearch_indices_search_query_total > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Elasticsearch query latency high"
          description: "Average query latency is above 500ms"
```

---

### Files to Create
- `elasticsearch/elasticsearch-prod.yml` - Production ES config
- `elasticsearch/roles/eventcal-roles.json` - Role definitions
- `elasticsearch/ilm-policy.json` - Index lifecycle policy
- `scripts/es-backup.sh` - Backup script
- `scripts/es-restore.sh` - Restore script
- `prometheus/rules/elasticsearch.yml` - Alert rules
- `docs/ES_PRODUCTION.md` - Production guide
- `docs/ES_DISASTER_RECOVERY.md` - DR procedures

### Files to Modify
- `docker-compose.yml` - Mount certs and config
- `.env.production` - Add backup credentials
- `prometheus/prometheus.yml` - Add ES scrape config

## Acceptance Criteria
- [ ] TLS enabled in production (verified with openssl)
- [ ] RBAC configured (eventcal_app, eventcal_readonly, eventcal_admin, eventcal_backup)
- [ ] Backups running daily (cron configured)
- [ ] Backup stored in MinIO at storage.eventcal.app
- [ ] Restore procedure tested and documented
- [ ] Monitoring alerts configured in Prometheus
- [ ] ILM policy applied to all eventcal-* indices
- [ ] Documentation complete with runbooks
- [ ] Audit logging capturing security events

## Dependencies
- Tasks 01-06 completed
- MinIO configured at storage.eventcal.app
- SSL certificates provisioned
