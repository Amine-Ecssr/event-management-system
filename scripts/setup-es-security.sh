#!/bin/bash
# Setup Elasticsearch security after first startup
# This script creates the necessary users and sets up the kibana_system password

set -e

ES_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
ES_PASSWORD="${ELASTICSEARCH_PASSWORD:-eventcal-dev-password-2024}"
KIBANA_PASSWORD="${KIBANA_PASSWORD:-kibana-dev-password-2024}"

echo "========================================"
echo "Elasticsearch Security Setup for EventVue"
echo "========================================"

# Wait for ES to be ready
echo "Waiting for Elasticsearch to be ready..."
until curl -s -u "elastic:${ES_PASSWORD}" "${ES_URL}/_cluster/health" | grep -q '"status":"green"\|"status":"yellow"'; do
  echo "  ... waiting for Elasticsearch"
  sleep 5
done
echo "✅ Elasticsearch is ready!"

# Check ES health
echo ""
echo "Cluster health:"
curl -s -u "elastic:${ES_PASSWORD}" "${ES_URL}/_cluster/health" | python3 -m json.tool 2>/dev/null || curl -s -u "elastic:${ES_PASSWORD}" "${ES_URL}/_cluster/health"

# Check installed plugins
echo ""
echo "Installed plugins:"
curl -s -u "elastic:${ES_PASSWORD}" "${ES_URL}/_cat/plugins?v"

# Setup Kibana system user password
echo ""
echo "Setting up Kibana system user password..."
curl -X POST "${ES_URL}/_security/user/kibana_system/_password" \
  -u "elastic:${ES_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "'"${KIBANA_PASSWORD}"'"
  }' && echo ""

echo ""
echo "✅ Kibana system user password set!"

# Test ICU tokenizer
echo ""
echo "Testing ICU tokenizer for Arabic support..."
curl -X POST "${ES_URL}/_analyze" \
  -u "elastic:${ES_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenizer": "icu_tokenizer",
    "text": "مؤتمر الشرق الأوسط للطاقة"
  }' | python3 -m json.tool 2>/dev/null || echo "(Install python3 for formatted output)"

echo ""
echo "========================================"
echo "✅ Elasticsearch security setup complete!"
echo "========================================"
echo ""
echo "Services available:"
echo "  - Elasticsearch: ${ES_URL}"
echo "  - Kibana: http://localhost:5601"
echo ""
echo "Credentials:"
echo "  - Elastic user: elastic / ${ES_PASSWORD}"
echo "  - Kibana system: kibana_system / ${KIBANA_PASSWORD}"
