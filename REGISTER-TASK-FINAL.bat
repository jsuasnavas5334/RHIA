@echo off
REM Final task registration using schtasks with proper path quoting

cls
echo.
echo =========================================
echo RHIA Boot - Registro de Tarea Final
echo =========================================
echo.

REM Check if task exists
schtasks /query /tn "RHIA-Boot" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo La tarea RHIA-Boot ya existe.
    echo.
    schtasks /query /tn "RHIA-Boot" /v /fo list
    goto end
)

REM Create new task
echo Creando tarea RHIA-Boot...
echo.

REM Use a variable to construct the script path without quotes issues
setlocal enabledelayedexpansion
set "SCRIPT_PATH=C:\Users\jesfu\Desktop\Software RHIA\scripts\rhia-boot.ps1"
set "TASK_CMD=powershell.exe -ExecutionPolicy Bypass -File "!SCRIPT_PATH!""

echo Ejecutando: %TASK_CMD%
echo.

schtasks /create /tn "RHIA-Boot" /tr "%TASK_CMD%" /sc onlogon /ru "%USERNAME%" /f

if %errorlevel% equ 0 (
    echo.
    echo =========================================
    echo EXITO - Tarea registrada
    echo =========================================
    echo.
    schtasks /query /tn "RHIA-Boot" /v /fo list
) else (
    echo.
    echo ERROR - Codigo: %errorlevel%
)

:end
echo.
pause
