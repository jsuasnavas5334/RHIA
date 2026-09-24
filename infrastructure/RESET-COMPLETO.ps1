Write-Host "RESET COMPLETO DE RHIA INFRASTRUCTURE" -ForegroundColor Red
Write-Host "======================================" -ForegroundColor Red
Write-Host ""

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir

Write-Host "[1/5] Deteniendo TODO..." -ForegroundColor Yellow
docker-compose down -v
Write-Host "✓ Detenido" -ForegroundColor Green
Start-Sleep -Seconds 3

Write-Host "[2/5] Limpiando volúmenes..." -ForegroundColor Yellow
docker volume prune -f
Write-Host "✓ Volúmenes limpios" -ForegroundColor Green
Start-Sleep -Seconds 2

Write-Host "[3/5] Iniciando PostgreSQL PRIMERO..." -ForegroundColor Yellow
docker-compose up -d postgres
Start-Sleep -Seconds 10
docker-compose logs postgres | tail -5
Write-Host "✓ PostgreSQL iniciado" -ForegroundColor Green

Write-Host "[4/5] Iniciando todos los servicios..." -ForegroundColor Yellow
docker-compose up -d
Start-Sleep -Seconds 15
Write-Host "✓ Servicios iniciados" -ForegroundColor Green

Write-Host "[5/5] Verificando estado..." -ForegroundColor Yellow
docker-compose ps
Write-Host ""
Write-Host "LISTO. Abre http://localhost:5679 en 30 segundos." -ForegroundColor Green
