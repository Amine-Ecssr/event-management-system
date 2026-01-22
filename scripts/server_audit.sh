#!/bin/bash
# Quick Admin Audit - Server-side version (run directly on the server)
# Usage: ./server_audit.sh [DATE]
# Example: ./server_audit.sh 2025-12-09

DATE=${1:-$(date +%Y-%m-%d)}
CONTAINER="ecssr-events-server"

echo "=== Admin Actions Audit for $DATE ==="
echo ""

# Calculate next day for --until parameter
NEXT_DAY=$(date -j -v+1d -f "%Y-%m-%d" "$DATE" +%Y-%m-%d 2>/dev/null || date -d "$DATE + 1 day" +%Y-%m-%d 2>/dev/null)

echo "Logins/Logouts:"
LOGINS=$(docker logs $CONTAINER --since "${DATE}T00:00:00" --until "${NEXT_DAY}T00:00:00" 2>&1 | grep -E 'POST /api/login|POST /api/logout' | grep '\[express\]')
if [ -z "$LOGINS" ]; then
    echo "  None"
else
    echo "$LOGINS"
fi
echo ""

echo "Data Modifications (CREATE/UPDATE/DELETE):"
ACTIONS=$(docker logs $CONTAINER --since "${DATE}T00:00:00" --until "${NEXT_DAY}T00:00:00" 2>&1 | grep -E '(POST|PUT|PATCH|DELETE) /api/(events|tasks|users|departments|archive|settings)' | grep '\[express\]' | grep -v '/api/login' | grep -v '/api/logout')
if [ -z "$ACTIONS" ]; then
    echo "  ✓ No admin actions detected (read-only activity)"
else
    echo "$ACTIONS"
fi
