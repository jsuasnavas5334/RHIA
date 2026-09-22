# PH11-T003 -- Arranque automatizado de RHIA (dependencias + monitor local).
#
# Pensado para ejecutarse desde la tarea programada 'RHIA-Boot' (ver
# scripts/rhia-register-startup-task.ps1) al iniciar sesion de George.
# NUNCA detiene ni recrea contenedores -- solo espera a que los que ya
# existen (arrancados por Docker Desktop con su propia restart policy,
# ver scripts/rhia-configure-restart-policies.ps1) esten disponibles, y
# despues arranca el monitor local (STAR.BAT), igual que hoy hace George a
# mano. Cada paso queda registrado en logs/rhia-boot.ndjson (gitignored)
# para que un ciclo futuro pueda revisar evidencia real de un arranque
# despues de un reinicio, sin necesitar que George lo reporte a mano.
#
# ADVERTENCIA (honesto en docs/progress/PH11-T003.md): este script no se ha
# ejecutado nunca en la maquina real de George. Fue escrito y revisado
# manualmente, pero no probado, porque este ciclo no tiene acceso a
# PowerShell/Windows real (solo al repositorio via bridge). Antes de
# confiarlo a un reinicio real, ejecutarlo una vez a mano y revisar
# logs/rhia-boot.ndjson.

param(
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$logDir = Join-Path $projectRoot 'logs'
$logFile = Join-Path $logDir 'rhia-boot.ndjson'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Write-BootLog {
    param([string]$EventName, [hashtable]$Data = @{})
    $entry = [ordered]@{
        event = $EventName
        at    = (Get-Date).ToUniversalTime().ToString('o')
    }
    foreach ($key in $Data.Keys) { $entry[$key] = $Data[$key] }
    ($entry | ConvertTo-Json -Compress) | Add-Content -LiteralPath $logFile -Encoding UTF8
}

Write-BootLog -EventName 'rhia-boot-start'

# 1. Asegurar Docker Desktop corriendo. Solo lo arranca si hace falta;
#    nunca lo detiene ni lo reinicia.
$dockerProcess = Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue
if (-not $dockerProcess) {
    $dockerDesktopExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if (Test-Path -LiteralPath $dockerDesktopExe) {
        Write-BootLog -EventName 'docker-desktop-start-attempt'
        Start-Process -FilePath $dockerDesktopExe
    } else {
        Write-BootLog -EventName 'docker-desktop-not-found' -Data @{ path = $dockerDesktopExe }
    }
}

# 2. Esperar a que el daemon de Docker responda (hasta 3 minutos).
$dockerReady = $false
for ($i = 0; $i -lt 90; $i++) {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { $dockerReady = $true; break }
    Start-Sleep -Seconds 2
}
Write-BootLog -EventName 'docker-daemon-ready' -Data @{ ready = $dockerReady }
if (-not $dockerReady) {
    Write-BootLog -EventName 'rhia-boot-abort' -Data @{ reason = 'docker-daemon-not-ready' }
    Write-Error 'RHIA boot: el daemon de Docker no respondio a tiempo.'
    exit 1
}

# 3. Esperar a que rhia-postgres y rhia-n8n esten Running. Docker ya los
#    mantiene vivos con su propia restart policy; este paso solo espera,
#    nunca los arranca ni los detiene.
$containers = @('rhia-postgres', 'rhia-n8n')
$containersReady = $true
foreach ($container in $containers) {
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        $state = docker inspect --format '{{.State.Running}}' $container 2>$null
        if ($state -eq 'true') { $ready = $true; break }
        Start-Sleep -Seconds 2
    }
    Write-BootLog -EventName 'container-ready' -Data @{ container = $container; ready = $ready }
    if (-not $ready) { $containersReady = $false }
}
if (-not $containersReady) {
    Write-BootLog -EventName 'rhia-boot-abort' -Data @{ reason = 'containers-not-running' }
    Write-Error 'RHIA boot: rhia-postgres y/o rhia-n8n no llegaron a estado Running.'
    exit 1
}

# 4. Verificacion de red real (TCP/HTTP) sobre las dependencias, con su
#    propio log (ver scripts/wait-for-rhia-dependencies.mjs).
$nodeCandidates = @($env:RHIA_NODE, (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'))
$nodeFromPath = Get-Command node.exe -ErrorAction SilentlyContinue
if ($nodeFromPath) { $nodeCandidates += $nodeFromPath.Source }
$node = $nodeCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $node) {
    Write-BootLog -EventName 'rhia-boot-abort' -Data @{ reason = 'node-not-found' }
    Write-Error 'RHIA boot: no se encontro node.exe.'
    exit 1
}
& $node (Join-Path $projectRoot 'scripts\wait-for-rhia-dependencies.mjs')
$dependenciesOk = ($LASTEXITCODE -eq 0)
Write-BootLog -EventName 'dependencies-wait-done' -Data @{ ok = $dependenciesOk }
if (-not $dependenciesOk) {
    Write-BootLog -EventName 'rhia-boot-abort' -Data @{ reason = 'dependencies-timeout' }
    Write-Error 'RHIA boot: las dependencias (postgres/n8n) no respondieron por red a tiempo.'
    exit 1
}

# 5. Arrancar el monitor/bitacora local (STAR.BAT), igual que hoy hace
#    George a mano -- este script solo automatiza el "cuando", nunca
#    cambia el "que".
$starBat = Join-Path $projectRoot 'STAR.BAT'
if ($NoBrowser) { $env:RHIA_NO_BROWSER = '1' }
Start-Process -FilePath $starBat -WorkingDirectory $projectRoot -WindowStyle Hidden
Write-BootLog -EventName 'star-bat-launched'

Write-BootLog -EventName 'rhia-boot-complete'
Write-Host 'RHIA boot: dependencias listas, monitor local arrancado.'
