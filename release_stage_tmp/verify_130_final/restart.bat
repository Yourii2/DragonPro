@echo off
chcp 65001 >nul
title Dragon Pro - Restart Project
color 0C

echo ====================================
echo   Dragon Pro - Restarting Project
echo ====================================
echo.

:: Stopping old processes
echo [1/3] Stopping old processes...

:: Finding and closing node.exe processes
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Stopping Node.js processes...
    taskkill /F /IM node.exe >nul 2>&1
    echo ✓ Node.js processes stopped.
) else (
    echo ✓ No Node.js processes are running.
)

timeout /t 2 /nobreak >nul

:: Checking if XAMPP is running
echo.
echo [2/3] Checking XAMPP status...
tasklist /FI "IMAGENAME eq httpd.exe" 2>NUL | find /I /N "httpd.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✓ Apache is already running.
) else (
    echo ✗ Apache is not running, starting it...
    start "" "C:\xampp\xampp-control.exe"
    timeout /t 5 /nobreak >nul
    echo ✓ XAMPP started.
)

:: Checking if MySQL is running
tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I /N "mysqld.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✓ MySQL is already running.
) else (
    echo ✗ MySQL is not running, starting it...
    start "" "C:\xampp\xampp-control.exe"
    timeout /t 5 /nobreak >nul
    echo ✓ MySQL started.
)

echo.
echo [3/3] Starting development server...
start cmd /k "npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo Opening browser...
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo.
echo ====================================
echo     Project restarted successfully!
echo ====================================
echo.
echo The browser will open automatically at:
echo http://localhost:3000
echo.
echo To stop the project, close the development server window.
echo.
pause
