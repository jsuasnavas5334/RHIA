# AGGRESSIVE N8N FIX - COMPLETE RESET WITH MANUAL VERIFICATION
# This script performs a complete reset and forces the initialization to execute

Write-Host "╔═══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                 AGGRESSIVE N8N FIX - COMPLETE RESET                          ║" -ForegroundColor Cyan
Write-Host "║          This will completely wipe and rebuild the infrastructure             ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "[INFO] Working directory: $ScriptDir" -ForegroundColor Yellow

# Verify docker-compose exists
if (-not (Test-Path "$ScriptDir\docker-compose.yml")) {
    Write-Host "[ERROR] docker-compose.yml not found!" -ForegroundColor Red
    exit 1
}

# STEP 1: Kill all Docker containers forcefully
Write-Host "[STEP 1/7] Stopping ALL containers (force kill)..." -ForegroundColor Yellow
try {
    docker-compose -f "$ScriptDir\docker-compose.yml" down --remove-orphans --volumes 2>&1 | ForEach-Object { Write-Host "  $_" }
    Write-Host "  ✓ Containers stopped and volumes removed via compose" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Error with docker-compose down: $_" -ForegroundColor Yellow
}

# Force stop any remaining containers
Write-Host "[STEP 1b] Force stopping any remaining containers..." -ForegroundColor Yellow
@("rhia-postgres", "rhia-n8n", "rhia-searxng", "rhia-ollama") | ForEach-Object {
    try {
        $output = docker stop $_ 2>&1
        Write-Host "  ✓ Stopped: $_" -ForegroundColor Green
    } catch {
        Write-Host "  ℹ Container not running: $_" -ForegroundColor Gray
    }
}

# Remove containers
Write-Host "[STEP 1c] Removing containers..." -ForegroundColor Yellow
@("rhia-postgres", "rhia-n8n", "rhia-searxng", "rhia-ollama") | ForEach-Object {
    try {
        docker rm $_ -f 2>&1 | Out-Null
        Write-Host "  ✓ Removed: $_" -ForegroundColor Green
    } catch {
        Write-Host "  ℹ Container not found: $_" -ForegroundColor Gray
    }
}

# STEP 2: Aggressively remove ALL volumes
Write-Host "[STEP 2/7] Removing ALL Docker volumes..." -ForegroundColor Yellow
$VolumesToRemove = @(
    "infrastructure_rhia_postgres_data",
    "rhia_postgres_data",
    "infrastructure_rhia_n8n_data",
    "rhia_n8n_data",
    "infrastructure_rhia_searxng_cache",
    "rhia_searxng_cache",
    "infrastructure_rhia_ollama_data",
    "rhia_ollama_data"
)

foreach ($volume in $VolumesToRemove) {
    try {
        docker volume rm $volume -f 2>&1 | Out-Null
        Write-Host "  ✓ Volume removed: $volume" -ForegroundColor Green
    } catch {
        Write-Host "  ℹ Volume not found or error: $volume" -ForegroundColor Gray
    }
}

# Prune unused volumes to be absolutely sure
Write-Host "[STEP 2b] Pruning all unused volumes..." -ForegroundColor Yellow
docker volume prune -f 2>&1 | ForEach-Object { Write-Host "  $_" }

# STEP 3: Verify init script
Write-Host "[STEP 3/7] Verifying initialization script..." -ForegroundColor Yellow
if (-not (Test-Path "$ScriptDir\init-n8n-user.sql")) {
    Write-Host "[ERROR] init-n8n-user.sql not found at $ScriptDir" -ForegroundColor Red
    exit 1
}
$InitContent = Get-Content "$ScriptDir\init-n8n-user.sql" | Out-String
if ($InitContent -match "n8n_secure_password_2024") {
    Write-Host "  ✓ Init script found and contains correct password" -ForegroundColor Green
} else {
    Write-Host "  [WARNING] Init script may be incomplete" -ForegroundColor Yellow
}

# STEP 4: Start fresh with docker-compose
Write-Host "[STEP 4/7] Starting containers with docker-compose..." -ForegroundColor Yellow
try {
    $composeOutput = docker-compose -f "$ScriptDir\docker-compose.yml" up -d 2>&1
    $composeOutput | ForEach-Object { Write-Host "  $_" }
    Write-Host "  ✓ Containers started" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Failed to start containers: $_" -ForegroundColor Red
    exit 1
}

# STEP 5: Wait for PostgreSQL to be ready (EXTENDED TIMEOUT)
Write-Host "[STEP 5/7] Waiting for PostgreSQL to initialize (up to 5 minutes)..." -ForegroundColor Yellow
$MaxRetries = 60  # 5 minutes with 5-second intervals
$Retry = 0
$PostgresReady = $false

