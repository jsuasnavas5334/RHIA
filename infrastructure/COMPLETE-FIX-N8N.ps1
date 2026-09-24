# COMPLETE FIX SCRIPT FOR N8N DATABASE AUTHENTICATION
# This script completely resets the Docker infrastructure and applies the database fix

Write-Host "╔═══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    COMPLETE N8N DATABASE FIX - STARTING                      ║" -ForegroundColor Cyan
Write-Host "║                 Eliminando datos anteriores y reconfigurando                 ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# Get the script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "[1/8] Script directory: $ScriptDir" -ForegroundColor Yellow

# Check if in correct directory
if (-not (Test-Path "$ScriptDir\docker-compose.yml")) {
    Write-Host "[ERROR] docker-compose.yml not found in $ScriptDir" -ForegroundColor Red
    exit 1
}

# Step 1: Stop all containers
Write-Host "[2/8] Deteniendo contenedores Docker..." -ForegroundColor Yellow
try {
    docker-compose -f "$ScriptDir\docker-compose.yml" down --remove-orphans 2>&1 | ForEach-Object { Write-Host "  $_" }
    Write-Host "  ✓ Contenedores detenidos" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Error deteniendo contenedores (continuando...): $_" -ForegroundColor Yellow
}

# Step 2: Remove all volumes completely
Write-Host "[3/8] Eliminando volúmenes Docker..." -ForegroundColor Yellow
$VolumesToRemove = @("infrastructure_rhia_postgres_data", "rhia_postgres_data", "infrastructure_rhia_n8n_data", "rhia_n8n_data", "infrastructure_rhia_searxng_cache", "rhia_searxng_cache")

foreach ($volume in $VolumesToRemove) {
    try {
        $exists = docker volume ls -q | Select-String $volume
        if ($exists) {
            docker volume rm $volume -f 2>&1 | Out-Null
            Write-Host "  ✓ Volumen eliminado: $volume" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ℹ Volumen no encontrado: $volume" -ForegroundColor Gray
    }
}

# Step 3: Verify init script exists
Write-Host "[4/8] Verificando script de inicialización..." -ForegroundColor Yellow
if (Test-Path "$ScriptDir\init-n8n-user.sql") {
    $ScriptSize = (Get-Item "$ScriptDir\init-n8n-user.sql").Length
    Write-Host "  ✓ init-n8n-user.sql encontrado ($ScriptSize bytes)" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] init-n8n-user.sql NO encontrado" -ForegroundColor Red
    exit 1
}

# Step 4: Start containers
Write-Host "[5/8] Iniciando contenedores Docker..." -ForegroundColor Yellow
try {
    docker-compose -f "$ScriptDir\docker-compose.yml" up -d 2>&1 | ForEach-Object { Write-Host "  $_" }
    Write-Host "  ✓ Contenedores iniciados" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Error iniciando contenedores: $_" -ForegroundColor Red
    exit 1
}

# Step 5: Wait for PostgreSQL to be ready
Write-Host "[6/8] Esperando a que PostgreSQL se inicialice (esto toma 2-3 minutos)..." -ForegroundColor Yellow
$MaxRetries = 36  # 3 minutos con reintentos cada 5 segundos
$Retry = 0
$PostgresReady = $false

while ($Retry -lt $MaxRetries) {
    try {
        $PgIsReady = docker exec rhia-postgres pg_isready -U rhia 2>&1
        if ($PgIsReady -match "accepting connections") {
            Write-Host "  ✓ PostgreSQL está listo" -ForegroundColor Green
            $PostgresReady = $true
            break
        }
    } catch {
        # Continue retrying
    }

    $Retry++
    if ($Retry % 6 -eq 0) {  # Show every 30 seconds
        Write-Host "  ℹ Esperando... (intento $Retry/$MaxRetries)" -ForegroundColor Gray
    }
    Start-Sleep -Seconds 5
}

if (-not $PostgresReady) {
    Write-Host "  [WARNING] PostgreSQL no respondió en el tiempo esperado. Continuando de todas formas..." -ForegroundColor Yellow
}

# Step 6: Check if n8n user was created
Write-Host "[7/8] Verificando si el usuario n8n existe en PostgreSQL..." -ForegroundColor Yellow
try {
    $Query = "SELECT 1 FROM pg_user WHERE usename = 'n8n';"
    $UserExists = docker exec -it rhia-postgres psql -U rhia -d rhia_core -tAc $Query 2>&1

    if ($UserExists -match "1") {
        Write-Host "  ✓ Usuario n8n existe en PostgreSQL" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] Usuario n8n NO ENCONTRADO - El script de inicialización puede no haber ejecutado" -ForegroundColor Yellow
        Write-Host "  Intentando crear el usuario manualmente..." -ForegroundColor Yellow

        $InitSQL = Get-Content "$ScriptDir\init-n8n-user.sql" | Out-String
        docker exec -i rhia-postgres psql -U rhia -d rhia_core -c $InitSQL 2>&1 | ForEach-Object { Write-Host "    $_" }
    }
} catch {
    Write-Host "  ⚠ No se pudo verificar el usuario: $_" -ForegroundColor Yellow
}

# Step 7: Test database connection
Write-Host "[8/8] Verificando conexión de N8N a la base de datos..." -ForegroundColor Yellow
Start-Sleep -Seconds 5  # Give N8N a moment to restart

$N8NLogs = docker logs rhia-n8n 2>&1 | Select-Object -Last 50
if ($N8NLogs -match "password authentication failed") {
    Write-Host "  ✗ N8N SIGUE reportando: password authentication failed" -ForegroundColor Red
} elseif ($N8NLogs -match "Connected to database") {
    Write-Host "  ✓ N8N conectó exitosamente a la base de datos" -ForegroundColor Green
} else {
    Write-Host "  ℹ Estado unclear - revisa los logs con: docker logs rhia-n8n" -ForegroundColor Gray
}

# Final status
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                          RESUMEN DEL FIX / FIX SUMMARY                        ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host ""
Write-Host "1. Estatus de Contenedores:" -ForegroundColor White
docker-compose -f "$ScriptDir\docker-compose.yml" ps 2>&1 | ForEach-Object { Write-Host "   $_" }

Write-Host ""
Write-Host "2. Prueba de Acceso:" -ForegroundColor White
Write-Host "   Abre el navegador en: http://localhost:5679" -ForegroundColor Cyan
Write-Host "   Si ves la pantalla de LOGIN de N8N -> ¡EL FIX FUNCIONÓ!" -ForegroundColor Green
Write-Host "   Si ves ERR_EMPTY_RESPONSE -> Sigue habiendo problemas" -ForegroundColor Red

Write-Host ""
Write-Host "3. Para ver logs detallados:" -ForegroundColor White
Write-Host "   - N8N:        docker logs -f rhia-n8n" -ForegroundColor Gray
Write-Host "   - PostgreSQL: docker logs -f rhia-postgres" -ForegroundColor Gray

Write-Host ""
Write-Host "El proceso ha completado. El sistema debería estar funcionando en 1-2 minutos." -ForegroundColor Yellow
