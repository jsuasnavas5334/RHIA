@echo off
cd /d "%~dp0"
echo ========================================
echo N8N Encryption Key Fix - RHIA
echo ========================================
echo.
powershell.exe -ExecutionPolicy Bypass -File "FIX-N8N-CORRECTED.ps1"
echo.
echo Presiona cualquier tecla para cerrar...
pause
