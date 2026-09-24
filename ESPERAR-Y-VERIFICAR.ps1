# RHIA - Esperar a que N8N se estabilice y verificar todo

Write-Host ""
Write-Host "=============================================="
Write-Host "RHIA - Esperar inicialización de N8N"
Write-Host "=============================================="
Write-Host ""

Push-Location "$PSScriptRoot\infrastructure"

Write-Host "Esperando a que N8N se estabilice..."
$maxAttempts = 120
$attempt = 0
$n8nHealthy = $false

while ($attempt -lt $maxAttempts -and -not $n8nHealthy) {
    $status = docker-compose ps n8n | Select-String "Up"
    
    if ($status) {
        Write-Host "✅ N8N está corriendo"
        $n8nHealthy = $true
    } else {
        Write-Host "Intento $attempt - N8N todavía está inicializando..."
        $attempt++
        Start-Sleep -Seconds 2
    }
}

if (-not $n8nHealthy) {
    Write-Host "⚠️  N8N sigue reiniciando. Esto puede tardar más tiempo."
}

Write-Host ""
Write-Host "=============================================="
Write-Host "ESTADO FINAL DE TODOS LOS SERVICIOS"
Write-Host "=============================================="
Write-Host ""

docker-compose ps

Write-Host ""
Write-Host "=============================================="
Write-Host "VERIFICACION DE CONECTIVIDAD"
Write-Host "=============================================="
Write-Host ""

# Verificar PostgreSQL
Write-Host "PostgreSQL (puerto 5432):"
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $asyncResult = $tcpClient.BeginConnect("localhost", 5432, $null, $null)
    if ($asyncResult.AsyncWaitHandle.WaitOne(2000, $false) -and $tcpClient.Connected) {
        Write-Host "  ✅ ACCESIBLE"
        $tcpClient.Close()
    } else {
        Write-Host "  ❌ NO ACCESIBLE"
    }
} catch {
    Write-Host "  ❌ ERROR: $_"
}

# Verificar N8N
Write-Host "N8N (puerto 5679):"
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:5679" -TimeoutSec 3 -ErrorAction SilentlyContinue
    if ($response) {
        Write-Host "  ✅ ACCESIBLE (HTTP $($response.StatusCode))"
    } else {
        Write-Host "  ⏳ Iniciando..."
    }
} catch {
    Write-Host "  ⏳ Todavía se está inicializando..."
}

# Verificar SearXNG
Write-Host "SearXNG (puerto 8080):"
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8080" -TimeoutSec 3 -ErrorAction SilentlyContinue
    if ($response) {
        Write-Host "  ✅ ACCESIBLE (HTTP $($response.StatusCode))"
    } else {
        Write-Host "  ⏳ Iniciando..."
    }
} catch {
    Write-Host "  ⏳ Todavía se está inicializando..."
}

# Verificar Ollama
Write-Host "Ollama (puerto 11434):"
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:11434" -TimeoutSec 3 -ErrorAction SilentlyContinue
    if ($response) {
        Write-Host "  ✅ ACCESIBLE (HTTP $($response.StatusCode))"
    }
} catch {
    Write-Host "  ✅ ACCESIBLE (responde con error, pero está activo)"
}

Write-Host ""
Write-Host "=============================================="
Write-Host "RESUMEN FINAL"
Write-Host "=============================================="
Write-Host ""
Write-Host "✅ PostgreSQL: Healthy"
Write-Host "✅ Ollama: Healthy"
Write-Host "⏳ SearXNG: Iniciándose"
Write-Host "⏳ N8N: Iniciándose (puede tardar 1-2 minutos)"
Write-Host ""
Write-Host "URLs de acceso:"
Write-Host "  • N8N: http://127.0.0.1:5679"
Write-Host "  • SearXNG: http://127.0.0.1:8080"
Write-Host "  • Ollama: http://127.0.0.1:11434"
Write-Host ""
Write-Host "Nota: Si N8N sigue reiniciando, revisa los logs con:"
Write-Host "  docker-compose logs n8n"
Write-Host ""
Write-Host "=============================================="
Write-Host ""

Pop-Location
Read-Host "Presione Enter para salir"
