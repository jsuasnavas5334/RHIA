$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir

Write-Host "RESET COMPLETO" -ForegroundColor Red
Write-Host "==============" -ForegroundColor Red

Write-Host "[1/4] Deteniendo todo..." -ForegroundColor Yellow
docker-compose down -v --remove-orphans
Start-Sleep -Seconds 3
Write-Host "✓ OK" -ForegroundColor Green

Write-Host "[2/4] Esperando PostgreSQL..."  -ForegroundColor Yellow
docker-compose up -d postgres
$waited = 0
while ($waited -lt 60) {
    $health = docker inspect --format='{{.State.Health.Status}}' rhia-postgres 2>$null
    if ($health -eq "healthy") { break }
    $waited += 2
    Start-Sleep -Seconds 2
}
Write-Host "✓ PostgreSQL Healthy" -ForegroundColor Green

Write-Host "[3/4] Iniciando todos..." -ForegroundColor Yellow
docker-compose up -d
Start-Sleep -Seconds 10
Write-Host "✓ OK" -ForegroundColor Green

Write-Host "[4/4] Estado:" -ForegroundColor Yellow
docker-compose ps

Write-Host ""
Write-Host "✓ LISTO en 60 segundos: http://localhost:5679" -ForegroundColor Green
