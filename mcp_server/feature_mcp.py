#!/usr/bin/env python3
"""
MCP Server for Feature Management
==================================

Provides tools to manage features in the autonomous coding system,
replacing the previous FastAPI-based REST API.

Feature Tools:
- feature_get_stats: Get progress statistics
- feature_get_next: Get next feature to implement (excludes skipped)
- feature_get_for_regression: Get random passing features for testing
- feature_mark_passing: Mark a feature as passing
- feature_skip: Skip a feature (move to end of queue)
- feature_mark_in_progress: Mark a feature as in-progress
- feature_clear_in_progress: Clear in-progress status
- feature_mark_skipped: Mark a feature as skipped (blocked by external dependency)
- feature_unskip: Restore a skipped feature to pending
- feature_check_status: Check database status for initialization
- feature_create_bulk: Create multiple features at once

Dev Server Tools:
- dev_server_start: Start the development server
- dev_server_stop: Stop the running development server
- dev_server_status: Check if dev server is running
- dev_server_logs: Get recent dev server logs
"""

import json
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field
from sqlalchemy.sql.expression import func

# Add parent directory to path so we can import from api module
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.database import Feature, create_database
from api.migration import migrate_json_to_sqlite

# Configuration from environment
PROJECT_DIR = Path(os.environ.get("PROJECT_DIR", ".")).resolve()


def _notify_feature_update():
    """
    Notify the FastAPI server that features have changed.
    This triggers a WebSocket broadcast to all connected clients.
    """
    import urllib.request
    import urllib.error
    
    project_name = PROJECT_DIR.name
    try:
        # Call local FastAPI endpoint to broadcast feature update
        url = f"http://localhost:8888/api/projects/{project_name}/features/notify"
        req = urllib.request.Request(url, method="POST", data=b"")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=2) as response:
            pass  # We don't need the response
    except (urllib.error.URLError, Exception):
        # Server might not be running (CLI mode), ignore errors
        pass


# Pydantic models for input validation
class MarkPassingInput(BaseModel):
    """Input for marking a feature as passing."""
    feature_id: int = Field(..., description="The ID of the feature to mark as passing", ge=1)


class SkipFeatureInput(BaseModel):
    """Input for skipping a feature."""
    feature_id: int = Field(..., description="The ID of the feature to skip", ge=1)


class MarkInProgressInput(BaseModel):
    """Input for marking a feature as in-progress."""
    feature_id: int = Field(..., description="The ID of the feature to mark as in-progress", ge=1)


class ClearInProgressInput(BaseModel):
    """Input for clearing in-progress status."""
    feature_id: int = Field(..., description="The ID of the feature to clear in-progress status", ge=1)


class MarkSkippedInput(BaseModel):
    """Input for marking a feature as skipped."""
    feature_id: int = Field(..., description="The ID of the feature to mark as skipped", ge=1)
    reason: str = Field(..., description="The reason for skipping this feature", min_length=5)


class UnskipInput(BaseModel):
    """Input for restoring a skipped feature to pending."""
    feature_id: int = Field(..., description="The ID of the skipped feature to restore", ge=1)


class RegressionInput(BaseModel):
    """Input for getting regression features."""
    limit: int = Field(default=3, ge=1, le=10, description="Maximum number of passing features to return")


class FeatureCreateItem(BaseModel):
    """Schema for creating a single feature."""
    category: str = Field(..., min_length=1, max_length=100, description="Feature category")
    name: str = Field(..., min_length=1, max_length=255, description="Feature name")
    description: str = Field(..., min_length=1, description="Detailed description")
    steps: list[str] = Field(..., min_length=1, description="Implementation/test steps")


class BulkCreateInput(BaseModel):
    """Input for bulk creating features."""
    features: list[FeatureCreateItem] = Field(..., min_length=1, description="List of features to create")


# Global database session maker (initialized on startup)
_session_maker = None
_engine = None


@asynccontextmanager
async def server_lifespan(server: FastMCP):
    """Initialize database on startup, cleanup on shutdown."""
    global _session_maker, _engine

    # Create project directory if it doesn't exist
    PROJECT_DIR.mkdir(parents=True, exist_ok=True)

    # Initialize database
    _engine, _session_maker = create_database(PROJECT_DIR)

    # Run migration if needed (converts legacy JSON to SQLite)
    migrate_json_to_sqlite(PROJECT_DIR, _session_maker)

    yield

    # Cleanup
    if _engine:
        _engine.dispose()


