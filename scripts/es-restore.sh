#!/bin/bash
# =============================================================================
# Elasticsearch Restore Script for EventVue
# =============================================================================
# 
# Restores indices from a snapshot backup.
# Use this for disaster recovery or data migration.
#
# Usage:
#   ./es-restore.sh                     # List available snapshots
#   ./es-restore.sh <snapshot_name>     # Restore all eventcal-* indices
#   ./es-restore.sh <snapshot> <index>  # Restore specific index
#
# Environment Variables:
#   ELASTICSEARCH_URL     - ES URL (default: https://localhost:9200)
#   ELASTICSEARCH_USERNAME - ES user (default: elastic)
#   ELASTICSEARCH_PASSWORD - ES password (required)
#   ES_CA_CERT            - CA certificate path (for TLS)
#
# Exit Codes:
#   0 - Success
#   1 - Missing configuration or invalid arguments
#   2 - Restore failed
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ES_URL="${ELASTICSEARCH_URL:-https://localhost:9200}"
ES_USER="${ELASTICSEARCH_USERNAME:-elastic}"
ES_PASS="${ELASTICSEARCH_PASSWORD:-}"
ES_CA_CERT="${ES_CA_CERT:-/etc/elasticsearch/certs/ca.pem}"

SNAPSHOT_REPO="eventcal-backups"
SNAPSHOT_NAME="${1:-}"
INDEX_PATTERN="${2:-eventcal-*}"

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

