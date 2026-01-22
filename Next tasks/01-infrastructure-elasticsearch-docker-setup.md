# Infrastructure: Elasticsearch & Kibana Docker Setup

## Type
Infrastructure / Service Addition

## Priority
🔴 Critical - Foundation for all search & analytics features

## Estimated Effort
3-4 hours

## Description
Add Elasticsearch 8.x and Kibana to the EventCal Docker infrastructure. This is the foundational task that enables all advanced search, analytics, and dashboard features. Must be completed before any indexing or search tasks.

### Subdomain Architecture
Following the established pattern used for Keycloak (`auth.eventcal.app`), we configure:
- **Kibana Dashboard**: `kibana.eventcal.app` - Admin analytics and visualization interface
- **MinIO Console**: `storage.eventcal.app` - Object storage management interface
- **Elasticsearch**: Internal only (no public subdomain) - accessed via backend services

### Index Naming Convention
- **Index Prefix**: Configurable via `ES_INDEX_PREFIX` environment variable
- **Default Prefix**: `eventcal` (e.g., `eventcal-events-prod`, `eventcal-tasks-dev`)
- **Pattern**: `{prefix}-{entity}-{environment}`

## Current State
- No search infrastructure in place
- Dashboard queries hit PostgreSQL directly
- No full-text search capabilities
- No analytics/aggregation layer

## Requirements

### Docker Services Configuration

#### 1. Development Environment (`docker-compose.dev.yml`)
```yaml
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.12.0
  container_name: eventcal-elasticsearch-dev
  environment:
    - node.name=eventcal-es-dev
    - cluster.name=eventcal-cluster-dev
    - discovery.type=single-node
    - bootstrap.memory_lock=true
    - "ES_JAVA_OPTS=-Xms1g -Xmx1g"
    - xpack.security.enabled=true
    - ELASTIC_PASSWORD=${ELASTICSEARCH_PASSWORD}
    - xpack.security.http.ssl.enabled=false
  ulimits:
    memlock:
      soft: -1
      hard: -1
    nofile:
      soft: 65536
      hard: 65536
  volumes:
    - elasticsearch-data-dev:/usr/share/elasticsearch/data
    - ./elasticsearch/elasticsearch.yml:/usr/share/elasticsearch/config/elasticsearch.yml:ro
  ports:
    - "9200:9200"
    - "9300:9300"
  networks:
    - dev-network
  healthcheck:
    test: ["CMD-SHELL", "curl -s -u elastic:${ELASTICSEARCH_PASSWORD} http://localhost:9200/_cluster/health | grep -q '\"status\":\"green\"\\|\"status\":\"yellow\"'"]
    interval: 30s
    timeout: 10s
    retries: 5

kibana:
  image: docker.elastic.co/kibana/kibana:8.12.0
  container_name: eventcal-kibana-dev
  environment:
    - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    - ELASTICSEARCH_USERNAME=kibana_system
    - ELASTICSEARCH_PASSWORD=${KIBANA_PASSWORD}
    - SERVER_NAME=eventcal-kibana
    - SERVER_BASEPATH=${KIBANA_BASE_PATH:-}
    - SERVER_PUBLICBASEURL=${KIBANA_PUBLIC_URL:-http://localhost:5601}
    - XPACK_SECURITY_ENABLED=true
    - XPACK_ENCRYPTEDSAVEDOBJECTS_ENCRYPTIONKEY=${KIBANA_ENCRYPTION_KEY:-a]%!Ep9&K7!qXw@pL3mN8vR2uT5yH0sZ}
  ports:
    - "5601:5601"
  depends_on:
    elasticsearch:
      condition: service_healthy
  healthcheck:
    test: ["CMD-SHELL", "curl -sf http://localhost:5601/api/status || exit 1"]
    interval: 30s
    timeout: 10s
    retries: 5
    start_period: 60s
  networks:
    - dev-network

volumes:
  elasticsearch-data-dev:
```

#### 2. Production Environment (`docker-compose.yml`)
- Same configuration with production passwords
- Memory settings: `ES_JAVA_OPTS=-Xms2g -Xmx2g`
- Enable SSL for Elasticsearch
- Remove Kibana port exposure (internal only)
- Add resource limits

