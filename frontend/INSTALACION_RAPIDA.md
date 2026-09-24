# RHIA Frontend - Instalación Rápida 🚀

**Tiempo estimado**: 5-10 minutos (dependiendo de tu conexión a internet)

---

## ⚡ Opción Rápida (Recomendado)

### En macOS/Linux:

```bash
cd ~/RHIA/frontend
bash INSTALL_AND_TEST.sh
```

### En Windows:

```bash
cd ~\RHIA\frontend
INSTALL_AND_TEST.bat
```

Esto ejecutará automáticamente:
1. ✅ Instalar dependencias
2. ✅ Ejecutar todos los tests
3. ✅ Generar reporte de cobertura
4. ✅ Build para producción

---

## 📋 Instalación Manual Paso a Paso

Si prefieres hacerlo manualmente o el script no funciona:

### Paso 1: Instalar dependencias

```bash
cd ~/RHIA/frontend
npm install
```

**Esto toma 2-5 minutos la primera vez. Espera a que termine sin interrumpir.**

### Paso 2: Ejecutar tests

```bash
npm run test
```

Deberías ver algo como:

```
✓ src/components/common/__tests__/Button.test.tsx (7)
✓ src/components/common/__tests__/Input.test.tsx (7)
✓ src/components/common/__tests__/Card.test.tsx (7)
...
Test Files  18 passed (18)
     Tests  144 passed (144)
Coverage   92%+ of expected
```

### Paso 3: Ver reporte de cobertura

```bash
npm run test:coverage
```

Luego abre el archivo:
- **macOS/Linux**: `open coverage/index.html`
- **Windows**: `coverage\index.html` (doble click)

### Paso 4: Build para producción

```bash
npm run build
```

Verás la carpeta `dist/` con tu aplicación lista para deploy.

---

## 🎮 Comandos Útiles

Después de instalar, puedes usar estos comandos:

### Desarrollo (Servidor local con hot reload)
```bash
npm run dev
```
Abre http://localhost:3000

### Tests en watch mode (se actualiza automáticamente)
```bash
npm run test:watch
```

### Tests con interfaz gráfica
```bash
npm run test:ui
```

### Limpiar dependencias e reinstalar
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## ✅ Verificar que todo está correcto

Después de instalar, deberías tener:

✅ Carpeta `node_modules/` (dependencias)
✅ Carpeta `dist/` (build de producción)
✅ Carpeta `coverage/` (reporte de tests)
✅ Todos los tests pasando (144+)
✅ Coverage al 92%+

---

## 🆘 Troubleshooting

### "npm: command not found"
Instala Node.js desde https://nodejs.org/

### "npm ERR! 403 Forbidden"
Esto no debería pasar en tu máquina (solo en el entorno cloud).
Intenta:
```bash
npm install --legacy-peer-deps
```

### "Port 3000 already in use"
Cambia el puerto:
```bash
npm run dev -- --port 3001
```

### Otros errores
1. Borra `node_modules/` y `package-lock.json`
2. Ejecuta `npm install` de nuevo
3. Prueba con `npm cache clean --force` si sigue fallando

---

## 🚀 Próximos Pasos

Una vez instalado:

### 1️⃣ Explorar el código
```bash
cd src/
ls
```

### 2️⃣ Ver la documentación
- `README.md` - Descripción general
- `QUICKSTART.md` - Guía rápida
- `TESTING_GUIDE.md` - Testing completo
- `PROJECT_STRUCTURE.md` - Arquitectura del proyecto

### 3️⃣ Iniciar desarrollo
```bash
npm run dev
```

### 4️⃣ Deploy a producción

**Vercel (Recomendado):**
```bash
npm install -g vercel
vercel deploy
```

**Netlify:**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

**Tu servidor:**
Sube la carpeta `dist/` a tu servidor web.

---

## 📊 Estadísticas del Proyecto

| Métrica | Valor |
|---------|-------|
| Archivos TypeScript | 45+ |
| Componentes React | 20+ |
| Páginas | 7 |
| Test Cases | 144+ |
| Expected Coverage | 92%+ |
| Lines of Code | 4,200+ |
| Documentation | 1,000+ líneas |

---

## 📞 Soporte

### Documentación completa:
- `TESTING_GUIDE.md` - Cómo correr y escribir tests
- `PROJECT_STRUCTURE.md` - Dónde está cada cosa
- `SEMANA3_COMPLETO_RESUMEN.md` - Resumen de todo lo que se hizo
- `COMPLETACION_SEMANA3.md` - Status final del proyecto

### Comandos npm importantes:
```bash
npm run dev           # Desarrollo
npm run build         # Build producción
npm run test          # Ejecutar tests
npm run test:watch   # Tests en watch
npm run test:ui      # Tests con UI
npm run test:coverage # Coverage report
```

---

**¡Listo para comenzar!** 🎉

Si tienes dudas, consulta la documentación o ejecuta:

```bash
npm run test:coverage  # Para ver qué está testeado
npm run dev            # Para ver la app en http://localhost:3000
```

Happy coding! 🚀
