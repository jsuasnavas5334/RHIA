# Fix N8N PostgreSQL Authentication Issue
# This script:
# 1. Stops all containers
# 2. Removes the postgres volume to reinitialize database
# 3. Starts containers again (init script will create n8n user)

Write-Host "================================="
Write-Host "FIXING N8N DATABASE AUTHENTICATION"
Write-Host "================================="
Write-Host ""

$infraPath = "C:\Users\jesfu\Desktop\Software RHIA\infrastructure"
cd $infraPath

# Step 1: Stop and remove containers
Write-Host "[1/4] Deteniendo contenedores..."
Write-Host "[1/4] Stopping containers..."
docker-compose down
Write-Host "✓ Contenedores detenidos"
Write-Host ""

# Step 2: Remove postgres volume to reinitialize
Write-Host "[2/4] Eliminando volumen PostgreSQL antiguo..."
Write-Host "[2/4] Deleting old PostgreSQL volume..."
docker volume rm infrastructure_rhia_postgres_data -f 2>$null
Write-Host "✓ Volumen eliminado"
Write-Host ""

# Step 3: Start containers
Write-Host "[3/4] Iniciando contenedores con nueva configuración..."
Write-Host "[3/4] Starting containers with new configuration..."
docker-compose up -d
Write-Host "✓ Contenedores iniciados"
Write-Host ""

# Step 4: Wait for PostgreSQL to be ready
Write-Host "[4/4] Esperando a que PostgreSQL esté listo (esto puede tomar 30-60 segundos)..."
Write-Host "[4/4] Waiting for PostgreSQL to be ready..."
$maxAttempts = 60
$attempt = 0
while ($attempt -lt $maxAttempts) {
    $result = docker-compose exec -T postgres pg_isready -U rhia 2>$null
    if ($result -eq "accepting connections") {
        Write-Host "✓ PostgreSQL está listo"
        Break
    }
    $attempt++
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "================================="
Write-Host "COMPLETADO / DONE"
Write-Host "================================="
Write-Host ""
Write-Host "Estado de contenedores / Container Status:"
docker-compose ps
Write-Host ""
Write-Host "Verificando logs de N8N en 15 segundos / Checking N8N logs in 15 seconds..."
Write-Host ""
Start-Sleep -Seconds 15
docker-compose logs n8n --tail 50
