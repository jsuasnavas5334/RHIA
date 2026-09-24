@echo off
cd /d "C:\Users\jesfu\Desktop\Software RHIA\infrastructure"
echo Ejecutando diagnóstico de N8N...
echo Running N8N diagnostics...
powershell.exe -ExecutionPolicy Bypass -File "GET-N8N-STATUS.ps1"
echo.
echo Diagnóstico completado. Check the N8N-LOGS-*.txt file
pause
