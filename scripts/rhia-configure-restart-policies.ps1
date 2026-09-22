# PH11-T003 -- Configura la restart policy de Docker en los contenedores
# reales de RHIA para que se recuperen solos si Docker Desktop se reinicia
# (por ejemplo tras un reboot de Windows).
#
# `docker update --restart` NUNCA detiene, recrea ni reinicia el
# contenedor -- solo cambia que hace Docker la proxima vez que el propio
# contenedor o Docker Desktop se reinicien. Es aditivo y seguro de
# reejecutar (idempotente): si ya tiene la policy correcta, no hace nada.
#
# ADVERTENCIA (honesto en docs/progress/PH11-T003.md): este script no se
# ha ejecutado nunca en la maquina real de George -- este ciclo no tiene
# acceso a PowerShell/Docker real (solo al repositorio via bridge).
# Revisado manualmente, no probado. George debe ejecutarlo una vez y
# revisar la salida antes de confiar en el.

$ErrorActionPreference = 'Stop'
$containers = @('rhia-postgres', 'rhia-n8n', 'rhia-searxng', 'rhia-ollama')
$targetPolicy = 'unless-stopped'

Write-Host "RHIA: configurando restart policy '$targetPolicy' en $($containers.Count) contenedores conocidos."
Write-Host 'No se detiene, recrea ni reinicia ningun contenedor.'
Write-Host ''

foreach ($container in $containers) {
    $exists = docker inspect --format '{{.Name}}' $container 2>$null
    if (-not $exists) {
        Write-Host "SKIP  $container -- no existe en este Docker (revisa 'docker ps -a' si esperabas que si)."
        continue
    }
    $before = docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' $container
    if ($before -eq $targetPolicy) {
        Write-Host "OK    $container -- ya tiene '$targetPolicy', sin cambios."
        continue
    }
    docker update --restart=$targetPolicy $container | Out-Null
    $after = docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' $container
    if ($after -eq $targetPolicy) {
        Write-Host "SET   $container -- '$before' -> '$after'"
    } else {
        Write-Host "FALLO $container -- se esperaba '$targetPolicy', quedo en '$after'"
    }
}

Write-Host ''
Write-Host 'Listo. Los contenedores existentes no fueron detenidos ni recreados.'
