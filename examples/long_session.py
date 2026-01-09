"""
Example: Long running session with multiple interactions
"""
import time
from glm_autocoder import SessionManager
from glm_autocoder.config import get_config


def simulate_long_session():
    """Simulate a long-running coding session"""
    
    config = get_config()
    session_manager = SessionManager(config)
    
    # Create a persistent session
    session_id = session_manager.create_session("long_running_session")
    print(f"Started long-running session: {session_id}\n")
    
    # Task 1: Initial code generation
    print("=== Task 1: Generate Initial Code ===")
    try:
        response = session_manager.chat_with_claude(
            session_id,
            "Create a Python class for a simple task manager that can add, remove, and list tasks"
        )
        print(f"Response: {response[:200]}...\n")
    except Exception as e:
        print(f"Error: {e}\n")
    
    time.sleep(1)
    
    # Task 2: Add feature
    print("=== Task 2: Add Feature ===")
    try:
        response = session_manager.chat_with_claude(
            session_id,
            "Add a method to mark tasks as completed and save tasks to a JSON file"
        )
        print(f"Response: {response[:200]}...\n")
    except Exception as e:
        print(f"Error: {e}\n")
    
    time.sleep(1)
    
    # Task 3: Add tests
    print("=== Task 3: Generate Tests ===")
    try:
        response = session_manager.chat_with_claude(
            session_id,
            "Now write unit tests for this task manager class using pytest"
        )
        print(f"Response: {response[:200]}...\n")
    except Exception as e:
        print(f"Error: {e}\n")
    
    time.sleep(1)
    
    # Task 4: Refactor
    print("=== Task 4: Refactor ===")
    try:
        response = session_manager.chat_with_claude(
            session_id,
            "Refactor the task manager to use a database instead of JSON file"
        )
        print(f"Response: {response[:200]}...\n")
    except Exception as e:
        print(f"Error: {e}\n")
    
    # Check session details
    print("=== Session Details ===")
    session = session_manager.get_session(session_id)
    if session:
        print(f"Total messages in session: {len(session.messages)}")
        print(f"Session active for: {(session.last_activity - session.created_at).seconds} seconds")
    
    # Cleanup
    print("\n=== Cleanup ===")
    session_manager.delete_session(session_id)
    print(f"Deleted session {session_id}")


if __name__ == "__main__":
    simulate_long_session()
