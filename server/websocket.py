"""
WebSocket Handlers
==================

Real-time updates for project progress and agent output.
"""

import asyncio
import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Set

from fastapi import WebSocket, WebSocketDisconnect

from .services.process_manager import get_manager

# Lazy imports
_count_passing_tests = None

logger = logging.getLogger(__name__)


def _get_project_path(project_name: str) -> Path:
    """Get project path from registry."""
    import sys
    root = Path(__file__).parent.parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from registry import get_project_path
    return get_project_path(project_name)


def _get_count_passing_tests():
    """Lazy import of count_passing_tests."""
    global _count_passing_tests
    if _count_passing_tests is None:
        import sys
        root = Path(__file__).parent.parent
        if str(root) not in sys.path:
            sys.path.insert(0, str(root))
        from progress import count_passing_tests
        _count_passing_tests = count_passing_tests
    return _count_passing_tests


class ConnectionManager:
    """Manages WebSocket connections per project."""

    def __init__(self):
        # project_name -> set of WebSocket connections
        self.active_connections: dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, project_name: str):
        """Accept a WebSocket connection for a project."""
        await websocket.accept()

        async with self._lock:
            if project_name not in self.active_connections:
                self.active_connections[project_name] = set()
            self.active_connections[project_name].add(websocket)

    async def disconnect(self, websocket: WebSocket, project_name: str):
        """Remove a WebSocket connection."""
        async with self._lock:
            if project_name in self.active_connections:
                self.active_connections[project_name].discard(websocket)
                if not self.active_connections[project_name]:
                    del self.active_connections[project_name]

    async def broadcast_to_project(self, project_name: str, message: dict):
        """Broadcast a message to all connections for a project."""
        async with self._lock:
            connections = list(self.active_connections.get(project_name, set()))

        dead_connections = []

        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)

        # Clean up dead connections
        if dead_connections:
            async with self._lock:
                for connection in dead_connections:
                    if project_name in self.active_connections:
                        self.active_connections[project_name].discard(connection)

    def get_connection_count(self, project_name: str) -> int:
        """Get number of active connections for a project."""
        return len(self.active_connections.get(project_name, set()))


# Global connection manager
manager = ConnectionManager()

# Root directory
ROOT_DIR = Path(__file__).parent.parent


def validate_project_name(name: str) -> bool:
    """Validate project name to prevent path traversal."""
    return bool(re.match(r'^[a-zA-Z0-9_-]{1,50}$', name))


async def poll_progress(websocket: WebSocket, project_name: str, project_dir: Path):
    """Poll database for progress changes and send updates."""
    count_passing_tests = _get_count_passing_tests()
    last_passing = -1
    last_in_progress = -1
    last_total = -1

    while True:
        try:
            passing, in_progress, total = count_passing_tests(project_dir)

            # Only send if changed
            if passing != last_passing or in_progress != last_in_progress or total != last_total:
                last_passing = passing
                last_in_progress = in_progress
                last_total = total
                percentage = (passing / total * 100) if total > 0 else 0

                await websocket.send_json({
                    "type": "progress",
                    "passing": passing,
                    "in_progress": in_progress,
                    "total": total,
                    "percentage": round(percentage, 1),
                })

            await asyncio.sleep(2)  # Poll every 2 seconds
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning(f"Progress polling error: {e}")
            break


