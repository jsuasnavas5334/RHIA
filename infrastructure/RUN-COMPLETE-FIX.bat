@echo off
REM Complete N8N Fix Batch File
REM Runs the PowerShell fix script with proper execution policy

setlocal enabledelayedexpansion

REM Get the directory where this bat file is located
for %%I in ("%~dp0.") do set "SCRIPT_DIR=%%~fI"

echo.
echo ╔═══════════════════════════════════════════════════════════════════════════════╗
echo ║                   EJECUTANDO FIX COMPLETO DE N8N                              ║
echo ║                      Running Complete N8N Fix                                 ║
echo ╚═══════════════════════════════════════════════════════════════════════════════╝
echo.

REM Check if PowerShell script exists
if not exist "%SCRIPT_DIR%\COMPLETE-FIX-N8N.ps1" (
    echo [ERROR] COMPLETE-FIX-N8N.ps1 no encontrado en %SCRIPT_DIR%
    echo [ERROR] Script not found at %SCRIPT_DIR%
    pause
    exit /b 1
)

REM Execute PowerShell script with bypass execution policy
echo Ejecutando script PowerShell...
echo Running PowerShell script...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%\COMPLETE-FIX-N8N.ps1"

echo.
echo ╔═══════════════════════════════════════════════════════════════════════════════╗
echo ║                        FIX COMPLETADO                                         ║
echo ║         El sistema debería estar listo en 2-3 minutos                         ║
echo ║              Open: http://localhost:5679 in your browser                      ║
echo ╚═══════════════════════════════════════════════════════════════════════════════╝
echo.

pause
