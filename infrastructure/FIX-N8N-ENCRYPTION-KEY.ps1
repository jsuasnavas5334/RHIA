# Script: Fix N8N Encryption Key Mismatch
# Purpose: Remove persisted N8N config to force reinitialization with correct .env key
# Usage: PowerShell -ExecutionPolicy Bypass -File FIX-N8N-ENCRYPTION-KEY.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "N8N Encryption Key Fix - RHIA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to infrastructure folder
$infra_dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $infra_dir
Write-Host "[1/5] Working directory: $infra_dir" -ForegroundColor Yellow

# Step 1: Stop all containers
Write-Host "[2/5] Stopping containers..." -ForegroundColor Yellow
try {
    docker-compose down
    Write-Host "✓ Containers stopped" -ForegroundColor Green
} catch {
    Write-Host "⚠ Error stopping containers: $_" -ForegroundColor Red
}

Start-Sleep -Seconds 5

# Step 2: Remove N8N volume
Write-Host "[3/5] Removing old N8N volume..." -ForegroundColor Yellow
try {
    $volumes = docker volume ls --format "{{.Name}}"
    if ($volumes -match "rhia_n8n_data|infrastructure_rhia_n8n_data") {
        docker volume rm infrastructure_rhia_n8n_data -f
        Write-Host "✓ N8N volume removed" -ForegroundColor Green
    } else {
        Write-Host "✓ N8N volume not found (already clean)" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ Error removing volume: $_" -ForegroundColor Red
}

Start-Sleep -Seconds 3

# Step 3: Start containers
Write-Host "[4/5] Starting containers..." -ForegroundColor Yellow
try {
    docker-compose up -d
    Write-Host "✓ Containers started" -ForegroundColor Green
} catch {
    Write-Host "✗ Error starting containers: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Wait for N8N to be healthy
Write-Host "[5/5] Waiting for N8N to be healthy..." -ForegroundColor Yellow
$max_attempts = 30
$attempt = 0
$healthy = $false

while ($attempt -lt $max_attempts -and -not $healthy) {
    try {
        $response = curl -s -f "http://localhost:5679/healthz" -w "%{http_code}"
        if ($response -match "200") {
            Write-Host "✓ N8N is healthy!" -ForegroundColor Green
            $healthy = $true
        }
    } catch {
        # Ignore errors, keep trying
    }
    
    if (-not $healthy) {
        $attempt++
        Write-Host "  Waiting... ($attempt/$max_attempts)" -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

if ($healthy) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✓ FIX COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "N8N is ready at: http://localhost:5679" -ForegroundColor Cyan
    Write-Host "Database: PostgreSQL is running on localhost:5432" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "⚠ Timeout waiting for N8N to be healthy" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Check container status with:" -ForegroundColor Cyan
    Write-Host "  docker-compose ps" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Check N8N logs with:" -ForegroundColor Cyan
    Write-Host "  docker-compose logs n8n" -ForegroundColor Gray
}
