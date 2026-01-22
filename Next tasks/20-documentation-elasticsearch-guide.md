# Documentation: Elasticsearch Implementation Guide

## Type
Documentation

## Priority
🟢 Low

## Estimated Effort
3-4 hours

## Description
Comprehensive documentation for the Elasticsearch implementation including architecture, API reference, subdomain configuration (Kibana/MinIO), and troubleshooting.

## Subdomain Architecture
Following the established pattern with Keycloak (`auth.eventcal.app`):
- **Kibana**: `kibana.eventcal.app` - Analytics and visualization dashboard
- **MinIO Console**: `storage.eventcal.app` - Object storage management
- **Elasticsearch**: Internal only (no public subdomain)

## Requirements

### Documentation Files

#### 1. Architecture Overview (`docs/ELASTICSEARCH_ARCHITECTURE.md`)
- System architecture diagram
- Data flow (PostgreSQL → ES)
- Index structure with configurable prefix
- Analyzer configuration
- Subdomain routing diagram

#### 2. API Reference (`docs/ELASTICSEARCH_API.md`)
- Search endpoints
- Aggregation endpoints
- Admin endpoints
- Request/response examples

#### 3. Setup Guide (`docs/ELASTICSEARCH_SETUP.md`)
- Development setup
- Production deployment with subdomains
- Environment variables (including ES_INDEX_PREFIX)
- DNS configuration for kibana.eventcal.app and storage.eventcal.app
- Troubleshooting common issues

#### 4. Query Guide (`docs/ELASTICSEARCH_QUERIES.md`)
- Query syntax examples
- Filter usage
- Aggregation examples
- Performance tips

#### 5. Maintenance Guide (`docs/ELASTICSEARCH_MAINTENANCE.md`)
- Backup procedures
- Index lifecycle
- Scaling guidelines
- Monitoring setup via Kibana

---

## Complete Documentation Content

