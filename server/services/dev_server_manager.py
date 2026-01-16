"""
Dev Server Manager
==================

Manages development server processes for projects.
Allows the agent to start, stop, and check the status of dev servers.
"""

import asyncio
import logging
import os
import subprocess
import sys
from collections import deque
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class DevServerState:
    """State of a running dev server."""
    process: Optional[subprocess.Popen] = None
    project_dir: Optional[Path] = None
    command: Optional[str] = None
    started_at: Optional[datetime] = None
    url: Optional[str] = None
    logs: deque = field(default_factory=lambda: deque(maxlen=500))
    
    @property
    def is_running(self) -> bool:
        """Check if the server process is still running."""
        if self.process is None:
            return False
        return self.process.poll() is None


class DevServerManager:
    """
    Manages a single dev server per project.
    
    This is designed to be used by the MCP server to give the agent
    control over starting/stopping the development server.
    """
    
    def __init__(self):
        self._servers: dict[str, DevServerState] = {}
        self._log_tasks: dict[str, asyncio.Task] = {}
    
    def _get_project_key(self, project_dir: Path) -> str:
        """Get a unique key for a project."""
        return str(project_dir.resolve())
    
    def _detect_dev_command(self, project_dir: Path) -> tuple[str, str]:
        """
        Detect the appropriate dev server command for a project.
        
        Returns:
            Tuple of (command, expected_url)
        """
        package_json = project_dir / "package.json"
        if package_json.exists():
            try:
                import json
                with open(package_json, "r") as f:
                    pkg = json.load(f)
                    scripts = pkg.get("scripts", {})
                    
                    # Check for common dev scripts
                    if "dev" in scripts:
                        return "npm run dev", "http://localhost:3000"
                    elif "start" in scripts:
                        return "npm start", "http://localhost:3000"
                    elif "serve" in scripts:
                        return "npm run serve", "http://localhost:8080"
            except Exception as e:
                logger.warning(f"Failed to parse package.json: {e}")
        
        # Check for Python projects
        pyproject = project_dir / "pyproject.toml"
        requirements = project_dir / "requirements.txt"
        if pyproject.exists() or requirements.exists():
            # Common Python dev servers
            main_py = project_dir / "main.py"
            app_py = project_dir / "app.py"
            if main_py.exists():
                return "python main.py", "http://localhost:8000"
            elif app_py.exists():
                return "python app.py", "http://localhost:8000"
            # Check for FastAPI/Uvicorn
            if (project_dir / "app" / "main.py").exists():
                return "uvicorn app.main:app --reload", "http://localhost:8000"
        
        # Default fallback
        return "npm run dev", "http://localhost:3000"
    
    async def _read_output(self, project_key: str, process: subprocess.Popen):
        """Read process output and store in logs buffer."""
        state = self._servers.get(project_key)
        if not state or not process.stdout:
            return
        
        try:
            while True:
                line = await asyncio.get_event_loop().run_in_executor(
                    None, process.stdout.readline
                )
                if not line:
                    break
                
                decoded = line.decode("utf-8", errors="replace").rstrip()
                if decoded:
                    timestamp = datetime.now().strftime("%H:%M:%S")
                    state.logs.append(f"[{timestamp}] {decoded}")
                    
                    # Try to detect the URL from output
                    if state.url is None:
                        for pattern in ["http://localhost:", "http://127.0.0.1:"]:
                            if pattern in decoded:
                                # Extract URL
                                import re
                                match = re.search(r'(https?://[^\s]+)', decoded)
                                if match:
                                    state.url = match.group(1)
                                    logger.info(f"Detected dev server URL: {state.url}")
                                break
        except Exception as e:
            logger.error(f"Error reading process output: {e}")
    
    async def start(
        self, 
        project_dir: Path, 
        command: Optional[str] = None
    ) -> dict:
        """
        Start the dev server for a project.
        
        Args:
            project_dir: Path to the project directory
            command: Optional custom command to run
            
        Returns:
            Dict with status info
        """
        project_key = self._get_project_key(project_dir)
        
        # Check if already running
        if project_key in self._servers:
            state = self._servers[project_key]
            if state.is_running:
                return {
                    "status": "already_running",
                    "url": state.url,
                    "message": f"Dev server already running at {state.url}"
                }
        
        # Detect or use provided command
        if command is None:
            command, default_url = self._detect_dev_command(project_dir)
        else:
            default_url = "http://localhost:3000"
        
        try:
            # Start the process
            env = os.environ.copy()
            env["FORCE_COLOR"] = "1"  # Enable colored output
            
            # Use shell on Windows, list on Unix
            if sys.platform == "win32":
                process = subprocess.Popen(
                    command,
                    cwd=str(project_dir),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    shell=True,
                    env=env,
                )
            else:
                process = subprocess.Popen(
                    command.split(),
                    cwd=str(project_dir),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    env=env,
                )
            
            # Create state
            state = DevServerState(
                process=process,
                project_dir=project_dir,
                command=command,
                started_at=datetime.now(),
                url=default_url,
            )
            self._servers[project_key] = state
            
            # Start log reader task
            task = asyncio.create_task(self._read_output(project_key, process))
            self._log_tasks[project_key] = task
            
            # Wait a bit for startup
            await asyncio.sleep(2)
            
            if state.is_running:
                return {
                    "status": "started",
                    "url": state.url,
                    "command": command,
                    "pid": process.pid,
                    "message": f"Dev server started with: {command}"
                }
            else:
                # Process died quickly, get exit code
                return {
                    "status": "failed",
                    "exit_code": process.returncode,
                    "message": f"Dev server exited immediately with code {process.returncode}",
                    "logs": list(state.logs)[-20:]  # Last 20 lines
                }
                
        except Exception as e:
            logger.exception(f"Failed to start dev server: {e}")
            return {
                "status": "error",
                "error": str(e),
                "message": f"Failed to start dev server: {e}"
            }
    
    async def stop(self, project_dir: Path) -> dict:
        """
        Stop the dev server for a project.
        
        Args:
            project_dir: Path to the project directory
            
        Returns:
            Dict with status info
        """
        project_key = self._get_project_key(project_dir)
        
        if project_key not in self._servers:
            return {
                "status": "not_running",
                "message": "No dev server is running for this project"
            }
        
        state = self._servers[project_key]
        
        if not state.is_running:
            # Clean up dead server
            del self._servers[project_key]
            if project_key in self._log_tasks:
                self._log_tasks[project_key].cancel()
                del self._log_tasks[project_key]
            return {
                "status": "not_running",
                "message": "Dev server was not running"
            }
        
        try:
            # Terminate the process
            state.process.terminate()
            
            # Wait for graceful shutdown
            try:
                state.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                # Force kill if needed
                state.process.kill()
                state.process.wait(timeout=2)
            
            # Clean up
            del self._servers[project_key]
            if project_key in self._log_tasks:
                self._log_tasks[project_key].cancel()
                del self._log_tasks[project_key]
            
            return {
                "status": "stopped",
                "message": "Dev server stopped successfully"
            }
            
        except Exception as e:
            logger.exception(f"Failed to stop dev server: {e}")
            return {
                "status": "error",
                "error": str(e),
                "message": f"Failed to stop dev server: {e}"
            }
    
    def get_status(self, project_dir: Path) -> dict:
        """
        Get the status of the dev server for a project.
        
        Args:
            project_dir: Path to the project directory
            
        Returns:
            Dict with status info
        """
        project_key = self._get_project_key(project_dir)
        
        if project_key not in self._servers:
            return {
                "running": False,
                "message": "No dev server is running"
            }
        
        state = self._servers[project_key]
        
        if not state.is_running:
            exit_code = state.process.returncode if state.process else None
            return {
                "running": False,
                "exit_code": exit_code,
                "message": f"Dev server exited with code {exit_code}"
            }
        
        uptime = None
        if state.started_at:
            uptime = (datetime.now() - state.started_at).total_seconds()
        
        return {
            "running": True,
            "url": state.url,
            "command": state.command,
            "pid": state.process.pid if state.process else None,
            "started_at": state.started_at.isoformat() if state.started_at else None,
            "uptime_seconds": uptime,
            "message": f"Dev server running at {state.url}"
        }
    
    def get_logs(self, project_dir: Path, lines: int = 50) -> dict:
        """
        Get recent logs from the dev server.
        
        Args:
            project_dir: Path to the project directory
            lines: Number of recent lines to return
            
        Returns:
            Dict with logs
        """
        project_key = self._get_project_key(project_dir)
        
        if project_key not in self._servers:
            return {
                "logs": [],
                "message": "No dev server is running"
            }
        
        state = self._servers[project_key]
        log_list = list(state.logs)
        
        return {
            "logs": log_list[-lines:] if lines else log_list,
            "total_lines": len(log_list),
            "running": state.is_running,
            "message": f"Showing last {min(lines, len(log_list))} of {len(log_list)} log lines"
        }
    
    async def cleanup(self):
        """Stop all running servers on shutdown."""
        for project_key in list(self._servers.keys()):
            state = self._servers[project_key]
            if state.process and state.is_running:
                try:
                    state.process.terminate()
                    state.process.wait(timeout=2)
                except Exception:
                    try:
                        state.process.kill()
                    except Exception:
                        pass
        
        # Cancel all log tasks
        for task in self._log_tasks.values():
            task.cancel()
        
        self._servers.clear()
        self._log_tasks.clear()


# Global instance
_dev_server_manager: Optional[DevServerManager] = None


def get_dev_server_manager() -> DevServerManager:
    """Get the global dev server manager instance."""
    global _dev_server_manager
    if _dev_server_manager is None:
        _dev_server_manager = DevServerManager()
    return _dev_server_manager
