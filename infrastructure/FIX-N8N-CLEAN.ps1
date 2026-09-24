# Clean N8N Fix Script
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "Starting N8N Aggressive Fix" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "[1/6] Script directory: $ScriptDir" -ForegroundColor Yellow

if (-not (Test-Path "$ScriptDir\docker-compose.yml")) {
    Write-Host "[ERROR] docker-compose.yml not found" -ForegroundColor Red
    exit 1
}

# Step 1: Stop and remove containers
Write-Host "[2/6] Stopping all containers..." -ForegroundColor Yellow
docker-compose -f "$ScriptDir\docker-compose.yml" down --remove-orphans --volumes 2>&1 | Out-Null
Write-Host "  OK - Containers stopped" -ForegroundColor Green

# Step 2: Remove all volumes
Write-Host "[3/6] Removing Docker volumes..." -ForegroundColor Yellow
$Volumes = @("infrastructure_rhia_postgres_data", "rhia_postgres_data", "infrastructure_rhia_n8n_data", "rhia_n8n_data", "infrastructure_rhia_searxng_cache", "rhia_searxng_cache", "infrastructure_rhia_ollama_data", "rhia_ollama_data")
foreach ($vol in $Volumes) {
    docker volume rm $vol -f 2>&1 | Out-Null
}
Write-Host "  OK - Volumes removed" -ForegroundColor Green

# Step 3: Verify init script
Write-Host "[4/6] Verifying init script..." -ForegroundColor Yellow
if (-not (Test-Path "$ScriptDir\init-n8n-user.sql")) {
    Write-Host "[ERROR] init-n8n-user.sql not found" -ForegroundColor Red
    exit 1
}
Write-Host "  OK - Init script found" -ForegroundColor Green

# Step 4: Start containers
Write-Host "[5/6] Starting containers..." -ForegroundColor Yellow
docker-compose -f "$ScriptDir\docker-compose.yml" up -d 2>&1 | Out-Null
Write-Host "  OK - Containers started" -ForegroundColor Green

# Step 5: Wait for PostgreSQL
Write-Host "[6/6] Waiting for PostgreSQL (up to 3 minutes)..." -ForegroundColor Yellow
$MaxRetries = 36
$Retry = 0
$Ready = $false

while ($Retry -lt $MaxRetries) {
    $Status = docker exec rhia-postgres pg_isready -U rhia 2>&1
    if ($Status -match "accepting") {
        Write-Host "  OK - PostgreSQL is ready" -ForegroundColor Green
        $Ready = $true
        break
    }
    $Retry++
    if ($Retry % 6 -eq 0) {
        Write-Host "  Waiting... ($Retry/$MaxRetries)" -ForegroundColor Gray
    }
    Start-Sleep -Seconds 5
}

if (-not $Ready) {
    Write-Host "  WARNING - Timeout but continuing..." -ForegroundColor Yellow
}

# Final status
Write-Host ""
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "Fix Complete!" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Container Status:" -ForegroundColor White
docker-compose -f "$ScriptDir\docker-compose.yml" ps
Write-Host ""
Write-Host "Next: Open http://localhost:5679 in your browser" -ForegroundColor Cyan
Write-Host "You should see the N8N login page" -ForegroundColor Green
Write-Host ""
Write-Host "Waiting 30 seconds before closing..." -ForegroundColor Yellow
Start-Sleep -Seconds 30
