"""
FastAPI Main Application
========================

Main entry point for the Autonomous Coding UI server.
Provides REST API, WebSocket, and static file serving.
"""

import shutil
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .routers import (
    agent_router,
    assistant_chat_router,
    features_router,
    filesystem_router,
    projects_router,
    spec_creation_router,
)
from .schemas import SetupStatus, ApiKeyRequest, ApiKeyResponse
from .services.assistant_chat_session import cleanup_all_sessions as cleanup_assistant_sessions
from .services.process_manager import cleanup_all_managers
from .websocket import project_websocket

# Paths
ROOT_DIR = Path(__file__).parent.parent
UI_DIST_DIR = ROOT_DIR / "ui" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    # Startup
    yield
    # Shutdown - cleanup all running agents and assistant sessions
    await cleanup_all_managers()
    await cleanup_assistant_sessions()


# Create FastAPI app
app = FastAPI(
    title="Autonomous Coding UI",
    description="Web UI for the Autonomous Coding Agent",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow only localhost origins for security
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",      # Vite dev server
        "http://127.0.0.1:5173",
        "http://localhost:8888",      # Production
        "http://127.0.0.1:8888",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Security Middleware
# ============================================================================

@app.middleware("http")
async def require_localhost(request: Request, call_next):
    """Only allow requests from localhost."""
    client_host = request.client.host if request.client else None

    # Allow localhost connections
    if client_host not in ("127.0.0.1", "::1", "localhost", None):
        raise HTTPException(status_code=403, detail="Localhost access only")

    return await call_next(request)


# ============================================================================
# Include Routers
# ============================================================================

app.include_router(projects_router)
app.include_router(features_router)
app.include_router(agent_router)
app.include_router(spec_creation_router)
app.include_router(filesystem_router)
app.include_router(assistant_chat_router)


# ============================================================================
# WebSocket Endpoint
# ============================================================================

@app.websocket("/ws/projects/{project_name}")
async def websocket_endpoint(websocket: WebSocket, project_name: str):
    """WebSocket endpoint for real-time project updates."""
    await project_websocket(websocket, project_name)


# ============================================================================
# Setup & Health Endpoints
# ============================================================================

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


def _get_api_key_from_env() -> str | None:
    """Get API key from environment or .env file."""
    import os
    # First check environment variable
    api_key = os.environ.get("ZAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    if api_key and api_key != "your-api-key-here":
        return api_key

    # Check .env file
    env_path = ROOT_DIR / ".env"
    if env_path.exists():
        import re
        content = env_path.read_text()
        # Look for ZAI_API_KEY first, then ANTHROPIC_API_KEY
        for key_name in ["ZAI_API_KEY", "ANTHROPIC_API_KEY"]:
            match = re.search(rf'^{key_name}=(.+)$', content, re.MULTILINE)
            if match:
                value = match.group(1).strip()
                if value and value != "your-api-key-here":
                    return value
    return None


def _mask_api_key(key: str) -> str:
    """Mask API key for display, showing only first 4 and last 4 chars."""
    if len(key) <= 8:
        return "•" * len(key)
    return f"{key[:4]}{'•' * (len(key) - 8)}{key[-4:]}"


@app.get("/api/setup/status", response_model=SetupStatus)
async def setup_status():
    """Check system setup status."""
    # Check for Claude CLI
    claude_cli = shutil.which("claude") is not None

    # Check for credentials file
    credentials_path = Path.home() / ".claude" / ".credentials.json"
    credentials = credentials_path.exists()

    # Check for Node.js and npm
    node = shutil.which("node") is not None
    npm = shutil.which("npm") is not None

    # Check for API key
    api_key = _get_api_key_from_env()
    api_key_configured = api_key is not None

    return SetupStatus(
        claude_cli=claude_cli,
        credentials=credentials,
        node=node,
        npm=npm,
        api_key_configured=api_key_configured,
    )


@app.get("/api/setup/api-key", response_model=ApiKeyResponse)
async def get_api_key_status():
    """Get current API key status (masked)."""
    api_key = _get_api_key_from_env()
    if api_key:
        return ApiKeyResponse(
            success=True,
            message="API key is configured",
            masked_key=_mask_api_key(api_key),
        )
    return ApiKeyResponse(
        success=False,
        message="No API key configured",
        masked_key=None,
    )


@app.post("/api/setup/api-key", response_model=ApiKeyResponse)
async def save_api_key(request: ApiKeyRequest):
    """Save API key to .env file."""
    import os
    import re

    env_path = ROOT_DIR / ".env"
    example_path = ROOT_DIR / ".env.example"

    # Read existing .env or create from example
    if env_path.exists():
        content = env_path.read_text()
    elif example_path.exists():
        content = example_path.read_text()
    else:
        content = "# GLM / Z.AI API Configuration\n"

    # Update or add ZAI_API_KEY
    if re.search(r'^ZAI_API_KEY=', content, re.MULTILINE):
        content = re.sub(
            r'^ZAI_API_KEY=.*$',
            f'ZAI_API_KEY={request.api_key}',
            content,
            flags=re.MULTILINE
        )
    else:
        # Add at the beginning after any header comments
        lines = content.split('\n')
        insert_idx = 0
        for i, line in enumerate(lines):
            if line.startswith('#') or line.strip() == '':
                insert_idx = i + 1
            else:
                break
        lines.insert(insert_idx, f'ZAI_API_KEY={request.api_key}')
        content = '\n'.join(lines)

    # Write the .env file
    env_path.write_text(content)

    # Also set in current environment so it takes effect immediately
    os.environ["ZAI_API_KEY"] = request.api_key

    return ApiKeyResponse(
        success=True,
        message="API key saved successfully",
        masked_key=_mask_api_key(request.api_key),
    )


# ============================================================================
# Static File Serving (Production)
# ============================================================================

# Serve React build files if they exist
if UI_DIST_DIR.exists():
    # Mount static assets
    app.mount("/assets", StaticFiles(directory=UI_DIST_DIR / "assets"), name="assets")

    @app.get("/")
    async def serve_index():
        """Serve the React app index.html."""
        return FileResponse(UI_DIST_DIR / "index.html")

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        """
        Serve static files or fall back to index.html for SPA routing.
        """
        # Check if the path is an API route (shouldn't hit this due to router ordering)
        if path.startswith("api/") or path.startswith("ws/"):
            raise HTTPException(status_code=404)

        # Try to serve the file directly
        file_path = UI_DIST_DIR / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)

        # Fall back to index.html for SPA routing
        return FileResponse(UI_DIST_DIR / "index.html")


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server.main:app",
        host="127.0.0.1",  # Localhost only for security
        port=8888,
        reload=True,
    )
