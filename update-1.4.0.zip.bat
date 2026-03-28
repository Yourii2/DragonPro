@echo off
echo Nexus ERP v1.4.0 Update - Auto Install...
echo.

REM Stop services if running
taskkill /f /im php.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1

REM Backup current
if not exist backups mkdir backups
xcopy components components.bak /E /I /Y >nul
xcopy scripts scripts.bak /E /I /Y >nul

REM Copy new files (assume extracted to temp)
xcopy updated\components\* components\ /Y
xcopy updated\scripts\* scripts\ /Y
xcopy updated\migrations\* migrations\ /Y

REM Run migrations
php migrations/run_updates.php
php scripts/seed_permissions.php
php scripts/set_admin_password.php defaultpass 1 true

REM Cleanup
del /q updated\*.* >nul 2>&1
rmdir /s /q updated >nul 2>&1

echo ✅ Update complete! Default admin pass: defaultpass
pause

