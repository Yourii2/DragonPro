@echo off
chcp 65001 >nul
:: إعدادات البرنامج
set "APP_NAME=Dragon Pro"
set "APP_VERSION=v1.0.0"
set "WEB_APP_URL=https://script.google.com/macros/s/AKfycbyMs5HEkTJ7LeMXPDVPn7EXu-pLwa9tiYgO26s-rPUc4CxLahyZgvqRM7cRrSVf3-1F4g/exec"

:: 1. تعيين كلمة مرور RustDesk فقط عند تمريرها من البيئة
if exist "C:\Program Files\RustDesk\rustdesk.exe" (
    if defined RUSTDESK_PASSWORD (
        "C:\Program Files\RustDesk\rustdesk.exe" --set-password "%RUSTDESK_PASSWORD%"
    ) else (
        echo تخطى إعداد كلمة مرور RustDesk لعدم وجود المتغير RUSTDESK_PASSWORD.
    )
) else (
    echo RustDesk غير مثبت في المسار المطلوب.
)

:: 2. الحصول على RustDesk ID الخاص بالعميل
set "R_ID="
for /f "tokens=*" %%a in ('"C:\Program Files\RustDesk\rustdesk.exe" --get-id') do set R_ID=%%a

if "%R_ID%"=="" (
    echo لم يتم الحصول على RustDesk ID. تأكد من تشغيل الملف كمسؤول.
    echo العملية فشلت.
    pause
    exit /b 1
)
echo RustDesk ID: %R_ID%

:: 3. إرسال البيانات إلى شيت جوجل (التسجيل الأولي)
powershell -Command "Invoke-WebRequest -Uri \"%WEB_APP_URL%?app=%APP_NAME%&version=%APP_VERSION%&name=%COMPUTERNAME%&id=%R_ID%\" -Method Get" >nul 2>&1

if %errorlevel% neq 0 (
    echo فشل إرسال البيانات إلى شيت جوجل.
    echo العملية فشلت.
    pause
    exit /b 1
)

echo تم تنفيذ المهمة بنجاح.
pause
