# Elasticsearch Query Guide

This guide provides examples and best practices for querying Elasticsearch in EventVue.

## Table of Contents

1. [Query Basics](#query-basics)
2. [Full-Text Search](#full-text-search)
3. [Filtering](#filtering)
4. [Aggregations](#aggregations)
5. [Autocomplete](#autocomplete)
6. [Performance Tips](#performance-tips)

---

## Query Basics

### Index Naming

All queries use the configured index prefix:

```bash
# Pattern: {prefix}-{entity}-{suffix}
# Example: eventcal-events-dev

# Query all events indices
GET /eventcal-events-*/_search

# Query specific index
GET /eventcal-events-dev/_search
```

### Basic Query Structure

```json
{
  "query": {
    "bool": {
      "must": [],      // Required matches (AND)
      "should": [],    // Optional matches (OR)
      "filter": [],    // Non-scoring filters
      "must_not": []   // Exclusions
    }
  },
  "from": 0,
  "size": 20,
  "sort": [],
  "_source": [],
  "highlight": {},
  "aggs": {}
}
```

---

## Full-Text Search

### Simple Match Query

```json
// Search for "technology" in title field
{
  "query": {
    "match": {
      "title": "technology"
    }
  }
}
```

### Multi-Match Query

Search across multiple fields:

```json
{
  "query": {
    "multi_match": {
      "query": "technology conference",
      "fields": ["title^3", "titleAr^3", "description", "descriptionAr"],
      "type": "best_fields",
      "fuzziness": "AUTO"
    }
  }
}
```

Field boosting:
- `title^3` = title matches are 3x more important
- Default is 1

### Phrase Match

Match exact phrases:

```json
{
  "query": {
    "match_phrase": {
      "title": "annual technology summit"
    }
  }
}
```

### Phrase Prefix (Autocomplete)

For type-ahead suggestions:

```json
{
  "query": {
    "match_phrase_prefix": {
      "title": {
        "query": "tech",
        "max_expansions": 10
      }
    }
  }
}
```

### Arabic Search

Arabic text is automatically analyzed with stemming and normalization:

```json
{
  "query": {
    "multi_match": {
      "query": "مؤتمر التكنولوجيا",
      "fields": ["titleAr^2", "descriptionAr"],
      "analyzer": "eventcal_arabic"
    }
  }
}
```

### Combined Arabic/English Search

```json
{
  "query": {
    "bool": {
      "should": [
        {
          "multi_match": {
            "query": "technology",
            "fields": ["title^2", "description"],
            "analyzer": "eventcal_english"
          }
        },
        {
          "multi_match": {
            "query": "تكنولوجيا",
            "fields": ["titleAr^2", "descriptionAr"],
            "analyzer": "eventcal_arabic"
          }
        }
      ],
      "minimum_should_match": 1
    }
  }
}
```

---

## Filtering

### Term Filter (Exact Match)

```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "status": "active" } },
        { "term": { "category": "conference" } }
      ]
    }
  }
}
```

### Terms Filter (Multiple Values)

```json
{
  "query": {
    "bool": {
      "filter": {
        "terms": {
          "category": ["conference", "workshop", "seminar"]
        }
      }
    }
  }
}
```

### Range Filter

```json
{
  "query": {
    "bool": {
      "filter": {
        "range": {
          "startDate": {
            "gte": "2024-01-01",
            "lte": "2024-12-31"
          }
        }
      }
    }
  }
}
```

Date math is supported:

```json
{
  "range": {
    "startDate": {
      "gte": "now/d",           // Start of today
      "lte": "now+30d/d"        // 30 days from now
    }
  }
}
```

### Exists Filter

Filter documents that have a field:

```json
{
  "query": {
    "bool": {
      "filter": {
        "exists": { "field": "thumbnailUrl" }
      }
    }
  }
}
```

### Nested Filters

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "title": "conference" } }
      ],
      "filter": [
        { "term": { "status": "active" } },
        { "range": { "startDate": { "gte": "now" } } }
      ]
    }
  }
}
```

---

## Aggregations

### Terms Aggregation

Group by field values:

```json
{
  "size": 0,
  "aggs": {
    "categories": {
      "terms": {
        "field": "category",
        "size": 10
      }
    }
  }
}
```

**Response:**

```json
{
  "aggregations": {
    "categories": {
      "buckets": [
        { "key": "conference", "doc_count": 45 },
        { "key": "workshop", "doc_count": 32 },
        { "key": "seminar", "doc_count": 18 }
      ]
    }
  }
}
```

### Date Histogram

Group by date intervals:

```json
{
  "size": 0,
  "aggs": {
    "events_over_time": {
      "date_histogram": {
        "field": "startDate",
        "calendar_interval": "month",
        "format": "yyyy-MM"
      }
    }
  }
}
```

### Stats Aggregation

Get statistics for numeric fields:

```json
{
  "size": 0,
  "aggs": {
    "task_stats": {
      "stats": {
        "field": "priority"
      }
    }
  }
}
```

### Nested Aggregations

Combine aggregations:

```json
{
  "size": 0,
  "aggs": {
    "by_category": {
      "terms": { "field": "category" },
      "aggs": {
        "by_status": {
          "terms": { "field": "status" }
        },
        "avg_duration": {
          "avg": { "field": "durationDays" }
        }
      }
    }
  }
}
```

### Filter Aggregation

Apply filters before aggregating:

```json
{
  "size": 0,
  "aggs": {
    "upcoming_events": {
      "filter": {
        "range": { "startDate": { "gte": "now" } }
      },
      "aggs": {
        "by_category": {
          "terms": { "field": "category" }
        }
      }
    }
  }
}
```

---

## Autocomplete

### Completion Suggester

Using the suggest field:

```json
{
  "suggest": {
    "event_suggest": {
      "prefix": "tech",
      "completion": {
        "field": "suggest",
        "size": 5,
        "skip_duplicates": true,
        "fuzzy": {
          "fuzziness": "AUTO"
        }
      }
    }
  }
}
```

### Prefix Query

Simple prefix matching:

```json
{
  "query": {
    "prefix": {
      "title.keyword": {
        "value": "tech",
        "case_insensitive": true
      }
    }
  },
  "size": 10,
  "_source": ["id", "title", "titleAr"]
}
```

### Multi-Field Autocomplete

```json
{
  "query": {
    "bool": {
      "should": [
        {
          "match_phrase_prefix": {
            "title": { "query": "tech", "boost": 2 }
          }
        },
        {
          "match_phrase_prefix": {
            "titleAr": { "query": "تك", "boost": 2 }
          }
        },
        {
          "prefix": {
            "title.keyword": { "value": "tech" }
          }
        }
      ],
      "minimum_should_match": 1
    }
  },
  "size": 10
}
```

---

## Performance Tips

### Use Filters for Non-Scoring Criteria

Filters are cached and don't calculate scores:

```json
// ❌ Slow - scoring unnecessary
{
  "query": {
    "bool": {
      "must": [
        { "term": { "status": "active" } }
      ]
    }
  }
}

