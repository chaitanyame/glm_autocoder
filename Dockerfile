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

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/ui/dist ./ui/dist

# Create non-root user for security (Chrome requires non-root or --no-sandbox)
RUN useradd -m -u 1000 -s /bin/bash autocoder && \
    mkdir -p /projects /home/autocoder/.autocoder && \
    chown -R autocoder:autocoder /app /projects /home/autocoder

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV DISPLAY=:99
ENV PLAYWRIGHT_BROWSERS_PATH=/home/autocoder/ms-playwright
ENV DOCKER_ENV=1
# Increase websockets library max header line length for large browser cookies (e.g., Supabase auth tokens)
ENV WEBSOCKETS_MAX_LINE_LENGTH=65536
ENV HOME=/home/autocoder

# Switch to non-root user
USER autocoder

# Install Playwright browsers as non-root user
RUN npx playwright install chromium

# Expose the web UI port
EXPOSE 8888

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8888/api/health || exit 1

# Default command: run the FastAPI server
# Use h11 with larger header size limit to handle browser cookies (e.g., Supabase auth tokens)
CMD ["python", "-m", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8888", "--http", "h11", "--h11-max-incomplete-event-size", "65536"]
