"""
Main CLI entry point for GLM Autocoder
"""
import argparse
import sys
import logging
from glm_autocoder import SessionManager, GLMModel, ClaudeCodeHarness
from glm_autocoder.config import get_config

logger = logging.getLogger(__name__)


def interactive_mode(session_manager: SessionManager, model: str = "claude"):
    """
    Run in interactive mode
    
    Args:
        session_manager: Session manager instance
        model: Model to use ('claude' or 'glm')
    """
    session_id = session_manager.create_session()
    print(f"Started new session: {session_id}")
    print(f"Using model: {model}")
    print("Type 'exit' or 'quit' to end the session\n")
    
    while True:
        try:
            user_input = input("You: ").strip()
            
            if user_input.lower() in ['exit', 'quit', 'q']:
                print("Ending session...")
                break
            
            if not user_input:
                continue
            
            print(f"\n{model.upper()}: ", end="", flush=True)
            
            if model == "claude":
                # Stream response from Claude
                for chunk in session_manager.stream_chat_with_claude(
                    session_id,
                    user_input
                ):
                    print(chunk, end="", flush=True)
                print("\n")
            else:
                # Non-streaming response from GLM
                response = session_manager.chat_with_glm(session_id, user_input)
                print(f"{response}\n")
                
        except KeyboardInterrupt:
            print("\n\nSession interrupted by user")
            break
        except Exception as e:
            logger.error(f"Error in interactive mode: {e}")
            print(f"\nError: {e}\n")
    
    session_manager.delete_session(session_id)


def code_generation_mode(session_manager: SessionManager, prompt: str, output_file: str = None):
    """
    Generate code based on prompt
    
    Args:
        session_manager: Session manager instance
        prompt: Code generation prompt
        output_file: Optional file to save generated code
    """
    try:
        code = session_manager.claude_harness.generate_code(
            prompt,
            system_prompt="You are an expert software engineer. Generate high-quality, well-documented code."
        )
        
        print("Generated Code:")
        print("-" * 80)
        print(code)
        print("-" * 80)
        
        if output_file:
            with open(output_file, 'w') as f:
                f.write(code)
            print(f"\nCode saved to: {output_file}")
            
    except Exception as e:
        logger.error(f"Error generating code: {e}")
        print(f"Error: {e}")
        sys.exit(1)


def code_review_mode(session_manager: SessionManager, code_file: str, language: str = "python"):
    """
    Review code from file
    
    Args:
        session_manager: Session manager instance
        code_file: Path to code file
        language: Programming language
    """
    try:
        with open(code_file, 'r') as f:
            code = f.read()
        
        review = session_manager.claude_harness.review_code(code, language)
        
        print(f"Code Review for {code_file}:")
        print("-" * 80)
        print(review)
        print("-" * 80)
        
    except FileNotFoundError:
        print(f"Error: File '{code_file}' not found")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Error reviewing code: {e}")
        print(f"Error: {e}")
        sys.exit(1)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="GLM Autocoder - Long Running Sessions with GLM and Claude"
    )
    
    parser.add_argument(
        "--mode",
        choices=["interactive", "generate", "review"],
        default="interactive",
        help="Operation mode"
    )
    
    parser.add_argument(
        "--model",
        choices=["claude", "glm"],
        default="claude",
        help="Model to use for interactive mode"
    )
    
    parser.add_argument(
        "--prompt",
        help="Prompt for code generation mode"
    )
    
    parser.add_argument(
        "--code-file",
        help="Code file for review mode"
    )
    
    parser.add_argument(
        "--language",
        default="python",
        help="Programming language for code review"
    )
    
    parser.add_argument(
        "--output",
        help="Output file for generated code"
    )
    
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )
    
    args = parser.parse_args()
    
    # Setup logging
    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)
    
    try:
        # Initialize session manager
        config = get_config()
        session_manager = SessionManager(config)
        
        # Route to appropriate mode
        if args.mode == "interactive":
            interactive_mode(session_manager, args.model)
        elif args.mode == "generate":
            if not args.prompt:
                print("Error: --prompt is required for generate mode")
                sys.exit(1)
            code_generation_mode(session_manager, args.prompt, args.output)
        elif args.mode == "review":
            if not args.code_file:
                print("Error: --code-file is required for review mode")
                sys.exit(1)
            code_review_mode(session_manager, args.code_file, args.language)
            
    except ValueError as e:
        print(f"Configuration Error: {e}")
        print("\nMake sure to set ANTHROPIC_API_KEY in your environment or .env file")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
