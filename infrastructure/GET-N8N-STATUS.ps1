# Script to check N8N container status and logs
cd "C:\Users\jesfu\Desktop\Software RHIA\infrastructure"

$outputFile = "N8N-LOGS-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"

Add-Content -Path $outputFile -Value "=== N8N Docker Status Check ==="
Add-Content -Path $outputFile -Value "Time: $(Get-Date)"
Add-Content -Path $outputFile -Value ""

Add-Content -Path $outputFile -Value "[1/3] Container Status:"
Add-Content -Path $outputFile -Value (docker-compose ps | Out-String)

Add-Content -Path $outputFile -Value ""
Add-Content -Path $outputFile -Value "[2/3] N8N Container Logs (Last 200 lines):"
Add-Content -Path $outputFile -Value (docker-compose logs n8n --tail 200 | Out-String)

Add-Content -Path $outputFile -Value ""
Add-Content -Path $outputFile -Value "[3/3] Docker Inspect N8N State:"
Add-Content -Path $outputFile -Value (docker inspect rhia-n8n | ConvertTo-Json | Out-String)

Write-Host "Logs saved to: $outputFile"
Write-Host "Archivo guardado en: $outputFile"