log_info() {
  log "${BLUE}ℹ $1${NC}"
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

# List available snapshots
list_snapshots() {
  echo ""
  echo "Available snapshots in repository '$SNAPSHOT_REPO':"
  echo "=================================================="
  
  local snapshots
  snapshots=$(es_curl "$ES_URL/_snapshot/$SNAPSHOT_REPO/_all" 2>/dev/null)
  
  if [ -z "$snapshots" ] || echo "$snapshots" | jq -e '.error' > /dev/null 2>&1; then
    log_error "Could not fetch snapshots. Repository may not exist."
    exit 1
  fi
  
  echo "$snapshots" | jq -r '
    .snapshots[] | 
    [.snapshot, .state, .start_time, (.indices | length | tostring) + " indices", (.shards.successful | tostring) + "/" + (.shards.total | tostring) + " shards"] | 
    @tsv
  ' 2>/dev/null | column -t -s $'\t'
  
  echo ""
  echo "Usage: $0 <snapshot_name> [index_pattern]"
  echo ""
}

# Get snapshot details
get_snapshot_info() {
  local snapshot_name="$1"
  
  es_curl "$ES_URL/_snapshot/$SNAPSHOT_REPO/$snapshot_name" 2>/dev/null
}

# Check if indices exist
check_existing_indices() {
  local pattern="$1"
  
  local indices
  indices=$(es_curl "$ES_URL/_cat/indices/$pattern?format=json" 2>/dev/null | jq -r '.[].index' 2>/dev/null)
  
  echo "$indices"
}

# Close indices before restore
close_indices() {
  local pattern="$1"
  
  log "Closing existing indices matching '$pattern'..."
  
  local result
  result=$(es_curl -X POST "$ES_URL/$pattern/_close?ignore_unavailable=true" 2>/dev/null)
  
  if echo "$result" | jq -e '.acknowledged == true' > /dev/null 2>&1; then
    log_success "Indices closed"
  else
    log_warning "Could not close some indices (they may not exist)"
  fi
}

# Delete indices before restore (alternative to close)
delete_indices() {
  local pattern="$1"
  
  log "Deleting existing indices matching '$pattern'..."
  
  local result
  result=$(es_curl -X DELETE "$ES_URL/$pattern?ignore_unavailable=true" 2>/dev/null)
  
  if echo "$result" | jq -e '.acknowledged == true' > /dev/null 2>&1; then
    log_success "Indices deleted"
  else
    log_warning "Could not delete indices (they may not exist)"
  fi
}

# Restore from snapshot
restore_snapshot() {
  local snapshot_name="$1"
  local pattern="$2"
  
  log "Restoring indices '$pattern' from snapshot '$snapshot_name'..."
  
  local start_time
  start_time=$(date +%s)
  
  local result
  result=$(es_curl -X POST "$ES_URL/_snapshot/$SNAPSHOT_REPO/$snapshot_name/_restore?wait_for_completion=true" \
    -H "Content-Type: application/json" \
    -d '{
      "indices": "'"$pattern"'",
      "ignore_unavailable": true,
      "include_global_state": false,
      "rename_pattern": "(.+)",
      "rename_replacement": "$1",
      "include_aliases": true
    }' 2>/dev/null)
  
  local end_time
  end_time=$(date +%s)
  local duration=$((end_time - start_time))
  
  if echo "$result" | jq -e '.error' > /dev/null 2>&1; then
    log_error "Restore failed:"
    echo "$result" | jq '.error'
    exit 2
  fi
  
  local shards_successful
  local shards_failed
  shards_successful=$(echo "$result" | jq -r '.snapshot.shards.successful // 0' 2>/dev/null)
  shards_failed=$(echo "$result" | jq -r '.snapshot.shards.failed // 0' 2>/dev/null)
  
  if [ "$shards_failed" -eq 0 ]; then
    log_success "Restore completed successfully in ${duration}s"
  else
    log_warning "Restore completed with some failures in ${duration}s"
  fi
  
  log "  Shards: $shards_successful successful, $shards_failed failed"
}

# Verify restore
verify_restore() {
  local pattern="$1"
  
  log "Verifying restored indices..."
  
  local indices
  indices=$(es_curl "$ES_URL/_cat/indices/$pattern?format=json&h=index,health,status,docs.count,store.size" 2>/dev/null)
  
  echo ""
  echo "Restored indices:"
  echo "================"
  echo "$indices" | jq -r '.[] | [.index, .health, .status, ."docs.count", ."store.size"] | @tsv' | column -t -s $'\t'
  echo ""
}

# Main execution
main() {
  check_config
  
  log "=========================================="
  log "EventVue Elasticsearch Restore"
  log "=========================================="
  
  # If no snapshot specified, list available snapshots
  if [ -z "$SNAPSHOT_NAME" ]; then
    list_snapshots
    exit 0
  fi
  
  # Verify snapshot exists
  log "Checking snapshot: $SNAPSHOT_NAME"
  local snapshot_info
  snapshot_info=$(get_snapshot_info "$SNAPSHOT_NAME")
  
  if echo "$snapshot_info" | jq -e '.error' > /dev/null 2>&1; then
    log_error "Snapshot '$SNAPSHOT_NAME' not found"
    list_snapshots
    exit 1
  fi
  
  local snapshot_state
  snapshot_state=$(echo "$snapshot_info" | jq -r '.snapshots[0].state' 2>/dev/null)
  
  if [ "$snapshot_state" != "SUCCESS" ] && [ "$snapshot_state" != "PARTIAL" ]; then
    log_error "Snapshot is in '$snapshot_state' state. Cannot restore."
    exit 1
  fi
  
  log_success "Snapshot found: $SNAPSHOT_NAME ($snapshot_state)"
  
  # Show what will be restored
  local indices_in_snapshot
  indices_in_snapshot=$(echo "$snapshot_info" | jq -r '.snapshots[0].indices[]' 2>/dev/null | grep -E "$INDEX_PATTERN" || true)
  
  if [ -z "$indices_in_snapshot" ]; then
    log_error "No indices matching '$INDEX_PATTERN' found in snapshot"
    exit 1
  fi
  
  log_info "Indices to restore:"
  echo "$indices_in_snapshot" | while read -r idx; do
    echo "  - $idx"
  done
  
  # Check for existing indices
  local existing_indices
  existing_indices=$(check_existing_indices "$INDEX_PATTERN")
  
  if [ -n "$existing_indices" ]; then
    log_warning "The following indices already exist and will be REPLACED:"
    echo "$existing_indices" | while read -r idx; do
      echo "  - $idx"
    done
    echo ""
  fi
  
  # Confirmation
  echo ""
  echo -e "${YELLOW}WARNING: This will restore indices from snapshot '$SNAPSHOT_NAME'${NC}"
  echo -e "${YELLOW}Existing indices matching '$INDEX_PATTERN' will be replaced.${NC}"
  echo ""
  read -p "Are you sure you want to continue? (yes/no) " -r CONFIRM
  echo ""
  
  if [ "$CONFIRM" != "yes" ]; then
    log "Restore cancelled"
    exit 0
  fi
  
  # Delete existing indices (required for restore)
  if [ -n "$existing_indices" ]; then
    delete_indices "$INDEX_PATTERN"
  fi
  
  # Perform restore
  restore_snapshot "$SNAPSHOT_NAME" "$INDEX_PATTERN"
  
  # Verify
  verify_restore "$INDEX_PATTERN"
  
  log_success "Restore complete!"
  log_info "Remember to verify data integrity and update application configurations if needed."
}

main "$@"