#### 3. Core/Edge Environment
- `docker-compose.core.yml`: Add ES service to core VM
- ES on core network only (no external access)

### Elasticsearch Configuration Files

#### Create `elasticsearch/elasticsearch.yml`
```yaml
cluster.name: "eventcal-cluster"
network.host: 0.0.0.0

# Enable ICU plugin for Arabic support
# Note: Must install analysis-icu plugin

# Index settings
action.auto_create_index: true
indices.query.bool.max_clause_count: 4096

# Slow query logging for optimization
index.search.slowlog.threshold.query.warn: 10s
index.search.slowlog.threshold.query.info: 5s
index.search.slowlog.threshold.fetch.warn: 1s
index.indexing.slowlog.threshold.index.warn: 10s

# Path settings
path.data: /usr/share/elasticsearch/data
path.logs: /usr/share/elasticsearch/logs

# Memory settings
bootstrap.memory_lock: true

# Allow index auto-creation for eventcal indices only (security)
action.auto_create_index: "eventcal-*"
```

#### Create `elasticsearch/jvm.options.d/eventcal.options`
```
# Development JVM options
-Xms1g
-Xmx1g

# GC settings for better performance
-XX:+UseG1GC
-XX:G1HeapRegionSize=4m
-XX:InitiatingHeapOccupancyPercent=75

# Disable swapping
-XX:+AlwaysPreTouch
```

### ICU Plugin Installation
Create `elasticsearch/Dockerfile` for custom image with ICU plugin:
```dockerfile
FROM docker.elastic.co/elasticsearch/elasticsearch:8.12.0

# Install ICU analysis plugin for Arabic support
RUN bin/elasticsearch-plugin install --batch analysis-icu

# Install ingest-attachment for document processing (optional)
# RUN bin/elasticsearch-plugin install --batch ingest-attachment
```

Update docker-compose to use custom image:
```yaml
elasticsearch:
  build:
    context: ./elasticsearch
    dockerfile: Dockerfile
  # ... rest of config
```

### Environment Variables

#### `.env.development`
```bash
# Elasticsearch
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=eventcal-dev-password-2024
ELASTICSEARCH_NODE_NAME=eventcal-es-dev
ELASTICSEARCH_ENABLED=true

# Index Configuration
ES_INDEX_PREFIX=eventcal
ES_INDEX_SUFFIX=dev

# Kibana
KIBANA_PASSWORD=kibana-dev-password-2024
KIBANA_ENABLED=true
KIBANA_PUBLIC_URL=http://localhost:5601
KIBANA_ENCRYPTION_KEY=your-32-char-encryption-key-here!
```

#### `.env.production`
```bash
# Elasticsearch
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=${SECURE_ES_PASSWORD}
ELASTICSEARCH_NODE_NAME=eventcal-es-prod
ELASTICSEARCH_ENABLED=true

# Index Configuration
ES_INDEX_PREFIX=eventcal
ES_INDEX_SUFFIX=prod

# Kibana - Production Subdomain Configuration
KIBANA_PASSWORD=${SECURE_KIBANA_PASSWORD}
KIBANA_ENABLED=true
KIBANA_DOMAIN=kibana.eventcal.app
KIBANA_PUBLIC_URL=https://kibana.eventcal.app
KIBANA_ENCRYPTION_KEY=${KIBANA_ENCRYPTION_KEY}

# MinIO - Production Subdomain Configuration
MINIO_CONSOLE_DOMAIN=storage.eventcal.app
MINIO_CONSOLE_PUBLIC_URL=https://storage.eventcal.app
```

#### `.env.example`
```bash
# Elasticsearch Configuration
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your-secure-password
ELASTICSEARCH_NODE_NAME=eventcal-node-1
ELASTICSEARCH_ENABLED=true

# Index Configuration (customizable prefix)
ES_INDEX_PREFIX=eventcal
ES_INDEX_SUFFIX=dev

# Kibana Configuration
KIBANA_PASSWORD=your-kibana-password
KIBANA_ENABLED=true
KIBANA_DOMAIN=kibana.eventcal.app
KIBANA_PUBLIC_URL=https://kibana.eventcal.app
KIBANA_ENCRYPTION_KEY=your-32-char-encryption-key-here!

# MinIO Console Configuration
MINIO_CONSOLE_DOMAIN=storage.eventcal.app
MINIO_CONSOLE_PUBLIC_URL=https://storage.eventcal.app
```

