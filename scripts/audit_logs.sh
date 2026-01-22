#!/bin/bash
# EventVue Audit Log Analyzer
# This script helps you audit admin actions from Docker logs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SERVER="root@eventcal.app"
CONTAINER="ecssr-events-server"
DATE=$(date +%Y-%m-%d)

# Help function
show_help() {
    echo -e "${BLUE}EventVue Audit Log Analyzer${NC}"
    echo ""
    echo "Usage: ./audit_logs.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -d, --date DATE        Date to audit (default: today, format: YYYY-MM-DD)"
    echo "  -u, --user USERNAME    Filter by username"
    echo "  -a, --action ACTION    Filter by action (CREATE, UPDATE, DELETE)"
    echo "  -r, --resource TYPE    Filter by resource (events, tasks, users, departments)"
    echo "  -s, --server SERVER    SSH server (default: root@eventcal.app)"
    echo "  -c, --container NAME   Container name (default: ecssr-events-server)"
    echo "  -l, --local            Use local Docker (don't SSH)"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./audit_logs.sh                                    # Today's all actions"
    echo "  ./audit_logs.sh -d 2024-12-10                      # Specific date"
    echo "  ./audit_logs.sh -u admin -a CREATE                 # Admin's CREATE actions"
    echo "  ./audit_logs.sh -r events                          # All event-related actions"
    echo "  ./audit_logs.sh --local                            # Local Docker instance"
}

# Parse command line arguments
LOCAL=false
USERNAME=""
ACTION=""
RESOURCE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--date)
            DATE="$2"
            shift 2
            ;;
        -u|--user)
            USERNAME="$2"
            shift 2
            ;;
        -a|--action)
            ACTION="$2"
            shift 2
            ;;
        -r|--resource)
            RESOURCE="$2"
            shift 2
            ;;
        -s|--server)
            SERVER="$2"
            shift 2
            ;;
        -c|--container)
            CONTAINER="$2"
            shift 2
            ;;
        -l|--local)
            LOCAL=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

echo -e "${BLUE}=== EventVue Audit Report ===${NC}"
echo -e "Date: ${GREEN}$DATE${NC}"
echo -e "Server: ${GREEN}${LOCAL:+Local Docker}${LOCAL:-$SERVER}${NC}"
echo ""

# Calculate next day for --until parameter
NEXT_DAY=$(date -j -v+1d -f "%Y-%m-%d" "$DATE" +%Y-%m-%d 2>/dev/null || date -d "$DATE + 1 day" +%Y-%m-%d 2>/dev/null)

# Build Docker logs command
if [ "$LOCAL" = true ]; then
    DOCKER_CMD="docker logs $CONTAINER --since '${DATE}T00:00:00' --until '${NEXT_DAY}T00:00:00' 2>&1"
else
    DOCKER_CMD="ssh $SERVER \"docker logs $CONTAINER --since '${DATE}T00:00:00' --until '${NEXT_DAY}T00:00:00' 2>&1\""
fi

# Function to run query
run_query() {
    local filter="$1"
    local label="$2"
    
    if [ "$LOCAL" = true ]; then
        result=$(docker logs "$CONTAINER" --since "${DATE}T00:00:00" --until "${NEXT_DAY}T00:00:00" 2>&1 | eval "$filter")
    else
        result=$(ssh "$SERVER" "docker logs $CONTAINER --since '${DATE}T00:00:00' --until '${NEXT_DAY}T00:00:00' 2>&1" | eval "$filter")
    fi
    
    if [ -n "$result" ]; then
        echo -e "${YELLOW}$label:${NC}"
        echo "$result"
        echo ""
    else
        echo -e "${YELLOW}$label:${NC}"
        echo "  None"
        echo ""
    fi
}

# 1. Login/Logout Activity
echo -e "${GREEN}--- Authentication Activity ---${NC}"
run_query "grep -E 'POST /api/login|POST /api/logout' | grep -E '\[express\]'" "Login/Logout events"

# 2. Admin Actions (Create/Update/Delete)
echo -e "${GREEN}--- Admin Actions (Create/Update/Delete) ---${NC}"

# Filter based on parameters
FILTER="grep -E '(POST|PUT|PATCH|DELETE)' | grep -v 'GET' | grep -v '/api/health' | grep -v '/api/login' | grep -v '/api/logout'"

if [ -n "$USERNAME" ]; then
    FILTER="$FILTER | grep -i '$USERNAME'"
fi

if [ -n "$ACTION" ]; then
    case $ACTION in
        CREATE)
            FILTER="$FILTER | grep 'POST'"
            ;;
        UPDATE)
            FILTER="$FILTER | grep -E '(PUT|PATCH)'"
            ;;
        DELETE)
            FILTER="$FILTER | grep 'DELETE'"
            ;;
    esac
fi

if [ -n "$RESOURCE" ]; then
    FILTER="$FILTER | grep -i '/api/$RESOURCE'"
fi

run_query "$FILTER" "Modification actions"

# 3. Event Actions
echo -e "${GREEN}--- Event Management ---${NC}"
run_query "grep -E 'POST /api/events|PUT /api/events|DELETE /api/events|PATCH /api/events' | grep '\[express\]'" "Event CRUD operations"

