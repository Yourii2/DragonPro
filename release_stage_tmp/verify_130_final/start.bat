@echo off
chcp 65001 >nul
title Dragon Pro - Start Project
color 0A

:: ضبط المسار الأساسي
setlocal enableextensions
cd /d "%~dp0"

:: إعداد ملف اللوج (سيكون بجانب السكريبت)
set LOGFILE="%~dp0startup_log.txt"

:: تفريغ/إنشاء ملف اللوج الجديد مع التاريخ
echo ==================================== > %LOGFILE%
echo Dragon Pro - Startup Log >> %LOGFILE%
echo Date: %date% %time% >> %LOGFILE%
echo ==================================== >> %LOGFILE%

cls
call :Log "===================================="
call :Log "   Dragon Pro - Starting Project"
call :Log "===================================="
echo.

:: ---------------------------------------------------------
:: المرحلة الأولى: فحص خدمات XAMPP
:: ---------------------------------------------------------
call :Log "[1/4] Checking XAMPP status..."

:: فحص أباتشي
tasklist /FI "IMAGENAME eq httpd.exe" 2>NUL | find /I "httpd.exe" >NUL
if errorlevel 1 (
    call :Log "[Wait] Apache is not running. Attempting to start XAMPP Control..."
    if exist "C:\xampp\xampp-control.exe" (
        start "" "C:\xampp\xampp-control.exe"
        timeout /t 4 /nobreak >nul
        call :Log "[OK] XAMPP Control launched. Please ensure Apache is green."
    ) else (
        call :Log "[Warning] XAMPP control not found at C:\xampp\xampp-control.exe"
    )
) else (
    call :Log "[OK] Apache is already running."
)

:: فحص قواعد البيانات MySQL
tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I "mysqld.exe" >NUL
if errorlevel 1 (
    call :Log "[Warning] MySQL is not running. Please ensure MySQL is started via XAMPP."
) else (
    call :Log "[OK] MySQL is already running."
)

echo.
:: ---------------------------------------------------------
:: المرحلة الثانية: فحص Node.js و NPM
:: ---------------------------------------------------------
call :Log "[2/4] Checking Node & NPM availability..."

where node >nul 2>&1
if errorlevel 1 (
    call :Log "[FATAL ERROR] Node.js not found in PATH."
    goto :EndError
)
:: استخراج نسخة Node بأمان
node -v > temp_node.txt
set /p NODE_VER=<temp_node.txt
del temp_node.txt
call :Log "[OK] Node is available: %NODE_VER%"

where npm.cmd >nul 2>&1
if errorlevel 1 (
    call :Log "[FATAL ERROR] npm.cmd not found in PATH."
    goto :EndError
)
:: استخراج نسخة NPM بأمان
call npm.cmd -v > temp_npm.txt
set /p NPM_VER=<temp_npm.txt
del temp_npm.txt
call :Log "[OK] npm.cmd is available: v%NPM_VER%"

echo.
:: ---------------------------------------------------------
:: المرحلة الثالثة: فحص الباقات (node_modules) وتثبيتها
:: ---------------------------------------------------------
call :Log "[3/4] Checking for packages..."
if not exist "node_modules" (
    call :Log "[Wait] Installing packages (this may take a few minutes)..."
    call :Log "       >> Please wait, do not close the window..."
    
    :: تشغيل التثبيت وتوجيه الأخطاء إلى ملف اللوج
    call npm.cmd install >> %LOGFILE% 2>&1
    
    if errorlevel 1 (
        call :Log "[FATAL ERROR] npm install failed!"
        goto :EndError
    ) else (
        call :Log "[OK] Packages installed successfully."
    )
) else (
    call :Log "[OK] Packages are already installed."
)

echo.
:: ---------------------------------------------------------
:: المرحلة الرابعة: تشغيل السيرفر وفتح المتصفح
:: ---------------------------------------------------------
call :Log "[4/4] Starting development server..."
start "Dragon Dev Server" cmd /k "cd /d %~dp0 && npm.cmd run dev"

timeout /t 3 /nobreak >nul
call :Log "Opening browser..."
start http://localhost:3000

echo.
call :Log "===================================="
call :Log "  Dragon started (development mode)"
call :Log "===================================="
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