# RHIA - Inicializar PostgreSQL

Write-Host ""
Write-Host "=============================================="
Write-Host "RHIA - Inicializar PostgreSQL"
Write-Host "=============================================="
Write-Host ""

Write-Host "Detener contenedor PostgreSQL..."
docker stop rhia-postgres
Start-Sleep -Seconds 2

Write-Host "Eliminar volumen de PostgreSQL para reiniciar limpio..."
docker volume rm rhia-postgres-data -f
Start-Sleep -Seconds 1

Write-Host "Reiniciar contenedor PostgreSQL..."
docker start rhia-postgres
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Inicializando base de datos RHIA..."
Write-Host ""

# Esperar a que PostgreSQL esté listo
$maxAttempts = 30
$attempt = 0
$dbReady = $false

while ($attempt -lt $maxAttempts -and -not $dbReady) {
    try {
        docker exec rhia-postgres pg_isready -U postgres | Out-Null
        $dbReady = $true
        Write-Host "✅ PostgreSQL está listo"
    } catch {
        $attempt++
        Write-Host "Esperando a que PostgreSQL esté listo... ($attempt/$maxAttempts)"
        Start-Sleep -Seconds 2
    }
}

if (-not $dbReady) {
    Write-Host "❌ Tiempo agotado esperando PostgreSQL"
    exit 1
}

Write-Host ""
Write-Host "Creando base de datos y usuarios..."
Write-Host ""

# Crear la base de datos y usuarios
$sqlCommands = @"
-- Crear usuarios
CREATE ROLE rhia_user WITH PASSWORD 'rhia_password' LOGIN;
CREATE ROLE n8n WITH PASSWORD 'n8n_password' LOGIN;

-- Crear base de datos
CREATE DATABASE rhia_db OWNER rhia_user;
CREATE DATABASE n8n_db OWNER n8n;

-- Dar permisos
ALTER ROLE rhia_user SUPERUSER;
ALTER ROLE n8n SUPERUSER;

-- Conectar a las bases de datos y dar permisos de esquema
\c rhia_db
GRANT ALL ON SCHEMA public TO rhia_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO rhia_user;

\c n8n_db
GRANT ALL ON SCHEMA public TO n8n;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO n8n;
"@

# Ejecutar comandos SQL
$sqlCommands | docker exec -i rhia-postgres psql -U postgres

Write-Host ""
Write-Host "✅ Base de datos inicializada correctamente"
Write-Host ""

Write-Host "Reiniciando contenedores para que usen la nueva BD..."
docker-compose -f "$PSScriptRoot/infrastructure/docker-compose.yml" restart rhia-n8n

Write-Host ""
Write-Host "Esperando que N8N se reinicie..."
Start-Sleep -Seconds 10

Write-Host ""
Write-Host "=============================================="
Write-Host "Verificando estado final..."
Write-Host "=============================================="
Write-Host ""

docker ps --format "table {{.Names}}\t{{.Status}}"

Write-Host ""
Write-Host "=============================================="
Write-Host ""
Read-Host "Presione Enter para salir"
