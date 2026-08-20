# GLM AutoCoder

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An autonomous coding agent that drives the Claude Agent SDK harness through **GLM models served by Z.AI** (`https://api.z.ai/api/anthropic`). It builds complete applications over multiple sessions using a two-agent pattern with real-time progress monitoring — now with a cost-efficient GLM backend.

> **Inspired by [leonvanzyl/autocoder](https://github.com/leonvanzyl/autocoder)** — Credits to [Leon van Zyl](https://github.com/leonvanzyl) for the original implementation. This fork keeps the proven agent harness but routes the model calls to GLM.

## Why GLM?

GLM 4.7 and GLM 4.5-air are served through Z.AI's Anthropic-compatible endpoint, so the entire Claude Agent SDK harness (agentic tool loop, MCP servers, security hooks, sandboxing) keeps working unchanged while the underlying model is GLM. Per the repo's own migration analysis, GLM pricing is roughly **~1/7 the cost of Claude** for similar coding capability, and `glm-4.7` offers a 128K context window.

## Features

- 🤖 **Two-Agent Pattern** - Initializer creates features, Coding Agent implements them
- 🧠 **GLM Backend** - Routes to `glm-4.7` / `glm-4.5-air` via Z.AI's Anthropic-compatible API
- 📊 **Real-time UI** - React-based Kanban board with live progress streaming
- 🔒 **Security-first** - Bash command allowlist with defense-in-depth approach (sandbox + permissions + hooks)
- ⚡ **YOLO Mode** - Rapid prototyping without browser testing
- 💾 **Persistent Progress** - SQLite-backed feature tracking across sessions
- 👁️ **Browser Automation** - Playwright MCP server for real browser testing (standard mode)

## Quick Start

### Prerequisites

Install the Claude Code CLI (the harness drives it):

```bash
# macOS / Linux
curl -fsSL https://claude.ai/install.sh | bash

# Windows (PowerShell)
irm https://claude.ai/install.ps1 | iex
```

Authenticate with `claude login` (the SDK auto-detects credentials from `~/.claude/.credentials.json`).

### Configure the GLM API key

Copy `.env.example` to `.env` and set your Z.AI key:

```bash
cp .env.example .env
# edit .env →  ZAI_API_KEY=your-zai-key
```

The agent will route all model calls to `https://api.z.ai/api/anthropic` using your GLM key. (You can alternatively set `ANTHROPIC_API_KEY`; a `ZAI_API_KEY` takes precedence.)

### Run the Agent

**Web UI (Recommended):**
```bash
# Windows
start_ui.bat

# macOS / Linux
./start_ui.sh
```

**CLI Mode:**
```bash
# Windows
start.bat

# macOS / Linux
./start.sh
```

Both launchers create a `venv`, install `requirements.txt`, and start the agent.

## How It Works

1. **Initializer Agent** - Reads `prompts/app_spec.txt`, generates features in SQLite
2. **Coding Agent** - Implements features one-by-one, marks them passing
3. **Session Persistence** - Auto-continues with 3-second delay between sessions

### Model Mapping

The harness accepts a Claude-style model string, but the actual model routed to is set by environment variables:

| Claude-facing name | GLM model actually used |
|---|---|
| HAIKU (`claude-*-haiku-*`) | `glm-4.5-air` |
| SONNET (`claude-*-sonnet-*`) | `glm-4.7` |
| OPUS (`claude-*-opus-*`) | `glm-4.7` |

Environment settings applied in `client.py`:

| Variable | Value |
|---|---|
| `ANTHROPIC_BASE_URL` | `https://api.z.ai/api/anthropic` |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `glm-4.5-air` |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | `glm-4.7` |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | `glm-4.7` |
| `API_TIMEOUT_MS` | `300000` (5 min) |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | `1` |

### Feature MCP Tools

The agent manages features via MCP server tools:
- `feature_get_next` - Get highest-priority pending feature
- `feature_mark_passing` - Mark feature complete
- `feature_get_for_regression` - Random passing features for testing
- `feature_skip` - Move feature to end of queue

## CLI Usage (autonomous_agent_demo.py)

For direct, scripted runs:

```bash
# Absolute path (or a name registered in the SQLite registry)
python autonomous_agent_demo.py --project-dir my-app

# Limit iterations for testing
python autonomous_agent_demo.py --project-dir my-app --max-iterations 5

# YOLO mode: rapid prototyping without browser testing
python autonomous_agent_demo.py --project-dir my-app --yolo

# Specify a GLM API key inline (overrides .env)
python autonomous_agent_demo.py --project-dir my-app --api-key your-zai-key

# Choose a model
python autonomous_agent_demo.py --project-dir my-app --model claude-sonnet-4-5-20250929
```

The default model is `claude-opus-4-5-20251101` (routed to `glm-4.7`).

## Project Structure

```
├── agent.py              # Session loop using Claude Agent SDK
├── client.py             # ClaudeSDKClient with GLM routing + security hooks
├── security.py           # Bash command allowlist
├── registry.py           # SQLite-backed project registry
├── progress.py           # Feature progress tracking / summaries
├── prompts.py            # Initializer / coding prompt builders
├── api/database.py       # SQLAlchemy Feature model
├── mcp_server/           # MCP server for feature tools
├── server/               # FastAPI backend (REST + WebSocket)
└── ui/                   # React + TypeScript + Tailwind v4
```

A full migration plan (native `zai-sdk` integration, replacing the Anthropic-compatible shim) is documented in [MIGRATION_CLAUDE_TO_GLM.md](MIGRATION_CLAUDE_TO_GLM.md).

## Development

### Backend
```bash
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python start.py
```

### Frontend
```bash
cd ui
npm install
npm run dev      # Development
npm run build    # Production build
```

## Security

Commands are validated against the allowlist in `security.py` using a **defense-in-depth** approach (3 layers):

1. **Sandbox** - OS-level bash command isolation prevents filesystem escape
2. **Permissions** - File operations restricted to `project_dir` only
3. **Security hooks** - `PreToolUse` hooks validate every Bash command against the allowlist

Allowed commands include: file inspection (`ls`, `cat`, `head`, `tail`, `grep`, `wc`), file ops (`cp`, `mkdir`, `mv`, `rm`, `touch`, `sh`, `bash`, `init.sh`), Node.js (`npm`, `npx`, `pnpm`, `node`), version control (`git`), Docker, process management (`ps`, `lsof`, `sleep`, `kill`, `pkill`), and networking (`curl`). Commands that need extra scrutiny (`pkill`, `chmod`, `init.sh`) get additional validation.

## License

MIT License — see [LICENSE](LICENSE) for details.

## Credits

This project is inspired by and builds upon:
- **[leonvanzyl/autocoder](https://github.com/leonvanzyl/autocoder)** by [Leon van Zyl](https://github.com/leonvanzyl) - Original autonomous coding agent implementation
- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk) by Anthropic
- [Z.AI](https://api.z.ai/) - GLM model serving via Anthropic-compatible API