## Files to Create
- `elasticsearch/Dockerfile`
- `elasticsearch/elasticsearch.yml`
- `elasticsearch/jvm.options.d/eventcal.options`

## Files to Modify
- `docker-compose.dev.yml` - Add elasticsearch and kibana services
- `docker-compose.yml` - Add elasticsearch, kibana services with subdomain config
- `docker-compose.core.yml` - Add elasticsearch service
- `.env.development` - Add ES environment variables
- `.env.production` - Add ES, Kibana, MinIO subdomain configuration

---

## Production Configuration Details

### Production Docker Compose (`docker-compose.yml`)

#### Elasticsearch Service
```yaml
elasticsearch:
  image: eventcal/elasticsearch:8.12.0
  build:
    context: ./elasticsearch
    dockerfile: Dockerfile
  container_name: eventcal-elasticsearch-prod
  environment:
    - node.name=eventcal-es-prod
    - cluster.name=eventcal-cluster-prod
    - discovery.type=single-node
    - bootstrap.memory_lock=true
    - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
    - xpack.security.enabled=true
    - xpack.security.http.ssl.enabled=true
    - xpack.security.http.ssl.key=/usr/share/elasticsearch/config/certs/es-key.pem
    - xpack.security.http.ssl.certificate=/usr/share/elasticsearch/config/certs/es-cert.pem
    - xpack.security.http.ssl.certificate_authorities=/usr/share/elasticsearch/config/certs/ca.pem
    - xpack.security.transport.ssl.enabled=true
    - ELASTIC_PASSWORD=${ELASTICSEARCH_PASSWORD}
  ulimits:
    memlock:
      soft: -1
      hard: -1
    nofile:
      soft: 65536
      hard: 65536
  volumes:
    - elasticsearch-data-prod:/usr/share/elasticsearch/data
    - ./elasticsearch/elasticsearch.yml:/usr/share/elasticsearch/config/elasticsearch.yml:ro
    - ./deploy/certs/elasticsearch:/usr/share/elasticsearch/config/certs:ro
  networks:
    - ecssr-network
  healthcheck:
    test: ["CMD-SHELL", "curl -s --cacert /usr/share/elasticsearch/config/certs/ca.pem -u elastic:${ELASTICSEARCH_PASSWORD} https://localhost:9200/_cluster/health | grep -q '\"status\":\"green\"\\|\"status\":\"yellow\"'"]
    interval: 30s
    timeout: 10s
    retries: 5
    start_period: 60s
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 4G
      reservations:
        cpus: '1'
        memory: 2G
  restart: unless-stopped
  logging:
    driver: "json-file"
    options:
      max-size: "100m"
      max-file: "5"
```

#### Kibana Service (Production with Subdomain)
```yaml
kibana:
  image: docker.elastic.co/kibana/kibana:8.12.0
  container_name: eventcal-kibana-prod
  restart: unless-stopped
  environment:
    - ELASTICSEARCH_HOSTS=https://elasticsearch:9200
    - ELASTICSEARCH_USERNAME=kibana_system
    - ELASTICSEARCH_PASSWORD=${KIBANA_PASSWORD}
    - ELASTICSEARCH_SSL_CERTIFICATEAUTHORITIES=/usr/share/kibana/config/certs/ca.pem
    - SERVER_NAME=kibana.eventcal.app
    - SERVER_HOST=0.0.0.0
    - SERVER_BASEPATH=
    - SERVER_PUBLICBASEURL=https://${KIBANA_DOMAIN:-kibana.eventcal.app}
    - XPACK_SECURITY_ENABLED=true
    - XPACK_ENCRYPTEDSAVEDOBJECTS_ENCRYPTIONKEY=${KIBANA_ENCRYPTION_KEY}
    - XPACK_REPORTING_ENCRYPTIONKEY=${KIBANA_REPORTING_KEY:-${KIBANA_ENCRYPTION_KEY}}
    - XPACK_SECURITY_ENCRYPTIONKEY=${KIBANA_SECURITY_KEY:-${KIBANA_ENCRYPTION_KEY}}
    # nginx-proxy integration
    - VIRTUAL_HOST=${KIBANA_DOMAIN:-kibana.eventcal.app}
    - VIRTUAL_PORT=5601
    - LETSENCRYPT_HOST=${KIBANA_DOMAIN:-kibana.eventcal.app}
    - LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL:-admin@ecssr.ae}
  volumes:
    - ./deploy/certs/elasticsearch:/usr/share/kibana/config/certs:ro
  depends_on:
    elasticsearch:
      condition: service_healthy
  healthcheck:
    test: ["CMD-SHELL", "curl -sf http://localhost:5601/api/status || exit 1"]
    interval: 30s
    timeout: 10s
    retries: 5
    start_period: 90s
  networks:
    - ecssr-network
    - proxy-network
  deploy:
    resources:
      limits:
        cpus: '1'
        memory: 2G
```

