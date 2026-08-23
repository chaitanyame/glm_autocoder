"""
FastAPI Main Application
========================

Main entry point for the Autonomous Coding UI server.
Provides REST API, WebSocket, and static file serving.
"""

import os
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
from .schemas import SetupStatus, ApiKeyRequest, ApiKeyResponse, SettingsResponse, SettingsUpdate, ModelOption
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


import logging
logging.basicConfig(level=logging.INFO)
raw_logger = logging.getLogger("raw_asgi")
raw_logger.setLevel(logging.DEBUG)


# Create FastAPI app
app = FastAPI(
    title="Autonomous Coding UI",
    description="Web UI for the Autonomous Coding Agent",
    version="1.0.0",
    lifespan=lifespan,
)


# Add raw ASGI middleware to log all WebSocket connections
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp, Scope, Receive, Send


@app.middleware("http")
async def log_all_requests(request, call_next):
    """Log all HTTP requests including WebSocket upgrades."""
    raw_logger.info(f"HTTP Request: {request.method} {request.url.path} headers={dict(request.headers)}")
    return await call_next(request)

# CORS - configurable via environment variable for server deployments
# Set CORS_ORIGINS=http://your-server:8888 for remote access
_default_origins = [
    "http://localhost:5173",      # Vite dev server
    "http://127.0.0.1:5173",
    "http://localhost:8888",      # Production
    "http://127.0.0.1:8888",
]
_env_origins = os.environ.get("CORS_ORIGINS", "").split(",")
_cors_origins = [o.strip() for o in _env_origins if o.strip()] or _default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import logging
logger = logging.getLogger(__name__)

# ============================================================================
# Debug Middleware - log all incoming requests
# ============================================================================

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming HTTP requests for debugging."""
    upgrade = request.headers.get("upgrade", "").lower()
    if upgrade == "websocket":
        logger.info(f"WebSocket upgrade request: {request.url.path} from {request.client.host if request.client else 'unknown'}")
    return await call_next(request)


# ============================================================================
# Security Middleware
# ============================================================================

@app.middleware("http")
async def require_localhost(request: Request, call_next):
    """Only allow requests from localhost or Docker internal networks.
    
    Set ALLOW_REMOTE_ACCESS=true to allow all remote connections (for server deployments).
    """
    client_host = request.client.host if request.client else None

    # Check if remote access is explicitly allowed (for server deployments)
    allow_remote = os.environ.get("ALLOW_REMOTE_ACCESS", "").lower() in ("true", "1", "yes")
    
    # In Docker, allow requests from Docker bridge networks (172.x.x.x)
    # Also allow localhost connections and private networks
    allowed = (
        allow_remote or  # Explicit remote access flag
        client_host is None or
        client_host in ("127.0.0.1", "::1", "localhost") or
        client_host.startswith("172.") or  # Docker bridge network
        client_host.startswith("192.168.") or  # Docker host network
        client_host.startswith("10.") or  # Private network
        os.environ.get("DOCKER_ENV") == "1"  # Explicit Docker flag
    )

    if not allowed:
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

@app.websocket("/ws/test")
async def websocket_test(websocket: WebSocket):
    """Simple WebSocket test endpoint."""
    logger.info("Test WebSocket: accepting connection")
    await websocket.accept()
    logger.info("Test WebSocket: connection accepted")
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Test WebSocket: received {data}")
            await websocket.send_text(f"Echo: {data}")
    except Exception as e:
        logger.info(f"Test WebSocket: connection closed - {e}")


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
# Settings Endpoints
# ============================================================================

# Available models for selection
AVAILABLE_MODELS = [
    ModelOption(id="glm-4.7", name="GLM 4.7", description="Most capable model, best for complex tasks"),
    ModelOption(id="glm-4.5-air", name="GLM 4.5 Air", description="Fast and efficient for simpler tasks"),
]


def _get_selected_model() -> str:
    """Get the currently selected model from .env file."""
    env_path = ROOT_DIR / ".env"
    if env_path.exists():
        import re
        content = env_path.read_text()
        match = re.search(r'^SELECTED_MODEL=(.+)$', content, re.MULTILINE)
        if match:
            return match.group(1).strip()
    return "glm-4.7"  # Default model


def _save_setting_to_env(key: str, value: str) -> None:
    """Save a setting to the .env file."""
    import re
    
    env_path = ROOT_DIR / ".env"
    example_path = ROOT_DIR / ".env.example"
    
    if env_path.exists():
        content = env_path.read_text()
    elif example_path.exists():
        content = example_path.read_text()
    else:
        content = "# ZLM Code Harness Configuration\n"
    
    # Update or add the setting
    if re.search(rf'^{key}=', content, re.MULTILINE):
        content = re.sub(
            rf'^{key}=.*$',
            f'{key}={value}',
            content,
            flags=re.MULTILINE
        )
    else:
        content += f"\n{key}={value}\n"
    
    env_path.write_text(content)


@app.get("/api/settings", response_model=SettingsResponse)
async def get_settings():
    """Get current application settings."""
    api_key = _get_api_key_from_env()
    selected_model = _get_selected_model()
    
    return SettingsResponse(
        api_key_configured=api_key is not None,
        api_key_masked=_mask_api_key(api_key) if api_key else None,
        selected_model=selected_model,
        available_models=AVAILABLE_MODELS,
        base_url=os.environ.get("ANTHROPIC_BASE_URL", "https://api.z.ai/api/anthropic"),
    )


@app.put("/api/settings", response_model=SettingsResponse)
async def update_settings(settings: SettingsUpdate):
    """Update application settings."""
    # Update API key if provided
    if settings.api_key:
        _save_setting_to_env("ZAI_API_KEY", settings.api_key)
        os.environ["ZAI_API_KEY"] = settings.api_key
    
    # Update selected model if provided
    if settings.selected_model:
        _save_setting_to_env("SELECTED_MODEL", settings.selected_model)
        os.environ["SELECTED_MODEL"] = settings.selected_model
    
    # Return updated settings
    api_key = _get_api_key_from_env()
    selected_model = _get_selected_model()
    
    return SettingsResponse(
        api_key_configured=api_key is not None,
        api_key_masked=_mask_api_key(api_key) if api_key else None,
        selected_model=selected_model,
        available_models=AVAILABLE_MODELS,
        base_url=os.environ.get("ANTHROPIC_BASE_URL", "https://api.z.ai/api/anthropic"),
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
