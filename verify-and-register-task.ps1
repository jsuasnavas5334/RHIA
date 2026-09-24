# Verify if RHIA-Boot task is registered, if not register it

$taskName = "RHIA-Boot"
$projectRoot = "C:\Users\jesfu\Desktop\Software RHIA"
$bootScript = "$projectRoot\scripts\rhia-boot.ps1"
$logFile = "$projectRoot\task-registration.log"

# Redirect output to log file
Start-Transcript -Path $logFile -Force

Write-Host "=== Verificando y Registrando Tarea RHIA-Boot ===" -ForegroundColor Cyan
Write-Host "Tiempo: $(Get-Date)" -ForegroundColor Gray
Write-Host ""

# Check if task already exists
Write-Host "1. Verificando si la tarea '$taskName' existe..."
$existing = & schtasks /query /tn $taskName 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ La tarea '$taskName' ya existe." -ForegroundColor Green
    Write-Host ""
    Write-Host "   Detalles:"
    & schtasks /query /tn $taskName /v /fo list
} else {
    Write-Host "   ⚠️  La tarea no existe, creándola..." -ForegroundColor Yellow
    Write-Host ""
    
    # Create the scheduled task using schtasks.exe
    $taskCommand = "powershell.exe -ExecutionPolicy Bypass -File `"$bootScript`""
    
    Write-Host "2. Creando tarea programada..."
    Write-Host "   Tarea: $taskName"
    Write-Host "   Script: $bootScript"
    Write-Host "   Comando: $taskCommand"
    Write-Host ""
    
    # Use schtasks with proper syntax - no backticks in the command string itself
    cmd /c "schtasks /create /tn $taskName /tr ""$taskCommand"" /sc onlogon /ru ""%USERNAME%"" /f"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=== ✅ ÉXITO ===" -ForegroundColor Green
        Write-Host "La tarea '$taskName' ha sido registrada correctamente." -ForegroundColor Green
        Write-Host "Se ejecutará automáticamente cuando inicie sesión o después de reiniciar." -ForegroundColor Green
        Write-Host ""
        
        # Show task details
        Write-Host "3. Detalles de la tarea:"
        & schtasks /query /tn $taskName /v /fo list
    } else {
        Write-Host ""
        Write-Host "=== ❌ ERROR ===" -ForegroundColor Red
        Write-Host "No se pudo registrar la tarea. Código de error: $LASTEXITCODE" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Fin de verificación ===" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

Stop-Transcript
