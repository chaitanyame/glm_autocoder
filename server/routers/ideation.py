"""
Ideation Router
===============

API endpoints for AI-powered idea generation and backlog management.
"""

import json
import logging
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ideation", tags=["ideation"])


# ============================================================================
# Pydantic Models
# ============================================================================

class IdeaCategoryInfo(BaseModel):
    id: str
    name: str
    icon: str
    description: str


class IdeationPrompt(BaseModel):
    id: str
    category: str
    title: str
    description: str


class Idea(BaseModel):
    id: str
    category: str
    title: str
    description: str
    rationale: str
    priority: str  # 'high' | 'medium' | 'low'
    createdAt: str
    promoted: bool = False


class IdeaCreate(BaseModel):
    category: str
    title: str
    description: str = ""
    rationale: str = ""
    priority: str = "medium"


class GenerateIdeasRequest(BaseModel):
    category: str
    prompt_id: str
    count: int = Field(default=10, ge=1, le=20)
    review_only: bool = False


class GenerateIdeasResponse(BaseModel):
    success: bool
    ideas: List[Idea]


# ============================================================================
# Category & Prompt Definitions
# ============================================================================

CATEGORIES: List[IdeaCategoryInfo] = [
    IdeaCategoryInfo(id="feature", name="Features", icon="Zap", description="New capabilities and functionality"),
    IdeaCategoryInfo(id="ux-ui", name="UX/UI", icon="Palette", description="Design and user experience"),
    IdeaCategoryInfo(id="dx", name="Developer Experience", icon="Code", description="Developer tooling and workflows"),
    IdeaCategoryInfo(id="growth", name="Growth", icon="TrendingUp", description="User engagement and retention"),
    IdeaCategoryInfo(id="technical", name="Technical", icon="Cpu", description="Architecture and infrastructure"),
    IdeaCategoryInfo(id="security", name="Security", icon="Shield", description="Security improvements"),
    IdeaCategoryInfo(id="performance", name="Performance", icon="Gauge", description="Speed optimization"),
    IdeaCategoryInfo(id="accessibility", name="Accessibility", icon="Accessibility", description="Inclusive design"),
    IdeaCategoryInfo(id="analytics", name="Analytics", icon="BarChart", description="Monitoring and insights"),
]

PROMPTS: dict[str, List[IdeationPrompt]] = {
    "feature": [
        IdeationPrompt(id="missing", category="feature", title="Missing Features", description="Identify features users typically expect"),
        IdeationPrompt(id="automation", category="feature", title="Automation", description="Manual processes that could be automated"),
        IdeationPrompt(id="integrations", category="feature", title="Integrations", description="Third-party services that add value"),
    ],
    "ux-ui": [
        IdeationPrompt(id="friction", category="ux-ui", title="Friction Points", description="Identify user friction points"),
        IdeationPrompt(id="empty-states", category="ux-ui", title="Empty States", description="Improve empty state experiences"),
        IdeationPrompt(id="visual", category="ux-ui", title="Visual Polish", description="Visual improvements and consistency"),
    ],
    "dx": [
        IdeationPrompt(id="tooling", category="dx", title="Developer Tools", description="Improve developer experience"),
        IdeationPrompt(id="docs", category="dx", title="Documentation", description="Documentation improvements"),
        IdeationPrompt(id="testing", category="dx", title="Testing", description="Testing infrastructure improvements"),
    ],
    "growth": [
        IdeationPrompt(id="onboarding", category="growth", title="Onboarding", description="Improve user onboarding flow"),
        IdeationPrompt(id="retention", category="growth", title="Retention", description="Features to increase retention"),
        IdeationPrompt(id="viral", category="growth", title="Viral Features", description="Features that encourage sharing"),
    ],
    "technical": [
        IdeationPrompt(id="refactor", category="technical", title="Refactoring", description="Code quality improvements"),
        IdeationPrompt(id="architecture", category="technical", title="Architecture", description="Architectural improvements"),
        IdeationPrompt(id="debt", category="technical", title="Tech Debt", description="Technical debt reduction"),
    ],
    "security": [
        IdeationPrompt(id="vulnerabilities", category="security", title="Vulnerabilities", description="Security vulnerability fixes"),
        IdeationPrompt(id="auth", category="security", title="Authentication", description="Auth and authorization improvements"),
        IdeationPrompt(id="data", category="security", title="Data Protection", description="Data security improvements"),
    ],
    "performance": [
        IdeationPrompt(id="speed", category="performance", title="Speed", description="Performance bottlenecks to fix"),
        IdeationPrompt(id="caching", category="performance", title="Caching", description="Caching opportunities"),
        IdeationPrompt(id="bundle", category="performance", title="Bundle Size", description="Reduce bundle size"),
    ],
    "accessibility": [
        IdeationPrompt(id="screen-reader", category="accessibility", title="Screen Readers", description="Screen reader improvements"),
        IdeationPrompt(id="keyboard", category="accessibility", title="Keyboard Nav", description="Keyboard navigation"),
        IdeationPrompt(id="contrast", category="accessibility", title="Contrast", description="Color contrast improvements"),
    ],
    "analytics": [
        IdeationPrompt(id="metrics", category="analytics", title="Key Metrics", description="Important metrics to track"),
        IdeationPrompt(id="events", category="analytics", title="Event Tracking", description="User events to track"),
        IdeationPrompt(id="dashboards", category="analytics", title="Dashboards", description="Dashboard improvements"),
    ],
}

