"""
Rate Limit State Manager
========================

Manages persistence of rate limit state and auto-resume scheduling.
State is stored in ~/.autocoder/rate_limit_state.json for container restart recovery.
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional

logger = logging.getLogger(__name__)


def _get_state_file_path() -> Path:
    """Get the path to the rate limit state file."""
    # In Docker, use /root/.autocoder
    # Otherwise use ~/.autocoder
    if os.path.exists("/root"):
        base_dir = Path("/root/.autocoder")
    else:
        base_dir = Path.home() / ".autocoder"
    
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir / "rate_limit_state.json"


class RateLimitState:
    """
    Manages global rate limit state.
    
    The API rate limit is account-wide, so when one project hits the limit,
    all projects should pause until reset.
    """
    
    def __init__(self):
        self.is_rate_limited: bool = False
        self.reset_time: Optional[datetime] = None
        self.reset_time_str: Optional[str] = None
        self._resume_task: Optional[asyncio.Task] = None
        self._resume_callbacks: list[Callable[[], None]] = []
        self._load_state()
    
    def _load_state(self) -> None:
        """Load persisted state from disk."""
        state_file = _get_state_file_path()
        if state_file.exists():
            try:
                with open(state_file, 'r') as f:
                    data = json.load(f)
                    self.reset_time_str = data.get("reset_time")
                    if self.reset_time_str:
                        self.reset_time = datetime.fromisoformat(self.reset_time_str)
                        # Check if still rate limited
                        if self.reset_time > datetime.now():
                            self.is_rate_limited = True
                            logger.info(f"Restored rate limit state, reset at {self.reset_time_str}")
                        else:
                            # Reset time has passed
                            self._clear_state_file()
            except Exception as e:
                logger.warning(f"Failed to load rate limit state: {e}")
    
    def _save_state(self) -> None:
        """Persist state to disk for container restart recovery."""
        state_file = _get_state_file_path()
        try:
            with open(state_file, 'w') as f:
                json.dump({
                    "reset_time": self.reset_time_str,
                    "is_rate_limited": self.is_rate_limited,
                }, f)
        except Exception as e:
            logger.warning(f"Failed to save rate limit state: {e}")
    
    def _clear_state_file(self) -> None:
        """Remove the state file."""
        state_file = _get_state_file_path()
        try:
            if state_file.exists():
                state_file.unlink()
        except Exception as e:
            logger.warning(f"Failed to clear rate limit state file: {e}")
    
    def set_rate_limited(self, reset_time_str: str) -> None:
        """
        Set rate limited state with reset time.
        
        Args:
            reset_time_str: Reset time in format "YYYY-MM-DD HH:MM:SS"
        """
        self.is_rate_limited = True
        self.reset_time_str = reset_time_str
        
        try:
            # Parse reset time
            self.reset_time = datetime.fromisoformat(reset_time_str)
        except ValueError:
            # If parsing fails, default to 60 seconds from now
            logger.warning(f"Failed to parse reset time: {reset_time_str}, defaulting to 60s")
            self.reset_time = datetime.now()
            self.reset_time_str = None
        
        self._save_state()
        logger.info(f"Rate limited until {self.reset_time_str}")
    
    def clear_rate_limit(self) -> None:
        """Clear rate limit state."""
        self.is_rate_limited = False
        self.reset_time = None
        self.reset_time_str = None
        self._clear_state_file()
        
        # Cancel any pending resume task
        if self._resume_task and not self._resume_task.done():
            self._resume_task.cancel()
            self._resume_task = None
        
        logger.info("Rate limit cleared")
    
    def get_seconds_until_reset(self) -> int:
        """Get seconds until rate limit resets."""
        if not self.reset_time:
            return 0
        delta = self.reset_time - datetime.now()
        return max(0, int(delta.total_seconds()))
    
    def register_resume_callback(self, callback: Callable[[], None]) -> None:
        """Register a callback to be called when rate limit resets."""
        self._resume_callbacks.append(callback)
    
    async def schedule_auto_resume(self) -> None:
        """Schedule auto-resume when rate limit resets."""
        if not self.is_rate_limited or not self.reset_time:
            return
        
        seconds = self.get_seconds_until_reset()
        if seconds <= 0:
            # Reset time already passed
            self._trigger_resume()
            return
        
        # Add 5 second buffer after reset
        wait_seconds = seconds + 5
        
        logger.info(f"Scheduling auto-resume in {wait_seconds} seconds")
        
        async def _wait_and_resume():
            try:
                await asyncio.sleep(wait_seconds)
                self._trigger_resume()
            except asyncio.CancelledError:
                logger.info("Auto-resume cancelled")
        
        self._resume_task = asyncio.create_task(_wait_and_resume())
    
    def _trigger_resume(self) -> None:
        """Trigger all resume callbacks."""
        self.clear_rate_limit()
        for callback in self._resume_callbacks:
            try:
                callback()
            except Exception as e:
                logger.warning(f"Resume callback failed: {e}")
    
    def cancel_auto_resume(self) -> bool:
        """
        Cancel scheduled auto-resume.
        
        Returns:
            True if cancelled, False if nothing to cancel
        """
        if self._resume_task and not self._resume_task.done():
            self._resume_task.cancel()
            self._resume_task = None
            logger.info("Auto-resume cancelled by user")
            return True
        return False
    
    def to_dict(self) -> dict:
        """Convert state to dictionary for API response."""
        return {
            "is_rate_limited": self.is_rate_limited,
            "reset_time": self.reset_time_str,
            "seconds_until_reset": self.get_seconds_until_reset(),
        }


# Global singleton instance
_rate_limit_state: Optional[RateLimitState] = None


def get_rate_limit_state() -> RateLimitState:
    """Get the global rate limit state instance."""
    global _rate_limit_state
    if _rate_limit_state is None:
        _rate_limit_state = RateLimitState()
    return _rate_limit_state
