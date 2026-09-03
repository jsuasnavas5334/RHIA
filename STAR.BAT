@echo off
setlocal
set "RHIA_ROOT=%~dp0"
set "RHIA_URL=http://localhost:4173/"
set "RHIA_HEALTH_URL=http://127.0.0.1:4173/health"
set "RHIA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%RHIA_NODE%" (
  for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined RHIA_NODE_FOUND set "RHIA_NODE_FOUND=%%N"
  if defined RHIA_NODE_FOUND set "RHIA_NODE=%RHIA_NODE_FOUND%"
)
if not exist "%RHIA_NODE%" exit /b 2

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$health=$env:RHIA_HEALTH_URL; $online=$false; try { $online=((Invoke-WebRequest -UseBasicParsing -Uri $health -TimeoutSec 1).StatusCode -eq 200) } catch {}; if(-not $online){ Start-Process -FilePath $env:RHIA_NODE -ArgumentList @('scripts/start-local.mjs') -WorkingDirectory $env:RHIA_ROOT -WindowStyle Hidden; for($i=0;$i -lt 20;$i++){ Start-Sleep -Milliseconds 250; try { if((Invoke-WebRequest -UseBasicParsing -Uri $health -TimeoutSec 1).StatusCode -eq 200){ $online=$true; break } } catch {} } }; if(-not $online){ exit 1 }"

if errorlevel 1 (
  echo ERROR: RHIA no pudo iniciar. Ejecuta STOP.BAT y vuelve a intentar.
  exit /b 1
)
if /I not "%RHIA_NO_BROWSER%"=="1" start "" "%RHIA_URL%"

endlocal
exit /b 0
