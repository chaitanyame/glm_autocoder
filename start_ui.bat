@echo off
cd /d "%~dp0"
REM AutoCoder UI Launcher for Windows
REM This script launches the web UI for the autonomous coding agent.

echo.
echo ====================================
echo   AutoCoder UI
echo ====================================
echo.

REM Check if Python is available
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Python not found in PATH
    echo Please install Python from https://python.org
    pause
    exit /b 1
)

REM Check if venv exists, create if not
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate the virtual environment
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt --quiet

REM Prompt for API Key (optional, for GLM model support)
echo.
echo Optional: Enter API Key for GLM model support (https://api.z.ai/api/anthropic)
echo Press Enter to skip (will use existing .env or default Anthropic endpoint)
set /p API_KEY="API Key: "

REM Export as environment variable if provided
if defined API_KEY (
    set AUTO_CODER_API_KEY=%API_KEY%
)

REM Run the Python launcher
python "%~dp0start_ui.py" %*

pause
