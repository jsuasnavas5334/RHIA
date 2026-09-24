@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo ======================================
echo DEPLOY FIX FINAL - N8N
echo ======================================
echo.

echo [1/4] Backup del docker-compose.yml original...
if exist docker-compose.yml (
    copy docker-compose.yml docker-compose.yml.bak >nul
    echo ✓ Backup creado
) else (
    echo ✗ No encontrado docker-compose.yml
    goto error
)

echo.
echo [2/4] Reemplazando con versión mejorada...
copy docker-compose-fixed.yml docker-compose.yml >nul
echo ✓ Reemplazado

echo.
echo [3/4] Deteniendo e iniciando contenedores...
call powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "cd '%~dp0'; docker-compose down -v --remove-orphans; Start-Sleep -Seconds 5; docker-compose up -d; Start-Sleep -Seconds 30; docker-compose ps"

echo.
echo ======================================
echo ✓ LISTO
echo ======================================
echo.
echo Abre: http://localhost:5679
echo Espera 2-3 minutos a que N8N inicie.
echo.
pause
exit /b 0

:error
echo ✗ Error. Verifica los archivos.
pause
exit /b 1
