@echo off
chcp 65001 >nul
setlocal enableextensions
cd /d "%~dp0"
title DragonPro - Create Release Zip

echo ====================================
echo   DragonPro - Release Packager
echo ====================================
echo.

set "VERSION=%~1"
if "%VERSION%"=="" (
  set /p "VERSION=Enter version (e.g. 1.0.0): "
)
if "%VERSION%"=="" (
  echo Version is required.
  exit /b 1
)

for /f %%i in ('powershell -NoProfile -Command "(Get-Date).ToString('yyyy-MM-dd')"') do set "BUILD_DATE=%%i"

echo [1/5] Writing version.json and updating package.json...
(
  echo {
  echo   "version": "%VERSION%",
  echo   "buildDate": "%BUILD_DATE%"
  echo }
) > "%cd%\version.json"

rem Update version in package.json via Node (avoids BOM/encoding issues)
node -e "const fs=require('fs');const f='package.json';const p=JSON.parse(fs.readFileSync(f,'utf8'));p.version='%VERSION%';fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n','utf8');"

echo [2/5] Building frontend (vite build)...
if not exist "node_modules" (
  echo - Installing packages...
  call npm.cmd install
  if errorlevel 1 exit /b 1
)
call npm.cmd run build
if errorlevel 1 (
  echo Build failed.
  exit /b 1
)

echo [3/5] Staging release files...
set "STAGE_ROOT=%cd%\release_stage"
set "STAGE=%STAGE_ROOT%\DragonPro_%VERSION%"

if exist "%STAGE_ROOT%" rmdir /s /q "%STAGE_ROOT%"
mkdir "%STAGE%" >nul

rem Runtime package layout:
rem - index.html + assets/ at project root (Apache serves root)
rem - components/ for PHP APIs

xcopy /e /i /y "components" "%STAGE%\components" >nul
rem Remove files not needed in production (source, debug, temp)
for /r "%STAGE%\components" %%f in (*.tsx *.ts *.log *.tmp *.bak) do del /f /q "%%f" >nul 2>nul
if exist "%STAGE%\components\test.php" del /f /q "%STAGE%\components\test.php" >nul 2>nul
if exist "%STAGE%\components\test_db.php" del /f /q "%STAGE%\components\test_db.php" >nul 2>nul

if exist "migrations" (
  xcopy /e /i /y "migrations" "%STAGE%\migrations" >nul
)

if exist "tools" (
  xcopy /e /i /y "tools" "%STAGE%\tools" >nul
)

if exist "dist\assets" (
  xcopy /e /i /y "dist\assets" "%STAGE%\assets" >nul
) else (
  echo Missing dist\assets. Did build succeed?
  exit /b 1
)

if exist "dist\index.html" (
  copy /y "dist\index.html" "%STAGE%\index.html" >nul
) else (
  echo Missing dist\index.html. Did build succeed?
  exit /b 1
)

if exist "Dragon.png" copy /y "Dragon.png" "%STAGE%\Dragon.png" >nul
if exist "metadata.json" copy /y "metadata.json" "%STAGE%\metadata.json" >nul
if exist "update-config.json" copy /y "update-config.json" "%STAGE%\update-config.json" >nul
if exist "version.json" copy /y "version.json" "%STAGE%\version.json" >nul

rem DO NOT ship customer-specific files
if exist "%STAGE%\config.php" del /f /q "%STAGE%\config.php" >nul 2>nul
if exist "%STAGE%\Dragon.lic" del /f /q "%STAGE%\Dragon.lic" >nul 2>nul
if exist "%STAGE%\nexus.lic" del /f /q "%STAGE%\nexus.lic" >nul 2>nul

echo [4/5] Creating zip...
set "OUTDIR=%cd%\releases"
if not exist "%OUTDIR%" mkdir "%OUTDIR%" >nul
set "ZIP=%OUTDIR%\DragonPro_v%VERSION%.zip"
if exist "%ZIP%" del /f /q "%ZIP%" >nul

rem Copy stage to TEMP to avoid VS Code file-watcher locks
set "TMPSTAGE=%TEMP%\DragonPro_stage_%VERSION%"
if exist "%TMPSTAGE%" rmdir /s /q "%TMPSTAGE%"
xcopy /e /i /q "%STAGE%\*" "%TMPSTAGE%\" >nul

powershell -NoProfile -Command "Compress-Archive -Path '%TMPSTAGE%\*' -DestinationPath '%ZIP%' -Force"
rmdir /s /q "%TMPSTAGE%" >nul 2>nul

if not exist "%ZIP%" (
  echo Failed to create zip.
  exit /b 1
)

echo [5/5] Done.
echo Output: %ZIP%
echo.
echo Next:
echo - Create a GitHub Release with tag: v%VERSION%
echo - Upload this zip as the Release asset
echo.
if "%~1"=="" pause