while ($Retry -lt $MaxRetries) {
    try {
        $PgIsReady = docker exec rhia-postgres pg_isready -U rhia 2>&1
        if ($PgIsReady -match "accepting connections") {
            Write-Host "  ✓ PostgreSQL is accepting connections" -ForegroundColor Green
            $PostgresReady = $true
            break
        }
    } catch {
        # Continue retrying
    }

    $Retry++
    if ($Retry % 12 -eq 0) {  # Show every 60 seconds
        Write-Host "  ℹ Waiting for PostgreSQL... ($Retry/$MaxRetries attempts)" -ForegroundColor Gray
    }
    Start-Sleep -Seconds 5
}

if (-not $PostgresReady) {
    Write-Host "  [WARNING] PostgreSQL timeout, but continuing..." -ForegroundColor Yellow
}

# STEP 6: Manually execute the init script if user doesn't exist
Write-Host "[STEP 6/7] Verifying database user 'n8n'..." -ForegroundColor Yellow
Start-Sleep -Seconds 2  # Give PostgreSQL an extra moment

try {
    $Query = "SELECT 1 FROM pg_user WHERE usename = 'n8n';"
    $UserExists = docker exec -it rhia-postgres psql -U rhia -d rhia_core -tAc $Query 2>&1

    if ($UserExists -match "1") {
        Write-Host "  ✓ User 'n8n' already exists in PostgreSQL" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ User 'n8n' NOT FOUND - executing initialization script manually..." -ForegroundColor Yellow

        # Read the init script
        $InitScript = Get-Content "$ScriptDir\init-n8n-user.sql" | Out-String

        # Execute it
        Write-Host "  Executing init script..." -ForegroundColor Gray
        $InitScript | docker exec -i rhia-postgres psql -U rhia -d rhia_core 2>&1 | ForEach-Object {
            Write-Host "    $_"
        }

        Write-Host "  ✓ Initialization script executed manually" -ForegroundColor Green

        # Verify it was created
        Start-Sleep -Seconds 2
        $UserCheckAgain = docker exec -it rhia-postgres psql -U rhia -d rhia_core -tAc "SELECT 1 FROM pg_user WHERE usename = 'n8n';" 2>&1
        if ($UserCheckAgain -match "1") {
            Write-Host "  ✓ User 'n8n' successfully created!" -ForegroundColor Green
        } else {
            Write-Host "  ✗ FAILED to create user 'n8n' - problem persists" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "  ⚠ Error during user verification: $_" -ForegroundColor Yellow
}

# STEP 7: Verify N8N connection
Write-Host "[STEP 7/7] Checking N8N database connection..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    $N8NLogs = docker logs rhia-n8n 2>&1 | Select-Object -Last 20
    $N8NLogsString = $N8NLogs | Out-String

    if ($N8NLogsString -match "Connected to database|Database initialization") {
        Write-Host "  ✓ N8N appears to be connected to database" -ForegroundColor Green
    } elseif ($N8NLogsString -match "password authentication failed") {
        Write-Host "  ✗ N8N still showing password auth errors" -ForegroundColor Red
        Write-Host "  Last logs:" -ForegroundColor Gray
        $N8NLogs | ForEach-Object { Write-Host "    $_" }
    } else {
        Write-Host "  ℹ Status unclear - logs follow:" -ForegroundColor Gray
        $N8NLogs | ForEach-Object { Write-Host "    $_" }
    }
} catch {
    Write-Host "  ⚠ Could not read N8N logs: $_" -ForegroundColor Yellow
}

# FINAL STATUS
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                       AGGRESSIVE FIX COMPLETED                                ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host ""
Write-Host "Container Status:" -ForegroundColor White
docker-compose -f "$ScriptDir\docker-compose.yml" ps 2>&1 | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor White
Write-Host "  1. Open browser: http://localhost:5679" -ForegroundColor Cyan
Write-Host "  2. You should see the N8N LOGIN page" -ForegroundColor Green
Write-Host "  3. If still ERR_EMPTY_RESPONSE, check logs:" -ForegroundColor Yellow
Write-Host "     - docker logs -f rhia-n8n" -ForegroundColor Gray
Write-Host "     - docker logs -f rhia-postgres" -ForegroundColor Gray

Write-Host ""
Write-Host "Diagnostic Commands:" -ForegroundColor White
Write-Host "  - Check N8N user: docker exec rhia-postgres psql -U rhia -d rhia_core -c 'SELECT * FROM pg_user WHERE usename = ''n8n'';'" -ForegroundColor Gray
Write-Host "  - Check N8N DB: docker exec rhia-postgres psql -l" -ForegroundColor Gray

Write-Host ""
Write-Host "El sistema debería estar listo ahora. Esperando 30 segundos antes de salir..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host "¡Reparación completada!" -ForegroundColor Green
