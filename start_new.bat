@echo off
chcp 65001 >nul
title Dragon Pro - Start Project
color 0A

:: تأخير لضمان ظهور النافذة
timeout /t 2 /nobreak >nul

:: ضبط المسار الأساسي
setlocal enableextensions
cd /d "%~dp0"

:: إعداد ملف اللوج (سيكون بجانب السكريبت)
set LOGFILE="%~dp0startup_log.txt"

:: تهيئة/إضافة لملف اللوج مع التاريخ
if exist %LOGFILE% echo. >> %LOGFILE%
echo ==================================== >> %LOGFILE%
echo Dragon Pro - Startup Log >> %LOGFILE%
echo Date: %date% %time% >> %LOGFILE%
echo ==================================== >> %LOGFILE%

cls
call :Log "===================================="
call :Log "   Dragon Pro - Starting Project"
call :Log "===================================="
echo.

:: تأكد من أن النافذة تبقى مفتوحة لفترة كافية
echo Starting application, please wait...
timeout /t 3 /nobreak >nul

:: ---------------------------------------------------------
:: المرحلة الأولى: فحص خدمات XAMPP
:: ---------------------------------------------------------
call :Log "[1/4] Checking XAMPP status..."

:: التحقق من وجود XAMPP
if not exist "C:\xampp\xampp-control.exe" (
    call :Log "[ERROR] XAMPP is not installed. Please install XAMPP from https://www.apachefriends.org/"
    call :Log "After installing XAMPP, try running start.bat again."
    pause
    goto :EndError
)

:: فحص أباتشي
tasklist /FI "IMAGENAME eq httpd.exe" 2>NUL | find /I "httpd.exe" >NUL
if errorlevel 1 (
    call :Log "[Wait] Apache is not running. Attempting to start XAMPP Control..."
    start "" "C:\xampp\xampp-control.exe"
    timeout /t 5 /nobreak >nul
    call :Log "[INFO] XAMPP Control Panel opened. Please start Apache manually."
    call :Log "[INFO] After starting Apache, press any key to continue..."
    pause >nul
    call :Log "[OK] Continuing with startup process..."
) else (
    call :Log "[OK] Apache is already running."
)

:: فحص قواعد البيانات MySQL
tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I "mysqld.exe" >NUL
if errorlevel 1 (
    call :Log "[Warning] MySQL is not running. Please ensure MySQL is started via XAMPP."
    call :Log "[INFO] You can start MySQL from the XAMPP Control Panel."
) else (
    call :Log "[OK] MySQL is already running."
)

timeout /t 2 /nobreak >nul
echo.
:: ---------------------------------------------------------
:: المرحلة الثانية: فحص Node.js و NPM
:: ---------------------------------------------------------
call :Log "[2/4] Checking Node & NPM availability..."

where node >nul 2>&1
if errorlevel 1 (
    call :Log "[ERROR] Node.js not found in PATH."
    call :Log "[INFO] Installing Node.js..."
    powershell -Command "& {Invoke-WebRequest -Uri https://nodejs.org/dist/v18.17.1/node-v18.17.1-x64.msi -OutFile nodejs_installer.msi},"
    call :Log "[INFO] Installing Node.js... This may take a few minutes."
    msiexec /i nodejs_installer.msi /quiet /norestart
    call :Log "[INFO] Node.js installation completed. Please restart your computer and try again."
    pause
    goto :EndError
)

:: استخراج نسخة Node بأمان
node -v > temp_node.txt
set /p NODE_VER=<temp_node.txt
del temp_node.txt
call :Log "[OK] Node is available: %NODE_VER%"

where npm.cmd >nul 2>&1
if errorlevel 1 (
    call :Log "[ERROR] npm.cmd not found in PATH."
    call :Log "[INFO] This usually happens when Node.js is not properly installed."
    call :Log "[INFO] Please reinstall Node.js from: https://nodejs.org/"
    pause
    goto :EndError
)

:: استخراج نسخة NPM بأمان
call npm.cmd -v > temp_npm.txt
set /p NPM_VER=<temp_npm.txt
del temp_npm.txt
call :Log "[OK] npm.cmd is available: v%NPM_VER%"

