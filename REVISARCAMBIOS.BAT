@echo off
setlocal
title RHIA - Software local y control de cambios
cd /d "%~dp0"

echo ============================================================
echo   RHIA - Iniciando software local y panel de cambios
echo ============================================================
echo.
echo   1^) Panel de control de cambios (bitacora, git, fases):
echo      http://localhost:4173/
echo   2^) Software RHIA (frontend real):
echo      http://localhost:3000/
echo.
echo Se abriran dos ventanas del navegador automaticamente.
echo.

echo Iniciando panel de control de cambios...
call "%~dp0STAR.BAT"
if errorlevel 1 (
  echo AVISO: el panel de control de cambios no pudo iniciar en el puerto 4173.
  echo Puede que ya este abierto, o que el puerto este ocupado. Continuando...
  echo.
) else (
  echo Panel de control de cambios listo.
  echo.
)

echo ------------------------------------------------------------
echo Iniciando el software RHIA. Esta ventana mostrara sus logs.
echo Para detener TODO ^(software + panel^), cierra esta ventana
echo o presiona Ctrl+C aqui.
echo ------------------------------------------------------------
echo.

call "%~dp0STARSOFTWARE.BAT"
set "RHIA_EXIT=%ERRORLEVEL%"

echo.
echo Deteniendo el panel de control de cambios...
call "%~dp0STOP.BAT"

endlocal
exit /b %RHIA_EXIT%
