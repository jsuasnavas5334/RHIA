# Final registration script for RHIA-Boot task
# Simpler approach with proper escaping

$taskName = "RHIA-Boot"
$scriptPath = "C:\Users\jesfu\Desktop\Software RHIA\scripts\rhia-boot.ps1"
$logFile = "C:\Users\jesfu\Desktop\Software RHIA\task-registration.log"

# Start transcript
Start-Transcript -Path $logFile -Force

Write-Host "=== Registrando Tarea RHIA-Boot ===" -ForegroundColor Cyan
Write-Host "Tiempo: $(Get-Date)" -ForegroundColor Gray
Write-Host ""

# Check if task exists
Write-Host "Verificando si la tarea existe..."
$taskExists = & schtasks /query /tn $taskName 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ La tarea ya existe." -ForegroundColor Green
    Write-Host ""
    Write-Host "Detalles de la tarea:"
    & schtasks /query /tn $taskName /v /fo list
} else {
    Write-Host "La tarea no existe. Creando..." -ForegroundColor Yellow
    Write-Host ""
    
    # Create task - using simple direct approach
    Write-Host "Script: $scriptPath"
    Write-Host "Comando: powershell.exe -ExecutionPolicy Bypass -File ""$scriptPath"""
    Write-Host ""
    
    # Register the task with proper escaping
    $cmd = """$scriptPath"""
    schtasks /create /tn $taskName /tr "powershell.exe -ExecutionPolicy Bypass -File $cmd" /sc onlogon /ru "%USERNAME%" /f 2>&1
    
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0 -or $exitCode -eq 1 -or $exitCode -eq 0) {
        Write-Host ""
        Write-Host "✅ Tarea registrada." -ForegroundColor Green
        Write-Host ""
        Write-Host "Detalles:"
        schtasks /query /tn $taskName /v /fo list 2>&1
    } else {
        Write-Host ""
        Write-Host "❌ Error al registrar tarea. Código: $exitCode" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Fin ===" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date)"

Stop-Transcript