### `docs/ELASTICSEARCH_SETUP.md`
```markdown
# Elasticsearch Setup Guide

## Overview
EventCal uses Elasticsearch 8.x for advanced search, analytics, and reporting capabilities.

## Architecture
\`\`\`
                    ┌─────────────────────────────────────────────┐
                    │            nginx-proxy (443)                │
                    │  ┌─────────────────────────────────────────┐│
                    │  │ eventcal.app → client                   ││
                    │  │ api.eventcal.app → server               ││
                    │  │ auth.eventcal.app → keycloak            ││
                    │  │ kibana.eventcal.app → kibana            ││
                    │  │ storage.eventcal.app → minio:9001       ││
                    │  └─────────────────────────────────────────┘│
                    └─────────────────────────────────────────────┘
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          │                             │                             │
          ▼                             ▼                             ▼
    ┌──────────┐                 ┌──────────┐                  ┌──────────┐
    │  server  │◄───────────────►│   ES     │◄────────────────►│  Kibana  │
    │          │                 │          │                  │          │
    └──────────┘                 └──────────┘                  └──────────┘
          │                             │
          │                             │
          ▼                             │
    ┌──────────┐                        │
    │PostgreSQL│ ◄──── sync ────────────┘
    └──────────┘
\`\`\`

## Index Naming Convention

Indices are configurable via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| \`ES_INDEX_PREFIX\` | \`eventcal\` | Base prefix for all indices |
| \`ES_INDEX_SUFFIX\` | \`dev\`/\`prod\` | Environment-based suffix |

**Pattern:** \`{prefix}-{entity}-{suffix}\`

**Examples:**
- Development: \`eventcal-events-dev\`, \`eventcal-tasks-dev\`
- Production: \`eventcal-events-prod\`, \`eventcal-tasks-prod\`

**Aliases:** \`eventcal-events\` (queries work across environments)

## Development Setup

### 1. Environment Variables

Add to \`.env.development\`:

\`\`\`bash
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
\`\`\`

### 2. Start Services

\`\`\`bash
# Build and start with ES + Kibana
npm run docker:dev:build

# Access points:
# - Application: http://localhost:5000
# - Kibana: http://localhost:5601
# - ES Health: http://localhost:9200/_cluster/health
\`\`\`

### 3. Verify Installation

\`\`\`bash
# Check ES health
curl -u elastic:eventcal-dev-password-2024 http://localhost:9200/_cluster/health

# Check indices
curl -u elastic:eventcal-dev-password-2024 http://localhost:9200/_cat/indices?v

# Access Kibana
open http://localhost:5601
# Login: elastic / eventcal-dev-password-2024
\`\`\`

## Production Deployment

### 1. DNS Configuration

Create A/AAAA records pointing to your server:

\`\`\`
eventcal.app         A    <server-ip>
www.eventcal.app     A    <server-ip>
api.eventcal.app     A    <server-ip>
auth.eventcal.app    A    <server-ip>
kibana.eventcal.app  A    <server-ip>
storage.eventcal.app A    <server-ip>
\`\`\`

### 2. Environment Variables

Add to \`.env.production\`:

\`\`\`bash
# Elasticsearch
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=\${SECURE_ES_PASSWORD}
ELASTICSEARCH_ENABLED=true

# Index Configuration
ES_INDEX_PREFIX=eventcal
ES_INDEX_SUFFIX=prod

# Kibana - Production Subdomain
KIBANA_PASSWORD=\${SECURE_KIBANA_PASSWORD}
KIBANA_ENABLED=true
KIBANA_DOMAIN=kibana.eventcal.app
KIBANA_PUBLIC_URL=https://kibana.eventcal.app
KIBANA_ENCRYPTION_KEY=\${KIBANA_ENCRYPTION_KEY}

# MinIO Console - Production Subdomain
MINIO_CONSOLE_DOMAIN=storage.eventcal.app
MINIO_CONSOLE_PUBLIC_URL=https://storage.eventcal.app
\`\`\`

### 3. Docker Compose Configuration

The production \`docker-compose.yml\` automatically configures:

- **Kibana** with nginx-proxy integration via:
  - \`VIRTUAL_HOST=kibana.eventcal.app\`
  - \`LETSENCRYPT_HOST=kibana.eventcal.app\`

- **MinIO Console** with nginx-proxy integration via:
  - \`VIRTUAL_HOST=storage.eventcal.app\`
  - \`LETSENCRYPT_HOST=storage.eventcal.app\`

### 4. Deploy

\`\`\`bash
# Deploy production stack
docker compose --env-file .env.production up -d

# Verify services
curl https://kibana.eventcal.app/api/status
curl https://storage.eventcal.app/minio/health/live
\`\`\`

## Security Considerations

### Kibana Access Control

Kibana is exposed at \`kibana.eventcal.app\` and requires authentication.

**Option 1: Elasticsearch Native Auth** (Default)
- Users authenticate with ES credentials
- Create dedicated Kibana users with limited roles

\`\`\`bash
# Create read-only Kibana user
curl -X POST "localhost:9200/_security/user/kibana_viewer" \\
  -H "Content-Type: application/json" \\
  -u elastic:\${ES_PASSWORD} \\
  -d '{
    "password": "viewer-password",
    "roles": ["kibana_system", "viewer"],
    "full_name": "Kibana Viewer"
  }'
\`\`\`

**Option 2: Reverse Proxy Auth** (Advanced)
- Add basic auth at nginx-proxy level
- Restrict IP ranges

### MinIO Access Control

MinIO console at \`storage.eventcal.app\` requires root credentials.

**Best Practice:** Create limited access policies:

\`\`\`bash
# Create read-only policy for media bucket
mc admin policy create myminio readonly-media policy.json
mc admin user add myminio media-viewer viewer-password
mc admin policy attach myminio readonly-media --user media-viewer
\`\`\`

## Troubleshooting

### Elasticsearch Won't Start

\`\`\`bash
# Check logs
docker compose logs elasticsearch

# Common issues:
# 1. Memory - increase vm.max_map_count
sudo sysctl -w vm.max_map_count=262144

# 2. Disk space
df -h

# 3. Permissions
sudo chown -R 1000:1000 ./data/elasticsearch
\`\`\`

### Kibana Can't Connect to ES

\`\`\`bash
# Verify ES is healthy
curl -u elastic:\$ES_PASSWORD http://elasticsearch:9200/_cluster/health

# Check Kibana logs
docker compose logs kibana

# Verify network connectivity
docker compose exec kibana curl http://elasticsearch:9200
\`\`\`

### Index Not Found Errors

\`\`\`bash
# List all indices
curl -u elastic:\$ES_PASSWORD http://localhost:9200/_cat/indices?v

# Check index prefix configuration
docker compose exec app env | grep ES_INDEX

# Re-initialize indices
curl -X POST http://localhost:5000/api/admin/elasticsearch/init-indices
\`\`\`

### SSL Certificate Issues (Production)

\`\`\`bash
# Check certificate status
docker compose exec acme-companion /app/cert_status

# Force certificate renewal
docker compose exec acme-companion /app/force_renew

# Check nginx-proxy logs
docker compose logs reverse-proxy
\`\`\`
\`\`\`

### `docs/ELASTICSEARCH_ARCHITECTURE.md`
```markdown
# Elasticsearch Architecture