// ✅ Fast - filter is cached
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "status": "active" } }
      ]
    }
  }
}
```

### Limit Source Fields

Only fetch fields you need:

```json
{
  "_source": ["id", "title", "titleAr", "startDate"],
  "query": { ... }
}
```

### Use Scroll for Large Results

For exporting large datasets:

```json
// Initial request
POST /eventcal-events-*/_search?scroll=5m
{
  "size": 1000,
  "query": { "match_all": {} }
}

// Subsequent requests
POST /_search/scroll
{
  "scroll": "5m",
  "scroll_id": "<scroll_id_from_previous_response>"
}
```

### Pagination Best Practices

```json
// For UI pagination (limited depth)
{
  "from": 0,
  "size": 20,
  "query": { ... }
}

// For deep pagination, use search_after
{
  "size": 20,
  "query": { ... },
  "sort": [
    { "startDate": "desc" },
    { "_id": "asc" }
  ],
  "search_after": ["2024-01-15", "abc123"]
}
```

### Aggregation Performance

```json
// Limit aggregation size
{
  "aggs": {
    "categories": {
      "terms": {
        "field": "category",
        "size": 20,          // Don't retrieve too many buckets
        "shard_size": 100    // Sample more on each shard
      }
    }
  }
}
```

### Explain Query Performance

```json
POST /eventcal-events-*/_search?explain=true
{
  "query": { ... }
}
```

### Profile Queries

```json
POST /eventcal-events-*/_search
{
  "profile": true,
  "query": { ... }
}
```

---

## Example Queries by Use Case

### Upcoming Events

```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "status": "active" } },
        { "range": { "startDate": { "gte": "now" } } }
      ]
    }
  },
  "sort": [{ "startDate": "asc" }],
  "size": 20
}
```

### Overdue Tasks

```json
{
  "query": {
    "bool": {
      "filter": [
        { "terms": { "status": ["pending", "in_progress"] } },
        { "range": { "dueDate": { "lt": "now" } } }
      ]
    }
  },
  "sort": [{ "dueDate": "asc" }]
}
```

### Search Contacts by Name

```json
{
  "query": {
    "bool": {
      "should": [
        { "match_phrase_prefix": { "nameEn": "ahmad" } },
        { "match_phrase_prefix": { "nameAr": "أحمد" } }
      ],
      "minimum_should_match": 1
    }
  },
  "_source": ["id", "nameEn", "nameAr", "email", "organization"]
}
```

### Events by Department with Stats

```json
{
  "size": 0,
  "aggs": {
    "by_department": {
      "terms": { "field": "departmentId" },
      "aggs": {
        "event_count": { "value_count": { "field": "id" } },
        "upcoming": {
          "filter": { "range": { "startDate": { "gte": "now" } } }
        },
        "past": {
          "filter": { "range": { "endDate": { "lt": "now" } } }
        }
      }
    }
  }
}
```

---

## Related Documentation

- [ELASTICSEARCH_API.md](./ELASTICSEARCH_API.md) - API endpoints
- [ELASTICSEARCH_ARCHITECTURE.md](./ELASTICSEARCH_ARCHITECTURE.md) - System architecture
