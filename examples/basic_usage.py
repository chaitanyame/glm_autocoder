"""
Example: Basic usage of GLM Autocoder
"""
from glm_autocoder import SessionManager
from glm_autocoder.config import get_config


def main():
    """Demonstrate basic usage"""
    
    # Initialize with configuration
    config = get_config()
    session_manager = SessionManager(config)
    
    # Create a new session
    session_id = session_manager.create_session()
    print(f"Created session: {session_id}\n")
    
    # Example 1: Chat with Claude
    print("=== Example 1: Chat with Claude ===")
    try:
        response = session_manager.chat_with_claude(
            session_id,
            "Write a Python function to calculate fibonacci numbers"
        )
        print(f"Claude: {response}\n")
    except Exception as e:
        print(f"Claude not available: {e}\n")
    
    # Example 2: Continue the conversation
    print("=== Example 2: Continue Conversation ===")
    try:
        response = session_manager.chat_with_claude(
            session_id,
            "Now add error handling to that function"
        )
        print(f"Claude: {response}\n")
    except Exception as e:
        print(f"Error: {e}\n")
    
    # Example 3: Stream response
    print("=== Example 3: Streaming Response ===")
    try:
        print("Claude (streaming): ", end="", flush=True)
        for chunk in session_manager.stream_chat_with_claude(
            session_id,
            "Explain how this fibonacci function works"
        ):
            print(chunk, end="", flush=True)
        print("\n")
    except Exception as e:
        print(f"Error: {e}\n")
    
    # Example 4: Use GLM model (if API key is configured)
    print("=== Example 4: Chat with GLM ===")
    try:
        session_id_glm = session_manager.create_session("glm_session")
        response = session_manager.chat_with_glm(
            session_id_glm,
            "Hello! Can you help me with Python programming?"
        )
        print(f"GLM: {response}\n")
    except Exception as e:
        print(f"GLM not available: {e}\n")
    
    # List active sessions
    print("=== Active Sessions ===")
    sessions = session_manager.list_sessions()
    for session_info in sessions:
        print(f"Session ID: {session_info['session_id']}")
        print(f"  Messages: {session_info['message_count']}")
        print(f"  Last Activity: {session_info['last_activity']}\n")
    
    # Cleanup
    print("=== Cleanup ===")
    session_manager.cleanup_expired_sessions()
    print("Cleaned up expired sessions")


if __name__ == "__main__":
    main()
