@echo off
cd /d "C:\Users\jesfu\Desktop\Software RHIA\infrastructure"
echo [1/2] Verificando estado de contenedores...
docker-compose ps
echo.
echo [2/2] Últimos 150 líneas de logs de N8N...
docker-compose logs n8n --tail 150
pause
