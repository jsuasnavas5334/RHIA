@echo off
REM AGGRESSIVE N8N FIX - Complete Reset and Manual Recovery
REM Double-click this file to run the aggressive fix

setlocal enabledelayedexpansion

REM Get the directory where this bat file is located
for %%I in ("%~dp0.") do set "SCRIPT_DIR=%%~fI"

echo.
echo ╔═══════════════════════════════════════════════════════════════════════════════╗
echo ║                      AGGRESSIVE N8N FIX - INICIANDO                          ║
echo ║                    Este proceso limpiará todo y lo reconstruirá               ║
echo ╚═══════════════════════════════════════════════════════════════════════════════╝
echo.

REM Check if PowerShell script exists
if not exist "%SCRIPT_DIR%\AGGRESSIVE-FIX-N8N.ps1" (
    echo [ERROR] AGGRESSIVE-FIX-N8N.ps1 no encontrado en %SCRIPT_DIR%
    pause
    exit /b 1
)

REM Execute PowerShell script with bypass execution policy
echo Ejecutando script de reparación agresiva...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%\AGGRESSIVE-FIX-N8N.ps1"

echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause
