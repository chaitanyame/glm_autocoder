@echo off
REM =============================================================================
REM ZLM Code Harness - Docker Launcher for Windows
REM =============================================================================
REM Prerequisites: Docker Desktop installed and running
REM =============================================================================

cd /d "%~dp0"

echo.
echo ====================================
echo   ZLM Code Harness (Docker)
echo ====================================
echo.

REM Check if Docker is installed
where docker >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Docker not found.
    echo.
    echo Install Docker Desktop for Windows:
    echo   https://docs.docker.com/desktop/install/windows-install/
    echo.
    pause
    exit /b 1
)

REM Check if Docker is running
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Docker is not running.
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

REM Check for docker-compose
where docker-compose >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set COMPOSE_CMD=docker-compose
) else (
    docker compose version >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        set COMPOSE_CMD=docker compose
    ) else (
        echo ERROR: Docker Compose not found.
        echo Please ensure Docker Desktop is properly installed.
        pause
        exit /b 1
    )
)

echo Using: %COMPOSE_CMD%

REM Check for API Key
if not defined ZAI_API_KEY (
    if not exist ".env" (
        echo.
        echo API Key Configuration
        echo ---------------------
        echo Enter your Z.AI API key for GLM model support.
        echo Get your key from: https://api.z.ai/
        echo.
        set /p API_KEY="API Key (press Enter to skip): "
        
        if defined API_KEY (
            set ZAI_API_KEY=%API_KEY%
            echo ZAI_API_KEY=%API_KEY%> .env
            echo API key saved to .env file.
        )
    )
)

REM Set default projects directory
if not defined PROJECTS_DIR (
    set PROJECTS_DIR=%USERPROFILE%\Projects
    if not exist "%PROJECTS_DIR%" mkdir "%PROJECTS_DIR%"
    echo Projects directory: %PROJECTS_DIR%
)

REM Build and start
echo.
echo Building and starting ZLM Code Harness...
echo.

%COMPOSE_CMD% up --build -d

echo.
echo ====================================
echo   ZLM Code Harness is running!
echo ====================================
echo.
echo   Web UI: http://localhost:8888
echo.
echo   Projects directory: %PROJECTS_DIR%
echo.
echo Commands:
echo   View logs:    %COMPOSE_CMD% logs -f
echo   Stop:         %COMPOSE_CMD% down
echo   Restart:      %COMPOSE_CMD% restart
echo.

REM Open browser
timeout /t 3 >nul
start http://localhost:8888

REM Show logs
echo Showing logs (Ctrl+C to detach, container keeps running)...
echo.
%COMPOSE_CMD% logs -f

pause
