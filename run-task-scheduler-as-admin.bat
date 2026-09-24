@echo off
REM Script to register Windows Task Scheduler task with Administrator privileges
REM This requires User Account Control (UAC) approval

cd /d "C:\Users\jesfu\Desktop\Software RHIA"

REM Create VBScript that runs PowerShell as Admin
powershell.exe -Command "Start-Process powershell.exe -ArgumentList '-ExecutionPolicy Bypass -File \"%cd%\scripts\rhia-register-startup-task.ps1\"' -Verb RunAs -Wait"

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo Task Scheduler registration COMPLETED!
    echo ============================================
    echo The RHIA-Boot task has been registered.
    echo.
    pause
) else (
    echo.
    echo ============================================
    echo ERROR or CANCELLED
    echo ============================================
    echo The Task Scheduler registration was not completed.
    echo If you clicked "No" in the UAC dialog, please try again and click "Yes".
    echo.
    pause
)
