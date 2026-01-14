"""
Agent Router
============

API endpoints for agent control (start/stop/pause/resume).
Uses project registry for path lookups.
"""

import os
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..schemas import AgentActionResponse, AgentStartRequest, AgentStatus, RateLimitStatus
from ..services.process_manager import get_manager
from ..services.rate_limit_state import get_rate_limit_state


def _get_project_path(project_name: str) -> Path:
    """Get project path from registry."""
    import sys
    root = Path(__file__).parent.parent.parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from registry import get_project_path
    return get_project_path(project_name)


def _get_project_model(project_name: str) -> str:
    """Get the selected model for a project from registry."""
    import sys
    root = Path(__file__).parent.parent.parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from registry import get_project_model
    return get_project_model(project_name)


router = APIRouter(prefix="/api/projects/{project_name}/agent", tags=["agent"])

# Root directory for process manager
ROOT_DIR = Path(__file__).parent.parent.parent


def _get_api_key_from_env() -> str | None:
    """Get configured API key (ZAI_API_KEY or ANTHROPIC_API_KEY) from env or .env."""
    # First check environment variables
    api_key = os.environ.get("ZAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    if api_key and api_key != "your-api-key-here":
        return api_key

    # Check .env file in project root
    env_path = ROOT_DIR / ".env"
    if env_path.exists():
        content = env_path.read_text(encoding="utf-8", errors="ignore")
        # Look for ZAI_API_KEY first, then ANTHROPIC_API_KEY
        for key_name in ["ZAI_API_KEY", "ANTHROPIC_API_KEY"]:
            match = re.search(rf"^{key_name}=(.+)$", content, re.MULTILINE)
            if match:
                value = match.group(1).strip()
                if value and value != "your-api-key-here":
                    return value
    return None


def validate_project_name(name: str) -> str:
    """Validate and sanitize project name to prevent path traversal."""
    if not re.match(r'^[a-zA-Z0-9_-]{1,50}$', name):
        raise HTTPException(
            status_code=400,
            detail="Invalid project name"
        )
    return name


def get_project_manager(project_name: str):
    """Get the process manager for a project."""
    project_name = validate_project_name(project_name)
    project_dir = _get_project_path(project_name)

    if not project_dir:
        raise HTTPException(status_code=404, detail=f"Project '{project_name}' not found in registry")

    if not project_dir.exists():
        raise HTTPException(status_code=404, detail=f"Project directory not found: {project_dir}")

    return get_manager(project_name, project_dir, ROOT_DIR)


@router.get("/status", response_model=AgentStatus)
async def get_agent_status(project_name: str):
    """Get the current status of the agent for a project."""
    manager = get_project_manager(project_name)

    # Run healthcheck to detect crashed processes
    await manager.healthcheck()

    return AgentStatus(
        status=manager.status,
        pid=manager.pid,
        started_at=manager.started_at,
        yolo_mode=manager.yolo_mode,
    )


@router.post("/start", response_model=AgentActionResponse)
async def start_agent(
    project_name: str,
    request: AgentStartRequest = AgentStartRequest(),
):
    """Start the agent for a project."""
    manager = get_project_manager(project_name)

    # Require an API key before starting.
    # Prefer an explicit key from the request, otherwise use configured key from env/.env.
    api_key = request.api_key or _get_api_key_from_env()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="API key is required to start the agent. Configure ZAI_API_KEY or ANTHROPIC_API_KEY in Settings or .env.",
        )

    # Get the project's selected model from registry
    model = _get_project_model(project_name)

    success, message = await manager.start(yolo_mode=request.yolo_mode, api_key=api_key, model=model)

    return AgentActionResponse(
        success=success,
        status=manager.status,
        message=message,
    )


@router.post("/stop", response_model=AgentActionResponse)
async def stop_agent(project_name: str):
    """Stop the agent for a project."""
    manager = get_project_manager(project_name)

    success, message = await manager.stop()

    return AgentActionResponse(
        success=success,
        status=manager.status,
        message=message,
    )


@router.post("/pause", response_model=AgentActionResponse)
async def pause_agent(project_name: str):
    """Pause the agent for a project."""
    manager = get_project_manager(project_name)

    success, message = await manager.pause()

    return AgentActionResponse(
        success=success,
        status=manager.status,
        message=message,
    )


@router.post("/resume", response_model=AgentActionResponse)
async def resume_agent(project_name: str):
    """Resume a paused agent."""
    manager = get_project_manager(project_name)

    success, message = await manager.resume()

    return AgentActionResponse(
        success=success,
        status=manager.status,
        message=message,
    )


# Rate limit endpoints (API-wide, not project-specific)
# But exposed under project router for convenience
@router.get("/rate-limit", response_model=RateLimitStatus)
async def get_rate_limit_status(project_name: str):
    """
    Get the current rate limit status.
    
    Rate limiting is API-wide, so this returns the same status for all projects.
    """
    # Validate project name to prevent abuse
    validate_project_name(project_name)
    
    state = get_rate_limit_state()
    return RateLimitStatus(
        is_rate_limited=state.is_rate_limited,
        reset_time=state.reset_time_str,
        seconds_until_reset=state.get_seconds_until_reset(),
    )


@router.post("/rate-limit/cancel-resume", response_model=AgentActionResponse)
async def cancel_auto_resume(project_name: str):
    """
    Cancel the scheduled auto-resume after rate limit.
    
    Use this if you want to manually control when to resume rather than 
    waiting for the automatic timer.
    """
    # Validate project name to prevent abuse
    validate_project_name(project_name)
    
    state = get_rate_limit_state()
    cancelled = state.cancel_auto_resume()
    
    if cancelled:
        return AgentActionResponse(
            success=True,
            status="rate_limited",
            message="Auto-resume cancelled. Use 'Resume' to manually restart.",
        )
    else:
        return AgentActionResponse(
            success=False,
            status="stopped",
            message="No auto-resume was scheduled.",
        )


@router.post("/rate-limit/clear", response_model=AgentActionResponse)
async def clear_rate_limit(project_name: str):
    """
    Manually clear the rate limit status.
    
    Use this when you know the rate limit has been lifted but the timer 
    hasn't expired yet.
    """
    # Validate project name to prevent abuse
    validate_project_name(project_name)
    
    state = get_rate_limit_state()
    state.clear_rate_limit()
    
    return AgentActionResponse(
        success=True,
        status="stopped",
        message="Rate limit status cleared. You can now restart the agent.",
    )
