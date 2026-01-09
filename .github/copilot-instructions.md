# AutoCoder - AI Coding Agent Instructions

> Inspired by [leonvanzyl/autocoder](https://github.com/leonvanzyl/autocoder). MIT License.

## Architecture Overview

AutoCoder is an autonomous coding agent using the **two-agent pattern**:
1. **Initializer Agent** - First session reads `prompts/app_spec.txt`, creates features in SQLite
2. **Coding Agent** - Subsequent sessions implement features one-by-one, marking them passing

**Key data flows:**
- Features stored in `features.db` (SQLite via SQLAlchemy) per project
- MCP server (`mcp_server/feature_mcp.py`) exposes feature tools to the Claude agent
- FastAPI server (`server/`) provides REST API + WebSocket for real-time UI updates
- React UI (`ui/`) shows Kanban board with live agent output streaming

## Project Structure

```
agent.py          # Session loop using Claude Agent SDK
client.py         # ClaudeSDKClient with security hooks, MCP server config
security.py       # ALLOWED_COMMANDS allowlist for bash validation
prompts.py        # Prompt loading with fallback chain
registry.py       # Cross-platform project registry (~/.autocoder/registry.db)

api/database.py   # SQLAlchemy Feature model
mcp_server/       # MCP server for feature management tools
server/           # FastAPI backend (routers/, services/)
ui/               # React + TypeScript + TanStack Query + Tailwind v4
```

## Critical Conventions

### Security Model (Defense-in-Depth)
Commands are validated in `security.py` via `ALLOWED_COMMANDS` allowlist. When adding new bash commands:
1. Add to `ALLOWED_COMMANDS` set
2. If sensitive, add to `COMMANDS_NEEDING_EXTRA_VALIDATION`
3. Implement validation in `validate_command()`

### MCP Tool Naming
Tools registered in `client.py` use prefix `mcp__features__` (e.g., `mcp__features__feature_get_next`). Update both `FEATURE_MCP_TOOLS` list and permissions when adding tools.

### Prompt Fallback Chain
1. Project-specific: `{project_dir}/prompts/{name}.md`
2. Base template: `.claude/templates/{name}.template.md`

### UI Design System
Uses **neobrutalism** design with Tailwind CSS v4. Theme tokens in `ui/src/styles/globals.css`:
- Colors: `--color-neo-pending`, `--color-neo-progress`, `--color-neo-done`
- Animations: `animate-slide-in`, `animate-pulse-neo`, `animate-shimmer`

### WebSocket Events (`server/websocket.py`)
Real-time updates via `/ws/projects/{project_name}`:
- `progress` - Test pass counts
- `agent_status` - Running/paused/stopped/crashed
- `log` - Agent stdout lines
- `feature_update` - Feature status changes

## Development Workflows

### Running the System
```bash
# CLI mode
python start.py

# Web UI (requires pre-built React app)
python start_ui.py
# After UI changes: cd ui && npm run build
```

### YOLO Mode
Rapid prototyping without browser testing:
```bash
python autonomous_agent_demo.py --project-dir my-app --yolo
```
Skips Playwright MCP, only runs lint/type-check.

### Adding a New Feature MCP Tool
1. Define Pydantic model in `mcp_server/feature_mcp.py`
2. Add tool function with `@mcp.tool()` decorator
3. Add tool name to `FEATURE_MCP_TOOLS` in `client.py`
4. Add to permissions list in `create_client()`

### Adding a New API Endpoint
1. Add route in appropriate `server/routers/*.py` file
2. If stateful, add service in `server/services/`
3. Add TypeScript types in `ui/src/lib/types.ts`
4. Add API function in `ui/src/lib/api.ts`

## Key Files to Reference

- `client.py` - Security settings, MCP config, allowed tools
- `security.py` - Bash command allowlist
- `api/database.py` - Feature SQLAlchemy model
- `mcp_server/feature_mcp.py` - MCP tools exposed to agent
- `server/websocket.py` - Real-time event broadcasting
- `ui/src/lib/types.ts` - TypeScript type definitions
