"""
Projects Router
===============

API endpoints for project management.
Uses project registry for path lookups instead of fixed generations/ directory.
"""

import os
import re
import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException

from api.database import get_lock_file_path
from ..schemas import (
    ProjectCreate,
    ProjectDetail,
    ProjectImport,
    ProjectPrompts,
    ProjectPromptsUpdate,
    ProjectStats,
    ProjectSummary,
)

# Docker environment detection
IS_DOCKER = os.environ.get("DOCKER_ENV") == "1"
DOCKER_PROJECTS_DIR = "/projects"
HOST_PROJECTS_DIR = os.environ.get("HOST_PROJECTS_DIR", "")

# Lazy imports to avoid circular dependencies
_imports_initialized = False
_check_spec_exists = None
_scaffold_project_prompts = None
_get_project_prompts_dir = None
_count_passing_tests = None


def _init_imports():
    """Lazy import of project-level modules."""
    global _imports_initialized, _check_spec_exists
    global _scaffold_project_prompts, _get_project_prompts_dir
    global _count_passing_tests

    if _imports_initialized:
        return

    import sys
    root = Path(__file__).parent.parent.parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from progress import count_passing_tests
    from prompts import get_project_prompts_dir, scaffold_project_prompts
    from start import check_spec_exists

    _check_spec_exists = check_spec_exists
    _scaffold_project_prompts = scaffold_project_prompts
    _get_project_prompts_dir = get_project_prompts_dir
    _count_passing_tests = count_passing_tests
    _imports_initialized = True


def _get_registry_functions():
    """Get registry functions with lazy import."""
    import sys
    root = Path(__file__).parent.parent.parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from registry import (
        get_project_path,
        import_or_register_project,
        list_registered_projects,
        register_project,
        unregister_project,
        validate_project_path,
    )
    return register_project, unregister_project, get_project_path, list_registered_projects, validate_project_path, import_or_register_project


router = APIRouter(prefix="/api/projects", tags=["projects"])


def validate_project_name(name: str) -> str:
    """Validate and sanitize project name to prevent path traversal."""
    if not re.match(r'^[a-zA-Z0-9_-]{1,50}$', name):
        raise HTTPException(
            status_code=400,
            detail="Invalid project name. Use only letters, numbers, hyphens, and underscores (1-50 chars)."
        )
    return name


def get_project_stats(project_dir: Path) -> ProjectStats:
    """Get statistics for a project."""
    _init_imports()
    passing, in_progress, total = _count_passing_tests(project_dir)
    percentage = (passing / total * 100) if total > 0 else 0.0
    return ProjectStats(
        passing=passing,
        in_progress=in_progress,
        total=total,
        percentage=round(percentage, 1)
    )


def get_host_path(container_path: str) -> str | None:
    """
    Convert a container path to host path for VS Code access.
    
    In Docker, projects are at /projects/<name> inside container.
    This maps to HOST_PROJECTS_DIR/<name> on the host.
    """
    if not IS_DOCKER or not HOST_PROJECTS_DIR:
        return None
    
    # If path starts with /projects, replace with host path
    if container_path.startswith(DOCKER_PROJECTS_DIR):
        relative = container_path[len(DOCKER_PROJECTS_DIR):]
        # Normalize the host path
        host_base = HOST_PROJECTS_DIR.rstrip("/\\")
        
        # If host path is relative (starts with . or no drive letter), 
        # note this in the output for users to understand
        if host_base.startswith("."):
            # This is a relative path like ./_projects
            # Return it as-is; user understands it's relative to docker-compose location
            host_path = host_base + relative
        else:
            host_path = host_base + relative
        
        # Convert forward slashes to backslashes on Windows host (detect by drive letter or backslash)
        if "\\" in HOST_PROJECTS_DIR or (len(HOST_PROJECTS_DIR) > 1 and HOST_PROJECTS_DIR[1] == ":"):
            host_path = host_path.replace("/", "\\")
        
        return host_path
    
    return None


