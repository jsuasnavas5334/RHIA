@echo off
REM Execute verify-and-register-task.ps1 in PowerShell
REM Esta es una secuencia de ejecución final para verificar y registrar la tarea RHIA-Boot

cd /d "C:\Users\jesfu\Desktop\Software RHIA"

echo.
echo ========================================
echo RHIA - Verificacion y Registro de Tarea
echo ========================================
echo.
echo Ejecutando: verify-and-register-task.ps1
echo.
echo Tiempo: %date% %time%
echo.

powershell.exe -ExecutionPolicy Bypass -File "C:\Users\jesfu\Desktop\Software RHIA\verify-and-register-task.ps1"

echo.
echo ========================================
echo Finalizacion de Ejecucion
echo ========================================
pause