#### MinIO Service (Production with Subdomain)
```yaml
minio:
  image: minio/minio:latest
  container_name: eventcal-minio-prod
  restart: unless-stopped
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
    MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    MINIO_BROWSER_REDIRECT_URL: https://${MINIO_CONSOLE_DOMAIN:-storage.eventcal.app}
    # nginx-proxy integration for console
    VIRTUAL_HOST: ${MINIO_CONSOLE_DOMAIN:-storage.eventcal.app}
    VIRTUAL_PORT: 9001
    LETSENCRYPT_HOST: ${MINIO_CONSOLE_DOMAIN:-storage.eventcal.app}
    LETSENCRYPT_EMAIL: ${LETSENCRYPT_EMAIL:-admin@ecssr.ae}
  volumes:
    - minio_data_prod:/data
  healthcheck:
    test: ["CMD", "mc", "ready", "local"]
    interval: 30s
    timeout: 10s
    retries: 5
    start_period: 30s
  networks:
    - ecssr-network
    - proxy-network
  deploy:
    resources:
      limits:
        cpus: '1'
        memory: 1G
```

---

### DNS Configuration for Subdomains
Add the following DNS A/AAAA records pointing to your server IP:
```
kibana.eventcal.app    A    <server-ip>
storage.eventcal.app   A    <server-ip>
```

These follow the same pattern as `auth.eventcal.app` for Keycloak.

---

### Core/Edge Environment (`docker-compose.core.yml`)
```yaml
elasticsearch:
  image: eventcal/elasticsearch:8.12.0
  build:
    context: ./elasticsearch
    dockerfile: Dockerfile
  container_name: eventcal-elasticsearch-core
  environment:
    - node.name=eventcal-es-core
    - cluster.name=eventcal-cluster-core
    - discovery.type=single-node
    - bootstrap.memory_lock=true
    - "ES_JAVA_OPTS=-Xms4g -Xmx4g"
    - xpack.security.enabled=true
    - xpack.security.http.ssl.enabled=true
    - ELASTIC_PASSWORD=${ELASTICSEARCH_PASSWORD}
  ulimits:
    memlock:
      soft: -1
      hard: -1
    nofile:
      soft: 65536
      hard: 65536
  volumes:
    - elasticsearch-data-core:/usr/share/elasticsearch/data
    - ./elasticsearch/elasticsearch.yml:/usr/share/elasticsearch/config/elasticsearch.yml:ro
    - ./deploy/certs/elasticsearch:/usr/share/elasticsearch/config/certs:ro
  networks:
    core-internal:
      ipv4_address: 172.20.0.10
  healthcheck:
    test: ["CMD-SHELL", "curl -s --cacert /usr/share/elasticsearch/config/certs/ca.pem -u elastic:${ELASTICSEARCH_PASSWORD} https://localhost:9200/_cluster/health | grep -q '\"status\":\"green\"\\|\"status\":\"yellow\"'"]
    interval: 30s
    timeout: 10s
    retries: 5
  restart: unless-stopped
```

### Server Dependency Configuration
Add ES to app service dependencies in all docker-compose files:
```yaml
app:
  depends_on:
    db:
      condition: service_healthy
    elasticsearch:
      condition: service_healthy
  environment:
    - ELASTICSEARCH_URL=http://elasticsearch:9200
    - ELASTICSEARCH_USERNAME=elastic
    - ELASTICSEARCH_PASSWORD=${ELASTICSEARCH_PASSWORD}
```

