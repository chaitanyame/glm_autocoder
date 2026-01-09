"""
GLM Model Integration
"""
import logging
import requests
from typing import List, Dict, Optional, Any
from .config import Config

logger = logging.getLogger(__name__)


class GLMModel:
    """GLM Model Interface for chat completions"""
    
    def __init__(self, config: Optional[Config] = None):
        """
        Initialize GLM Model
        
        Args:
            config: Configuration object
        """
        from .config import get_config
        self.config = config or get_config()
        self.api_key = self.config.glm_api_key
        self.api_url = self.config.glm_api_url
        self.model = self.config.glm_model
        
        if not self.api_key:
            logger.warning("GLM API key not provided. Set GLM_API_KEY environment variable.")
    
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate chat completion using GLM model
        
        Args:
            messages: List of message dictionaries with 'role' and 'content'
            temperature: Temperature for response generation
            max_tokens: Maximum tokens in response
            **kwargs: Additional parameters
            
        Returns:
            Response dictionary with completion
        """
        if not self.api_key:
            raise ValueError("GLM API key is required")
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature or self.config.temperature,
            "max_tokens": max_tokens or self.config.max_tokens,
            **kwargs
        }
        
        try:
            response = requests.post(
                f"{self.api_url}chat/completions",
                headers=headers,
                json=payload,
                timeout=60
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"GLM API request failed: {e}")
            raise
    
    def stream_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ):
        """
        Stream chat completion using GLM model
        
        Args:
            messages: List of message dictionaries with 'role' and 'content'
            temperature: Temperature for response generation
            max_tokens: Maximum tokens in response
            **kwargs: Additional parameters
            
        Yields:
            Response chunks
        """
        if not self.api_key:
            raise ValueError("GLM API key is required")
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature or self.config.temperature,
            "max_tokens": max_tokens or self.config.max_tokens,
            "stream": True,
            **kwargs
        }
        
        try:
            response = requests.post(
                f"{self.api_url}chat/completions",
                headers=headers,
                json=payload,
                stream=True,
                timeout=60
            )
            response.raise_for_status()
            
            for line in response.iter_lines():
                if line:
                    line_text = line.decode('utf-8')
                    if line_text.startswith('data: '):
                        data = line_text[6:]
                        if data.strip() != '[DONE]':
                            import json
                            yield json.loads(data)
        except requests.exceptions.RequestException as e:
            logger.error(f"GLM API streaming request failed: {e}")
            raise
    
    def extract_response_text(self, response: Dict[str, Any]) -> str:
        """
        Extract text from GLM response
        
        Args:
            response: GLM API response
            
        Returns:
            Extracted text content
        """
        try:
            return response['choices'][0]['message']['content']
        except (KeyError, IndexError) as e:
            logger.error(f"Failed to extract response text: {e}")
            return ""
