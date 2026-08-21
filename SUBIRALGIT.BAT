@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

set "PROJECT_DIR=%~dp0"
set "REMOTE_URL=https://github.com/jsuasnavas5334/RHIA.git"
set "GIT_EXE=git"

cd /d "%PROJECT_DIR%"
if errorlevel 1 (
    echo ERROR: No se pudo acceder a la carpeta del proyecto:
    echo %PROJECT_DIR%
    pause
    exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
    if exist "C:\Program Files\Git\cmd\git.exe" (
        set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
    ) else if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" (
        set "GIT_EXE=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
    ) else (
        echo ERROR: Git no esta instalado o no se encuentra en PATH.
        pause
        exit /b 1
    )
)

echo.
echo ============================================================
echo   RHIA - PUBLICAR CAMBIOS EN GITHUB
echo ============================================================
echo Carpeta: %PROJECT_DIR%
echo Remoto:  %REMOTE_URL%
echo Rama:    main
echo.

"%GIT_EXE%" --version
if errorlevel 1 goto :error

if not exist ".git\" (
    echo.
    echo No existe un repositorio local. Se inicializara la rama main.
    set /p "CONFIRM_INIT=Escribe SI para continuar: "
    if /I not "!CONFIRM_INIT!"=="SI" goto :cancelled

    "%GIT_EXE%" init -b main
    if errorlevel 1 goto :error
)

set "CURRENT_REMOTE="
for /f "usebackq delims=" %%R in (`"%GIT_EXE%" remote get-url origin 2^>nul`) do set "CURRENT_REMOTE=%%R"

if not defined CURRENT_REMOTE (
    "%GIT_EXE%" remote add origin "%REMOTE_URL%"
    if errorlevel 1 goto :error
) else if /I not "%CURRENT_REMOTE%"=="%REMOTE_URL%" (
    echo.
    echo ERROR: El remoto origin apunta a una direccion diferente:
    echo %CURRENT_REMOTE%
    echo.
    echo Esperado:
    echo %REMOTE_URL%
    echo.
    echo No se modifico el remoto automaticamente.
    pause
    exit /b 1
)

set "CURRENT_BRANCH="
for /f "usebackq delims=" %%B in (`"%GIT_EXE%" branch --show-current 2^>nul`) do set "CURRENT_BRANCH=%%B"
if defined CURRENT_BRANCH if /I not "%CURRENT_BRANCH%"=="main" (
    echo.
    echo ERROR: La rama actual es "%CURRENT_BRANCH%" y este script solo publica main.
    echo Cambia de rama manualmente antes de volver a ejecutarlo.
    pause
    exit /b 1
)

echo.
echo Verificando estructura y ausencia de secretos publicables...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%scripts\verify-repository-baseline.ps1"
if errorlevel 1 (
    echo.
    echo ERROR: La verificacion preventiva del repositorio fallo.
    echo No se preparo ningun cambio ni se hizo push.
    pause
    exit /b 1
)

"%GIT_EXE%" ls-remote --exit-code --heads origin main >nul 2>&1
if not errorlevel 1 (
    echo.
    echo Verificando que el repositorio remoto no tenga cambios pendientes...
    "%GIT_EXE%" fetch origin main
    if errorlevel 1 goto :error

    "%GIT_EXE%" rev-parse --verify HEAD >nul 2>&1
    if not errorlevel 1 (
        "%GIT_EXE%" merge-base --is-ancestor origin/main HEAD
        if errorlevel 1 (
            echo.
            echo ERROR: GitHub contiene cambios que no estan integrados localmente.
            echo No se hizo push para evitar sobrescribir o crear conflictos.
            echo Ejecuta primero: git pull --rebase origin main
            pause
            exit /b 1
        )
    )
)

echo.
echo Archivos modificados o nuevos:
"%GIT_EXE%" status --short

"%GIT_EXE%" status --porcelain | findstr "." >nul
if errorlevel 1 (
    echo.
    echo No hay cambios locales para subir.
    pause
    exit /b 0
)

