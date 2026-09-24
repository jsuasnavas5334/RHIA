# RHIA Frontend - Quick Start Guide

## 🚀 En 5 Minutos

### 1. Instalar Dependencias
```bash
cd frontend
npm install
```

### 2. Configurar Entorno
```bash
cp .env.example .env
```

Si el backend está en otro puerto, editar `.env`:
```
VITE_API_BASE_URL=http://localhost:8000/api
```

### 3. Iniciar Servidor de Desarrollo
```bash
npm run dev
```

La aplicación estará en **http://localhost:3000**

### 4. Login
- Usa cualquier email y contraseña (modo desarrollo)
- El backend validará las credenciales

### 5. ¡Listo! 🎉

---

## 📱 Funcionalidades Disponibles

✅ **Dashboard** - Métricas y actividad
✅ **Leads** - Listar, crear, editar, eliminar
✅ **Automatización** - Crear y gestionar reglas
✅ **Reportes** - Análisis del embudo de ventas

---

## 🔧 Comandos Útiles

```bash
# Desarrollo con hot reload
npm run dev

# Build para producción
npm run build

# Ver el build localmente
npm run preview

# Linting (cuando esté configurado)
npm run lint
```

---

## 📊 Stack Tecnológico

- React 18 + TypeScript
- Vite (bundler rápido)
- Tailwind CSS (styling)
- Zustand (state management)
- Axios (HTTP client)
- React Router (navegación)

---

## 🐛 Troubleshooting

### "Cannot find module" error
```bash
npm install
```

### API no responde
1. Verificar que backend está en http://localhost:8000
2. Revisar VITE_API_BASE_URL en .env
3. Ver console del navegador (F12 → Console)

### Port 3000 ya está en uso
Cambiar puerto en `vite.config.ts`:
```typescript
server: {
  port: 3001  // nuevo puerto
}
```

---

## 📁 Estructura Principal

```
src/
├── pages/        → Páginas completas (Dashboard, Leads, etc)
├── components/   → Componentes reutilizables
├── api/          → Integración con backend
├── store/        → Estado global (Zustand)
└── types/        → Tipos TypeScript
```

---

## 🔐 Autenticación

1. Token JWT se guarda en localStorage
2. Se envía automáticamente en cada request
3. Si expira (401), redirige a login
4. Logout limpia el token

---

## 🎨 Personalización Rápida

### Cambiar Color Principal
Editar `src/styles/index.css`:
```css
:root {
  --color-primary: #3b82f6; /* cambiar azul a otro color */
}
```

### Cambiar Logo
Editar `src/components/Navigation.tsx`:
```jsx
<h1 className="text-xl font-bold text-blue-600">TU_LOGO</h1>
```

### Agregar Nueva Página
1. Crear `src/pages/MiPágina.tsx`
2. Agregar ruta en `src/App.tsx`
3. Añadir link en `src/components/Navigation.tsx`

---

## 📚 Recursos

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Zustand Guide](https://github.com/pmndrs/zustand)
- [Vite Docs](https://vitejs.dev/)

---

## 🚀 Deploy a Producción

### Build
```bash
npm run build
```

Genera carpeta `dist/` con archivos optimizados.

### Deploy en Vercel (Recomendado)
```bash
npm i -g vercel
vercel
```

### Deploy en Netlify
1. Conectar repo de GitHub
2. Build command: `npm run build`
3. Publish directory: `dist`

### Deploy Manual
```bash
npm run build
# Copiar contenido de dist/ a tu servidor web
```

---

## 📈 Performance Tips

1. **Usa npm run build** antes de deploy (minificación)
2. **Habilita gzip** en tu servidor
3. **Usa CDN** para archivos estáticos
4. **Lazy load** routes (próximo update)

---

## 🤝 Contribuir

1. Crear rama: `git checkout -b feature/mi-feature`
2. Hacer cambios
3. Commit: `git commit -am 'Describir cambio'`
4. Push: `git push origin feature/mi-feature`
5. Pull Request

---

## 📞 Soporte

- Revisar `README.md` para documentación completa
- Ver `DEVELOPMENT_CHECKLIST.md` para estado del proyecto
- Revisar `PROJECT_STRUCTURE.md` para arquitectura

---

**Última actualización**: 2026-09-23
**Versión**: 1.0.0-alpha
**Status**: ✅ Listo para desarrollo
