@echo off
echo Cambiando puerto de N8N de 5678 a 5679 en docker-compose.yml...
cd /d "C:\Users\jesfu\Desktop\Software RHIA\infrastructure"

REM Hacer backup del archivo original
copy docker-compose.yml docker-compose.yml.backup

REM Cambiar puerto 5678 por 5679
powershell -Command "(Get-Content docker-compose.yml) -replace '127.0.0.1:5678', '127.0.0.1:5679' | Set-Content docker-compose.yml"

echo Recreando contenedores con el nuevo puerto...
docker-compose down
timeout /t 2 /nobreak

echo Iniciando contenedores...
docker-compose up -d

timeout /t 5 /nobreak

echo.
echo Estado final:
docker ps -a

echo.
echo Listo! N8N ahora esta en puerto 5679 (antes era 5678)
echo Presiona cualquier tecla para cerrar.
pause
