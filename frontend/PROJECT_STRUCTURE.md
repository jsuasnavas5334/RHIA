# RHIA Frontend - Estructura de Proyecto

## Árbol de Archivos Completo

```
frontend/
├── index.html                          # Entry HTML
├── package.json                        # Dependencias y scripts
├── tsconfig.json                       # Configuración TypeScript
├── vite.config.ts                      # Configuración Vite
├── tailwind.config.js                  # Tailwind CSS config
├── postcss.config.js                   # PostCSS config
├── .gitignore                          # Git ignore rules
├── .env.example                        # Template de variables de entorno
├── README.md                           # Documentación principal
├── DEVELOPMENT_CHECKLIST.md            # Checklist de desarrollo
├── PROJECT_STRUCTURE.md                # Este archivo
│
└── src/
    ├── main.tsx                        # Entry point React
    ├── App.tsx                         # Router principal
    │
    ├── api/
    │   ├── client.ts                   # Axios instance con interceptores
    │   └── hooks/
    │       ├── useAuth.ts              # Hook para autenticación
    │       ├── useLeads.ts             # Hook para CRUD de leads
    │       └── useDashboard.ts         # Hook para dashboard
    │
    ├── components/
    │   ├── ErrorBoundary.tsx           # Error boundary wrapper
    │   ├── Navigation.tsx              # Navbar principal
    │   ├── ProtectedRoute.tsx          # Wrapper para rutas protegidas
    │   │
    │   ├── common/                     # Componentes base reutilizables
    │   │   ├── Button.tsx              # Botón (4 variantes, 3 tamaños)
    │   │   ├── Input.tsx               # Campo de entrada
    │   │   ├── Card.tsx                # Contenedor genérico + StatCard
    │   │   ├── Badge.tsx               # Etiqueta de estado + Loader
    │   │   └── Table.tsx               # Tabla genérica reutilizable
    │   │
    │   └── forms/                      # Componentes de formularios
    │       ├── LoginForm.tsx           # Formulario de login
    │       └── CreateLeadForm.tsx      # Formulario para crear leads
    │
    ├── pages/
    │   ├── LoginPage.tsx               # Página de autenticación
    │   ├── DashboardPage.tsx           # Dashboard principal
    │   ├── LeadsPage.tsx               # Listado de leads
    │   ├── LeadDetailPage.tsx          # Detalle de un lead
    │   ├── CreateLeadPage.tsx          # Crear nuevo lead
    │   ├── AutomationPage.tsx          # Gestión de automatizaciones
    │   └── ReportsPage.tsx             # Reportes y análisis
    │
    ├── store/
    │   ├── authStore.ts                # Zustand store para auth
    │   └── leadsStore.ts               # Zustand store para leads
    │
    ├── styles/
    │   └── index.css                   # Tailwind imports + estilos base
    │
    └── types/
        └── index.ts                    # Definiciones TypeScript (10+ interfaces)

```

## Conteo de Archivos

- **Archivos de Configuración**: 7 (package.json, tsconfig.json, vite.config.ts, etc)
- **Archivos TypeScript/React**: 26
  - Componentes: 15 (5 base + 2 forms + 7 páginas + 3 especiales)
  - API/Hooks: 4
  - Stores: 2
  - Tipos: 1
  - App: 1
- **Archivos de Documentación**: 3 (README.md, DEVELOPMENT_CHECKLIST.md, PROJECT_STRUCTURE.md)
- **Otros**: 2 (.gitignore, .env.example)

**Total: 38 archivos creados**

## Líneas de Código por Sección

```
src/components/common/        ~450 líneas
src/components/forms/         ~180 líneas
src/components/               ~120 líneas (ProtectedRoute, Navigation, ErrorBoundary)
src/pages/                    ~900 líneas
src/api/                      ~400 líneas
src/store/                    ~120 líneas
src/types/                    ~100 líneas
src/styles/                   ~50 líneas
src/App.tsx                   ~100 líneas
src/main.tsx                  ~30 líneas
─────────────────────────────────────
TOTAL src/                    ~2,836 líneas
```