# Initialize the MCP server
mcp = FastMCP("features", lifespan=server_lifespan)


def get_session():
    """Get a new database session."""
    if _session_maker is None:
        raise RuntimeError("Database not initialized")
    return _session_maker()


@mcp.tool()
def feature_get_stats() -> str:
    """Get statistics about feature completion progress.

    Returns the number of passing features, in-progress features, total features,
    and completion percentage. Use this to track overall progress of the implementation.

    Returns:
        JSON with: passing (int), in_progress (int), total (int), percentage (float)
    """
    session = get_session()
    try:
        total = session.query(Feature).count()
        passing = session.query(Feature).filter(Feature.passes == True).count()
        in_progress = session.query(Feature).filter(Feature.in_progress == True).count()
        percentage = round((passing / total) * 100, 1) if total > 0 else 0.0

        return json.dumps({
            "passing": passing,
            "in_progress": in_progress,
            "total": total,
            "percentage": percentage
        }, indent=2)
    finally:
        session.close()


@mcp.tool()
def feature_get_next() -> str:
    """Get the highest-priority pending feature to work on.

    Returns the feature with the lowest priority number that has passes=false
    and is not skipped. Use this at the start of each coding session to 
    determine what to implement next.

    Returns:
        JSON with feature details (id, priority, category, name, description, steps, passes, in_progress, skipped, skip_reason)
        or error message if all features are passing or skipped.
    """
    session = get_session()
    try:
        feature = (
            session.query(Feature)
            .filter(Feature.passes == False)
            .filter(Feature.skipped == False)
            .order_by(Feature.priority.asc(), Feature.id.asc())
            .first()
        )

        if feature is None:
            # Check if there are skipped features
            skipped_count = session.query(Feature).filter(Feature.skipped == True).count()
            if skipped_count > 0:
                return json.dumps({
                    "status": "ALL_PENDING_SKIPPED",
                    "message": f"All pending features are skipped ({skipped_count} skipped). Use feature_unskip to restore features.",
                    "error": f"All pending features are skipped ({skipped_count} skipped). Use feature_unskip to restore features."
                })
            return json.dumps({
                "status": "ALL_COMPLETE",
                "message": "All features are passing! No more work to do.",
                "error": "All features are passing! No more work to do."  # Keep for backwards compatibility
            })

        return json.dumps(feature.to_dict(), indent=2)
    finally:
        session.close()


@mcp.tool()
def feature_get_for_regression(
    limit: Annotated[int, Field(default=3, ge=1, le=10, description="Maximum number of passing features to return")] = 3
) -> str:
    """Get random passing features for regression testing.

    Returns a random selection of features that are currently passing.
    Use this to verify that previously implemented features still work
    after making changes.

    Args:
        limit: Maximum number of features to return (1-10, default 3)

    Returns:
        JSON with: features (list of feature objects), count (int)
    """
    session = get_session()
    try:
        features = (
            session.query(Feature)
            .filter(Feature.passes == True)
            .order_by(func.random())
            .limit(limit)
            .all()
        )

        return json.dumps({
            "features": [f.to_dict() for f in features],
            "count": len(features)
        }, indent=2)
    finally:
        session.close()


@mcp.tool()
def feature_mark_passing(
    feature_id: Annotated[int, Field(description="The ID of the feature to mark as passing", ge=1)]
) -> str:
    """Mark a feature as passing after successful implementation.

    Updates the feature's passes field to true and clears the in_progress flag.
    Use this after you have implemented the feature and verified it works correctly.

    Args:
        feature_id: The ID of the feature to mark as passing

    Returns:
        JSON with the updated feature details, or error if not found.
    """
    session = get_session()
    try:
        feature = session.query(Feature).filter(Feature.id == feature_id).first()

        if feature is None:
            return json.dumps({"error": f"Feature with ID {feature_id} not found"})

        feature.passes = True
        feature.in_progress = False
        session.commit()
        session.refresh(feature)

        # Notify UI of feature update
        _notify_feature_update()

        return json.dumps(feature.to_dict(), indent=2)
    finally:
        session.close()


