# CODEX_HANDOFF — RHIA

## Instrucción principal

Lee `PLAN_MAESTRO.md` completo antes de ejecutar cambios.

No rediseñes RHIA desde cero. El Plan Maestro define el alcance, arquitectura objetivo, fases, dependencias, quality gates, run order y Definition of Done.

## Forma de trabajo

Antes de cada tarea:
1. Identifica el Task ID.
2. Lee su Context Packet.
3. Verifica dependencias.
4. Comprueba el gate anterior.
5. Inspecciona el estado real.
6. Ejecuta.

Al terminar, reporta:

```text
TASK:
STATUS: DONE | PARTIAL | BLOCKED | FAILED

OBJETIVO:
CAMBIOS REALIZADOS:
ARCHIVOS MODIFICADOS:
PRUEBAS EJECUTADAS:
RESULTADOS:
EVIDENCIA:
RIESGOS PENDIENTES:
DECISIONES TOMADAS:
SIGUIENTE TAREA DESBLOQUEADA:
```

No declares una tarea terminada con solo “implementado”.

## No pedir permiso para

- crear archivos normales;
- organizar carpetas;
- escribir documentación;
- implementar tareas ya autorizadas por el Plan Maestro;
- crear tests;
- ejecutar pruebas locales;
- refactors reversibles;
- corregir bugs evidentes;
- crear migrations de desarrollo;
- mejorar estructura interna.

## Detenerse y pedir decisión antes de

- borrar datos;
- hacer cambios irreversibles;
- cambiar requisitos de producto;
- cambiar una decisión arquitectónica crítica;
- gastar dinero significativo;
- usar nuevos secretos/permisos;
- desplegar a producción;
- modificar precios;
- conceder descuentos;
- asumir compromisos comerciales;
- realizar acciones sensibles de seguridad/legal.

## Principios técnicos

- PostgreSQL = source of truth.
- n8n = orchestration layer.
- Modelos de IA = razonamiento, no memoria de estado.
- API > Playwright > Computer Use > humano.
- Provider-agnostic AI Gateway.
- Country/city dinámicos.
- No hardcodes por país/ciudad.
- Company Group → Company Entity → Company Location.
- Evidencia y decisiones deben conservar trazabilidad.
- Idempotencia obligatoria en acciones externas.
- Retry/backoff no debe duplicar outreach.
- Máximo inicial de 3 toques proactivos por secuencia.

## Meta de capacidad v1

100 empresas/día.

## KPI comercial principal

Reuniones calificadas realizadas.

KPI complementario:
Reuniones calificadas agendadas.
