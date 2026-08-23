#!/bin/bash
# =============================================================================
# ZLM Code Harness - Docker Launcher for macOS/Linux
# =============================================================================
# Prerequisites: Docker and Docker Compose installed
# =============================================================================

set -e
cd "$(dirname "$0")"

echo ""
echo "===================================="
echo "  ZLM Code Harness (Docker)"
echo "===================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker not found."
    echo ""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Install Docker Desktop for Mac:"
        echo "  https://docs.docker.com/desktop/install/mac-install/"
        echo ""
        echo "Or via Homebrew:"
        echo "  brew install --cask docker"
    else
        echo "Install Docker:"
        echo "  https://docs.docker.com/engine/install/"
    fi
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "ERROR: Docker is not running."
    echo "Please start Docker Desktop and try again."
    exit 1
fi

# Check for docker-compose (v1) or docker compose (v2)
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    echo "ERROR: Docker Compose not found."
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "Using: $COMPOSE_CMD"

# Prompt for API Key if not set
if [ -z "$ZAI_API_KEY" ] && [ ! -f ".env" ]; then
    echo ""
    echo "API Key Configuration"
    echo "---------------------"
    echo "Enter your Z.AI API key for GLM model support."
    echo "Get your key from: https://api.z.ai/"
    echo ""
    read -p "API Key (press Enter to skip): " API_KEY
    
    if [ -n "$API_KEY" ]; then
        export ZAI_API_KEY="$API_KEY"
        # Save to .env for future runs
        echo "ZAI_API_KEY=$API_KEY" > .env
        echo "API key saved to .env file."
    fi
fi

# Set default projects directory
if [ -z "$PROJECTS_DIR" ]; then
    export PROJECTS_DIR="$HOME/Projects"
    # Create if it doesn't exist
    mkdir -p "$PROJECTS_DIR"
    echo "Projects directory: $PROJECTS_DIR"
fi

# Build and start
echo ""
echo "Building and starting ZLM Code Harness..."
echo ""

$COMPOSE_CMD up --build -d

echo ""
echo "===================================="
echo "  ZLM Code Harness is running!"
echo "===================================="
echo ""
echo "  Web UI: http://localhost:8888"
echo ""
echo "  Projects directory: $PROJECTS_DIR"
echo ""
echo "Commands:"
echo "  View logs:    $COMPOSE_CMD logs -f"
echo "  Stop:         $COMPOSE_CMD down"
echo "  Restart:      $COMPOSE_CMD restart"
echo ""

# Open browser only if we have a display (not headless)
if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sleep 3
        open "http://localhost:8888"
    elif command -v xdg-open &> /dev/null; then
        sleep 3
        xdg-open "http://localhost:8888"
    fi
else
    echo "Running in headless mode - no browser opened."
    echo "Access the UI at http://<your-server-ip>:8888"
    echo ""
fi

# Show logs
echo "Showing logs (Ctrl+C to detach, container keeps running)..."
echo ""
$COMPOSE_CMD logs -f