@mcp.tool()
def feature_skip(
    feature_id: Annotated[int, Field(description="The ID of the feature to skip", ge=1)]
) -> str:
    """Skip a feature by moving it to the end of the priority queue.

    Use this when a feature cannot be implemented yet due to:
    - Dependencies on other features that aren't implemented yet
    - External blockers (missing assets, unclear requirements)
    - Technical prerequisites that need to be addressed first

    The feature's priority is set to max_priority + 1, so it will be
    worked on after all other pending features. Also clears the in_progress
    flag so the feature returns to "pending" status.

    Args:
        feature_id: The ID of the feature to skip

    Returns:
        JSON with skip details: id, name, old_priority, new_priority, message
    """
    session = get_session()
    try:
        feature = session.query(Feature).filter(Feature.id == feature_id).first()

        if feature is None:
            return json.dumps({"error": f"Feature with ID {feature_id} not found"})

        if feature.passes:
            return json.dumps({"error": "Cannot skip a feature that is already passing"})

        old_priority = feature.priority

        # Get max priority and set this feature to max + 1
        max_priority_result = session.query(Feature.priority).order_by(Feature.priority.desc()).first()
        new_priority = (max_priority_result[0] + 1) if max_priority_result else 1

        feature.priority = new_priority
        feature.in_progress = False
        session.commit()
        session.refresh(feature)

        # Notify UI of feature update
        _notify_feature_update()

        return json.dumps({
            "id": feature.id,
            "name": feature.name,
            "old_priority": old_priority,
            "new_priority": new_priority,
            "message": f"Feature '{feature.name}' moved to end of queue"
        }, indent=2)
    finally:
        session.close()


@mcp.tool()
def feature_mark_in_progress(
    feature_id: Annotated[int, Field(description="The ID of the feature to mark as in-progress", ge=1)]
) -> str:
    """Mark a feature as in-progress. Call immediately after feature_get_next().

    This prevents other agent sessions from working on the same feature.
    Use this as soon as you retrieve a feature to work on.

    Args:
        feature_id: The ID of the feature to mark as in-progress

    Returns:
        JSON with the updated feature details, or error if not found or already in-progress.
    """
    session = get_session()
    try:
        feature = session.query(Feature).filter(Feature.id == feature_id).first()

        if feature is None:
            return json.dumps({"error": f"Feature with ID {feature_id} not found"})

        if feature.passes:
            return json.dumps({"error": f"Feature with ID {feature_id} is already passing"})

        if feature.in_progress:
            return json.dumps({"error": f"Feature with ID {feature_id} is already in-progress"})

        feature.in_progress = True
        session.commit()
        session.refresh(feature)

        # Notify UI of feature update
        _notify_feature_update()

        return json.dumps(feature.to_dict(), indent=2)
    finally:
        session.close()


@mcp.tool()
def feature_clear_in_progress(
    feature_id: Annotated[int, Field(description="The ID of the feature to clear in-progress status", ge=1)]
) -> str:
    """Clear in-progress status from a feature.

    Use this when abandoning a feature or manually unsticking a stuck feature.
    The feature will return to the pending queue.

    Args:
        feature_id: The ID of the feature to clear in-progress status

    Returns:
        JSON with the updated feature details, or error if not found.
    """
    session = get_session()
    try:
        feature = session.query(Feature).filter(Feature.id == feature_id).first()

        if feature is None:
            return json.dumps({"error": f"Feature with ID {feature_id} not found"})

        feature.in_progress = False
        session.commit()
        session.refresh(feature)

        # Notify UI of feature update
        _notify_feature_update()

        return json.dumps(feature.to_dict(), indent=2)
    finally:
        session.close()


@mcp.tool()
def feature_mark_skipped(
    feature_id: Annotated[int, Field(description="The ID of the feature to mark as skipped", ge=1)],
    reason: Annotated[str, Field(description="The reason for skipping this feature (must be specific)", min_length=5)]
) -> str:
    """Mark a feature as skipped due to an external blocker.

    ONLY use this for genuine external blockers you cannot control:
    - External API not configured (missing credentials)
    - External service unavailable
    - Hardware/environment limitations

    NEVER skip because:
    - "Page doesn't exist" -> Create the page
    - "API endpoint missing" -> Implement the endpoint
    - "Database table not ready" -> Create the migration
    - "Component not built" -> Build the component

    Args:
        feature_id: The ID of the feature to skip
        reason: A specific reason why this feature is blocked (min 5 chars)

    Returns:
        JSON with the updated feature details, or error if not found.
    """
    session = get_session()
    try:
        feature = session.query(Feature).filter(Feature.id == feature_id).first()

        if feature is None:
            return json.dumps({"error": f"Feature with ID {feature_id} not found"})

        if feature.passes:
            return json.dumps({"error": f"Cannot skip feature {feature_id} - it is already passing"})

        if feature.skipped:
            return json.dumps({"error": f"Feature {feature_id} is already skipped. Reason: {feature.skip_reason}"})

        feature.skipped = True
        feature.skip_reason = reason
        feature.in_progress = False  # Clear in-progress when skipping
        session.commit()
        session.refresh(feature)

        # Notify UI of feature update
        _notify_feature_update()

        return json.dumps({
            "message": f"Feature '{feature.name}' marked as skipped",
            "feature": feature.to_dict()
        }, indent=2)
    finally:
        session.close()


