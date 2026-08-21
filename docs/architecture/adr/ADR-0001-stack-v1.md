# ADR-0001 — Stack TypeScript y ORM de RHIA v1

- Estado: ACEPTADO
- Fecha: 2026-08-20
- Task: `PH02-T002`

## Contexto

RHIA debe conservar PostgreSQL y n8n, operar localmente con pocos pasos y evolucionar hacia una App, Core y Worker sin microservicios prematuros. El repositorio existente todavía no tenía un runtime de aplicación congelado.

## Decisión

Adoptar Node.js 24 LTS, TypeScript strict, npm workspaces, Next.js para App+BFF, PostgreSQL 18, Drizzle para acceso/migraciones y Zod para contratos runtime.

## Spike Prisma vs Drizzle

Se modeló la misma tabla PostgreSQL con ambos candidatos, se generó SQL y se aplicaron ambas migraciones sobre bases PostgreSQL 18 desechables independientes.

| Criterio | Prisma 7 | Drizzle 0.45 | Decisión |
|---|---|---|---|
| SQL revisable | Genera SQL editable | Genera SQL directo y snapshots | Empate |
| Encaje con schema existente | Introspección y schema Prisma | Database-first o code-first | Drizzle |
| Runtime/codegen | Cliente generado | Tipos TypeScript sin cliente generado | Drizzle |
| Control de PostgreSQL | Abstracción mayor | Primitivas cercanas a SQL | Drizzle |
| Simplicidad local | CLI + schema + client | ORM + kit; migración visible | Drizzle |
| Ecosistema/ergonomía | Muy sólido | Suficiente y más explícito | Prisma |

La preferencia provisional del Plan por Prisma se reemplaza por Drizzle porque RHIA ya tiene un schema PostgreSQL que debe preservarse y necesita migraciones aditivas fáciles de auditar. Prisma permanece documentado como alternativa, no como dependencia de producción.

El dry-run produjo en ambos casos 1 tabla, 4 columnas y 3 índices. Drizzle pudo generar SQL offline; Prisma necesitó su motor nativo, OpenSSL y una base temporal para producir la migración. El typecheck, build y una segunda ejecución desde los SQL guardados aprobaron. La auditoría de producción reportó cero vulnerabilidades; las cuatro alertas moderadas restantes pertenecen al tooling de Drizzle y no justifican un downgrade breaking automático.

## Consecuencias

- El equipo revisará SQL generado antes de aplicarlo.
- Los contratos no dependerán de modelos ORM.
- La adopción de Drizzle puede requerir más SQL explícito, aceptado a cambio de transparencia.
- Prisma se retira de las dependencias instaladas después del spike; su schema y migración quedan como evidencia reproducible del comparativo.
- Cambiar ORM exige un ADR nuevo y un plan de migración; no se decide informalmente en tareas posteriores.

## Rechazado por ahora

- Node 26: todavía Current, no LTS al decidir.
- pnpm: eficaz, pero añade una instalación y un concepto operativo que npm workspaces cubre en v1.
- Prisma como ORM principal: excelente ergonomía, pero mayor codegen/capa para un sistema database-first.
- Redis/microservicios: no justifican su costo para el volumen inicial.
