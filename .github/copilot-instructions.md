# AutoCoder - AI Coding Agent Instructions

## Architecture Overview

AutoCoder uses a **two-agent pattern** with GLM models via Z.AI proxy:
1. **Initializer Agent** - First session reads `prompts/app_spec.txt`, creates features in SQLite
2. **Coding Agent** - Subsequent sessions implement features one-by-one via MCP tools

**Data flow:** React UI ↔ FastAPI (WebSocket) ↔ Process Manager → Claude Agent SDK → MCP Servers (features db, Playwright)

## Quick Start

```bash
# Web UI (recommended) - serves pre-built React app
python start_ui.py          # or start_ui.bat on Windows

# CLI mode
python start.py             # Interactive project selection

# YOLO mode - skip browser testing for rapid prototyping
python autonomous_agent_demo.py --project-dir my-app --yolo

# Run tests
python test_security.py     # Security hook validation tests
```

After UI changes: `cd ui && npm run build`

## Project Structure

| File/Dir | Purpose |
|----------|---------|
| `client.py` | ClaudeSDKClient config, MCP servers, security hooks, GLM env vars |
| `security.py` | `ALLOWED_COMMANDS` bash allowlist (defense-in-depth) |
| `agent.py` | Session loop, streaming response handling, rate limit detection (`EXIT_CODE_RATE_LIMITED = 42`) |
| `prompts.py` | Prompt loading with fallback chain (project → templates) |
| `registry.py` | Cross-platform project registry (`~/.autocoder/registry.db`) |
| `mcp_server/feature_mcp.py` | MCP tools: `feature_get_next`, `feature_mark_passing`, `feature_create_bulk`, etc. |
| `server/websocket.py` | Real-time events: `progress`, `agent_status`, `log`, `feature_update` |
| `server/services/process_manager.py` | Agent subprocess lifecycle, rate limit auto-resume |
| `server/services/rate_limit_state.py` | Persisted rate limit state (`~/.autocoder/rate_limit_state.json`) |
| `server/services/assistant_chat_session.py` | Read-only assistant (cannot modify files) |
| `server/services/spec_chat_session.py` | Interactive spec creation wizard |
| `server/services/dev_server_manager.py` | Dev server lifecycle (start/stop/status/logs) |
| `api/database.py` | SQLAlchemy `Feature` model, stored in `.autocoder/features.db` |

## Critical Conventions

### Adding Bash Commands to Allowlist
```python
# security.py - three-step process:
ALLOWED_COMMANDS = {"ls", "npm", ...}  # 1. Add command here
COMMANDS_NEEDING_EXTRA_VALIDATION = {"pkill", "chmod"}  # 2. If sensitive
# 3. Implement validation in validate_command() function
```

### Adding MCP Tools
```python
# 1. Define Pydantic model in mcp_server/feature_mcp.py
class MyInput(BaseModel):
    feature_id: int = Field(..., ge=1)

# 2. Add tool function with @mcp.tool() decorator

# 3. Add to client.py FEATURE_MCP_TOOLS or DEV_SERVER_TOOLS list
FEATURE_MCP_TOOLS = [..., "mcp__features__my_new_tool"]
DEV_SERVER_TOOLS = ["mcp__features__dev_server_start", ...]

# 4. Add to permissions list in create_client()
```

### Adding API Endpoints
1. Route in `server/routers/*.py` → 2. Types in `ui/src/lib/types.ts` → 3. API fn in `ui/src/lib/api.ts`

### Prompt Fallback Chain
Prompts are loaded in this order (see `prompts.py`):
1. **Project-specific**: `{project_dir}/prompts/{name}.md`
2. **Base template**: `.claude/templates/{name}.template.md`

Templates available: `initializer_prompt`, `coding_prompt`, `coding_prompt_yolo`, `app_spec`

### WebSocket Events (`/ws/projects/{project_name}`)
- `progress` - `{passing, total, percentage}`
- `agent_status` - `running|paused|stopped|crashed|rate_limited|completed`
- `log` - Agent stdout lines (streamed, sensitive data redacted)
- `feature_update` - Triggers UI refresh

### UI Design System
Neobrutalism design with Tailwind CSS v4. Theme tokens in `ui/src/styles/globals.css`:
```css
--color-neo-pending   /* yellow */
--color-neo-progress  /* cyan */
--color-neo-done      /* green */
--color-neo-skipped   /* gray */
```

## Rate Limiting & Auto-Resume

When API rate limits are hit:
1. `agent.py` detects 429 error, prints `RATE_LIMITED:<reset_time>` marker, exits with code 42
2. `process_manager.py` detects exit code 42, sets status to `rate_limited`
3. `rate_limit_state.py` persists state to `~/.autocoder/rate_limit_state.json`
4. Auto-resume is scheduled when reset time arrives
5. State survives container restarts (Docker volume: `autocoder-data`)

## GLM Model Configuration

The agent uses GLM via Anthropic-compatible proxy (see `client.py`):
```python
env_settings = {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": api_key,  # From ZAI_API_KEY env var
}
```

Model defaults: `glm-4.7` (opus/sonnet), `glm-4.5-air` (haiku). Per-project model stored in registry.

## Docker Support

Multi-stage build: `Dockerfile` builds React UI, then Python runtime with Chromium for Playwright.
```bash
docker compose up -d --build   # Uses host's projects/ volume

# Required .env variables:
HOST_PROJECTS_DIR=/path/to/projects
ZAI_API_KEY=your-api-key
CORS_ORIGINS=http://remote-host:8888  # Optional for remote access
```

Environment: `DOCKER_ENV=1` enables headless Chromium with `--no-sandbox`

## Project File Layout

Generated projects contain:
- `prompts/app_spec.txt` - Application specification (XML format)
- `prompts/*.md` - Optional project-specific prompt overrides
- `.autocoder/features.db` - SQLite feature database
- `.autocoder/.agent.lock` - Prevents multiple agent instances
- `.autocoder/logs/` - Session logs and progress files
- `init.sh` - Environment setup script
- `claude-progress.txt` - Session progress notes

## Claude Code Integration

- `.claude/commands/create-spec.md` - `/create-spec` slash command for interactive spec wizard
- `.claude/commands/checkpoint.md` - `/checkpoint` for saving progress
- `.claude/skills/frontend-design/` - Skill for distinctive neobrutalism UI design
- `.claude/templates/` - Base prompt templates copied to new projects

## Assistant & Spec Chat

Two auxiliary chat modes in `server/services/`:

**AssistantChat** (`assistant_chat_session.py`):
- Read-only access (Read, Glob, Grep, WebFetch, WebSearch)
- Feature status tools (stats, next, regression) but no modifications
- Answers questions about codebase without changing files

**SpecChat** (`spec_chat_session.py`):
- Multi-phase wizard using `.claude/commands/create-spec.md`
- Phases: Overview → Involvement Level → Tech Prefs → Features → Technical Details → Approval
- Generates `prompts/app_spec.txt` when complete

## Testing

```bash
# Security hook tests (command validation)
python test_security.py

# WebSocket endpoint tests
python -m pytest tests/test_websocket_endpoints.py
```

Security tests validate: command extraction, allowlist enforcement, chmod/pkill restrictions, init.sh validation
