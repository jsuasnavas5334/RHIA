# PH01-T003 — Baseline de workflows n8n

## Estado

- Captura: 2026-08-19 20:39 UTC-05:00
- Estado de tarea: `DONE`
- Método: consultas de catálogo de solo lectura y ayuda del CLI n8n
- Workflows ejecutados o modificados: ninguno
- Parámetros, payloads y valores de credenciales leídos: ninguno

## Resumen

| Métrica | Valor observado |
|---|---:|
| Workflows | 10 |
| Activos | 6 |
| Inactivos | 4 |
| Nodos | 103 |
| Ejecuciones acumuladas | 269 |
| Ejecuciones exitosas | 261 |
| Ejecuciones con error | 8 |
| Referencias de credencial | 10 |
| Tipos de credencial referenciados | 1 (`postgres`) |

No se consultaron `execution_data`, parámetros de nodos, valores de credenciales ni datos personales.

## Inventario y clasificación inicial

| ID | Workflow | Activo | Nodos | Éxito/Error | Clasificación | Observación |
|---|---|---:|---:|---:|---|---|
| `SABQvxTRr1mrpmJI` | RHIA CORE - Heartbeat | sí | 3 | 133/0 | `LISTO` | Schedule → Set → PostgreSQL; baseline estable. |
| `WsN7YI1FAeOIFGrR` | RHIA - Orquestador Prospector | sí | 13 | 83/6 | `REFACTORIZAR` | Webhook, control y cuatro subworkflows; concentra coordinación y manejo de error. |
| `v7JqlLLIME4NwJo0` | RHIA - Descubrimiento RRHH | sí | 13 | 8/0 | `PARCIAL` | Descubrimiento, HTTP, código y persistencia PostgreSQL. |
| `j4maQyGj457W4yFs` | RHIA - Investigación Empresa | sí | 7 | 7/0 | `PARCIAL` | Investigación HTTP con transformación y salida explícita. |
| `njuTLU32Gy0BB0yy` | RHIA - Contactabilidad | sí | 4 | 3/0 | `PARCIAL` | Lee candidatos, consulta fuente y procesa resultado. |
| `kxUFfTOkwhEOkxnd` | RHIA - Verificación Personas | sí | 6 | 5/1 | `PARCIAL` | Lectura/actualización PostgreSQL, HTTP y salida explícita. |
| `KV6AIXyIPWKSaTAp` | RHIA - Resolución Entidad y País | no | 13 | 22/1 | `PARCIAL` | Contiene resolución regional, diagnóstico y evaluación de evidencia; debe conservarse. |
| `lCtxsiSAcHEQFgou` | RHIA AI CORE - BACKUP POST-MODULARIZACION | no | 12 | 0/0 | `DECISIÓN` | Copia de arquitectura modular; no eliminar hasta comparar export y versión activa. |
| `0dMjxOujIFKDSkek` | RHIA AI CORE - Ollama Local - BACKUP PRE-MODULARIZACION | no | 31 | 0/0 | `DECISIÓN` | Workflow monolítico histórico con 31 nodos y cuatro referencias PostgreSQL. |
| `dYu54NZ7QgYjPBeb` | RHIA AI CORE - Prueba Ollama | no | 1 | 0/0 | `DECISIÓN` | Solo disparador manual; confirmar utilidad antes de archivar o conservar como fixture. |

Ningún workflow se clasifica como `ELIMINAR` durante la auditoría.

## Tipos de nodo

| Tipo | Cantidad |
|---|---:|
| Code | 28 |
| HTTP Request | 16 |
| Set/Edit Fields | 16 |
| PostgreSQL | 10 |
| Execute Workflow | 8 |
| Split Out | 7 |
| If | 6 |
| Execute Workflow Trigger | 5 |
| Manual Trigger | 5 |
| Schedule Trigger | 1 |
| Webhook | 1 |

La concentración de 28 nodos Code confirma lógica de negocio embebida que deberá migrar gradualmente a RHIA Core, sin reescritura inmediata.

## Dependencias entre workflows

```text
RHIA - Orquestador Prospector
├── RHIA - Descubrimiento RRHH
├── RHIA - Investigación Empresa
├── RHIA - Verificación Personas
└── RHIA - Contactabilidad

RHIA AI CORE - BACKUP POST-MODULARIZACION
├── las mismas cuatro dependencias
└── permanece inactivo como referencia histórica
```

