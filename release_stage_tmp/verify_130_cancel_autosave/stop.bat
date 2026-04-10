@echo off
chcp 65001 >nul
title Dragon Pro - Stop Project
title Dragon Pro - Stop Project
color 0C

echo ====================================
echo     Dragon Pro - Stopping Project
echo     Dragon Pro - Stopping Project
echo ====================================
echo.

:: Stopping Node.js processes
echo [1/2] Stopping Node.js processes...
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Stopping Node.js processes...
    taskkill /F /IM node.exe >nul 2>&1
    echo ✓ Node.js processes stopped.
) else (
    echo ✓ No Node.js processes are running.
)

timeout /t 1 /nobreak >nul

:: Option to stop XAMPP
echo.
echo [2/2] Do you want to stop XAMPP as well?
echo.
echo 1. Yes, stop XAMPP completely
echo 2. No, keep XAMPP running
echo.
set /p choice="Choose a number (1 or 2): "

if "%choice%"=="1" (
    echo.
    echo Stopping XAMPP...
    taskkill /F /IM httpd.exe >nul 2>&1
    taskkill /F /IM mysqld.exe >nul 2>&1
    echo ✓ XAMPP stopped.
) else (
    echo.
    echo ✓ XAMPP was kept running.
)

echo.
echo ====================================
echo     Project stopped successfully!
echo ====================================
echo.
echo To run the project again, use:
echo - start.bat for normal startup
echo - restart.bat to restart
echo.
pause
