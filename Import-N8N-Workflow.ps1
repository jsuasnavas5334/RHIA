# Script: Importar Workflow PH12 Lead Processor a N8N
# Uso: PowerShell -ExecutionPolicy Bypass -File Import-N8N-Workflow.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "N8N Workflow Importer - PH12 Lead Processor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuración
$n8nUrl = "http://localhost:5679"
$workflowJsonPath = "$PSScriptRoot\n8n-lead-processor-workflow.json"

# 1. Verificar que N8N está corriendo
Write-Host "[1/4] Verificando N8N..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-WebRequest -Uri "$n8nUrl/healthz" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ N8N está corriendo en $n8nUrl" -ForegroundColor Green
} catch {
    Write-Host "✗ N8N NO responde en $n8nUrl" -ForegroundColor Red
    Write-Host "Asegúrate de que Docker está corriendo y N8N está iniciado." -ForegroundColor Red
    exit 1
}

# 2. Verificar archivo JSON
Write-Host "[2/4] Verificando archivo de workflow..." -ForegroundColor Yellow
if (-Not (Test-Path $workflowJsonPath)) {
    Write-Host "✗ No encontrado: $workflowJsonPath" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Archivo encontrado: $workflowJsonPath" -ForegroundColor Green

# 3. Leer JSON
Write-Host "[3/4] Leyendo workflow..." -ForegroundColor Yellow
try {
    $workflowJson = Get-Content $workflowJsonPath -Raw | ConvertFrom-Json
    Write-Host "✓ Workflow válido: $($workflowJson.name)" -ForegroundColor Green
} catch {
    Write-Host "✗ Error al parsear JSON: $_" -ForegroundColor Red
    exit 1
}

# 4. Crear workflow en N8N
Write-Host "[4/4] Creando workflow en N8N..." -ForegroundColor Yellow

$payload = @{
    name = $workflowJson.name
    nodes = $workflowJson.nodes
    connections = $workflowJson.connections
    active = $false
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-WebRequest `
        -Uri "$n8nUrl/api/v1/workflows" `
        -Method Post `
        -ContentType "application/json" `
        -Body $payload `
        -TimeoutSec 10
    
    $result = $response.Content | ConvertFrom-Json
    $workflowId = $result.id
    
    Write-Host "✓ Workflow creado exitosamente!" -ForegroundColor Green
    Write-Host "  Workflow ID: $workflowId" -ForegroundColor Green
    Write-Host "  Nombre: $($result.name)" -ForegroundColor Green
    Write-Host ""
    Write-Host "PRÓXIMOS PASOS:" -ForegroundColor Cyan
    Write-Host "1. Abre N8N: $n8nUrl" -ForegroundColor White
    Write-Host "2. Busca el workflow: '$($workflowJson.name)'" -ForegroundColor White
    Write-Host "3. CONFIGURA la conexión PostgreSQL" -ForegroundColor Yellow
    Write-Host "4. Activa el workflow (click en 'Active')" -ForegroundColor White
    Write-Host ""
    Write-Host "Webhook URL para enviar datos:" -ForegroundColor Cyan
    Write-Host "http://localhost:5679/webhook/$workflowId/ph12-leads" -ForegroundColor Cyan
    
} catch {
    Write-Host "✗ Error al crear workflow: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✓ Proceso completado!" -ForegroundColor Green
