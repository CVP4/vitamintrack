@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
set "VITAMINTRACK_NODE=%ProgramFiles%\nodejs\node.exe"
if not exist "%VITAMINTRACK_NODE%" (
  echo Node.js was not found in "%ProgramFiles%\nodejs".
  pause
  exit /b 1
)
"%VITAMINTRACK_NODE%" "%~dp0scripts\start-vitamintrack.mjs" %*
if errorlevel 1 (
  pause
  exit /b 1
)