## System Overview

EventCal uses Elasticsearch as a secondary data store optimized for:
- Full-text search with Arabic/English support
- Real-time analytics and aggregations
- Complex filtering and faceted navigation
- Autocomplete and suggestions

## Data Flow

\`\`\`
┌─────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────┐    CRUD     ┌──────────┐                            │
│   │  Client  │───────────►│  Server  │                             │
│   └──────────┘             └────┬─────┘                            │
│                                 │                                   │
│                    ┌────────────┼────────────┐                      │
│                    │            │            │                      │
│                    ▼            ▼            ▼                      │
│              ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│              │PostgreSQL│ │ ES Index │ │  MinIO   │                │
│              │(Primary) │ │(Secondary│ │ (Media)  │                │
│              └──────────┘ └──────────┘ └──────────┘                │
│                                                                     │
│   Write Path: PostgreSQL first → async ES index                    │
│   Read Path:  Search → ES | Detail → PostgreSQL                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
\`\`\`

## Index Structure

### Naming Convention
\`\`\`
{ES_INDEX_PREFIX}-{entity}-{ES_INDEX_SUFFIX}
     │              │           │
     │              │           └── Environment: dev, prod, staging
     │              └────────────── Entity: events, tasks, contacts
     └───────────────────────────── Prefix: eventcal (configurable)
\`\`\`

### Index Catalog

| Entity | Index Pattern | Alias | Retention |
|--------|--------------|-------|-----------|
| Events | eventcal-events-* | eventcal-events | Indefinite |
| Archived Events | eventcal-archived-events-* | eventcal-archived-events | Indefinite |
| Tasks | eventcal-tasks-* | eventcal-tasks | Indefinite |
| Contacts | eventcal-contacts-* | eventcal-contacts | Indefinite |
| Organizations | eventcal-organizations-* | eventcal-organizations | Indefinite |
| Partnerships | eventcal-partnerships-* | eventcal-partnerships | Indefinite |
| Agreements | eventcal-agreements-* | eventcal-agreements | Indefinite |
| Leads | eventcal-leads-* | eventcal-leads | Indefinite |
| Departments | eventcal-departments-* | eventcal-departments | Indefinite |
| Attendees | eventcal-attendees-* | eventcal-attendees | Indefinite |
| Invitees | eventcal-invitees-* | eventcal-invitees | Indefinite |
| Lead Interactions | eventcal-lead-interactions-* | eventcal-lead-interactions | 1 year |
| Partnership Activities | eventcal-partnership-activities-* | eventcal-partnership-activities | Indefinite |
| Partnership Interactions | eventcal-partnership-interactions-* | eventcal-partnership-interactions | 1 year |
| Updates | eventcal-updates-* | eventcal-updates | 2 years |

## Analyzer Configuration

### Bilingual Support (Arabic + English)

\`\`\`json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "eventcal_arabic": {
          "type": "custom",
          "tokenizer": "icu_tokenizer",
          "filter": ["lowercase", "arabic_normalization", "arabic_stemmer"]
        },
        "eventcal_english": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "english_stemmer", "english_possessive_stemmer"]
        },
        "eventcal_bilingual": {
          "type": "custom",
          "tokenizer": "icu_tokenizer",
          "filter": ["lowercase", "icu_folding"]
        }
      }
    }
  }
}
\`\`\`

### Field Mapping Strategy

| Field Type | Analyzer | Use Case |
|------------|----------|----------|
| nameEn | eventcal_english | English full-text search |
| nameAr | eventcal_arabic | Arabic full-text search |
| searchText | eventcal_bilingual | Combined search |
| *.keyword | keyword | Exact match, aggregations |
| suggest | completion | Autocomplete |
\`\`\`

---

### Update Existing Docs

#### Add to `docs/ARCHITECTURE.md`
\`\`\`markdown
## Search & Analytics (Elasticsearch)

EventCal uses Elasticsearch 8.x for advanced search capabilities:

- **Bilingual Search**: Full Arabic and English text search with proper stemming
- **Real-time Analytics**: Aggregations for dashboards and reporting
- **Autocomplete**: Type-ahead suggestions for events, contacts, organizations
- **Faceted Search**: Filter by category, date range, status, etc.

### Index Configuration
- Prefix: Configurable via \`ES_INDEX_PREFIX\` (default: \`eventcal\`)
- Environment suffix via \`ES_INDEX_SUFFIX\` (auto-detected)

### Access Points
- **Kibana Dashboard**: https://kibana.eventcal.app (admin analytics)
- **MinIO Console**: https://storage.eventcal.app (media management)

See [ELASTICSEARCH_SETUP.md](./ELASTICSEARCH_SETUP.md) for detailed configuration.
\`\`\`

#### Add to `docs/SETUP.md`
\`\`\`markdown
## Elasticsearch Setup

### Development
Elasticsearch and Kibana are included in the development Docker setup:
\`\`\`bash
npm run docker:dev:build
# Kibana: http://localhost:5601
\`\`\`

### Production
Configure the following in \`.env.production\`:
\`\`\`bash
ES_INDEX_PREFIX=eventcal
KIBANA_DOMAIN=kibana.eventcal.app
MINIO_CONSOLE_DOMAIN=storage.eventcal.app
\`\`\`

See [ELASTICSEARCH_SETUP.md](./ELASTICSEARCH_SETUP.md) for full details.
\`\`\`

#### Add to `DOCKER.md`
\`\`\`markdown
## Elasticsearch & Kibana

### Development Services
- **elasticsearch**: Search engine on port 9200
- **kibana**: Analytics dashboard on port 5601

### Production Subdomains
- kibana.eventcal.app → Kibana dashboard (auto-SSL)
- storage.eventcal.app → MinIO console (auto-SSL)

Both use nginx-proxy with Let's Encrypt for automatic SSL.
\`\`\`
\`\`\`

---

## Files to Create
- `docs/ELASTICSEARCH_ARCHITECTURE.md`
- `docs/ELASTICSEARCH_API.md`
- `docs/ELASTICSEARCH_SETUP.md`
- `docs/ELASTICSEARCH_QUERIES.md`
- `docs/ELASTICSEARCH_MAINTENANCE.md`

## Files to Modify
- `docs/ARCHITECTURE.md` - Add ES and subdomain section
- `docs/SETUP.md` - Add ES setup steps
- `DOCKER.md` - Add ES container info and subdomain configuration

## Acceptance Criteria
- [ ] All documentation files created
- [ ] Diagrams included where helpful
- [ ] Code examples provided
- [ ] Subdomain configuration documented (kibana.eventcal.app, storage.eventcal.app)
- [ ] Configurable index prefix documented
- [ ] Troubleshooting section complete
- [ ] Cross-references between docs
- [ ] DNS setup instructions for subdomains

## Dependencies
- All ES tasks completed
