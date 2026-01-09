# Migration Document: Claude SDK to GLM (Z.AI)

## Executive Summary

This document outlines the migration strategy for replacing the `claude-agent-sdk` with GLM (Generative Language Model) via the Z.AI Python SDK (`zai-sdk`). The goal is to leverage the existing "Claude Code harness" (autonomous agent framework) while using GLM models as the backend.

---

## Current Architecture Analysis

### Claude SDK Usage Points

| File | Usage | Description |
|------|-------|-------------|
| [client.py](client.py) | `ClaudeSDKClient`, `ClaudeAgentOptions`, `HookMatcher` | Main client configuration with security hooks, MCP servers |
| [agent.py](agent.py#L14) | `ClaudeSDKClient` | Agent session runner with streaming responses |
| [assistant_chat_session.py](server/services/assistant_chat_session.py#L20) | `ClaudeSDKClient`, `ClaudeAgentOptions` | Read-only assistant chat |
| [spec_chat_session.py](server/services/spec_chat_session.py#L17) | `ClaudeSDKClient`, `ClaudeAgentOptions` | Spec creation workflow |
| [requirements.txt](requirements.txt) | `claude-agent-sdk>=0.1.0` | Package dependency |

### Key Claude SDK Features Currently Used

1. **Agentic Loop with Tools** - `ClaudeSDKClient` runs an autonomous agent loop
2. **MCP Servers** - Custom tool servers (features, playwright)
3. **Security Hooks** - Pre-tool-use validation (`HookMatcher`, `bash_security_hook`)
4. **Streaming Responses** - Async iteration over `AssistantMessage`, `ToolUseBlock`, `ToolResultBlock`
5. **Permission System** - Sandbox, file permissions, tool allowlists
6. **System Prompts** - Custom prompts per session type
7. **CLI Integration** - Uses system `claude` CLI path

### Current Environment Variables (GLM Support Already Partially Implemented)

```python
# In client.py - GLM proxy already configured
env_settings = {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "API_TIMEOUT_MS": "3000000",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.5-air",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.7",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.7",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": 1,
}
```

> **Key Insight**: The project already uses an Anthropic-compatible proxy to route requests to GLM. This is a shim approach, not a native GLM SDK integration.

---

## Migration Options

### Option A: Continue with Anthropic-Compatible Proxy (Current Approach)
**Status**: Partially implemented

Keep using `claude-agent-sdk` but route API calls through `https://api.z.ai/api/anthropic`.

**Pros:**
- Minimal code changes required
- Existing agent harness works unchanged
- MCP servers, hooks, and permissions continue working

**Cons:**
- Dependency on proxy compatibility
- Limited to features that Anthropic API exposes
- No access to GLM-specific features (thinking mode, vision-specific APIs)
- Potential API compatibility issues as either SDK evolves

---

### Option B: Native GLM SDK with Custom Agent Harness
**Status**: Requires significant refactoring

Replace `claude-agent-sdk` with `zai-sdk` and rebuild the agent harness.

**Pros:**
- Direct GLM access, no proxy dependency
- Access to GLM-specific features (thinking mode, web search tool, video generation)
- Better long-term maintainability
- Lower latency (no proxy hop)

**Cons:**
- Major refactoring effort
- Need to reimplement:
  - Agentic tool loop
  - MCP server integration
  - Security hooks
  - Streaming response handling
  - File/Bash sandbox

---

## Detailed Migration Plan (Option B - Recommended)

### Phase 1: SDK Replacement (Estimated: 1-2 days)

#### 1.1 Update Dependencies

```diff
# requirements.txt
- claude-agent-sdk>=0.1.0
+ zai-sdk>=0.1.0
```

#### 1.2 Create GLM Client Abstraction

Create a new `glm_client.py` to wrap the Z.AI SDK:

```python
from zai import ZaiClient
import os

class GLMAgentClient:
    """GLM-based agent client that mimics ClaudeSDKClient interface."""
    
    def __init__(
        self,
        model: str = "glm-4.7",
        system_prompt: str = "",
        api_key: str | None = None,
        tools: list[dict] | None = None,
    ):
        self.client = ZaiClient(
            api_key=api_key or os.getenv("ZAI_API_KEY"),
            base_url="https://api.z.ai/api/paas/v4/"
        )
        self.model = model
        self.system_prompt = system_prompt
        self.tools = tools or []
        self.messages: list[dict] = []
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, *args):
        pass
    
    async def query(self, message: str):
        """Send a message to the GLM model."""
        self.messages.append({"role": "user", "content": message})
    
    async def receive_response(self):
        """Stream response from GLM with tool handling."""
        # Implementation needed - see Phase 2
        pass
```

### Phase 2: Rebuild Agent Loop (Estimated: 3-5 days)

The `claude-agent-sdk` provides a complete agentic loop. With native GLM, we must implement:

#### 2.1 Tool Definition Format

```python
# Claude SDK format → GLM format
# Claude uses MCP tools, GLM uses function calling

GLM_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "Read",
            "description": "Read a file's contents",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path to file"}
                },
                "required": ["file_path"]
            }
        }
    },
    # ... more tools
]
```

#### 2.2 Tool Execution Loop

```python
async def run_agent_loop(self, initial_prompt: str):
    """Main agentic loop with tool calling."""
    self.messages = [
        {"role": "system", "content": self.system_prompt},
        {"role": "user", "content": initial_prompt}
    ]
    
    while True:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=self.messages,
            tools=self.tools,
            tool_choice="auto",
            stream=True
        )
        
        # Process streaming response
        assistant_content = ""
        tool_calls = []
        
        for chunk in response:
            if chunk.choices[0].delta.content:
                assistant_content += chunk.choices[0].delta.content
                yield {"type": "text", "content": chunk.choices[0].delta.content}
            
            if chunk.choices[0].delta.tool_calls:
                tool_calls.extend(chunk.choices[0].delta.tool_calls)
        
        # Add assistant message
        self.messages.append({
            "role": "assistant",
            "content": assistant_content,
            "tool_calls": tool_calls
        })
        
        # Execute tools if any
        if not tool_calls:
            break  # No more tools, done
            
        for tool_call in tool_calls:
            result = await self.execute_tool(tool_call)
            self.messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result
            })
```

### Phase 3: MCP Server Adaptation (Estimated: 2-3 days)

MCP (Model Context Protocol) servers currently run as subprocess servers. We have two options:

#### Option 3A: Convert MCP to Native Functions

Convert `mcp_server/feature_mcp.py` tools to Python functions:

```python
# Before: MCP server exposes tools via stdio protocol
# After: Direct Python function calls

from api.database import get_feature_stats, get_next_feature, mark_feature_passing

async def execute_tool(self, tool_call) -> str:
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)
    
    if name == "feature_get_stats":
        return json.dumps(get_feature_stats(self.project_dir))
    elif name == "feature_get_next":
        return json.dumps(get_next_feature(self.project_dir))
    elif name == "feature_mark_passing":
        return json.dumps(mark_feature_passing(args["feature_id"]))
    # ... more tools
```

#### Option 3B: Keep MCP with Protocol Adapter

Create an adapter that calls MCP servers and returns results:

```python
import subprocess
import json

class MCPServerAdapter:
    def __init__(self, server_command: list[str], env: dict):
        self.process = subprocess.Popen(
            server_command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            env=env
        )
    
    async def call_tool(self, name: str, args: dict) -> str:
        request = {"method": "tools/call", "params": {"name": name, "arguments": args}}
        self.process.stdin.write(json.dumps(request) + "\n")
        self.process.stdin.flush()
        response = self.process.stdout.readline()
        return json.loads(response)
```

### Phase 4: Security Hooks Migration (Estimated: 1 day)

Move security validation from SDK hooks to tool execution layer:

```python
from security import validate_bash_command, ALLOWED_COMMANDS

async def execute_tool(self, tool_call) -> str:
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)
    
    # Security: Validate Bash commands before execution
    if name == "Bash":
        command = args.get("command", "")
        is_valid, error = validate_bash_command(command)
        if not is_valid:
            return json.dumps({"error": f"Command blocked: {error}"})
    
    # Execute the tool
    return await self._execute_tool_impl(name, args)
```

### Phase 5: Streaming Integration (Estimated: 1 day)

Update agent.py to use GLM streaming:

```python
# Current Claude SDK streaming
async for msg in client.receive_response():
    if type(msg).__name__ == "AssistantMessage":
        for block in msg.content:
            if type(block).__name__ == "TextBlock":
                print(block.text)
            elif type(block).__name__ == "ToolUseBlock":
                print(f"[Tool: {block.name}]")

# New GLM streaming
async for chunk in glm_client.stream_response():
    if chunk["type"] == "text":
        print(chunk["content"], end="")
    elif chunk["type"] == "tool_call":
        print(f"[Tool: {chunk['name']}]")
```

---

## Model Mapping

| Current Claude Model | GLM Equivalent | Use Case |
|---------------------|----------------|----------|
| `claude-opus-4-5-20251101` | `glm-4.7` | Main coding agent, spec creation |
| `claude-sonnet-4-5-*` | `glm-4.7` | General tasks |
| `claude-haiku-*` | `glm-4.5-air` | Fast, lightweight tasks |

---

## Pros and Cons Summary

### Pros of Migration to GLM

1. **Cost Efficiency** - GLM pricing: ~1/7 cost of Claude for similar capabilities
2. **Performance** - Direct API calls, no proxy overhead
3. **GLM-Specific Features**:
   - Thinking Mode (`glm-4.7` with reasoning)
   - Web Search Tool (built-in)
   - Vision Language Models (`GLM-4.6V`)
   - Video Generation (`CogVideoX-3`)
4. **API Stability** - Native SDK maintained by Z.AI
5. **Regional Availability** - Better availability in certain regions

### Cons of Migration

1. **Development Effort** - 1-2 weeks for full migration
2. **Feature Parity Gaps**:
   - No direct MCP server protocol support
   - No built-in sandbox/permission system
   - No native security hooks
3. **Testing Overhead** - All agent behaviors need re-validation
4. **Dependency Risk** - Single vendor dependency on Z.AI
5. **Documentation** - Less mature ecosystem compared to Claude

---

## Risks Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Tool calling behavior differs | High | Comprehensive testing, prompt engineering |
| MCP server integration breaks | Medium | Option 3A (convert to native functions) |
| Security bypass in custom agent loop | High | Code review, security audit, same allowlist approach |
| Response quality/format changes | Medium | Prompt tuning, output parsing updates |
| Streaming API differences | Low | Abstraction layer handles differences |
| API rate limits/quotas differ | Medium | Implement rate limiting, exponential backoff |
| Model context window limits | Low | GLM-4.7 supports 128K context, sufficient |

---

## Recommended Migration Path

### Short-term (Now)
Continue with **Option A** (Anthropic-compatible proxy). This is already working and requires no changes.

### Medium-term (1-2 months)
Implement **Option B** in a feature branch:
1. Create abstraction layer (`glm_client.py`)
2. Implement tool execution loop
3. Convert MCP tools to native functions
4. Port security validation
5. A/B test both implementations

### Long-term
Complete migration to native GLM SDK with:
- Feature flag to switch between backends
- Gradual rollout with monitoring
- Deprecate Claude SDK dependency

---

## File Changes Summary

| File | Action | Effort |
|------|--------|--------|
| `requirements.txt` | Replace `claude-agent-sdk` with `zai-sdk` | Low |
| `client.py` | Rewrite with `GLMAgentClient` class | High |
| `agent.py` | Update streaming/tool handling | Medium |
| `server/services/assistant_chat_session.py` | Use new client abstraction | Medium |
| `server/services/spec_chat_session.py` | Use new client abstraction | Medium |
| `security.py` | Move to tool execution layer | Low |
| `mcp_server/feature_mcp.py` | Convert to direct functions | Medium |
| **New**: `glm_client.py` | Create GLM agent abstraction | High |
| **New**: `tools/builtin.py` | Implement Read/Write/Edit/Bash tools | High |

---

## Conclusion

The migration from Claude SDK to GLM is **feasible but significant**. The current proxy approach (`ANTHROPIC_BASE_URL = https://api.z.ai/api/anthropic`) already enables GLM usage with minimal changes.

For a **production-grade native integration**, budget 1-2 weeks of development effort. The main challenge is rebuilding the agentic tool loop and MCP integration that `claude-agent-sdk` provides out of the box.

**Recommendation**: Continue with the proxy approach for now. Plan native migration when:
1. You need GLM-specific features (thinking mode, web search)
2. The proxy introduces latency/reliability issues
3. Cost savings justify the development investment