@router.get("", response_model=list[ProjectSummary])
async def list_projects():
    """List all registered projects."""
    _init_imports()
    _, _, _, list_registered_projects, validate_project_path, _ = _get_registry_functions()

    projects = list_registered_projects()
    result = []

    for name, info in projects.items():
        project_dir = Path(info["path"])

        # Skip if path no longer exists
        is_valid, _ = validate_project_path(project_dir)
        if not is_valid:
            continue

        has_spec = _check_spec_exists(project_dir)
        stats = get_project_stats(project_dir)
        spec_status = _get_spec_status(project_dir)

        result.append(ProjectSummary(
            name=name,
            path=info["path"],
            host_path=get_host_path(info["path"]),
            has_spec=has_spec,
            stats=stats,
            spec_status=spec_status,
        ))

    return result


@router.post("", response_model=ProjectSummary)
async def create_project(project: ProjectCreate):
    """Create a new project at the specified path."""
    _init_imports()
    register_project, _, get_project_path, _, _, _ = _get_registry_functions()

    name = validate_project_name(project.name)
    project_path = Path(project.path).resolve()

    # Check if project name already registered
    existing = get_project_path(name)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Project '{name}' already exists at {existing}"
        )

    # Security: Check if path is in a blocked location
    from .filesystem import is_path_blocked
    if is_path_blocked(project_path):
        raise HTTPException(
            status_code=403,
            detail="Cannot create project in system or sensitive directory"
        )

    # Validate the path is usable
    if project_path.exists():
        if not project_path.is_dir():
            raise HTTPException(
                status_code=400,
                detail="Path exists but is not a directory"
            )
    else:
        # Create the directory
        try:
            project_path.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create directory: {e}"
            )

    # Scaffold prompts
    _scaffold_project_prompts(project_path)

    # Register in registry
    try:
        register_project(name, project_path)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to register project: {e}"
        )

    path_str = project_path.as_posix()
    return ProjectSummary(
        name=name,
        path=path_str,
        host_path=get_host_path(path_str),
        has_spec=False,  # Just created, no spec yet
        stats=ProjectStats(passing=0, total=0, percentage=0.0),
    )


@router.post("/import", response_model=ProjectSummary)
async def import_project(project: ProjectImport):
    """
    Import an existing project folder.
    
    Registers the folder in the project registry without creating new directories.
    If prompts are missing, they will be scaffolded. If spec exists, it will be validated.
    """
    from fastapi import BackgroundTasks
    _init_imports()
    _, _, get_project_path, _, _, import_or_register_project = _get_registry_functions()

    project_path = Path(project.path).resolve()

    # Validate the path exists and is a directory
    if not project_path.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Path does not exist: {project_path}"
        )

    if not project_path.is_dir():
        raise HTTPException(
            status_code=400,
            detail="Path is not a directory"
        )

    # Security: Check if path is in a blocked location
    from .filesystem import is_path_blocked
    if is_path_blocked(project_path):
        raise HTTPException(
            status_code=403,
            detail="Cannot import project from system or sensitive directory"
        )

    # Derive name from folder basename or use provided override
    name = project.name
    if not name:
        name = project_path.name
        # Sanitize the name to match the allowed pattern
        name = re.sub(r'[^a-zA-Z0-9_-]', '-', name)[:50]

    # Validate the derived/provided name
    if not re.match(r'^[a-zA-Z0-9_-]{1,50}$', name):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid project name '{name}'. Use only letters, numbers, hyphens, and underscores (1-50 chars)."
        )

    # Try to import/register the project
    success, message = import_or_register_project(name, project_path)
    if not success:
        raise HTTPException(status_code=409, detail=message)

    # Scaffold missing prompts (non-destructive - only copies missing files)
    _scaffold_project_prompts(project_path)

    # Check if spec exists and determine its status
    has_spec = _check_spec_exists(project_path)
    spec_status = _get_spec_status(project_path)

    # Get project stats
    stats = get_project_stats(project_path)

    path_str = project_path.as_posix()
    return ProjectSummary(
        name=name,
        path=path_str,
        host_path=get_host_path(path_str),
        has_spec=has_spec,
        stats=stats,
        imported=True,
        spec_status=spec_status,
    )


