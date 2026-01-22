# Elasticsearch API Reference

This document provides a complete reference for all Elasticsearch-related API endpoints in EventVue.

## Table of Contents

1. [Search API](#search-api)
2. [Suggestion API](#suggestion-api)
3. [Analytics API](#analytics-api)
4. [Admin API](#admin-api)
5. [Health API](#health-api)

---

## Authentication

All endpoints require authentication unless otherwise noted.

```bash
# Include session cookie or Authorization header
curl -X GET "http://localhost:5050/api/search?q=conference" \
  -H "Cookie: connect.sid=<session-cookie>"
```

---

## Search API

Base path: `/api/search`

### Global Search

Search across all entity types.

```http
GET /api/search
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | required | Search query |
| `types` | string | all | Comma-separated entity types |
| `category` | string | - | Filter by category |
| `status` | string | - | Filter by status |
| `priority` | string | - | Filter by priority |
| `from` | number | 0 | Pagination offset |
| `size` | number | 20 | Results per page |

**Example Request:**

```bash
curl "http://localhost:5050/api/search?q=technology&types=events,contacts&size=10"
```

**Example Response:**

```json
{
  "hits": {
    "total": 42,
    "hits": [
      {
        "id": 123,
        "type": "events",
        "title": "Technology Summit 2024",
        "titleAr": "قمة التكنولوجيا 2024",
        "highlight": {
          "title": ["<mark>Technology</mark> Summit 2024"]
        },
        "score": 15.234
      }
    ]
  },
  "aggregations": {
    "types": {
      "buckets": [
        { "key": "events", "doc_count": 25 },
        { "key": "contacts", "doc_count": 17 }
      ]
    }
  },
  "took": 45
}
```

### Entity-Specific Search

Search within a specific entity type.

```http
GET /api/search/events
GET /api/search/archived
GET /api/search/tasks
GET /api/search/contacts
GET /api/search/organizations
GET /api/search/leads
GET /api/search/partnerships
GET /api/search/agreements
GET /api/search/departments
GET /api/search/updates
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | required | Search query |
| `from` | number | 0 | Pagination offset |
| `size` | number | 20 | Results per page |
| Additional filters vary by entity type |

### Search Status

Check search service health.

```http
GET /api/search/status
```

**Response:**

```json
{
  "status": "healthy",
  "elasticsearch": {
    "connected": true,
    "clusterHealth": "green"
  }
}
```

---

## Suggestion API

Base path: `/api/suggest` and `/api/autocomplete`

### Multi-Entity Suggestions

Get suggestions across multiple entity types with did-you-mean support.

```http
GET /api/suggest
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | required | Query text (min 1 char) |
| `types` | string | events,contacts,organizations | Entity types |
| `limit` | number | 5 | Max suggestions per type |
| `fuzzy` | boolean | true | Enable fuzzy matching |
| `departmentId` | number | - | Filter by department |
| `category` | string | - | Filter by category |

**Example Request:**

```bash
curl "http://localhost:5050/api/suggest?q=tech&types=events,contacts&limit=5"
```

**Example Response:**

```json
{
  "suggestions": [
    {
      "text": "Technology Conference",
      "textAr": "مؤتمر التكنولوجيا",
      "type": "events",
      "id": 123,
      "score": 0.95,
      "highlight": "<mark>Tech</mark>nology Conference"
    }
  ],
  "didYouMean": null,
  "took": 12
}
```

### Did You Mean

Get spelling corrections.

```http
GET /api/suggest/did-you-mean
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Query to check |

**Response:**

```json
{
  "original": "conferance",
  "suggestion": "conference"
}
```

### Popular Searches

Get popular search terms.

```http
GET /api/suggest/popular
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | 7d | Time period: 24h, 7d, 30d |

**Response:**

```json
{
  "searches": [
    { "term": "conference", "count": 150, "trend": "up" },
    { "term": "workshop", "count": 120, "trend": "stable" }
  ],
  "period": "7d"
}
```

### Entity Autocomplete

Get autocomplete options for a specific entity type.

```http
GET /api/autocomplete/events
GET /api/autocomplete/contacts
GET /api/autocomplete/organizations
GET /api/autocomplete/tasks
GET /api/autocomplete/partnerships
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | required | Query text |
| `limit` | number | 10 | Max results |

**Response:**

```json
{
  "options": [
    {
      "value": "123",
      "label": "Technology Summit 2024",
      "labelAr": "قمة التكنولوجيا 2024",
      "type": "events",
      "id": 123
    }
  ],
  "took": 8
}
```

---

## Analytics API

Base path: `/api/analytics`

### Dashboard Summary

Get overall dashboard metrics.

```http
GET /api/analytics/dashboard/summary
```

**Response:**

```json
{
  "events": {
    "total": 150,
    "thisMonth": 12,
    "upcoming": 8
  },
  "tasks": {
    "total": 450,
    "completed": 380,
    "overdue": 15
  },
  "contacts": {
    "total": 2500,
    "speakers": 120
  },
  "partnerships": {
    "active": 45,
    "pendingRenewal": 8
  }
}
```

### Events Analytics

```http
GET /api/analytics/events/by-category
GET /api/analytics/events/by-type
GET /api/analytics/events/by-month?year=2024
GET /api/analytics/events/trends?period=month
```

### Tasks Analytics

```http
GET /api/analytics/tasks/by-status
GET /api/analytics/tasks/by-priority
GET /api/analytics/tasks/by-department
GET /api/analytics/tasks/completion-rate?period=month
GET /api/analytics/tasks/overdue
```

### Partnership Analytics

```http
GET /api/analytics/partnerships/by-status
GET /api/analytics/partnerships/by-country
GET /api/analytics/organizations/by-type
GET /api/analytics/leads/by-stage
```

### Activity Trends

```http
GET /api/analytics/overview/trends?days=30
```

### Cache Management (Superadmin)

```http
POST /api/analytics/cache/invalidate
GET /api/analytics/cache/stats
```

---

## Admin API

Base path: `/api/admin/elasticsearch`

**Note:** All admin endpoints require superadmin role.

### Sync Status

Get current sync status.

```http
GET /api/admin/elasticsearch/sync-status
```

**Response:**

```json
{
  "lastSync": "2024-01-15T10:30:00Z",
  "lastFullSync": "2024-01-15T03:00:00Z",
  "status": "idle",
  "documentsIndexed": 15420,
  "cronEnabled": true,
  "cronSchedule": "*/5 * * * *"
}
```

### Trigger Reindex

Trigger a full reindex of all entities.

```http
POST /api/admin/elasticsearch/reindex
```

**Request Body:**

```json
{
  "deleteExisting": false,
  "batchSize": 500
}
```

**Response:**

```json
{
  "success": true,
  "message": "Reindex started",
  "jobId": "reindex-1705312200000"
}
```

### Incremental Sync

Trigger an incremental sync.

```http
POST /api/admin/elasticsearch/sync
```

### Entity-Specific Reindex

Reindex a specific entity type.

```http
POST /api/admin/elasticsearch/reindex/:entity
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `entity` | string | Entity type (events, tasks, contacts, etc.) |

### Cleanup Orphans

Remove documents without matching database records.

```http
POST /api/admin/elasticsearch/cleanup
```

### Index Management

List all indices with statistics.

```http
GET /api/admin/elasticsearch/indices
```

**Response:**

```json
{
  "indices": [
    {
      "name": "eventcal-events-dev",
      "health": "green",
      "status": "open",
      "docsCount": 1250,
      "storeSize": "2.5mb"
    }
  ]
}
```

Refresh all indices.

```http
POST /api/admin/elasticsearch/indices/refresh
```

Recreate a specific index.

```http
POST /api/admin/elasticsearch/indices/:index/recreate
```

Create all missing indices.

```http
POST /api/admin/elasticsearch/indices/create-all
```

---

## Health API

Base path: `/api/health/elasticsearch`

### Health Check

Check Elasticsearch connection health.

```http
GET /api/health/elasticsearch
```

**Response:**

```json
{
  "status": "green",
  "enabled": true,
  "cluster": {
    "name": "eventcal-cluster-dev",
    "status": "green",
    "numberOfNodes": 1,
    "numberOfDataNodes": 1,
    "activePrimaryShards": 15,
    "activeShards": 15
  }
}
```

### Detailed Health

Get detailed health metrics.

```http
GET /api/health/elasticsearch/detailed
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_QUERY` | 400 | Invalid query parameters |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `ES_UNAVAILABLE` | 503 | Elasticsearch unavailable |
| `INTERNAL_ERROR` | 500 | Internal server error |

---

## Rate Limits

| Endpoint Group | Limit |
|----------------|-------|
| Search | 100 req/min |
| Suggestions | 200 req/min |
| Analytics | 60 req/min |
| Admin | 10 req/min |

---

## Related Documentation

- [ELASTICSEARCH_ARCHITECTURE.md](./ELASTICSEARCH_ARCHITECTURE.md)
- [ELASTICSEARCH_QUERIES.md](./ELASTICSEARCH_QUERIES.md)
