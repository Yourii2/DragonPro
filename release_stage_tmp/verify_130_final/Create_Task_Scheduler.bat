@echo off
setlocal

rem Creates a Windows Task Scheduler job to run the Dragon daily task.
rem Edit the values below before running on the client server.
set "TASK_NAME=DragonERP_Daily"
set "TASK_TIME=22:00"
set "TASK_FILE=C:\xampp\htdocs\Dragon\Task_Scheduler.bat"

schtasks /Create /SC DAILY /TN "%TASK_NAME%" /TR "%TASK_FILE%" /ST %TASK_TIME% /F

endlocal