def _get_spec_status(project_dir: Path) -> str:
    """
    Determine the spec validity status for a project.
    
    Returns:
        "valid" - spec exists and has required XML structure
        "needs_review" - spec exists but may be incomplete or auto-generated
        "missing" - no spec file found
    """
    prompts_dir = project_dir / "prompts"
    spec_file = prompts_dir / "app_spec.txt"
    
    if not spec_file.exists():
        # Also check legacy location
        legacy_spec = project_dir / "app_spec.txt"
        if not legacy_spec.exists():
            return "missing"
        spec_file = legacy_spec
    
    try:
        content = spec_file.read_text(encoding="utf-8")
        # Check for required XML structure
        if "<project_specification>" in content and "</project_specification>" in content:
            # Check for core sections that indicate a complete spec
            has_overview = "<overview>" in content or "<project_overview>" in content
            has_features = "<core_features>" in content or "<features>" in content
            if has_overview and has_features:
                return "valid"
            return "needs_review"
        return "needs_review"
    except Exception:
        return "needs_review"


@router.get("/{name}", response_model=ProjectDetail)
async def get_project(name: str):
    """Get detailed information about a project."""
    _init_imports()
    _, _, get_project_path, _, _, _ = _get_registry_functions()

    name = validate_project_name(name)
    project_dir = get_project_path(name)

    if not project_dir:
        raise HTTPException(status_code=404, detail=f"Project '{name}' not found in registry")

    if not project_dir.exists():
        raise HTTPException(status_code=404, detail=f"Project directory no longer exists: {project_dir}")

    has_spec = _check_spec_exists(project_dir)
    stats = get_project_stats(project_dir)
    prompts_dir = _get_project_prompts_dir(project_dir)
    spec_status = _get_spec_status(project_dir)

    path_str = project_dir.as_posix()
    return ProjectDetail(
        name=name,
        path=path_str,
        host_path=get_host_path(path_str),
        has_spec=has_spec,
        stats=stats,
        prompts_dir=str(prompts_dir),
        spec_status=spec_status,
    )


@router.delete("/{name}")
async def delete_project(name: str, delete_files: bool = False):
    """
    Delete a project from the registry.

    Args:
        name: Project name to delete
        delete_files: If True, also delete the project directory and files
    """
    _init_imports()
    _, unregister_project, get_project_path, _, _, _ = _get_registry_functions()

    name = validate_project_name(name)
    project_dir = get_project_path(name)

    if not project_dir:
        raise HTTPException(status_code=404, detail=f"Project '{name}' not found")

    # Check if agent is running (lock file now in .autocoder/)
    lock_file = get_lock_file_path(project_dir)
    if lock_file.exists():
        raise HTTPException(
            status_code=409,
            detail="Cannot delete project while agent is running. Stop the agent first."
        )

    # Optionally delete files
    if delete_files and project_dir.exists():
        try:
            shutil.rmtree(project_dir)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete project files: {e}")

    # Unregister from registry
    unregister_project(name)

    return {
        "success": True,
        "message": f"Project '{name}' deleted" + (" (files removed)" if delete_files else " (files preserved)")
    }


@router.get("/{name}/prompts", response_model=ProjectPrompts)
async def get_project_prompts(name: str):
    """Get the content of project prompt files."""
    _init_imports()
    _, _, get_project_path, _, _, _ = _get_registry_functions()

    name = validate_project_name(name)
    project_dir = get_project_path(name)

    if not project_dir:
        raise HTTPException(status_code=404, detail=f"Project '{name}' not found")

    if not project_dir.exists():
        raise HTTPException(status_code=404, detail="Project directory not found")

    prompts_dir = _get_project_prompts_dir(project_dir)

    def read_file(filename: str) -> str:
        filepath = prompts_dir / filename
        if filepath.exists():
            try:
                return filepath.read_text(encoding="utf-8")
            except Exception:
                return ""
        return ""

    return ProjectPrompts(
        app_spec=read_file("app_spec.txt"),
        initializer_prompt=read_file("initializer_prompt.md"),
        coding_prompt=read_file("coding_prompt.md"),
    )