## Dependencias Principales

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "react-router-dom": "^6.x",
    "axios": "^1.x",
    "zustand": "^4.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@vitejs/plugin-react": "^4.x",
    "vite": "^5.x",
    "tailwindcss": "^3.x",
    "autoprefixer": "^10.x",
    "postcss": "^8.x"
  }
}
```

## Patrones de Arquitectura Implementados

### 1. **Component-Based Architecture**
- Componentes pequeos y reutilizables
- Composición sobre herencia
- Props drilling minimizado con Zustand

### 2. **Custom Hooks Pattern**
- `useAuth()` - Encapsula lógica de autenticación
- `useLeads()` - Encapsula CRUD de leads
- `useLead()` - Encapsula detalle de un lead
- `useDashboard()` - Encapsula fetch de métricas

### 3. **State Management with Zustand**
- Store único para autenticación
- Store único para leads
- Suscripción automática a cambios
- Persistencia en localStorage

### 4. **Protected Routes**
- `ProtectedRoute` wrapper verifica autenticación
- Redirección automática a /login si no autenticado
- Soporte para role-based access control (RBAC)

### 5. **API Client Pattern**
- Axios instance configurado centralmente
- Interceptores para JWT
- Error handling globalizado
- Redirección automática en 401

### 6. **Form Handling**
- Formularios controlados con useState
- Validación cliente-lado
- Error messages inline
- Loading states en buttons

### 7. **Responsive Design**
- Mobile-first approach
- Breakpoints: sm, md, lg, xl
- Tailwind utility classes
- Dark mode support

### 8. **Error Handling**
- React Error Boundary
- Try-catch en API calls
- User-friendly error messages
- Console logs para debugging

### 9. **Type Safety**
- TypeScript en 100% del código
- Interfaces para todas las entities
- Props typing completo
- Generic types donde es necesario

### 10. **Performance Optimization**
- Code splitting automático (Vite)
- Hot Module Replacement (HMR)
- Tree-shaking de código muerto
- Lazy loading de rutas (próximo)

## Flujo de Datos

### Autenticación
```
LoginPage → LoginForm → useAuth() → api.post('/auth/login')
  ↓
authStore.setToken() + authStore.setUser()
  ↓
localStorage token
  ↓
Redirect /dashboard → ProtectedRoute checks isAuthenticated
```

### Leads CRUD
```
LeadsPage → useLeads() → api.get('/leads')
  ↓
leadsStore.setLeads() + setTotal()
  ↓
Table rendered con datos

CreateLeadPage → CreateLeadForm → useLeads.createLead()
  ↓
api.post('/leads', data)
  ↓
leadsStore.addLead() → Redirect /leads
```

### Dashboard
```
DashboardPage → useDashboard() → api.get('/crm/dashboard')
  ↓
Métricas renderizadas en StatCards
```

## Integración con Backend

Todos los endpoints esperan respuestas en este formato:

### Success Response
```json
{
  "data": {...},
  "total": 10
}
```

### Error Response
```json
{
  "detail": "Mensaje de error descriptivo"
}
```

### Authentication
```
Header: Authorization: Bearer {jwt_token}
```

El frontend:
1. Guarda el token en localStorage
2. Lo añade automáticamente a cada request
3. Redirige a /login si recibe 401
4. Muestra errores del servidor al usuario

## Features Principales por Página

### LoginPage ✅
- Formulario email/password
- Validación client-side
- Error display
- Redirección en éxito
- Loading state

### DashboardPage ✅
- 4 métricas principales (StatCards)
- Gráfico de estado de leads
- Tabla de industrias
- Actividad reciente
- Dark mode

### LeadsPage ✅
- Tabla paginada
- Búsqueda por empresa/contacto/email
- Filtro por estado
- Contador de resultados
- Acciones (Ver/Eliminar)
- Botón crear nuevo

### LeadDetailPage ✅
- Vista completa del lead
- Edición inline de campos
- Cambio de estado con 5 opciones
- Detalles de vacante
- Análisis (pain points, solución, confianza)
- Sistema de notas
- Navegación back

### CreateLeadPage ✅
- Formulario de 4 secciones
- Validación de campos requeridos
- Sliders para confianza
- Textareas para descripciones
- Submit y Cancel buttons
- Success redirect

### AutomationPage ✅
- Listado de reglas activas
- Crear nueva regla
- Frecuencias personalizables
- Toggle activo/inactivo
- Contador de ejecuciones
- Última ejecución timestamp
- Eliminar reglas

### ReportsPage ✅
- 5 métricas principales
- Embudo de conversión visual
- % de progresión por etapa
- Tabla de desempeño por industria
- Tasas clave (contacto, respuesta, cierre)

## Testing Coverage Ready

Estructura lista para:
- Unit tests con Vitest
- Component tests con React Testing Library
- Integration tests
- E2E tests con Cypress/Playwright

## Próximas Fases

### Fase 2: Features Avanzadas (Semana 3)
- Toast notifications
- Modal dialogs
- Bulk operations
- Export/Import
- Advanced search

### Fase 3: Performance (Semana 4)
- Route-based code splitting
- Image optimization
- Virtual scrolling
- Service workers
- Offline mode

### Fase 4: Testing (Semana 4-5)
- Unit tests
- Component tests
- Integration tests
- E2E tests
- 80%+ coverage

### Fase 5: Production Ready (Semana 5)
- Security headers
- Rate limiting
- Analytics
- Monitoring
- Documentation

---

**Generado**: 2026-09-23
**Status**: ✅ Completo para Semana 3 Fase 1
