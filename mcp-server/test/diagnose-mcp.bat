@echo off
REM Diagnostic script to test MCP Server with environment variables

echo Testing AgentMX MCP Server...
echo.

set AGENTMX_DB_PATH=D:\exp_all\mx_test1\.agentmx\agentmx.db
set AGENTMX_AGENT_ID=claude-test-session
set AGENTMX_AUTO_TRACK=true
set AGENTMX_LOG_LEVEL=DEBUG

echo Environment variables:
echo   AGENTMX_DB_PATH=%AGENTMX_DB_PATH%
echo   AGENTMX_AGENT_ID=%AGENTMX_AGENT_ID%
echo   AGENTMX_AUTO_TRACK=%AGENTMX_AUTO_TRACK%
echo   AGENTMX_LOG_LEVEL=%AGENTMX_LOG_LEVEL%
echo.

echo Starting MCP Server...
echo.

cd /d D:\exp_all\mx_test1
node D:\exp_all\AgentMX\mcp-server\dist\index.js
