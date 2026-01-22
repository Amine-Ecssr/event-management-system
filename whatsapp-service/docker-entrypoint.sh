#!/bin/sh
set -e

# Ensure auth_info directory exists and has correct permissions
mkdir -p /app/auth_info

# If running as node user and auth_info is not writable, we can't fix it
# The volume should be mounted with proper permissions from the host
# But we can at least verify it exists
if [ ! -w /app/auth_info ]; then
    echo "Warning: /app/auth_info is not writable by current user"
    echo "Please ensure the host directory has correct permissions"
    echo "Run: chmod -R 777 ./whatsapp-service/auth_info"
fi

# Execute the main command
exec "$@"
