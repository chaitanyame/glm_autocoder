"""
Configuration management for GLM Autocoder
"""
import os
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Config(BaseModel):
    """Configuration for GLM Autocoder"""
    
    # API Keys
    anthropic_api_key: str = Field(
        default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", ""),
        description="Anthropic API key for Claude"
    )
    
    glm_api_key: Optional[str] = Field(
        default_factory=lambda: os.getenv("GLM_API_KEY"),
        description="GLM API key (if required)"
    )
    
    glm_api_url: str = Field(
        default_factory=lambda: os.getenv("GLM_API_URL", "https://open.bigmodel.cn/api/paas/v4/"),
        description="GLM API endpoint URL"
    )
    
    # Model Configuration
    claude_model: str = Field(
        default="claude-3-5-sonnet-20241022",
        description="Claude model to use"
    )
    
    glm_model: str = Field(
        default="glm-4-plus",
        description="GLM model to use"
    )
    
    # Session Configuration
    max_tokens: int = Field(
        default=4096,
        description="Maximum tokens per request"
    )
    
    temperature: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Temperature for response generation"
    )
    
    session_timeout: int = Field(
        default=3600,
        description="Session timeout in seconds (default: 1 hour)"
    )
    
    max_conversation_length: int = Field(
        default=50,
        description="Maximum number of messages in conversation history"
    )
    
    # Logging
    log_level: str = Field(
        default="INFO",
        description="Logging level"
    )
    
    log_file: Optional[str] = Field(
        default=None,
        description="Path to log file"
    )
    
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8"
    )


def get_config() -> Config:
    """Get configuration instance"""
    return Config()
