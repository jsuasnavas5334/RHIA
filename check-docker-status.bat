@echo off
cd /d "C:\Users\jesfu\Desktop\Software RHIA"
powershell.exe -ExecutionPolicy Bypass -File ".\check-docker-status.ps1" > docker-status-output.txt 2>&1
echo Docker check complete. Check docker-status-output.txt for results.
pause
