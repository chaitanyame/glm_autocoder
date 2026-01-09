"""
Session Manager for Long Running Conversations
"""
import logging
import time
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from .config import Config
from .glm_model import GLMModel
from .claude_harness import ClaudeCodeHarness

logger = logging.getLogger(__name__)


class Session:
    """Individual conversation session"""
    
    def __init__(self, session_id: str, config: Optional[Config] = None):
        """
        Initialize a session
        
        Args:
            session_id: Unique session identifier
            config: Configuration object
        """
        self.session_id = session_id
        self.config = config
        self.messages: List[Dict[str, str]] = []
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        self.metadata: Dict[str, Any] = {}
    
    def add_message(self, role: str, content: str):
        """Add a message to the session"""
        self.messages.append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat()
        })
        self.last_activity = datetime.now()
    
    def get_messages(self, max_length: Optional[int] = None) -> List[Dict[str, str]]:
        """
        Get messages from the session
        
        Args:
            max_length: Maximum number of messages to return (most recent)
            
        Returns:
            List of messages
        """
        messages = [{"role": msg["role"], "content": msg["content"]} 
                   for msg in self.messages]
        
        if max_length and len(messages) > max_length:
            return messages[-max_length:]
        return messages
    
    def is_expired(self, timeout: int) -> bool:
        """
        Check if session is expired
        
        Args:
            timeout: Timeout in seconds
            
        Returns:
            True if expired, False otherwise
        """
        return (datetime.now() - self.last_activity) > timedelta(seconds=timeout)
    
    def clear(self):
        """Clear all messages in the session"""
        self.messages = []
        self.last_activity = datetime.now()


class SessionManager:
    """Manage multiple long-running sessions"""
    
    def __init__(self, config: Optional[Config] = None):
        """
        Initialize Session Manager
        
        Args:
            config: Configuration object
        """
        from .config import get_config
        self.config = config or get_config()
        self.sessions: Dict[str, Session] = {}
        self.glm_model = GLMModel(self.config)
        self.claude_harness = ClaudeCodeHarness(self.config)
    
    def create_session(self, session_id: Optional[str] = None) -> str:
        """
        Create a new session
        
        Args:
            session_id: Optional session ID, will be generated if not provided
            
        Returns:
            Session ID
        """
        if not session_id:
            session_id = f"session_{int(time.time() * 1000)}"
        
        if session_id in self.sessions:
            logger.warning(f"Session {session_id} already exists")
            return session_id
        
        self.sessions[session_id] = Session(session_id, self.config)
        logger.info(f"Created session {session_id}")
        return session_id
    
    def get_session(self, session_id: str) -> Optional[Session]:
        """
        Get a session by ID
        
        Args:
            session_id: Session ID
            
        Returns:
            Session object or None if not found
        """
        return self.sessions.get(session_id)
    
    def delete_session(self, session_id: str) -> bool:
        """
        Delete a session
        
        Args:
            session_id: Session ID
            
        Returns:
            True if deleted, False if not found
        """
        if session_id in self.sessions:
            del self.sessions[session_id]
            logger.info(f"Deleted session {session_id}")
            return True
        return False
    
    def cleanup_expired_sessions(self):
        """Remove expired sessions"""
        expired = [
            sid for sid, session in self.sessions.items()
            if session.is_expired(self.config.session_timeout)
        ]
        
        for sid in expired:
            self.delete_session(sid)
            logger.info(f"Cleaned up expired session {sid}")
    
    def chat_with_glm(
        self,
        session_id: str,
        user_message: str,
        **kwargs
    ) -> str:
        """
        Send a message to GLM model in a session
        
        Args:
            session_id: Session ID
            user_message: User's message
            **kwargs: Additional parameters for GLM
            
        Returns:
            GLM's response
        """
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        # Add user message
        session.add_message("user", user_message)
        
        # Get conversation history
        messages = session.get_messages(self.config.max_conversation_length)
        
        # Get response from GLM
        response = self.glm_model.chat_completion(messages, **kwargs)
        response_text = self.glm_model.extract_response_text(response)
        
        # Add assistant response
        session.add_message("assistant", response_text)
        
        return response_text
    
    def chat_with_claude(
        self,
        session_id: str,
        user_message: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Send a message to Claude in a session
        
        Args:
            session_id: Session ID
            user_message: User's message
            system_prompt: Optional system prompt
            **kwargs: Additional parameters for Claude
            
        Returns:
            Claude's response
        """
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        # Add user message
        session.add_message("user", user_message)
        
        # Get conversation history
        messages = session.get_messages(self.config.max_conversation_length)
        
        # Get response from Claude
        response = self.claude_harness.chat(
            messages, 
            system_prompt=system_prompt,
            **kwargs
        )
        response_text = response["content"]
        
        # Add assistant response
        session.add_message("assistant", response_text)
        
        return response_text
    
    def stream_chat_with_claude(
        self,
        session_id: str,
        user_message: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ):
        """
        Stream chat with Claude in a session
        
        Args:
            session_id: Session ID
            user_message: User's message
            system_prompt: Optional system prompt
            **kwargs: Additional parameters for Claude
            
        Yields:
            Response chunks
        """
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        # Add user message
        session.add_message("user", user_message)
        
        # Get conversation history
        messages = session.get_messages(self.config.max_conversation_length)
        
        # Stream response from Claude
        full_response = ""
        for chunk in self.claude_harness.stream_chat(
            messages,
            system_prompt=system_prompt,
            **kwargs
        ):
            full_response += chunk
            yield chunk
        
        # Add complete assistant response
        session.add_message("assistant", full_response)
    
    def list_sessions(self) -> List[Dict[str, Any]]:
        """
        List all active sessions
        
        Returns:
            List of session information
        """
        return [
            {
                "session_id": sid,
                "created_at": session.created_at.isoformat(),
                "last_activity": session.last_activity.isoformat(),
                "message_count": len(session.messages),
                "metadata": session.metadata
            }
            for sid, session in self.sessions.items()
        ]
