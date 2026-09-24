# PowerShell script to execute deployment automation with logging

$logFile = "C:\Users\jesfu\Desktop\Software RHIA\deployment-execution.log"

# Initialize log file
"=== RHIA Deployment Automation Log ===" | Out-File -FilePath $logFile -Encoding UTF8
"Started at: $(Get-Date)" | Add-Content -Path $logFile

# Change to the correct directory
$deployDir = "C:\Users\jesfu\Desktop\Software RHIA"
cd $deployDir

# Execute each script
"[1/3] Running rhia-configure-restart-policies.ps1..." | Add-Content -Path $logFile
try {
    & ".\scripts\rhia-configure-restart-policies.ps1" 2>&1 | Add-Content -Path $logFile
    "[1/3] Completed successfully" | Add-Content -Path $logFile
} catch {
    "ERROR in script 1: $_" | Add-Content -Path $logFile
}

"`n[2/3] Running rhia-register-startup-task.ps1..." | Add-Content -Path $logFile
try {
    & ".\scripts\rhia-register-startup-task.ps1" 2>&1 | Add-Content -Path $logFile
    "[2/3] Completed successfully" | Add-Content -Path $logFile
} catch {
    "ERROR in script 2: $_" | Add-Content -Path $logFile
}

"`n[3/3] Running rhia-boot.ps1..." | Add-Content -Path $logFile
try {
    & ".\scripts\rhia-boot.ps1" 2>&1 | Add-Content -Path $logFile
    "[3/3] Completed successfully" | Add-Content -Path $logFile
} catch {
    "ERROR in script 3: $_" | Add-Content -Path $logFile
}

"`nCompleted at: $(Get-Date)" | Add-Content -Path $logFile
"=== END OF LOG ===" | Add-Content -Path $logFile

Write-Host "Deployment automation completed! Log file: $logFile"