@mcp.tool()
def feature_unskip(
    feature_id: Annotated[int, Field(description="The ID of the skipped feature to restore", ge=1)]
) -> str:
    """Restore a skipped feature to pending status.

    Use this when:
    - The external blocker has been resolved
    - You want to retry a previously skipped feature
    - The skip was made in error

    The feature will return to the pending queue with its original priority.

    Args:
        feature_id: The ID of the skipped feature to restore

    Returns:
        JSON with the updated feature details, or error if not found/not skipped.
    """
    session = get_session()
    try:
        feature = session.query(Feature).filter(Feature.id == feature_id).first()

        if feature is None:
            return json.dumps({"error": f"Feature with ID {feature_id} not found"})

        if not feature.skipped:
            return json.dumps({"error": f"Feature {feature_id} is not skipped"})

        old_reason = feature.skip_reason
        feature.skipped = False
        feature.skip_reason = None
        session.commit()
        session.refresh(feature)

        # Notify UI of feature update
        _notify_feature_update()

        return json.dumps({
            "message": f"Feature '{feature.name}' restored to pending (was skipped: {old_reason})",
            "feature": feature.to_dict()
        }, indent=2)
    finally:
        session.close()


@mcp.tool()
def feature_check_status() -> str:
    """Check current feature database status. CALL THIS FIRST before any other action.
    
    Returns comprehensive status to help you decide what to do:
    - If action is INITIALIZE: Read app_spec.txt and create features with feature_create_bulk
    - If action is CONTINUE: Call feature_get_next to work on next pending feature
    - If action is COMPLETE: All done! Report success and stop.
    
    The existing_names list lets you compare against features you want to create,
    so you only create truly NEW features (not duplicates).
    
    Returns:
        JSON with:
        - has_features (bool): Whether any features exist in database
        - total (int): Total feature count
        - pending (int): Features not yet passing (excludes skipped)
        - in_progress (int): Features currently being worked on  
        - passing (int): Completed features
        - skipped (int): Features marked as skipped
        - percentage (float): Completion percentage
        - action (str): INITIALIZE, CONTINUE, or COMPLETE
        - message (str): Human-readable guidance
        - existing_names (list): Names of all existing features for duplicate checking
    """
    session = get_session()
    try:
        # Get all features
        features = session.query(Feature).all()
        total = len(features)
        
        if total == 0:
            return json.dumps({
                "has_features": False,
                "total": 0,
                "pending": 0,
                "in_progress": 0,
                "passing": 0,
                "skipped": 0,
                "percentage": 0.0,
                "action": "INITIALIZE",
                "message": "No features found. Read app_spec.txt and call feature_create_bulk to create features.",
                "existing_names": []
            }, indent=2)
        
        # Count by status
        passing = sum(1 for f in features if f.passes)
        in_progress = sum(1 for f in features if f.in_progress and not f.passes)
        skipped = sum(1 for f in features if getattr(f, 'skipped', False) and not f.passes)
        pending = total - passing - in_progress - skipped
        percentage = (passing / total * 100) if total > 0 else 0
        
        # Get all existing names for comparison
        existing_names = [f.name for f in features]
        
        if pending == 0 and in_progress == 0:
            if skipped > 0:
                action = "CONTINUE"
                message = f"All pending features are skipped ({skipped} skipped). Use feature_unskip to restore features, or project is complete."
            else:
                action = "COMPLETE"
                message = "All features are passing! Project is complete. Stop working."
        else:
            action = "CONTINUE"
            message = f"Found {total} features. {passing} passing, {pending} pending, {in_progress} in-progress, {skipped} skipped. Call feature_get_next to continue working."
        
        return json.dumps({
            "has_features": True,
            "total": total,
            "pending": pending,
            "in_progress": in_progress,
            "passing": passing,
            "skipped": skipped,
            "percentage": round(percentage, 1),
            "action": action,
            "message": message,
            "existing_names": existing_names
        }, indent=2)
    finally:
        session.close()


