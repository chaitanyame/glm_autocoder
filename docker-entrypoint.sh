#!/bin/bash
# Docker entrypoint script
# Ensures /projects directory is writable before starting the server

# Check if /projects is writable
if [ ! -w /projects ]; then
    echo "WARNING: /projects is not writable by autocoder user"
    echo "This may happen on Windows Docker Desktop with volume mounts"
    echo ""
    echo "Attempting to create a test file..."
    
    # Try to create test file (will fail if permissions are wrong)
    if ! touch /projects/.permission_test 2>/dev/null; then
        echo "ERROR: Cannot write to /projects directory"
        echo ""
        echo "SOLUTIONS:"
        echo "1. On Windows: Ensure Docker Desktop has access to the drive"
        echo "   Settings > Resources > File Sharing > Add your drive"
        echo ""
        echo "2. Run Docker with root user (less secure):"
        echo "   docker-compose.yml: add 'user: root' to service"
        echo ""
        echo "3. Use a named volume instead of bind mount"
        exit 1
    fi
    rm -f /projects/.permission_test
fi

echo "Projects directory is writable: /projects"

# Start the server
exec python -m uvicorn server.main:app \
    --host 0.0.0.0 \
    --port 8888 \
    --http h11 \
    --h11-max-incomplete-event-size 65536
