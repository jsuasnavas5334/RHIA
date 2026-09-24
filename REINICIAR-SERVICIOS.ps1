# RHIA - Reiniciar Servicios con nueva configuración

Write-Host ""
Write-Host "=============================================="
Write-Host "RHIA - Reiniciar Servicios"
Write-Host "=============================================="
Write-Host ""

# Cambiar al directorio de infrastructure
Push-Location "$PSScriptRoot\infrastructure"

Write-Host "Deteniendo servicios actuales..."
docker-compose down
Start-Sleep -Seconds 3

Write-Host "Eliminando volumen antiguo de PostgreSQL..."
docker volume rm rhia-postgres-data -f
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "Iniciando servicios con nueva configuración..."
docker-compose up -d

Write-Host ""
Write-Host "Esperando a que los servicios se inicialicen..."
Start-Sleep -Seconds 15

Write-Host ""
Write-Host "=============================================="
Write-Host "Estado de servicios:"
Write-Host "=============================================="
Write-Host ""

docker-compose ps

Write-Host ""
Write-Host "=============================================="
Write-Host "Esperando a que PostgreSQL y N8N estén listos..."
Write-Host "=============================================="
Write-Host ""

$maxAttempts = 60
$attempt = 0

while ($attempt -lt $maxAttempts) {
    $postgresReady = docker-compose ps postgres | Select-String "healthy"
    $n8nReady = docker-compose ps n8n | Select-String "healthy|starting"
    
    if ($postgresReady -and $n8nReady) {
        Write-Host "✅ Servicios listos"
        break
    }
    
    $attempt++
    Write-Host "Intento $attempt/$maxAttempts - Esperando servicios..."
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "=============================================="
Write-Host "Estado final:"
Write-Host "=============================================="
Write-Host ""

docker-compose ps

Write-Host ""
Write-Host "URLs de acceso:"
Write-Host "  N8N: http://127.0.0.1:5679"
Write-Host "  SearXNG: http://127.0.0.1:8080"
Write-Host "  Ollama: http://127.0.0.1:11434"
Write-Host ""
Write-Host "=============================================="
Write-Host ""

Pop-Location
Read-Host "Presione Enter para salir"
