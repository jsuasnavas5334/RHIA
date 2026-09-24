# RHIA - Verificación Completa de Servicios

Write-Host ""
Write-Host "=============================================="
Write-Host "RHIA - VERIFICACION COMPLETA DE SERVICIOS"
Write-Host "=============================================="
Write-Host ""

# Test function
function Test-Service {
    param(
        [string]$Name,
        [string]$Host,
        [int]$Port,
        [string]$Protocol = "TCP"
    )
    
    try {
        if ($Protocol -eq "HTTP") {
            $response = Invoke-WebRequest -Uri "http://$Host`:$Port" -TimeoutSec 3 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 404 -or $response.StatusCode -eq 302) {
                Write-Host "✅ $Name - ACCESIBLE (HTTP $($response.StatusCode))"
                return $true
            }
        } else {
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $asyncResult = $tcpClient.BeginConnect($Host, $Port, $null, $null)
            $wait = $asyncResult.AsyncWaitHandle.WaitOne(2000, $false)
            
            if ($wait -and $tcpClient.Connected) {
                Write-Host "✅ $Name - ACCESIBLE (Puerto $Port)"
                $tcpClient.Close()
                return $true
            } else {
                Write-Host "❌ $Name - NO ACCESIBLE (Puerto $Port)"
                if ($tcpClient) { $tcpClient.Close() }
                return $false
            }
        }
    } catch {
        Write-Host "❌ $Name - ERROR: $_"
        return $false
    }
}

Write-Host "1. VERIFICANDO ESTADO DE CONTENEDORES DOCKER"
Write-Host "---------------------------------------------"
Write-Host ""
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host ""

Write-Host "2. VERIFICANDO ACCESIBILIDAD DE PUERTOS"
Write-Host "---------------------------------------------"
Write-Host ""

$services = @(
    @{Name="PostgreSQL"; Host="localhost"; Port=5432; Protocol="TCP"},
    @{Name="N8N (Automatización)"; Host="127.0.0.1"; Port=5679; Protocol="HTTP"},
    @{Name="SearXNG (Búsqueda)"; Host="127.0.0.1"; Port=8080; Protocol="HTTP"},
    @{Name="Ollama (IA Local)"; Host="127.0.0.1"; Port=11434; Protocol="HTTP"}
)

$results = @()
foreach ($service in $services) {
    $result = Test-Service -Name $service.Name -Host $service.Host -Port $service.Port -Protocol $service.Protocol
    $results += $result
}

Write-Host ""
Write-Host "3. VERIFICANDO LOGS DE SERVICIOS"
Write-Host "---------------------------------------------"
Write-Host ""

Write-Host "PostgreSQL - Últimas líneas de log:"
docker logs rhia-postgres 2>&1 | Select-Object -Last 5 | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "N8N - Últimas líneas de log:"
docker logs rhia-n8n 2>&1 | Select-Object -Last 5 | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "SearXNG - Últimas líneas de log:"
docker logs rhia-searxng 2>&1 | Select-Object -Last 5 | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "Ollama - Últimas líneas de log:"
docker logs rhia-ollama 2>&1 | Select-Object -Last 5 | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "4. RESUMEN FINAL"
Write-Host "---------------------------------------------"
Write-Host ""

$healthyCount = ($results | Where-Object { $_ -eq $true }).Count
$totalCount = $results.Count

if ($healthyCount -eq $totalCount) {
    Write-Host "✅ TODOS LOS SERVICIOS ESTÁN FUNCIONANDO CORRECTAMENTE"
} else {
    Write-Host "⚠️  ALGUNOS SERVICIOS TIENEN PROBLEMAS"
    Write-Host "   Servicios OK: $healthyCount / $totalCount"
}

Write-Host ""
Write-Host "URLs de acceso:"
Write-Host "  N8N: http://127.0.0.1:5679"
Write-Host "  SearXNG: http://127.0.0.1:8080"
Write-Host "  Ollama: http://127.0.0.1:11434"
Write-Host ""
Write-Host "=============================================="
Write-Host ""
Read-Host "Presione Enter para salir"
