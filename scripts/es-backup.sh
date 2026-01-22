#!/bin/bash
# =============================================================================
# Elasticsearch Backup Script for EventVue
# =============================================================================
# 
# Creates snapshots of all eventcal-* indices and stores them in MinIO/S3.
# Designed to be run daily via cron.
#
# Usage:
#   ./es-backup.sh
#
# Environment Variables:
#   ELASTICSEARCH_URL     - ES URL (default: https://localhost:9200)
#   ELASTICSEARCH_USERNAME - ES user (default: elastic)
#   ELASTICSEARCH_PASSWORD - ES password (required)
#   ES_CA_CERT            - CA certificate path (for TLS)
#   S3_BUCKET             - Backup bucket name (default: eventcal-es-backups)
#   S3_ENDPOINT           - S3/MinIO endpoint (default: storage.eventcal.app)
#   RETENTION_DAYS        - Days to keep backups (default: 30)
#
# Exit Codes:
#   0 - Success
#   1 - Missing required configuration
#   2 - Snapshot creation failed
#   3 - Cleanup failed
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ES_URL="${ELASTICSEARCH_URL:-https://localhost:9200}"
ES_USER="${ELASTICSEARCH_USERNAME:-elastic}"
ES_PASS="${ELASTICSEARCH_PASSWORD:-}"
ES_CA_CERT="${ES_CA_CERT:-/etc/elasticsearch/certs/ca.pem}"
S3_BUCKET="${S3_BUCKET:-eventcal-es-backups}"
S3_ENDPOINT="${S3_ENDPOINT:-storage.eventcal.app}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

SNAPSHOT_REPO="eventcal-backups"
SNAPSHOT_NAME="eventcal-$(date +%Y%m%d-%H%M%S)"

