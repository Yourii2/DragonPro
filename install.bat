@echo off
chcp 65001 >nul
title Dragon ERP - Installer
color 0A

setlocal enableextensions
cd /d "%~dp0"

cls

:: دعم اللغة العربية والرموز
chcp 65001 >nul
title Dragon ERP Pro System
color 0b

echo.
echo MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWMMWKko::dKWMMMMMMMMMMWMMMMMMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMMMMWMMMMMMMMMWNNWWWWWWWWNXXK0kxddoloddc;'...'oNMMMMMMMMMWNNWMMMMMMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMMWWNNWMMMMMMMMWX0xdoooolc::;,'',;::,'........,xNMMMMMMMMMWX0KNWMMMMMMMMMMMMMMMMWWW
echo MMMMMMMMMMMMMMMMMMMWXXXNWMMMMMMMMMMW0xoc;,'''.....',,'...';c;,;cONMMMMMMMMMMWKO0KXWMMMMMMMMMMMMMMNKKN
echo MMMMMMMMMMMMMMMMMWNKKXXXNMMMMMMMMMMWkllc;,''...........,:dKNX000KNMMMMMMMMMMNOkOO0KNWMMMMMMMMMWXOkOXW
echo MMMMMMMMMMMMMMMMWX00XXKKXWMMMMMNOOO0xc::;,''''.........',cddxxo:lKMMMMMMMMMWKxxkkkO0XWMMMMMWX0xdx0NMM
echo MMMMMMMMMMMMMMMWKkOKNNK0KXWMMMMNOoccllc:;;:odoc;'........''''..,dNMMMMMMMMMXxoxkkxxk0XWMWXOdlldOXWMMM
echo MMMMMMMMMMMMMMWKkk0XNNKOOKNWWXXXKkool:;clcc::::oxc'...,cdO00d;:kNMMMMMMMMMNkooxkkkxxxkkxoc:lxO0KXWMMM
echo MMMMMMMMMMMMMWKkxOXNNNNKOO0XXOdooodl:coo:''.'ckNWk;.'cONWMMMNKXWMMMMMMMMMXkodkOOkxoc:;,;:ok0OkOKWMMMM
echo MMMMMMMMMMMMMXkdOXNNNNNNKOOOKK0xodo:cdo,'.':xKWW0dldkXWMMMMMMMMMMMMMMMMNKkdxOOxo:;'',:ldO0kxx0NWMMMMM
echo MMMMMMMMMMMMW0dxKNNNNNNNNXKOO00xddl:od;..'lKWMMNKKNWWMMMMMMMMMMMMMMMWNKOxxkdl;,'';coddoooox0NNWMMMMMM
echo MMMMMMMMMMMNkdONNNNNNNNNNNKkdolooccdo,..;kWMMMMMMMMMMMMMMMMMMMMMMWXKOkkxl;'.';ldxdl:;:lxKNKO0WMMMMMM
echo MMMMMMMMMMMXxxKWWNNNNNNNNNXK0Oxool:oo;..'dNMMMMMMMMMMMMMMMMMMWNXK0000xc,..,cdxoc;,,codddkxxONMMMMMMM
echo MMMMMMMMMMWKxONWWWWWNNNNNNNNXKkool:coc'.',dXWMMMMMMMMMMMWWWNXXKKKXX0l,...;ll:,';cdkOxl::okXWMMMMMMMM
echo MMMMMMMMMMWKk0NWWWWWWWNNNNNNX0kxdoc:clc'..'cxKNWWWWWWWWWNNNXXNNNWNk;'....,'.,cdxxoc:;:ldKWMMMMMMMMMM
echo MMMMMMMMMMWKk0WWWWWWWWWNNNNNNNX0dool::cc;'..';lx0XNNWWWNNNNWWWWWXd,''.....'cooc;',:lxxdxKMMMMMMMMMMM
echo MMMMMMMMMMMXO0NWWWWWWWWWWWNNNNXK00xol:;:c:;,'..',:cldkKNWWNWWWWXo'','.....;:,..;lxOOkddxXMMMMMMMMMMM
echo MMMMMMMMMMMNO0NWWWWWWWWWWWWNNNNNNXxlkOdc;,;;;;;,''...';cx0NWWWXd'';'.........,codoloxxxkNMMMMMMMMMMM
echo MMMMMMMMMMMW0OXWWWWWWWWWWWWWNNXXKKkdk00Oxl:,,,;:::::;'...,lkXNk,.;;..........',':dOK0kx0WMMMMMMMMMMM
echo MMMMMMMMMMMWXO0NMMWWWNXKOkxdolc:;;,,,,;;::::;,,''',;:::;'..'cdc.':,............,dNNXOxkXMMMMMMMMMMMM
echo MMMMMMMMMWWWXOkOOkxdol:;,,',,;::c::;,....''',,''......,;:;'.....;:'........'',,,l0NKOk0NMMMMMMMMMMMM
echo WNXK0OOkkxddolc:::ccllodxxxxxxddolc:,'......',,,,''.....';:;'...;:'.....,cdk0KK0O0K0k0XMMMMMMMMMMMMM
echo MMWWNXKK00OOOkkxxkOOOOkxolc:;,,;;::::;,.........,;;;;'....'::'..''....;o0XNWWWWWWN0O0XWMMMMMMMMMMMMM
echo MMMMMMMMMWNKK0OxddxxdddddxxkkOkkxdolc:;'...........';:;'...':;......'cONWWWWWWWWN0O0XWMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMWWN0kOKKKKK0Okdoc:;,,',,'...............':c,...,:,....'l0NNWWWWWWWN00KXWMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMN0kxxxxdooooodxkkkkxl:'................;c;...:;....:0NNWNWWWWWX00XXWMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMNX0OKWWWWWWWNKOkxolc:,....,:coodddooc:,;l:..;:....cKNNNNNNNNX0KXNWMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMWX0OKWMMMMMWNXXXXNNXk;':dOXNNNNNNNNNX0kkd,.::....lKNNNNNNN00XNWWMMMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMMWNKO0XWMMMMMMMMMWWWNxdKNNXNWWWWWNNNNNNNk;':;...,xXNNNNNKO0NWWMMMMMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMMMWWX0O0NWMMMMMMMMMWXKX0dcoOOxdxk0XNNNNXd';c'..'lKNNNNXOOKNWWMMMMMMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMMMMMWNX0O0NWMMMMMMMKoxk:''::,'':cloooxKk;;c,..'l0NNNX0kOKXNWMMMMMMMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMMMMMMMWNX0O0NWMMMMWk;::;coxdl:;,'...,lo;;c;..,oKNNKOkk0KNWMMMMMMMMMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMMMMMMMMMWNX0O0XWMMWx;,ckXKd:,',,;,'.';;:c,.'ckXXKOxxk0XWMMMMMMMMMMMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMMMMMMMMMMMWNX0OOKNWKl;lKNx,..;xkkd:'';:;,;lkKX0kddkOXNMMMMMMMMMMMMMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWXKOO0K0dclol;'.';;,,;::ccokKXKkdodxOXWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWNX0OOOkxoc:;;:ldxxkkO0XXKOxdodx0XWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWNK0OOOKKXXNWWWWWWNKOkxddkOKNMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWNK0OO0KNWWWNK0kxxkO0XNWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWNX0O0000OkOO0XNWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWNNX000KXXNWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWWWNXXXNWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
echo MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
echo.
echo    [ DRAGON ERP PRO - SYSTEM READY ]
echo.

