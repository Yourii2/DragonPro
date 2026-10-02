@echo off
setlocal enableextensions enabledelayedexpansion
title Dragon Pro - Rebuild and Restart Server
cd /d "%~dp0"

echo ===================================================
echo     Dragon Pro - Auto Rebuild and Restart Server
echo ===================================================
echo.

if not exist "logs" mkdir "logs"
set "LOGFILE=logs\restart.log"
set "BUILDLOG=logs\build.log"

echo [%DATE% %TIME%] === Starting Update and Restart Process === >> "%LOGFILE%"

rem 1. Give PHP / caller time to flush the HTTP response when triggered via API
echo [1/4] Delaying 2 seconds to allow background caller to finish...
timeout /T 2 /NOBREAK >nul

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
:wait_port_3000
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set /a retries+=1
    echo Port 3000 is still busy (attempt !retries!/10). Waiting for release...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
        taskkill /F /T /PID %%a >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
    if !retries! lss 10 goto wait_port_3000
)

echo Port 3000 is verified free.
echo [%DATE% %TIME%] Port 3000 is free. >> "%LOGFILE%"

echo.
echo [3/4] Rebuilding application (npm run build)...
echo [%DATE% %TIME%] Building application... >> "%LOGFILE%"

if exist "package.json" (
    echo Executing: npm run build (Logging to logs\build.log)...
    call npm.cmd run build > "%BUILDLOG%" 2>&1
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Build failed! Check %BUILDLOG% for details.
        echo [%DATE% %TIME%] [ERROR] Build failed! >> "%LOGFILE%"
        echo Press any key to continue to server launch anyway or exit...
        timeout /t 5 /nobreak >nul
    ) else (
        echo [OK] Build completed successfully.
        echo [%DATE% %TIME%] [OK] Build succeeded. >> "%LOGFILE%"
    )
) else (
    echo [WARN] package.json not found in %~dp0
)

echo.
echo [4/4] Starting Dragon Pro Preview Server on port 3000...
echo [%DATE% %TIME%] Starting preview server... >> "%LOGFILE%"

rem Sync version in package.json from version.json
node -e "try { const v=require('./version.json'); const p=require('./package.json'); if(v.version && p.version !== v.version){ p.version=v.version; require('fs').writeFileSync('./package.json', JSON.stringify(p, null, 2)+'\n'); } } catch(e){}" >nul 2>&1

rem Extract version for window title
set "APP_VER="
for /f "tokens=2 delims=:," %%v in ('findstr /i "\"version\"" version.json 2^>nul') do (
    if not defined APP_VER (
        set "APP_VER=%%~v"
        set "APP_VER=!APP_VER: =!"
        set "APP_VER=!APP_VER:\"=!"
        set "APP_VER=!APP_VER:^"=!"
    )
)
if defined APP_VER set "APP_VER=!APP_VER:"=!"
if "!APP_VER!"=="" set "APP_VER=Latest"

rem Launch persistent server window with keep-alive (/k prevents window from closing on error)
start "Dragon Pro Server" cmd /k "cd /d %~dp0 && title Dragon Pro Server v!APP_VER! (Port 3000) && echo =================================================== && echo   Dragon Pro Server v!APP_VER! is Running (Port 3000) && echo   DO NOT CLOSE THIS WINDOW && echo =================================================== && npm.cmd run preview || (echo. && echo [ERROR] Server stopped with error! Press any key to retry... && pause && npm.cmd run preview)"

echo Server launched in dedicated window (Dragon Pro Server v!APP_VER!).
echo [%DATE% %TIME%] Server process launched (v!APP_VER!). >> "%LOGFILE%"

timeout /t 3 /nobreak >nul
exit /b 0
