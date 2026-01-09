"""
Claude Code Harness Integration
"""
import logging
from typing import List, Dict, Optional, Any
from anthropic import Anthropic
from .config import Config

logger = logging.getLogger(__name__)


class ClaudeCodeHarness:
    """Claude Code Harness for code generation and review"""
    
    def __init__(self, config: Optional[Config] = None):
        """
        Initialize Claude Code Harness
        
        Args:
            config: Configuration object
        """
        from .config import get_config
        self.config = config or get_config()
        
        if not self.config.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is required. Set it in environment variables.")
        
        self.client = Anthropic(api_key=self.config.anthropic_api_key)
        self.model = self.config.claude_model
    
    def generate_code(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> str:
        """
        Generate code using Claude
        
        Args:
            prompt: User prompt for code generation
            system_prompt: System prompt to guide generation
            temperature: Temperature for response generation
            max_tokens: Maximum tokens in response
            **kwargs: Additional parameters
            
        Returns:
            Generated code as string
        """
        messages = [{"role": "user", "content": prompt}]
        
        create_kwargs = {
            "model": self.model,
            "max_tokens": max_tokens or self.config.max_tokens,
            "messages": messages,
            **kwargs
        }
        
        if system_prompt:
            create_kwargs["system"] = system_prompt
        
        if temperature is not None:
            create_kwargs["temperature"] = temperature
        elif self.config.temperature:
            create_kwargs["temperature"] = self.config.temperature
        
        try:
            response = self.client.messages.create(**create_kwargs)
            return response.content[0].text
        except Exception as e:
            logger.error(f"Claude API request failed: {e}")
            raise
    
    def review_code(
        self,
        code: str,
        language: str = "python",
        focus_areas: Optional[List[str]] = None
    ) -> str:
        """
        Review code using Claude
        
        Args:
            code: Code to review
            language: Programming language
            focus_areas: Specific areas to focus on (e.g., security, performance)
            
        Returns:
            Code review feedback
        """
        focus = ", ".join(focus_areas) if focus_areas else "general code quality"
        
        prompt = f"""Please review the following {language} code with focus on {focus}:

```{language}
{code}
```

Provide detailed feedback on:
1. Code quality and best practices
2. Potential bugs or issues
3. Security concerns
4. Performance improvements
5. Suggestions for refactoring
"""
        
        system_prompt = "You are an expert code reviewer. Provide constructive, detailed feedback."
        
        return self.generate_code(prompt, system_prompt=system_prompt)
    
    def chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Send messages to Claude for chat completion
        
        Args:
            messages: List of message dictionaries with 'role' and 'content'
            system_prompt: System prompt to guide conversation
            temperature: Temperature for response generation
            max_tokens: Maximum tokens in response
            **kwargs: Additional parameters
            
        Returns:
            Response dictionary
        """
        create_kwargs = {
            "model": self.model,
            "max_tokens": max_tokens or self.config.max_tokens,
            "messages": messages,
            **kwargs
        }
        
        if system_prompt:
            create_kwargs["system"] = system_prompt
        
        if temperature is not None:
            create_kwargs["temperature"] = temperature
        elif self.config.temperature:
            create_kwargs["temperature"] = self.config.temperature
        
        try:
            response = self.client.messages.create(**create_kwargs)
            return {
                "id": response.id,
                "model": response.model,
                "role": response.role,
                "content": response.content[0].text,
                "stop_reason": response.stop_reason,
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens
                }
            }
        except Exception as e:
            logger.error(f"Claude chat request failed: {e}")
            raise
    
    def stream_chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ):
        """
        Stream chat responses from Claude
        
        Args:
            messages: List of message dictionaries with 'role' and 'content'
            system_prompt: System prompt to guide conversation
            temperature: Temperature for response generation
            max_tokens: Maximum tokens in response
            **kwargs: Additional parameters
            
        Yields:
            Response chunks
        """
        create_kwargs = {
            "model": self.model,
            "max_tokens": max_tokens or self.config.max_tokens,
            "messages": messages,
            "stream": True,
            **kwargs
        }
        
        if system_prompt:
            create_kwargs["system"] = system_prompt
        
        if temperature is not None:
            create_kwargs["temperature"] = temperature
        elif self.config.temperature:
            create_kwargs["temperature"] = self.config.temperature
        
        try:
            with self.client.messages.stream(**create_kwargs) as stream:
                for text in stream.text_stream:
                    yield text
        except Exception as e:
            logger.error(f"Claude streaming request failed: {e}")
            raise
