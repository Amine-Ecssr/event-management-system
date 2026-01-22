# Elasticsearch Setup Guide

This guide covers setting up Elasticsearch for EventVue in development and production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Setup](#development-setup)
3. [Production Deployment](#production-deployment)
4. [DNS Configuration](#dns-configuration)
5. [Security Configuration](#security-configuration)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 4GB | 8GB+ |
| CPU | 2 cores | 4+ cores |
| Disk | 20GB | 50GB+ SSD |
| Docker | 24.0+ | Latest |

### Required Software

- Docker and Docker Compose
- Node.js 20+ (for development)
- curl (for testing)

---

## Development Setup

### 1. Environment Variables

Create or update `.env.development`:

```bash
# Elasticsearch
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=eventcal-dev-password-2024
ELASTICSEARCH_ENABLED=true

# Index Configuration
ES_INDEX_PREFIX=eventcal
ES_INDEX_SUFFIX=dev

# Kibana (Development)
KIBANA_PASSWORD=kibana-dev-password-2024
KIBANA_ENABLED=true
KIBANA_PUBLIC_URL=http://localhost:5601
KIBANA_ENCRYPTION_KEY=your-32-char-key-change-this-dev!
```

### 2. Start Services

```bash
# Build and start all services including ES and Kibana
npm run docker:dev:build

# Or start existing containers
npm run docker:dev

# View logs
docker compose -f docker-compose.dev.yml logs -f elasticsearch
docker compose -f docker-compose.dev.yml logs -f kibana
```

### 3. Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| Application | http://localhost:5050 | Your account |
| Kibana | http://localhost:5601 | elastic / eventcal-dev-password-2024 |
| Elasticsearch | http://localhost:9200 | elastic / eventcal-dev-password-2024 |

### 4. Verify Installation

```bash
# Check ES health
curl -u elastic:eventcal-dev-password-2024 http://localhost:9200/_cluster/health?pretty

# Expected output:
# {
#   "status": "green",
#   "number_of_nodes": 1,
#   ...
# }

# Check indices
curl -u elastic:eventcal-dev-password-2024 http://localhost:9200/_cat/indices/eventcal-*?v

# Test ICU analyzer (Arabic support)
curl -X POST "localhost:9200/_analyze?pretty" \
  -u elastic:eventcal-dev-password-2024 \
  -H "Content-Type: application/json" \
  -d '{"tokenizer": "icu_tokenizer", "text": "مؤتمر الشرق الأوسط"}'
```

### 5. Initial Data Sync

After starting the application, sync existing data to Elasticsearch:

```bash
# Via API (requires admin authentication)
curl -X POST http://localhost:5050/api/admin/elasticsearch/reindex \
  -H "Cookie: connect.sid=<your-session>"

# Or use the admin panel
# Navigate to /admin/elasticsearch and click "Full Reindex"
```

---

## Production Deployment

### 1. Environment Variables

Create `.env.production`:

```bash
# Elasticsearch
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=${SECURE_ES_PASSWORD}
ELASTICSEARCH_ENABLED=true

# Index Configuration
ES_INDEX_PREFIX=eventcal
ES_INDEX_SUFFIX=prod

# Kibana - Production Subdomain
KIBANA_PASSWORD=${SECURE_KIBANA_PASSWORD}
KIBANA_ENABLED=true
KIBANA_DOMAIN=kibana.eventcal.app
KIBANA_PUBLIC_URL=https://kibana.eventcal.app
KIBANA_ENCRYPTION_KEY=${SECURE_32_CHAR_KEY}

# MinIO Console - Production Subdomain
MINIO_CONSOLE_DOMAIN=storage.eventcal.app
MINIO_CONSOLE_PUBLIC_URL=https://storage.eventcal.app
```

### 2. Docker Compose Configuration

The production `docker-compose.yml` includes:

```yaml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.12.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=true
      - ELASTIC_PASSWORD=${ELASTICSEARCH_PASSWORD}
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    networks:
      - eventvue-network

  kibana:
    image: docker.elastic.co/kibana/kibana:8.12.0
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
      - ELASTICSEARCH_USERNAME=kibana_system
      - ELASTICSEARCH_PASSWORD=${KIBANA_PASSWORD}
      - VIRTUAL_HOST=${KIBANA_DOMAIN}
      - VIRTUAL_PORT=5601
      - LETSENCRYPT_HOST=${KIBANA_DOMAIN}
    depends_on:
      - elasticsearch
    networks:
      - eventvue-network
```

### 3. Deploy

```bash
# Deploy production stack
docker compose --env-file .env.production up -d

# Verify services
curl https://kibana.eventcal.app/api/status
curl https://storage.eventcal.app/minio/health/live
```

---

## DNS Configuration

### Required DNS Records

Create A/AAAA records pointing to your server:

| Subdomain | Type | Value |
|-----------|------|-------|
| `eventcal.app` | A | `<server-ip>` |
| `www.eventcal.app` | A | `<server-ip>` |
| `api.eventcal.app` | A | `<server-ip>` |
| `auth.eventcal.app` | A | `<server-ip>` |
| `kibana.eventcal.app` | A | `<server-ip>` |
| `storage.eventcal.app` | A | `<server-ip>` |

### SSL Certificates

SSL certificates are automatically provisioned via Let's Encrypt when using nginx-proxy with the ACME companion:

```yaml
services:
  reverse-proxy:
    image: nginxproxy/nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - certs:/etc/nginx/certs
      
  acme-companion:
    image: nginxproxy/acme-companion
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - certs:/etc/nginx/certs
    environment:
      - DEFAULT_EMAIL=admin@eventcal.app
```

---

## Security Configuration

### Elasticsearch Security

1. **Change default passwords:**

```bash
# Reset elastic password
docker exec -it elasticsearch bin/elasticsearch-reset-password -u elastic -i

# Reset kibana_system password
docker exec -it elasticsearch bin/elasticsearch-reset-password -u kibana_system -i
```

2. **Create application user:**

```bash
curl -X POST "localhost:9200/_security/user/eventvue_app" \
  -u elastic:${ES_PASSWORD} \
  -H "Content-Type: application/json" \
  -d '{
    "password": "app-password",
    "roles": ["superuser"],
    "full_name": "EventVue Application"
  }'
```

### Kibana Access Control

**Option 1: Elasticsearch Native Auth (Default)**

- Users authenticate with ES credentials
- Create read-only users for stakeholders

```bash
curl -X POST "localhost:9200/_security/user/kibana_viewer" \
  -u elastic:${ES_PASSWORD} \
  -H "Content-Type: application/json" \
  -d '{
    "password": "viewer-password",
    "roles": ["kibana_system", "viewer"],
    "full_name": "Kibana Viewer"
  }'
```

**Option 2: Keycloak Integration (Advanced)**

Configure Kibana to use OpenID Connect:

```yaml
xpack.security.authc.providers:
  oidc.keycloak:
    order: 0
    realm: "keycloak"
    description: "Log in with Keycloak"
```

### MinIO Security

Create limited access policies:

```bash
# Create read-only policy for media
mc admin policy create myminio readonly-media policy.json
mc admin user add myminio media-viewer viewer-password
mc admin policy attach myminio readonly-media --user media-viewer
```

---

## Troubleshooting

### Elasticsearch Won't Start

```bash
# Check logs
docker compose logs elasticsearch

# Common fixes:

# 1. Increase vm.max_map_count
sudo sysctl -w vm.max_map_count=262144
# Make permanent:
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf

# 2. Check disk space
df -h

# 3. Fix permissions
sudo chown -R 1000:1000 ./data/elasticsearch
```

### Kibana Can't Connect to ES

```bash
# Verify ES is healthy
curl -u elastic:${ES_PASSWORD} http://elasticsearch:9200/_cluster/health

# Check Kibana logs
docker compose logs kibana

# Verify network connectivity
docker compose exec kibana curl http://elasticsearch:9200
```

### Index Not Found Errors

```bash
# List all indices
curl -u elastic:${ES_PASSWORD} http://localhost:9200/_cat/indices?v

# Check index prefix configuration
docker compose exec app env | grep ES_INDEX

# Re-initialize indices via admin panel
# Navigate to /admin/elasticsearch → "Create All Indices"
```

### SSL Certificate Issues

```bash
# Check certificate status
docker compose exec acme-companion /app/cert_status

# Force certificate renewal
docker compose exec acme-companion /app/force_renew

# Check nginx-proxy logs
docker compose logs reverse-proxy
```

### Search Not Returning Results

```bash
# Check if data is indexed
curl -u elastic:${ES_PASSWORD} "localhost:9200/eventcal-events-*/_count"

# Trigger full reindex
curl -X POST http://localhost:5050/api/admin/elasticsearch/reindex \
  -H "Cookie: connect.sid=<session>"

# Check sync status
curl http://localhost:5050/api/admin/elasticsearch/sync-status \
  -H "Cookie: connect.sid=<session>"
```

### Performance Issues

```bash
# Check cluster stats
curl -u elastic:${ES_PASSWORD} "localhost:9200/_cluster/stats?pretty"

# Check node stats
curl -u elastic:${ES_PASSWORD} "localhost:9200/_nodes/stats?pretty"

# Force merge (reduce segments)
curl -X POST -u elastic:${ES_PASSWORD} "localhost:9200/eventcal-*/_forcemerge?max_num_segments=1"
```

---

## Related Documentation

- [ELASTICSEARCH_ARCHITECTURE.md](./ELASTICSEARCH_ARCHITECTURE.md) - System architecture
- [ELASTICSEARCH_API.md](./ELASTICSEARCH_API.md) - API reference
- [ES_PRODUCTION.md](./ES_PRODUCTION.md) - Production hardening
- [ES_DISASTER_RECOVERY.md](./ES_DISASTER_RECOVERY.md) - Disaster recovery
