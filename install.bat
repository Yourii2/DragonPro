:: آخر تحديث: 2026-02-11 (إصدار 1.0.4)
@echo off
chcp 65001 >nul
title Dragon ERP - Installer
color 0A

setlocal enableextensions
cd /d "%~dp0"

cls

:: دعم اللغة العربية والرموز
chcp 65001 >nul
title Dragon ERP Pro System
color 0b

echo ====================================
echo.
echo    [ DRAGON ERP PRO - SYSTEM READY ]
echo.

echo ====================================
echo           DRAGON ERP
echo            INSTALLER
echo ====================================
echo.

:: Check Node.js
echo [1/7] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X Node.js is not installed.
    echo Downloading and installing Node.js...
    powershell -Command "& {Invoke-WebRequest -Uri https://nodejs.org/dist/v18.17.1/node-v18.17.1-x64.msi -OutFile nodejs_installer.msi},"
    echo Installing Node.js...
    msiexec /i nodejs_installer.msi /quiet /norestart
    echo Please restart your computer after Node.js installation completes.
    echo Then run this installer again.
    pause
    exit /b 1
)
echo OK Node.js detected.

:: Check npm
echo.
echo [2/7] Checking npm...
call npm.cmd --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X npm is not available.
    echo This usually happens when Node.js is not properly installed.
    echo Please reinstall Node.js from: https://nodejs.org/
    echo Then run this installer again.
    pause
    exit /b 1
)
echo OK npm detected.

:: Install dependencies
echo.
echo [3/7] Installing dependencies...
if exist package-lock.json goto USE_CI
goto USE_INSTALL

:USE_CI
echo - package-lock.json found: using npm ci
call npm.cmd ci
if not "%errorlevel%"=="0" goto CI_FAILED
goto AFTER_INSTALL

:CI_FAILED
echo ! npm ci failed (files may be in use). Falling back to npm install...
call npm.cmd install
goto AFTER_INSTALL

:USE_INSTALL
echo - package-lock.json not found: using npm install
call npm.cmd install

:AFTER_INSTALL
if %errorlevel% neq 0 (
    echo X Failed to install dependencies.
    pause
    exit /b 1
)
echo OK Dependencies installed.

:: Verify required packages
echo.
echo [4/7] Verifying required packages (jsbarcode, sweetalert2)...
call npm.cmd ls jsbarcode sweetalert2 --depth=0 >nul 2>&1
if %errorlevel% neq 0 (
    echo ! Some required packages were not found. Installing them...
    call npm.cmd install jsbarcode sweetalert2
    if %errorlevel% neq 0 (
        echo X Failed to install required packages.
        pause
        exit /b 1
    )
)
echo OK Required packages are present.

:: Verify config files exist (do not overwrite)
echo.
echo [5/7] Verifying config files...
if not exist "tailwind.config.js" (
    echo X Missing: tailwind.config.js
    echo Creating basic tailwind.config.js...
    echo module.exports = {^>^> content: [^>^> "./index.html",^>^> "./src/**/*.{vue,js,ts,jsx,tsx}"^>^> ],^>^> theme: {^>^> extend: {},^>^> },^>^> plugins: [],^>^> } > tailwind.config.js
)
if not exist "postcss.config.js" (
    echo X Missing: postcss.config.js
    echo Creating basic postcss.config.js...
    echo module.exports = {^>^> plugins: {^>^> tailwindcss: {},^>^> autoprefixer: {},^>^> },^>^> } > postcss.config.js
)
if not exist "vite.config.ts" (
    echo X Missing: vite.config.ts
    echo Creating basic vite.config.ts...
    echo import { defineConfig } from 'vite';
    import vue from '@vitejs/plugin-vue';
    ^// https://vitejs.dev/config/
    export default defineConfig({
      plugins: [vue()],
    }); > vite.config.ts
)
echo OK Config files found.

:: Build test
echo.
echo [6/7] Running build test...
call npm.cmd run build
if %errorlevel% neq 0 (
    echo X Build failed.
    echo Tip: If PowerShell blocks scripts, run this file from CMD.
    pause
    exit /b 1
)
echo OK Build succeeded.

:: Server requirements reminder
echo.
echo [7/7] Server prerequisites...
echo - Start Apache and MySQL from XAMPP
echo - Place this project under: xampp\htdocs
echo - Then run start.bat (or npm.cmd run dev)

@echo off
:: إعدادات البرنامج
set "APP_NAME=Dragon Pro"
set "APP_VERSION=v1.0.4"
set "WEB_APP_URL=https://script.google.com/macros/s/AKfycbyMs5HEkTJ7LeMXPDVPn7EXu-pLwa9tiYgO26s-rPUc4CxLahyZgvqRM7cRrSVf3-1F4g/exec"

:: 1. التحقق من وجود RustDesk وتثبيته إذا لم يكن موجودًا
echo.
echo Checking RustDesk...
if not exist "C:\Program Files\RustDesk\rustdesk.exe" (
    echo RustDesk is not installed. Downloading and installing...
    powershell -Command "& {Invoke-WebRequest -Uri https://github.com/rustdesk/rustdesk/releases/download/1.2.0/rustdesk-1.2.0-windows-x64.exe -OutFile rustdesk_installer.exe},"
    echo Installing RustDesk...
    rustdesk_installer.exe /S
    echo RustDesk installation completed.
)

:: تعيين كلمة مرور RustDesk فقط عند تمريرها من البيئة
if exist "C:\Program Files\RustDesk\rustdesk.exe" (
    if defined RUSTDESK_PASSWORD (
        "C:\Program Files\RustDesk\rustdesk.exe" --set-password "%RUSTDESK_PASSWORD%"
    ) else (
        echo تخطى إعداد كلمة مرور RustDesk لعدم وجود المتغير RUSTDESK_PASSWORD.
    )
)

:: 2. الحصول على RustDesk ID الخاص بالعميل
for /f "tokens=*" %%a in ('"C:\Program Files\RustDesk\rustdesk.exe" --get-id') do set R_ID=%%a
if not defined R_ID (
    echo Unable to get RustDesk ID. RustDesk might not be running.
    echo Please start RustDesk and try again.
    pause
    exit /b 1
)

:: 3. إرسال البيانات إلى شيت جوجل (التسجيل الأولي)
:: تم إضافة صمت للطلب عشان ميعطلش الشاشة
powershell -Command "Invoke-WebRequest -Uri '%WEB_APP_URL%?app=%APP_NAME%&version=%APP_VERSION%&name=%COMPUTERNAME%&id=%R_ID%' -Method Get" >nul 2>&1

echo.
echo ====================================
echo        INSTALL COMPLETED
echo ====================================
echo.
echo You can now run the project using:
echo - start.bat (normal start)
echo - restart.bat (restart)
echo.
pause
