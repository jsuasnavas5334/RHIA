# Script: Fix N8N Encryption Key Mismatch - CORRECTED
# Usage: PowerShell -ExecutionPolicy Bypass -File FIX-N8N-CORRECTED.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "N8N Encryption Key Fix - RHIA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$infra_dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $infra_dir
Write-Host "[1/4] Directorio: $infra_dir" -ForegroundColor Yellow

# Detener contenedores
Write-Host "[2/4] Deteniendo contenedores..." -ForegroundColor Yellow
docker-compose down
Write-Host "✓ Contenedores detenidos" -ForegroundColor Green
Start-Sleep -Seconds 5

# Eliminar volumen N8N
Write-Host "[3/4] Eliminando volumen antiguo N8N..." -ForegroundColor Yellow
docker volume rm infrastructure_rhia_n8n_data -f 2>$null
Write-Host "✓ Volumen eliminado" -ForegroundColor Green
Start-Sleep -Seconds 3

# Iniciar contenedores
Write-Host "[4/4] Iniciando contenedores..." -ForegroundColor Yellow
docker-compose up -d
Write-Host "✓ Contenedores iniciados" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✓ ¡FIX COMPLETADO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "N8N estará disponible en: http://localhost:5679" -ForegroundColor Cyan
Write-Host "Espera 1-2 minutos a que N8N inicie completamente."
