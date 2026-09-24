@echo off
echo Deteniendo todos los contenedores RHIA...
cd /d "C:\Users\jesfu\Desktop\Software RHIA\infrastructure"
docker-compose down

echo.
echo Esperando 3 segundos...
timeout /t 3 /nobreak

echo.
echo Iniciando todos los contenedores RHIA de nuevo...
docker-compose up -d

echo.
echo Esperando que los contenedores arranquen...
timeout /t 5 /nobreak

echo.
echo Estado final de los contenedores:
docker ps -a

echo.
echo Listo! Presiona cualquier tecla para cerrar.
pause
