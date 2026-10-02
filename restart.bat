@echo off
setlocal enableextensions enabledelayedexpansion
title Dragon Pro - Rebuild and Restart Server
set "PROJ_DIR=%~dp0"
if "%PROJ_DIR:~-1%"=="\" set "PROJ_DIR=%PROJ_DIR:~0,-1%"
cd /d "%PROJ_DIR%"

echo ===================================================
echo     Dragon Pro - Auto Rebuild and Restart Server
echo ===================================================
echo.

if not exist "logs" mkdir "logs"
set "LOGFILE=logs\restart.log"
set "BUILDLOG=logs\build.log"

echo [%DATE% %TIME%] === Starting Update and Restart Process === >> "%LOGFILE%"

echo [1/4] Delaying 2 seconds to allow caller to finish...
ping 127.0.0.1 -n 3 >nul 2>&1

echo [2/4] Stopping existing server on port 3000 and 3001...
echo [%DATE% %TIME%] Stopping existing processes on port 3000/3001... >> "%LOGFILE%"

rem Stop via PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @(3000, 3001); Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort } | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

rem Stop via netstat PID search
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)

rem Verification loop: Wait until port 3000 is 100% free before starting Vite
set "retries=0"
:check_port_3000
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 goto port_3000_ok

set /a retries+=1
echo Port 3000 is busy, waiting for release (%retries%/10)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)
ping 127.0.0.1 -n 2 >nul 2>&1
if %retries% lss 10 goto check_port_3000

:port_3000_ok
echo Port 3000 is verified free.
echo [%DATE% %TIME%] Port 3000 is free. >> "%LOGFILE%"

echo.
echo [3/4] Rebuilding application - npm run build...
echo [%DATE% %TIME%] Building application... >> "%LOGFILE%"

if exist "package.json" (
    echo Executing: npm run build - Logging to logs\build.log...
    call npm.cmd run build > "%BUILDLOG%" 2>&1
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Build failed! Check %BUILDLOG% for details.
        echo [%DATE% %TIME%] [ERROR] Build failed! >> "%LOGFILE%"
    ) else (
        echo [OK] Build completed successfully.
        echo [%DATE% %TIME%] [OK] Build succeeded. >> "%LOGFILE%"
        node -e "try { const fs=require('fs'); const v=require('./version.json').version; fs.writeFileSync('dist/.version', v); } catch(e){}" >nul 2>&1
    )
) else (
    echo [WARN] package.json not found in %PROJ_DIR%
)

echo.
echo [4/4] Starting Dragon Pro Preview Server on port 3000...
echo [%DATE% %TIME%] Starting preview server... >> "%LOGFILE%"

rem Extract version for window title
set "APP_VER=Latest"
for /f "tokens=2 delims=:," %%v in ('findstr /i "\"version\"" version.json 2^>nul') do (
    set "APP_VER=%%~v"
    set "APP_VER=!APP_VER: =!"
    set "APP_VER=!APP_VER:\"=!"
    set "APP_VER=!APP_VER:"=!"
)

start "Dragon Pro Server" /D "%PROJ_DIR%" cmd /k "title Dragon Pro Server v!APP_VER! (Port 3000) && echo Dragon Pro Server v!APP_VER! is Running on Port 3000 && npm.cmd run preview"

echo Server launched in dedicated window (Dragon Pro Server v!APP_VER!).
echo [%DATE% %TIME%] Server process launched (v!APP_VER!). >> "%LOGFILE%"

rem Give preview server time to bind then open browser
ping 127.0.0.1 -n 4 >nul 2>&1
start http://localhost:3000

exit /b 0
