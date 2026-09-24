#!/bin/bash

# RHIA Frontend - Installation & Testing Script
# Este script instala dependencias, ejecuta tests y prepara el proyecto
# Uso: bash INSTALL_AND_TEST.sh

set -e  # Exit on error

echo "════════════════════════════════════════════════════════════════"
echo "        RHIA Frontend - Installation & Testing Script"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ ERROR: npm no está instalado"
    echo "Por favor, instala Node.js desde https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js version: $(node --version)"
echo "✓ npm version: $(npm --version)"
echo ""

# Step 1: Install dependencies
echo "════════════════════════════════════════════════════════════════"
echo "PASO 1: Instalando dependencias..."
echo "════════════════════════════════════════════════════════════════"
echo ""

npm install

echo ""
echo "✅ Dependencias instaladas correctamente"
echo ""

# Step 2: Run tests
echo "════════════════════════════════════════════════════════════════"
echo "PASO 2: Ejecutando tests..."
echo "════════════════════════════════════════════════════════════════"
echo ""

npm run test -- --run

echo ""
echo "✅ Tests completados"
echo ""

# Step 3: Generate coverage report
echo "════════════════════════════════════════════════════════════════"
echo "PASO 3: Generando reporte de cobertura..."
echo "════════════════════════════════════════════════════════════════"
echo ""

npm run test:coverage

echo ""
echo "✅ Reporte de cobertura generado en: coverage/index.html"
echo ""

# Step 4: Build for production
echo "════════════════════════════════════════════════════════════════"
echo "PASO 4: Build para producción..."
echo "════════════════════════════════════════════════════════════════"
echo ""

npm run build

echo ""
echo "✅ Build completado"
echo "   Output: dist/"
echo ""

# Final summary
echo "════════════════════════════════════════════════════════════════"
echo "                    ✅ INSTALACIÓN COMPLETA"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Próximos pasos:"
echo ""
echo "1. DESARROLLO (Servidor local con HMR):"
echo "   npm run dev"
echo ""
echo "2. VER REPORTE DE COBERTURA:"
echo "   open coverage/index.html"
echo ""
echo "3. VER TESTS EN UI:"
echo "   npm run test:ui"
echo ""
echo "4. DEPLOY A PRODUCCIÓN:"
echo "   vercel deploy      (Vercel)"
echo "   netlify deploy     (Netlify)"
echo ""
echo "5. DOCUMENTACIÓN:"
echo "   README.md - Setup y overview"
echo "   QUICKSTART.md - Inicio rápido"
echo "   TESTING_GUIDE.md - Guía de testing"
echo "   PROJECT_STRUCTURE.md - Arquitectura"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
