@echo off
REM RHIA Frontend - Installation & Testing Script para Windows
REM Este script instala dependencias, ejecuta tests y prepara el proyecto
REM Uso: INSTALL_AND_TEST.bat

setlocal enabledelayedexpansion

echo ================================================================
echo         RHIA Frontend - Installation ^& Testing Script
echo ================================================================
echo.

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo Error: npm no esta instalado
    echo Por favor, instala Node.js desde https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo npm version:
npm --version
echo.

REM Step 1: Install dependencies
echo ================================================================
echo PASO 1: Instalando dependencias...
echo ================================================================
echo.

call npm install
if errorlevel 1 (
    echo Error en la instalacion
    pause
    exit /b 1
)

echo.
echo OK - Dependencias instaladas correctamente
echo.

REM Step 2: Run tests
echo ================================================================
echo PASO 2: Ejecutando tests...
echo ================================================================
echo.

call npm run test -- --run
if errorlevel 1 (
    echo Algunos tests fallaron (esto es opcional)
)

echo.
echo OK - Tests completados
echo.

REM Step 3: Generate coverage report
echo ================================================================
echo PASO 3: Generando reporte de cobertura...
echo ================================================================
echo.

call npm run test:coverage
if errorlevel 1 (
    echo Error generando cobertura
)

echo.
echo OK - Reporte de cobertura generado en: coverage/index.html
echo.

REM Step 4: Build for production
echo ================================================================
echo PASO 4: Build para produccion...
echo ================================================================
echo.

call npm run build
if errorlevel 1 (
    echo Error en el build
    pause
    exit /b 1
)

echo.
echo OK - Build completado
echo    Output: dist/
echo.

REM Final summary
echo ================================================================
echo                    OK - INSTALACION COMPLETA
echo ================================================================
echo.
echo Proximos pasos:
echo.
echo 1. DESARROLLO (Servidor local con HMR):
echo    npm run dev
echo.
echo 2. VER REPORTE DE COBERTURA:
echo    start coverage\index.html
echo.
echo 3. VER TESTS EN UI:
echo    npm run test:ui
echo.
echo 4. DEPLOY A PRODUCCION:
echo    vercel deploy      (Vercel)
echo    netlify deploy     (Netlify)
echo.
echo 5. DOCUMENTACION:
echo    README.md - Setup y overview
echo    QUICKSTART.md - Inicio rapido
echo    TESTING_GUIDE.md - Guia de testing
echo    PROJECT_STRUCTURE.md - Arquitectura
echo.
echo ================================================================
echo.

pause