Los ocho nodos `Execute Workflow` apuntan a los cuatro subworkflows por sus IDs actuales. Esos IDs deben preservarse o remapearse explícitamente durante importación.

## Entradas y salidas observables

| Workflow | Entrada estructural | Salida estructural |
|---|---|---|
| Orquestador Prospector | Webhook; trigger manual deshabilitado | Resultados encadenados de cuatro subworkflows |
| Descubrimiento RRHH | Execute Workflow Trigger | Nodo `Return` |
| Investigación Empresa | Execute Workflow Trigger | Nodo `Return` |
| Verificación Personas | Execute Workflow Trigger | Nodo `Return` |
| Contactabilidad | Execute Workflow Trigger | Resultado del flujo HTTP/código |
| Resolución Entidad y País | Trigger manual y Execute Workflow Trigger | Evidencia consolidada por mercado; inactivo |
| Heartbeat | Schedule Trigger | Escritura de registro PostgreSQL |

Los contratos de campos todavía deben extraerse de exports sanitizados; no se infieren a partir de nombres de nodos.

### Campos referenciados por expresiones y nodos Set

| Workflow | Campos de entrada observados | Campos escritos por Set |
|---|---|---|
| Orquestador Prospector | `body`, `busqueda_contacto_requerida`, `empresa`, `pais`, `tarea` | `accion_siguiente`, `estado_investigacion`, `instruccion_investigacion`, `tarea` |
| Descubrimiento RRHH | `candidatos_verificar`, `consulta_persona_contacto`, `empresa` | `consulta_persona_contacto`, `empresa`, `tipo_busqueda` |
| Investigación Empresa | `empresa`, `pais`, `urls_para_verificar` | campos técnicos de agregación |
| Verificación Personas | `cargo_declarado`, `cargo_verificado`, `consulta_verificacion`, `empresa`, `estado_verificacion`, `persona_contacto` | `empresa` y resultado procesado por Code |
| Contactabilidad | `consulta_contacto_directo`, `empresa` | resultado procesado por Code/HTTP |
| Resolución Entidad y País | `ciudad_consulta`, `consultas_resolucion_entidad`, `empresa_mencionada`, `pais_consulta` | fixture `ciudad`, `empresa`, `pais` |
| Heartbeat | `estado`, `fecha`, `sistema` | `estado`, `fecha`, `sistema` |

Estos campos se derivan de expresiones y asignaciones del export; no constituyen todavía contratos Core versionados.

## Credenciales

- Se observaron 10 referencias en 6 workflows.
- Todas usan el tipo `postgres`.
- No se consultaron IDs, nombres ni valores de credenciales.
- Los exports versionables deben retirar referencias concretas y requerir reasignación al importar.

## Riesgos y gaps

1. Hay lógica de negocio extensa en nodos Code y coordinación centralizada en n8n.
2. El orquestador concentra 6 de los 8 errores históricos observados.
3. La resolución regional relevante está inactiva y todavía no forma parte del orquestador activo.
4. Los dos backups históricos pueden divergir de los subworkflows activos.
5. Los contratos de campos necesitan formalización posterior en PH02 aunque el baseline ya registra las referencias actuales.

## Export e importación verificados

- `scripts/export-n8n-workflows.sh` usa el CLI de n8n y genera un archivo por workflow.
- `scripts/sanitize-n8n-export.mjs` bloquea posibles secretos embebidos y retira `pinData`, `staticData`, metadata compartida y referencias concretas de credenciales.
- Los 10 JSON sanitizados y `manifest.json` están en `docs/baseline/n8n/workflows/`.
- `scripts/test-n8n-workflow-import.sh` importó los 10 workflows en PostgreSQL+n8n aislados.
- Los IDs y 103 nodos se preservaron; los workflows quedaron inactivos y sin referencias de credenciales.
- El workflow manual de prueba, que no contiene acciones externas, se ejecutó como smoke test aislado.
- Los contenedores, red y volúmenes desechables se retiraron al finalizar.
- El CLI aislado informó ausencia de Python 3 para el runner interno; el smoke JavaScript terminó `success` y este aviso no afectó el baseline.

## Validación final

Todos los workflows tienen clasificación, los exports importan sin credenciales y las entradas/salidas críticas están descritas al nivel observable actual. `PH01-T003` queda `DONE` y entrega a PH02 la lista de contratos que deben formalizarse.
