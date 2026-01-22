#!/bin/bash

# =============================================================================
# EventCal Kibana Dashboard Import Script
# =============================================================================
# This script imports all EventCal Kibana saved objects including:
# - Index patterns for events, tasks, contacts, and all indices
# - Dashboards for health monitoring, data quality, search analytics,
#   index management, and executive overview
#
# Usage: ./import-dashboards.sh [KIBANA_URL]
# Default KIBANA_URL: http://localhost:5601
# =============================================================================

set -e

# Configuration
KIBANA_URL="${1:-http://localhost:5601}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPACE_ID="eventcal"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if Kibana is reachable
check_kibana() {
    print_header "Checking Kibana Connection"
    
    if curl -s -o /dev/null -w "%{http_code}" "$KIBANA_URL/api/status" | grep -q "200"; then
        print_success "Kibana is reachable at $KIBANA_URL"
        return 0
    else
        print_error "Cannot connect to Kibana at $KIBANA_URL"
        print_info "Make sure Kibana is running and accessible"
        exit 1
    fi
}

# Create EventCal space if it doesn't exist
create_space() {
    print_header "Creating EventCal Space"
    
    SPACE_FILE="$SCRIPT_DIR/spaces/eventcal-space.json"
    
    if [ -f "$SPACE_FILE" ]; then
        # Check if space exists
        SPACE_EXISTS=$(curl -s -o /dev/null -w "%{http_code}" "$KIBANA_URL/api/spaces/space/$SPACE_ID")
        
        if [ "$SPACE_EXISTS" = "200" ]; then
            print_warning "Space '$SPACE_ID' already exists"
        else
            RESPONSE=$(curl -s -X POST "$KIBANA_URL/api/spaces/space" \
                -H "kbn-xsrf: true" \
                -H "Content-Type: application/json" \
                -d @"$SPACE_FILE")
            
            if echo "$RESPONSE" | grep -q "\"id\":\"$SPACE_ID\""; then
                print_success "Created space: $SPACE_ID"
            else
                print_warning "Could not create space (may require authentication)"
                print_info "Response: $RESPONSE"
            fi
        fi
    else
        print_warning "Space configuration file not found: $SPACE_FILE"
    fi
}

# Import saved objects from a directory
import_saved_objects() {
    local DIR="$1"
    local TYPE="$2"
    
    print_header "Importing $TYPE"
    
    if [ ! -d "$DIR" ]; then
        print_warning "Directory not found: $DIR"
        return
    fi
    
    local COUNT=0
    for FILE in "$DIR"/*.ndjson; do
        if [ -f "$FILE" ]; then
            FILENAME=$(basename "$FILE")
            
            RESPONSE=$(curl -s -X POST "$KIBANA_URL/api/saved_objects/_import?overwrite=true" \
                -H "kbn-xsrf: true" \
                -F "file=@$FILE")
            
            if echo "$RESPONSE" | grep -q "\"success\":true"; then
                print_success "Imported: $FILENAME"
                ((COUNT++))
            else
                print_error "Failed to import: $FILENAME"
                print_info "Response: $RESPONSE"
            fi
        fi
    done
    
    if [ $COUNT -eq 0 ]; then
        print_warning "No $TYPE files found to import"
    else
        print_info "Imported $COUNT $TYPE file(s)"
    fi
}

# Main execution
main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║       EventCal Kibana Dashboard Import Script              ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    print_info "Kibana URL: $KIBANA_URL"
    print_info "Script directory: $SCRIPT_DIR"
    
    # Check Kibana connection
    check_kibana
    
    # Create space (optional)
    create_space
    
    # Import index patterns first (dashboards depend on them)
    import_saved_objects "$SCRIPT_DIR/index-patterns" "Index Patterns"
    
    # Import dashboards
    import_saved_objects "$SCRIPT_DIR/dashboards" "Dashboards"
    
    print_header "Import Complete"
    print_success "All EventCal Kibana dashboards have been imported!"
    echo ""
    print_info "Access your dashboards at:"
    echo "  - Health Monitoring: $KIBANA_URL/app/dashboards#/view/eventcal-health-monitoring-dashboard"
    echo "  - Data Quality: $KIBANA_URL/app/dashboards#/view/eventcal-data-quality-dashboard"
    echo "  - Search Analytics: $KIBANA_URL/app/dashboards#/view/eventcal-search-analytics-dashboard"
    echo "  - Index Management: $KIBANA_URL/app/dashboards#/view/eventcal-index-management-dashboard"
    echo "  - Executive Overview: $KIBANA_URL/app/dashboards#/view/eventcal-executive-overview-dashboard"
    echo ""
}

# Run main function
main
