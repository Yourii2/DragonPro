@echo off
chcp 65001 >nul
echo ====================================================
echo  إعادة إنشاء وترميم ملف الترخيص Dragon.lic
echo ====================================================
echo.
if exist "C:\xampp\php\php.exe" (
    "C:\xampp\php\php.exe" "%~dp0components\recreate_license.php"
) else (
    php "%~dp0components\recreate_license.php"
)
echo.
echo ====================================================
echo اكتملت العملية. اضغط أي مفتاح للإغلاق...
pause >nul