# Logging
log() {
  echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_success() {
  log "${GREEN}✓ $1${NC}"
}

log_warning() {
  log "${YELLOW}⚠ $1${NC}"
}

log_error() {
  log "${RED}✗ $1${NC}"
}

# Check required configuration
check_config() {
  if [ -z "$ES_PASS" ]; then
    log_error "ELASTICSEARCH_PASSWORD is required"
    exit 1
  fi

  if [ ! -f "$ES_CA_CERT" ] && [[ "$ES_URL" == https://* ]]; then
    log_warning "CA certificate not found at $ES_CA_CERT. Using --insecure flag."
    CURL_CERT_OPTS="--insecure"
  else
    CURL_CERT_OPTS="--cacert $ES_CA_CERT"
  fi
}

# Build curl command with auth
es_curl() {
  curl -s -u "$ES_USER:$ES_PASS" $CURL_CERT_OPTS "$@"
}

# Check ES connectivity
check_es_health() {
  log "Checking Elasticsearch health..."
  
  local health
  health=$(es_curl "$ES_URL/_cluster/health" | jq -r '.status' 2>/dev/null)
  
  if [ -z "$health" ]; then
    log_error "Could not connect to Elasticsearch at $ES_URL"
    exit 1
  fi
  
  if [ "$health" = "red" ]; then
    log_error "Elasticsearch cluster is RED. Backup may be incomplete."
    # Continue anyway - we want partial backups
  else
    log_success "Elasticsearch cluster health: $health"
  fi
}

# Create snapshot repository if it doesn't exist
setup_repository() {
  log "Setting up snapshot repository: $SNAPSHOT_REPO"
  
  local repo_exists
  repo_exists=$(es_curl "$ES_URL/_snapshot/$SNAPSHOT_REPO" | jq -r '.error.type // empty' 2>/dev/null)
  
  if [ -n "$repo_exists" ]; then
    log "Creating snapshot repository..."
    
    es_curl -X PUT "$ES_URL/_snapshot/$SNAPSHOT_REPO" \
      -H "Content-Type: application/json" \
      -d '{
        "type": "s3",
        "settings": {
          "bucket": "'"$S3_BUCKET"'",
          "endpoint": "'"$S3_ENDPOINT"'",
          "protocol": "https",
          "path_style_access": true,
          "compress": true
        }
      }' > /dev/null
    
    log_success "Snapshot repository created"
  else
    log_success "Snapshot repository already exists"
  fi
}

# Create snapshot
create_snapshot() {
  log "Creating snapshot: $SNAPSHOT_NAME"
  
  local start_time
  start_time=$(date +%s)
  
  local result
  result=$(es_curl -X PUT "$ES_URL/_snapshot/$SNAPSHOT_REPO/$SNAPSHOT_NAME?wait_for_completion=true" \
    -H "Content-Type: application/json" \
    -d '{
      "indices": "eventcal-*",
      "ignore_unavailable": true,
      "include_global_state": false,
      "metadata": {
        "created_by": "es-backup.sh",
        "created_at": "'"$(date -Iseconds)"'",
        "environment": "'"${NODE_ENV:-production}"'"
      }
    }')
  
  local end_time
  end_time=$(date +%s)
  local duration=$((end_time - start_time))
  
  local state
  state=$(echo "$result" | jq -r '.snapshot.state' 2>/dev/null)
  
  if [ "$state" = "SUCCESS" ]; then
    local shards_successful
    local shards_failed
    shards_successful=$(echo "$result" | jq -r '.snapshot.shards.successful' 2>/dev/null)
    shards_failed=$(echo "$result" | jq -r '.snapshot.shards.failed' 2>/dev/null)
    
    log_success "Snapshot created successfully in ${duration}s"
    log "  Shards: $shards_successful successful, $shards_failed failed"
  elif [ "$state" = "PARTIAL" ]; then
    log_warning "Snapshot partially successful"
    log "  Some indices may not have been backed up"
  else
    log_error "Snapshot failed: $state"
    echo "$result" | jq '.'
    exit 2
  fi
}

# Cleanup old snapshots
cleanup_old_snapshots() {
  log "Cleaning up snapshots older than $RETENTION_DAYS days..."
  
  local cutoff_date
  cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y%m%d)
  
  local snapshots
  snapshots=$(es_curl "$ES_URL/_snapshot/$SNAPSHOT_REPO/_all" | \
    jq -r '.snapshots[] | select(.snapshot | startswith("eventcal-")) | .snapshot' 2>/dev/null | sort)
  
  local deleted_count=0
  
  for snapshot in $snapshots; do
    # Extract date from snapshot name (format: eventcal-YYYYMMDD-HHMMSS)
    local snapshot_date
    snapshot_date=$(echo "$snapshot" | sed -E 's/eventcal-([0-9]{8}).*/\1/' 2>/dev/null)
    
    if [ -n "$snapshot_date" ] && [ "$snapshot_date" -lt "$cutoff_date" ] 2>/dev/null; then
      log "Deleting old snapshot: $snapshot"
      es_curl -X DELETE "$ES_URL/_snapshot/$SNAPSHOT_REPO/$snapshot" > /dev/null
      ((deleted_count++))
    fi
  done
  
  if [ $deleted_count -gt 0 ]; then
    log_success "Deleted $deleted_count old snapshot(s)"
  else
    log "No old snapshots to clean up"
  fi
}

# List current snapshots
list_snapshots() {
  log "Current snapshots in repository:"
  
  es_curl "$ES_URL/_snapshot/$SNAPSHOT_REPO/_all" | \
    jq -r '.snapshots[] | "\(.snapshot) | \(.state) | \(.start_time) | \(.shards.successful)/\(.shards.total) shards"' 2>/dev/null | \
    column -t -s '|'
}

# Main execution
main() {
  log "=========================================="
  log "EventVue Elasticsearch Backup"
  log "=========================================="
  
  check_config
  check_es_health
  setup_repository
  create_snapshot
  cleanup_old_snapshots
  
  log ""
  list_snapshots
  
  log ""
  log_success "Backup complete: $SNAPSHOT_NAME"
}

main "$@"
