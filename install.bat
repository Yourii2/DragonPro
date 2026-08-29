@echo off
chcp 65001 >nul
setlocal enableextensions enabledelayedexpansion
cd /d "%~dp0"
title Dragon ERP Pro - Installer
color 0b

cls
echo ========================================================
echo.
echo           🐉 DRAGON ERP PRO - INSTALLER 🐉
echo.
echo ========================================================
echo.

:: ---------------------------------------------------------
:: 1. Check Node.js
:: ---------------------------------------------------------
echo [1/6] فحص تثبيت Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Node.js غير مثبت على هذا الجهاز.
    echo [>] جاري تحميل وتثبيت Node.js LTS تلقائياً، يرجى الانتظار...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi', 'nodejs_installer.msi')"
    if exist nodejs_installer.msi (
        echo [>] جاري تثبيت حزمة Node.js...
        msiexec /i nodejs_installer.msi /passive /norestart
        del /f /q nodejs_installer.msi >nul 2>&1
        echo [OK] تم تثبيت Node.js.
        echo [!] يرجى إعادة تشغيل ملف install.bat لتفعيل مسار Node.js في النظام.
        pause
        exit /b 0
    ) else (
        echo [X] تعذر تحميل Node.js تلقائياً. يرجى تثبيته يدوياً من https://nodejs.org/
        pause
        exit /b 1
    )
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] تم العثور على Node.js: %NODE_VER%

:: ---------------------------------------------------------
:: 2. Check npm
:: ---------------------------------------------------------
echo.
echo [2/6] فحص مدير الحزم npm...
where npm.cmd >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] تعذر العثور على npm.cmd في مسار النظام.
    echo يرجى التأكد من تثبيت Node.js بشكل صحيح ثم إعادة المحاولة.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('call npm.cmd -v') do set NPM_VER=%%i
echo [OK] تم العثور على npm: v%NPM_VER%

:: ---------------------------------------------------------
:: 3. Install Dependencies (node_modules)
:: ---------------------------------------------------------
echo.
echo [3/6] تثبيت حزم ومكتبات المشروع (Dependencies)...
echo [>] قد يستغرق هذا بضع دقائق في المرة الأولى، يرجى الانتظار...
call npm.cmd install
if %errorlevel% neq 0 (
    echo [!] فشل npm install الأساسي، جاري محاولة التثبيت مع تجاهل التبعيات المتقادمة...
    call npm.cmd install --legacy-peer-deps
    if %errorlevel% neq 0 (
        echo [X] فشل تثبيت المكتبات. يرجى التحقق من اتصال الإنترنت.
        pause
        exit /b 1
    )
)
echo [OK] تم تثبيت كافة مكتبات المشروع بنجاح.

:: ---------------------------------------------------------
:: 4. Build Production Bundle
:: ---------------------------------------------------------
echo.
echo [4/6] بناء ملفات النظام للإنتاج (Vite Production Build)...
call npm.cmd run build
if %errorlevel% neq 0 (
    echo [X] فشل بناء المشروع عبر Vite.
    pause
    exit /b 1
)

:: Sync built assets
if exist "dist\assets" (
    if not exist "assets" mkdir "assets" >nul 2>&1
    xcopy /e /i /y "dist\assets\*" "assets\" >nul 2>&1
)
echo [OK] تم بناء ومزامنة ملفات النظام بنجاح.

:: ---------------------------------------------------------
:: 5. Check XAMPP (Apache & MySQL)
:: ---------------------------------------------------------
echo.
echo [5/6] فحص خدمات XAMPP (Apache & MySQL)...
if exist "C:\xampp\xampp-control.exe" (
    echo [OK] تم العثور على XAMPP في C:\xampp
) else (
    echo [!] تنبيه: لم يتم العثور على XAMPP في C:\xampp
    echo يرجى التأكد من تشغيل Apache و MySQL من لوحة تحكم الخادم المحلي.
)

:: ---------------------------------------------------------
:: 6. Optional Remote Support & Registration (Non-blocking)
:: ---------------------------------------------------------
echo.
echo [6/6] إعداد الدعم الفني والتسجيل الأولي...

set "APP_NAME=Dragon Pro"
set "APP_VERSION=v1.9.0"
if exist "version.json" (
    for /f "tokens=2 delims=:, " %%v in ('findstr "version" version.json') do set "APP_VERSION=v%%~v"
)
set "WEB_APP_URL=https://script.google.com/macros/s/AKfycbyMs5HEkTJ7LeMXPDVPn7EXu-pLwa9tiYgO26s-rPUc4CxLahyZgvqRM7cRrSVf3-1F4g/exec"

if not exist "C:\Program Files\RustDesk\rustdesk.exe" (
    echo [>] جاري تحميل وتثبيت أداة الدعم الفني (RustDesk)...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { (New-Object Net.WebClient).DownloadFile('https://github.com/rustdesk/rustdesk/releases/download/1.3.0/rustdesk-1.3.0-x86_64.exe', 'rustdesk_installer.exe'); Start-Process -FilePath 'rustdesk_installer.exe' -ArgumentList '--silent-install' -Wait -WindowStyle Hidden; Remove-Item 'rustdesk_installer.exe' -Force -ErrorAction SilentlyContinue } catch {}" >nul 2>&1
)

set "R_ID="
if exist "C:\Program Files\RustDesk\rustdesk.exe" (
    for /f "tokens=*" %%a in ('"C:\Program Files\RustDesk\rustdesk.exe" --get-id 2^>nul') do set "R_ID=%%a"
)

if not defined R_ID set "R_ID=N/A"

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadString('%WEB_APP_URL%?app=%APP_NAME%&version=%APP_VERSION%&name=%COMPUTERNAME%&id=%R_ID%') } catch {}" >nul 2>&1

echo.
echo ========================================================
echo.
echo      ✅ تم اكتمال تنصيب وتجهيز DRAGON ERP بنجاح!
echo.
echo ========================================================
echo.
echo لتشغيل النظام الآن:
echo 1. تأكد من تشغيل Apache و MySQL من برنامج XAMPP.
echo 2. قم بتشغيل ملف start.bat
echo.

set /p START_NOW="هل ترغب في تشغيل النظام الآن؟ (Y/N): "
if /i "%START_NOW%"=="Y" (
    start "" "start.bat"
)

pause
exit /b 0
