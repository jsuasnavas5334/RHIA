@echo off
cd /d "%~dp0"

echo.
echo ======================================
echo MAESTRO FIX - SOLUCION FINAL N8N
echo ======================================
echo.

echo [1/2] Esperando a que PowerShell anterior termine...
timeout /t 5 /nobreak

echo.
echo [2/2] Ejecutando DEPLOY-FIX-FINAL...
powershell -NoProfile -ExecutionPolicy Bypass -File "DEPLOY-FIX-FINAL.ps1"

echo.
echo ✓ COMPLETADO
echo.
echo Abre: http://localhost:5679
echo.
pause
