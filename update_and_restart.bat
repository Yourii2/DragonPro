@echo off
setlocal enableextensions
cd /d "%~dp0"

echo ===================================================
echo     Dragon Pro - Auto Rebuild and Restart Server
echo ===================================================
echo.

echo [1/3] Stopping existing server on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Terminating PID %%a on port 3000...
    taskkill /F /PID %%a >nul 2>&1
)

ping 127.0.0.1 -n 3 >nul

echo.
echo [2/3] Compiling latest updates (npm run build)...
call npm.cmd run build
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo [3/3] Starting preview server on port 3000...
start "Dragon Pro Server" cmd /k "cd /d "%~dp0" && npm.cmd run preview"

ping 127.0.0.1 -n 3 >nul
echo.
echo ===================================================
echo     [OK] Server is running at http://localhost:3000
echo ===================================================
echo.
ping 127.0.0.1 -n 3 >nul
exit /b 0
