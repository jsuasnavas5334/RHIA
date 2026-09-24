# Diagnóstico N8N
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir

Write-Host "=== LOGS N8N ===" -ForegroundColor Cyan
docker-compose logs n8n --tail 100

Write-Host ""
Write-Host "=== ESTADO CONTENEDORES ===" -ForegroundColor Cyan
docker-compose ps

Write-Host ""
Write-Host "Guardando en diagnostico.txt..."
(docker-compose logs n8n --tail 100) | Out-File "diagnostico.txt"
Write-Host "✓ Guardado en: diagnostico.txt"
