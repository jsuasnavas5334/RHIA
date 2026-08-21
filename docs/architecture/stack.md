# Stack RHIA v1

## Estado

- Decisión: congelada por `PH02-T002`.
- Fecha: 2026-08-20.
- Principio: monolito modular + workers, un lenguaje principal y sin infraestructura prematura.

## Selecciones

| Categoría | Opción v1 | Motivo operativo |
|---|---|---|
| Runtime | Node.js 24.19 LTS (`Krypton`) | Es el LTS vigente; Node 26 continúa en estado Current. |
| Lenguaje | TypeScript 7.0, `strict` | Un único lenguaje para App, Core, Worker y contratos. |
| Módulos | ESM + `NodeNext` | Alineado con Node actual y dependencias modernas. |
| Monorepo | npm 11 workspaces | Viene con Node y evita instalar otro gestor para el usuario. |
| Frontend/BFF | Next.js + TypeScript | Mantiene App y BFF en un despliegue, según el Plan Maestro. |
| Persistencia | PostgreSQL 18 | Preserva el servicio y los datos existentes. |
| ORM/migraciones | Drizzle ORM + Drizzle Kit | SQL generado visible, flujo database/code-first y menor capa operativa. |
| Validación | Zod 4 | Contratos runtime y TypeScript derivados de una sola definición. |
| Unit tests | `node:test` | Runner incluido en Node; agregar herramientas solo cuando aporten cobertura. |
| E2E browser | Playwright | Ya definido por el Plan; se incorpora en PH09/PH10. |
| Lint | ESLint con flat config | Estándar único para TypeScript; se fija al crear los primeros packages de aplicación. |
| Formato | Prettier | Formato mecánico sin reglas de negocio. |
| Jobs v1 | Cola respaldada por PostgreSQL | Evita Redis y conserva la arquitectura local-first. |

No se introduce Fastify separado, Redis, Kafka, Kubernetes ni microservicios en v1.

## Convenciones obligatorias

### Naming

- Archivos y directorios: `kebab-case`.
- Variables y funciones TypeScript: `camelCase`.
- Tipos, clases y schemas: `PascalCase`; los schemas Zod terminan en `Schema`.
- Tablas, columnas e índices PostgreSQL: `snake_case`.
- Estados persistidos y códigos cerrados: `SCREAMING_SNAKE_CASE`.
- IDs en payloads: sufijo `Id`; claves externas: sufijo `Key`.

### Errores

- Formato: `RHIA_<DOMINIO>_<CONDICIÓN>`; ejemplo `RHIA_SEARCH_PROVIDER_DEGRADED`.
- Todo error contractual incluye `code`, `message`, `retryable`, `correlationId` y detalles redactados opcionales.
- Mensajes y logs nunca contienen tokens, passwords, payloads personales completos ni valores de credenciales.
- Los errores retryable y non-retryable son categorías explícitas, no se infieren desde texto.

### Schemas y contratos

- Toda entrada externa se valida con Zod antes de entrar al dominio.
- Los objetos contractuales usan `version` literal desde su primera versión.
- Fechas externas: ISO 8601 UTC; fechas PostgreSQL: `timestamptz`.
- Los schemas rechazan propiedades desconocidas en límites externos.
- El dominio no importa tipos de Next.js, n8n ni SDKs de proveedores.

### TypeScript

- `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` son obligatorios.
- No se permite `any` salvo adapter documentado y validado inmediatamente.
- Imports ESM explícitos; el build no depende de aliases no resolubles por Node.

## Reglas de migración

1. Generar SQL; nunca usar `push` contra bases activas.
2. Revisar el SQL antes de ejecutarlo.
3. Migraciones PH03 inicialmente aditivas y con rollback documentado.
4. Probar contra PostgreSQL temporal restaurado o vacío, nunca primero contra el origen.
5. No permitir `DROP`, truncado o conversión destructiva sin tarea y aprobación explícitas.

## Verificación de la decisión

- `npm run typecheck`: aprobado con TypeScript 7 strict.
- `npm run build`: aprobado en Node.js 24.19.0.
- `scripts/test-orm-spike.sh`: aprobado dos veces en PostgreSQL 18 aislado.
- Drizzle y Prisma produjeron el mismo catálogo de prueba: 1 tabla, 4 columnas y 3 índices.
- El SQL de ambos candidatos no contiene `DROP`, `TRUNCATE`, `DELETE` ni `ALTER`.
- `npm audit --omit=dev`: 0 vulnerabilidades en dependencias de producción.
- Auditoría completa: 4 moderadas transitivas de `drizzle-kit`/`esbuild`, limitadas a tooling de desarrollo. No se aplica el `fix --force` propuesto porque instalaría una versión breaking.
- Prisma fue retirado de las dependencias instaladas después del comparativo; se conservan únicamente su schema y SQL generado como evidencia.

## Fuentes verificadas

- [Node.js Releases](https://nodejs.org/en/about/previous-releases)
- [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/)
- [TypeScript strict](https://www.typescriptlang.org/tsconfig/strict.html)
- [Drizzle Kit](https://orm.drizzle.team/docs/kit-overview)
- [Prisma Migrate](https://docs.prisma.io/docs/orm/prisma-migrate)
