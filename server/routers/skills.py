"""
Skills Router
=============

API endpoints for managing Claude Skills in projects.
"""

import json
import logging
from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from server.services.skill_generator import recommend_skills, generate_skill

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/skills", tags=["skills"])

# Lazy imports to avoid circular dependencies
_imports_initialized = False
_get_project_path = None
_get_app_spec = None


def _init_imports():
    """Lazy import of project-level modules."""
    global _imports_initialized, _get_project_path, _get_app_spec

    if _imports_initialized:
        return

    import sys
    root = Path(__file__).parent.parent.parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from registry import get_project_path as _gpp
    from prompts import get_app_spec as _gas

    _get_project_path = _gpp
    _get_app_spec = _gas
    _imports_initialized = True


# Pydantic Models

class SkillRecommendation(BaseModel):
    """A recommended skill for the project."""
    name: str
    description: str
    rationale: str


class SkillInfo(BaseModel):
    """Information about an existing skill."""
    name: str
    path: str
    exists: bool


class GenerateSkillsRequest(BaseModel):
    """Request to generate multiple skills."""
    skill_names: List[str]


class SkillContent(BaseModel):
    """Skill content for reading/updating."""
    content: str


# Endpoints

@router.get("/projects/{project_name}/skills", response_model=List[SkillInfo])
async def list_skills(project_name: str):
    """
    List all existing skills for a project.
    
    Returns a list of skills found in the project's .claude/skills/ directory.
    """
    _init_imports()
    
    try:
        project_path = _get_project_path(project_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    skills_dir = project_path / ".claude" / "skills"
    skills = []
    
    if skills_dir.exists():
        for skill_dir in skills_dir.iterdir():
            if skill_dir.is_dir():
                skill_file = skill_dir / "SKILL.md"
                skills.append(SkillInfo(
                    name=skill_dir.name,
                    path=str(skill_file.relative_to(project_path)),
                    exists=skill_file.exists()
                ))
    
    logger.info(f"Listed {len(skills)} skills for project {project_name}")
    return skills


@router.post("/projects/{project_name}/skills/recommend", response_model=List[SkillRecommendation])
async def get_skill_recommendations(project_name: str):
    """
    Analyze project's app_spec.txt and recommend 5-7 relevant skills.
    
    Uses AI to parse the technology stack and suggest appropriate skills.
    """
    _init_imports()
    
    try:
        project_path = _get_project_path(project_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    # Load app spec
    try:
        spec_content = _get_app_spec(project_path)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="app_spec.txt not found. Create a spec first."
        )
    
    # Get AI recommendations
    try:
        recommendations = await recommend_skills(spec_content)
        logger.info(f"Recommended {len(recommendations)} skills for {project_name}")
        return [SkillRecommendation(**rec) for rec in recommendations]
    except Exception as e:
        logger.error(f"Error recommending skills: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to recommend skills: {str(e)}"
        )


@router.post("/projects/{project_name}/skills/generate")
async def generate_skills_stream(project_name: str, request: GenerateSkillsRequest):
    """
    Generate multiple skills sequentially with streaming progress.
    
    Returns Server-Sent Events (SSE) with progress updates and generated content.
    Each event is a JSON object with:
    - {"type": "skill_start", "skill_name": "...", "index": 0, "total": 5}
    - {"type": "status", "message": "Generating..."}
    - {"type": "content", "text": "chunk"}
    - {"type": "skill_complete", "skill_name": "...", "path": "..."}
    - {"type": "complete", "count": 5}
    """
    _init_imports()
    
    try:
        project_path = _get_project_path(project_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    # Load app spec for context
    try:
        spec_content = _get_app_spec(project_path)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="app_spec.txt not found. Create a spec first."
        )
    
    # Get recommendations to match skill names to descriptions
    try:
        recommendations = await recommend_skills(spec_content)
        skill_map = {rec["name"]: rec["description"] for rec in recommendations}
    except Exception as e:
        logger.error(f"Error getting skill details: {e}")
        # Fallback to generic descriptions
        skill_map = {}
    
    async def event_stream():
        """Generate SSE stream for skill generation."""
        total = len(request.skill_names)
        
        for index, skill_name in enumerate(request.skill_names):
            # Send start event
            yield f"data: {json.dumps({'type': 'skill_start', 'skill_name': skill_name, 'index': index, 'total': total})}\n\n"
            
            # Get description for this skill
            skill_description = skill_map.get(
                skill_name,
                f"Expert guidance for {skill_name.replace('-', ' ')}"
            )
            
            # Generate skill with streaming
            try:
                async for chunk in generate_skill(
                    project_path,
                    spec_content,
                    skill_name,
                    skill_description
                ):
                    # Forward all events from generator
                    yield f"data: {json.dumps(chunk)}\n\n"
                    
            except Exception as e:
                logger.error(f"Error generating skill {skill_name}: {e}")
                error_event = {"type": "error", "skill_name": skill_name, "message": str(e)}
                yield f"data: {json.dumps(error_event)}\n\n"
        
        # Send completion event
        yield f"data: {json.dumps({'type': 'complete', 'count': total})}\n\n"
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.get("/projects/{project_name}/skills/{skill_name}", response_model=SkillContent)
async def get_skill(project_name: str, skill_name: str):
    """
    Read the content of a specific skill.
    
    Returns the SKILL.md file content for editing.
    """
    _init_imports()
    
    try:
        project_path = _get_project_path(project_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    skill_file = project_path / ".claude" / "skills" / skill_name / "SKILL.md"
    
    if not skill_file.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Skill '{skill_name}' not found"
        )
    
    try:
        content = skill_file.read_text(encoding="utf-8")
        return SkillContent(content=content)
    except Exception as e:
        logger.error(f"Error reading skill {skill_name}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read skill: {str(e)}"
        )


@router.put("/projects/{project_name}/skills/{skill_name}", response_model=SkillContent)
async def update_skill(project_name: str, skill_name: str, skill_content: SkillContent):
    """
    Update the content of a specific skill.
    
    Saves edited SKILL.md content back to the file.
    """
    _init_imports()
    
    try:
        project_path = _get_project_path(project_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    skill_dir = project_path / ".claude" / "skills" / skill_name
    skill_file = skill_dir / "SKILL.md"
    
    # Create directory if it doesn't exist (for new skills)
    skill_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        skill_file.write_text(skill_content.content, encoding="utf-8")
        logger.info(f"Updated skill {skill_name} for project {project_name}")
        return skill_content
    except Exception as e:
        logger.error(f"Error updating skill {skill_name}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update skill: {str(e)}"
        )