timeout /t 2 /nobreak >nul
echo.
:: ---------------------------------------------------------
:: المرحلة الثالثة: فحص الباقات (node_modules) وتثبيتها
:: ---------------------------------------------------------
call :Log "[3/4] Checking for packages..."
if not exist "node_modules" (
    call :Log "[Wait] Installing packages (this may take a few minutes)..."
    call :Log "       >> Please wait, do not close the window..."
    timeout /t 2 /nobreak >nul

    :: تشغيل التثبيت وتوجيه الأخطاء إلى ملف اللوج
    echo Running npm install... This may take several minutes.
    call npm.cmd install >> %LOGFILE% 2>&1

    if errorlevel 1 (
        call :Log "[ERROR] npm install failed!"
        call :Log "[INFO] Check the log file for details: %LOGFILE%"
        call :Log "[INFO] You may need to run: npm install --force"
        call :Log "[INFO] Or try: npm cache clean --force && npm install"
        pause
        goto :EndError
    ) else (
        call :Log "[OK] Packages installed successfully."
    )
) else (
    call :Log "[OK] Packages are already installed."
)

timeout /t 2 /nobreak >nul
echo.
:: ---------------------------------------------------------
:: المرحلة الرابعة: تشغيل السيرفر وفتح المتصفح
:: ---------------------------------------------------------
call :Log "[4/4] Starting production server..."
echo Starting production server...

rem Check if application build is needed:
rem 1. dist folder doesn't exist
rem 2. dist/index.html doesn't exist
rem 3. dist/.version doesn't match version.json
rem 4. Any source file is newer than dist/index.html
rem 5. User passed --build or -b argument
set "NEED_BUILD=0"
if not exist "dist" set "NEED_BUILD=1"
if not exist "dist\index.html" set "NEED_BUILD=1"
if not exist "dist\.version" set "NEED_BUILD=1"
if "%~1"=="--build" set "NEED_BUILD=1"
if "%~1"=="-b" set "NEED_BUILD=1"

if "!NEED_BUILD!"=="0" (
    node -e "try { const fs=require('fs'); const curV=require('./version.json').version; const builtV=fs.readFileSync('dist/.version','utf8').trim(); if(curV!==builtV){ process.exit(1); } const distM=fs.statSync('dist/index.html').mtimeMs; const checks=['App.tsx','index.html','index.tsx','components','constants.tsx','types.ts']; for(const p of checks){ if(fs.existsSync(p)){ if(fs.statSync(p).mtimeMs>distM){ process.exit(1); } } } process.exit(0); } catch(e){ process.exit(1); }" >nul 2>&1
    if errorlevel 1 set "NEED_BUILD=1"
)

if "!NEED_BUILD!"=="1" (
    call :Log "[Wait] Detected updates or missing build. Building application (npm run build)..."
    call :Log "       >> Please wait, this takes a few seconds..."
    call npm.cmd run build >> %LOGFILE% 2>&1
    if errorlevel 1 (
        call :Log "[!] Build had warnings or errors, check startup_log.txt"
    ) else (
        call :Log "[OK] Application built successfully."
        node -e "try { const fs=require('fs'); const v=require('./version.json').version; fs.writeFileSync('dist/.version', v); } catch(e){}" >nul 2>&1
    )
) else (
    call :Log "[OK] Application build is up to date."
)

rem Ensure ports 3000 and 3001 are free before starting
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @(3000, 3001); Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort } | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)
ping 127.0.0.1 -n 2 >nul 2>&1

set "PROJ_DIR=%~dp0"
if "%PROJ_DIR:~-1%"=="\" set "PROJ_DIR=%PROJ_DIR:~0,-1%"
start "Dragon Pro Server" /D "%PROJ_DIR%" cmd /k "title Dragon Pro Server (Port 3000) && npm.cmd run preview"

call :Log "Waiting for server to start..."
ping 127.0.0.1 -n 4 >nul 2>&1

call :Log "Opening browser..."
start http://localhost:3000

echo.
call :Log "===================================="
call :Log "   Dragon Pro is now RUNNING!"
call :Log "===================================="
call :Log "Server is running at: http://localhost:3000"
call :Log "To stop the server, close the server window."

if exist "C:\xampp\php\php.exe" (
    call :Log "Verifying daily report/backup scheduler..."
    "C:\xampp\php\php.exe" "%~dp0components\auto_register_scheduler.php" >> %LOGFILE% 2>&1
)

echo.
echo Press any key to close this window...
pause >nul

:: نهاية النجاح
goto :EndSuccess


:: ---------------------------------------------------------
:: دوال التحكم في النهاية (Subroutines)
:: ---------------------------------------------------------

:EndError
echo.
echo ========================================================
color 0C
echo  [!] The script stopped due to an error.
echo  [!] Please check 'startup_log.txt' for details.
echo ========================================================
echo.
pause
exit /b 1

:EndSuccess
echo.
echo To stop the project, close the development server window.
echo.
pause
exit /b 0

:: دالة الطباعة والكتابة في اللوج في نفس الوقت
:Log
echo %~1
echo [%time%] %~1 >> %LOGFILE%
exit /b
