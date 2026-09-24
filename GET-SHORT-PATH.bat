@echo off
REM Get the 8.3 short path for the RHIA directory

echo.
echo Getting short path...
echo.

for %%A in ("C:\Users\jesfu\Desktop\Software RHIA") do (
    echo Full path: %%~A
    echo Short path: %%~sA
    echo.
    echo Script path would be:
    echo %%~sA\scripts\rhia-boot.ps1
)

pause
