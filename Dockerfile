# =============================================================================
# ZLM Code Harness - Multi-stage Docker Build
# =============================================================================
# Stage 1: Build React frontend
# Stage 2: Python runtime with built assets
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build React UI
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/ui

# Copy package files first for better caching
COPY ui/package.json ui/package-lock.json* ./

# Install dependencies
RUN npm ci --silent

# Copy UI source
COPY ui/ ./

# Build production bundle
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Python Runtime
# -----------------------------------------------------------------------------
FROM python:3.12-slim

# Install system dependencies including Xvfb for headless browser support
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    wget \
    gnupg \
    xvfb \
    libgbm1 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome
RUN wget -q -O /tmp/google-chrome-key.pub https://dl-ssl.google.com/linux/linux_signing_key.pub \
    && gpg --dearmor -o /usr/share/keyrings/google-chrome-keyring.gpg /tmp/google-chrome-key.pub \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/* /tmp/google-chrome-key.pub

# Install Node.js (needed for Claude CLI)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Copy Python requirements and install
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY *.py ./
COPY api/ ./api/
COPY mcp_server/ ./mcp_server/
COPY server/ ./server/
COPY .claude/ ./.claude/
COPY docker-entrypoint.sh ./

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/ui/dist ./ui/dist

# Create directories and set permissions
# Note: We run as root for cross-platform compatibility (Windows/Linux/macOS)
# Docker provides container isolation, and Chrome uses --no-sandbox flag
RUN mkdir -p /projects /root/.autocoder && \
    chmod +x /app/docker-entrypoint.sh

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV DISPLAY=:99
ENV PLAYWRIGHT_BROWSERS_PATH=/root/ms-playwright
ENV DOCKER_ENV=1
# Increase websockets library max header line length for large browser cookies (e.g., Supabase auth tokens)
ENV WEBSOCKETS_MAX_LINE_LENGTH=65536
ENV HOME=/root

# Install Playwright MCP and browsers (pinned version to avoid version mismatch)
# Using 0.0.55 which is compatible with Playwright 1.57.0
RUN npm install -g @playwright/mcp@0.0.55 && \
    npx playwright install chromium

# Expose the web UI port
EXPOSE 8888

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8888/api/health || exit 1

# Default command: run via entrypoint script which checks permissions
ENTRYPOINT ["/app/docker-entrypoint.sh"]
