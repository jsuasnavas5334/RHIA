@echo off
REM Final RHIA-Boot task registration using short path (no spaces)

cls
echo.
echo ==============================================
echo RHIA - Registro Final de Tarea RHIA-Boot
echo ==============================================
echo.

REM Check if task already exists
schtasks /query /tn "RHIA-Boot" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo La tarea RHIA-Boot ya existe.
    echo.
    schtasks /query /tn "RHIA-Boot" /v /fo list
    goto end
)

echo Registrando tarea RHIA-Boot...
echo.

REM Use short path (8.3 format) to avoid spaces
REM C:\Users\jesfu\Desktop\SOFTWA~1 = C:\Users\jesfu\Desktop\Software RHIA

set "SCRIPT=C:\Users\jesfu\Desktop\SOFTWA~1\scripts\rhia-boot.ps1"
set "CMD=powershell.exe -ExecutionPolicy Bypass -File %SCRIPT%"

echo Script: %SCRIPT%
echo Comando: %CMD%
echo.

REM Register the task
schtasks /create /tn "RHIA-Boot" /tr "%CMD%" /sc onlogon /ru "%USERNAME%" /f

if %errorlevel% equ 0 (
    echo.
    echo ==============================================
    echo EXITO - Tarea registrada correctamente
    echo ==============================================
    echo.
    echo La tarea RHIA-Boot ha sido creada.
    echo Se ejecutara automaticamente:
    echo - Al iniciar sesion
    echo - Despues de reiniciar Windows
    echo.
    schtasks /query /tn "RHIA-Boot" /v /fo list
) else (
    echo.
    echo ERROR - No se pudo registrar la tarea
    echo Codigo de error: %errorlevel%
)

:end
echo.
echo ==============================================
echo.
pause
