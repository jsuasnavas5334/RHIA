@echo off
REM RHIA-Boot task registration with administrator elevation

cls
echo.
echo ==============================================
echo RHIA - Registro de Tarea (Modo Admin)
echo ==============================================
echo.

REM Check if already running as admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo Se requieren permisos de administrador.
    echo Elevando privilegios...
    echo.
    
    REM Re-launch as administrator
    powershell -Command "Start-Process cmd.exe -ArgumentList '/c', '%~dpn0' -Verb RunAs"
    exit /b
)

REM Running with admin privileges

echo Verificando si la tarea existe...
schtasks /query /tn "RHIA-Boot" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo La tarea RHIA-Boot ya existe.
    echo.
    schtasks /query /tn "RHIA-Boot" /v /fo list
    goto end
)

echo.
echo Creando tarea RHIA-Boot con permisos administrativos...
echo.

set "SCRIPT=C:\Users\jesfu\Desktop\SOFTWA~1\scripts\rhia-boot.ps1"
set "CMD=powershell.exe -ExecutionPolicy Bypass -File %SCRIPT%"

echo Script: %SCRIPT%
echo Comando: %CMD%
echo.

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
