# Elasticsearch Architecture

This document provides a comprehensive overview of the Elasticsearch implementation in EventVue.

## Table of Contents

1. [System Overview](#system-overview)
2. [Data Flow](#data-flow)
3. [Index Structure](#index-structure)
4. [Analyzer Configuration](#analyzer-configuration)
5. [Service Architecture](#service-architecture)
6. [Subdomain Architecture](#subdomain-architecture)

---

## System Overview

EventVue uses Elasticsearch 8.x as a secondary data store optimized for:

- **Full-text search** with Arabic and English support
- **Real-time analytics** and aggregations
- **Complex filtering** and faceted navigation
- **Autocomplete** and search suggestions
- **Dashboard visualizations** via Kibana

### Technology Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Elasticsearch | 8.12.0 | Search engine and analytics |
| Kibana | 8.12.0 | Visualization and dashboards |
| ICU Plugin | 8.12.0 | Arabic text analysis |

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────┐    CRUD     ┌──────────┐                             │
│   │  Client  │───────────►│  Server  │                              │
│   └──────────┘             └────┬─────┘                             │
│                                 │                                    │
│                    ┌────────────┼────────────┐                       │
│                    │            │            │                       │
│                    ▼            ▼            ▼                       │
│              ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│              │PostgreSQL│ │   ES     │ │  MinIO   │                 │
│              │(Primary) │ │(Secondary│ │ (Media)  │                 │
│              └──────────┘ └──────────┘ └──────────┘                 │
│                                                                      │
│   Write Path: PostgreSQL first → async ES index                     │
│   Read Path:  Search → ES | Detail → PostgreSQL                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Write Path

1. Client sends CRUD request to server
2. Server writes to PostgreSQL (source of truth)
3. On success, server asynchronously indexes to Elasticsearch
4. Index failures are logged but don't block the main operation

### Read Path

- **Search queries**: Routed to Elasticsearch for speed
- **Detail views**: Fetched from PostgreSQL for consistency
- **Analytics**: Aggregated from Elasticsearch
- **Autocomplete**: Served by Elasticsearch suggestions

---

## Index Structure

### Naming Convention

```
{ES_INDEX_PREFIX}-{entity}-{ES_INDEX_SUFFIX}
       │              │           │
       │              │           └── Environment: dev, prod, staging
       │              └────────────── Entity: events, tasks, contacts
       └───────────────────────────── Prefix: eventcal (configurable)
```

**Examples:**
- Development: `eventcal-events-dev`, `eventcal-tasks-dev`
- Production: `eventcal-events-prod`, `eventcal-tasks-prod`

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ES_INDEX_PREFIX` | `eventcal` | Base prefix for all indices |
| `ES_INDEX_SUFFIX` | Auto-detected | `dev` or `prod` based on NODE_ENV |

### Index Catalog

| Entity | Index Pattern | Description |
|--------|--------------|-------------|
| Events | `eventcal-events-*` | Active events |
| Archived Events | `eventcal-archived-events-*` | Completed/archived events |
| Tasks | `eventcal-tasks-*` | Event tasks and assignments |
| Contacts | `eventcal-contacts-*` | Contact directory |
| Organizations | `eventcal-organizations-*` | Organizations and companies |
| Partnerships | `eventcal-partnerships-*` | Partnership records |
| Agreements | `eventcal-agreements-*` | Partnership agreements |
| Leads | `eventcal-leads-*` | Sales leads |
| Departments | `eventcal-departments-*` | Internal departments |
| Attendees | `eventcal-attendees-*` | Event attendees |
| Invitees | `eventcal-invitees-*` | Event invitations |
| Lead Interactions | `eventcal-lead-interactions-*` | Lead activity log |
| Partnership Activities | `eventcal-partnership-activities-*` | Partnership timeline |
| Partnership Interactions | `eventcal-partnership-interactions-*` | Communication log |
| Updates | `eventcal-updates-*` | Weekly/monthly updates |

### Index Settings

```json
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "refresh_interval": "5s",
    "analysis": { /* See Analyzer Configuration */ }
  }
}
```

---

## Analyzer Configuration

### Bilingual Support (Arabic + English)

EventVue supports full-text search in both Arabic and English using custom analyzers with the ICU plugin.

#### Arabic Analyzer

```json
{
  "eventcal_arabic": {
    "type": "custom",
    "tokenizer": "icu_tokenizer",
    "filter": [
      "lowercase",
      "arabic_normalization",
      "arabic_stemmer",
      "icu_folding"
    ]
  }
}
```

Features:
- Proper Arabic tokenization
- Diacritics (tashkeel) removal
- Alef normalization (أ إ آ → ا)
- Teh marbuta handling
- Root-based stemming

#### English Analyzer

```json
{
  "eventcal_english": {
    "type": "custom",
    "tokenizer": "standard",
    "filter": [
      "lowercase",
      "english_possessive_stemmer",
      "english_stemmer"
    ]
  }
}
```

#### Bilingual Analyzer

```json
{
  "eventcal_bilingual": {
    "type": "custom",
    "tokenizer": "icu_tokenizer",
    "filter": [
      "lowercase",
      "icu_folding"
    ]
  }
}
```

#### Autocomplete Analyzer

```json
{
  "autocomplete_analyzer": {
    "type": "custom",
    "tokenizer": "autocomplete_tokenizer",
    "filter": ["lowercase", "asciifolding"]
  },
  "autocomplete_tokenizer": {
    "type": "edge_ngram",
    "min_gram": 2,
    "max_gram": 20,
    "token_chars": ["letter", "digit"]
  }
}
```

### Field Mapping Strategy

| Field Type | Analyzer | Use Case |
|------------|----------|----------|
| `title` / `nameEn` | `eventcal_english` | English full-text search |
| `titleAr` / `nameAr` | `eventcal_arabic` | Arabic full-text search |
| `searchText` | `eventcal_bilingual` | Combined search |
| `*.keyword` | `keyword` | Exact match, sorting, aggregations |
| `suggest` | `completion` | Autocomplete suggestions |

---

## Service Architecture

### Backend Services

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Backend Services                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐    ┌─────────────────────┐                │
│  │  ES Client          │    │  ES Config          │                │
│  │  server/elasticsearch│    │  Index prefix,      │                │
│  │  /client.ts         │    │  credentials        │                │
│  └─────────┬───────────┘    └─────────────────────┘                │
│            │                                                         │
│   ┌────────┴────────┬───────────────┬───────────────┐              │
│   │                 │               │               │               │
│   ▼                 ▼               ▼               ▼               │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐           │
│ │ Indexing  │ │  Search   │ │ Suggest   │ │Aggregation│           │
│ │ Service   │ │  Service  │ │  Service  │ │  Service  │           │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

| Service | File | Purpose |
|---------|------|---------|
| ES Client | `server/elasticsearch/client.ts` | Connection management |
| Indexing | `server/services/elasticsearch-indexing.service.ts` | CRUD sync |
| Sync | `server/services/elasticsearch-sync.service.ts` | Batch sync |
| Search | `server/services/elasticsearch-search.service.ts` | Query handling |
| Suggest | `server/services/elasticsearch-suggest.service.ts` | Autocomplete |
| Aggregations | `server/services/elasticsearch-aggregations.service.ts` | Analytics |

### Cron Jobs

| Schedule | Job | Description |
|----------|-----|-------------|
| Every 5 min | Incremental sync | Sync recent changes |
| Daily 3 AM GST | Full sync | Complete reindex |
| Weekly Sun 2 AM | Optimization | Force merge indices |
| Weekly Sun 4 AM | Cleanup | Remove orphan documents |

---

## Subdomain Architecture

Following the established pattern with Keycloak (`auth.eventcal.app`):

```
┌─────────────────────────────────────────────────────────────────────┐
│                        nginx-proxy (443)                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  eventcal.app          → client (React app)                         │
│  api.eventcal.app      → server (Express API)                       │
│  auth.eventcal.app     → keycloak (SSO)                             │
│  kibana.eventcal.app   → kibana (Analytics)                         │
│  storage.eventcal.app  → minio:9001 (Media storage)                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Public Endpoints

| Subdomain | Service | Purpose |
|-----------|---------|---------|
| `eventcal.app` | Client | Main application |
| `api.eventcal.app` | Server | REST API |
| `auth.eventcal.app` | Keycloak | Authentication |
| `kibana.eventcal.app` | Kibana | Analytics dashboards |
| `storage.eventcal.app` | MinIO | Media management |

### Internal Only

- **Elasticsearch**: Not exposed publicly, accessed only by server
- **PostgreSQL**: Internal database connection
- **Redis**: Session/cache (if used)

---

## Related Documentation

- [ELASTICSEARCH_SETUP.md](./ELASTICSEARCH_SETUP.md) - Installation guide
- [ELASTICSEARCH_API.md](./ELASTICSEARCH_API.md) - API reference
- [ELASTICSEARCH_QUERIES.md](./ELASTICSEARCH_QUERIES.md) - Query examples
- [ELASTICSEARCH_MAINTENANCE.md](./ELASTICSEARCH_MAINTENANCE.md) - Operations guide
- [ES_PRODUCTION.md](./ES_PRODUCTION.md) - Production deployment
- [ES_DISASTER_RECOVERY.md](./ES_DISASTER_RECOVERY.md) - Recovery procedures