echo.
echo ADVERTENCIA: revisa la lista anterior. No deben aparecer archivos
echo .env, claves, tokens, cookies, credenciales ni backups de base de datos.
set /p "CONFIRM_STAGE=Escribe SI para preparar TODOS estos cambios: "
if /I not "%CONFIRM_STAGE%"=="SI" goto :cancelled

"%GIT_EXE%" add -A
if errorlevel 1 goto :error

echo.
echo Archivos preparados para el commit:
"%GIT_EXE%" diff --cached --name-status

"%GIT_EXE%" diff --cached --name-only | findstr /I /R /C:"\.env" /C:"\.pem$" /C:"\.key$" /C:"\.p12$" /C:"\.pfx$" /C:"\.passphrase$" /C:"\.dump$" /C:"\.dump\.gpg$" /C:"secrets/" /C:"\.rhia-secrets/" /C:"credentials/" /C:"cookies/" /C:"backups/" /C:"RHIA-Backups/" | findstr /V /I /R /C:"\.env\.example$" >nul
if not errorlevel 1 (
    echo.
    echo ERROR: Se detecto un nombre de archivo potencialmente sensible.
    echo No se creo el commit ni se hizo push. Revisa los archivos preparados.
    pause
    exit /b 1
)

"%GIT_EXE%" diff --cached --check -- . ":(exclude,glob)**/*.md"
if errorlevel 1 (
    echo.
    echo ERROR: Git encontro problemas en los cambios preparados.
    pause
    exit /b 1
)

set "GIT_NAME="
for /f "usebackq delims=" %%N in (`"%GIT_EXE%" config --get user.name 2^>nul`) do set "GIT_NAME=%%N"
if not defined GIT_NAME (
    echo.
    set /p "GIT_NAME=Escribe tu nombre para los commits: "
    if not defined GIT_NAME goto :cancelled
    "%GIT_EXE%" config user.name "!GIT_NAME!"
    if errorlevel 1 goto :error
)

set "GIT_EMAIL="
for /f "usebackq delims=" %%E in (`"%GIT_EXE%" config --get user.email 2^>nul`) do set "GIT_EMAIL=%%E"
if not defined GIT_EMAIL (
    echo.
    set /p "GIT_EMAIL=Escribe el email asociado a GitHub: "
    if not defined GIT_EMAIL goto :cancelled
    "%GIT_EXE%" config user.email "!GIT_EMAIL!"
    if errorlevel 1 goto :error
)

echo.
set "COMMIT_MESSAGE="
set /p "COMMIT_MESSAGE=Mensaje del commit [Actualiza avances RHIA]: "
if not defined COMMIT_MESSAGE set "COMMIT_MESSAGE=Actualiza avances RHIA"

echo.
echo Se creara el commit "%COMMIT_MESSAGE%" y se publicara en origin/main.
echo GitHub puede abrir el navegador para iniciar sesion la primera vez.
set /p "CONFIRM_PUSH=Escribe SUBIR para confirmar: "
if /I not "%CONFIRM_PUSH%"=="SUBIR" goto :cancelled

"%GIT_EXE%" commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 goto :error

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%scripts\verify-repository-baseline.ps1" -RequireCommit
if errorlevel 1 (
    echo.
    echo ERROR: El commit se creo localmente, pero fallo la verificacion final.
    echo No se hizo push. Corrige el problema antes de publicar.
    pause
    exit /b 1
)

"%GIT_EXE%" push -u origin main
if errorlevel 1 goto :error

echo.
echo ============================================================
echo Publicacion completada correctamente.
echo https://github.com/jsuasnavas5334/RHIA
echo ============================================================
pause
exit /b 0

:cancelled
echo.
echo Operacion cancelada. No se hizo push.
pause
exit /b 0

:error
echo.
echo ERROR: El proceso se detuvo. Revisa el mensaje anterior.
echo No se utilizo force push.
pause
exit /b 1
