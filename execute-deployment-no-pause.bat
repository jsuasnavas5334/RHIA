@echo off
cls
echo ============================================
echo RHIA DEPLOYMENT AUTOMATION - EXECUTION
echo ============================================
echo.

cd /d "C:\Users\jesfu\Desktop\Software RHIA"

echo [1/3] Configurando restart policies...
echo.
powershell.exe -ExecutionPolicy Bypass -File ".\scripts\rhia-configure-restart-policies.ps1"
if errorlevel 1 (
    echo ERROR en script 1!
    exit /b 1
)

echo.
echo [2/3] Registrando startup task en Windows...
echo.
powershell.exe -ExecutionPolicy Bypass -File ".\scripts\rhia-register-startup-task.ps1"
if errorlevel 1 (
    echo ERROR en script 2!
    exit /b 1
)

echo.
echo [3/3] Probando boot sequence manualmente...
echo.
powershell.exe -ExecutionPolicy Bypass -File ".\scripts\rhia-boot.ps1"
if errorlevel 1 (
    echo ADVERTENCIA: Script 3 tuvo advertencias, pero continuando...
)

echo.
echo ============================================
echo LISTO PARA REBOOT!
echo ============================================
echo.
echo Los 4 contenedores RHIA estan configurados para arrancar automaticamente.
echo.
echo PROXIMO PASO: Reinicia tu PC Windows para probar que los servicios arrancan solos.
echo.

