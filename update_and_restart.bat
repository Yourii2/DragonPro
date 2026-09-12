@echo off
setlocal enableextensions
cd /d "%~dp0"

echo ===================================================
echo     Dragon Pro - Auto Rebuild and Restart Server
echo ===================================================
echo.

echo [1/3] Stopping existing server on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo.
echo [2/3] Checking build...
if exist "package.json" (
    call npm.cmd run build >nul 2>&1
)

echo.
echo [3/3] Starting preview server on port 3000...
start "Dragon Pro Server" cmd /c "cd /d "%~dp0" && npm.cmd run preview"

timeout /t 2 /nobreak >nul
exit /b 0
