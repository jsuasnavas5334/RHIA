# Check Docker status
Write-Host "=== Docker Version ===" 
docker version
Write-Host "`n=== Docker PS ===" 
docker ps -a
Write-Host "`n=== Docker Images ===" 
docker images
Write-Host "`n=== WSL Status ===" 
wsl --status
Write-Host "`n=== Done ===" 
