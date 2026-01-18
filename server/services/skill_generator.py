"""
Skill Generator Service
======================

Generates Claude Skills based on technology stack analysis.
Uses AI to recommend and generate SKILL.md files for projects.
"""

import json
import logging
import os
from pathlib import Path
from typing import AsyncGenerator

from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

logger = logging.getLogger(__name__)

# Root directory of the project
ROOT_DIR = Path(__file__).parent.parent.parent


async def recommend_skills(spec_content: str) -> list[dict]:
    """
    Analyze app spec and recommend 5-7 relevant skills.
    
    Args:
        spec_content: Complete app_spec.txt content
        
    Returns:
        List of skill recommendations with name, description, and rationale
        
    Example:
        [
            {
                "name": "react-hooks-patterns",
                "description": "React best practices for hooks and components",
                "rationale": "Project uses React with Vite"
            },
            ...
        ]
    """
    # Load the recommender prompt template
    template_path = ROOT_DIR / ".claude" / "templates" / "skill_recommender_prompt.template.md"
    
    if not template_path.exists():
        raise FileNotFoundError(f"Skill recommender template not found: {template_path}")
    
    try:
        prompt_template = template_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        prompt_template = template_path.read_text(encoding="utf-8", errors="replace")
    
    # Build complete prompt with spec content
    system_prompt = prompt_template + "\n\n" + spec_content
    
    # Build environment settings for GLM model
    glm_api_key = os.environ.get("ZAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    env_settings = {
        "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
        "API_TIMEOUT_MS": "180000",  # 3 minute timeout
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.5-air",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.7",
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.7",
        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    }
    if glm_api_key:
        env_settings["ANTHROPIC_AUTH_TOKEN"] = glm_api_key
    
    # Set environment variables
    for key, value in env_settings.items():
        os.environ[key] = str(value)
    
    # Create client with Sonnet for intelligent analysis
    options = ClaudeAgentOptions(
        model="claude-sonnet-4-20250514",  # Will be mapped to glm-4.7
        system_prompt=system_prompt,
        allowed_tools=[],  # No tools needed for analysis
        setting_sources=[],  # No project settings
    )
    
    client = ClaudeSDKClient(options=options)
    
    try:
        # Enter context manager
        await client.__aenter__()
        
        # Query for recommendations
        await client.query("Analyze the specification and provide skill recommendations.")
        
        # Stream the response
        response_text = ""
        async for msg in client.receive_response():
            msg_type = type(msg).__name__
            if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    block_type = type(block).__name__
                    if block_type == "TextBlock" and hasattr(block, "text"):
                        response_text += block.text
        
        # Parse JSON response
        # Remove markdown code blocks if present
        json_str = response_text.strip()
        if json_str.startswith("```json"):
            json_str = json_str[7:]  # Remove ```json
        if json_str.startswith("```"):
            json_str = json_str[3:]  # Remove ```
        if json_str.endswith("```"):
            json_str = json_str[:-3]  # Remove trailing ```
        json_str = json_str.strip()
        
        recommendations = json.loads(json_str)
        
        # Validate structure
        if not isinstance(recommendations, list):
            raise ValueError("Recommendations must be a JSON array")
        
        for rec in recommendations:
            if not all(key in rec for key in ["name", "description", "rationale"]):
                raise ValueError("Each recommendation must have name, description, and rationale")
        
        logger.info(f"Generated {len(recommendations)} skill recommendations")
        return recommendations
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse skill recommendations JSON: {e}")
        logger.error(f"Response text: {response_text}")
        raise ValueError(f"AI returned invalid JSON: {e}")
    except Exception as e:
        logger.error(f"Error generating skill recommendations: {e}")
        raise
    finally:
        await client.__aexit__(None, None, None)


async def generate_skill(
    project_dir: Path,
    spec_content: str,
    skill_name: str,
    skill_description: str
) -> AsyncGenerator[dict, None]:
    """
    Generate a SKILL.md file for a specific technology/framework.
    
    Args:
        project_dir: Absolute path to the project directory
        spec_content: Complete app_spec.txt content for context
        skill_name: Name of the skill to generate (e.g., "react-hooks-patterns")
        skill_description: Description of what the skill should cover
        
    Yields:
        Progress updates and the generated skill content:
        - {"type": "status", "message": "Generating skill..."}
        - {"type": "content", "text": "chunk of SKILL.md"}
        - {"type": "complete", "skill_name": "...", "content": "full SKILL.md"}
    """
    # Load the generator prompt template
    template_path = ROOT_DIR / ".claude" / "templates" / "skill_generator_prompt.template.md"
    
    if not template_path.exists():
        yield {"type": "error", "message": f"Skill generator template not found: {template_path}"}
        return
    
    try:
        prompt_template = template_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        prompt_template = template_path.read_text(encoding="utf-8", errors="replace")
    
    # Extract tech stack from spec for context
    # Simple extraction - look for <technology_stack> section
    tech_stack = "Technology stack details from app_spec.txt"
    if "<technology_stack>" in spec_content and "</technology_stack>" in spec_content:
        start = spec_content.index("<technology_stack>")
        end = spec_content.index("</technology_stack>") + len("</technology_stack>")
        tech_stack = spec_content[start:end]
    
    # Substitute placeholders in template
    system_prompt = prompt_template.replace("$TECH_STACK", tech_stack)
    system_prompt = system_prompt.replace("$SKILL_NAME", skill_name)
    system_prompt = system_prompt.replace("$SKILL_DESCRIPTION", skill_description)
    
    # Build environment settings for GLM model
    glm_api_key = os.environ.get("ZAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    env_settings = {
        "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
        "API_TIMEOUT_MS": "240000",  # 4 minute timeout
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.5-air",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.7",
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.7",
        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    }
    if glm_api_key:
        env_settings["ANTHROPIC_AUTH_TOKEN"] = glm_api_key
    
    # Set environment variables
    for key, value in env_settings.items():
        os.environ[key] = str(value)
    
    # Create client with Sonnet for quality content generation
    options = ClaudeAgentOptions(
        model="claude-sonnet-4-20250514",  # Will be mapped to glm-4.7
        system_prompt=system_prompt,
        allowed_tools=[],  # No tools needed
        setting_sources=[],
    )
    
    client = ClaudeSDKClient(options=options)
    
    try:
        yield {"type": "status", "message": f"Generating {skill_name}..."}
        
        # Enter context manager
        await client.__aenter__()
        
        # Send query
        await client.query("Generate the SKILL.md file.")
        
        # Stream the skill content
        full_content = ""
        async for msg in client.receive_response():
            msg_type = type(msg).__name__
            if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    block_type = type(block).__name__
                    if block_type == "TextBlock" and hasattr(block, "text"):
                        text = block.text
                        if text:
                            full_content += text
                            yield {"type": "content", "text": text}
        
        # Save to project's .claude/skills/ directory
        skills_dir = project_dir / ".claude" / "skills" / skill_name
        skills_dir.mkdir(parents=True, exist_ok=True)
        
        skill_file = skills_dir / "SKILL.md"
        skill_file.write_text(full_content, encoding="utf-8")
        
        logger.info(f"Generated skill: {skill_name} at {skill_file}")
        
        yield {
            "type": "complete",
            "skill_name": skill_name,
            "content": full_content,
            "path": str(skill_file)
        }
        
    except Exception as e:
        logger.error(f"Error generating skill {skill_name}: {e}")
        yield {"type": "error", "message": str(e)}
    finally:
        await client.__aexit__(None, None, None)
