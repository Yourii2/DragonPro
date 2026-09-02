@echo off
chcp 65001 >nul
title Dragon Pro - Starting System
color 0A

rem Set script directory
setlocal enableextensions
cd /d "%~dp0"

set "LOGFILE=%~dp0startup_log.txt"

rem Initialize startup log
echo ==================================== > "%LOGFILE%"
echo Dragon Pro - Startup Log >> "%LOGFILE%"
echo Date: %date% %time% >> "%LOGFILE%"
echo ==================================== >> "%LOGFILE%"

cls
call :Log "===================================="
call :Log "   Dragon Pro - Starting Project"
call :Log "===================================="
echo.

rem ---------------------------------------------------------
rem 1. Check XAMPP & Apache / MySQL
rem ---------------------------------------------------------
call :Log "[1/4] Checking XAMPP services..."

rem Check Apache
tasklist /FI "IMAGENAME eq httpd.exe" 2>nul | find /I "httpd.exe" >nul
if errorlevel 1 (
    call :Log "[!] Apache is not running. Attempting to start..."
    if exist "C:\xampp\apache_start.bat" (
        start "" "C:\xampp\apache_start.bat"
        timeout /t 2 /nobreak >nul
    ) else if exist "C:\xampp\xampp-control.exe" (
        start "" "C:\xampp\xampp-control.exe"
        timeout /t 3 /nobreak >nul
    ) else (
        call :Log "[Warning] XAMPP not found at C:\xampp. Please start Apache manually."
    )
) else (
    call :Log "[OK] Apache is already running."
)

rem Check MySQL
tasklist /FI "IMAGENAME eq mysqld.exe" 2>nul | find /I "mysqld.exe" >nul
if errorlevel 1 (
    call :Log "[!] MySQL is not running. Attempting to start..."
    if exist "C:\xampp\mysql_start.bat" (
        start "" "C:\xampp\mysql_start.bat"
        timeout /t 2 /nobreak >nul
    ) else (
        call :Log "[Warning] Please ensure MySQL is started via XAMPP."
    )
) else (
    call :Log "[OK] MySQL is already running."
)

echo.
rem ---------------------------------------------------------
rem 2. Check Node.js and NPM
rem ---------------------------------------------------------
call :Log "[2/4] Checking Node.js & npm..."

where node >nul 2>&1
if errorlevel 1 (
    call :Log "[!] Node.js not detected in system PATH."
    call :Log "[>] Attempting automatic Node.js LTS setup..."
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = 3072; (New-Object Net.WebClient).DownloadFile('https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi', 'nodejs_installer.msi')"
    if exist "nodejs_installer.msi" (
        call :Log "[>] Installing Node.js LTS..."
        msiexec /i nodejs_installer.msi /passive /norestart
        del /f /q nodejs_installer.msi >nul 2>&1
        call :Log "[OK] Node.js installed. Please restart start.bat."
        pause
        exit /b 0
    ) else (
        call :Log "[FATAL ERROR] Node.js not found. Please run install.bat or install from https://nodejs.org/"
        goto :EndError
    )
)

for /f "tokens=*" %%i in ('node -v') do set "NODE_VER=%%i"
call :Log "[OK] Node is available: %NODE_VER%"

where npm.cmd >nul 2>&1
if errorlevel 1 (
    call :Log "[FATAL ERROR] npm.cmd not found in PATH."
    goto :EndError
)

for /f "tokens=*" %%i in ('call npm.cmd -v') do set "NPM_VER=%%i"
call :Log "[OK] npm.cmd is available: v%NPM_VER%"

echo.
rem ---------------------------------------------------------
rem 3. Check Packages (node_modules)
rem ---------------------------------------------------------
call :Log "[3/4] Checking dependencies..."
if not exist "node_modules" (
    call :Log "[Wait] Installing project packages (this may take a few minutes)..."
    call :Log "       >> Please wait, do not close the window..."
    
    call npm.cmd install >> "%LOGFILE%" 2>&1
    if errorlevel 1 (
        call :Log "[!] Standard npm install had warnings, retrying with --legacy-peer-deps..."
        call npm.cmd install --legacy-peer-deps >> "%LOGFILE%" 2>&1
    )
    
    if errorlevel 1 (
        call :Log "[FATAL ERROR] npm install failed. Check startup_log.txt"
        goto :EndError
    ) else (
        call :Log "[OK] Packages installed successfully."
    )
) else (
    call :Log "[OK] Packages are already installed."
)

echo.
rem ---------------------------------------------------------
rem 4. Start Production Server & Launch Browser
rem ---------------------------------------------------------
call :Log "[4/4] Starting server and launching application..."
if not exist "dist" (
    call :Log "[Wait] Building application for the first time..."
    call npm.cmd run build >> "%LOGFILE%" 2>&1
)
start "Dragon Pro Server" cmd /k "cd /d %~dp0 && npm.cmd run preview"

timeout /t 3 /nobreak >nul
call :Log "Opening browser at http://localhost:3000..."
start http://localhost:3000

echo.
call :Log "===================================="
call :Log "   Dragon Pro is now RUNNING!"
call :Log "===================================="
call :Log "URL: http://localhost:3000"

rem Auto-register background scheduler if available
if exist "C:\xampp\php\php.exe" (
    if exist "%~dp0components\auto_register_scheduler.php" (
        "C:\xampp\php\php.exe" "%~dp0components\auto_register_scheduler.php" >> "%LOGFILE%" 2>&1
    )
)

goto :EndSuccess

rem ---------------------------------------------------------
rem Subroutines
rem ---------------------------------------------------------

:EndError
echo.
echo ========================================================
color 0C
echo  [!] The startup stopped due to an error.
echo  [!] Please check 'startup_log.txt' for details.
echo ========================================================
echo.
pause
exit /b 1

:EndSuccess
echo.
echo --------------------------------------------------------
echo Server is running. Close the Dev Server window to stop.
echo --------------------------------------------------------
echo.
pause
exit /b 0

:Log
echo %~1
echo [%time%] %~1 >> "%LOGFILE%"
exit /b