async def project_websocket(websocket: WebSocket, project_name: str):
    """
    WebSocket endpoint for project updates.

    Streams:
    - Progress updates (passing/total counts)
    - Agent status changes
    - Agent stdout/stderr lines
    """
    logger.info(f"Project WebSocket endpoint called for project: {project_name}")
    # Must connect (which calls accept) first before we can close with custom codes
    await manager.connect(websocket, project_name)
    logger.info(f"Project WebSocket connected for project: {project_name}")
    
    if not validate_project_name(project_name):
        logger.warning(f"Invalid project name: {project_name}")
        await websocket.send_json({"type": "error", "content": "Invalid project name"})
        await websocket.close(code=4000, reason="Invalid project name")
        return

    project_dir = _get_project_path(project_name)
    if not project_dir:
        logger.warning(f"Project not found in registry: {project_name}")
        await websocket.send_json({"type": "error", "content": "Project not found in registry"})
        await websocket.close(code=4004, reason="Project not found in registry")
        return

    if not project_dir.exists():
        logger.warning(f"Project directory not found: {project_dir}")
        await websocket.send_json({"type": "error", "content": f"Project directory not found: {project_dir}"})
        await websocket.close(code=4004, reason="Project directory not found")
        return

    logger.info(f"WebSocket connected for project: {project_name} at {project_dir}")

    # Get agent manager and register callbacks
    agent_manager = get_manager(project_name, project_dir, ROOT_DIR)

    async def on_output(line: str):
        """Handle agent output - broadcast to this WebSocket."""
        try:
            await websocket.send_json({
                "type": "log",
                "line": line,
                "timestamp": datetime.now().isoformat(),
            })
        except Exception:
            pass  # Connection may be closed

    async def on_status_change(status: str):
        """Handle status change - broadcast to this WebSocket."""
        try:
            await websocket.send_json({
                "type": "agent_status",
                "status": status,
            })
        except Exception:
            pass  # Connection may be closed

    # Register callbacks
    agent_manager.add_output_callback(on_output)
    agent_manager.add_status_callback(on_status_change)

    # Start progress polling task
    poll_task = asyncio.create_task(poll_progress(websocket, project_name, project_dir))

    try:
        # Send initial status
        await websocket.send_json({
            "type": "agent_status",
            "status": agent_manager.status,
        })

        # Send initial progress
        count_passing_tests = _get_count_passing_tests()
        passing, in_progress, total = count_passing_tests(project_dir)
        percentage = (passing / total * 100) if total > 0 else 0
        await websocket.send_json({
            "type": "progress",
            "passing": passing,
            "in_progress": in_progress,
            "total": total,
            "percentage": round(percentage, 1),
        })

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for any incoming messages (ping/pong, commands, etc.)
                data = await websocket.receive_text()
                message = json.loads(data)

                # Handle ping
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})

            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON from WebSocket: {data[:100] if data else 'empty'}")
            except Exception as e:
                logger.warning(f"WebSocket error: {e}")
                break

    finally:
        # Clean up
        poll_task.cancel()
        try:
            await poll_task
        except asyncio.CancelledError:
            pass

        # Unregister callbacks
        agent_manager.remove_output_callback(on_output)
        agent_manager.remove_status_callback(on_status_change)

        # Disconnect from manager
        await manager.disconnect(websocket, project_name)


# ============================================================================
# Terminal WebSocket
# ============================================================================

