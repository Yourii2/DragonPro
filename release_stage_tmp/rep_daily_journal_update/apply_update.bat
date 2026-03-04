@echo off
REM Apply rep_daily_journal migration and recompute entries
SETLOCAL ENABLEDELAYEDEXPANSION
set FROM=%1
set TO=%2
if "%FROM%"=="" (
  for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command "(Get-Date).AddDays(-90).ToString('yyyy-MM-dd')"`) do set FROM=%%a
)
if "%TO%"=="" (
  for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"`) do set TO=%%a
)

echo Running migrations...
php migrations/run_updates.php
if errorlevel 1 (
  echo migrations/run_updates.php failed
  exit /b 1
)
echo Recomputing rep_daily_journal from %FROM% to %TO%...
php scripts/recompute_rep_daily_journal.php all %FROM% %TO%
if errorlevel 1 (
  echo recompute_rep_daily_journal.php failed
  exit /b 1
)
echo Running optional index fix...
php tools/fix_rep_daily_journal_index.php
echo Done.
ENDLOCAL