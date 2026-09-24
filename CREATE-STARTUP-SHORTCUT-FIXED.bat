@echo off
REM Create a shortcut in Windows Startup folder - no admin required!
REM FIXED VERSION - corrected PowerShell quote escaping

cls
echo.
echo ==============================================
echo RHIA - Crear Acceso Directo en Inicio (FIXED)
echo ==============================================
echo.

REM Get the Startup folder path
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

echo Carpeta de Inicio: %STARTUP_FOLDER%
echo.

REM Check if startup folder exists
if not exist "%STARTUP_FOLDER%" (
    echo ERROR: Carpeta de Inicio no encontrada
    pause
    exit /b 1
)

echo Creando acceso directo para RHIA-Boot...
echo.

REM Use PowerShell to create the shortcut - simplified version with proper escaping
powershell -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%STARTUP_FOLDER%\RHIA-Boot.lnk'); $Shortcut.TargetPath = 'powershell.exe'; $Shortcut.Arguments = '-ExecutionPolicy Bypass -File C:\Users\jesfu\Desktop\SOFTWA~1\scripts\rhia-boot.ps1'; $Shortcut.WorkingDirectory = 'C:\Users\jesfu\Desktop\Software RHIA'; $Shortcut.WindowStyle = 0; $Shortcut.Save(); Write-Host 'Acceso directo creado exitosamente';"

if %errorlevel% equ 0 (
    echo.
    echo ==============================================
    echo EXITO - Acceso directo creado
    echo ==============================================
    echo.
    echo El acceso directo RHIA-Boot.lnk ha sido creado en:
    echo %STARTUP_FOLDER%
    echo.
    echo Que pasara:
    echo - Cada vez que inicies sesion, RHIA-Boot se ejecutara automaticamente
    echo - Tus servicios Docker se iniciaran sin necesidad de hacer nada
    echo.
    echo NO se requieren permisos de administrador
    echo NO aparecera dialogo de UAC
    echo.
    echo Simplemente reinicia Windows para probar!
) else (
    echo.
    echo ERROR - No se pudo crear el acceso directo
    echo Codigo de error: %errorlevel%
)

echo.
echo ==============================================
echo.
pause
