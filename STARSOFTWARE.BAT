@echo off
setlocal
title RHIA SOFTWARE - FRONTEND LOCAL
cd /d "%~dp0"

set "RHIA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%RHIA_NODE%" (
  for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined RHIA_NODE_FOUND set "RHIA_NODE_FOUND=%%N"
  if defined RHIA_NODE_FOUND set "RHIA_NODE=%RHIA_NODE_FOUND%"
)

if not exist "%RHIA_NODE%" (
  echo ERROR: No se encontro Node.js para iniciar RHIA Software.
  echo Instala Node.js 24 o conserva el runtime incluido de Codex.
  pause
  exit /b 2
)

if not exist "%~dp0node_modules\next\dist\bin\next" (
  echo ERROR: Faltan las dependencias locales de RHIA Software.
  echo No se realizo ninguna instalacion automatica.
  pause
  exit /b 3
)

echo ============================================================
echo   RHIA SOFTWARE - FRONTEND FUNCIONAL
echo ============================================================
echo URL: http://localhost:3000/
echo.
echo Esta ventana muestra los errores y avances del frontend.
echo Para detener el frontend, presiona Ctrl+C en esta ventana.
echo.

"%RHIA_NODE%" "%~dp0scripts\start-software.mjs"
set "RHIA_EXIT=%ERRORLEVEL%"

if not "%RHIA_EXIT%"=="0" (
  echo.
  echo RHIA Software termino con error %RHIA_EXIT%.
  echo Revisa el mensaje anterior y comparte una captura si necesitas ayuda.
  pause
)

endlocal
exit /b %RHIA_EXIT%
