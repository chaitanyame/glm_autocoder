"""
Agent Session Logic
===================

Core agent interaction functions for running autonomous coding sessions.
"""

import asyncio
import io
import re
import sys
from pathlib import Path
from typing import Optional

from claude_agent_sdk import ClaudeSDKClient

# Exit code for rate limiting - signals process_manager to schedule auto-resume
EXIT_CODE_RATE_LIMITED = 42

# Fix Windows console encoding for Unicode characters (emoji, etc.)
# Without this, print() crashes when Claude outputs emoji like ✅
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from client import create_client
from progress import has_features, print_progress_summary, print_session_header
from prompts import (
    copy_spec_to_project,
    get_coding_prompt,
    get_coding_prompt_yolo,
    get_initializer_prompt,
)

# Configuration
AUTO_CONTINUE_DELAY_SECONDS = 3


async def run_agent_session(
    client: ClaudeSDKClient,
    message: str,
    project_dir: Path,
) -> tuple[str, str]:
    """
    Run a single agent session using Claude Agent SDK.

    Args:
        client: Claude SDK client
        message: The prompt to send
        project_dir: Project directory path

    Returns:
        (status, response_text) where status is:
        - "continue" if agent should continue working
        - "error" if an error occurred
    """
    print("Sending prompt to Claude Agent SDK...\n")

    try:
        # Send the query
        await client.query(message)

        # Collect response text and show tool use
        response_text = ""
        async for msg in client.receive_response():
            msg_type = type(msg).__name__

            # Handle AssistantMessage (text and tool use)
            if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    block_type = type(block).__name__

                    if block_type == "TextBlock" and hasattr(block, "text"):
                        response_text += block.text
                        print(block.text, end="", flush=True)
                    elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                        print(f"\n[Tool: {block.name}]", flush=True)
                        if hasattr(block, "input"):
                            input_str = str(block.input)
                            if len(input_str) > 200:
                                print(f"   Input: {input_str[:200]}...", flush=True)
                            else:
                                print(f"   Input: {input_str}", flush=True)

            # Handle UserMessage (tool results)
            elif msg_type == "UserMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    block_type = type(block).__name__

                    if block_type == "ToolResultBlock":
                        result_content = getattr(block, "content", "")
                        is_error = getattr(block, "is_error", False)

                        # Check if command was blocked by security hook
                        if "blocked" in str(result_content).lower():
                            print(f"   [BLOCKED] {result_content}", flush=True)
                        elif is_error:
                            # Show errors (truncated)
                            error_str = str(result_content)[:500]
                            print(f"   [Error] {error_str}", flush=True)
                        else:
                            # Tool succeeded - just show brief confirmation
                            print("   [Done]", flush=True)

        print("\n" + "-" * 70 + "\n")
        return "continue", response_text

    except Exception as e:
        error_str = str(e)
        print(f"Error during agent session: {error_str}")
        
        # Check for rate limit error (429) - extract reset time if available
        if "429" in error_str or "rate limit" in error_str.lower():
            reset_time = _extract_reset_time(error_str)
            return "rate_limited", reset_time or ""
        
        return "error", error_str


def _extract_reset_time(error_str: str) -> Optional[str]:
    """
    Extract reset time from rate limit error message.
    
    Looks for patterns like:
    - "2026-01-15 05:39:26" 
    - "reset at 2026-01-15T05:39:26"
    
    Returns:
        Reset time string if found, None otherwise
    """
    # Try to find datetime pattern in the error message
    # Format: YYYY-MM-DD HH:MM:SS or YYYY-MM-DDTHH:MM:SS
    pattern = r'(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})'
    match = re.search(pattern, error_str)
    if match:
        return match.group(1).replace('T', ' ')
    return None


