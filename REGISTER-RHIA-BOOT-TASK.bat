@echo off
REM Direct batch file approach to register RHIA-Boot task
REM No PowerShell escaping issues

cls
echo.
echo ==========================================
echo RHIA - Registro Directo de Tarea
echo ==========================================
echo.
echo Verificando tarea RHIA-Boot...
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

REM Task does not exist, create it
echo La tarea no existe. Creando...
echo.
echo Comando: powershell.exe -ExecutionPolicy Bypass -File "C:\Users\jesfu\Desktop\Software RHIA\scripts\rhia-boot.ps1"
echo.

schtasks /create /tn "RHIA-Boot" /tr "powershell.exe -ExecutionPolicy Bypass -File ""C:\Users\jesfu\Desktop\Software RHIA\scripts\rhia-boot.ps1""" /sc onlogon /ru "%USERNAME%" /f

if %errorlevel% equ 0 (
    echo.
    echo ==========================================
    echo EXITO - Tarea registrada correctamente
    echo ==========================================
    echo.
    echo La tarea se ejecutara automaticamente:
    echo - Al iniciar sesion
    echo - Despues de reiniciar la computadora
    echo.
    schtasks /query /tn "RHIA-Boot" /v /fo list
) else (
    echo.
    echo ERROR - No se pudo registrar la tarea
    echo Codigo de error: %errorlevel%
)

:end
echo.
echo ==========================================
echo.
pause
