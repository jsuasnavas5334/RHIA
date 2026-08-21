@echo off
setlocal
set "RHIA_PID_FILE=%~dp0.rhia-server.pid"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$pidFile=$env:RHIA_PID_FILE; if(-not (Test-Path -LiteralPath $pidFile)){ exit 0 }; $serverPid=[int](Get-Content -Raw -LiteralPath $pidFile); $process=Get-CimInstance Win32_Process -Filter ('ProcessId='+$serverPid) -ErrorAction SilentlyContinue; if($process -and ($process.CommandLine -like '*start-local.mjs*' -or $process.CommandLine -like '*start-local.ps1*')){ Stop-Process -Id $serverPid -Force }; Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue"

endlocal
exit /b 0
