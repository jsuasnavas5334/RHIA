@echo off
REM Final execution for RHIA-Boot task registration

cd /d "C:\Users\jesfu\Desktop\Software RHIA"

echo.
echo ======================================
echo RHIA - Registro Final de Tarea
echo ======================================
echo.

powershell.exe -ExecutionPolicy Bypass -File "C:\Users\jesfu\Desktop\Software RHIA\register-rhia-task-final.ps1"

echo.
echo ======================================
echo.
pause
