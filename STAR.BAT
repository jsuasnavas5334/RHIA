@echo off
setlocal
set "RHIA_ROOT=%~dp0"
set "RHIA_URL=http://localhost:4173/"
set "RHIA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "RHIA_SERVER=%RHIA_ROOT%scripts\start-local.mjs"

if not exist "%RHIA_NODE%" (
  for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined RHIA_NODE_FOUND set "RHIA_NODE_FOUND=%%N"
  if defined RHIA_NODE_FOUND set "RHIA_NODE=%RHIA_NODE_FOUND%"
)
if not exist "%RHIA_NODE%" exit /b 2

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url=$env:RHIA_URL; $online=$false; try { $online=((Invoke-WebRequest -UseBasicParsing -Uri ($url+'health') -TimeoutSec 1).StatusCode -eq 200) } catch {}; if(-not $online){ Start-Process -FilePath $env:RHIA_NODE -ArgumentList @($env:RHIA_SERVER) -WindowStyle Hidden; for($i=0;$i -lt 20;$i++){ Start-Sleep -Milliseconds 250; try { if((Invoke-WebRequest -UseBasicParsing -Uri ($url+'health') -TimeoutSec 1).StatusCode -eq 200){ $online=$true; break } } catch {} } }; if(-not $online){ exit 1 }"

if errorlevel 1 exit /b 1
start "" "%RHIA_URL%"

endlocal
exit /b 0