@router.put("/{name}/prompts")
async def update_project_prompts(name: str, prompts: ProjectPromptsUpdate):
    """Update project prompt files."""
    _init_imports()
    _, _, get_project_path, _, _, _ = _get_registry_functions()

    name = validate_project_name(name)
    project_dir = get_project_path(name)

    if not project_dir:
        raise HTTPException(status_code=404, detail=f"Project '{name}' not found")

    if not project_dir.exists():
        raise HTTPException(status_code=404, detail="Project directory not found")

    prompts_dir = _get_project_prompts_dir(project_dir)
    prompts_dir.mkdir(parents=True, exist_ok=True)

    def write_file(filename: str, content: str | None):
        if content is not None:
            filepath = prompts_dir / filename
            filepath.write_text(content, encoding="utf-8")

    write_file("app_spec.txt", prompts.app_spec)
    write_file("initializer_prompt.md", prompts.initializer_prompt)
    write_file("coding_prompt.md", prompts.coding_prompt)

    return {"success": True, "message": "Prompts updated"}


@router.get("/{name}/stats", response_model=ProjectStats)
async def get_project_stats_endpoint(name: str):
    """Get current progress statistics for a project."""
    _init_imports()
    _, _, get_project_path, _, _, _ = _get_registry_functions()

    name = validate_project_name(name)
    project_dir = get_project_path(name)

    if not project_dir:
        raise HTTPException(status_code=404, detail=f"Project '{name}' not found")

    if not project_dir.exists():
        raise HTTPException(status_code=404, detail="Project directory not found")

    return get_project_stats(project_dir)


# =============================================================================
# Project Settings Endpoints
# =============================================================================

# Available models for project-level selection
from ..schemas import ModelOption, ProjectSettingsResponse, ProjectSettingsUpdate

AVAILABLE_MODELS = [
    ModelOption(id="glm-4.7", name="GLM 4.7", description="Most capable model, best for complex tasks"),
    ModelOption(id="glm-4.5-air", name="GLM 4.5 Air", description="Fast and efficient for simpler tasks"),
]


def _get_model_functions():
    """Get model functions from registry with lazy import."""
    import sys
    root = Path(__file__).parent.parent.parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from registry import get_project_model, set_project_model
    return get_project_model, set_project_model


@router.get("/{name}/settings", response_model=ProjectSettingsResponse)
async def get_project_settings(name: str):
    """Get project-level settings (model configuration)."""
    _, _, get_project_path, _, _, _ = _get_registry_functions()
    get_project_model, _ = _get_model_functions()

    name = validate_project_name(name)
    project_dir = get_project_path(name)

    if not project_dir:
        raise HTTPException(status_code=404, detail=f"Project '{name}' not found")

    selected_model = get_project_model(name)

    return ProjectSettingsResponse(
        selected_model=selected_model,
        available_models=AVAILABLE_MODELS,
    )


@router.put("/{name}/settings", response_model=ProjectSettingsResponse)
async def update_project_settings(name: str, settings: ProjectSettingsUpdate):
    """Update project-level settings (model configuration)."""
    _, _, get_project_path, _, _, _ = _get_registry_functions()
    get_project_model, set_project_model = _get_model_functions()

    name = validate_project_name(name)
    project_dir = get_project_path(name)

    if not project_dir:
        raise HTTPException(status_code=404, detail=f"Project '{name}' not found")

    if settings.selected_model:
        # Validate model is in available list
        valid_models = [m.id for m in AVAILABLE_MODELS]
        if settings.selected_model not in valid_models:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid model. Must be one of: {', '.join(valid_models)}"
            )
        set_project_model(name, settings.selected_model)

    selected_model = get_project_model(name)

    return ProjectSettingsResponse(
        selected_model=selected_model,
        available_models=AVAILABLE_MODELS,
    )
