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

echo [1/5] Writing version.json...
(
  echo {
  echo   "version": "%VERSION%",
  echo   "buildDate": "%BUILD_DATE%"
  echo }
) > "%cd%\version.json"

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

where tar >nul 2>&1
if "%ERRORLEVEL%"=="0" (
  tar -a -c -f "%ZIP%" -C "%STAGE%" .
) else (
  powershell -NoProfile -Command "Compress-Archive -Path '%STAGE%\*' -DestinationPath '%ZIP%' -Force"
)

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
pause
