@echo off
setlocal enabledelayedexpansion

echo ===== DIAGNOSTICO DE PUERTO 5678 =====
echo.

echo Buscando QUE esta usando puerto 5678...
netstat -ano | find ":5678"
echo.

REM Matar TODOS los procesos node.exe (n8n corre en Node)
echo Matando todos los procesos node.exe...
taskkill /IM node.exe /F 2>nul

REM Matar cualquier otro proceso que pudiera ser n8n
echo Matando procesos n8n...
taskkill /IM n8n.exe /F 2>nul

echo.
echo Esperando 3 segundos...
timeout /t 3 /nobreak

echo.
echo Verificando si puerto 5678 esta libre...
netstat -ano | find ":5678" >nul
if errorlevel 1 (
    echo Puerto 5678 ESTA LIBRE!
) else (
    echo Puerto 5678 SIGUE OCUPADO - intenta ejecutar esto como Administrador
)

echo.
echo Listo! Presiona cualquier tecla para cerrar.
pause
