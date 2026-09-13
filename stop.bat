@echo off
setlocal enableextensions
cd /d "%~dp0"
title Dragon Pro - Stop Project
color 0C

echo ====================================
echo     Dragon Pro - Stopping Project
echo ====================================
echo.

echo [1/3] Freeing ports 3000 and 3001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)

echo [2/3] Stopping Node.js processes...
taskkill /F /T /IM node.exe >nul 2>&1

echo.
echo Server stopped and ports 3000 and 3001 are now free.

echo.
echo [3/3] Do you want to stop XAMPP as well?
echo 1. Yes, stop XAMPP completely
echo 2. No, keep XAMPP running (default)
echo.
set "choice=2"
if "%~1"=="1" set "choice=1"
if "%~1"=="2" set "choice=2"
if "%~1"=="/all" set "choice=1"
if "%~1"=="" (
    set /p "choice=Choose a number (1 or 2, default is 2): "
)
if "%choice%"=="" set "choice=2"

if "%choice%"=="1" (
    echo.
    echo Stopping XAMPP...
    taskkill /F /T /IM httpd.exe >nul 2>&1
    taskkill /F /T /IM mysqld.exe >nul 2>&1
    echo XAMPP stopped.
) else (
    echo.
    echo XAMPP was kept running.
)

echo.
echo ====================================
echo     Project stopped successfully!
echo ====================================
echo.
echo To run the project again, use:
echo - start.bat for normal startup (port 3000)
echo - restart.bat to restart
echo.
if "%~1"=="" (
    timeout /t 3 /nobreak >nul
)
exit /b 0
