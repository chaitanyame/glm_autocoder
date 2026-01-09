"""
GLM Autocoder - Long Running Sessions with GLM Model using Claude Code Harness Framework
"""

__version__ = "0.1.0"

from .session_manager import SessionManager
from .glm_model import GLMModel
from .claude_harness import ClaudeCodeHarness

__all__ = ["SessionManager", "GLMModel", "ClaudeCodeHarness"]
