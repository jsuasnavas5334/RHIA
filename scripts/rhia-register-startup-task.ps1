# PH11-T003 -- Registra una tarea programada de Windows ('RHIA-Boot') que
# ejecuta scripts/rhia-boot.ps1 al iniciar sesion de George, para que RHIA
# se recupere sola tras un reinicio sin pasos manuales.
#
# Solo REGISTRA la tarea -- no la ejecuta. Es aditivo e idempotente: si la
# tarea ya existe, no hace nada (para reemplazarla, hay que borrarla a
# mano primero; ver mensaje mas abajo).
#
# ADVERTENCIA (honesto en docs/progress/PH11-T003.md): este script no se
# ha ejecutado nunca en la maquina real de George -- este ciclo no tiene
# acceso a PowerShell/Task Scheduler real (solo al repositorio via
# bridge). Revisado manualmente, no probado.

$ErrorActionPreference = 'Stop'
$taskName = 'RHIA-Boot'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$bootScript = Join-Path $projectRoot 'scripts\rhia-boot.ps1'

if (-not (Test-Path -LiteralPath $bootScript)) {
    throw "No se encontro $bootScript"
}

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "La tarea programada '$taskName' ya existe (Estado: $($existing.State)). No se crea una duplicada."
    Write-Host "Para reemplazarla: Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
    Write-Host 'y volver a ejecutar este script.'
    exit 0
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$bootScript`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
    -Description 'Arranca RHIA (dependencias + monitor local) al iniciar sesion de George. Ver docs/runbooks/deployment-runbook.md (PH11-T003).'

Write-Host "Tarea programada '$taskName' creada: correra scripts\rhia-boot.ps1 en cada inicio de sesion de George."
Write-Host 'No se ejecuto ahora.'
Write-Host "Para probarla sin esperar un reinicio real: Start-ScheduledTask -TaskName '$taskName'"
Write-Host 'Luego revisar logs\rhia-boot.ndjson.'
