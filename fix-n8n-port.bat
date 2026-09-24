@echo off
echo Liberando puerto 5678 para N8N...
echo.

REM Encontrar y matar el proceso que usa el puerto 5678
for /f "tokens=5" %%a in ('netstat -ano ^| find ":5678"') do (
    echo Matando proceso ID %%a que usa puerto 5678...
    taskkill /PID %%a /F 2>nul
)

echo.
echo Esperando 2 segundos...
timeout /t 2 /nobreak

echo.
echo Reiniciando contenedor N8N...
cd /d "C:\Users\jesfu\Desktop\Software RHIA\infrastructure"
docker-compose up -d rhia-n8n

echo.
echo Verificando estado de contenedores...
docker ps -a

echo.
echo Listo! Presiona cualquier tecla para cerrar.
pause
