@echo off
cd /d "C:\Users\jesfu\Desktop\Software RHIA\infrastructure"
echo REPARANDO AUTENTICACION DE N8N CON POSTGRESQL
echo FIXING N8N POSTGRESQL AUTHENTICATION
echo.
powershell.exe -ExecutionPolicy Bypass -File "FIX-N8N-DB-AUTH.ps1"
echo.
pause