CATEGORY_DESCRIPTIONS = {
    "feature": "New features and capabilities that add value for users",
    "ux-ui": "User interface and user experience improvements",
    "dx": "Developer experience and tooling improvements",
    "growth": "User acquisition, engagement, and retention",
    "technical": "Architecture, performance, and infrastructure",
    "security": "Security improvements and vulnerability fixes",
    "performance": "Performance optimization and speed improvements",
    "accessibility": "Accessibility features and inclusive design",
    "analytics": "Analytics, monitoring, and insights features",
}


# ============================================================================
# Helper Functions
# ============================================================================

def _get_project_path(project_name: str) -> Path:
    """Get project path from registry."""
    import sys
    root = Path(__file__).parent.parent.parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from registry import get_project_path
    project_path = get_project_path(project_name)
    if project_path is None:
        raise HTTPException(status_code=404, detail=f"Project not found: {project_name}")
    return project_path


def _get_ideas_file(project_dir: Path) -> Path:
    """Get path to ideas storage file."""
    ideas_dir = project_dir / ".autocoder" / "ideation"
    ideas_dir.mkdir(parents=True, exist_ok=True)
    return ideas_dir / "ideas.json"


def _load_ideas(project_dir: Path) -> List[Idea]:
    """Load ideas from storage."""
    ideas_file = _get_ideas_file(project_dir)
    if not ideas_file.exists():
        return []
    try:
        with open(ideas_file, "r") as f:
            data = json.load(f)
            return [Idea(**item) for item in data]
    except Exception as e:
        logger.error(f"Failed to load ideas: {e}")
        return []


