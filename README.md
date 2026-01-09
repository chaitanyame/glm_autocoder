# AutoCoder

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An autonomous coding agent powered by the Claude Agent SDK. Build complete applications over multiple sessions using a two-agent pattern with real-time progress monitoring.

> **Inspired by [leonvanzyl/autocoder](https://github.com/leonvanzyl/autocoder)** - Credits to [Leon van Zyl](https://github.com/leonvanzyl) for the original implementation.

## Features

- 🤖 **Two-Agent Pattern** - Initializer creates features, Coding Agent implements them
- 📊 **Real-time UI** - React-based Kanban board with live progress streaming
- 🔒 **Security-first** - Bash command allowlist with defense-in-depth approach
- ⚡ **YOLO Mode** - Rapid prototyping without browser testing
- 💾 **Persistent Progress** - SQLite-backed feature tracking across sessions

## Quick Start

### Prerequisites

Install the Claude Code CLI:

```bash
# macOS / Linux
curl -fsSL https://claude.ai/install.sh | bash

# Windows (PowerShell)
irm https://claude.ai/install.ps1 | iex
```

Authenticate with `claude login` (Claude Pro/Max) or set an Anthropic API key.

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

## How It Works

1. **Initializer Agent** - Reads `prompts/app_spec.txt`, generates features in SQLite
2. **Coding Agent** - Implements features one-by-one, marks them passing
3. **Session Persistence** - Auto-continues with 3-second delay between sessions

### Feature MCP Tools

The agent manages features via MCP server tools:
- `feature_get_next` - Get highest-priority pending feature
- `feature_mark_passing` - Mark feature complete
- `feature_get_for_regression` - Random passing features for testing
- `feature_skip` - Move feature to end of queue

## Project Structure

```
├── agent.py              # Session loop using Claude Agent SDK
├── client.py             # ClaudeSDKClient with security hooks
├── security.py           # Bash command allowlist
├── api/database.py       # SQLAlchemy Feature model
├── mcp_server/           # MCP server for feature tools
├── server/               # FastAPI backend (REST + WebSocket)
└── ui/                   # React + TypeScript + Tailwind v4
```

## YOLO Mode

Skip browser testing for rapid prototyping:

```bash
python autonomous_agent_demo.py --project-dir my-app --yolo
```

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

Commands validated against allowlist in `security.py`:
- File ops: `ls`, `cat`, `head`, `tail`, `grep`
- Node.js: `npm`, `npx`, `node`
- Git: `git`
- Process: `ps`, `lsof`, `pkill` (dev processes only)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

This project is inspired by and builds upon:
- **[leonvanzyl/autocoder](https://github.com/leonvanzyl/autocoder)** by [Leon van Zyl](https://github.com/leonvanzyl) - Original autonomous coding agent implementation
- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk) by Anthropic
