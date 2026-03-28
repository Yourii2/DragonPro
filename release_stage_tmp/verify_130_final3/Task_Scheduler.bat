@echo off
setlocal

rem Adjust PHP path if needed.
set "PHP_EXE=C:\xampp\php\php.exe"
set "BASE_DIR=C:\xampp\htdocs\Dragon"
set "LOG_DIR=%BASE_DIR%\logs"
set "LOG_FILE=%LOG_DIR%\task_scheduler.log"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

rem Run daily report and auto-backup using settings flags inside the scripts.
"%PHP_EXE%" "%BASE_DIR%\components\report_run.php" >> "%LOG_FILE%" 2>&1
"%PHP_EXE%" "%BASE_DIR%\components\backup_run.php" >> "%LOG_FILE%" 2>&1

endlocal