# 4. Task Actions
echo -e "${GREEN}--- Task Management ---${NC}"
run_query "grep -E 'POST /api/tasks|PUT /api/tasks|DELETE /api/tasks|PATCH /api/tasks' | grep '\[express\]'" "Task CRUD operations"

# 5. User/Department Management
echo -e "${GREEN}--- User & Department Management ---${NC}"
run_query "grep -E 'POST /api/(users|departments|admin)|PUT /api/(users|departments|admin)|DELETE /api/(users|departments|admin)' | grep '\[express\]'" "User/Department changes"

# 6. File Uploads/Downloads
echo -e "${GREEN}--- File Operations ---${NC}"
run_query "grep -E 'POST.*upload|GET.*download|POST.*media' | grep '\[express\]'" "File uploads/downloads"

# 7. Settings Changes
echo -e "${GREEN}--- Settings Changes ---${NC}"
run_query "grep -E 'PUT /api/settings|PATCH /api/settings' | grep '\[express\]'" "Settings modifications"

# 8. Archive Actions
echo -e "${GREEN}--- Archive Operations ---${NC}"
run_query "grep -E 'POST /api/archive|DELETE /api/archive|PUT /api/archive' | grep '\[express\]'" "Archive actions"

# 9. Summary
echo -e "${BLUE}=== Summary ===${NC}"
if [ "$LOCAL" = true ]; then
    total=$(docker logs "$CONTAINER" --since "${DATE}T00:00:00" --until "${NEXT_DAY}T00:00:00" 2>&1 | grep -c '\[express\]' || echo "0")
    logins=$(docker logs "$CONTAINER" --since "${DATE}T00:00:00" --until "${NEXT_DAY}T00:00:00" 2>&1 | grep -c 'POST /api/login' || echo "0")
    logouts=$(docker logs "$CONTAINER" --since "${DATE}T00:00:00" --until "${NEXT_DAY}T00:00:00" 2>&1 | grep -c 'POST /api/logout' || echo "0")
    creates=$(docker logs "$CONTAINER" --since "${DATE}T00:00:00" --until "${NEXT_DAY}T00:00:00" 2>&1 | grep -E 'POST /api/(events|tasks|users|departments)' | grep -c '\[express\]' || echo "0")
    updates=$(docker logs "$CONTAINER" --since "${DATE}T00:00:00" --until "${NEXT_DAY}T00:00:00" 2>&1 | grep -E '(PUT|PATCH) /api/(events|tasks|users|departments)' | grep -c '\[express\]' || echo "0")
    deletes=$(docker logs "$CONTAINER" --since "${DATE}T00:00:00" --until "${NEXT_DAY}T00:00:00" 2>&1 | grep -E 'DELETE /api/(events|tasks|users|departments)' | grep -c '\[express\]' || echo "0")
else
    total=$(ssh "$SERVER" "docker logs $CONTAINER --since '${DATE}T00:00:00' --until '${NEXT_DAY}T00:00:00' 2>&1 | grep -c '\[express\]'" || echo "0")
    logins=$(ssh "$SERVER" "docker logs $CONTAINER --since '${DATE}T00:00:00' --until '${NEXT_DAY}T00:00:00' 2>&1 | grep -c 'POST /api/login'" || echo "0")
    logouts=$(ssh "$SERVER" "docker logs $CONTAINER --since '${DATE}T00:00:00' --until '${NEXT_DAY}T00:00:00' 2>&1 | grep -c 'POST /api/logout'" || echo "0")
    creates=$(ssh "$SERVER" "docker logs $CONTAINER --since '${DATE}T00:00:00' --until '${NEXT_DAY}T00:00:00' 2>&1 | grep -E 'POST /api/(events|tasks|users|departments)' | grep -c '\[express\]'" || echo "0")
    updates=$(ssh "$SERVER" "docker logs $CONTAINER --since '${DATE}T00:00:00' --until '${NEXT_DAY}T00:00:00' 2>&1 | grep -E '(PUT|PATCH) /api/(events|tasks|users|departments)' | grep -c '\[express\]'" || echo "0")
    deletes=$(ssh "$SERVER" "docker logs $CONTAINER --since '${DATE}T00:00:00' --until '${NEXT_DAY}T00:00:00' 2>&1 | grep -E 'DELETE /api/(events|tasks|users|departments)' | grep -c '\[express\]'" || echo "0")
fi

echo -e "Total API requests: ${GREEN}$total${NC}"
echo -e "Logins: ${GREEN}$logins${NC}"
echo -e "Logouts: ${GREEN}$logouts${NC}"
echo -e "Creates: ${GREEN}$creates${NC}"
echo -e "Updates: ${GREEN}$updates${NC}"
echo -e "Deletes: ${GREEN}$deletes${NC}"

if [ "$creates" -eq 0 ] && [ "$updates" -eq 0 ] && [ "$deletes" -eq 0 ]; then
    echo -e "\n${YELLOW}No admin actions (CREATE/UPDATE/DELETE) detected on $DATE${NC}"
fi
