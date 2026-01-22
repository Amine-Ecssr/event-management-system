#!/bin/bash
# Check Elasticsearch health for monitoring systems
# Returns exit code: 0 (green/yellow), 1 (red), 2 (unavailable)

ES_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
ES_USER="${ELASTICSEARCH_USERNAME:-elastic}"
ES_PASS="${ELASTICSEARCH_PASSWORD:-eventcal-dev-password-2024}"

RESPONSE=$(curl -s -u "${ES_USER}:${ES_PASS}" "${ES_URL}/_cluster/health" 2>/dev/null)

if [ -z "$RESPONSE" ]; then
  echo "ES_HEALTH_STATUS=unavailable"
  exit 2
fi

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

case $STATUS in
  "green")
    echo "ES_HEALTH_STATUS=green"
    echo "Cluster is healthy"
    exit 0
    ;;
  "yellow")
    echo "ES_HEALTH_STATUS=yellow"
    echo "Cluster is operational but has unassigned replicas"
    exit 0
    ;;
  "red")
    echo "ES_HEALTH_STATUS=red"
    echo "Cluster has unassigned primary shards"
    exit 1
    ;;
  *)
    echo "ES_HEALTH_STATUS=unknown"
    echo "Could not determine cluster status"
    exit 2
    ;;
esac
