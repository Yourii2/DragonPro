@echo off
SETLOCAL ENABLEDELAYEDEXPANSION
echo Preparing release 1.1.7
set RELEASE_DIR=releases\1.1.7
if not exist %RELEASE_DIR% mkdir %RELEASE_DIR%

echo Copying migration SQL files...
if exist migrations\*.sql copy /Y migrations\*.sql %RELEASE_DIR%\

echo Copying backup SQL files...
if exist backups\*.sql copy /Y backups\*.sql %RELEASE_DIR%\

echo Copying scripts...
if exist scripts\migrate_localstorage.php copy /Y scripts\migrate_localstorage.php %RELEASE_DIR%\

echo Copying components for release notes...
copy /Y components\localstorage_sync.php %RELEASE_DIR%\ >nul 2>&1
copy /Y components\get_settings.php %RELEASE_DIR%\ >nul 2>&1
copy /Y components\save_settings.php %RELEASE_DIR%\ >nul 2>&1

echo Copying release notes and version...
copy /Y RELEASE_NOTES_1.1.7.md %RELEASE_DIR%\ >nul 2>&1
copy /Y version.json %RELEASE_DIR%\ >nul 2>&1

echo Release package prepared in %RELEASE_DIR%
ENDLOCAL
pause
