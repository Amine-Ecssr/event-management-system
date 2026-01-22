# Elasticsearch Production Deployment Guide

This guide covers deploying Elasticsearch for EventVue in a production environment with security, monitoring, and high availability.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Installation](#installation)
4. [Security Configuration](#security-configuration)
5. [Monitoring Setup](#monitoring-setup)
6. [Backup & Recovery](#backup--recovery)
7. [Performance Tuning](#performance-tuning)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 2 cores | 4+ cores |
| **RAM** | 4GB | 8-16GB |
| **Storage** | 50GB SSD | 100GB+ NVMe SSD |
| **Network** | 1Gbps | 10Gbps |

### Software Requirements

- Docker 24.0+ and Docker Compose v2
- Elasticsearch 8.12.0
- MinIO or S3-compatible storage for backups
- Prometheus + Grafana for monitoring

---

## Architecture Overview

### Single-Node (Development/Staging)

```
┌─────────────────────────────────────┐
│           EventVue App              │
│    ┌──────────┬──────────────┐     │
│    │  Server  │    Client    │     │
│    └────┬─────┴──────────────┘     │
│         │                           │
│    ┌────▼─────┐  ┌────────────┐    │
│    │PostgreSQL│  │Elasticsearch│    │
│    └──────────┘  └────────────┘    │
└─────────────────────────────────────┘
```

### Multi-Node (Production)

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
   │  ES-01  │◄────────►│  ES-02  │◄────────►│  ES-03  │
   │ Master  │          │  Data   │          │  Data   │
   │  Data   │          │         │          │         │
   └─────────┘          └─────────┘          └─────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   MinIO/S3      │
                    │   (Backups)     │
                    └─────────────────┘
```

---

## Installation

### 1. Create Data Directories

```bash
# Create directories with proper permissions
sudo mkdir -p /var/lib/elasticsearch/data
sudo mkdir -p /var/lib/elasticsearch/logs
sudo mkdir -p /etc/elasticsearch/certs

# Set ownership (UID 1000 is elasticsearch user in container)
sudo chown -R 1000:1000 /var/lib/elasticsearch
sudo chmod 750 /etc/elasticsearch/certs
```

### 2. Generate Certificates

```bash
# Using elasticsearch-certutil
docker run --rm -it \
  -v /etc/elasticsearch/certs:/certs \
  docker.elastic.co/elasticsearch/elasticsearch:8.12.0 \
  bin/elasticsearch-certutil ca --out /certs/elastic-stack-ca.p12 --pass ""

docker run --rm -it \
  -v /etc/elasticsearch/certs:/certs \
  docker.elastic.co/elasticsearch/elasticsearch:8.12.0 \
  bin/elasticsearch-certutil cert \
    --ca /certs/elastic-stack-ca.p12 \
    --ca-pass "" \
    --out /certs/elastic-certificates.p12 \
    --pass ""
```

### 3. Deploy with Docker Compose

```bash
# Copy production config
cp elasticsearch/elasticsearch-prod.yml /etc/elasticsearch/elasticsearch.yml

# Start cluster
docker compose -f docker-compose.yml up -d elasticsearch
```

---

## Security Configuration

### RBAC Roles

EventVue uses six predefined roles (see `elasticsearch/roles/eventcal-roles.json`):

| Role | Purpose | Permissions |
|------|---------|-------------|
| `eventcal_app` | Application service account | Read/write/delete on `eventcal-*` indices |
| `eventcal_readonly` | Read-only access | Search only on `eventcal-*` |
| `eventcal_admin` | Full ES administration | All cluster and index operations |
| `eventcal_backup` | Backup operations | Snapshot repository management |
| `eventcal_kibana` | Kibana user | Kibana access + read eventcal indices |
| `eventcal_monitoring` | Prometheus exporter | Cluster and indices monitoring |

### Creating Users

```bash
# Set elastic password first
docker exec -it elasticsearch bin/elasticsearch-reset-password -u elastic -i

# Create application user
curl -X POST "https://localhost:9200/_security/user/eventvue_app" \
  -u elastic:YOUR_ELASTIC_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{
    "password": "SECURE_APP_PASSWORD",
    "roles": ["eventcal_app"],
    "full_name": "EventVue Application"
  }'

# Create monitoring user
curl -X POST "https://localhost:9200/_security/user/prometheus" \
  -u elastic:YOUR_ELASTIC_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{
    "password": "PROMETHEUS_PASSWORD",
    "roles": ["eventcal_monitoring"],
    "full_name": "Prometheus Exporter"
  }'
```

### API Keys (Recommended for Applications)

```bash
# Create API key for EventVue app
curl -X POST "https://localhost:9200/_security/api_key" \
  -u elastic:YOUR_ELASTIC_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{
    "name": "eventvue-production",
    "role_descriptors": {
      "eventvue_role": {
        "cluster": ["monitor"],
        "index": [
          {
            "names": ["eventcal-*"],
            "privileges": ["read", "write", "create_index", "delete"]
          }
        ]
      }
    },
    "expiration": "365d"
  }'
```

Update `.env.production`:
```env
ELASTICSEARCH_API_KEY=YOUR_API_KEY_HERE
```

---

## Monitoring Setup

### 1. Deploy Elasticsearch Exporter

Add to `docker-compose.yml`:

```yaml
services:
  elasticsearch-exporter:
    image: quay.io/prometheuscommunity/elasticsearch-exporter:v1.6.0
    container_name: es-exporter
    command:
      - '--es.uri=https://elasticsearch:9200'
      - '--es.all'
      - '--es.indices'
      - '--es.indices_settings'
      - '--es.shards'
      - '--es.snapshots'
      - '--es.ca=/certs/ca.pem'
    environment:
      - ES_USERNAME=prometheus
      - ES_PASSWORD=${ES_MONITORING_PASSWORD}
    volumes:
      - ./certs:/certs:ro
    ports:
      - "9114:9114"
    networks:
      - eventvue-network
```

### 2. Configure Prometheus

Add to `prometheus/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'elasticsearch'
    static_configs:
      - targets: ['elasticsearch-exporter:9114']
    scrape_interval: 15s
```

### 3. Load Alert Rules

```bash
# Copy alert rules
cp prometheus/rules/elasticsearch.yml /etc/prometheus/rules/

# Reload Prometheus
curl -X POST http://prometheus:9090/-/reload
```

### 4. Import Grafana Dashboards

Recommended dashboards:

- **Elasticsearch Overview**: Dashboard ID `266`
- **Elasticsearch Node Metrics**: Dashboard ID `6483`
- **EventVue Custom**: Import from `grafana/dashboards/eventcal-elasticsearch.json`

---

## Backup & Recovery

### Automated Backups

1. **Configure MinIO/S3 Repository**:

```bash
curl -X PUT "https://localhost:9200/_snapshot/eventcal-backups" \
  -u elastic:PASSWORD \
  -H "Content-Type: application/json" \
  -d '{
    "type": "s3",
    "settings": {
      "bucket": "elasticsearch-backups",
      "endpoint": "minio:9000",
      "protocol": "http",
      "path_style_access": true
    }
  }'
```

2. **Schedule Backups**:

```bash
# Add to crontab
0 2 * * * /opt/eventvue/scripts/es-backup.sh >> /var/log/es-backup.log 2>&1
```

3. **Verify Backups**:

```bash
# List snapshots
curl -s "https://localhost:9200/_snapshot/eventcal-backups/_all?pretty" -u elastic:PASSWORD
```

### Restore Procedure

```bash
# List available snapshots
./scripts/es-restore.sh

# Restore specific snapshot
./scripts/es-restore.sh snapshot-2024-01-15

# Restore specific index
./scripts/es-restore.sh snapshot-2024-01-15 eventcal-events
```

### Index Lifecycle Management (ILM)

Load the ILM policy:

```bash
curl -X PUT "https://localhost:9200/_ilm/policy/eventcal-lifecycle" \
  -u elastic:PASSWORD \
  -H "Content-Type: application/json" \
  -d @elasticsearch/ilm-policy.json
```

---

## Performance Tuning

### JVM Settings

Edit `elasticsearch/jvm.options.d/heap.options`:

```
# Set heap to 50% of available RAM, max 31GB
-Xms8g
-Xmx8g

# G1GC settings (default in ES 8.x)
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200
```

### System Settings

```bash
# /etc/sysctl.conf
vm.max_map_count=262144
vm.swappiness=1

# /etc/security/limits.conf
elasticsearch soft nofile 65536
elasticsearch hard nofile 65536
elasticsearch soft memlock unlimited
elasticsearch hard memlock unlimited
```

### Index Settings

Recommended settings for eventcal indices:

```json
{
  "settings": {
    "number_of_shards": 2,
    "number_of_replicas": 1,
    "refresh_interval": "5s",
    "index.translog.durability": "async",
    "index.translog.sync_interval": "5s"
  }
}
```

### Query Optimization

- Use `filter` context instead of `query` when scoring isn't needed
- Enable request caching for repeated queries
- Use `doc_values` for sorting/aggregations
- Avoid wildcards at the beginning of terms

---

## Troubleshooting

### Common Issues

#### Cluster Health Yellow/Red

```bash
# Check unassigned shards
curl -s "localhost:9200/_cat/shards?v&h=index,shard,prirep,state,unassigned.reason"

# Check allocation explain
curl -s "localhost:9200/_cluster/allocation/explain?pretty"

# Force allocate if safe
curl -X POST "localhost:9200/_cluster/reroute?retry_failed=true"
```

#### High Heap Usage

```bash
# Check heap
curl -s "localhost:9200/_nodes/stats/jvm?pretty"

# Find memory-heavy indices
curl -s "localhost:9200/_cat/indices?v&s=store.size:desc"

# Clear caches
curl -X POST "localhost:9200/_cache/clear"
```

#### Slow Queries

```bash
# Check slow log
tail -f /var/log/elasticsearch/eventvue_search_slowlog.json

# Analyze query
curl -X GET "localhost:9200/eventcal-events/_search?explain=true" -d '{"query": {...}}'
```

### Health Check Commands

```bash
# Cluster health
curl -s "localhost:9200/_cluster/health?pretty"

# Node stats
curl -s "localhost:9200/_nodes/stats?pretty"

# Index stats
curl -s "localhost:9200/_cat/indices/eventcal-*?v"

# Pending tasks
curl -s "localhost:9200/_cluster/pending_tasks?pretty"

# Thread pools
curl -s "localhost:9200/_cat/thread_pool?v&h=name,active,queue,rejected"
```

### Recovery Procedures

#### Corrupt Index Recovery

```bash
# Close index
curl -X POST "localhost:9200/eventcal-events/_close"

# Check for corruption
curl -X POST "localhost:9200/eventcal-events/_recovery?detailed=true"

# If needed, delete and reindex from PostgreSQL
curl -X DELETE "localhost:9200/eventcal-events"
# Then trigger reindex from EventVue admin panel
```

#### Node Recovery

```bash
# Exclude node from allocation (for maintenance)
curl -X PUT "localhost:9200/_cluster/settings" -d '{
  "transient": {
    "cluster.routing.allocation.exclude._name": "node-to-exclude"
  }
}'

# Re-include node
curl -X PUT "localhost:9200/_cluster/settings" -d '{
  "transient": {
    "cluster.routing.allocation.exclude._name": null
  }
}'
```

---

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `ELASTICSEARCH_URL` | ES connection URL | `http://localhost:9200` |
| `ELASTICSEARCH_API_KEY` | API key for auth | - |
| `ELASTICSEARCH_USERNAME` | Basic auth username | - |
| `ELASTICSEARCH_PASSWORD` | Basic auth password | - |
| `ES_INDEX_PREFIX` | Index name prefix | `eventcal` |
| `ES_SYNC_CRON` | Sync cron expression | `*/5 * * * *` |
| `ES_CA_CERT` | CA certificate path | - |

---

## Related Documentation

- [ES Disaster Recovery](./ES_DISASTER_RECOVERY.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Docker Deployment](../DOCKER.md)
- [Microservices Guide](../MICROSERVICES.md)
