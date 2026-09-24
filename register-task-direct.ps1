# Direct Task Scheduler registration using schtasks.exe - bypass UAC dialog
# Este comando registra la tarea directamente sin el diálogo UAC

$taskName = "RHIA-Boot"
$projectRoot = "C:\Users\jesfu\Desktop\Software RHIA"
$bootScript = "$projectRoot\scripts\rhia-boot.ps1"

Write-Host "=== Registrando tarea en Windows Task Scheduler ==="
Write-Host "Tarea: $taskName"
Write-Host "Script: $bootScript"
Write-Host ""

# Check if task already exists
$existing = schtasks /query /tn $taskName 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "La tarea '$taskName' ya existe."
    Write-Host "Estado actual:"
    schtasks /query /tn $taskName /v /fo list
    exit 0
}

# Create the scheduled task using schtasks.exe
# This runs PowerShell script at user logon
$taskCommand = "powershell.exe -ExecutionPolicy Bypass -File `"$bootScript`""

Write-Host "Creando tarea programada..."
Write-Host "Comando: $taskCommand"
Write-Host ""

schtasks /create `
    /tn $taskName `
    /tr "$taskCommand" `
    /sc onlogon `
    /ru "%USERNAME%" `
    /f

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== ✅ ÉXITO ===" 
    Write-Host "La tarea '$taskName' ha sido registrada correctamente."
    Write-Host "Se ejecutará automáticamente cuando inicie sesión o después de reiniciar."
    Write-Host ""
    
    # Show task details
    Write-Host "Detalles de la tarea:"
    schtasks /query /tn $taskName /v /fo list
} else {
    Write-Host ""
    Write-Host "=== ❌ ERROR ==="
    Write-Host "No se pudo registrar la tarea. Código de error: $LASTEXITCODE"
    exit 1
}