echo ====================================
echo           DRAGON ERP
echo            INSTALLER
echo ====================================
echo.

:: Check Node.js
echo [1/7] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X Node.js is not installed.
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)
echo OK Node.js detected.

:: Check npm
echo.
echo [2/7] Checking npm...
call npm.cmd --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X npm is not available.
    echo Make sure Node.js is installed correctly, then try again.
    pause
    exit /b 1
)
echo OK npm detected.

:: Install dependencies
echo.
echo [3/7] Installing dependencies...
if exist package-lock.json goto USE_CI
goto USE_INSTALL

:USE_CI
echo - package-lock.json found: using npm ci
call npm.cmd ci
if not "%errorlevel%"=="0" goto CI_FAILED
goto AFTER_INSTALL

:CI_FAILED
echo ! npm ci failed (files may be in use). Falling back to npm install...
call npm.cmd install
goto AFTER_INSTALL

:USE_INSTALL
echo - package-lock.json not found: using npm install
call npm.cmd install

:AFTER_INSTALL
if %errorlevel% neq 0 (
    echo X Failed to install dependencies.
    pause
    exit /b 1
)
echo OK Dependencies installed.

:: Verify required packages
echo.
echo [4/7] Verifying required packages (jsbarcode, sweetalert2)...
call npm.cmd ls jsbarcode sweetalert2 --depth=0 >nul 2>&1
if %errorlevel% neq 0 (
    echo ! Some required packages were not found. Installing them...
    call npm.cmd install jsbarcode sweetalert2
    if %errorlevel% neq 0 (
        echo X Failed to install required packages.
        pause
        exit /b 1
    )
)
echo OK Required packages are present.

:: Verify config files exist (do not overwrite)
echo.
echo [5/7] Verifying config files...
if not exist "tailwind.config.js" (
    echo X Missing: tailwind.config.js
    pause
    exit /b 1
)
if not exist "postcss.config.js" (
    echo X Missing: postcss.config.js
    pause
    exit /b 1
)
if not exist "vite.config.ts" (
    echo X Missing: vite.config.ts
    pause
    exit /b 1
)
echo OK Config files found.

:: Build test
echo.
echo [6/7] Running build test...
call npm.cmd run build
if %errorlevel% neq 0 (
    echo X Build failed.
    echo Tip: If PowerShell blocks scripts, run this file from CMD.
    pause
    exit /b 1
)
echo OK Build succeeded.

:: Server requirements reminder
echo.
echo [7/7] Server prerequisites...
echo - Start Apache and MySQL from XAMPP
echo - Place this project under: xampp\htdocs
echo - Then run start.bat (or npm.cmd run dev)

echo.
echo ====================================
echo        INSTALL COMPLETED
echo ====================================
echo.
echo You can now run the project using:
echo - start.bat (normal start)
echo - restart.bat (restart)
echo.
pause