---

## Security Configuration

### Create `elasticsearch/roles/eventcal-app-role.json`
```json
{
  "cluster": ["monitor", "manage_index_templates"],
  "indices": [
    {
      "names": ["eventcal-*"],
      "privileges": ["create_index", "delete_index", "read", "write", "manage"]
    }
  ]
}
```

### Create `elasticsearch/roles/eventcal-readonly-role.json`
```json
{
  "cluster": ["monitor"],
  "indices": [
    {
      "names": ["eventcal-*"],
      "privileges": ["read", "view_index_metadata"]
    }
  ]
}
```

### Initial Security Setup Script (`scripts/setup-es-security.sh`)
```bash
#!/bin/bash
# Setup Elasticsearch security after first startup

ES_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
ES_PASSWORD="${ELASTICSEARCH_PASSWORD}"

# Wait for ES to be ready
until curl -s -u "elastic:${ES_PASSWORD}" "${ES_URL}/_cluster/health" | grep -q '"status":"green"\|"status":"yellow"'; do
  echo "Waiting for Elasticsearch..."
  sleep 5
done

# Create app user
curl -X POST "${ES_URL}/_security/user/eventcal-app" \
  -u "elastic:${ES_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "'"${ELASTICSEARCH_APP_PASSWORD}"'",
    "roles": ["eventcal-app-role"],
    "full_name": "EventCal Application"
  }'

# Create readonly user for reporting
curl -X POST "${ES_URL}/_security/user/eventcal-readonly" \
  -u "elastic:${ES_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "'"${ELASTICSEARCH_READONLY_PASSWORD}"'",
    "roles": ["eventcal-readonly-role"],
    "full_name": "EventCal Readonly"
  }'

# Setup Kibana system user password
curl -X POST "${ES_URL}/_security/user/kibana_system/_password" \
  -u "elastic:${ES_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "'"${KIBANA_PASSWORD}"'"
  }'

echo "Elasticsearch security setup complete"
```

---

## Network Configuration

### Volume Definitions
```yaml
volumes:
  elasticsearch-data-dev:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${PWD}/data/elasticsearch-dev
  
  elasticsearch-data-prod:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/eventcal/elasticsearch
```

### Network Isolation (Core Environment)
```yaml
networks:
  core-internal:
    driver: bridge
    internal: true  # No external internet access
    ipam:
      config:
        - subnet: 172.20.0.0/24
```

---

## Monitoring & Logging

### Prometheus Metrics Export
Add to elasticsearch.yml for production:
```yaml
# Enable Prometheus exporter
xpack.monitoring.collection.enabled: true
xpack.monitoring.elasticsearch.collection.enabled: true

# Slow log settings
index.search.slowlog.threshold.query.warn: 10s
index.search.slowlog.threshold.query.info: 5s
index.search.slowlog.threshold.query.debug: 2s
index.search.slowlog.threshold.fetch.warn: 1s
index.indexing.slowlog.threshold.index.warn: 10s
index.indexing.slowlog.threshold.index.info: 5s
```

### Health Check Script (`scripts/check-es-health.sh`)
```bash
#!/bin/bash
# Check Elasticsearch health for monitoring systems

ES_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
ES_USER="${ELASTICSEARCH_USERNAME:-elastic}"
ES_PASS="${ELASTICSEARCH_PASSWORD}"

RESPONSE=$(curl -s -u "${ES_USER}:${ES_PASS}" "${ES_URL}/_cluster/health")
STATUS=$(echo $RESPONSE | jq -r '.status')

case $STATUS in
  "green")
    echo "ES_HEALTH_STATUS=0"
    exit 0
    ;;
  "yellow")
    echo "ES_HEALTH_STATUS=1"
    exit 0
    ;;
  "red")
    echo "ES_HEALTH_STATUS=2"
    exit 1
    ;;
  *)
    echo "ES_HEALTH_STATUS=3"
    exit 2
    ;;
esac
```

---

## Acceptance Criteria
- [ ] Elasticsearch starts successfully in all environments (dev, prod, core)
- [ ] Kibana connects to ES in development
- [ ] ICU plugin installed and functional (test Arabic tokenization)
- [ ] Health checks pass
- [ ] Memory limits enforced
- [ ] SSL/TLS working in production
- [ ] Security users created
- [ ] App can connect to ES from container
- [ ] Data persisted across container restarts
- [ ] Logs accessible via docker logs
- [ ] Slow query logging enabled

