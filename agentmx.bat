@echo off
REM AgentMX Project Control Script for Windows
REM Quick enable/disable AgentMX for current project

setlocal enabledelayedexpansion

set MARKER_FILE=.agentmx-enabled
set GITIGNORE_FILE=.gitignore

if "%1"=="" goto help
if "%1"=="help" goto help
if "%1"=="--help" goto help
if "%1"=="-h" goto help
if "%1"=="enable" goto enable
if "%1"=="disable" goto disable
if "%1"=="status" goto status

echo Error: Unknown command '%1'
echo.
goto help

:help
echo AgentMX Project Control
echo.
echo Usage:
echo   agentmx.bat enable   - Enable AgentMX for this project
echo   agentmx.bat disable  - Disable AgentMX for this project
echo   agentmx.bat status   - Check if AgentMX is enabled
echo   agentmx.bat help     - Show this help message
echo.
echo Examples:
echo   REM Enable AgentMX
echo   agentmx.bat enable
echo.
echo   REM Check status
echo   agentmx.bat status
echo.
echo   REM Disable AgentMX
echo   agentmx.bat disable
echo.
goto end

:status
if exist "%MARKER_FILE%" (
  echo [32m✓ AgentMX is ENABLED for this project[0m
  echo   Marker file: %CD%\%MARKER_FILE%
  exit /b 0
) else (
  echo [31m✗ AgentMX is DISABLED for this project[0m
  echo   Run 'agentmx.bat enable' to enable
  exit /b 1
)

:enable
if exist "%MARKER_FILE%" (
  echo [32m✓ AgentMX is already enabled[0m
  goto end
)

REM Create marker file
type nul > "%MARKER_FILE%"
echo [32m✓ Created marker file: %MARKER_FILE%[0m

REM Add to .gitignore if it exists
if exist "%GITIGNORE_FILE%" (
  findstr /C:".agentmx-enabled" "%GITIGNORE_FILE%" >nul 2>&1
  if errorlevel 1 (
    echo. >> "%GITIGNORE_FILE%"
    echo # AgentMX >> "%GITIGNORE_FILE%"
    echo .agentmx-enabled >> "%GITIGNORE_FILE%"
    echo .agentmx/ >> "%GITIGNORE_FILE%"
    echo [32m✓ Added to .gitignore[0m
  ) else (
    echo [32m✓ Already in .gitignore[0m
  )
) else (
  echo [33m⚠ No .gitignore found (consider creating one)[0m
)

echo.
echo [32m🎉 AgentMX is now ENABLED for this project![0m
echo.
echo Next steps:
echo   1. Open this project in Claude Code
echo   2. Claude will automatically use AgentMX tools
echo   3. Check status: agentmx.bat status
goto end

:disable
if not exist "%MARKER_FILE%" (
  echo [32m✓ AgentMX is already disabled[0m
  goto end
)

REM Remove marker file
del "%MARKER_FILE%"
echo [32m✓ Removed marker file: %MARKER_FILE%[0m

REM Optionally remove .agentmx directory
if exist ".agentmx" (
  set /p REPLY="Remove .agentmx\ directory with all data? (y/N) "
  if /i "!REPLY!"=="y" (
    rmdir /s /q ".agentmx"
    echo [32m✓ Removed .agentmx\ directory[0m
  ) else (
    echo [32m✓ Kept .agentmx\ directory (data preserved)[0m
  )
)

echo.
echo [32m🔒 AgentMX is now DISABLED for this project[0m
goto end

:end
endlocal