async def terminal_websocket(websocket: WebSocket, project_name: str):
    """
    WebSocket endpoint for integrated terminal.
    
    Allows running commands in the project directory with security validation.
    """
    logger.info(f"Terminal WebSocket endpoint called for project: {project_name}")
    
    await websocket.accept()
    
    if not validate_project_name(project_name):
        await websocket.send_json({"type": "error", "content": "Invalid project name"})
        await websocket.close(code=4000, reason="Invalid project name")
        return

    project_dir = _get_project_path(project_name)
    if not project_dir or not project_dir.exists():
        await websocket.send_json({"type": "error", "content": "Project not found"})
        await websocket.close(code=4004, reason="Project not found")
        return
    
    # Import security module for command validation
    import sys
    root = Path(__file__).parent.parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    try:
        import security as security_module
    except Exception as e:
        logger.exception(f"Failed to import security module: {e}")
        await websocket.send_json({
            "type": "error",
            "content": "Security module failed to load. Terminal is unavailable.\r\n",
        })
        await websocket.close(code=1011, reason="Security module error")
        return

    validate_command = getattr(security_module, "validate_command", None)
    if validate_command is None:
        legacy_validator = getattr(security_module, "validate_bash_command", None)
        if legacy_validator is not None:
            validate_command = legacy_validator
            logger.warning("security.validate_command missing; using legacy validator")
        else:
            allowed_commands = getattr(
                security_module,
                "ALLOWED_COMMANDS",
                {"ls", "pwd", "echo", "cat"},
            )

            def validate_command(command_string: str, project_dir: str | None = None) -> tuple[bool, str]:
                import os
                import shlex

                try:
                    tokens = shlex.split(command_string)
                except ValueError:
                    return False, "Could not parse command"

                if not tokens:
                    return False, "Empty command"

                cmd = os.path.basename(tokens[0])
                if cmd not in allowed_commands:
                    return False, f"Command '{cmd}' is not allowed"

                return True, ""

            logger.warning("security.validate_command missing; using minimal allowlist validator")
    
    await websocket.send_json({"type": "connected"})
    
    current_process: asyncio.subprocess.Process | None = None
    
    async def read_stream(stream, stream_type: str):
        """Read from a stream and send to WebSocket."""
        try:
            while True:
                line = await stream.readline()
                if not line:
                    break
                try:
                    text = line.decode('utf-8', errors='replace')
                    await websocket.send_json({
                        "type": stream_type,
                        "content": text,
                    })
                except Exception:
                    break
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.debug(f"Stream read error: {e}")
    
    try:
        while True:
            try:
                data = await websocket.receive_text()
                logger.info(f"Terminal received raw data: {data[:200]}")
                message = json.loads(data)
                
                msg_type = message.get("type")
                logger.info(f"Terminal message type: {msg_type}")
                
                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    
                elif msg_type == "command":
                    command = message.get("command", "").strip()
                    logger.info(f"Terminal command received: {repr(command)}")
                    
                    if not command:
                        await websocket.send_json({
                            "type": "output",
                            "content": "$ ",
                        })
                        continue
                    
                    # Validate command for security
                    is_valid, error_msg = validate_command(command, str(project_dir))
                    logger.info(f"Command validation: is_valid={is_valid}, error_msg={error_msg}")
                    
                    if not is_valid:
                        await websocket.send_json({
                            "type": "error",
                            "content": f"Command not allowed: {error_msg}\r\n",
                        })
                        await websocket.send_json({
                            "type": "output",
                            "content": "$ ",
                        })
                        continue
                    
                    # Run the command
                    try:
                        current_process = await asyncio.create_subprocess_shell(
                            command,
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE,
                            cwd=str(project_dir),
                        )
                        
                        # Read stdout and stderr concurrently
                        stdout_task = asyncio.create_task(
                            read_stream(current_process.stdout, "output")
                        )
                        stderr_task = asyncio.create_task(
                            read_stream(current_process.stderr, "error")
                        )
                        
                        # Wait for process to complete
                        await current_process.wait()
                        
                        # Wait for stream readers to finish
                        await asyncio.gather(stdout_task, stderr_task, return_exceptions=True)
                        
                        # Send exit code
                        await websocket.send_json({
                            "type": "exit",
                            "exitCode": current_process.returncode,
                        })
                        
                    except Exception as e:
                        await websocket.send_json({
                            "type": "error",
                            "content": f"Failed to run command: {e}\r\n",
                        })
                    finally:
                        current_process = None
                        await websocket.send_json({
                            "type": "output",
                            "content": "$ ",
                        })
                
                elif msg_type == "signal":
                    signal_name = message.get("signal", "SIGINT")
                    if current_process and current_process.returncode is None:
                        try:
                            if signal_name == "SIGINT":
                                current_process.terminate()
                            else:
                                current_process.kill()
                        except Exception as e:
                            logger.debug(f"Failed to send signal: {e}")
                
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                logger.warning("Invalid JSON from terminal WebSocket")
            except Exception as e:
                logger.warning(f"Terminal WebSocket error: {e}")
                break
    
    finally:
        # Kill any running process
        if current_process and current_process.returncode is None:
            try:
                current_process.kill()
            except Exception:
                pass
        logger.info(f"Terminal WebSocket disconnected for project: {project_name}")
