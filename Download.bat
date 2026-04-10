@echo off
REM Download.bat - download latest release, include DB schema-only backup, and update installer schema
setlocal

set SCRIPT_DIR=%~dp0
set BACKUP_DIR=%SCRIPT_DIR%backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo === Download updater ===
echo Leave prompts empty to skip the step.

set /p RELEASE_URL=Enter release ZIP URL (or press Enter to skip):
set /p DB_URL=Enter full DB dump URL (sql) (or press Enter to skip):
set /p MYSQL_HOST=MySQL host (default localhost):
if "%MYSQL_HOST%"=="" set MYSQL_HOST=localhost
set /p MYSQL_USER=MySQL user (default root):
if "%MYSQL_USER%"=="" set MYSQL_USER=root
set /p MYSQL_PASS=MySQL password (you may leave empty):
set /p MYSQL_DB=Database name to dump schema-only (leave empty to skip):

REM 1) Create schema-only (no data) dump if DB name provided
if not "%MYSQL_DB%"=="" (
  echo Locating mysqldump...
  for /f "delims=" %%i in ('where mysqldump 2^>nul') do set MYSQLDUMP=%%i
  if not defined MYSQLDUMP set MYSQLDUMP=C:\xampp\mysql\bin\mysqldump.exe
  if exist "%MYSQLDUMP%" (
    echo Creating schema-only dump (no data)...
    "%MYSQLDUMP%" -h "%MYSQL_HOST%" -u "%MYSQL_USER%" -p"%MYSQL_PASS%" --no-data "%MYSQL_DB%" > "%BACKUP_DIR%\%MYSQL_DB%-schema-empty.sql"
    if errorlevel 1 (
      echo Error occurred while creating schema dump.
    ) else (
      echo Schema-only dump created: %BACKUP_DIR%\%MYSQL_DB%-schema-empty.sql

      REM Backup existing services/dbSchema.ts
      if exist "%SCRIPT_DIR%services\dbSchema.ts" (
        copy /Y "%SCRIPT_DIR%services\dbSchema.ts" "%BACKUP_DIR%\dbSchema.ts.bak" >nul
      )

      REM Update services/dbSchema.ts with the generated schema
      echo Updating services\dbSchema.ts from generated schema...
      powershell -NoProfile -Command "try{ $schema=Get-Content -Raw -LiteralPath '%BACKUP_DIR%\\%MYSQL_DB%-schema-empty.sql'; $schema = $schema -replace ([char]96),'\\`'; $here = @\"export const SQL_SCHEMA = `\n$schema\n`\"@; Set-Content -LiteralPath '%SCRIPT_DIR%services\\dbSchema.ts' -Value $here -Encoding UTF8; exit 0 } catch { exit 1 }"
      if errorlevel 1 (
        echo Failed to update services\dbSchema.ts (see above).
      ) else (
        echo services\dbSchema.ts updated successfully.
      )
    )
  ) else (
    echo mysqldump not found. Ensure MySQL or XAMPP is installed and on PATH.
  )
) else (
  echo Skipped schema-only dump.
)

REM 2) Download full DB dump if URL provided
if not "%DB_URL%"=="" (
  echo Downloading full DB dump...
  powershell -Command "try{ Invoke-WebRequest -Uri '%DB_URL%' -OutFile '%BACKUP_DIR%\\db_full.sql' -UseBasicParsing; exit 0 } catch { exit 1 }"
  if errorlevel 1 echo Failed to download DB dump.
) else echo Skipped downloading full DB dump.

REM 3) Download and extract release ZIP if URL provided
if not "%RELEASE_URL%"=="" (
  set TEMP_ZIP=%BACKUP_DIR%\release.zip
  echo Downloading release ZIP...
  powershell -Command "try{ Invoke-WebRequest -Uri '%RELEASE_URL%' -OutFile '%TEMP_ZIP%' -UseBasicParsing; exit 0 } catch { exit 1 }"
  if errorlevel 1 (
    echo Failed to download release ZIP.
  ) else (
    echo Extracting ZIP...
    if exist "%SCRIPT_DIR%update_tmp" rd /s /q "%SCRIPT_DIR%update_tmp"
    mkdir "%SCRIPT_DIR%update_tmp"
    powershell -Command "Expand-Archive -Path '%TEMP_ZIP%' -DestinationPath '%SCRIPT_DIR%update_tmp' -Force"
    echo Copying files to project root...
    xcopy "%SCRIPT_DIR%update_tmp\*" "%SCRIPT_DIR%" /E /H /Y /I
    rd /s /q "%SCRIPT_DIR%update_tmp"
    del "%TEMP_ZIP%"
    echo Update finished.
  )
) else echo Skipped downloading release.

echo.
echo Backups and generated files are in %BACKUP_DIR%
echo - Schema-only file: %BACKUP_DIR%\%MYSQL_DB%-schema-empty.sql (if created)
echo - Full DB dump: %BACKUP_DIR%\db_full.sql (if downloaded)
echo - services/dbSchema.ts was replaced with the generated schema (backup created).

pause
