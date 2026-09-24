# RHIA Frontend

Frontend para la plataforma de Automatización de Ventas B2B RHIA - Brivé Soluciones

## Requisitos Previos

- Node.js 18+ 
- npm o yarn
- Backend API ejecutándose en http://localhost:8000

## Instalación

```bash
# Clonar repositorio (si es necesario)
git clone <repo-url>
cd frontend

# Instalar dependencias
npm install

# Crear archivo .env desde el ejemplo
cp .env.example .env

# Configurar variables de entorno si es necesario
# Editar .env si el backend está en una dirección diferente
```

## Desarrollo

```bash
# Iniciar servidor de desarrollo
npm run dev

# La aplicación estará disponible en http://localhost:3000
```

## Build para Producción

```bash
# Compilar y optimizar
npm run build

# Verificar el build localmente
npm run preview
```

## Estructura del Proyecto

```
src/
├── api/                 # Clientes HTTP e Integración de API
│   ├── client.ts       # Configuración de Axios
│   └── hooks/          # Custom hooks para API
├── components/         # Componentes React reutilizables
│   ├── common/         # Componentes base (Button, Input, Card, etc)
│   └── forms/          # Formularios
├── pages/              # Páginas completas (Layout + Contenido)
├── store/              # Gestión de estado con Zustand
├── styles/             # Estilos CSS/Tailwind
├── types/              # Tipos TypeScript
├── App.tsx             # Componente principal
└── main.tsx            # Punto de entrada

```

## Características

### Autenticación
- Inicio de sesión con correo y contraseña
- JWT token en localStorage
- Protección de rutas automática
- Logout y cierre de sesión

### Dashboard
- Métricas principales del embudo de ventas
- Gráficos de estado de leads
- Distribución por industria
- Actividad reciente

### Gestión de Leads
- Lista completa con búsqueda y filtros
- Detalle de cada lead con toda la información
- Crear nuevos leads
- Editar información de leads
- Cambiar estado de leads
- Agregar notas y observaciones
- Eliminar leads

### Automatización
- Crear reglas de automatización
- Configurar frecuencias (inmediata, delays, diaria, semanal)
- Activar/desactivar reglas
- Visualizar ejecuciones
- Eliminar reglas

### Reportes
- Embudo de conversión visual
- Métricas clave (tasa contacto, respuesta, cierre)
- Desempeño por industria
- Historiales de ejecución

## Tecnologías

- **React 18** - UI Framework
- **TypeScript** - Type Safety
- **Vite** - Build Tool & Dev Server
- **Tailwind CSS** - Styling
- **Zustand** - State Management
- **Axios** - HTTP Client
- **React Router** - Client-side Routing

## Componentes Principales

### UI Components (`src/components/common/`)
- `Button` - Botón reutilizable con variantes
- `Input` - Campo de entrada con validación
- `Card` - Contenedor genérico
- `StatCard` - Card para estadísticas
- `Badge` - Etiqueta de estado
- `Loader` - Spinner de carga
- `Table` - Tabla genérica reutilizable

### Hooks Personalizados
- `useAuth()` - Gestión de autenticación
- `useLeads()` - CRUD de leads
- `useLead(id)` - Detalle de un lead
- `useDashboard()` - Métricas del dashboard

### Stores (Zustand)
- `authStore` - Estado de autenticación
- `leadsStore` - Estado de leads y filtros

## API Integration

El frontend se conecta a los siguientes endpoints:

```
POST   /auth/login                    - Autenticación
GET    /crm/dashboard               - Métricas dashboard
GET    /leads                        - Listar leads
POST   /leads                        - Crear lead
GET    /leads/:id                    - Detalle lead
PUT    /leads/:id                    - Actualizar lead
DELETE /leads/:id                    - Eliminar lead
GET    /automation/rules             - Listar reglas
POST   /automation/rules             - Crear regla
GET    /automation/rules/:id         - Detalle regla
PUT    /automation/rules/:id         - Actualizar regla
DELETE /automation/rules/:id         - Eliminar regla
GET    /crm/reports/conversion       - Reporte conversión
GET    /crm/reports/by-industry      - Reporte industrias
```

## Variables de Entorno

```
VITE_API_BASE_URL=http://localhost:8000/api    # URL base de la API
VITE_APP_NAME=RHIA                              # Nombre de la app
```

## Desarrollo

### Agregar un Nuevo Componente

1. Crear archivo en `src/components/[categoria]/NuevoComponente.tsx`
2. Exportar desde `src/components/index.ts`
3. Importar donde sea necesario

### Agregar Una Nueva Página

1. Crear archivo en `src/pages/NuevaPage.tsx`
2. Crear componente funcional que retorne JSX
3. Agregar ruta en `src/App.tsx`
4. Usar `ProtectedRoute` si requiere autenticación

### Agregar Un Nuevo Hook de API

1. Crear archivo en `src/api/hooks/useNuevoHook.ts`
2. Exportar el hook
3. Importar en la página/componente que lo use
4. Usar con el hook de React

## Testing

```bash
# Ejecutar tests (cuando estén implementados)
npm run test

# Coverage
npm run test:coverage
```

## Troubleshooting

### Error: "Cannot find module"
- Ejecutar `npm install`
- Verificar la ruta de importación

### Error: "API not responding"
- Verificar que el backend está ejecutándose
- Verificar VITE_API_BASE_URL en .env
- Revisar la consola del navegador para más detalles

### Error: "Unauthorized"
- Token expirado - Hacer logout e ingresar nuevamente
- Verificar que el backend está en la misma red

## Performance

- Lazy loading de rutas con React.lazy (próximo)
- Code splitting automático con Vite
- Optimización de imágenes
- Caché HTTP con Axios

## Seguridad

- Tokens JWT almacenados en localStorage
- HTTPS en producción (configurar en proxy)
- Headers de seguridad (próximo)
- Validación de entrada del lado del cliente

## Licencia

© 2026 Brivé Soluciones - RHIA
