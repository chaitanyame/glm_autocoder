# GLM Autocoder

A Python framework for running long-running sessions with GLM (Generative Language Model) and Claude Code Harness for code generation, review, and interactive programming assistance.

## Features

- **Long-Running Sessions**: Maintain conversation context across multiple interactions
- **Dual Model Support**: Integration with both GLM and Claude (Anthropic) models
- **Code Generation**: Generate high-quality code using Claude's capabilities
- **Code Review**: Automated code review with detailed feedback
- **Streaming Responses**: Real-time streaming for interactive experiences
- **Session Management**: Create, manage, and cleanup multiple concurrent sessions
- **Flexible Configuration**: Environment-based configuration with sensible defaults

## Installation

1. Clone the repository:
```bash
git clone https://github.com/chaitanyame/glm_autocoder.git
cd glm_autocoder
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
# Create a .env file
echo "ANTHROPIC_API_KEY=your_anthropic_api_key_here" > .env
echo "GLM_API_KEY=your_glm_api_key_here" >> .env  # Optional
```

## Quick Start

### Interactive Mode

Run an interactive chat session with Claude:

```bash
python -m glm_autocoder.main --mode interactive --model claude
```

Or with GLM (if configured):

```bash
python -m glm_autocoder.main --mode interactive --model glm
```

### Code Generation

Generate code from a prompt:

```bash
python -m glm_autocoder.main --mode generate --prompt "Create a REST API using Flask" --output api.py
```

### Code Review

Review existing code:

```bash
python -m glm_autocoder.main --mode review --code-file mycode.py --language python
```

## Programmatic Usage

### Basic Example

```python
from glm_autocoder import SessionManager
from glm_autocoder.config import get_config

# Initialize
config = get_config()
session_manager = SessionManager(config)

# Create a session
session_id = session_manager.create_session()

# Chat with Claude
response = session_manager.chat_with_claude(
    session_id,
    "Write a Python function to sort a list"
)
print(response)

# Continue the conversation
response = session_manager.chat_with_claude(
    session_id,
    "Now add unit tests for that function"
)
print(response)
```

### Streaming Example

```python
# Stream responses for real-time output
for chunk in session_manager.stream_chat_with_claude(
    session_id,
    "Explain how quicksort works"
):
    print(chunk, end="", flush=True)
```

### Using GLM Model

```python
# Chat with GLM (requires GLM_API_KEY)
session_id = session_manager.create_session()
response = session_manager.chat_with_glm(
    session_id,
    "Help me debug this Python code"
)
```

## Configuration

Configuration can be set via environment variables or a `.env` file:

```bash
# Required
ANTHROPIC_API_KEY=your_key_here

# Optional - GLM Configuration
GLM_API_KEY=your_glm_key_here
GLM_API_URL=https://open.bigmodel.cn/api/paas/v4/

# Model Configuration
CLAUDE_MODEL=claude-3-5-sonnet-20241022
GLM_MODEL=glm-4-plus

# Session Configuration
MAX_TOKENS=4096
TEMPERATURE=0.7
SESSION_TIMEOUT=3600
MAX_CONVERSATION_LENGTH=50

# Logging
LOG_LEVEL=INFO
LOG_FILE=glm_autocoder.log
```

## Architecture

The framework consists of several key components:

- **SessionManager**: Manages multiple concurrent sessions with conversation history
- **ClaudeCodeHarness**: Interface to Claude API for code generation and chat
- **GLMModel**: Interface to GLM API for alternative model support
- **Config**: Centralized configuration management using Pydantic
- **Session**: Individual conversation session with message history

## Examples

See the `examples/` directory for more detailed examples:

- `basic_usage.py`: Demonstrates basic features
- `long_session.py`: Shows a long-running multi-task session

## Use Cases

1. **Interactive Coding Assistant**: Get real-time help while coding
2. **Code Generation**: Generate boilerplate, functions, or entire modules
3. **Code Review**: Automated review with focus on quality, security, and performance
4. **Learning Tool**: Interactive explanations and code examples
5. **Pair Programming**: Long-running sessions for complex development tasks

## API Reference

### SessionManager

- `create_session(session_id=None)`: Create a new session
- `get_session(session_id)`: Retrieve a session
- `delete_session(session_id)`: Delete a session
- `chat_with_claude(session_id, message, **kwargs)`: Chat with Claude
- `chat_with_glm(session_id, message, **kwargs)`: Chat with GLM
- `stream_chat_with_claude(session_id, message, **kwargs)`: Stream Claude responses
- `cleanup_expired_sessions()`: Remove expired sessions
- `list_sessions()`: List all active sessions

### ClaudeCodeHarness

- `generate_code(prompt, system_prompt=None, **kwargs)`: Generate code
- `review_code(code, language, focus_areas=None)`: Review code
- `chat(messages, system_prompt=None, **kwargs)`: Chat completion
- `stream_chat(messages, system_prompt=None, **kwargs)`: Streaming chat

### GLMModel

- `chat_completion(messages, **kwargs)`: Get chat completion
- `stream_completion(messages, **kwargs)`: Stream chat completion
- `extract_response_text(response)`: Extract text from response

## Requirements

- Python 3.8+
- anthropic>=0.18.0
- requests>=2.31.0
- python-dotenv>=1.0.0
- pydantic>=2.0.0
- tiktoken>=0.5.0

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on GitHub.