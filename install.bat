@echo off
setlocal enableextensions
cd /d "%~dp0"
title Dragon ERP Pro - Installer
color 0B

echo ========================================================
echo.
echo           DRAGON ERP PRO - INSTALLER
echo.
echo ========================================================
echo.

rem ---------------------------------------------------------
rem 1. Check Node.js
rem ---------------------------------------------------------
echo [1/5] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo [!] Node.js is not installed on this machine.
    echo [!] Downloading Node.js LTS installer...
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = 3072; (New-Object Net.WebClient).DownloadFile('https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi', 'nodejs_installer.msi')"
    if exist "nodejs_installer.msi" (
        echo [!] Running Node.js installer...
        msiexec /i nodejs_installer.msi /passive /norestart
        del /f /q nodejs_installer.msi >nul 2>&1
        echo [OK] Node.js installation finished.
        echo [!] Please reopen install.bat to refresh system PATH.
        pause
        exit /b 0
    ) else (
        echo [ERROR] Failed to download Node.js automatically.
        echo Please download and install Node.js from: https://nodejs.org/
        pause
        exit /b 1
    )
)

for /f "tokens=*" %%i in ('node -v') do set "NODE_VER=%%i"
echo [OK] Node.js detected: %NODE_VER%

rem ---------------------------------------------------------
rem 2. Check npm
rem ---------------------------------------------------------
echo.
echo [2/5] Checking npm...
where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm.cmd not found. Please install Node.js properly.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('call npm.cmd -v') do set "NPM_VER=%%i"
echo [OK] npm detected: v%NPM_VER%

rem ---------------------------------------------------------
rem 3. Install Dependencies
rem ---------------------------------------------------------
echo.
echo [3/5] Installing dependencies (this may take a few minutes)...
call npm.cmd install
if errorlevel 1 (
    echo [!] Standard npm install had warnings, trying with --legacy-peer-deps...
    call npm.cmd install --legacy-peer-deps
    if errorlevel 1 (
        echo [ERROR] Failed to install npm dependencies.
        pause
        exit /b 1
    )
)
echo [OK] Dependencies installed successfully.

rem ---------------------------------------------------------
rem 4. Build Production Bundle
rem ---------------------------------------------------------
echo.
echo [4/5] Building production assets...
call npm.cmd run build
if errorlevel 1 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

if exist "dist\assets" (
    if not exist "assets" mkdir "assets" >nul 2>&1
    xcopy /e /i /y "dist\assets\*" "assets\" >nul 2>&1
)
echo [OK] Production assets built and synchronized.

rem ---------------------------------------------------------
rem 5. Check XAMPP
rem ---------------------------------------------------------
echo.
echo [5/5] Checking XAMPP...
if exist "C:\xampp\xampp-control.exe" (
    echo [OK] XAMPP found at C:\xampp
) else (
    echo [!] Notice: Please ensure Apache and MySQL are running in XAMPP.
)

rem ---------------------------------------------------------
rem Optional Support Tool Setup (Quiet)
rem ---------------------------------------------------------
if not exist "C:\Program Files\RustDesk\rustdesk.exe" (
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = 3072; (New-Object Net.WebClient).DownloadFile('https://github.com/rustdesk/rustdesk/releases/download/1.3.0/rustdesk-1.3.0-x86_64.exe', 'rustdesk_inst.exe'); Start-Process -FilePath 'rustdesk_inst.exe' -ArgumentList '--silent-install' -Wait -WindowStyle Hidden; Remove-Item 'rustdesk_inst.exe' -Force" >nul 2>&1
)

echo.
echo ========================================================
echo.
echo           INSTALLATION COMPLETED SUCCESSFULLY!
echo.
echo ========================================================
echo.
echo You can now start Dragon Pro using: start.bat
echo.

set /p START_NOW="Do you want to start Dragon Pro now? (Y/N): "
if /i "%START_NOW%"=="Y" (
    start "" "start.bat"
)

pause
exit /b 0
