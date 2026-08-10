@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

if not defined MY_HARNESS_ROOT (
  set "MY_HARNESS_ROOT=%SCRIPT_DIR%.."
)

for %%I in ("%MY_HARNESS_ROOT%") do set "MY_HARNESS_ROOT=%%~fI"

cd /d "%MY_HARNESS_ROOT%"
call npm run mcp
