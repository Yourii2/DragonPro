@echo off
chcp 65001 >nul
title Dragon Pro - Start Project
color 0A

setlocal enableextensions
cd /d "%~dp0"

cls


echo ====================================
echo    Dragon Pro - Starting Project
echo ====================================
echo.

:: Checking if XAMPP is running
echo [1/4] Checking XAMPP status...
tasklist /FI "IMAGENAME eq httpd.exe" 2>NUL | find /I /N "httpd.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✓ Apache is already running.
) else (
    echo ✗ Apache is not running, starting it...
    start "" "C:\xampp\xampp-control.exe"
    timeout /t 5 /nobreak >nul
    echo ✓ XAMPP started.
)

:: Checking if MySQL is running
tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I /N "mysqld.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✓ MySQL is already running.
) else (
    echo ✗ MySQL is not running, starting it...
    start "" "C:\xampp\xampp-control.exe"
    timeout /t 5 /nobreak >nul
    echo ✓ MySQL started.
)

echo.
echo [2/4] Checking for packages...
if not exist "node_modules" (
    echo Installing packages...
    call npm.cmd install
) else (
    echo ✓ Packages are already installed.
)

echo.
echo [3/4] Starting development server...
start cmd /k "npm.cmd run dev"
timeout /t 3 /nobreak >nul

echo.
echo [4/4] Opening browser...
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo.
echo ====================================
echo     Draon started successfully!
echo ====================================
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
echo The browser will open automatically at:
echo http://localhost:3000
echo.
echo To stop the project, close the development server window
echo or use restart.bat to restart.
echo.
pause