def _save_ideas(project_dir: Path, ideas: List[Idea]) -> None:
    """Save ideas to storage."""
    ideas_file = _get_ideas_file(project_dir)
    try:
        with open(ideas_file, "w") as f:
            json.dump([idea.model_dump() for idea in ideas], f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save ideas: {e}")
        raise HTTPException(status_code=500, detail="Failed to save ideas")


def _load_project_context(project_dir: Path) -> str:
    """Load project context for AI generation."""
    context_parts = []
    
    # Load app_spec.txt
    spec_file = project_dir / "prompts" / "app_spec.txt"
    if spec_file.exists():
        try:
            spec_content = spec_file.read_text()[:5000]  # Limit size
            context_parts.append(f"## App Specification\n{spec_content}")
        except Exception:
            pass
    
    # Load existing features
    try:
        import sys
        root = Path(__file__).parent.parent.parent
        if str(root) not in sys.path:
            sys.path.insert(0, str(root))
        from api.database import Feature, create_database, get_database_path
        
        db_path = get_database_path(project_dir)
        if db_path.exists():
            Session = create_database(db_path)
            with Session() as session:
                features = session.query(Feature).all()
                if features:
                    feature_list = "\n".join([f"- {f.name}: {f.description[:100]}" for f in features[:20]])
                    context_parts.append(f"## Existing Features\n{feature_list}")
    except Exception as e:
        logger.debug(f"Could not load features: {e}")
    
    # Load existing ideas
    existing_ideas = _load_ideas(project_dir)
    if existing_ideas:
        idea_list = "\n".join([f"- {idea.title}" for idea in existing_ideas if not idea.promoted])
        context_parts.append(f"## Existing Ideas in Backlog\n{idea_list}")
    
    return "\n\n".join(context_parts) if context_parts else "No project context available."


def validate_project_name(name: str) -> str:
    """Validate and sanitize project name."""
    if not re.match(r'^[a-zA-Z0-9_-]{1,50}$', name):
        raise HTTPException(status_code=400, detail="Invalid project name")
    return name


# ============================================================================
# AI Generation
# ============================================================================

async def _generate_ideas_with_ai(
    project_dir: Path,
    category: str,
    prompt_id: str,
    count: int
) -> List[Idea]:
    """Generate ideas using AI."""
    import os
    
    # Get prompt info
    prompts = PROMPTS.get(category, [])
    prompt_info = next((p for p in prompts if p.id == prompt_id), None)
    if not prompt_info:
        raise HTTPException(status_code=400, detail=f"Invalid prompt: {prompt_id}")
    
    # Load project context
    context = _load_project_context(project_dir)
    
    # Build AI prompt
    system_prompt = f"""You are an AI product strategist helping brainstorm feature ideas for a software project.

Based on the project context and the user's prompt, generate exactly {count} creative and actionable suggestions.

YOUR RESPONSE MUST BE ONLY A JSON ARRAY - nothing else. No explanation, no preamble, no markdown code fences.

Each suggestion must have this structure:
{{
  "title": "Short, actionable title (max 60 chars)",
  "description": "Clear description of what to build or improve (2-3 sentences)",
  "rationale": "Why this is valuable - the problem it solves or opportunity it creates",
  "priority": "high" | "medium" | "low"
}}

Focus area: {CATEGORY_DESCRIPTIONS.get(category, category)}
Prompt: {prompt_info.title} - {prompt_info.description}

Guidelines:
- Generate exactly {count} suggestions
- Be specific and actionable - avoid vague ideas
- Mix different priority levels (some high, some medium, some low)
- Each suggestion should be independently implementable
- Think creatively - include both obvious improvements and innovative ideas
- IMPORTANT: Do NOT suggest features or ideas that already exist in the project

## Project Context
{context}"""

    try:
        # Try to use Claude SDK
        api_key = os.environ.get("ZAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("No API key configured")
        
        import httpx
        
        base_url = os.environ.get("ANTHROPIC_BASE_URL", "https://api.z.ai/api/anthropic")
        model = os.environ.get("ANTHROPIC_DEFAULT_SONNET_MODEL", "glm-4.7")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{base_url}/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": 4000,
                    "messages": [
                        {"role": "user", "content": system_prompt}
                    ],
                },
            )
            
            if response.status_code != 200:
                logger.error(f"AI API error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=500, detail="AI generation failed")
            
            result = response.json()
            content = result.get("content", [{}])[0].get("text", "[]")
            
            # Parse JSON response
            # Try to extract JSON array from response
            import re as regex
            json_match = regex.search(r'\[[\s\S]*\]', content)
            if json_match:
                content = json_match.group()
            
            suggestions = json.loads(content)
            
            # Convert to Idea objects
            ideas = []
            now = datetime.utcnow().isoformat()
            for suggestion in suggestions[:count]:
                idea = Idea(
                    id=str(uuid.uuid4()),
                    category=category,
                    title=suggestion.get("title", "Untitled")[:100],
                    description=suggestion.get("description", "")[:500],
                    rationale=suggestion.get("rationale", "")[:500],
                    priority=suggestion.get("priority", "medium"),
                    createdAt=now,
                    promoted=False,
                )
                ideas.append(idea)
            
            return ideas
            
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response as JSON: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse AI response")
    except Exception as e:
        logger.error(f"AI generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/categories", response_model=List[IdeaCategoryInfo])
async def get_categories():
    """Get all idea categories."""
    return CATEGORIES


@router.get("/prompts/{category}", response_model=List[IdeationPrompt])
async def get_prompts(category: str):
    """Get prompts for a specific category."""
    if category not in PROMPTS:
        raise HTTPException(status_code=404, detail=f"Category not found: {category}")
    return PROMPTS[category]


@router.get("/{project_name}/ideas", response_model=List[Idea])
async def get_ideas(project_name: str):
    """Get all ideas for a project."""
    project_name = validate_project_name(project_name)
    project_path = _get_project_path(project_name)
    return _load_ideas(project_path)


@router.post("/{project_name}/ideas", response_model=Idea)
async def create_idea(project_name: str, idea_create: IdeaCreate):
    """Create a new idea manually."""
    project_name = validate_project_name(project_name)
    project_path = _get_project_path(project_name)
    
    idea = Idea(
        id=str(uuid.uuid4()),
        category=idea_create.category,
        title=idea_create.title,
        description=idea_create.description,
        rationale=idea_create.rationale,
        priority=idea_create.priority,
        createdAt=datetime.utcnow().isoformat(),
        promoted=False,
    )
    
    ideas = _load_ideas(project_path)
    ideas.append(idea)
    _save_ideas(project_path, ideas)
    
    return idea


@router.delete("/{project_name}/ideas/{idea_id}")
async def delete_idea(project_name: str, idea_id: str):
    """Delete an idea."""
    project_name = validate_project_name(project_name)
    project_path = _get_project_path(project_name)
    
    ideas = _load_ideas(project_path)
    ideas = [i for i in ideas if i.id != idea_id]
    _save_ideas(project_path, ideas)
    
    return {"success": True}


@router.post("/{project_name}/ideas/{idea_id}/promote")
async def promote_idea(project_name: str, idea_id: str):
    """Promote an idea to a feature on the Kanban board."""
    project_name = validate_project_name(project_name)
    project_path = _get_project_path(project_name)
    
    ideas = _load_ideas(project_path)
    idea = next((i for i in ideas if i.id == idea_id), None)
    
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    # Create feature in database
    try:
        import sys
        root = Path(__file__).parent.parent.parent
        if str(root) not in sys.path:
            sys.path.insert(0, str(root))
        from api.database import Feature, create_database, get_database_path
        
        db_path = get_database_path(project_path)
        Session = create_database(db_path)
        
        # Map idea category to feature category
        category_map = {
            "feature": "ui",
            "ux-ui": "enhancement",
            "dx": "chore",
            "growth": "feature",
            "technical": "refactor",
            "security": "bug",
            "performance": "enhancement",
            "accessibility": "enhancement",
            "analytics": "feature",
        }
        
        with Session() as session:
            # Get max priority
            max_priority = session.query(Feature).count() + 1
            
            feature = Feature(
                priority=max_priority,
                category=category_map.get(idea.category, "feature"),
                name=idea.title,
                description=f"{idea.description}\n\n**Rationale:** {idea.rationale}",
                steps=[],
                passes=False,
                in_progress=False,
                skipped=False,
                skip_reason=None,
            )
            session.add(feature)
            session.commit()
            
            feature_data = {
                "id": feature.id,
                "name": feature.name,
                "category": feature.category,
                "description": feature.description,
            }
        
        # Mark idea as promoted
        idea.promoted = True
        _save_ideas(project_path, ideas)
        
        # Notify WebSocket clients
        from ..websocket import manager
        await manager.broadcast_to_project(project_name, {
            "type": "feature_update",
            "project": project_name,
        })
        
        return feature_data
        
    except Exception as e:
        logger.error(f"Failed to promote idea: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_name}/generate", response_model=GenerateIdeasResponse)
async def generate_ideas(project_name: str, request: GenerateIdeasRequest):
    """Generate ideas using AI."""
    project_name = validate_project_name(project_name)
    project_path = _get_project_path(project_name)
    
    # Generate ideas
    new_ideas = await _generate_ideas_with_ai(
        project_path,
        request.category,
        request.prompt_id,
        request.count,
    )
    
    # Save new ideas unless we're in review-only mode
    if not request.review_only:
        existing_ideas = _load_ideas(project_path)
        all_ideas = existing_ideas + new_ideas
        _save_ideas(project_path, all_ideas)
    
    return GenerateIdeasResponse(success=True, ideas=new_ideas)
