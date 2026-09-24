# RHIA - Verificar que todos los servicios están corriendo

Write-Host ""
Write-Host "=============================================="
Write-Host "RHIA - Verificar Estado de Servicios"
Write-Host "=============================================="
Write-Host ""

Write-Host "Verificando estado de contenedores Docker..."
Write-Host ""

# Check if docker is available
$dockerExists = Get-Command docker -ErrorAction SilentlyContinue

if ($dockerExists) {
    Write-Host "Estado de los contenedores Docker:"
    Write-Host ""
    docker ps --format "table {{.Names}}\t{{.Status}}"
    
    Write-Host ""
    Write-Host "=============================================="
    Write-Host ""
    Write-Host "Verificando puertos de acceso:"
    Write-Host ""
    Write-Host "PostgreSQL:"
    Write-Host "  Puerto: 5432"
    Write-Host "  Comando: psql -h localhost -U rhia_user -d rhia_db"
    Write-Host ""
    
    Write-Host "N8N (Automatización):"
    Write-Host "  URL: http://127.0.0.1:5679"
    Write-Host ""
    
    Write-Host "SearXNG (Búsqueda):"
    Write-Host "  URL: http://127.0.0.1:8080"
    Write-Host ""
    
    Write-Host "Ollama (IA Local):"
    Write-Host "  URL: http://127.0.0.1:11434"
    Write-Host ""
    
} else {
    Write-Host "ERROR: Docker no está instalado o no está en el PATH"
}

Write-Host "=============================================="
Write-Host ""
Read-Host "Presione Enter para salir"