## Testing Steps
1. **Development Environment**:
   ```bash
   npm run docker:dev:build
   curl http://localhost:9200/_cluster/health
   curl http://localhost:5601/api/status  # Kibana
   ```

2. **ICU Plugin Verification**:
   ```bash
   curl -X POST "localhost:9200/_analyze" -H "Content-Type: application/json" -d '{
     "tokenizer": "icu_tokenizer",
     "text": "مؤتمر الشرق الأوسط"
   }'
   ```

3. **Security Test** (after setup):
   ```bash
   curl -u eventcal-app:password localhost:9200/_cat/indices
   ```

4. **Production Subdomain Verification**:
   ```bash
   # After DNS propagation and SSL certificate issuance
   curl https://kibana.eventcal.app/api/status
   curl https://storage.eventcal.app/minio/health/live
   ```

## Troubleshooting Guide

### Common Issues

1. **ES fails to start with memory error**:
   - Check available system memory
   - Reduce `ES_JAVA_OPTS` heap size
   - Run `sudo sysctl -w vm.max_map_count=262144`

2. **"max virtual memory areas" error**:
   ```bash
   # Linux
   echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   
   # macOS (Docker Desktop)
   # Increase memory in Docker Desktop preferences
   ```

3. **Connection refused from app**:
   - Check ES health: `docker logs eventcal-elasticsearch-dev`
   - Verify network: `docker network inspect ecssr-network`
   - Check env vars: `docker exec ecssr-events-app-dev env | grep ELASTIC`

4. **ICU plugin not found**:
   - Rebuild ES image: `docker compose build elasticsearch`
   - Verify plugin: `docker exec eventcal-elasticsearch-dev bin/elasticsearch-plugin list`

5. **Kibana subdomain not accessible (production)**:
   - Verify DNS: `dig kibana.eventcal.app`
   - Check SSL cert: `docker compose exec acme-companion /app/cert_status`
   - Verify nginx-proxy: `docker compose logs reverse-proxy | grep kibana`

6. **MinIO console not accessible (production)**:
   - Verify DNS: `dig storage.eventcal.app`
   - Check MinIO logs: `docker compose logs minio`
   - Verify MINIO_BROWSER_REDIRECT_URL matches subdomain

## Dependencies
- Docker Engine 24.0+
- Docker Compose v2.20+
- 4GB RAM minimum (8GB recommended for production)

## Related Tasks
- 02: Backend Client Integration
- 18: Production Hardening
- `.env.production` - Add ES environment variables
- `.env.example` - Document ES environment variables
- `DOCKER.md` - Document ES container usage

## Acceptance Criteria
- [ ] Elasticsearch container starts successfully with `docker compose up`
- [ ] Kibana accessible at http://localhost:5601 in development
- [ ] ES health check returns green/yellow status
- [ ] ICU plugin installed and available
- [ ] Data persists across container restarts (volume mount working)
- [ ] Memory limits prevent OOM errors
- [ ] Authentication working (elastic user can connect)
- [ ] Environment variables properly configured per environment
- [ ] Documentation updated in DOCKER.md

## Testing Steps
1. Start containers: `npm run docker:dev:build`
2. Verify ES health: `curl -u elastic:password http://localhost:9200/_cluster/health`
3. Verify ICU plugin: `curl -u elastic:password http://localhost:9200/_cat/plugins`
4. Access Kibana: http://localhost:5601 (login with elastic user)
5. Restart containers and verify data persistence
6. Check memory usage stays within limits

## Dependencies
- Docker & Docker Compose
- Elasticsearch 8.12.0 image
- Kibana 8.12.0 image (dev only)

## Notes
- Elasticsearch 8.x required for latest security features and performance
- ICU plugin MUST be installed for Arabic text analysis
- Memory: 1GB heap minimum for dev, 2GB for production
- Single-node discovery for dev, cluster configuration for prod later
- Consider snapshot/backup strategy in production task

## Related Tasks
- 02: Backend ES Client Integration
- 03: Arabic/English Analyzer Configuration