async def run_autonomous_agent(
    project_dir: Path,
    model: str,
    max_iterations: Optional[int] = None,
    yolo_mode: bool = False,
    api_key: Optional[str] = None,
) -> None:
    """
    Run the autonomous agent loop.

    Args:
        project_dir: Directory for the project
        model: Claude model to use
        max_iterations: Maximum number of iterations (None for unlimited)
        yolo_mode: If True, skip browser testing and use YOLO prompt
        api_key: Optional API key for GLM model support
    """
    print("\n" + "=" * 70)
    print("  AUTONOMOUS CODING AGENT DEMO")
    print("=" * 70)
    print(f"\nProject directory: {project_dir}")
    print(f"Model: {model}")
    if yolo_mode:
        print("Mode: YOLO (testing disabled)")
    else:
        print("Mode: Standard (full testing)")
    if max_iterations:
        print(f"Max iterations: {max_iterations}")
    else:
        print("Max iterations: Unlimited (will run until completion)")
    print()

    # Create project directory
    project_dir.mkdir(parents=True, exist_ok=True)

    # Check if this is a fresh start or continuation
    # Uses has_features() which checks if the database actually has features,
    # not just if the file exists (empty db should still trigger initializer)
    is_first_run = not has_features(project_dir)

    if is_first_run:
        print("Fresh start - will use initializer agent")
        print()
        print("=" * 70)
        print("  NOTE: First session takes 10-20+ minutes!")
        print("  The agent is generating 200 detailed test cases.")
        print("  This may appear to hang - it's working. Watch for [Tool: ...] output.")
        print("=" * 70)
        print()
        # Copy the app spec into the project directory for the agent to read
        copy_spec_to_project(project_dir)
    else:
        print("Continuing existing project")
        print_progress_summary(project_dir)

    # Main loop
    iteration = 0

    while True:
        iteration += 1

        # Check max iterations
        if max_iterations and iteration > max_iterations:
            print(f"\nReached max iterations ({max_iterations})")
            print("To continue, run the script again without --max-iterations")
            break

        # Print session header
        print_session_header(iteration, is_first_run)

        # Create client (fresh context)
        client = create_client(project_dir, model, yolo_mode=yolo_mode, api_key=api_key)

        # Choose prompt based on session type
        # Pass project_dir to enable project-specific prompts
        if is_first_run:
            prompt = get_initializer_prompt(project_dir)
            is_first_run = False  # Only use initializer once
        else:
            # Use YOLO prompt if in YOLO mode
            if yolo_mode:
                prompt = get_coding_prompt_yolo(project_dir)
            else:
                prompt = get_coding_prompt(project_dir)

        # Run session with async context manager
        async with client:
            status, response = await run_agent_session(client, prompt, project_dir)

        # Handle status
        if status == "continue":
            print(f"\nAgent will auto-continue in {AUTO_CONTINUE_DELAY_SECONDS}s...")
            print_progress_summary(project_dir)
            await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)

        elif status == "rate_limited":
            # Rate limited - print marker for process manager and exit with special code
            reset_time = response  # response contains the reset time
            print("\n" + "=" * 70)
            print("  RATE LIMITED")
            print("=" * 70)
            print(f"\nAPI rate limit exceeded.")
            if reset_time:
                print(f"Reset time: {reset_time}")
            print("\nThe agent will automatically resume when the rate limit resets.")
            print("=" * 70)
            # Print marker for process_manager to detect
            # Format: RATE_LIMITED:<reset_time_or_empty>
            print(f"\nRATE_LIMITED:{reset_time}", flush=True)
            sys.exit(EXIT_CODE_RATE_LIMITED)

        elif status == "error":
            print("\nSession encountered an error")
            print("Will retry with a fresh session...")
            await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)

        # Small delay between sessions
        if max_iterations is None or iteration < max_iterations:
            print("\nPreparing next session...\n")
            await asyncio.sleep(1)

    # Final summary
    print("\n" + "=" * 70)
    print("  SESSION COMPLETE")
    print("=" * 70)
    print(f"\nProject directory: {project_dir}")
    print_progress_summary(project_dir)

    # Print instructions for running the generated application
    print("\n" + "-" * 70)
    print("  TO RUN THE GENERATED APPLICATION:")
    print("-" * 70)
    print(f"\n  cd {project_dir.resolve()}")
    print("  ./init.sh           # Run the setup script")
    print("  # Or manually:")
    print("  npm install && npm run dev")
    print("\n  Then open http://localhost:3000 (or check init.sh for the URL)")
    print("-" * 70)

    print("\nDone!")
