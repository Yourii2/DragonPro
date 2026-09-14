@echo off
setlocal enableextensions
cd /d "%~dp0"

echo ===================================================
echo     Dragon Pro - Auto Rebuild and Restart Server
echo ===================================================
echo.

echo [1/3] Stopping existing server on port 3000 and 3001...
rem 1. Stop via PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @(3000, 3001); Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort } | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

rem 2. Stop via netstat PID search
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)

rem 3. Verification loop: Wait until port 3000 is 100% free before starting Vite
set "retries=0"
:wait_port_3000
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set /a retries+=1
    echo Port 3000 is still busy (attempt %retries%). Waiting for release...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
        taskkill /F /T /PID %%a >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
    if %retries% lss 10 goto wait_port_3000
)

timeout /t 1 /nobreak >nul

echo.
echo [2/3] Checking build...
rem If dist folder already exists (from release zip), skip building to start instantly
if not exist "dist\index.html" (
    if exist "package.json" (
        echo Building dist...
        call npm.cmd run build >nul 2>&1
    )
)

echo.
echo [3/3] Starting preview server strictly on port 3000...
start "Dragon Pro Server" cmd /c "cd /d %~dp0 && npm.cmd run preview"

timeout /t 2 /nobreak >nul
exit /b 0