@mcp.tool()
def feature_create_bulk(
    features: Annotated[list[dict], Field(description="List of features to create, each with category, name, description, and steps")]
) -> str:
    """Create multiple features in a single operation.

    Features are assigned sequential priorities based on their order.
    All features start with passes=false.

    This is typically used by the initializer agent to set up the initial
    feature list from the app specification.

    DUPLICATE PREVENTION: Features with names that already exist in the database
    are skipped to prevent duplicates from agent restarts.

    Args:
        features: List of features to create, each with:
            - category (str): Feature category
            - name (str): Feature name
            - description (str): Detailed description
            - steps (list[str]): Implementation/test steps

    Returns:
        JSON with: created (int) - number of features created, skipped (int) - duplicates skipped
    """
    session = get_session()
    try:
        # Get existing feature names to prevent duplicates
        existing_names = set(
            row[0] for row in session.query(Feature.name).all()
        )
        
        # Get the starting priority
        max_priority_result = session.query(Feature.priority).order_by(Feature.priority.desc()).first()
        start_priority = (max_priority_result[0] + 1) if max_priority_result else 1

        created_count = 0
        skipped_count = 0
        priority_offset = 0
        
        for i, feature_data in enumerate(features):
            # Validate required fields
            if not all(key in feature_data for key in ["category", "name", "description", "steps"]):
                return json.dumps({
                    "error": f"Feature at index {i} missing required fields (category, name, description, steps)"
                })

            # Skip duplicates
            feature_name = feature_data["name"]
            if feature_name in existing_names:
                skipped_count += 1
                continue

            db_feature = Feature(
                priority=start_priority + priority_offset,
                category=feature_data["category"],
                name=feature_name,
                description=feature_data["description"],
                steps=feature_data["steps"],
                passes=False,
            )
            session.add(db_feature)
            existing_names.add(feature_name)  # Track newly added names too
            created_count += 1
            priority_offset += 1

        session.commit()

        # Notify UI of feature update
        _notify_feature_update()

        return json.dumps({"created": created_count, "skipped": skipped_count}, indent=2)
    except Exception as e:
        session.rollback()
        return json.dumps({"error": str(e)})
    finally:
        session.close()


# ============================================================================
# Dev Server Tools
# ============================================================================

# Global dev server manager (lazy initialized)
_dev_server_manager = None


def _get_dev_server_manager():
    """Get the dev server manager instance."""
    global _dev_server_manager
    if _dev_server_manager is None:
        # Import here to avoid circular imports
        sys.path.insert(0, str(Path(__file__).parent.parent / "server" / "services"))
        from dev_server_manager import DevServerManager
        _dev_server_manager = DevServerManager()
    return _dev_server_manager


@mcp.tool()
async def dev_server_start(
    command: Annotated[str | None, Field(description="Optional custom command to start the server (e.g., 'npm run dev')")] = None
) -> str:
    """Start the development server for the current project.

    Automatically detects the appropriate command based on project type:
    - Node.js: Uses npm run dev, npm start, or npm run serve
    - Python: Uses python main.py, uvicorn, etc.

    Args:
        command: Optional custom command (if auto-detection isn't suitable)

    Returns:
        JSON with status, URL, and startup info
    """
    import asyncio
    manager = _get_dev_server_manager()
    result = await manager.start(PROJECT_DIR, command)
    return json.dumps(result, indent=2)


@mcp.tool()
async def dev_server_stop() -> str:
    """Stop the running development server.

    Gracefully terminates the dev server process.

    Returns:
        JSON with stop status
    """
    import asyncio
    manager = _get_dev_server_manager()
    result = await manager.stop(PROJECT_DIR)
    return json.dumps(result, indent=2)


@mcp.tool()
def dev_server_status() -> str:
    """Check the status of the development server.

    Returns whether the server is running, its URL, and uptime.

    Returns:
        JSON with running status, URL, uptime, etc.
    """
    manager = _get_dev_server_manager()
    result = manager.get_status(PROJECT_DIR)
    return json.dumps(result, indent=2)


@mcp.tool()
def dev_server_logs(
    lines: Annotated[int, Field(default=50, ge=1, le=500, description="Number of recent log lines to return")] = 50
) -> str:
    """Get recent logs from the development server.

    Useful for debugging server startup issues or runtime errors.

    Args:
        lines: Number of recent lines to return (1-500, default 50)

    Returns:
        JSON with recent log output
    """
    manager = _get_dev_server_manager()
    result = manager.get_logs(PROJECT_DIR, lines)
    return json.dumps(result, indent=2)


if __name__ == "__main__":
    mcp.run()
